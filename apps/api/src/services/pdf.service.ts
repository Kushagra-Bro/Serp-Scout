import puppeteer from 'puppeteer';
import fs from 'node:fs';
import {
  DetailedReportSections,
  GeneratedReport,
  RankTrendPoint,
  RankingShiftRow,
  ReportCompetitorRow,
} from '@serp-scout/types';

export function findChromiumExecutable(): string | undefined {
  if (process.env.PUPPETEER_EXECUTABLE_PATH && fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  const candidates = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  return undefined;
}

export interface ReportPdfData {
  businessName: string;
  websiteUrl: string;
  periodStart: string;
  periodEnd: string;
  report: GeneratedReport;
}

export function normalizeReport(rawReport: any): GeneratedReport {
  const rawExec = rawReport?.executiveSummary || rawReport;
  return {
    executiveSummary: {
      importantChanges:
        rawExec?.importantChanges ||
        'SERP visibility remained active across target local commercial queries.',
      mainOpportunity:
        rawExec?.mainOpportunity ||
        'Expand high-intent service keywords to capture local customer demand.',
      mainCompetitiveThreat:
        rawExec?.mainCompetitiveThreat ||
        'Local competitors are aggressively optimizing local pack rankings.',
      weeklyFocus:
        rawExec?.weeklyFocus ||
        'Focus on highest return-on-effort content and local profile improvements.',
    },
    actionPlan: Array.isArray(rawReport?.actionPlan) ? rawReport.actionPlan : [],
    visibilityChanges: {
      keywordChanges: Array.isArray(rawReport?.visibilityChanges?.keywordChanges)
        ? rawReport.visibilityChanges.keywordChanges
        : [],
      mapsChanges: Array.isArray(rawReport?.visibilityChanges?.mapsChanges)
        ? rawReport.visibilityChanges.mapsChanges
        : [],
      serpFeatureChanges: Array.isArray(rawReport?.visibilityChanges?.serpFeatureChanges)
        ? rawReport.visibilityChanges.serpFeatureChanges
        : [],
    },
    competitorChanges: Array.isArray(rawReport?.competitorChanges) ? rawReport.competitorChanges : [],
    contentOpportunities: Array.isArray(rawReport?.contentOpportunities) ? rawReport.contentOpportunities : [],
    evidenceAppendix: Array.isArray(rawReport?.evidenceAppendix) ? rawReport.evidenceAppendix : [],
    detailed: rawReport?.detailed ?? undefined,
  };
}

/* ────────────────────────────── rendering helpers ────────────────────────────── */

const esc = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const PRIORITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  P0: { bg: '#fee2e2', text: '#991b1b', border: '#f87171' },
  P1: { bg: '#e0e7ff', text: '#3730a3', border: '#818cf8' },
  P2: { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' },
  P3: { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' },
};

function kpiCard(label: string, value: string, sub: string, accent: string): string {
  return `
    <div class="kpi">
      <div class="kpi-label">${esc(label)}</div>
      <div class="kpi-value" style="color:${accent}">${esc(value)}</div>
      <div class="kpi-sub">${esc(sub)}</div>
    </div>`;
}

function rankCell(rank: number | null): string {
  if (rank === null) return '<span class="rank-none">not ranking</span>';
  const cls = rank <= 3 ? 'rank-good' : rank <= 10 ? 'rank-mid' : 'rank-bad';
  return `<span class="rank ${cls}">#${rank}</span>`;
}

/**
 * Rank-trend sparkline as inline SVG.
 *
 * Every row in a table shares one rank scale (`scaleMax`, capped at the page-2
 * cutoff) so lines can be compared down the column instead of each row
 * auto-fitting to its own range. Lower rank numbers sit higher.
 *
 * Reading rules:
 *  - a solid segment means two consecutive sweeps both produced a position;
 *  - a dashed segment crosses a sweep where the business was absent — the trend
 *    is interpolated there and marked with a hollow amber dot on the baseline;
 *  - leading absent sweeps are trimmed to at most one, because a phrase swept six
 *    times before it ever ranked would otherwise plot as empty space.
 */
function buildSparkline(
  input: RankTrendPoint[],
  scaleMax: number,
  direction: 'up' | 'down' | 'flat'
): { svg: string; caption: string; hasLine: boolean } {
  const width = 132;
  const height = 30;
  const padX = 4;
  const padY = 4;

  const trend = (input ?? []).slice();
  // Trim leading absences down to one so the line starts near the first reading.
  while (trend.length > 1 && trend[0].rank === null && trend[1].rank === null) trend.shift();

  const rankedCount = trend.filter((p) => p.rank !== null).length;
  const absentCount = trend.length - rankedCount;

  if (rankedCount === 0) {
    return {
      svg: `<div class="spark-empty">no position in ${trend.length} check${trend.length === 1 ? '' : 's'}</div>`,
      caption: '',
      hasLine: false,
    };
  }

  const color = direction === 'up' ? '#059669' : direction === 'down' ? '#e11d48' : '#64748b';
  const usableW = width - padX * 2;
  const usableH = height - padY * 2;
  const xFor = (i: number) => (trend.length === 1 ? width / 2 : padX + (i / (trend.length - 1)) * usableW);
  const yFor = (rank: number | null) =>
    padY + ((Math.min(rank ?? scaleMax, scaleMax) - 1) / Math.max(scaleMax - 1, 1)) * usableH;
  const pointAt = (i: number) => ({ x: xFor(i), y: yFor(trend[i].rank) });

  // Solid runs + dashed bridges across absent sweeps.
  const solid: string[] = [];
  const dashed: string[] = [];
  let run: Array<{ x: number; y: number }> = [];
  let lastKnown: { x: number; y: number } | null = null;

  trend.forEach((point, index) => {
    if (point.rank === null) {
      if (run.length > 1) solid.push(pathOf(run));
      run = [];
      return;
    }
    const p = pointAt(index);
    if (run.length === 0 && lastKnown) dashed.push(pathOf([lastKnown, p]));
    run.push(p);
    lastKnown = p;
  });
  if (run.length > 1) solid.push(pathOf(run));

  function pathOf(points: Array<{ x: number; y: number }>): string {
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  }

  const top3Y = yFor(3);
  const band =
    top3Y > padY + 1
      ? `<rect x="0" y="0" width="${width}" height="${top3Y.toFixed(1)}" fill="#10b981" opacity="0.08"/>`
      : '';

  const area = solid
    .map((d) => {
      const coords = d.split(/[ML]/).filter(Boolean).map((pair) => pair.split(',').map(Number));
      const firstX = coords[0][0];
      const lastX = coords[coords.length - 1][0];
      return `<path d="${d} L${lastX.toFixed(1)},${height} L${firstX.toFixed(1)},${height} Z" fill="${color}" opacity="0.10"/>`;
    })
    .join('');

  const lines =
    solid.map((d) => `<path d="${d}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>`).join('') +
    dashed
      .map(
        (d) =>
          `<path d="${d}" fill="none" stroke="${color}" stroke-width="1.2" stroke-dasharray="2,2" opacity="0.65"/>`
      )
      .join('');

  const markers = trend
    .map((point, index) => {
      const x = xFor(index);
      if (point.rank === null) {
        return `<circle cx="${x.toFixed(1)}" cy="${(height - padY + 1).toFixed(1)}" r="2" fill="#fff" stroke="#f59e0b" stroke-width="1.2"/>`;
      }
      const y = yFor(point.rank);
      const isLast = index === trend.length - 1;
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${isLast ? 2.6 : 1.8}" fill="${
        isLast ? color : '#fff'
      }" stroke="${color}" stroke-width="1.3"/>`;
    })
    .join('');

  const firstRank = trend.find((p) => p.rank !== null)?.rank ?? null;
  const lastRank = [...trend].reverse().find((p) => p.rank !== null)?.rank ?? null;
  const caption = `${trend.length} checks · ${firstRank === null ? '—' : `#${firstRank}`} → ${
    lastRank === null ? '—' : `#${lastRank}`
  }${absentCount > 0 ? ` · ${absentCount} absent` : ''}`;

  return {
    svg: `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">${band}${area}${lines}${markers}</svg>`,
    caption,
    hasLine: solid.length > 0,
  };
}

