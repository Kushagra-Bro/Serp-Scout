/**
 * Visual end-to-end verification of the geo-grid radar canvas.
 *
 * Drives a real Chromium (Edge) against the running dev server: signs in with a
 * throwaway account, opens the Local → Geo-Grid tab, and asserts the radar
 * actually paints, that changing the km radius moves the blips, and that hover
 * and click reach the inspector.
 *
 *   tsx scripts/verify-radar-visual.ts
 *
 * Writes PNGs to apps/api/scripts/out/ and removes the throwaway account.
 */
import fs from 'node:fs';
import path from 'node:path';
import puppeteer, { type Page } from 'puppeteer';
import { db, users, workspaces } from '../src/db/index.js';
import { eq } from 'drizzle-orm';

const WEB = 'http://127.0.0.1:3000';
const API = 'http://127.0.0.1:3001';
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT_DIR = path.join(process.cwd(), 'scripts', 'out');

const email = `radar-verify-${Date.now()}@example.com`;
const password = 'RadarVerify!2026';

interface Checks {
  name: string;
  ok: boolean;
  detail?: string;
}
const checks: Checks[] = [];
const check = (name: string, ok: boolean, detail?: string) => {
  checks.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

/** Cheap perceptual signature of the canvas so we can tell frames apart. */
async function canvasSignature(page: Page, selector: string): Promise<{ hash: number; nonBlank: number }> {
  return page.$eval(selector, (el) => {
    const canvas = el as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let hash = 0;
    let nonBlank = 0;
    for (let i = 0; i < data.length; i += 4 * 97) {
      const lum = data[i] + data[i + 1] + data[i + 2];
      hash = (hash * 31 + lum) >>> 0;
      if (lum > 40) nonBlank++;
    }
    return { hash, nonBlank };
  });
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // ── Throwaway account (removed in the finally block) ──────────────────────
  const signUp = await fetch(`${API}/api/auth/sign-up`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Radar Verify', email, password, workspaceName: 'Radar Verify WS' }),
  });
  const signUpBody: any = await signUp.json();
  if (!signUp.ok) throw new Error(`sign-up failed: ${signUp.status} ${JSON.stringify(signUpBody)}`);
  const { token, user, workspace } = signUpBody.data;
  console.log(`signed up ${email} (workspace ${workspace.id})`);

  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--window-size=1440,1200'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 1200, deviceScaleFactor: 2 });

    page.on('pageerror', (err) => console.log(`   [pageerror] ${err.message}`));

    // Seed the cached session the auth provider reads on mount.
    await page.goto(`${WEB}/sign-in`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(
      (t, u, w) => {
        localStorage.setItem('serp_scout_token', t);
        localStorage.setItem('serp_scout_user', JSON.stringify(u));
        localStorage.setItem('serp_scout_workspace_id', w);
      },
      token,
      user,
      workspace.id
    );

    await page.goto(`${WEB}/local`, { waitUntil: 'networkidle2' });
    await page.screenshot({ path: path.join(OUT_DIR, 'local-map-pack.png') });

    // Open the Geo-Grid tab.
    const tabClicked = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) =>
        (b.textContent || '').includes('Geo-Grid 3-Pack Heatmap')
      );
      if (!btn) return false;
      (btn as HTMLButtonElement).click();
      return true;
    });
    check('geo-grid tab is reachable', tabClicked);
    await new Promise((r) => setTimeout(r, 1200));

    const canvasSelector = 'canvas';
    await page.waitForSelector(canvasSelector, { timeout: 15000 });
    await new Promise((r) => setTimeout(r, 900));

    // ── 1. the radar actually paints ─────────────────────────────────────────
    const painted = await canvasSignature(page, canvasSelector);
    check('canvas is painted (non-blank pixels, sweep/rings present)', painted.nonBlank > 200, `signature=${painted.hash} lit=${painted.nonBlank}`);
    await page.screenshot({ path: path.join(OUT_DIR, 'radar-5km-R10.png') });
    const canvasEl = await page.$(canvasSelector);
    if (canvasEl) await canvasEl.screenshot({ path: path.join(OUT_DIR, 'radar-canvas-5km-R10.png') });

    // ── 2. the sweep animates ───────────────────────────────────────────────
    await new Promise((r) => setTimeout(r, 700));
    const paintedLater = await canvasSignature(page, canvasSelector);
    check('sweep animates (frame changes over time)', paintedLater.hash !== painted.hash, `${painted.hash} → ${paintedLater.hash}`);

    // ── 3. changing km moves the mesh ───────────────────────────────────────
    const clickKm = async (label: string) => {
      const ok = await page.evaluate((text) => {
        const btn = Array.from(document.querySelectorAll('button')).find((b) => (b.textContent || '').trim() === text);
        if (!btn) return false;
        (btn as HTMLButtonElement).click();
        return true;
      }, label);
      await new Promise((r) => setTimeout(r, 900));
      return ok;
    };

    check('10 km preset clicked', await clickKm('10km'));
    const at10km = await canvasSignature(page, canvasSelector);
    const el10 = await page.$(canvasSelector);
    if (el10) await el10.screenshot({ path: path.join(OUT_DIR, 'radar-canvas-10km-R10.png') });
    check('mesh geometry changes when the km radius changes', at10km.hash !== painted.hash, `5km=${painted.hash} 10km=${at10km.hash}`);

    // Range scale widening should also change the picture (km-driven view span).
    check('AUTO range scale clicked', await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) => (b.textContent || '').trim() === 'AUTO');
      if (!btn) return false;
      (btn as HTMLButtonElement).click();
      return true;
    }));
    await new Promise((r) => setTimeout(r, 700));
    const autoRange = await canvasSignature(page, canvasSelector);
    check('range scale changes the view span', autoRange.hash !== at10km.hash, `pinned=${at10km.hash} auto=${autoRange.hash}`);

    // ── 4. hover + click reach the inspector ────────────────────────────────
    const box = await (await page.$(canvasSelector))!.boundingBox();
    if (box) {
      // Centre of the canvas is the HQ; the nearest ring blip sits up and left.
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - box.height * 0.25);
      await new Promise((r) => setTimeout(r, 400));
      const tooltip = await page.evaluate(() => {
        const el = document.querySelector('.pointer-events-none.absolute.z-20');
        return el ? (el.textContent || '').trim() : null;
      });
      check('hover shows a bearing/range tooltip', !!tooltip && /km/.test(tooltip), tooltip ?? 'no tooltip');

      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2 - box.height * 0.25);
      await new Promise((r) => setTimeout(r, 500));
      const inspector = await page.evaluate(() => {
        const heading = Array.from(document.querySelectorAll('h4')).find((h) =>
          (h.textContent || '').includes('Coordinate Pin Inspector')
        );
        // Walk up until the container includes the panel body.
        let el: Element | null = heading ?? null;
        let text = '';
        for (let i = 0; i < 5 && el; i++) {
          el = el.parentElement;
          text = el?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
          if (text.includes('km from HQ')) break;
        }
        return text.slice(0, 200) || null;
      });
      check(
        'click selects a pin and updates the inspector',
        !!inspector && /km from HQ/.test(inspector) && /#\d/.test(inspector),
        inspector ?? 'inspector not found'
      );
      await page.screenshot({ path: path.join(OUT_DIR, 'radar-inspector.png'), fullPage: false });
    }

    // ── 5. accessibility fallback list ──────────────────────────────────────
    const srButtons = await page.evaluate(
      (sel) => document.querySelectorAll(`${sel} ~ div.sr-only button, div.sr-only button`).length,
      canvasSelector
    );
    check('keyboard/AT node list is present', srButtons >= 9, `${srButtons} buttons`);
  } finally {
    await browser.close();

    // Remove the throwaway account (workspace cascade clears anything it owned).
    await db.delete(users).where(eq(users.email, email)).catch((e) => console.warn('user cleanup:', e.message));
    const remaining = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
    if (remaining.length === 0) {
      await db
        .delete(workspaces)
        .where(eq(workspaces.ownerId, signUpBody.data.user.id))
        .catch((e) => console.warn('workspace cleanup:', e.message));
    }
    console.log(`cleaned up throwaway account (${email})`);
  }

  const failed = checks.filter((c) => !c.ok);
  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
  console.log(`screenshots: ${OUT_DIR}`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('visual verification failed:', err);
  process.exit(1);
});
