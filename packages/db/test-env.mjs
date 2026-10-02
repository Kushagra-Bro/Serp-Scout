// Shared env loader for the packages/db test scripts.
//
// These tests may be run from the repo root (`node packages/db/test-x.mjs`)
// or via `pnpm --filter @serp-scout/db ...`, where cwd is packages/db. Try
// both plausible locations so DATABASE_URL resolves either way.
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { existsSync } from 'fs';

const candidates = [
  resolve(process.cwd(), 'apps/api/.env'), // repo root
  resolve(process.cwd(), '../../apps/api/.env'), // packages/db
];

const found = candidates.find((p) => existsSync(p));
if (found) dotenv.config({ path: found });
else dotenv.config(); // fall back to process env / .env in cwd

export const DATABASE_URL = process.env.DATABASE_URL;
export { resolve };