function sparkline(
  trend: RankTrendPoint[],
  scaleMax: number,
  direction: 'up' | 'down' | 'flat'
): string {
  const { svg, caption } = buildSparkline(trend, scaleMax, direction);
  if (!caption) return `<div class="spark">${svg}</div>`;
  return `
    <div class="spark">
      ${svg}
      <div class="spark-caption">${esc(caption)}</div>
    </div>`;
}

function directionOf(row: RankingShiftRow): 'up' | 'down' | 'flat' {
  if (row.shift !== null && row.shift > 0) return 'up';
  if (row.shift !== null && row.shift < 0) return 'down';
  return 'flat';
}

/** Shared vertical scale: rank 1 down to the page-2 cutoff (or the worst rank seen). */
function sparklineScaleMax(rows: RankingShiftRow[]): number {
  const worst = rows.reduce((max, row) => {
    const ranks = (row.trend ?? []).map((p) => p.rank ?? 0);
    return ranks.length ? Math.max(max, ...ranks) : max;
  }, 0);
  return Math.max(10, Math.min(worst, 20));
}

function shiftCell(row: RankingShiftRow): string {
  if (row.status === 'not-ranking') return '<span class="shift-none">no check yet</span>';
  if (row.status === 'dropped-out') return '<span class="shift-bad">dropped out</span>';
  // A keyword with only one check has a position but nothing to compare against.
  if (row.status === 'new') return '<span class="shift-new">first reading</span>';
  if (row.shift === null || row.shift === 0) return '<span class="shift-flat">no change</span>';
  return row.shift > 0
    ? `<span class="shift-good">▲ +${row.shift}</span>`
    : `<span class="shift-bad">▼ ${row.shift}</span>`;
}

function shiftTable(rows: RankingShiftRow[], emptyMessage: string): string {
  if (rows.length === 0) {
    return `<div class="empty">${esc(emptyMessage)}</div>`;
  }
  const scaleMax = sparklineScaleMax(rows);
  return `
  <table>
    <thead>
      <tr>
        <th>Keyword Phrase</th>
        <th class="c">Previous Rank</th>
        <th class="c">Current Rank</th>
        <th class="c">Position Shift</th>
        <th class="c">Rank trend <span class="th-note">(1 → ${scaleMax})</span></th>
        <th class="c">Best Rival</th>
        <th>Observed</th>
      </tr>
    </thead>
    <tbody>
      ${rows
        .map(
          (k) => `
        <tr>
          <td><strong>${esc(k.keyword)}</strong>${k.intent ? `<div class="muted">${esc(k.intent)}${k.location ? ` · ${esc(k.location)}` : ''}</div>` : ''}</td>
          <td class="c">${k.previousRank ? `#${k.previousRank}` : '—'}</td>
          <td class="c">${rankCell(k.currentRank)}</td>
          <td class="c">${shiftCell(k)}</td>
          <td class="c">${sparkline(k.trend ?? [], scaleMax, directionOf(k))}</td>
          <td class="c">${
            k.bestCompetitorRank
              ? `#${k.bestCompetitorRank}<div class="muted">${esc(k.bestCompetitorDomain || '')}</div>`
              : '—'
          }</td>
          <td class="muted nowrap">${k.lastObservedAt ? esc(k.lastObservedAt.slice(0, 10)) : '—'}</td>
        </tr>`
        )
        .join('')}
    </tbody>
  </table>`;
}

function distributionChart(distribution: { top3: number; top4to10: number; page2: number; beyond: number }): string {
  const total = distribution.top3 + distribution.top4to10 + distribution.page2 + distribution.beyond || 1;
  const bars: Array<[string, number, string]> = [
    ['Top 3 (3-Pack range)', distribution.top3, '#10b981'],
    ['Positions 4-10 (page 1)', distribution.top4to10, '#3b82f6'],
    ['Positions 11-20 (page 2)', distribution.page2, '#f59e0b'],
    ['Beyond position 20', distribution.beyond, '#ef4444'],
  ];
  return `
    <div class="chart">
      ${bars
        .map(
          ([label, count, color]) => `
        <div class="chart-row">
          <div class="chart-label">${esc(label)}</div>
          <div class="chart-track"><div class="chart-bar" style="width:${Math.max(2, Math.round((count / total) * 100))}%;background:${color}"></div></div>
          <div class="chart-value">${count}</div>
        </div>`
        )
        .join('')}
    </div>`;
}

function competitorTable(rows: ReportCompetitorRow[]): string {
  if (rows.length === 0) {
    return '<div class="empty">No competitors have been confirmed for this market yet.</div>';
  }
  return `
  <table>
    <thead>
      <tr>
        <th>Competitor</th>
        <th>Type</th>
        <th class="c">Threat</th>
        <th class="c">Match</th>
        <th class="c">Rating</th>
        <th class="c">Reviews</th>
        <th>Proximity</th>
      </tr>
    </thead>
    <tbody>
      ${rows
        .slice(0, 24)
        .map(
          (c) => `
        <tr>
          <td><strong>${esc(c.name)}</strong><div class="muted">${esc(c.domain)}${c.serpOverlapPercent !== null ? ` · ${c.serpOverlapPercent}% SERP overlap` : ''}${c.hasAds ? ' · runs ads' : ''}</div></td>
          <td>${esc(c.competitorType)}<div class="muted">${esc(c.status)}</div></td>
          <td class="c">${esc(c.threatLevel || '—')}</td>
          <td class="c">${c.confidenceScore}%</td>
          <td class="c">${c.rating !== null ? c.rating.toFixed(1) : '—'}</td>
          <td class="c">${c.reviewCount ?? '—'}</td>
          <td class="muted">${esc(c.proximityLabel || (c.distanceMiles !== null ? `${c.distanceMiles} mi` : '—'))}</td>
        </tr>`
        )
        .join('')}
    </tbody>
  </table>`;
}

