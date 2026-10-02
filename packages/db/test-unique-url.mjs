import { Client } from '@neondatabase/serverless';
import { DATABASE_URL } from './test-env.mjs';

// End-to-end check of the DB-level duplicate guard on a throwaway workspace.
const url = process.argv[2] || DATABASE_URL;
if (!url) { console.error('usage: node test-unique-url.mjs [DATABASE_URL]'); process.exit(1); }

const c = new Client(url);
await c.connect();

let pass = 0, fail = 0;
const check = (label, ok, detail = '') => {
  if (ok) { pass++; console.log(`PASS  ${label}`); }
  else { fail++; console.log(`FAIL  ${label} ${detail}`); }
};

// Synthetic workspace so we never disturb real tenants.
const ws = await c.query(
  `insert into workspaces (name, owner_id) values ('unique-url-probe', 'probe-owner') returning id`
);
const wsId = ws.rows[0].id;
console.log(`probe workspace: ${wsId}\n`);

async function addBiz(name, url) {
  return c.query(
    `insert into businesses (workspace_id, name, website_url) values ($1, $2, $3) returning id, normalized_url`,
    [wsId, name, url]
  );
}

// 1. First insert works and the generated column is populated by Postgres.
const first = await addBiz('Probe A', 'https://Example.com/');
check('first insert accepted', first.rowCount === 1);
check('normalized_url computed by DB', first.rows[0].normalized_url === 'example.com',
  `got ${JSON.stringify(first.rows[0].normalized_url)}`);

// 2. Every same-site variant must be rejected, even though the strings differ.
const variants = [
  'http://example.com',
  'https://www.example.com',
  'example.com',
  'www.example.com/',
  'https://example.com/#team',
  '  https://EXAMPLE.com  ',
];
for (const v of variants) {
  let rejected = false, msg = '';
  try {
    await addBiz('Dup', v);
  } catch (e) {
    rejected = true; msg = e.message;
  }
  check(`variant rejected: ${JSON.stringify(v)}`, rejected, msg);
}

// 3. A genuinely different site must still be allowed.
let distinctOk = false;
try { await addBiz('Probe B', 'https://other-site.org'); distinctOk = true; }
catch (e) { console.log('  distinct-site error:', e.message); }
check('distinct site accepted', distinctOk);

// 4. Subdomain and path must NOT collide (conservative normalizer).
let subOk = false, pathOk = false;
try { await addBiz('Probe C', 'https://shop.example.com'); subOk = true; } catch (e) { console.log('  subdomain error:', e.message); }
try { await addBiz('Probe D', 'https://example.com/about'); pathOk = true; } catch (e) { console.log('  path error:', e.message); }
check('subdomain is distinct', subOk);
check('different path is distinct', pathOk);

// 5. Same URL in a DIFFERENT workspace must be allowed (tenant scoping).
const ws2 = await c.query(`insert into workspaces (name, owner_id) values ('unique-url-probe-2', 'probe-owner') returning id`);
let crossTenantOk = false;
try {
  await c.query(
    `insert into businesses (workspace_id, name, website_url) values ($1, $2, $3)`,
    [ws2.rows[0].id, 'Other tenant', 'https://Example.com']
  );
  crossTenantOk = true;
} catch (e) { console.log('  cross-tenant error:', e.message); }
check('same URL allowed in another workspace', crossTenantOk);

// Cleanup.
await c.query(`delete from workspaces where id in ($1, $2)`, [wsId, ws2.rows[0].id]);
const left = await c.query(`select count(*)::int as n from workspaces where owner_id = 'probe-owner'`);
console.log(`\nprobe workspaces remaining: ${left.rows[0].n}`);

await c.end();
console.log(`\n${fail === 0 ? 'ALL PASS' : 'FAILURES'}: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
