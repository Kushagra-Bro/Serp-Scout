/**
 * End-to-end verification of the detailed report: seeds a throwaway workspace
 * with known ranking history, generates a report through the API, and checks the
 * API payload, the PDF content and the rendered frontend.
 *
 *   tsx scripts/verify-report-e2e.ts
 *
 * The throwaway workspace (and everything cascading from it) is deleted at the
 * end, so the verification never touches real customer data.
 */
import fs from 'node:fs';
import path from 'node:path';
import puppeteer, { type Page } from 'puppeteer';
import { eq } from 'drizzle-orm';
import {
  db,
  businesses,
  competitors,
  contentGaps,
  keywords,
  rankingObservations,
  searchRuns,
  users,
  workspaces,
} from '../src/db/index.js';

const WEB = 'http://localhost:3000';
const API = 'http://127.0.0.1:3001';
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT_DIR = path.join(process.cwd(), 'scripts', 'out');

const email = `report-e2e-${Date.now()}@example.com`;
const password = 'ReportE2E!2026';

const checks: Array<{ name: string; ok: boolean; detail?: string }> = [];
const check = (name: string, ok: boolean, detail?: string) => {
  checks.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` â€” ${detail}` : ''}`);
};

/** Seeded expectations: keyword â†’ [prev, current] for the business's own domain. */
const EXPECTED: Record<string, { previous: number | null; current: number | null; shift: number | null; status: string }> = {
  'emergency dentist near aditya mall': { previous: 12, current: 6, shift: 6, status: 'climbed' },
  'invisalign aligners indirapuram': { previous: 4, current: 9, shift: -5, status: 'declined' },
  'kids dentist indirapuram': { previous: 7, current: 7, shift: 0, status: 'unchanged' },
  'dental implants cost indirapuram': { previous: null, current: 3, shift: null, status: 'new' },
  'wisdom teeth extraction indirapuram': { previous: 15, current: null, shift: null, status: 'dropped-out' },
  'root canal treatment near me': { previous: null, current: null, shift: null, status: 'not-ranking' },
};

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // â”€â”€ Throwaway account â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const signUpRes = await fetch(`${API}/api/auth/sign-up`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Report E2E', email, password, workspaceName: 'Report E2E WS' }),
  });
  const signUpBody: any = await signUpRes.json();
  if (!signUpRes.ok) throw new Error(`sign-up failed: ${signUpRes.status} ${JSON.stringify(signUpBody)}`);
  const { token, user, workspace } = signUpBody.data;
  console.log(`throwaway workspace ${workspace.id}`);

  let businessId = '';
  let reportId = '';
  let shareToken = '';

  try {
    // â”€â”€ Seed a business directly (bypasses the onboarding research enqueue so
    //    the verification never spends the paid search quota). â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const [biz] = await db
      .insert(businesses)
      .values({
        workspaceId: workspace.id,
        name: 'E2E Dental Studio',
        websiteUrl: 'https://e2e-dental-verify.example.com/',
        city: 'Indirapuram',
        country: 'India',
        industry: 'Dental & Healthcare',
      })
      .returning();
    businessId = biz.id;

    const [run1] = await db
      .insert(searchRuns)
      .values({
        businessId,
        provider: 'tavily',
        searchType: 'google',
        query: 'baseline sweep',
        status: 'completed',
        costUnits: 0,
        requestedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
      })
      .returning();
    const [run2] = await db
      .insert(searchRuns)
      .values({
        businessId,
        provider: 'tavily',
        searchType: 'google',
        query: 'latest sweep',
        status: 'completed',
        costUnits: 0,
        requestedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      })
      .returning();

    const obsRows: Array<typeof rankingObservations.$inferInsert> = [];
    const now = Date.now();

    for (const [phrase, expected] of Object.entries(EXPECTED)) {
      const [kw] = await db
        .insert(keywords)
        .values({
          businessId,
          phrase,
          location: 'Indirapuram',
          intent: 'commercial',
          status: 'tracking',
          opportunityScore: 70,
        })
        .returning();

      // Each keyword gets its own run rows so the sweep timeline matches the
      // phrase (getRankingsForBusiness compares own observations with sweeps).
      const [kwRun1] = await db
        .insert(searchRuns)
        .values({
          businessId,
          provider: 'tavily',
          searchType: 'google',
          query: phrase,
          status: 'completed',
          costUnits: 0,
          requestedAt: new Date(now - 6 * 24 * 60 * 60 * 1000),
        })
        .returning();
      const [kwRun2] = await db
        .insert(searchRuns)
        .values({
          businessId,
          provider: 'tavily',
          searchType: 'google',
          query: phrase,
          status: 'completed',
          costUnits: 0,
          requestedAt: new Date(now - 1 * 24 * 60 * 60 * 1000),
        })
        .returning();

      // Competitor is always present in both sweeps (so the table has rivals).
      obsRows.push(
        {
          businessId,
          keywordId: kw.id,
          searchRunId: kwRun1.id,
          domain: 'justdial.com',
          url: 'https://justdial.com/1',
          rank: 2,
          resultType: 'organic',
          observedAt: new Date(now - 6 * 24 * 60 * 60 * 1000 + 5000),
        },
        {
          businessId,
          keywordId: kw.id,
          searchRunId: kwRun2.id,
          domain: 'justdial.com',
          url: 'https://justdial.com/2',
          rank: 1,
          resultType: 'organic',
          observedAt: new Date(now - 1 * 24 * 60 * 60 * 1000 + 5000),
        }
      );

      // Own-domain positions per the seeded expectation.
      if (expected.previous !== null) {
        obsRows.push({
          businessId,
          keywordId: kw.id,
          searchRunId: kwRun1.id,
          domain: 'e2e-dental-verify.example.com',
          url: 'https://e2e-dental-verify.example.com/',
          rank: expected.previous,
          resultType: 'organic',
          observedAt: new Date(now - 6 * 24 * 60 * 60 * 1000 + 4000),
        });
      }
      if (expected.current !== null) {
        obsRows.push({
          businessId,
          keywordId: kw.id,
          searchRunId: kwRun2.id,
          domain: 'e2e-dental-verify.example.com',
          url: 'https://e2e-dental-verify.example.com/',
          rank: expected.current,
          resultType: 'organic',
          observedAt: new Date(now - 1 * 24 * 60 * 60 * 1000 + 4000),
        });
      }
    }

    await db.insert(rankingObservations).values(obsRows);

    await db.insert(competitors).values([
      {
        businessId,
        name: 'Justdial Listing',
        domain: 'justdial.com',
        websiteUrl: 'https://justdial.com',
        competitorType: 'directory',
        confidenceScore: 15,
        status: 'candidate',
        metadata: { threatLevel: 'moderate', threatReason: 'Aggregator dominating local results.' },
      },
      {
        businessId,
        name: 'Rival Dental Clinic',
        domain: 'rival-dental.example.com',
        websiteUrl: 'https://rival-dental.example.com',
        competitorType: 'direct',
        confidenceScore: 88,
        status: 'confirmed',
        category: 'Dental Clinic',
        metadata: {
          threatLevel: 'severe',
          threatReason: 'Hyper-local rival with 400+ reviews outranking you on core phrases.',
          rating: 4.8,
          reviewCount: 412,
          distanceMiles: 1.2,
          proximityLabel: 'Hyper-Local (< 3 mi)',
          serpOverlapPercent: 74,
          hasAds: true,
        },
      },
      {
        businessId,
        name: 'Metro Smiles',
        domain: 'metro-smiles.example.com',
        websiteUrl: 'https://metro-smiles.example.com',
        competitorType: 'search',
        confidenceScore: 61,
        status: 'candidate',
        metadata: { threatLevel: 'emerging', threatReason: 'Building visibility on page 1-2.', rating: 4.4, reviewCount: 96 },
      },
    ]);

    await db.insert(contentGaps).values([
      {
        businessId,
        topic: 'Emergency root canal same-day guide',
        recommendedPageType: 'service',
        suggestedTitle: 'Same-Day Emergency Root Canal in Indirapuram',
        suggestedHeadings: ['When you need one', 'Cost', 'Aftercare'],
        suggestedFaqs: ['Is it painful?', 'How much does it cost?'],
        targetIntent: 'transactional',
        priority: 'P0',
        effort: 'medium',
        impact: 'high',
        evidence: { competitorDomain: 'rival-dental.example.com', evidenceUrls: ['https://rival-dental.example.com/emergency'] },
      },
      {
        businessId,
        topic: 'Invisalign pricing comparison',
        recommendedPageType: 'comparison',
        suggestedTitle: 'Invisalign vs Braces: Cost in Indirapuram',
        suggestedHeadings: ['Cost table', 'Treatment time'],
        suggestedFaqs: ['Which is cheaper?'],
        targetIntent: 'comparison',
        priority: 'P1',
        effort: 'low',
        impact: 'medium',
        evidence: { competitorDomain: 'metro-smiles.example.com', evidenceUrls: [] },
      },
    ]);

    // â”€â”€ Generate the report through the real API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const genRes = await fetch(`${API}/api/businesses/${businessId}/reports/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({}),
    });
    const genBody: any = await genRes.json();
    if (!genRes.ok) throw new Error(`generate failed: ${genRes.status} ${JSON.stringify(genBody)}`);
    reportId = genBody.data.report.id;
    console.log(`generated report ${reportId}`);

    // â”€â”€ API payload assertions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const detailRes = await fetch(`${API}/api/reports/${reportId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const detailBody: any = await detailRes.json();
    const detailed = detailBody.data.report.summary.detailed;
    check('report payload carries detailed sections', !!detailed);

    const allRows = detailed
      ? [
          ...detailed.rankingShifts.movers,
          ...detailed.rankingShifts.unchanged,
          ...detailed.rankingShifts.newEntries,
          ...detailed.rankingShifts.droppedOut,
          ...detailed.rankingShifts.notRanking,
        ]
      : [];
    check('every seeded keyword appears in the shift table', allRows.length === Object.keys(EXPECTED).length, `${allRows.length} rows`);

    let mismatches = 0;
    for (const [phrase, expected] of Object.entries(EXPECTED)) {
      const row = allRows.find((r: any) => r.keyword === phrase);
      const ok =
        row &&
        row.previousRank === expected.previous &&
        row.currentRank === expected.current &&
        row.shift === expected.shift &&
        row.status === expected.status;
      if (!ok) {
        mismatches++;
        console.log(
          `   MISMATCH "${phrase}": got prev=${row?.previousRank} current=${row?.currentRank} shift=${row?.shift} status=${row?.status}; expected prev=${expected.previous} current=${expected.current} shift=${expected.shift} status=${expected.status}`
        );
      }
    }
    check('seeded rank/shift/status all match', mismatches === 0, `${mismatches} mismatch(es)`);
    check(
      'KPI dashboard reflects the seeded history',
      detailed?.kpis.improved === 1 &&
        detailed?.kpis.declined === 1 &&
        detailed?.kpis.unchanged === 1 &&
        detailed?.kpis.newEntries === 1 &&
        detailed?.kpis.droppedOut === 1 &&
        detailed?.kpis.notRankedKeywords === 1,
      `improved=${detailed?.kpis.improved} declined=${detailed?.kpis.declined} unchanged=${detailed?.kpis.unchanged} new=${detailed?.kpis.newEntries} dropped=${detailed?.kpis.droppedOut} notRanking=${detailed?.kpis.notRankedKeywords}`
    );
    check('competitor landscape is included', (detailed?.competitors ?? []).length === 3, `${detailed?.competitors?.length} competitors`);
    check('content gaps are included', (detailed?.contentGaps ?? []).length === 2);

    // â”€â”€ PDF assertions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const pdfRes = await fetch(`${API}/api/reports/${reportId}/pdf`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());
    const pdfPath = path.join(OUT_DIR, 'e2e-detailed-report.pdf');
    fs.writeFileSync(pdfPath, pdfBuffer);
    check('PDF renders', pdfRes.ok && pdfBuffer.length > 20000, `${Math.round(pdfBuffer.length / 1024)} KB`);

    // â”€â”€ Shared link â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const shareRes = await fetch(`${API}/api/reports/${reportId}/share`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ viewMode: 'specialist' }),
    });
    const shareBody: any = await shareRes.json();
    shareToken = shareBody.data.share.shareToken;
    const sharedRes = await fetch(`${API}/api/shared/${shareToken}`);
    const sharedBody: any = await sharedRes.json();
    check(
      'shared report payload carries detailed sections',
      !!sharedBody.data?.report?.summary?.detailed,
      sharedBody.data?.report?.summary?.detailed ? 'present' : 'missing'
    );

    // â”€â”€ Frontend rendering â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const listRes = await fetch(`${API}/api/businesses/${businessId}/reports`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const listBody: any = await listRes.json();
    check('report is listed by the API', (listBody.data ?? []).length > 0, `${(listBody.data ?? []).length} report(s)`);

    const browser = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ['--no-sandbox', '--disable-gpu'] });
    try {
      const page: Page = await browser.newPage();
      await page.setViewport({ width: 1500, height: 1100, deviceScaleFactor: 2 });
      page.on('response', (res) => {
        const url = res.url();
        if (url.includes('/api/')) console.log(`   [api] ${res.status()} ${url.replace(API, '')}`);
      });
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

      const openReports = async () => {
        await page.goto(`${WEB}/reports`, { waitUntil: 'networkidle2' });
        // The page auto-opens the newest report once the archive loads; a restart
        // window can leave it empty, so allow one reload.
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            await page.waitForFunction(
              () => {
                const text = document.body.innerText;
                return text.includes('Search Visibility & Ranking Shifts') || text.includes('No reports generated yet');
              },
              { timeout: 20000 }
            );
          } catch {
            /* fall through to the reload below */
          }
          const state = await page.evaluate(() => document.body.innerText);
          if (state.includes('Search Visibility & Ranking Shifts')) return true;
          if (attempt === 0) {
            console.log('   retrying page load (archive was empty on first attempt)');
            await page.reload({ waitUntil: 'networkidle2' });
          }
        }
        return false;
      };

      await openReports();
      await new Promise((r) => setTimeout(r, 1500));

      const bodyText = await page.evaluate(() => document.body.innerText);
      check('frontend shows the ranking-shift section', /Search Visibility & Ranking Shifts/i.test(bodyText));
      check(
        'frontend renders seeded shift values',
        bodyText.includes('emergency dentist near aditya mall') && /\+6/.test(bodyText),
        bodyText.includes('emergency dentist near aditya mall') ? 'keyword row present' : 'keyword row missing'
      );
      check('frontend no longer shows an empty table message', !/No recent keyword ranking shifts recorded/i.test(bodyText));
      check('frontend shows the competitor landscape', /Rival Dental Clinic/.test(bodyText));

      // Sparkline inventory in the rendered shifts table.
      const trendPoints = await page.evaluate(() => document.querySelectorAll('svg circle').length);
      const trendLines = await page.evaluate(() => document.querySelectorAll('svg path').length);
      check(
        'frontend renders rank-trend sparklines',
        trendPoints >= 5 && trendLines >= 2,
        `${trendPoints} points, ${trendLines} path(s)`
      );

      await page.screenshot({ path: path.join(OUT_DIR, 'e2e-reports-page.png'), fullPage: false });

      const sharedPage = await browser.newPage();
      await sharedPage.setViewport({ width: 1500, height: 1100, deviceScaleFactor: 2 });
      await sharedPage.goto(`${WEB}/shared/${shareToken}`, { waitUntil: 'networkidle2' });
      await sharedPage.waitForFunction(() => document.body.innerText.includes('Search Visibility') || document.body.innerText.includes('Shared'), { timeout: 20000 }).catch(() => {});
      await new Promise((r) => setTimeout(r, 1500));
      const sharedText = await sharedPage.evaluate(() => document.body.innerText);
      check('shared (client-facing) page shows the shift table', /Search Visibility & Ranking Shifts/i.test(sharedText));
      await sharedPage.screenshot({ path: path.join(OUT_DIR, 'e2e-shared-report.png'), fullPage: false });
    } finally {
      await browser.close();
    }
  } finally {
    // â”€â”€ Cleanup: removing the workspace cascades to the business and its data â”€
    await db.delete(workspaces).where(eq(workspaces.ownerId, user.id)).catch((e: any) => console.warn('workspace cleanup:', e.message));
    await db.delete(users).where(eq(users.email, email)).catch((e: any) => console.warn('user cleanup:', e.message));
    const leftovers = await db.select({ id: businesses.id }).from(businesses).where(eq(businesses.workspaceId, workspace.id));
    console.log(`cleanup: throwaway workspace removed, ${leftovers.length} business row(s) left`);
  }

  const failed = checks.filter((c) => !c.ok);
  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('e2e verification failed:', err);
  process.exit(1);
});