/* ────────────────────────────────── template ────────────────────────────────── */

export function generateReportHtml(data: ReportPdfData): string {
  const { businessName, websiteUrl, periodStart, periodEnd } = data;
  const report = normalizeReport(data.report);
  const { executiveSummary, actionPlan, contentOpportunities, evidenceAppendix } = report;
  const detailed: DetailedReportSections | undefined = report.detailed;

  const kpis = detailed?.kpis;
  const shifts = detailed?.rankingShifts;
  const distribution = shifts?.distribution ?? { top3: 0, top4to10: 0, page2: 0, beyond: 0 };
  // Detailed reports carry their own gap list; legacy reports only have the
  // array that was embedded in the original summary.
  const gaps = detailed?.contentGaps?.length ? detailed.contentGaps : contentOpportunities;

  const legacyKeywordChanges = report.visibilityChanges.keywordChanges || [];
  const legacyRows: RankingShiftRow[] = legacyKeywordChanges.map((k) => ({
    keyword: k.keyword,
    location: null,
    intent: null,
    previousRank: k.oldRank ?? null,
    currentRank: k.newRank ?? null,
    shift: k.oldRank && k.newRank ? k.oldRank - k.newRank : null,
    status: k.oldRank && k.newRank ? (k.oldRank === k.newRank ? 'unchanged' : k.oldRank > k.newRank ? 'climbed' : 'declined') : 'not-ranking',
    bestCompetitorRank: null,
    bestCompetitorDomain: null,
    opportunityScore: null,
    lastObservedAt: null,
    url: null,
    trend: [],
  }));

  const moversTable = shifts
    ? shiftTable(
        shifts.movers.slice(0, 18),
        'No keyword moved between the last two checks. Positions are listed in full below.'
      )
    : shiftTable(legacyRows.slice(0, 18), 'No recent keyword ranking shifts recorded for this period.');

  const steadyTable = shifts && shifts.unchanged.length > 0
    ? shiftTable(shifts.unchanged.slice(0, 20), 'No unchanged keywords recorded.')
    : '';

  const notRankingTable = shifts && shifts.notRanking.length > 0
    ? shiftTable(shifts.notRanking.slice(0, 20), 'Every tracked keyword has a stored position.')
    : '';

  const generatedOn = new Date().toLocaleDateString('en-US', { dateStyle: 'long' });
  const periodLabel = `${periodStart.slice(0, 10)} → ${periodEnd.slice(0, 10)}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Serp-Scout Intelligence Report — ${esc(businessName)}</title>
  <style>
    @page { margin: 14mm 12mm; size: A4; }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      line-height: 1.45;
      font-size: 11px;
      margin: 0;
      padding: 0;
      background: #ffffff;
    }
    h1, h2, h3 { margin: 0; }
    .page { page-break-after: always; }
    .page:last-child { page-break-after: auto; }

    /* ── Cover ── */
    .cover { min-height: 248mm; display: flex; flex-direction: column; gap: 20px; }
    .cover-top { border-top: 6px solid #4f46e5; padding-top: 18px; }
    .cover-kicker { font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: #6366f1; font-weight: 700; }
    .cover-title { font-size: 34px; font-weight: 800; color: #1e1b4b; letter-spacing: -1px; margin-top: 6px; }
    .cover-sub { font-size: 14px; color: #475569; margin-top: 8px; }
    .cover-meta { margin-top: 22px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px 24px; font-size: 11px; }
    .cover-meta div span { color: #64748b; display: block; font-size: 9px; text-transform: uppercase; letter-spacing: 0.6px; font-weight: 700; }
    .cover-highlights { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
    .cover-foot { margin-top: auto; border-top: 1px solid #e2e8f0; padding-top: 10px; font-size: 10px; color: #64748b; display: flex; justify-content: space-between; }

    /* ── Section furniture ── */
    .section-title { font-size: 14px; font-weight: 800; color: #1e293b; text-transform: uppercase; letter-spacing: 0.6px; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; margin: 0 0 12px; }
    .section-title .num { color: #6366f1; margin-right: 6px; }
    .lede { font-size: 11px; color: #475569; margin-bottom: 12px; }
    .muted { color: #64748b; font-size: 9.5px; }
    .empty { padding: 12px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; color: #64748b; font-size: 10.5px; text-align: center; }

    /* ── KPI grid ── */
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 14px; }
    .kpi { border: 1px solid #e2e8f0; border-radius: 8px; padding: 9px 10px; background: #ffffff; }
    .kpi-label { font-size: 8.5px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; font-weight: 700; }
    .kpi-value { font-size: 20px; font-weight: 800; line-height: 1.15; margin-top: 2px; }
    .kpi-sub { font-size: 8.5px; color: #94a3b8; margin-top: 1px; }

    /* ── Executive cards ── */
    .exec-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .exec-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; }
    .exec-label { font-size: 8.5px; text-transform: uppercase; font-weight: 800; color: #64748b; margin-bottom: 4px; letter-spacing: 0.5px; }
    .exec-text { font-size: 11px; color: #1e293b; margin: 0; }

    /* ── Tables ── */
    table { width: 100%; border-collapse: collapse; font-size: 9.5px; margin-bottom: 12px; }
    th, td { padding: 5px 7px; text-align: left; border-bottom: 1px solid #eef2f7; vertical-align: top; }
    td.nowrap { white-space: nowrap; }
    td.c, th.c { text-align: center; }
    th { background: #f8fafc; color: #475569; font-weight: 700; font-size: 8.5px; text-transform: uppercase; letter-spacing: 0.4px; }
    .c { text-align: center; }
    .rank { display: inline-block; padding: 1px 6px; border-radius: 10px; font-weight: 800; font-size: 9.5px; }
    .rank-good { background: #d1fae5; color: #065f46; }
    .rank-mid { background: #dbeafe; color: #1e40af; }
    .rank-bad { background: #fee2e2; color: #991b1b; }
    .rank-none { color: #94a3b8; font-style: italic; }
    .shift-good { color: #047857; font-weight: 800; }
    .shift-bad { color: #be123c; font-weight: 800; }
    .shift-flat { color: #64748b; font-weight: 700; }
    .shift-new { color: #1d4ed8; font-weight: 800; }
    .shift-none { color: #94a3b8; font-style: italic; }

    /* ── Sparklines ── */
    .spark { display: inline-block; }
    .spark svg { display: block; }
    .spark-caption { font-size: 7.5px; color: #94a3b8; font-weight: 600; margin-top: 1px; white-space: nowrap; }
    .spark-empty { font-size: 8.5px; color: #cbd5e1; font-style: italic; }
    .th-note { font-weight: 500; text-transform: none; letter-spacing: 0; color: #94a3b8; }
    .spark-legend { font-size: 8.5px; color: #94a3b8; margin: -4px 0 12px; line-height: 1.4; }

    /* ── Chart ── */
    .chart { margin-bottom: 12px; }
    .chart-row { display: grid; grid-template-columns: 150px 1fr 34px; gap: 8px; align-items: center; margin-bottom: 6px; font-size: 10px; }
    .chart-track { background: #f1f5f9; border-radius: 999px; height: 9px; overflow: hidden; }
    .chart-bar { height: 100%; border-radius: 999px; }
    .chart-value { text-align: right; font-weight: 800; }

    /* ── Recommendation cards ── */
    .rec-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; margin-bottom: 9px; page-break-inside: avoid; }
    .rec-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 5px; }
    .rec-title { font-size: 12px; font-weight: 800; color: #0f172a; }
    .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 8.5px; font-weight: 800; text-transform: uppercase; white-space: nowrap; }
    .rec-problem { font-size: 10.5px; color: #334155; margin-bottom: 5px; }
    .rec-evidence { background: #f1f5f9; padding: 6px 9px; border-radius: 4px; font-size: 9.5px; color: #334155; font-style: italic; }
    .rec-meta { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 6px; font-size: 9px; color: #64748b; }
    .steps { margin: 6px 0 0; padding-left: 16px; font-size: 9.5px; color: #334155; }
    .steps li { margin-bottom: 2px; }

    /* ── Lists / notes ── */
    .notes { margin: 0; padding-left: 16px; font-size: 10px; color: #334155; }
    .notes li { margin-bottom: 3px; }
    .callout { border: 1px solid #fde68a; background: #fffbeb; border-radius: 8px; padding: 10px 12px; font-size: 10px; color: #78350f; margin-bottom: 12px; }
    .callout strong { display: block; margin-bottom: 3px; text-transform: uppercase; letter-spacing: 0.5px; font-size: 9px; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .footer { margin-top: 18px; border-top: 1px solid #e2e8f0; padding-top: 8px; font-size: 8.5px; color: #94a3b8; display: flex; justify-content: space-between; }
  </style>
</head>
<body>

  <!-- ── PAGE 1 · COVER ─────────────────────────────────────────────────── -->
  <section class="page">
    <div class="cover">
      <div class="cover-top">
        <div class="cover-kicker">Serp-Scout · Local Search Intelligence</div>
        <h1 class="cover-title">${esc(businessName)}</h1>
        <p class="cover-sub">
          Search visibility, competitor movement and prioritised actions for
          ${esc(detailed?.meta.city || 'your local market')}${detailed?.meta.industry ? ` · ${esc(detailed.meta.industry)}` : ''}
        </p>

        <div class="cover-meta">
          <div><span>Website</span>${esc(websiteUrl)}</div>
          <div><span>Reporting period</span>${esc(periodLabel)}</div>
          <div><span>Generated</span>${esc(generatedOn)}</div>
          <div><span>Services monitored</span>${esc((detailed?.meta.services || []).slice(0, 6).join(', ') || '—')}</div>
        </div>
      </div>

      <div>
        <div class="cover-highlights">
          ${kpiCard('Tracked keywords', String(kpis?.trackedKeywords ?? legacyKeywordChanges.length), 'phrases monitored each sweep', '#4f46e5')}
          ${kpiCard('Keywords in top 3', String(kpis?.top3 ?? 0), 'local pack range', '#059669')}
          ${kpiCard(
            'Average position',
            kpis?.averagePosition !== null && kpis?.averagePosition !== undefined ? `#${kpis.averagePosition}` : '—',
            'across ranked keywords',
            '#2563eb'
          )}
          ${kpiCard('Improved this period', String(kpis?.improved ?? 0), `${kpis?.declined ?? 0} declined`, '#7c3aed')}
        </div>

        <div class="callout" style="margin-top:14px;">
          <strong>How to read this report</strong>
          Positions are recorded from real search sweeps of the monitored phrases. A keyword either has a stored position,
          is new to the report, or is reported as <em>not ranking</em> — we never substitute a competitor's position for yours.
          Every number below is traceable to the evidence appendix in section 10.
        </div>
      </div>

      <div class="cover-foot">
        <span>Prepared for ${esc(businessName)}${detailed?.meta.workspaceName ? ` · ${esc(detailed.meta.workspaceName)}` : ''}</span>
        <span>Success is measured by real business outcomes, not a visibility score.</span>
      </div>
    </div>
  </section>

  <!-- ── PAGE 2 · EXECUTIVE SUMMARY + KPIs ──────────────────────────────── -->
  <section class="page">
    <h2 class="section-title"><span class="num">01</span>Executive Summary</h2>
    <p class="lede">
      The headline position of ${esc(businessName)} across ${esc(String(kpis?.trackedKeywords ?? legacyKeywordChanges.length))} monitored
      phrases, where the market moved, and the single highest-value action for the coming week.
    </p>

    <div class="exec-grid">
      <div class="exec-card" style="border-left: 3px solid #3b82f6;">
        <div class="exec-label">Important market changes</div>
        <p class="exec-text">${esc(executiveSummary.importantChanges)}</p>
      </div>
      <div class="exec-card" style="border-left: 3px solid #10b981;">
        <div class="exec-label">Main business opportunity</div>
        <p class="exec-text">${esc(executiveSummary.mainOpportunity)}</p>
      </div>
      <div class="exec-card" style="border-left: 3px solid #f43f5e;">
        <div class="exec-label">Primary competitive threat</div>
        <p class="exec-text">${esc(executiveSummary.mainCompetitiveThreat)}</p>
      </div>
      <div class="exec-card" style="border-left: 3px solid #8b5cf6;">
        <div class="exec-label">Weekly strategic focus</div>
        <p class="exec-text">${esc(executiveSummary.weeklyFocus)}</p>
      </div>
    </div>

    <h3 class="section-title" style="margin-top:18px;font-size:12px;">Performance dashboard</h3>
    <div class="kpi-grid">
      ${kpiCard('Tracked keywords', String(kpis?.trackedKeywords ?? legacyKeywordChanges.length), 'monitored phrases', '#4f46e5')}
      ${kpiCard('Keywords ranked', String(kpis?.rankedKeywords ?? 0), `${kpis?.notRankedKeywords ?? 0} not ranking`, '#0ea5e9')}
      ${kpiCard('Top 3 placements', String(kpis?.top3 ?? 0), '3-Pack range', '#059669')}
      ${kpiCard('Page 1 (top 10)', String(kpis?.top10 ?? 0), 'compounding visibility', '#2563eb')}
      ${kpiCard('Average position', kpis?.averagePosition !== null && kpis?.averagePosition !== undefined ? `#${kpis.averagePosition}` : '—', 'weighted across ranked keywords', '#7c3aed')}
      ${kpiCard('Climbed', String(kpis?.improved ?? 0), 'keywords moved up', '#059669')}
      ${kpiCard('Declined', String(kpis?.declined ?? 0), 'keywords slipped', '#e11d48')}
      ${kpiCard('Competitors tracked', String(kpis?.competitors ?? 0), `${kpis?.severeThreats ?? 0} severe threats`, '#b45309')}
      ${kpiCard('Content gaps', String(kpis?.contentGaps ?? contentOpportunities.length), 'topics rivals cover, you do not', '#0f766e')}
      ${kpiCard('Open actions', String(kpis?.openActions ?? actionPlan.length), 'from the action plan', '#4338ca')}
      ${kpiCard('Evidence citations', String(kpis?.evidenceCitations ?? evidenceAppendix.length), 'traceable sources', '#475569')}
      ${kpiCard('Ranking observations', String(kpis?.observationCount ?? 0), 'recorded position rows', '#475569')}
    </div>

    ${shifts ? `
    <h3 class="section-title" style="margin-top:18px;font-size:12px;">Movement at a glance</h3>
    <div class="two-col">
      <div>
        <ul class="notes">
          <li><strong>${shifts.summary.totalTracked}</strong> keywords tracked in this period.</li>
          <li><strong>${shifts.summary.ranked}</strong> hold a recorded position (${shifts.summary.notRanked} do not rank).</li>
          <li><strong>${shifts.summary.climbed}</strong> climbed, <strong>${shifts.summary.declined}</strong> declined, <strong>${shifts.summary.unchanged}</strong> unchanged.</li>
          <li><strong>${shifts.summary.newEntries}</strong> new entries, <strong>${shifts.summary.droppedOut}</strong> dropped out of the results.</li>
          <li>Average movement: <strong>${shifts.summary.averageShift === null ? '—' : `${shifts.summary.averageShift > 0 ? '+' : ''}${shifts.summary.averageShift} positions`}</strong>.</li>
        </ul>
      </div>
      <div>
        ${distributionChart(distribution)}
      </div>
    </div>` : ''}

    ${kpis?.largestGain || kpis?.largestDrop ? `
    <div class="two-col" style="margin-top:6px;">
      <div class="exec-card" style="border-left:3px solid #059669;">
        <div class="exec-label">Largest gain</div>
        <p class="exec-text">${kpis?.largestGain ? `${esc(kpis.largestGain.keyword)} — up ${kpis.largestGain.delta} position(s)` : 'No keyword improved in this period.'}</p>
      </div>
      <div class="exec-card" style="border-left:3px solid #e11d48;">
        <div class="exec-label">Largest drop</div>
        <p class="exec-text">${kpis?.largestDrop ? `${esc(kpis.largestDrop.keyword)} — down ${Math.abs(kpis.largestDrop.delta)} position(s)` : 'No keyword declined in this period.'}</p>
      </div>
    </div>` : ''}

    <div class="footer"><span>Serp-Scout Intelligence Report</span><span>${esc(businessName)} · ${esc(periodLabel)}</span></div>
  </section>

  <!-- ── PAGE 3 · SEARCH VISIBILITY & RANKING SHIFTS (movers) ───────────── -->
  <section class="page">
    <h2 class="section-title"><span class="num">02</span>Search Visibility &amp; Ranking Shifts</h2>
    <p class="lede">
      Current rank is the best position of your domain in the most recent check; previous rank is the same measure from the
      preceding check, so every shift compares two separate sweeps. <strong>Not ranking</strong> means your domain was absent
      from the collected results — it is never replaced with a competitor's position.
    </p>

    ${shifts ? `
    <table>
      <thead>
        <tr>
          <th>Tracked</th><th class="c">Ranked</th><th class="c">Not ranking</th><th class="c">Climbed</th>
          <th class="c">Declined</th><th class="c">Unchanged</th><th class="c">First reading</th><th class="c">Dropped out</th>
          <th class="c">Avg position</th><th class="c">Avg shift</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="c"><strong>${shifts.summary.totalTracked}</strong></td>
          <td class="c">${shifts.summary.ranked}</td>
          <td class="c">${shifts.summary.notRanked}</td>
          <td class="c shift-good">${shifts.summary.climbed}</td>
          <td class="c shift-bad">${shifts.summary.declined}</td>
          <td class="c">${shifts.summary.unchanged}</td>
          <td class="c">${shifts.summary.newEntries}</td>
          <td class="c">${shifts.summary.droppedOut}</td>
          <td class="c">${shifts.summary.averagePosition === null ? '—' : `#${shifts.summary.averagePosition}`}</td>
          <td class="c">${shifts.summary.averageShift === null ? '—' : shifts.summary.averageShift}</td>
        </tr>
      </tbody>
    </table>` : ''}

    <h3 class="section-title" style="font-size:12px;">Position movers</h3>
    ${moversTable}
    <div class="spark-legend">
      Sparkline: one point per sweep, oldest on the left; the shaded band is the top-3 range. A
      <strong>solid</strong> segment joins two sweeps that both produced a position, a
      <strong>dashed</strong> segment crosses a sweep where your domain did not appear, and those
      sweeps are marked with a hollow amber dot on the baseline. All rows share one rank scale.
    </div>

    ${steadyTable ? `
    <h3 class="section-title" style="font-size:12px;">Holding steady</h3>
    ${steadyTable}` : ''}

    <div class="footer"><span>Section 02 · Ranking shifts</span><span>${esc(periodLabel)}</span></div>
  </section>

  <!-- ── PAGE 4 · NOT RANKING / OPPORTUNITY BACKLOG ────────────────────── -->
  <section class="page">
    <h2 class="section-title"><span class="num">03</span>Visibility Gaps &amp; Opportunity Backlog</h2>
    <p class="lede">
      Keywords with no recorded position are the clearest growth backlog: the demand exists, the phrase is tracked, and your
      domain was not present in the results. They are ranked by opportunity score, then by competitive pressure.
    </p>

    ${notRankingTable}

    ${shifts && shifts.notRanking.length > 0 ? `
    <div class="callout">
      <strong>Interpretation</strong>
      ${shifts.notRanking.length} of ${shifts.summary.totalTracked} tracked phrases returned no position for ${esc(businessName)}.
      ${shifts.notRanking.slice(0, 3).map((r) => r.keyword).join(', ')}${shifts.notRanking.length > 3 ? ', …' : ''}
      ${shifts.notRanking.some((r) => r.bestCompetitorRank !== null)
        ? ' Competitors already hold positions for several of these phrases, so the intent is proven.'
        : ' No competitor position is recorded for these either, so validate demand before investing heavily.'}
    </div>` : ''}

    ${shifts && (shifts.newEntries.length > 0 || shifts.droppedOut.length > 0) ? `
    <h3 class="section-title" style="font-size:12px;">Entries and exits since the last check</h3>
    ${shiftTable([...shifts.newEntries, ...shifts.droppedOut].slice(0, 18), 'No keywords entered or left the results.')}
    ` : ''}

    <div class="footer"><span>Section 03 · Visibility gaps</span><span>${esc(periodLabel)}</span></div>
  </section>

  <!-- ── PAGE 5 · COMPETITOR LANDSCAPE ─────────────────────────────────── -->
  <section class="page">
    <h2 class="section-title"><span class="num">04</span>Competitor Landscape</h2>
    <p class="lede">
      Confirmed and candidate competitors discovered from live local results, scored on service overlap, proximity,
      reputation, paid-search activity and SERP overlap.
    </p>
    ${competitorTable(detailed?.competitors ?? [])}

    ${detailed && detailed.competitors.length > 0 ? `
    <h3 class="section-title" style="font-size:12px;">Threat rationale</h3>
    <table>
      <thead><tr><th>Competitor</th><th>Why it is rated this way</th></tr></thead>
      <tbody>
        ${detailed.competitors
          .filter((c) => c.threatReason)
          .slice(0, 10)
          .map((c) => `<tr><td><strong>${esc(c.name)}</strong><div class="muted">${esc(c.domain)}</div></td><td>${esc(c.threatReason)}</td></tr>`)
          .join('')}
      </tbody>
    </table>` : ''}

    <div class="footer"><span>Section 04 · Competitor landscape</span><span>${esc(periodLabel)}</span></div>
  </section>

  <!-- ── PAGE 6 · LOCAL PRESENCE & REPUTATION ──────────────────────────── -->
  <section class="page">
    <h2 class="section-title"><span class="num">05</span>Local Presence &amp; Reputation Signals</h2>
    <p class="lede">
      Local pack visibility, geographic proximity of rivals and the recurring themes customers mention in reviews across
      the monitored market.
    </p>

    <div class="kpi-grid">
      ${kpiCard('Keywords with a rival in top 3', String(detailed?.localPresence.threePackMentions ?? 0), 'competitive pressure', '#e11d48')}
      ${kpiCard('Rivals with review data', String((detailed?.competitors ?? []).filter((c) => c.reviewCount !== null).length), 'reputation benchmarks', '#0ea5e9')}
      ${kpiCard('Proximity data available', detailed?.localPresence.hasMapsData ? 'Yes' : 'No', 'Maps distance per rival', '#7c3aed')}
      ${kpiCard(
        'Review themes extracted',
        String(detailed?.reputation.themes.length ?? 0),
        `${detailed?.reputation.positiveCount ?? 0} positive / ${detailed?.reputation.negativeCount ?? 0} negative`,
        '#059669'
      )}
    </div>

    <ul class="notes">
      ${(detailed?.localPresence.notes ?? []).map((n) => `<li>${esc(n)}</li>`).join('')}
    </ul>

    ${detailed?.localPresence.topRivalByReviews ? `
    <div class="exec-card" style="margin-top:12px;border-left:3px solid #e11d48;">
      <div class="exec-label">Reputation benchmark to beat</div>
      <p class="exec-text">
        ${esc(detailed.localPresence.topRivalByReviews.name)} (${esc(detailed.localPresence.topRivalByReviews.domain)}) holds
        ${esc(String(detailed.localPresence.topRivalByReviews.reviewCount ?? '—'))} reviews at
        ${detailed.localPresence.topRivalByReviews.rating !== null ? `${detailed.localPresence.topRivalByReviews.rating.toFixed(1)}★` : 'an unrated profile'}.
      </p>
    </div>` : ''}

    <h3 class="section-title" style="font-size:12px;">Review themes</h3>
    ${(detailed?.reputation.themes.length ?? 0) > 0 ? `
    <table>
      <thead><tr><th>Theme</th><th class="c">Sentiment</th><th class="c">Frequency</th><th>Source</th><th>Example</th></tr></thead>
      <tbody>
        ${(detailed?.reputation.themes ?? [])
          .slice(0, 14)
          .map(
            (t) => `<tr>
              <td><strong>${esc(t.theme)}</strong></td>
              <td class="c">${esc(t.sentiment)}</td>
              <td class="c">${t.frequency}</td>
              <td class="muted">${esc(t.competitorDomain || '—')}</td>
              <td class="muted">${esc(t.examples[0] || '—')}</td>
            </tr>`
          )
          .join('')}
      </tbody>
    </table>` : `<div class="empty">${esc(detailed?.reputation.summary || 'No review themes recorded for this market yet.')}</div>`}

    <div class="footer"><span>Section 05 · Local presence &amp; reputation</span><span>${esc(periodLabel)}</span></div>
  </section>

  <!-- ── PAGE 7 · CONTENT OPPORTUNITIES ────────────────────────────────── -->
  <section class="page">
    <h2 class="section-title"><span class="num">06</span>Content &amp; Coverage Opportunities</h2>
    <p class="lede">
      Topics where a competitor was observed covering the subject and the business was not. Each entry carries the page type,
      suggested title, section headings and FAQ set needed to compete.
    </p>

    ${gaps.length === 0 ? `
      <div class="empty">No content gaps recorded. Gaps appear once a competitor is observed covering a topic the business does not.</div>
    ` : gaps.slice(0, 8).map((gap, idx) => {
      const pColor = PRIORITY_COLORS[gap.priority] || PRIORITY_COLORS.P1;
      return `
      <div class="rec-card">
        <div class="rec-header">
          <div>
            <div class="rec-title">${idx + 1}. ${esc(gap.topic)}</div>
            <div class="muted">${esc(gap.recommendedPageType)} page · target intent: ${esc(gap.targetIntent)}${gap.competitorDomain ? ` · rival coverage: ${esc(gap.competitorDomain)}` : ''}</div>
          </div>
          <span class="badge" style="background:${pColor.bg};color:${pColor.text};border:1px solid ${pColor.border};">${esc(gap.priority)} · ${esc(gap.estimatedImpact)} impact</span>
        </div>
        <div class="rec-problem"><strong>Suggested title:</strong> ${esc(gap.suggestedTitle)}</div>
        ${gap.suggestedHeadings.length > 0 ? `<div class="muted"><strong>Headings:</strong> ${esc(gap.suggestedHeadings.slice(0, 6).join(' · '))}</div>` : ''}
        ${gap.suggestedFaqs.length > 0 ? `<div class="muted"><strong>FAQ:</strong> ${esc(gap.suggestedFaqs.slice(0, 4).join(' · '))}</div>` : ''}
        <div class="rec-meta"><span><strong>Effort:</strong> ${esc(gap.estimatedEffort)}</span>${gap.evidenceUrls.length > 0 ? `<span><strong>Evidence:</strong> ${esc(gap.evidenceUrls[0])}</span>` : ''}</div>
      </div>`;
    }).join('')}

    <div class="footer"><span>Section 06 · Content opportunities</span><span>${esc(periodLabel)}</span></div>
  </section>

  <!-- ── PAGE 8 · PRIORITISED ACTION PLAN ──────────────────────────────── -->
  <section class="page">
    <h2 class="section-title"><span class="num">07</span>Prioritised Action Plan</h2>
    <p class="lede">
      Ranked by return on effort: P0 items are immediate wins, P3 are structural improvements. Each action states the problem,
      the observed evidence, the expected impact and the steps to complete it.
    </p>

    ${actionPlan.length === 0 ? `
      <div class="empty">No priority actions recorded for this cycle.</div>
    ` : actionPlan.map((rec, idx) => {
      const pColor = PRIORITY_COLORS[rec.priority] || PRIORITY_COLORS.P1;
      const steps = rec.implementationSteps && rec.implementationSteps.length > 0
        ? rec.implementationSteps
        : [
            `Review competitor positioning on ${rec.searchQueries?.[0] || 'the target query'}`,
            'Draft and publish copy addressing the observed friction',
            'Request indexing and re-measure in the next sweep',
          ];
      return `
      <div class="rec-card">
        <div class="rec-header">
          <h3 class="rec-title">${idx + 1}. ${esc(rec.title)}</h3>
          <span class="badge" style="background:${pColor.bg};color:${pColor.text};border:1px solid ${pColor.border};">${esc(rec.priority)} priority</span>
        </div>
        <div class="rec-problem"><strong>Problem/opportunity:</strong> ${esc(rec.problem)}</div>
        <div class="rec-evidence"><strong>Observed evidence:</strong> ${esc(rec.evidenceSummary)}</div>
        <ol class="steps">${steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
        <div class="rec-meta">
          <span><strong>Impact:</strong> ${esc((rec.expectedImpact || 'medium').toUpperCase())}</span>
          <span><strong>Effort:</strong> ${esc((rec.estimatedEffort || 'medium').toUpperCase())}</span>
          <span><strong>Confidence:</strong> ${esc((rec.confidence || 'medium').toUpperCase())}</span>
          <span><strong>Owner:</strong> ${esc(rec.suggestedOwner || 'Practice lead')}</span>
          <span><strong>Deadline:</strong> ${esc(rec.suggestedDeadline || 'Within 7 days')}</span>
        </div>
        ${rec.searchQueries && rec.searchQueries.length > 0 ? `<div class="muted" style="margin-top:4px;"><strong>Queries:</strong> ${esc(rec.searchQueries.slice(0, 4).join(' · '))}</div>` : ''}
      </div>`;
    }).join('')}

    <div class="footer"><span>Section 07 · Action plan</span><span>${esc(periodLabel)}</span></div>
  </section>

  <!-- ── PAGE 9 · EVIDENCE APPENDIX ────────────────────────────────────── -->
  <section class="page">
    <h2 class="section-title"><span class="num">08</span>Evidence &amp; Verification Trail</h2>
    <p class="lede">
      Every claim above resolves to one of these citations. Rows are the searches and sources collected for this period.
    </p>

    ${(detailed?.evidence ?? evidenceAppendix).length === 0 ? `
      <div class="empty">No direct evidence trail recorded for this report cycle.</div>
    ` : `
    <table>
      <thead><tr><th>Query / Claim</th><th>Source</th><th class="c">Date</th><th>Reference</th></tr></thead>
      <tbody>
        ${(detailed?.evidence ?? evidenceAppendix)
          .slice(0, 40)
          .map(
            (item) => `<tr>
              <td>${esc(item.query)}</td>
              <td class="muted">${esc(item.source)}</td>
              <td class="c muted">${esc(item.date)}</td>
              <td class="muted" style="max-width:190px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(item.url || '—')}</td>
            </tr>`
          )
          .join('')}
      </tbody>
    </table>`}

    <div class="footer"><span>Section 08 · Evidence</span><span>${esc(periodLabel)}</span></div>
  </section>

  <!-- ── PAGE 10 · METHODOLOGY, LIMITATIONS & GLOSSARY ─────────────────── -->
  <section class="page">
    <h2 class="section-title"><span class="num">09</span>Methodology, Limitations &amp; Glossary</h2>

    <h3 class="section-title" style="font-size:12px;">How these numbers are produced</h3>
    <ul class="notes">
      ${(detailed?.methodology ?? [
        'Positions come from stored search sweeps of each tracked phrase.',
        'A check is one search run; current and previous rank come from two different checks.',
        'Threat levels and scores are derived from stored evidence, not subjective judgement.',
      ]).map((m) => `<li>${esc(m)}</li>`).join('')}
    </ul>

    <h3 class="section-title" style="font-size:12px;margin-top:16px;">Known limitations of this cycle</h3>
    ${(detailed?.limitations.length ?? 0) > 0 ? `
    <ul class="notes">
      ${(detailed?.limitations ?? []).map((l) => `<li>${esc(l)}</li>`).join('')}
    </ul>` : `
    <div class="empty">No data limitations were recorded for this cycle.</div>`}

    <h3 class="section-title" style="font-size:12px;margin-top:16px;">Glossary</h3>
    <table>
      <thead><tr><th style="width:34%">Term</th><th>Meaning in this report</th></tr></thead>
      <tbody>
        <tr><td><strong>Check</strong></td><td>One search sweep of a tracked phrase. Shifts always compare two different checks.</td></tr>
        <tr><td><strong>Current rank</strong></td><td>Best position of your domain in the most recent check for that phrase.</td></tr>
        <tr><td><strong>Not ranking</strong></td><td>Your domain was absent from the collected results. This is not a rank of zero.</td></tr>
        <tr><td><strong>3-Pack range</strong></td><td>Positions 1-3, where local map results capture the majority of calls.</td></tr>
        <tr><td><strong>Best rival</strong></td><td>Strongest position held by a confirmed competitor for that phrase.</td></tr>
        <tr><td><strong>Opportunity score</strong></td><td>Weighted blend of business relevance, commercial intent, local fit and ranking potential.</td></tr>
        <tr><td><strong>Content gap</strong></td><td>A topic a competitor was observed covering and you were not.</td></tr>
        <tr><td><strong>Threat level</strong></td><td>Severe / emerging / vulnerable / moderate, derived from position, reviews, proximity and ads.</td></tr>
      </tbody>
    </table>

    <div class="callout" style="margin-top:14px;">
      <strong>What this report is not</strong>
      It is not a traffic or revenue forecast. It measures observed positions and competitor activity from the sweeps listed
      in section 08. Anything that could not be measured is stated explicitly rather than estimated.
    </div>

    <div class="footer">
      <span>Serp-Scout AI Intelligence · Report generated ${esc(generatedOn)}</span>
      <span>${esc(businessName)} · ${esc(periodLabel)}</span>
    </div>
  </section>

</body>
</html>`;
}

/**
 * Generates a PDF binary buffer from report data using Puppeteer
 */
export async function generateReportPdf(data: ReportPdfData): Promise<Buffer> {
  const html = generateReportHtml(data);

  let browser;
  try {
    const executablePath = findChromiumExecutable();

    browser = await puppeteer.launch({
      headless: true,
      ...(executablePath ? { executablePath } : {}),
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 20000 });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '14mm',
        bottom: '14mm',
        left: '12mm',
        right: '12mm',
      },
    });

    return Buffer.from(pdfBuffer);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Generates CSV export content from report data
 */
