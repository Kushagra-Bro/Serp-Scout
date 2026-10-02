'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { apiClient } from '@/lib/api';
import {
  Sparkles,
  FileText,
  Download,
  X,
  Share2,
  CheckSquare,
  Square,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Copy,
  Check,
  TrendingUp,
  ShieldAlert,
  Layers,
  Calendar,
  MapPin,
  ArrowRight,
} from 'lucide-react';
import { GeneratedReport } from '@serp-scout/types';

interface BusinessSummary {
  id: string;
  name: string;
  websiteUrl: string;
  city?: string;
}

interface ReportRecord {
  id: string;
  businessId: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  generatedAt: string;
  summary: GeneratedReport;
}

interface RecommendationRecord {
  id: string;
  reportId: string;
  title: string;
  description: string;
  evidence: {
    summary: string;
    queries?: string[];
    urls?: string[];
  };
  impact: string;
  effort: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  confidence: string;
  status: 'planned' | 'in_progress' | 'completed' | 'dismissed';
  checklist?: {
    steps: string[];
    completed: boolean[];
  };
}

interface FullReportDetails {
  report: ReportRecord;
  business: BusinessSummary;
  recommendations: RecommendationRecord[];
  evidence: Array<{
    id: string;
    sourceUrl: string;
    sourceTitle: string;
    claim: string;
  }>;
}

interface MarketAlertRecord {
  id: string;
  businessId: string;
  type: string;
  severity: 'critical' | 'high' | 'medium';
  title: string;
  description: string;
  details?: Record<string, any>;
  dismissed: boolean;
  detectedAt: string;
}

interface ShareData {
  shareUrl: string;
  viewMode: 'executive' | 'specialist';
  expiresAt?: string;
  isExpired?: boolean;
}

