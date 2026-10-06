'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchApiJson } from '@/lib/http';
import {
  Sparkles,
  FileText,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  CheckSquare,
  Square,
  TrendingUp,
  MapPin,
  Calendar,
  Layers,
  ArrowRight,
} from 'lucide-react';

interface SharedDataPayload {
  share: {
    token: string;
    viewMode: 'executive' | 'specialist';
    expiresAt?: string;
  };
  report: {
    id: string;
    periodStart: string;
    periodEnd: string;
    summary: {
      executiveSummary: {
        importantChanges: string;
        mainOpportunity: string;
        mainCompetitiveThreat: string;
        weeklyFocus: string;
      };
      visibilityChanges?: {
        keywordChanges?: Array<{ keyword: string; oldRank?: number; newRank?: number }>;
        mapsChanges?: Array<{ business: string; change: string }>;
        serpFeatureChanges?: string[];
      };
      actionPlan: Array<{
        title: string;
        problem: string;
        evidenceSummary: string;
        expectedImpact: string;
        estimatedEffort: string;
        priority: string;
        confidence: string;
        implementationSteps?: string[];
      }>;
      evidenceAppendix?: Array<{
        query: string;
        source: string;
        date: string;
        url?: string;
      }>;
    };
  };
  business: {
    id: string;
    name: string;
    websiteUrl: string;
    city?: string;
  };
  recommendations: Array<{
    id: string;
    title: string;
    description: string;
    priority: string;
    impact: string;
    effort: string;
    confidence: string;
    status: string;
    checklist?: {
      steps: string[];
      completed: boolean[];
    };
  }>;
  evidence?: Array<{
    id: string;
    sourceUrl: string;
    sourceTitle: string;
    claim: string;
  }>;
}

