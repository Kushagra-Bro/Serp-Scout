import * as dotenv from 'dotenv';
import { neon } from '@neondatabase/serverless';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), 'apps/api/.env') });

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('DATABASE_URL is not defined in ../../apps/api/.env');
  process.exit(1);
}

const sql = neon(dbUrl);

async function run() {
  console.log('Running schema upgrades on Neon DB...');

  await sql`ALTER TABLE "recommendations" ADD COLUMN IF NOT EXISTS "checklist" jsonb;`;
  console.log('✓ Column recommendations.checklist verified');

  await sql`CREATE TABLE IF NOT EXISTS "report_shares" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "report_id" uuid NOT NULL REFERENCES "reports"("id") ON DELETE CASCADE,
    "business_id" uuid NOT NULL REFERENCES "businesses"("id") ON DELETE CASCADE,
    "share_token" varchar(64) NOT NULL UNIQUE,
    "view_mode" varchar(20) NOT NULL DEFAULT 'executive',
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone NOT NULL DEFAULT now()
  );`;
  console.log('✓ Table report_shares verified');

  await sql`CREATE TABLE IF NOT EXISTS "market_alerts" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "business_id" uuid NOT NULL REFERENCES "businesses"("id") ON DELETE CASCADE,
    "type" varchar(50) NOT NULL,
    "severity" varchar(20) NOT NULL DEFAULT 'critical',
    "title" text NOT NULL,
    "description" text NOT NULL,
    "details" jsonb,
    "dismissed" boolean NOT NULL DEFAULT false,
    "detected_at" timestamp with time zone NOT NULL DEFAULT now()
  );`;
  console.log('✓ Table market_alerts verified');

  // Duplicate-website guard.
  //
  // The application returns 409 in routes/businesses.ts, but that only covers
  // sequential requests -- two concurrent POSTs would both pass the SELECT and
  // insert twice, doubling SerpApi quota spend on identical data. The column is
  // GENERATED so Postgres always agrees with normalizeWebsiteUrl() in
  // apps/api/src/lib/website-url.ts, and the unique index closes the race.
  //
  // Refuse to proceed if duplicates already exist rather than deleting rows.
  const dupes = await sql`
    SELECT "workspace_id", "normalized_url", COUNT(*)::int AS n
    FROM (
      SELECT "workspace_id",
             CASE
               WHEN length(regexp_replace(regexp_replace(regexp_replace(lower(btrim("website_url")), '#.*$', ''), '^https?://', ''), '^www\.', '')) > 1
               THEN regexp_replace(regexp_replace(regexp_replace(regexp_replace(lower(btrim("website_url")), '#.*$', ''), '^https?://', ''), '^www\.', ''), '/+$', '')
               ELSE regexp_replace(regexp_replace(regexp_replace(lower(btrim("website_url")), '#.*$', ''), '^https?://', ''), '^www\.', '')
             END AS "normalized_url"
      FROM "businesses"
    ) AS derived
    GROUP BY 1, 2 HAVING COUNT(*) > 1;`;

  if (dupes.length > 0) {
    console.error(`✗ ${dupes.length} duplicate website(s) already exist -- fix these before adding the unique index:`);
    for (const d of dupes) {
      console.error(`   workspace ${d.workspace_id}: "${d.normalized_url}" x${d.n}`);
    }
    process.exit(1);
  }

  await sql`ALTER TABLE "businesses"
    ADD COLUMN IF NOT EXISTS "normalized_url" text
    GENERATED ALWAYS AS (
      CASE
        WHEN length(regexp_replace(regexp_replace(regexp_replace(lower(btrim("website_url")), '#.*$', ''), '^https?://', ''), '^www\.', '')) > 1
        THEN regexp_replace(regexp_replace(regexp_replace(regexp_replace(lower(btrim("website_url")), '#.*$', ''), '^https?://', ''), '^www\.', ''), '/+$', '')
        ELSE regexp_replace(regexp_replace(regexp_replace(lower(btrim("website_url")), '#.*$', ''), '^https?://', ''), '^www\.', '')
      END
    ) STORED;`;
  console.log('✓ Column businesses.normalized_url verified (generated)');

  await sql`CREATE UNIQUE INDEX IF NOT EXISTS "businesses_workspace_normalized_url_uniq"
    ON "businesses" ("workspace_id", "normalized_url");`;
  console.log('✓ Index businesses_workspace_normalized_url_uniq verified (one website per workspace)');

  console.log('🎉 Database migration complete!');
}

run().catch((err) => {
  console.error('Migration error:', err);
  process.exit(1);
});
