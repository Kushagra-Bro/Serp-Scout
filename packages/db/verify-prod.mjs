import { Client } from '@neondatabase/serverless';
import { DATABASE_URL as url } from './test-env.mjs';

if (!url) { console.error('DATABASE_URL missing'); process.exit(1); }

const c = new Client(url);
await c.connect();

console.log('=== PRODUCTION VERIFICATION ===');
const host = new URL(url).hostname;
console.log('host:', host);

const col = await c.query(
  `select column_name, is_generated, data_type
   from information_schema.columns
   where table_name = 'businesses' and column_name = 'normalized_url'`
);
console.log('\nnormalized_url column:', col.rowCount ? `${col.rows[0].is_generated} (${col.rows[0].data_type})` : 'ABSENT');

const idx = await c.query(
  `select indexname, indexdef from pg_indexes where tablename = 'businesses' order by indexname`
);
console.log('\nindexes on businesses:');
for (const r of idx.rows) console.log('  ', r.indexname, '\n     ', r.indexdef);

const sample = await c.query(
  `select "name", "website_url", "normalized_url" from "businesses" order by "created_at"`
);
console.log('\nnormalized values:');
for (const r of sample.rows) console.log(`   ${String(r.website_url).padEnd(40)} -> ${r.normalized_url}`);

// Confirm no duplicates escaped.
const dup = await c.query(
  `select "workspace_id", "normalized_url", count(*)::int n from "businesses"
   group by 1, 2 having count(*) > 1`
);
console.log('\nduplicate groups:', dup.rowCount);

// Confirm NOT NULL survived (regression check on the earlier push concern).
const nn = await c.query(
  `select count(*)::int n from pg_constraint where conrelid = 'businesses'::regclass and contype = 'n'`
);
console.log('businesses NOT NULL constraints:', nn.rows[0].n);

await c.end();