export function generateReportCsv(data: ReportPdfData): string {
  const report = normalizeReport(data.report);

  const escapeCsv = (val: any) => {
    const str = String(val ?? '').replace(/"/g, '""');
    return `"${str}"`;
  };

  const sections: string[] = [];
  const line = (cells: unknown[]) => cells.map(escapeCsv).join(',');

  sections.push('"SERP-SCOUT REPORT EXPORT"');
  sections.push(line(['Business', data.businessName, 'Website', data.websiteUrl]));
  sections.push(line(['Period', `${data.periodStart.slice(0, 10)} to ${data.periodEnd.slice(0, 10)}`]));
  sections.push('');

  sections.push('"SECTION 1: KEYWORD RANKING SHIFTS"');
  sections.push(
    line(['Keyword', 'Location', 'Intent', 'Previous Rank', 'Current Rank', 'Position Shift', 'Status', 'Best Rival', 'Rival Domain', 'Opportunity Score', 'Last Observed', 'Rank trend (oldest → newest)', 'Checks'])
  );
  const shiftRows = report.detailed?.rankingShifts;
  if (shiftRows) {
    const all = [
      ...shiftRows.movers,
      ...shiftRows.unchanged,
      ...shiftRows.newEntries,
      ...shiftRows.droppedOut,
      ...shiftRows.notRanking,
    ];
    for (const row of all) {
      sections.push(
        line([
          row.keyword,
          row.location ?? '',
          row.intent ?? '',
          row.previousRank ?? '',
          row.currentRank ?? '',
          row.shift ?? '',
          row.status,
          row.bestCompetitorRank ?? '',
          row.bestCompetitorDomain ?? '',
          row.opportunityScore ?? '',
          row.lastObservedAt?.slice(0, 10) ?? '',
          // e.g. "12>9>6>absent>4" so the trend survives a spreadsheet export.
          (row.trend ?? []).map((p) => (p.rank === null ? 'absent' : String(p.rank))).join('>'),
          (row.trend ?? []).length,
        ])
      );
    }
  } else {
    for (const k of report.visibilityChanges.keywordChanges) {
      sections.push(line([k.keyword, '', '', k.oldRank ?? '', k.newRank ?? '', '', '', '', '', '', '', '', '']));
    }
  }
  sections.push('');

  sections.push('"SECTION 2: COMPETITOR LANDSCAPE"');
  sections.push(line(['Name', 'Domain', 'Type', 'Status', 'Threat', 'Match %', 'Rating', 'Reviews', 'Distance (mi)', 'Proximity', 'Runs ads', 'SERP overlap %', 'Threat reason']));
  for (const c of report.detailed?.competitors ?? []) {
    sections.push(
      line([
        c.name,
        c.domain,
        c.competitorType,
        c.status,
        c.threatLevel ?? '',
        c.confidenceScore,
        c.rating ?? '',
        c.reviewCount ?? '',
        c.distanceMiles ?? '',
        c.proximityLabel ?? '',
        c.hasAds ? 'yes' : 'no',
        c.serpOverlapPercent ?? '',
        c.threatReason ?? '',
      ])
    );
  }
  sections.push('');

  sections.push('"SECTION 3: CONTENT OPPORTUNITIES"');
  sections.push(line(['Topic', 'Page type', 'Target intent', 'Priority', 'Impact', 'Effort', 'Suggested title', 'Rival covering it']));
  for (const g of report.contentOpportunities) {
    sections.push(
      line([
        g.topic,
        g.recommendedPageType,
        g.targetIntent,
        g.priority,
        g.estimatedImpact,
        g.estimatedEffort,
        g.suggestedTitle,
        g.competitorDomain,
      ])
    );
  }
  sections.push('');

  sections.push('"SECTION 4: PRIORITISED ACTION PLAN"');
  sections.push(
    line([
      'Priority',
      'Action title',
      'Problem / opportunity',
      'Expected impact',
      'Estimated effort',
      'Confidence',
      'Owner',
      'Deadline',
      'Evidence summary',
      'Implementation steps',
      'Source URLs',
    ])
  );
  for (const rec of report.actionPlan) {
    sections.push(
      line([
        rec.priority || 'P1',
        rec.title,
        rec.problem,
        rec.expectedImpact,
        rec.estimatedEffort,
        rec.confidence,
        rec.suggestedOwner || 'Practice Lead',
        rec.suggestedDeadline || 'Within 7 days',
        rec.evidenceSummary,
        (rec.implementationSteps || []).join(' | '),
        (rec.sourceUrls || []).join('; '),
      ])
    );
  }
  sections.push('');

  sections.push('"SECTION 5: EVIDENCE APPENDIX"');
  sections.push(line(['Query / claim', 'Source', 'Date', 'Type', 'URL']));
  for (const item of report.detailed?.evidence ?? report.evidenceAppendix) {
    sections.push(line([item.query, item.source, item.date, item.resultType, item.url ?? '']));
  }
  sections.push('');

  sections.push('"SECTION 6: METHODOLOGY & LIMITATIONS"');
  for (const m of report.detailed?.methodology ?? []) sections.push(line(['Methodology', m]));
  for (const l of report.detailed?.limitations ?? []) sections.push(line(['Limitation', l]));

  return sections.join('\n');
}
