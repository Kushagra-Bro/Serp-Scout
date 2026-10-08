/**
 * Generates a real detailed report PDF from live data and verifies it.
 *
 *   tsx scripts/verify-report-pdf.ts ["Business Name"]
 *
 * Writes the PDF plus a first-page screenshot to apps/api/scripts/out/ and
 * asserts the ranking-shift table actually carries own-domain positions.
 */
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer';
import { db, businesses } from '../src/db/index.js';
import { buildDetailedReport } from '../src/services/report-bundle.service.js';
import { generateReportHtml, generateReportCsv } from '../src/services/pdf.service.js';
import type { GeneratedReport } from '@serp-scout/types';

const OUT_DIR = path.join(process.cwd(), 'scripts', 'out');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const checks: Array<{ name: string; ok: boolean; detail?: string }> = [];
const check = (name: string, ok: boolean, detail?: string) => {
  checks.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const requested = process.argv[2];
  const all = await db.select().from(businesses);
  const business = requested ? all.find((b) => b.name.includes(requested)) ?? all[0] : all[0];
  console.log(`business: ${business.name} (${business.id})`);

  const periodEnd = new Date();
  const periodStart = new Date(periodEnd.getTime() - 7 * 24 * 60 * 60 * 1000);

  const detailed = await buildDetailedReport({
    businessId: business.id,
    periodStart,
    periodEnd,
  });

  console.log('\n=== KPIs ===');
  console.log(JSON.stringify(detailed.kpis, null, 2));
  console.log('\n=== ranking shift summary ===');
  console.log(JSON.stringify(detailed.rankingShifts.summary, null, 2));

  check(
    'ranking table has rows',
    detailed.rankingShifts.movers.length + detailed.rankingShifts.unchanged.length > 0,
    `${detailed.rankingShifts.movers.length} movers, ${detailed.rankingShifts.unchanged.length} steady, ${detailed.rankingShifts.notRanking.length} not ranking`
  );

  const ranked = [
    ...detailed.rankingShifts.movers,
    ...detailed.rankingShifts.unchanged,
    ...detailed.rankingShifts.newEntries,
  ].filter((r) => r.currentRank !== null);
  check('rows carry real own-domain positions', ranked.length > 0, `${ranked.length} with a current rank`);

  // Shift rows must correspond to the ranking service's own view of the data.
  const sample = ranked.slice(0, 3);
  for (const row of sample) {
    console.log(
      `   "${row.keyword.slice(0, 52)}" prev=${row.previousRank ?? '—'} current=#${row.currentRank} shift=${row.shift ?? '—'} status=${row.status} rival=${row.bestCompetitorRank ?? '—'}`
    );
  }

  // No row should claim a shift without two comparable checks.
  const bogus = [...detailed.rankingShifts.movers].filter((r) => r.shift !== null && (r.previousRank === null || r.currentRank === null));
  check('no shift is reported without both ranks', bogus.length === 0, `${bogus.length} inconsistent row(s)`);

  // ── Render + measure ─────────────────────────────────────────────────────
  const report: GeneratedReport = {
    executiveSummary: {
      importantChanges: `Ranking sweep across ${detailed.rankingShifts.summary.totalTracked} tracked phrases: ${detailed.rankingShifts.summary.climbed} climbed, ${detailed.rankingShifts.summary.declined} declined, ${detailed.rankingShifts.summary.notRanked} not ranking.`,
      mainOpportunity: detailed.contentGaps[0]
        ? `Publish a dedicated "${detailed.contentGaps[0].topic}" page to capture proven demand.`
        : 'Expand high-intent service coverage to capture local demand.',
      mainCompetitiveThreat: detailed.competitors[0]
        ? `${detailed.competitors[0].name} (${detailed.competitors[0].domain}) leads the tracked market with a ${detailed.competitors[0].confidenceScore}% match.`
        : 'No confirming competitor data yet.',
      weeklyFocus: detailed.actions[0]?.title || 'Execute the highest-return-on-effort action.',
    },
    visibilityChanges: {
      keywordChanges: detailed.rankingShifts.movers.slice(0, 10).map((r) => ({
        keyword: r.keyword,
        oldRank: r.previousRank ?? undefined,
        newRank: r.currentRank ?? undefined,
      })),
      mapsChanges: [],
      serpFeatureChanges: [],
    },
    competitorChanges: detailed.competitors.slice(0, 5).map((c) => `${c.name} (${c.domain}) · ${c.threatLevel ?? 'unrated'}`),
    contentOpportunities: detailed.contentGaps,
    actionPlan: detailed.actions,
    evidenceAppendix: detailed.evidence,
    detailed,
  };

  const html = generateReportHtml({
    businessName: business.name,
    websiteUrl: business.websiteUrl,
    periodStart: periodStart.toISOString().slice(0, 10),
    periodEnd: periodEnd.toISOString().slice(0, 10),
    report,
  });

  const htmlPath = path.join(OUT_DIR, 'report-preview.html');
  fs.writeFileSync(htmlPath, html, 'utf8');

  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu'],
  });

  try {
    const page = await browser.newPage();
    // A4 content box at 96dpi: 210mm - 24mm margins wide, 297mm - 28mm high.
    await page.setViewport({ width: 703, height: 1017, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await page.emulateMediaType('print');

    const metrics = await page.evaluate(() => {
      const pageHeightPx = 1017;
      return {
        scrollHeight: document.documentElement.scrollHeight,
        sections: document.querySelectorAll('section.page').length,
        tables: document.querySelectorAll('table').length,
        shiftRows: document.querySelectorAll('table tbody tr').length,
        estimatedPages: Math.ceil(document.documentElement.scrollHeight / pageHeightPx),
      };
    });
    console.log('\n=== document metrics ===');
    console.log(JSON.stringify(metrics, null, 2));

    check('document is at least 9 pages tall', metrics.estimatedPages >= 9, `≈${metrics.estimatedPages} pages, ${metrics.sections} sections`);
    check('the shift table rendered rows', metrics.shiftRows > 5, `${metrics.shiftRows} table rows total`);

    // Sparkline inventory straight from the generated HTML.
    const svgCount = (html.match(/<svg/g) ?? []).length;
    const dashedBridges = (html.match(/stroke-dasharray/g) ?? []).length;
    const captions = (html.match(/spark-caption/g) ?? []).length;
    const chartPoints = await page.evaluate(() => document.querySelectorAll('svg circle').length);
    const tableRowsWithTrend = detailed.rankingShifts.movers.length + detailed.rankingShifts.unchanged.length;
    check('rank-trend sparklines rendered', svgCount >= 5, `${svgCount} sparkline(s), ${chartPoints} plotted point(s)`);
    check('gap sweeps drawn as dashed bridges', dashedBridges > 0, `${dashedBridges} dashed segment(s)`);
    check(
      'sparkline legend explains the gap encoding',
      /<strong>dashed<\/strong> segment crosses a sweep/.test(html)
    );
    check(
      'movers and steady rows carry a trend cell',
      captions >= tableRowsWithTrend,
      `${captions} captions for ${tableRowsWithTrend} rows`
    );
    check(
      'CSV export includes the trend column',
      generateReportCsv({
        businessName: business.name,
        websiteUrl: business.websiteUrl,
        periodStart: periodStart.toISOString().slice(0, 10),
        periodEnd: periodEnd.toISOString().slice(0, 10),
        report,
      }).includes('Rank trend')
    );

    const bodyText = await page.evaluate(() => document.body.innerText);
    const emptyTableMessage = /No recent keyword ranking shifts recorded/i.test(bodyText);
    check('the empty-table message is gone', !emptyTableMessage);
    check(
      'page states the ranking methodology',
      /previous rank is the same measure from the preceding check/i.test(bodyText)
    );

    await page.screenshot({
      path: path.join(OUT_DIR, 'report-page1.png'),
      clip: { x: 0, y: 0, width: 703, height: 1017 },
    });

    await page.pdf({
      path: path.join(OUT_DIR, 'serp-scout-detailed-report.pdf'),
      format: 'A4',
      printBackground: true,
      margin: { top: '14mm', bottom: '14mm', left: '12mm', right: '12mm' },
    });
  } finally {
    await browser.close();
  }

  const pdfPath = path.join(OUT_DIR, 'serp-scout-detailed-report.pdf');
  const sizeKb = Math.round(fs.statSync(pdfPath).size / 1024);
  console.log(`\nPDF: ${pdfPath} (${sizeKb} KB)`);
  console.log(`HTML preview: ${htmlPath}`);

  const failed = checks.filter((c) => !c.ok);
  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('verification failed:', err);
  process.exit(1);
});
