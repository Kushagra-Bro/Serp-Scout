import puppeteer from 'puppeteer';
import fs from 'node:fs';
import { GeneratedReport } from '@serp-scout/types';

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
  };
}

export function generateReportHtml(data: ReportPdfData): string {
  const { businessName, websiteUrl, periodStart, periodEnd } = data;
  const report = normalizeReport(data.report);
  const { executiveSummary, actionPlan, visibilityChanges, contentOpportunities, evidenceAppendix } = report;

  const priorityColors: Record<string, { bg: string; text: string; border: string }> = {
    P0: { bg: '#fee2e2', text: '#991b1b', border: '#f87171' },
    P1: { bg: '#e0e7ff', text: '#3730a3', border: '#818cf8' },
    P2: { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' },
    P3: { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' },
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Serp-Scout Executive Intelligence Report - ${businessName}</title>
  <style>
    @page {
      margin: 15mm;
      size: A4;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      line-height: 1.5;
      font-size: 12px;
      margin: 0;
      padding: 0;
      background: #ffffff;
    }
    .header {
      border-bottom: 2px solid #4f46e5;
      padding-bottom: 12px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .brand-title {
      font-size: 20px;
      font-weight: 800;
      color: #1e1b4b;
      margin: 0;
      letter-spacing: -0.5px;
    }
    .tagline {
      font-size: 10px;
      color: #6366f1;
      font-weight: 600;
      margin-top: 2px;
    }
    .meta-info {
      text-align: right;
      font-size: 10px;
      color: #64748b;
    }
    .section-title {
      font-size: 14px;
      font-weight: 700;
      color: #1e293b;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 6px;
      margin-top: 20px;
      margin-bottom: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .exec-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 20px;
    }
    .exec-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px;
    }
    .exec-label {
      font-size: 9px;
      text-transform: uppercase;
      font-weight: 700;
      color: #64748b;
      margin-bottom: 4px;
    }
    .exec-text {
      font-size: 11px;
      color: #1e293b;
      font-weight: 500;
      margin: 0;
    }
    .rec-card {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 10px;
      background: #ffffff;
      page-break-inside: avoid;
    }
    .rec-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
    }
    .rec-title {
      font-size: 13px;
      font-weight: 700;
      color: #0f172a;
      margin: 0;
    }
    .badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .rec-problem {
      font-size: 11px;
      color: #475569;
      margin-bottom: 6px;
    }
    .rec-evidence {
      background: #f1f5f9;
      padding: 6px 10px;
      border-radius: 4px;
      font-size: 10px;
      color: #334155;
      font-style: italic;
    }
    .rec-meta {
      display: flex;
      gap: 15px;
      margin-top: 8px;
      font-size: 10px;
      color: #64748b;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
      margin-bottom: 15px;
    }
    th, td {
      padding: 6px 8px;
      text-align: left;
      border-bottom: 1px solid #f1f5f9;
    }
    th {
      background: #f8fafc;
      color: #475569;
      font-weight: 600;
    }
    .footer {
      margin-top: 30px;
      border-top: 1px solid #e2e8f0;
      padding-top: 10px;
      font-size: 9px;
      color: #94a3b8;
      text-align: center;
    }
  </style>
</head>
<body>

  <div class="header">
    <div>
      <h1 class="brand-title">SERP-SCOUT INTELLIGENCE REPORT</h1>
      <div class="tagline">Success is measured by real business outcomes rather than a "visibility score."</div>
    </div>
    <div class="meta-info">
      <strong>${businessName}</strong> (${websiteUrl})<br>
      Report Period: ${periodStart} to ${periodEnd}<br>
      Generated: ${new Date().toLocaleDateString('en-US', { dateStyle: 'medium' })}
    </div>
  </div>

  <div class="section-title">Executive Summary</div>
  <div class="exec-grid">
    <div class="exec-card" style="border-left: 3px solid #3b82f6;">
      <div class="exec-label">Important Market Changes</div>
      <p class="exec-text">${executiveSummary.importantChanges}</p>
    </div>
    <div class="exec-card" style="border-left: 3px solid #10b981;">
      <div class="exec-label">Main Business Opportunity</div>
      <p class="exec-text">${executiveSummary.mainOpportunity}</p>
    </div>
    <div class="exec-card" style="border-left: 3px solid #f43f5e;">
      <div class="exec-label">Primary Competitive Threat</div>
      <p class="exec-text">${executiveSummary.mainCompetitiveThreat}</p>
    </div>
    <div class="exec-card" style="border-left: 3px solid #8b5cf6;">
      <div class="exec-label">Weekly Strategic Focus</div>
      <p class="exec-text">${executiveSummary.weeklyFocus}</p>
    </div>
  </div>

  <div class="section-title">Priority Action Plan (Top Actions)</div>
  <div>
    ${actionPlan.length === 0 ? `
      <div style="padding: 14px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; color: #64748b; font-size: 11px; text-align: center;">
        No priority actions recorded for this cycle.
      </div>
    ` : actionPlan.map((rec) => {
      const pColor = priorityColors[rec.priority] || priorityColors.P1;
      return `
      <div class="rec-card">
        <div class="rec-header">
          <h3 class="rec-title">${rec.title}</h3>
          <span class="badge" style="background: ${pColor.bg}; color: ${pColor.text}; border: 1px solid ${pColor.border};">
            ${rec.priority} Priority
          </span>
        </div>
        <div class="rec-problem"><strong>Problem/Opportunity:</strong> ${rec.problem}</div>
        <div class="rec-evidence"><strong>Observed Evidence:</strong> ${rec.evidenceSummary}</div>
        <div class="rec-meta">
          <span><strong>Impact:</strong> ${(rec.expectedImpact || 'MEDIUM').toUpperCase()}</span>
          <span><strong>Effort:</strong> ${(rec.estimatedEffort || 'MEDIUM').toUpperCase()}</span>
          <span><strong>Owner:</strong> ${rec.suggestedOwner || 'Lead'}</span>
          <span><strong>Deadline:</strong> ${rec.suggestedDeadline || 'Within 7 days'}</span>
        </div>
      </div>
      `;
    }).join('')}
  </div>

  <div class="section-title">Search Visibility & Ranking Shifts</div>
  <table>
    <thead>
      <tr>
        <th>Keyword Phrase</th>
        <th>Previous Rank</th>
        <th>Current Rank</th>
        <th>Position Shift</th>
      </tr>
    </thead>
    <tbody>
      ${(visibilityChanges.keywordChanges || []).length === 0 ? `
        <tr><td colspan="4" style="text-align: center; color: #64748b;">No recent keyword ranking shifts recorded for this period.</td></tr>
      ` : (visibilityChanges.keywordChanges || []).slice(0, 10).map((k) => {
        const delta = (k.oldRank && k.newRank) ? k.oldRank - k.newRank : null;
        const deltaText = delta !== null
          ? delta > 0 ? `+${delta} (Climbed)` : `${delta} (Dropped)`
          : '—';
        return `
        <tr>
          <td><strong>${k.keyword}</strong></td>
          <td>${k.oldRank ? '#' + k.oldRank : '—'}</td>
          <td>${k.newRank ? '#' + k.newRank : '—'}</td>
          <td>${deltaText}</td>
        </tr>
        `;
      }).join('')}
    </tbody>
  </table>

  ${contentOpportunities.length > 0 ? `
  <div class="section-title">Top Content Opportunities</div>
  <table>
    <thead>
      <tr>
        <th>Missing Topic</th>
        <th>Type</th>
        <th>Suggested Title</th>
        <th>Priority</th>
      </tr>
    </thead>
    <tbody>
      ${contentOpportunities.slice(0, 5).map((g) => `
        <tr>
          <td><strong>${g.topic}</strong></td>
          <td>${g.recommendedPageType}</td>
          <td>${g.suggestedTitle}</td>
          <td>${g.priority}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  ` : ''}

  <div class="section-title">Evidence Appendix & Verification Trail</div>
  <table>
    <thead>
      <tr>
        <th>Query Observed</th>
        <th>Source</th>
        <th>Date</th>
        <th>Reference Link</th>
      </tr>
    </thead>
    <tbody>
      ${(evidenceAppendix || []).length === 0 ? `
        <tr><td colspan="4" style="text-align: center; color: #64748b;">No direct evidence trail recorded for this report cycle.</td></tr>
      ` : (evidenceAppendix || []).slice(0, 10).map((item) => `
        <tr>
          <td>${item.query}</td>
          <td>${item.source}</td>
          <td>${item.date}</td>
          <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.url || '—'}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="footer">
    Report generated by Serp-Scout AI Intelligence • Success measured by real business outcomes
  </div>

</body>
</html>`;
}

/**
 * Generates a clean PDF binary buffer from report data using Puppeteer
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
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 15000 });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '15mm',
        bottom: '15mm',
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
  const headers = [
    'Priority',
    'Action Title',
    'Problem / Opportunity',
    'Expected Impact',
    'Estimated Effort',
    'Confidence',
    'Suggested Owner',
    'Suggested Deadline',
    'Evidence Summary',
    'Source URLs',
  ];

  const escapeCsv = (val: any) => {
    const str = String(val ?? '').replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = (report.actionPlan || []).map((rec) => [
    escapeCsv(rec.priority || 'P1'),
    escapeCsv(rec.title),
    escapeCsv(rec.problem),
    escapeCsv(rec.expectedImpact),
    escapeCsv(rec.estimatedEffort),
    escapeCsv(rec.confidence),
    escapeCsv(rec.suggestedOwner || 'Practice Lead'),
    escapeCsv(rec.suggestedDeadline || 'Within 7 days'),
    escapeCsv(rec.evidenceSummary),
    escapeCsv((rec.sourceUrls || []).join('; ')),
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}
