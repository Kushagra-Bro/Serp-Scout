import { Client } from '@neondatabase/serverless';
import { DATABASE_URL } from './test-env.mjs';

// The app decides duplicates in JS (apps/api/src/lib/website-url.ts) and the DB
// decides them with a generated column. If the two ever disagree, users get a
// 500 (DB rejects after app allowed) or a missed 409 (app allows, DB rejects
// only under concurrency). This asserts they produce identical keys.

const { normalizeWebsiteUrl } = await import(
  'file:///C:/Apps/Contributions/Serp-Scout/apps/api/dist/lib/website-url.js'
);

const c = new Client(DATABASE_URL);
await c.connect();

const samples = [
  'https://Example.com/',
  'http://example.com',
  'https://www.example.com',
  'example.com',
  'www.example.com/',
  'https://example.com/#team',
  '  https://EXAMPLE.com  ',
  'https://example.com/path',
  'https://example.com/path/',
  'https://shop.example.com',
  'https://example.org',
  'http://sub.domain.example.co.uk/biz',
  'https://clovedental.in/',
  'HTTPS://UPPER.COM',
  'example.com?ref=1',
  'http://example.com:8080',
  'https://example.com/a/b/c/',
  'xn--bcher-kva.example',
  'https://m.example.com',
  'example.com.',
];

// Compute both keys in one round trip.
const { rows } = await c.query(
  `select v as raw,
          CASE
            WHEN length(regexp_replace(regexp_replace(regexp_replace(lower(btrim(v)), '#.*$', ''), '^https?://', ''), '^www\.', '')) > 1
            THEN regexp_replace(regexp_replace(regexp_replace(regexp_replace(lower(btrim(v)), '#.*$', ''), '^https?://', ''), '^www\.', ''), '/+$', '')
            ELSE regexp_replace(regexp_replace(regexp_replace(lower(btrim(v)), '#.*$', ''), '^https?://', ''), '^www\.', '')
          END as db_key
   from unnest($1::text[]) as v`,
  [samples]
);

let pass = 0, fail = 0;
for (const r of rows) {
  const js = normalizeWebsiteUrl(r.raw);
  const ok = js === r.db_key;
  if (ok) pass++; else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${JSON.stringify(r.raw).padEnd(34)} js=${JSON.stringify(js).padEnd(30)} db=${JSON.stringify(r.db_key)}`);
}

// Agreement on which pairs are duplicates.
const pairs = [
  ['https://example.com', 'http://www.example.com/', true],
  ['example.com', 'https://Example.com/#x', true],
  ['https://a.com', 'https://b.com', false],
  ['https://shop.example.com', 'https://example.com', false],
  ['https://example.com/about', 'https://example.com', false],
];
console.log('\npairwise agreement:');
for (const [a, b, shouldMatch] of pairs) {
  const jsMatch = normalizeWebsiteUrl(a) === normalizeWebsiteUrl(b);
  const row = (await c.query(
    `select CASE
              WHEN length(regexp_replace(regexp_replace(regexp_replace(lower(btrim(x)), '#.*$', ''), '^https?://', ''), '^www\.', '')) > 1
              THEN regexp_replace(regexp_replace(regexp_replace(regexp_replace(lower(btrim(x)), '#.*$', ''), '^https?://', ''), '^www\.', ''), '/+$', '')
              ELSE regexp_replace(regexp_replace(regexp_replace(lower(btrim(x)), '#.*$', ''), '^https?://', ''), '^www\.', '')
            END as k from (select $1::text as x) s`, [a]
  )).rows[0].k;
  const row2 = (await c.query(
    `select CASE
              WHEN length(regexp_replace(regexp_replace(regexp_replace(lower(btrim(x)), '#.*$', ''), '^https?://', ''), '^www\.', '')) > 1
              THEN regexp_replace(regexp_replace(regexp_replace(regexp_replace(lower(btrim(x)), '#.*$', ''), '^https?://', ''), '^www\.', ''), '/+$', '')
              ELSE regexp_replace(regexp_replace(regexp_replace(lower(btrim(x)), '#.*$', ''), '^https?://', ''), '^www\.', '')
            END as k from (select $1::text as x) s`, [b]
  )).rows[0].k;
  const dbMatch = row === row2;
  const ok = jsMatch === shouldMatch && dbMatch === shouldMatch;
  if (ok) pass++; else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${JSON.stringify(a)} vs ${JSON.stringify(b)} expected=${shouldMatch} js=${jsMatch} db=${dbMatch}`);
}

await c.end();
console.log(`\n${fail === 0 ? 'ALL PASS' : 'FAILURES'}: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
