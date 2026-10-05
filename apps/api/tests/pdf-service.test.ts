import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeReport,
  generateReportHtml,
  generateReportCsv,
  generateReportPdf,
} from '../src/services/pdf.service.js';

test('normalizeReport handles full report object', () => {
  const fullReport = {
    executiveSummary: {
      importantChanges: 'Changes observed',
      mainOpportunity: 'Target keywords',
      mainCompetitiveThreat: 'Competitor X',
      weeklyFocus: 'Content push',
    },
    actionPlan: [
      {
        title: 'Action 1',
        problem: 'Problem 1',
        evidenceSummary: 'Evidence 1',
        priority: 'P0' as const,
        expectedImpact: 'high' as const,
        estimatedEffort: 'low' as const,
        confidence: 'high' as const,
        suggestedOwner: 'Lead',
        suggestedDeadline: '7 days',
        searchQueries: ['query 1'],
        sourceUrls: ['https://example.com'],
        implementationSteps: ['step 1'],
      },
    ],
    visibilityChanges: {
      keywordChanges: [{ keyword: 'test', oldRank: 5, newRank: 2 }],
      mapsChanges: [],
      serpFeatureChanges: [],
    },
    competitorChanges: ['Rival improved'],
    contentOpportunities: [
      {
        topic: 'New Topic',
        competitorDomain: 'rival.com',
        competitorUrl: 'https://rival.com',
        recommendedPageType: 'service' as const,
        suggestedTitle: 'Service Page',
        suggestedHeadings: ['H1', 'H2'],
        suggestedFaqs: ['FAQ 1'],
        targetIntent: 'commercial' as const,
        estimatedImpact: 'high' as const,
        estimatedEffort: 'low' as const,
        priority: 'P0' as const,
        evidenceUrls: ['https://rival.com'],
      },
    ],
    evidenceAppendix: [
      {
        query: 'dentist austin',
        source: 'Google SERP',
        date: '2026-10-01',
        url: 'https://google.com',
      },
    ],
  };

  const normalized = normalizeReport(fullReport);
  assert.equal(normalized.executiveSummary.importantChanges, 'Changes observed');
  assert.equal(normalized.actionPlan.length, 1);
  assert.equal(normalized.visibilityChanges.keywordChanges.length, 1);
  assert.equal(normalized.contentOpportunities.length, 1);
  assert.equal(normalized.evidenceAppendix.length, 1);
});

test('normalizeReport handles legacy/executive-only report object without throwing', () => {
  const legacyReport = {
    weeklyFocus: 'Weekly goal',
    mainOpportunity: 'Opportunity 1',
    importantChanges: 'Changes 1',
    mainCompetitiveThreat: 'Threat 1',
  };

  const normalized = normalizeReport(legacyReport);
  assert.equal(normalized.executiveSummary.weeklyFocus, 'Weekly goal');
  assert.equal(normalized.executiveSummary.importantChanges, 'Changes 1');
  assert.equal(normalized.actionPlan.length, 0);
  assert.equal(normalized.visibilityChanges.keywordChanges.length, 0);
  assert.equal(normalized.contentOpportunities.length, 0);
  assert.equal(normalized.evidenceAppendix.length, 0);
});

test('generateReportHtml and generateReportCsv handle legacy report without throwing', () => {
  const legacyData = {
    businessName: 'Austin Dental Clinic',
    websiteUrl: 'https://austindental.example.com',
    periodStart: '2026-09-20',
    periodEnd: '2026-09-27',
    report: {
      weeklyFocus: 'Weekly focus text',
      mainOpportunity: 'Opportunity text',
      importantChanges: 'Changes text',
      mainCompetitiveThreat: 'Threat text',
    } as any,
  };

  const html = generateReportHtml(legacyData);
  assert.ok(html.includes('Austin Dental Clinic'));
  assert.ok(html.includes('Changes text'));
  assert.ok(html.includes('No priority actions recorded'));

  const csv = generateReportCsv(legacyData);
  assert.ok(csv.includes('Priority,Action Title'));
});

test('generateReportPdf creates valid PDF buffer with %PDF header', async () => {
  const data = {
    businessName: 'Austin Dental Clinic',
    websiteUrl: 'https://austindental.example.com',
    periodStart: '2026-09-20',
    periodEnd: '2026-09-27',
    report: {
      weeklyFocus: 'Weekly focus text',
      mainOpportunity: 'Opportunity text',
      importantChanges: 'Changes text',
      mainCompetitiveThreat: 'Threat text',
    } as any,
  };

  const pdfBuffer = await generateReportPdf(data);
  assert.ok(Buffer.isBuffer(pdfBuffer));
  assert.ok(pdfBuffer.length > 1000);
  assert.equal(pdfBuffer.subarray(0, 4).toString('utf-8'), '%PDF');
});