export default function ReportsPage() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [businesses, setBusinesses] = useState<BusinessSummary[]>([]);
  const [selectedBizId, setSelectedBizId] = useState<string>('');

  const [reportsList, setReportsList] = useState<ReportRecord[]>([]);
  const [activeReportDetails, setActiveReportDetails] = useState<FullReportDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingCsv, setDownloadingCsv] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Emergency Market Alerts
  const [alerts, setAlerts] = useState<MarketAlertRecord[]>([]);
  const [dismissingAlertId, setDismissingAlertId] = useState<string | null>(null);

  // Outcome Tracking Cache & Expansion
  const [outcomes, setOutcomes] = useState<
    Record<string, { outcomes: any[]; outcomeSummary: string; loading?: boolean }>
  >({});
  const [expandedOutcomes, setExpandedOutcomes] = useState<Record<string, boolean>>({});

  // Share Modal & Link Management
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareData, setShareData] = useState<ShareData | null>(null);
  const [sharingLoading, setSharingLoading] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [selectedViewMode, setSelectedViewMode] = useState<'executive' | 'specialist'>('executive');

  // Immediate client-side hydration from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('serp_scout_cached_businesses');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setBusinesses(parsed);
            const cachedBizId = localStorage.getItem('serp_scout_active_biz_id');
            const targetId = cachedBizId && parsed.some((b: any) => b.id === cachedBizId)
              ? cachedBizId
              : parsed[0].id;
            setSelectedBizId(targetId);
          }
        }
      } catch (e) {}
    }
  }, []);

  // Load businesses
  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) return;

    async function loadBusinesses() {
      try {
        const token = await getToken();
        if (!token) return;
        const list = await apiClient<BusinessSummary[]>('/api/businesses', { token });
        setBusinesses(list);
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('serp_scout_cached_businesses', JSON.stringify(list));
          } catch (e) {}
        }
        if (list.length > 0) {
          const cachedBizId = typeof window !== 'undefined' ? localStorage.getItem('serp_scout_active_biz_id') : null;
          const targetId = cachedBizId && list.some((b) => b.id === cachedBizId)
            ? cachedBizId
            : list[0].id;
          setSelectedBizId(targetId);
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem('serp_scout_active_biz_id', targetId);
            } catch (e) {}
          }
        }
      } catch (err: any) {
        console.error('Failed to load businesses:', err);
      }
    }
    loadBusinesses();
  }, [isLoaded, isSignedIn, getToken]);

  const autoTriggeredReportRef = React.useRef<Set<string>>(new Set());

  // Instant cache retrieval on business change
  useEffect(() => {
    if (!selectedBizId || typeof window === 'undefined') return;
    try {
      const cached = localStorage.getItem(`report_active_${selectedBizId}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.id) {
          setActiveReportDetails(parsed);
        }
      }
    } catch (e) {
      console.error('Failed to read report cache:', e);
    }
  }, [selectedBizId]);

  // Load active emergency alerts for selected business
  const loadAlerts = useCallback(
    async (bizId: string) => {
      if (!bizId) return;
      try {
        const token = await getToken();
        if (!token) return;
        const alertList = await apiClient<MarketAlertRecord[]>(`/api/businesses/${bizId}/alerts`, {
          token,
        });
        setAlerts(alertList || []);
      } catch (e) {
        console.warn('Failed to load market alerts:', e);
      }
    },
    [getToken]
  );

  useEffect(() => {
    if (selectedBizId) {
      loadAlerts(selectedBizId);
    }
  }, [selectedBizId, loadAlerts]);

  // Load single report details
  const loadReportDetails = useCallback(
    async (reportId: string) => {
      try {
        const token = await getToken();
        if (!token) return;
        const details = await apiClient<FullReportDetails>(`/api/reports/${reportId}`, { token });
        setActiveReportDetails(details);
        try {
          localStorage.setItem(`report_active_${selectedBizId}`, JSON.stringify(details));
        } catch {}
      } catch (err: any) {
        console.error('Failed to load report details:', err);
      }
    },
    [selectedBizId, getToken]
  );

  // Generate fresh report
  const handleGenerateReport = useCallback(
    async (targetBizId?: string) => {
      const bizId = targetBizId || selectedBizId;
      if (!bizId) return;
      setGenerating(true);
      setError(null);
      setSuccessMsg(null);
      try {
        const token = await getToken();
        if (!token) return;
        await apiClient(`/api/businesses/${bizId}/reports/generate`, {
          method: 'POST',
          token,
        });
        setSuccessMsg('Fresh Weekly Intelligence Report and Prioritized Action Plan generated!');
        const list = await apiClient<ReportRecord[]>(`/api/businesses/${bizId}/reports`, { token });
        setReportsList(list);
        if (list.length > 0) {
          await loadReportDetails(list[0].id);
        }
        await loadAlerts(bizId);
      } catch (err: any) {
        console.error('Failed to generate report:', err);
        setError(err.message || 'Failed to generate report');
      } finally {
        setGenerating(false);
      }
    },
    [selectedBizId, getToken, loadReportDetails, loadAlerts]
  );

  // Load report history
  const loadReports = useCallback(async () => {
    if (!selectedBizId) return;
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) return;
      const list = await apiClient<ReportRecord[]>(`/api/businesses/${selectedBizId}/reports`, {
        token,
      });
      setReportsList(list);
      if (list.length > 0) {
        loadReportDetails(list[0].id);
      } else {
        setActiveReportDetails(null);
        if (!autoTriggeredReportRef.current.has(selectedBizId)) {
          autoTriggeredReportRef.current.add(selectedBizId);
          handleGenerateReport(selectedBizId);
        }
      }
    } catch (err: any) {
      console.error('Failed to load reports:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedBizId, getToken, loadReportDetails, handleGenerateReport]);

  useEffect(() => {
    loadReports();
  }, [selectedBizId, loadReports]);

  // Dismiss emergency market shift alert
  const handleDismissAlert = async (alertId: string) => {
    if (!selectedBizId) return;
    setDismissingAlertId(alertId);
    try {
      const token = await getToken();
      if (!token) return;
      await apiClient(`/api/businesses/${selectedBizId}/alerts/${alertId}/dismiss`, {
        method: 'PATCH',
        token,
      });
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    } catch (e) {
      console.warn('Failed to dismiss alert:', e);
    } finally {
      setDismissingAlertId(null);
    }
  };

  // Toggle sub-task implementation checklist item
  const handleToggleChecklistStep = async (
    recId: string,
    stepIndex: number,
    currentVal: boolean
  ) => {
    try {
      const token = await getToken();
      if (!token) return;

      // Optimistic update
      if (activeReportDetails) {
        setActiveReportDetails({
          ...activeReportDetails,
          recommendations: activeReportDetails.recommendations.map((r) => {
            if (r.id === recId) {
              const currentCompleted = [
                ...(r.checklist?.completed || [false, false, false]),
              ];
              currentCompleted[stepIndex] = !currentVal;
              const allDone = currentCompleted.every(Boolean);
              return {
                ...r,
                status: allDone ? 'completed' : r.status === 'planned' ? 'in_progress' : r.status,
                checklist: {
                  steps: r.checklist?.steps || ['Step 1', 'Step 2', 'Step 3'],
                  completed: currentCompleted,
                },
              };
            }
            return r;
          }),
        });
      }

      await apiClient(`/api/recommendations/${recId}/checklist`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({
          stepIndex,
          completed: !currentVal,
        }),
      });
    } catch (err: any) {
      console.error('Failed to toggle checklist step:', err);
    }
  };

  // Toggle and load outcome tracking data
  const handleToggleOutcome = async (recId: string) => {
    const isExpanded = expandedOutcomes[recId];
    setExpandedOutcomes((prev) => ({ ...prev, [recId]: !isExpanded }));

    if (!isExpanded && !outcomes[recId]) {
      setOutcomes((prev) => ({
        ...prev,
        [recId]: { outcomes: [], outcomeSummary: 'Analyzing SERP rank observations...', loading: true },
      }));
      try {
        const token = await getToken();
        if (!token) return;
        const res = await apiClient<{ outcomes: any[]; outcomeSummary: string }>(
          `/api/recommendations/${recId}/outcome`,
          { token }
        );
        setOutcomes((prev) => ({ ...prev, [recId]: { ...res, loading: false } }));
      } catch (err: any) {
        setOutcomes((prev) => ({
          ...prev,
          [recId]: {
            outcomes: [],
            outcomeSummary: 'Baseline established. Ranking delta will update on upcoming audit sweep.',
            loading: false,
          },
        }));
      }
    }
  };

  // Share modal handlers
  const handleOpenShareModal = async () => {
    if (!activeReportDetails) return;
    setShareModalOpen(true);
    setSharingLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const existing = await apiClient<{ share: any; shareUrl: string }>(
        `/api/reports/${activeReportDetails.report.id}/share`,
        { token }
      );
      if (existing && existing.shareUrl) {
        setShareData({
          shareUrl: existing.shareUrl,
          viewMode: existing.share.viewMode,
          expiresAt: existing.share.expiresAt,
        });
        setSelectedViewMode(existing.share.viewMode);
      } else {
        setShareData(null);
      }
    } catch (e) {
      console.warn('Failed to load share status:', e);
    } finally {
      setSharingLoading(false);
    }
  };

  const handleCreateShareLink = async () => {
    if (!activeReportDetails) return;
    setSharingLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await apiClient<{ share: any; shareUrl: string }>(
        `/api/reports/${activeReportDetails.report.id}/share`,
        {
          method: 'POST',
          token,
          body: JSON.stringify({
            viewMode: selectedViewMode,
            expiresDays: 30,
          }),
        }
      );
      if (res && res.shareUrl) {
        setShareData({
          shareUrl: res.shareUrl,
          viewMode: res.share.viewMode,
          expiresAt: res.share.expiresAt,
        });
      }
    } catch (e) {
      console.error('Failed to generate share link:', e);
    } finally {
      setSharingLoading(false);
    }
  };

  const handleRevokeShareLink = async () => {
    if (!activeReportDetails) return;
    setSharingLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      await apiClient(`/api/reports/${activeReportDetails.report.id}/share`, {
        method: 'DELETE',
        token,
      });
      setShareData(null);
    } catch (e) {
      console.error('Failed to revoke share link:', e);
    } finally {
      setSharingLoading(false);
    }
  };

  const handleCopyShareLink = () => {
    if (!shareData?.shareUrl) return;
    navigator.clipboard.writeText(shareData.shareUrl);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  };

  // Update recommendation status
  const handleUpdateRecStatus = async (
    recId: string,
    status: 'planned' | 'in_progress' | 'completed' | 'dismissed'
  ) => {
    try {
      const token = await getToken();
      if (!token) return;
      await apiClient(`/api/recommendations/${recId}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ status }),
      });
      if (activeReportDetails) {
        setActiveReportDetails({
          ...activeReportDetails,
          recommendations: activeReportDetails.recommendations.map((r) =>
            r.id === recId ? { ...r, status } : r
          ),
        });
      }
    } catch (err: any) {
      console.error('Failed to update recommendation status:', err);
    }
  };

  // Download PDF
  const handleDownloadPdf = async () => {
    if (!activeReportDetails) return;
    setDownloadingPdf(true);
    try {
      const token = await getToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const res = await fetch(`${apiUrl}/api/reports/${activeReportDetails.report.id}/pdf`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error('PDF download failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `serp-scout-report-${activeReportDetails.report.periodEnd.split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err: any) {
      console.error('PDF error:', err);
      setError('Could not download PDF. Please try again.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  // Download CSV
  const handleDownloadCsv = async () => {
    if (!activeReportDetails) return;
    setDownloadingCsv(true);
    try {
      const token = await getToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const res = await fetch(`${apiUrl}/api/reports/${activeReportDetails.report.id}/csv`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error('CSV download failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `serp-scout-actions-${activeReportDetails.report.periodEnd.split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err: any) {
      console.error('CSV error:', err);
      setError('Could not export CSV. Please try again.');
    } finally {
      setDownloadingCsv(false);
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'P0':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'P1':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'P2':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Executive Reports & Action Plans
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Prioritized 3 to 5 high-impact actions with sub-task checklists, outcome tracking, and white-label client sharing.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {businesses.length > 1 && (
            <select
              value={selectedBizId}
              onChange={(e) => {
                const newId = e.target.value;
                setSelectedBizId(newId);
                if (typeof window !== 'undefined') {
                  try {
                    localStorage.setItem('serp_scout_active_biz_id', newId);
                  } catch (err) {}
                }
              }}
              className="text-xs font-semibold border border-slate-300 rounded-xl px-3 py-2 bg-white text-slate-700 shadow-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {businesses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={() => handleGenerateReport()}
            disabled={generating || !selectedBizId}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 text-white hover:opacity-95 shadow-sm transition-all disabled:opacity-50"
          >
            {generating ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
                Synthesizing Report...
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Generate Weekly Report</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Emergency Market Shift Alerts Banner */}
      {alerts.length > 0 && (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`rounded-2xl p-4 sm:p-5 border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all shadow-xs ${
                alert.severity === 'critical'
                  ? 'bg-rose-50/90 border-rose-300 text-rose-950'
                  : 'bg-amber-50/90 border-amber-300 text-amber-950'
              }`}
            >
              <div className="flex items-start gap-3.5">
                <div
                  className={`p-2 rounded-xl shrink-0 ${
                    alert.severity === 'critical'
                      ? 'bg-rose-200/80 text-rose-800'
                      : 'bg-amber-200/80 text-amber-800'
                  }`}
                >
                  <ShieldAlert className="w-5 h-5 animate-pulse" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                        alert.severity === 'critical'
                          ? 'bg-rose-600 text-white'
                          : 'bg-amber-600 text-white'
                      }`}
                    >
                      {alert.severity} Market Alert
                    </span>
                    <h4 className="text-xs font-bold">{alert.title}</h4>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {new Date(alert.detectedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-xs opacity-90 leading-relaxed max-w-3xl">
                    {alert.description}
                  </p>
                </div>
              </div>

              <button
                onClick={() => handleDismissAlert(alert.id)}
                disabled={dismissingAlertId === alert.id}
                className="self-end sm:self-center px-3 py-1.5 rounded-lg bg-white/90 hover:bg-white text-xs font-semibold text-slate-700 border border-slate-200 transition shrink-0 shadow-2xs disabled:opacity-50"
              >
                {dismissingAlertId === alert.id ? 'Dismissing...' : 'Dismiss Alert'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Notifications */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700 ml-2">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-lg text-sm flex items-center justify-between">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-600 hover:text-emerald-800 ml-2">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Grid: Left sidebar (Report History) + Right content (Full Report) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left column: History */}
        <div className="lg:col-span-1 space-y-3">
          <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Report Archive</h2>
          {loading ? (
            <div className="p-4 text-center text-xs text-slate-400">Loading reports...</div>
          ) : reportsList.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-6 text-center text-xs text-slate-500 shadow-sm">
              <p>No reports generated yet.</p>
              <button
                onClick={() => handleGenerateReport()}
                disabled={generating}
                className="mt-3 px-3 py-1.5 bg-indigo-600 text-white rounded-md text-[11px] font-semibold hover:bg-indigo-700 shadow-sm"
              >
                Generate First Report
              </button>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[600px] overflow-y-auto">
              {reportsList.map((rep) => {
                const isActive = activeReportDetails?.report.id === rep.id;
                const dateStr = `${new Date(rep.periodStart).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })} - ${new Date(rep.periodEnd).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}`;

                return (
                  <button
                    key={rep.id}
                    onClick={() => loadReportDetails(rep.id)}
                    className={`w-full text-left p-3 rounded-xl border transition-all ${
                      isActive
                        ? 'bg-indigo-50/70 border-indigo-200 shadow-sm'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-slate-900">{dateStr}</span>
                      <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[9px] font-bold uppercase">
                        {rep.status}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1 line-clamp-1">
                      {rep.summary?.executiveSummary?.weeklyFocus || 'Weekly Action Plan'}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right column: Active Report View */}
        <div className="lg:col-span-3">
          {activeReportDetails ? (
            <div className="space-y-6">
              {/* Report Header Card */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded text-xs font-bold uppercase">
                      Weekly Intelligence
                    </span>
                    <span className="text-xs text-slate-400">
                      Period: {activeReportDetails.report.periodStart.split('T')[0]} to{' '}
                      {activeReportDetails.report.periodEnd.split('T')[0]}
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-slate-900 mt-1">
                    {activeReportDetails.business.name} • Outcomes Report
                  </h2>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={handleOpenShareModal}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-colors"
                  >
                    <Share2 className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Share Report</span>
                  </button>
                  <button
                    onClick={handleDownloadPdf}
                    disabled={downloadingPdf}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition-colors disabled:opacity-50"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>{downloadingPdf ? 'Rendering PDF...' : 'Download PDF'}</span>
                  </button>
                  <button
                    onClick={handleDownloadCsv}
                    disabled={downloadingCsv}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{downloadingCsv ? 'Exporting...' : 'Export CSV'}</span>
                  </button>
                </div>
              </div>

              {/* Executive Summary 4-Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm border-l-4 border-l-blue-500">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 block">
                    Important Market Changes
                  </span>
                  <p className="text-xs text-slate-800 mt-1 font-medium">
                    {activeReportDetails.report.summary?.executiveSummary?.importantChanges}
                  </p>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm border-l-4 border-l-emerald-500">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 block">
                    Main Business Opportunity
                  </span>
                  <p className="text-xs text-slate-800 mt-1 font-medium">
                    {activeReportDetails.report.summary?.executiveSummary?.mainOpportunity}
                  </p>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm border-l-4 border-l-rose-500">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 block">
                    Competitive Threat
                  </span>
                  <p className="text-xs text-slate-800 mt-1 font-medium">
                    {activeReportDetails.report.summary?.executiveSummary?.mainCompetitiveThreat}
                  </p>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm border-l-4 border-l-purple-500">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 block">
                    Weekly Strategic Focus
                  </span>
                  <p className="text-xs text-slate-800 mt-1 font-medium">
                    {activeReportDetails.report.summary?.executiveSummary?.weeklyFocus}
                  </p>
                </div>
              </div>

              {/* Action Plan (Top 3 to 5 Prioritized Actions with Implementation Checklists) */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Priority Action Plan (3 to 5 Actions)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Ranked by return on effort: P0 (immediate wins) to P3. Complete sub-tasks to unlock measurable SERP wins.
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-slate-500">
                    {activeReportDetails.recommendations.length} Actions
                  </span>
                </div>

                <div className="space-y-4">
                  {activeReportDetails.recommendations.map((rec) => {
                    const checklist = rec.checklist || {
                      steps: [
                        'Review competitor positioning on target commercial query',
                        'Draft and publish targeted copy addressing core consumer friction',
                        'Add LocalBusiness schema markup and request Google indexing',
                      ],
                      completed: [false, false, false],
                    };
                    const completedSteps = checklist.completed?.filter(Boolean).length || 0;
                    const totalSteps = checklist.steps?.length || 3;
                    const progressPercent = Math.round((completedSteps / totalSteps) * 100);
                    const outcomeData = outcomes[rec.id];
                    const isOutcomeExpanded = expandedOutcomes[rec.id];

                    return (
                      <div
                        key={rec.id}
                        className="p-5 rounded-2xl border border-slate-200 bg-slate-50/40 hover:bg-slate-50/80 transition-all space-y-3.5 shadow-2xs"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`px-2 py-0.5 text-[10px] font-bold rounded border uppercase ${getPriorityBadge(
                                rec.priority
                              )}`}
                            >
                              {rec.priority} Priority
                            </span>
                            <h4 className="font-bold text-slate-900 text-sm">{rec.title}</h4>
                          </div>

                          <select
                            value={rec.status}
                            onChange={(e) => handleUpdateRecStatus(rec.id, e.target.value as any)}
                            className={`text-[11px] font-semibold border rounded-lg px-2 py-1 ${
                              rec.status === 'completed'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : rec.status === 'in_progress'
                                ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                                : 'bg-white text-slate-700 border-slate-200'
                            }`}
                          >
                            <option value="planned">Planned</option>
                            <option value="in_progress">In Progress</option>
                            <option value="completed">Completed</option>
                            <option value="dismissed">Dismissed</option>
                          </select>
                        </div>

                        <p className="text-xs text-slate-700">
                          <strong>Problem / Target:</strong> {rec.description}
                        </p>

                        {/* Interactive Step-by-Step Implementation Checklist */}
                        <div className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-2.5 shadow-2xs">
                          <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                            <span className="flex items-center gap-1.5">
                              <CheckSquare className="w-3.5 h-3.5 text-indigo-600" />
                              <span>Execution Checklist</span>
                            </span>
                            <span className="text-[10px] text-slate-500 font-semibold">
                              {completedSteps} / {totalSteps} Done ({progressPercent}%)
                            </span>
                          </div>

                          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                              style={{ width: `${progressPercent}%` }}
                            />
                          </div>

                          <div className="space-y-1.5 pt-1">
                            {checklist.steps?.map((step, sIdx) => {
                              const isChecked = Boolean(checklist.completed?.[sIdx]);
                              return (
                                <div
                                  key={sIdx}
                                  onClick={() => handleToggleChecklistStep(rec.id, sIdx, isChecked)}
                                  className={`flex items-start gap-2.5 p-2 rounded-lg text-xs cursor-pointer select-none transition ${
                                    isChecked
                                      ? 'bg-emerald-50/60 text-slate-500 line-through'
                                      : 'hover:bg-slate-50 text-slate-800'
                                  }`}
                                >
                                  <div className="pt-0.5 shrink-0">
                                    {isChecked ? (
                                      <CheckSquare className="w-4 h-4 text-emerald-600" />
                                    ) : (
                                      <Square className="w-4 h-4 text-slate-400 hover:text-indigo-600" />
                                    )}
                                  </div>
                                  <span className="font-medium flex-1">{step}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Verified Evidence Snippet */}
                        <div className="p-3 bg-white rounded-xl border border-slate-200/80 text-xs space-y-1.5 shadow-2xs">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                            Verified Evidence:
                          </span>
                          <p className="text-slate-700 italic text-[11px] leading-relaxed">
                            &quot;{rec.evidence?.summary}&quot;
                          </p>
                          {rec.evidence?.queries && rec.evidence.queries.length > 0 && (
                            <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                              <span className="text-[10px] text-slate-400 font-semibold">
                                Observed On:
                              </span>
                              {rec.evidence.queries.map((q, i) => (
                                <span
                                  key={i}
                                  className="text-[10px] font-medium bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded"
                                >
                                  &quot;{q}&quot;
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Outcome & Impact Tracker Button & Drawer */}
                        <div className="border-t border-slate-200/80 pt-2.5">
                          <button
                            onClick={() => handleToggleOutcome(rec.id)}
                            className="flex items-center justify-between w-full text-xs font-semibold text-indigo-700 hover:text-indigo-900 transition"
                          >
                            <span className="flex items-center gap-1.5">
                              <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
                              <span>Outcome & Impact Tracker</span>
                            </span>
                            {isOutcomeExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5 text-indigo-500" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5 text-indigo-500" />
                            )}
                          </button>

                          {isOutcomeExpanded && (
                            <div className="mt-2.5 p-3 rounded-xl bg-white border border-indigo-100 text-xs space-y-2 animate-fade-in">
                              {outcomeData?.loading ? (
                                <div className="text-slate-400 text-[11px] py-1">
                                  Analyzing SERP rankings and competitor deltas...
                                </div>
                              ) : (
                                <>
                                  <div className="text-slate-700 font-medium text-[11px]">
                                    <strong>Real Business Outcome:</strong> {outcomeData?.outcomeSummary}
                                  </div>

                                  {outcomeData?.outcomes && outcomeData.outcomes.length > 0 && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                                      {outcomeData.outcomes.map((o, idx) => (
                                        <div
                                          key={idx}
                                          className="p-2 rounded-lg bg-slate-50 border border-slate-100 text-[11px] flex items-center justify-between"
                                        >
                                          <span className="font-semibold text-slate-800 truncate mr-2">
                                            &quot;{o.phrase}&quot;
                                          </span>
                                          <div className="flex items-center gap-1.5 shrink-0">
                                            <span className="text-slate-500">
                                              #{o.currentRank ?? '—'}
                                            </span>
                                            {o.delta && o.delta > 0 ? (
                                              <span className="text-emerald-700 font-bold">
                                                +{o.delta}
                                              </span>
                                            ) : o.isIn3Pack ? (
                                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-emerald-100 text-emerald-800">
                                                3-Pack
                                              </span>
                                            ) : null}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Meta Attributes */}
                        <div className="flex items-center gap-4 text-[11px] text-slate-500 pt-1">
                          <span>
                            Impact: <strong className="text-slate-700 uppercase">{rec.impact}</strong>
                          </span>
                          <span>
                            Effort: <strong className="text-slate-700 uppercase">{rec.effort}</strong>
                          </span>
                          <span>
                            Confidence:{' '}
                            <strong className="text-slate-700 uppercase">{rec.confidence}</strong>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Collapsible Evidence Appendix */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Evidence Appendix & Citation Trail
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    {activeReportDetails.report.summary?.evidenceAppendix?.length || 0} citations
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 text-[10px]">
                        <th className="py-2 px-3">Search Query</th>
                        <th className="py-2 px-3">Source Provider</th>
                        <th className="py-2 px-3">Date</th>
                        <th className="py-2 px-3">Cited URL</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-[11px]">
                      {activeReportDetails.report.summary?.evidenceAppendix?.slice(0, 10).map((ev, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 font-semibold text-slate-900">{ev.query}</td>
                          <td className="py-2.5 px-3 text-slate-500">{ev.source}</td>
                          <td className="py-2.5 px-3 text-slate-400 font-mono text-[10px]">{ev.date}</td>
                          <td className="py-2.5 px-3 text-indigo-600 truncate max-w-[200px]">
                            {ev.url ? (
                              <a
                                href={ev.url}
                                target="_blank"
                                rel="noreferrer"
                                className="hover:underline flex items-center gap-1"
                              >
                                <span className="truncate">{ev.url}</span>
                                <ExternalLink className="w-3 h-3 text-slate-400 shrink-0" />
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
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-sm text-slate-400 shadow-sm">
              Select a report from the archive or click &quot;Generate Weekly Report&quot; above.
            </div>
          )}
        </div>
      </div>

      {/* Share Report Modal */}
      {shareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                  <Share2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Share Client Intelligence Report</h3>
                  <p className="text-xs text-slate-500">
                    Create a tokenized, read-only link for clients and external stakeholders.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShareModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* View Mode Switcher */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                Select Stakeholder View Mode
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div
                  onClick={() => setSelectedViewMode('executive')}
                  className={`p-3 rounded-xl border cursor-pointer transition select-none ${
                    selectedViewMode === 'executive'
                      ? 'border-indigo-600 bg-indigo-50/50 text-indigo-950 shadow-xs'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="text-xs font-bold">Executive View</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    High-level market changes, revenue focus, and top prioritized actions.
                  </div>
                </div>

                <div
                  onClick={() => setSelectedViewMode('specialist')}
                  className={`p-3 rounded-xl border cursor-pointer transition select-none ${
                    selectedViewMode === 'specialist'
                      ? 'border-indigo-600 bg-indigo-50/50 text-indigo-950 shadow-xs'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="text-xs font-bold">Specialist View</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Full technical evidence trail, citation table, and implementation steps.
                  </div>
                </div>
              </div>
            </div>

            {/* Active Link / Generator */}
            {shareData ? (
              <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800">Active Share Link</span>
                  <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded">
                    Active (Expires in 30 days)
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={shareData.shareUrl}
                    className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-700 font-mono select-all focus:outline-none"
                  />
                  <button
                    onClick={handleCopyShareLink}
                    className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition flex items-center gap-1.5 shrink-0 shadow-xs"
                  >
                    {shareCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <a
                    href={shareData.shareUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-indigo-600 hover:underline flex items-center gap-1 font-semibold"
                  >
                    <span>Open in new tab</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>

                  <button
                    onClick={handleRevokeShareLink}
                    disabled={sharingLoading}
                    className="text-xs text-rose-600 hover:text-rose-800 font-semibold"
                  >
                    Revoke Link
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <button
                  onClick={handleCreateShareLink}
                  disabled={sharingLoading}
                  className="px-5 py-2.5 bg-indigo-600 text-white font-semibold text-xs rounded-xl hover:bg-indigo-700 transition shadow-sm disabled:opacity-50 inline-flex items-center gap-2"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>{sharingLoading ? 'Creating Secure Link...' : 'Generate 30-Day Share Link'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
