/**
 * Renders individual report sections to PNG so the layout can be eyeballed.
 *
 *   tsx scripts/render-report-sections.ts ["Business Name"]
 */
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer';
import { db, businesses } from '../src/db/index.js';
import { buildDetailedReport } from '../src/services/report-bundle.service.js';
import { generateReportHtml } from '../src/services/pdf.service.js';
import type { GeneratedReport } from '@serp-scout/types';

const OUT_DIR = path.join(process.cwd(), 'scripts', 'out');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const requested = process.argv[2];
const all = await db.select().from(businesses);
const business = requested ? all.find((b) => b.name.includes(requested)) ?? all[0] : all[0];

const periodEnd = new Date();
const periodStart = new Date(periodEnd.getTime() - 7 * 24 * 60 * 60 * 1000);

const detailed = await buildDetailedReport({ businessId: business.id, periodStart, periodEnd });

const report: GeneratedReport = {
  executiveSummary: {
    importantChanges: `${detailed.rankingShifts.summary.climbed} keyword(s) climbed and ${detailed.rankingShifts.summary.declined} slipped across ${detailed.rankingShifts.summary.totalTracked} tracked phrases.`,
    mainOpportunity: detailed.contentGaps[0]
      ? `Publish a dedicated "${detailed.contentGaps[0].topic}" page.`
      : 'Expand high-intent service coverage.',
    mainCompetitiveThreat: detailed.competitors[0]
      ? `${detailed.competitors[0].name} (${detailed.competitors[0].domain}) leads the tracked market.`
      : 'No confirming competitor data yet.',
    weeklyFocus: detailed.actions[0]?.title || 'Execute the highest-return action.',
  },
  visibilityChanges: { keywordChanges: [], mapsChanges: [], serpFeatureChanges: [] },
  competitorChanges: detailed.competitors.slice(0, 5).map((c) => `${c.name} (${c.domain})`),
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

fs.mkdirSync(OUT_DIR, { recursive: true });
const browser = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ['--no-sandbox', '--disable-gpu'] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 703, height: 1017, deviceScaleFactor: 2 });
  await page.setContent(html, { waitUntil: 'domcontentloaded' });
  await page.emulateMediaType('print');

  const sections = await page.$$('section.page');
  const names = ['cover', 'executive', 'ranking-shifts', 'gaps', 'competitors', 'local', 'content', 'actions', 'evidence', 'methodology'];
  for (let i = 0; i < sections.length; i++) {
    const box = await sections[i].boundingBox();
    if (!box) continue;
    await page.screenshot({
      path: path.join(OUT_DIR, `section-${String(i + 1).padStart(2, '0')}-${names[i] ?? 'section'}.png`),
      clip: { x: 0, y: box.y, width: 703, height: Math.min(box.height, 1017) },
    });
  }
  console.log(`rendered ${sections.length} sections to ${OUT_DIR}`);
} finally {
  await browser.close();
}
process.exit(0);