export default function SharedReportPage({ params }: { params: { token: string } }) {
  const [data, setData] = useState<SharedDataPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeMode, setActiveMode] = useState<'executive' | 'specialist'>('executive');

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  useEffect(() => {
    async function fetchSharedReport() {
      try {
        setLoading(true);
        // Defensive parse: a restarting API answers with plain text, which must
        // not be reported to the visitor as an invalid or expired link.
        const result = await fetchApiJson<{
          share: { viewMode?: 'executive' | 'specialist' };
          [key: string]: unknown;
        }>(`${apiUrl}/api/shared/${params.token}`, { retries: 1 });

        if (!result.ok || !result.data) {
          if (result.status === 410) {
            throw new Error('This shared report link has expired.');
          }
          if (result.nonJson) {
            throw new Error(result.error || 'The report service is not reachable right now.');
          }
          throw new Error(result.error || 'Report not found or link is invalid.');
        }

        setData(result.data as any);
        setActiveMode((result.data.share?.viewMode as 'executive' | 'specialist') || 'executive');
      } catch (err: any) {
        setError(err.message || 'Failed to load shared report');
      } finally {
        setLoading(false);
      }
    }
    fetchSharedReport();
  }, [params.token, apiUrl]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4" />
        <h2 className="text-base font-bold text-slate-800">Loading Intelligence Report...</h2>
        <p className="text-xs text-slate-500 mt-1">Verifying encrypted token access</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm max-w-md w-full space-y-4">
          <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Access Restricted</h2>
          <p className="text-xs text-slate-600 leading-relaxed">{error || 'Unable to view this report.'}</p>
          <div className="pt-2">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition"
            >
              <span>Go to Serp-Scout</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { report, business, recommendations, share } = data;
  const summary = report.summary;
  const exec = summary?.executiveSummary || summary;
  const canToggleMode = share.viewMode === 'specialist';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top Banner */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-2xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-black text-sm shadow-xs">
              S
            </div>
            <div>
              <span className="font-extrabold text-sm tracking-tight text-slate-900">SERP-SCOUT</span>
              <span className="ml-2 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                Verified Client Brief
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {canToggleMode && (
              <div className="flex items-center p-0.5 rounded-lg bg-slate-100 border border-slate-200 text-xs">
                <button
                  onClick={() => setActiveMode('executive')}
                  className={`px-3 py-1 rounded-md font-semibold transition ${
                    activeMode === 'executive'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Executive View
                </button>
                <button
                  onClick={() => setActiveMode('specialist')}
                  className={`px-3 py-1 rounded-md font-semibold transition ${
                    activeMode === 'specialist'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Specialist View
                </button>
              </div>
            )}

            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 transition shadow-2xs"
            >
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              <span>Print / Save PDF</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto p-4 sm:p-8 space-y-8 animate-fade-in">
        {/* Header Hero Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600">
              <Calendar className="w-4 h-4" />
              <span>
                Weekly Intelligence Period: {report.periodStart.split('T')[0]} to {report.periodEnd.split('T')[0]}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {business.name} • Competitive Intelligence & Action Plan
            </h1>
            <p className="text-xs text-slate-500 flex items-center gap-2">
              <span>{business.websiteUrl}</span>
              {business.city && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    {business.city} Market
                  </span>
                </>
              )}
            </p>
          </div>

          <div className="shrink-0 bg-indigo-50/70 border border-indigo-100 rounded-xl p-4 text-center sm:text-right">
            <div className="text-[10px] uppercase font-bold text-indigo-900">Audited Strategy</div>
            <div className="text-base font-extrabold text-indigo-700 mt-0.5">
              {recommendations.length} Prioritized Outcomes
            </div>
            <div className="text-[11px] text-indigo-950/70 mt-1 font-medium">
              Zero vanity scores • Verified local demand
            </div>
          </div>
        </div>

        {/* 4-Grid Executive Callouts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs border-l-4 border-l-blue-500 space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" />
              Important Market Changes
            </span>
            <p className="text-xs text-slate-800 font-medium leading-relaxed">
              {exec?.importantChanges || 'SERP visibility remained active across target local commercial queries.'}
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs border-l-4 border-l-emerald-500 space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Main Business Opportunity
            </span>
            <p className="text-xs text-slate-800 font-medium leading-relaxed">
              {exec?.mainOpportunity || 'Expand high-intent service keywords to capture local customer demand.'}
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs border-l-4 border-l-rose-500 space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              Main Competitive Threat
            </span>
            <p className="text-xs text-slate-800 font-medium leading-relaxed">
              {exec?.mainCompetitiveThreat || 'Local competitors are aggressively optimizing local pack rankings.'}
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs border-l-4 border-l-indigo-500 space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" />
              Weekly Strategic Focus
            </span>
            <p className="text-xs text-slate-800 font-medium leading-relaxed">
              {exec?.weeklyFocus || 'Execute high-impact content and local SEO optimizations.'}
            </p>
          </div>
        </div>

        {/* Prioritized Action Plan with Sub-Task Steps */}
        <section className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>Priority Action Plan</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                  {recommendations.length} Actions
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Concrete, high-ROI tasks prioritized from P0 (immediate wins) to P3.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {recommendations.map((rec, idx) => {
              const checklist = rec.checklist || {
                steps: [
                  'Review competitor positioning on target commercial query',
                  'Publish targeted on-page content with structured schema',
                  'Verify indexing and validate rank trajectory',
                ],
                completed: [false, false, false],
              };

              return (
                <div
                  key={rec.id}
                  className="rounded-xl border border-slate-200 bg-slate-50/60 p-5 space-y-4 hover:border-slate-300 transition"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                          rec.priority === 'P0'
                            ? 'bg-rose-100 text-rose-800 border-rose-200'
                            : rec.priority === 'P1'
                            ? 'bg-indigo-100 text-indigo-800 border-indigo-200'
                            : 'bg-amber-100 text-amber-800 border-amber-200'
                        }`}
                      >
                        {rec.priority} Priority
                      </span>
                      <h3 className="text-sm font-bold text-slate-900">
                        #{idx + 1} {rec.title}
                      </h3>
                    </div>

                    <span
                      className={`self-start sm:self-auto px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        rec.status === 'completed'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : rec.status === 'in_progress'
                          ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                          : 'bg-white text-slate-600 border border-slate-200'
                      }`}
                    >
                      {rec.status.replace('_', ' ')}
                    </span>
                  </div>

                  <p className="text-xs text-slate-700 leading-relaxed">
                    <strong className="text-slate-900">Strategic Target:</strong> {rec.description}
                  </p>

                  {/* Sub-Task Checklist */}
                  <div className="bg-white rounded-xl border border-slate-200/80 p-4 space-y-2.5">
                    <div className="text-[11px] font-bold text-slate-800 flex items-center justify-between">
                      <span>Implementation Checklist</span>
                      <span className="text-[10px] text-slate-500 font-semibold">
                        {checklist.completed?.filter(Boolean).length || 0} of {checklist.steps?.length || 0} Completed
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {checklist.steps?.map((step, sIdx) => {
                        const isDone = checklist.completed?.[sIdx];
                        return (
                          <div
                            key={sIdx}
                            className={`flex items-start gap-2.5 text-xs p-2 rounded-lg ${
                              isDone ? 'bg-emerald-50/50 text-slate-500' : 'text-slate-700'
                            }`}
                          >
                            <div className="pt-0.5 shrink-0">
                              {isDone ? (
                                <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Square className="w-3.5 h-3.5 text-slate-300" />
                              )}
                            </div>
                            <span className={isDone ? 'line-through text-slate-500' : 'font-medium'}>
                              {step}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Meta metrics */}
                  <div className="flex items-center gap-4 text-[11px] text-slate-500 pt-1 border-t border-slate-200/60">
                    <span>
                      Impact: <strong className="text-slate-700 uppercase">{rec.impact}</strong>
                    </span>
                    <span>
                      Effort: <strong className="text-slate-700 uppercase">{rec.effort}</strong>
                    </span>
                    <span>
                      Confidence: <strong className="text-slate-700 uppercase">{rec.confidence}</strong>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Specialist Mode: Evidence Appendix & Citation Trail */}
        {activeMode === 'specialist' && summary.evidenceAppendix && summary.evidenceAppendix.length > 0 && (
          <section className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  <span>Technical Evidence Appendix & Audit Trail</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Direct search query logs and ground-truth citations verifying each recommendation.
                </p>
              </div>
              <span className="text-[11px] font-semibold text-slate-400">
                {summary.evidenceAppendix.length} Citations
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-100 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 text-[10px] uppercase font-bold">
                    <th className="py-2.5 px-3">Search Query</th>
                    <th className="py-2.5 px-3">Provider</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Evidence URL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[11px]">
                  {summary.evidenceAppendix.slice(0, 15).map((ev, i) => (
                    <tr key={i} className="hover:bg-slate-50/80">
                      <td className="py-2.5 px-3 font-semibold text-slate-900">{ev.query}</td>
                      <td className="py-2.5 px-3 text-slate-500">{ev.source}</td>
                      <td className="py-2.5 px-3 text-slate-400 font-mono text-[10px]">{ev.date}</td>
                      <td className="py-2.5 px-3 text-indigo-600 truncate max-w-[240px]">
                        {ev.url ? (
                          <a href={ev.url} target="_blank" rel="noreferrer" className="hover:underline flex items-center gap-1">
                            <span className="truncate">{ev.url}</span>
                            <ExternalLink className="w-3 h-3 shrink-0 text-slate-400" />
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Footer info */}
        <footer className="text-center text-xs text-slate-400 py-6 space-y-1">
          <p>
            Powered by <strong>Serp-Scout</strong> • Autonomous SEO & Competitive Intelligence
          </p>
          <p className="text-[11px]">
            Success is measured by real business outcomes rather than a &quot;visibility score.&quot;
          </p>
        </footer>
      </main>
    </div>
  );
}
