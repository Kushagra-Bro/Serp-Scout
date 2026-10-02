// End-to-end test of duplicate handling over real HTTP against the running API.
// Proves: sequential duplicate -> 409, concurrent race -> 409 (not 500),
// and PATCH retarget -> 409. Cleans up after itself.
import { Client } from '@neondatabase/serverless';
import { DATABASE_URL } from './test-env.mjs';

const API = process.env.API_URL || 'http://localhost:3001';
const { signUserToken } = await import(
  'file:///C:/Apps/Contributions/Serp-Scout/apps/api/dist/lib/auth.js'
);

const raw = new Client(DATABASE_URL);
await raw.connect();

let pass = 0, fail = 0;
const check = (label, ok, detail = '') => {
  if (ok) { pass++; console.log(`PASS  ${label}`); }
  else { fail++; console.log(`FAIL  ${label} ${detail}`); }
};

// Isolated probe workspace + user so no real tenant is touched.
const ws = await raw.query(
  `insert into workspaces (name, owner_id) values ('http-409-probe', 'http-409-owner') returning id`
);
const wsId = ws.rows[0].id;
await raw.query(
  `insert into users (id, workspace_id, name, email, role)
   values ('http-409-user', $1, 'HTTP Probe', 'http409@probe.local', 'owner')
   on conflict (id) do update set workspace_id = excluded.workspace_id`,
  [wsId]
);

const token = await signUserToken({ userId: 'http-409-user', email: 'http409@probe.local', name: 'HTTP Probe' });
const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${token}`,
  'x-workspace-id': wsId,
};

const post = (body) =>
  fetch(`${API}/api/businesses`, { method: 'POST', headers, body: JSON.stringify(body) })
    .then(async (r) => ({ status: r.status, json: await r.json().catch(() => null) }))
    .catch((e) => ({ status: 0, json: { error: { message: e.message } } }));

const patch = (id, body) =>
  fetch(`${API}/api/businesses/${id}`, { method: 'PATCH', headers, body: JSON.stringify(body) })
    .then(async (r) => ({ status: r.status, json: await r.json().catch(() => null) }))
    .catch((e) => ({ status: 0, json: { error: { message: e.message } } }));

console.log(`API: ${API}  workspace: ${wsId}\n`);

// 1. First create succeeds.
const first = await post({ name: 'HTTP Probe A', websiteUrl: 'https://www.HttpProbe409.example.com/' });
check('first POST -> 201', first.status === 201, `got ${first.status} ${JSON.stringify(first.json?.error)}`);

// 2. Sequential duplicate in a different string shape -> 409 from the app guard.
const dup = await post({ name: 'HTTP Probe Dup', websiteUrl: 'http://httpprobe409.example.com' });
check('sequential duplicate -> 409', dup.status === 409, `got ${dup.status}`);
check('code is DUPLICATE_WEBSITE', dup.json?.error?.code === 'DUPLICATE_WEBSITE',
  `got ${JSON.stringify(dup.json?.error?.code)}`);
check('409 names the existing business',
  String(dup.json?.data?.existingBusinessName || '').includes('HTTP Probe A'),
  `got ${JSON.stringify(dup.json?.data)}`);

// 3. THE RACE: two concurrent POSTs, different shapes, same site. The app-level
//    SELECT cannot guard this -- only the unique index can. One must be 201,
//    the loser must be 409 (never 500).
const raceUrl = 'https://www.RaceProbe409.example.com/';
const raceShape = 'http://raceprobe409.example.com';
const [r1, r2] = await Promise.all([
  post({ name: 'Race One', websiteUrl: raceUrl }),
  post({ name: 'Race Two', websiteUrl: raceShape }),
]);
const statuses = [r1.status, r2.status].sort((a, b) => a - b);
const oneOk = statuses.filter((s) => s === 201).length;
const one409 = statuses.filter((s) => s === 409).length;
check('race: exactly one wins with 201', oneOk === 1, `got ${JSON.stringify(statuses)}`);
check('race: loser gets 409 (not 500)', one409 === 1, `got ${JSON.stringify(statuses)} r1=${JSON.stringify(r1.json?.error)} r2=${JSON.stringify(r2.json?.error)}`);

// 4. Confirm only ONE row actually landed for the raced URL.
const raced = await raw.query(
  `select count(*)::int n from businesses where workspace_id = $1 and normalized_url = 'raceprobe409.example.com'`,
  [wsId]
);
check('race: exactly 1 row persisted', raced.rows[0].n === 1, `got ${raced.rows[0].n}`);

// 5. PATCH retargeting onto an existing sibling -> 409.
const other = await post({ name: 'HTTP Probe B', websiteUrl: 'https://other-http409.example.com' });
check('second distinct site -> 201', other.status === 201, `got ${other.status}`);
const winnerId = (r1.status === 201 ? r1.json : r2.json)?.data?.id;
if (winnerId && other.json?.data?.id) {
  const retarget = await patch(other.json.data.id, { websiteUrl: raceShape });
  check('PATCH onto existing sibling -> 409', retarget.status === 409, `got ${retarget.status} ${JSON.stringify(retarget.json?.error)}`);
  const missing = await patch('00000000-0000-0000-0000-000000000000', { websiteUrl: raceShape });
  check('PATCH unknown id -> 404 (not 409)', missing.status === 404, `got ${missing.status}`);
} else {
  check('PATCH onto existing sibling -> 409', false, 'missing ids from earlier steps');
}

// Cleanup.
await raw.query(`delete from workspaces where id = $1`, [wsId]);
const left = await raw.query(`select count(*)::int n from workspaces where name = 'http-409-probe'`);
console.log(`\nprobe workspaces remaining: ${left.rows[0].n}`);

await raw.end();
console.log(`${fail === 0 ? 'ALL PASS' : 'FAILURES'}: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
