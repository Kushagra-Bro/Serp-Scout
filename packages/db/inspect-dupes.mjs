import { neon } from '@neondatabase/serverless';
import { DATABASE_URL as dbUrl } from './test-env.mjs';

if (!dbUrl) { console.error('DATABASE_URL missing'); process.exit(1); }
const sql = neon(dbUrl);

// Mirrors apps/api/src/lib/website-url.ts exactly.
function normalize(raw) {
  if (!raw) return '';
  let v = raw.trim().toLowerCase();
  const h = v.indexOf('#');
  if (h !== -1) v = v.slice(0, h);
  v = v.replace(/^https?:\/\//, '');
  v = v.replace(/^www\./, '');
  if (v.length > 1 && v.endsWith('/')) v = v.replace(/\/+$/, '');
  return v;
}

const [meta] = await sql`select current_database() as db, current_user as usr, version() as ver`;
console.log('database :', meta.db);
console.log('user     :', meta.usr);
console.log('version  :', meta.ver.split(',')[0]);

const [cnt] = await sql`select count(*)::int as n from businesses`;
console.log('\nbusinesses rows:', cnt.n);

const [wscnt] = await sql`select count(*)::int as n from workspaces`;
console.log('workspaces rows:', wscnt.n);

const idx = await sql`select indexname, indexdef from pg_indexes where tablename = 'businesses' order by indexname`;
console.log('\n--- indexes on businesses ---');
for (const r of idx) console.log(' ', r.indexname, '\n    ', r.indexdef);

const constraints = await sql`
  select conname, pg_get_constraintdef(oid) as def
  from pg_constraint
  where conrelid = 'businesses'::regclass
  order by conname`;
console.log('\n--- constraints on businesses ---');
for (const r of constraints) console.log(' ', r.conname, '=>', r.def);

const rows = await sql`select id, workspace_id, name, website_url, created_at from businesses order by workspace_id, created_at`;
console.log('\n--- duplicate scan (normalized URL within workspace) ---');
const byWs = new Map();
for (const r of rows) {
  const key = normalize(r.website_url);
  if (!byWs.has(r.workspace_id)) byWs.set(r.workspace_id, new Map());
  const m = byWs.get(r.workspace_id);
  if (!m.has(key)) m.set(key, []);
  m.get(key).push(r);
}

let dupGroups = 0, dupRows = 0;
for (const [ws, m] of byWs) {
  for (const [key, list] of m) {
    if (list.length > 1) {
      dupGroups++;
      dupRows += list.length;
      console.log(`  workspace ${ws} | key "${key}" | ${list.length} rows`);
      for (const r of list) console.log(`     - ${r.id}  ${r.name}  ${r.website_url}`);
    }
  }
}
console.log(`\nduplicate groups: ${dupGroups}`);
console.log(`rows involved    : ${dupRows}`);
console.log(`redundant rows   : ${dupRows - dupGroups}`);

const empties = rows.filter((r) => !normalize(r.website_url));
console.log('\nrows with empty normalized URL:', empties.length);
for (const r of empties) console.log('  -', r.id, JSON.stringify(r.website_url));
