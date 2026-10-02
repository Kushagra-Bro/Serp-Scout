import { Client } from '@neondatabase/serverless';
import { DATABASE_URL } from './test-env.mjs';

// Does Drizzle include a generated column in INSERT? If it does, Postgres
// throws "cannot insert into column" and every business creation breaks.
// Exercises the REAL app code path (createDb -> drizzle neon-http).

const { createDb, businesses, workspaces } = await import('./dist/index.js');
const { eq } = await import('drizzle-orm');

const url = process.argv[2] || DATABASE_URL;
if (!url) { console.error('usage: node test-drizzle-insert.mjs [DATABASE_URL]'); process.exit(1); }

const db = createDb(url);

let pass = 0, fail = 0;
const check = (label, ok, detail = '') => {
  if (ok) { pass++; console.log(`PASS  ${label}`); }
  else { fail++; console.log(`FAIL  ${label} ${detail}`); }
};

// Probe workspace via raw client so cleanup is trivial.
const raw = new Client(url);
await raw.connect();
const ws = await raw.query(`insert into workspaces (name, owner_id) values ('drizzle-insert-probe', 'probe') returning id`);
const wsId = ws.rows[0].id;

let inserted = null;
try {
  // Exactly what routes/businesses.ts does.
  const [row] = await db
    .insert(businesses)
    .values({
      workspaceId: wsId,
      name: 'Drizzle Insert Probe',
      websiteUrl: 'https://WWW.DrizzleProbe.example.org/',
    })
    .returning();
  inserted = row;
  check('INSERT via Drizzle succeeds', true);
} catch (e) {
  check('INSERT via Drizzle succeeds', false, `-> ${e.message}`);
}

if (inserted) {
  check('normalized_url returned/populated', inserted.normalizedUrl === 'drizzleprobe.example.org',
    `got ${JSON.stringify(inserted.normalizedUrl)}`);

  // Read it back through Drizzle (SELECT must include the column too).
  try {
    const [back] = await db.select().from(businesses).where(eq(businesses.id, inserted.id));
    check('SELECT via Drizzle succeeds', !!back);
    check('SELECT normalized_url matches', back?.normalizedUrl === 'drizzleprobe.example.org',
      `got ${JSON.stringify(back?.normalizedUrl)}`);
  } catch (e) {
    check('SELECT via Drizzle succeeds', false, `-> ${e.message}`);
  }

  // UPDATE via Drizzle (PATCH path).
  try {
    const [upd] = await db.update(businesses)
      .set({ name: 'Drizzle Insert Probe 2', updatedAt: new Date() })
      .where(eq(businesses.id, inserted.id))
      .returning();
    check('UPDATE via Drizzle succeeds', !!upd);
    check('UPDATE keeps normalized_url computed', upd?.normalizedUrl === 'drizzleprobe.example.org',
      `got ${JSON.stringify(upd?.normalizedUrl)}`);
  } catch (e) {
    check('UPDATE via Drizzle succeeds', false, `-> ${e.message}`);
  }
}

// Race-proof: two identical inserts, second must fail with a unique violation.
let secondRejected = false, secondMsg = '';
if (inserted) {
  try {
    await db.insert(businesses).values({
      workspaceId: wsId,
      name: 'Concurrent Dup',
      websiteUrl: 'http://drizzleprobe.example.org',
    });
  } catch (e) {
    secondRejected = true; secondMsg = e.message;
  }
  check('concurrent-style duplicate rejected by DB', secondRejected, secondMsg);
}

await raw.query(`delete from workspaces where id = $1`, [wsId]);
const left = await raw.query(`select count(*)::int n from workspaces where name = 'drizzle-insert-probe'`);
console.log(`\nprobe workspaces remaining: ${left.rows[0].n}`);
await raw.end();

console.log(`\n${fail === 0 ? 'ALL PASS' : 'FAILURES'}: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
