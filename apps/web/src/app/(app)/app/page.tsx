'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';
import { apiClient } from '@/lib/api';
import { WebsiteAnalysis } from '@serp-scout/types';
import {
  ArrowRight,
  Sparkles,
  MapPin,
  TrendingUp,
  Activity,
  ShieldCheck,
  Target,
  Zap,
  Compass,
  CheckCircle2,
  Search,
  Users,
  BarChart3,
  Layers,
  FileText,
  RefreshCw,
  AlertTriangle,
  Key,
  ChevronDown,
  ExternalLink,
  Flame,
  Check,
  Clock,
  Radio,
  Award,
  Swords,
  MessageSquare,
  ChevronRight,
  Star,
  ChevronUp,
  Mail,
  Copy,
  X,
} from 'lucide-react';
import AuthLoadingScreen from '@/components/AuthLoadingScreen';

interface BusinessSummary {
  id: string;
  name: string;
  websiteUrl: string;
  industry?: string;
  city?: string;
  country?: string;
  primaryGoal?: string;
  dataStale: boolean;
  lastAnalyzedAt?: string;
  createdAt: string;
}

interface JobStatusResponse {
  id: string;
  state: 'waiting' | 'active' | 'completed' | 'failed';
  isCompleted: boolean;
  isFailed: boolean;
  failedReason?: string;
  result?: WebsiteAnalysis;
}

interface KeywordSummaryItem {
  id: string;
  phrase: string;
  location?: string | null;
  intent?: string | null;
  currentRank?: number | null;
  previousRank?: number | null;
  delta?: number | null;
  opportunityScore?: number;
}

interface CompetitorSummaryItem {
  id: string;
  name: string;
  domain: string;
  websiteUrl?: string;
  threatLevel?: 'severe' | 'vulnerable' | 'emerging' | 'moderate';
  rating?: number;
  reviewCount?: number;
}

interface OverviewRecommendation {
  id: string;
  title: string;
  description: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  impact: string;
  effort: string;
  status: 'planned' | 'in_progress' | 'completed' | 'dismissed';
}

export default function OverviewDashboardPage() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [businesses, setBusinesses] = useState<BusinessSummary[]>([]);
  const [selectedBizId, setSelectedBizId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Intelligence Data States
  const [keywords, setKeywords] = useState<KeywordSummaryItem[]>([]);
  const [competitors, setCompetitors] = useState<CompetitorSummaryItem[]>([]);
  const [recommendations, setRecommendations] = useState<OverviewRecommendation[]>([]);
  const [updatingRecId, setUpdatingRecId] = useState<string | null>(null);

  // Analysis status states
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<WebsiteAnalysis | null>(null);
  const [digestModalOpen, setDigestModalOpen] = useState(false);
  const [digestCopied, setDigestCopied] = useState(false);

  // Immediate client-side hydration from localStorage so company displays instantly without blank flash
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
            setLoading(false);
          }
        }
      } catch (e) {}
    }
  }, []);

  const loadBusinesses = useCallback(async () => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setLoading(false);
      return;
    }

    try {
      const token = await getToken();
      if (!token) return;

      const list = await apiClient<BusinessSummary[]>('/api/businesses', { token });
      setBusinesses(list);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('serp_scout_cached_businesses', JSON.stringify(list));
          const cachedBizId = localStorage.getItem('serp_scout_active_biz_id');
          const targetId = cachedBizId && list.some((b) => b.id === cachedBizId)
            ? cachedBizId
            : list[0]?.id || '';
          setSelectedBizId(targetId);
          if (targetId) {
            localStorage.setItem('serp_scout_active_biz_id', targetId);
          }
        } catch (e) {}
      }
    } catch (err: any) {
      console.error('Failed to load businesses:', err);
      setError(err.message || 'Failed to load business profiles');
    } finally {
      setLoading(false);
    }
  }, [isLoaded, isSignedIn, getToken]);

  const handleSelectBusiness = (bizId: string) => {
    setSelectedBizId(bizId);
    if (typeof window !== 'undefined') {
      localStorage.setItem('serp_scout_active_biz_id', bizId);
    }
  };

  const loadOverviewData = useCallback(async (bizId: string) => {
    if (!bizId) return;
    try {
      const token = await getToken();
      if (!token) return;

      const [kwRes, compRes, repRes] = await Promise.allSettled([
        apiClient<any[]>(`/api/businesses/${bizId}/keywords`, { token }),
        apiClient<any[]>(`/api/businesses/${bizId}/competitors`, { token }),
        apiClient<any[]>(`/api/businesses/${bizId}/reports`, { token }),
      ]);

      if (kwRes.status === 'fulfilled' && Array.isArray(kwRes.value)) {
        const formattedKw: KeywordSummaryItem[] = kwRes.value.map((item: any) => ({
          id: item.keyword?.id || item.id,
          phrase: item.keyword?.phrase || item.phrase,
          location: item.keyword?.location || item.location,
          intent: item.keyword?.intent || item.intent,
          currentRank: item.currentRank,
          previousRank: item.previousRank,
          delta: item.delta,
          opportunityScore: item.keyword?.opportunityScore || item.opportunityScore,
        }));
        setKeywords(formattedKw);
      } else {
        setKeywords([]);
      }

      if (compRes.status === 'fulfilled' && Array.isArray(compRes.value)) {
        const formattedComp: CompetitorSummaryItem[] = compRes.value.map((item: any) => {
          const c = item.competitor || item;
          return {
            id: c.id,
            name: c.name,
            domain: c.domain,
            websiteUrl: c.websiteUrl,
            threatLevel: c.metadata?.threatLevel || 'moderate',
            rating: c.metadata?.rating,
            reviewCount: c.metadata?.reviewCount,
          };
        });
        setCompetitors(formattedComp);
      } else {
        setCompetitors([]);
      }

      if (repRes.status === 'fulfilled' && Array.isArray(repRes.value) && repRes.value.length > 0) {
        const latestReportId = repRes.value[0].id;
        try {
          const reportDetail = await apiClient<any>(`/api/reports/${latestReportId}`, { token });
          if (reportDetail && Array.isArray(reportDetail.recommendations)) {
            setRecommendations(reportDetail.recommendations);
          }
        } catch (err) {
          console.warn('Failed to load report recommendations:', err);
        }
      } else {
        setRecommendations([]);
      }
    } catch (err) {
      console.error('Failed to load overview data:', err);
    }
  }, [getToken]);

  useEffect(() => {
    if (selectedBizId) {
      loadOverviewData(selectedBizId);
    }
  }, [selectedBizId, loadOverviewData]);

  const handleUpdateRecStatus = async (recId: string, newStatus: 'planned' | 'in_progress' | 'completed') => {
    setUpdatingRecId(recId);
    try {
      const token = await getToken();
      if (!token) return;
      await apiClient(`/api/reports/recommendations/${recId}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ status: newStatus }),
      });
      setRecommendations((prev) =>
        prev.map((r) => (r.id === recId ? { ...r, status: newStatus } : r))
      );
    } catch (e) {
      console.error('Failed to update recommendation status', e);
    } finally {
      setUpdatingRecId(null);
    }
  };

  useEffect(() => {
    if (isLoaded) {
      loadBusinesses();
    }
  }, [isLoaded, isSignedIn, loadBusinesses]);

  const autoTriggeredRef = React.useRef(false);

  const trackJob = useCallback(
    async (jobId: string) => {
      setAnalyzing(true);
      setAnalysisStatus('Autonomous analysis queued. Initializing background worker...');
      setError(null);

      try {
        const token = await getToken();
        if (!token) throw new Error('Authentication expired.');

        const pollInterval = setInterval(async () => {
          try {
            const jobRes = await apiClient<JobStatusResponse>(`/api/jobs/${jobId}`, { token });

            if (jobRes.state === 'active') {
              setAnalysisStatus('Crawling website, extracting meta tags & running Groq AI analysis...');
            } else if (jobRes.isCompleted) {
              clearInterval(pollInterval);
              setAnalyzing(false);
              setAnalysisStatus(null);
              if (jobRes.result) {
                setAnalysisResult(jobRes.result);
              }
              loadBusinesses();
            } else if (jobRes.isFailed) {
              clearInterval(pollInterval);
              setAnalyzing(false);
              setAnalysisStatus(null);
              setError(`Analysis failed: ${jobRes.failedReason || 'Worker encountered an issue'}`);
            }
          } catch (pollErr: any) {
            clearInterval(pollInterval);
            setAnalyzing(false);
            setAnalysisStatus(null);
            setError(pollErr.message || 'Error checking background analysis status');
          }
        }, 2000);
      } catch (err: any) {
        setAnalyzing(false);
        setAnalysisStatus(null);
        setError(err.message || 'Failed to inspect analysis job');
      }
    },
    [getToken, loadBusinesses]
  );

  const handleRunAnalysis = useCallback(
    async (businessId: string) => {
      setAnalyzing(true);
      setAnalysisStatus('Triggering website intelligence engine in background...');
      setError(null);

      try {
        const token = await getToken();
        if (!token) throw new Error('Authentication expired.');

        const enqueueRes = await apiClient<{ jobId: string }>(`/api/businesses/${businessId}/analyze`, {
          token,
          method: 'POST',
        });

        trackJob(enqueueRes.jobId);
      } catch (err: any) {
        setAnalyzing(false);
        setAnalysisStatus(null);
        setError(err.message || 'Failed to initiate website analysis');
      }
    },
    [getToken, trackJob]
  );

  // Automatically trigger background analysis if coming from onboarding or unanalyzed business
  useEffect(() => {
    if (loading || businesses.length === 0 || autoTriggeredRef.current) return;

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const autoAnalyze = params.get('auto_analyze') === 'true';
      const paramJobId = params.get('job_id');
      const paramBizId = params.get('biz_id') || params.get('business_id');

      if (paramJobId) {
        autoTriggeredRef.current = true;
        trackJob(paramJobId);
        return;
      }

      const targetBiz = paramBizId
        ? businesses.find((b) => b.id === paramBizId) || businesses[0]
        : businesses[0];

      if (targetBiz && (autoAnalyze || !targetBiz.lastAnalyzedAt)) {
        autoTriggeredRef.current = true;
        handleRunAnalysis(targetBiz.id);
      }
    }
  }, [loading, businesses, trackJob, handleRunAnalysis]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-full max-w-md">
          <AuthLoadingScreen
            message="Loading Competitive Overview..."
            subMessage="Retrieving your monitored local businesses, SERP rankings, and competitor radar..."
          />
        </div>
      </div>
    );
  }

  // If no businesses exist in workspace, prompt to onboard with rich full-page responsive layout
  if (businesses.length === 0) {
    return (
      <div className="relative -my-8 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-8 sm:py-12 overflow-hidden min-h-[calc(100vh-4.5rem)] flex flex-col justify-between">
        {/* ── BACKGROUND MOTION VISUALS ── */}
        {/* 1. Subtle SVG Dot Grid Matrix */}
        <div className="absolute inset-0 -z-30 opacity-40 pointer-events-none [mask-image:radial-gradient(ellipse_75%_65%_at_50%_50%,#000_60%,transparent_100%)]">
          <svg className="w-full h-full" width="100%" height="100%">
            <defs>
              <pattern id="welcome-grid-dots" width="30" height="30" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1.3" fill="#6366f1" opacity="0.35" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#welcome-grid-dots)" />
          </svg>
        </div>

        {/* 2. Floating Radial Mesh Orbs */}
        <div className="absolute top-4 left-1/4 -translate-x-1/2 w-[480px] h-[480px] bg-gradient-to-tr from-indigo-500/20 via-cyan-400/20 to-transparent rounded-full blur-3xl pointer-events-none -z-20 animate-orb-1" />
        <div className="absolute bottom-4 right-1/4 translate-x-1/2 w-[520px] h-[520px] bg-gradient-to-bl from-cyan-500/20 via-emerald-400/15 to-indigo-500/15 rounded-full blur-3xl pointer-events-none -z-20 animate-orb-2" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[360px] bg-indigo-600/10 rounded-full blur-3xl pointer-events-none -z-20 animate-pulse" />

        {/* 3. Rotating High-Tech SERP Radar Scanner Visual in Background */}
        <div className="hidden lg:block absolute top-6 right-8 xl:right-28 w-72 md:w-96 h-72 md:h-96 -z-10 pointer-events-none opacity-40">
          <div className="relative w-full h-full flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border border-indigo-400/25 border-dashed animate-spin" style={{ animationDuration: '60s' }} />
            <div className="absolute inset-10 rounded-full border border-cyan-400/30" />
            <div className="absolute inset-20 rounded-full border border-indigo-500/20" />
            <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-indigo-600/25 via-transparent to-transparent animate-radar" />
            <div className="absolute w-full h-[1px] bg-indigo-400/20" />
            <div className="absolute h-full w-[1px] bg-indigo-400/20" />
            <div className="absolute top-12 left-16 w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
            <div className="absolute top-12 left-16 w-3 h-3 rounded-full bg-emerald-500" />
            <div className="absolute bottom-16 right-20 w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" style={{ animationDuration: '2.2s' }} />
            <div className="absolute bottom-16 right-20 w-2.5 h-2.5 rounded-full bg-cyan-500" />
          </div>
        </div>

        {/* ── TOP HERO CARD ── */}
        <div className="max-w-3xl mx-auto w-full text-center relative z-10 my-auto pt-2 pb-6">
          {/* Favicon Logo Tile */}
          <div className="relative inline-block mb-5">
            <div className="absolute -inset-3 rounded-2xl bg-indigo-500/20 blur-md animate-pulse" />
            <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl bg-slate-900 border border-slate-700/80 flex items-center justify-center shadow-2xl shadow-indigo-950/30">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" className="w-10 h-10 sm:w-12 sm:h-12">
                <defs>
                  <linearGradient id="welcome-logo-accent" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#38bdf8" />
                    <stop offset="100%" stopColor="#10b981" />
                  </linearGradient>
                </defs>
                <rect width="32" height="32" rx="8" fill="#0f172a" />
                <circle cx="16" cy="16" r="10" stroke="#4f46e5" strokeWidth="1.5" strokeDasharray="4 2" fill="none" opacity="0.6" />
                <circle cx="16" cy="16" r="6.5" stroke="#38bdf8" strokeWidth="1.5" fill="none" opacity="0.8" />
                <circle cx="16" cy="16" r="3" fill="url(#welcome-logo-accent)" />
                <path d="M16 3 L16 8 M16 24 L16 29 M3 16 L8 16 M24 16 L29 16" stroke="#38bdf8" strokeWidth="1.5" strokeLinecap="round" opacity="0.9" />
              </svg>
            </div>
          </div>

          {/* Radar Status Pill */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-2xs mb-4">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span>Live SERP Radar Engine &bull; Ready to Initialize</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight leading-[1.15] mb-4">
            Welcome to <span className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-cyan-600 bg-clip-text text-transparent">Serp-Scout</span>
          </h1>

          <p className="text-sm sm:text-base text-slate-600 max-w-xl mx-auto mb-3 font-medium italic">
            &ldquo;Success is measured by real business outcomes rather than an arbitrary visibility score.&rdquo;
          </p>

          <p className="text-xs sm:text-sm text-slate-500 max-w-2xl mx-auto mb-8 leading-relaxed">
            You haven&apos;t set up a business yet. Complete our quick 2-minute onboarding to automatically pinpoint who takes appointments from you, track striking-distance keywords, and generate weekly verified action plans.
          </p>

          {/* Primary Action Button */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
            <Link
              href="/onboarding"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-bold text-sm sm:text-base text-white bg-gradient-to-r from-indigo-600 via-indigo-700 to-cyan-600 hover:from-indigo-700 hover:to-cyan-700 shadow-xl shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 group cursor-pointer"
            >
              <Sparkles className="w-5 h-5 text-cyan-200" />
              <span>Start 2-Minute Business Onboarding</span>
              <ArrowRight className="w-4 h-4 text-white group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          {/* Trust Guarantees */}
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs font-semibold text-slate-500">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              Zero-Trust SSRF Protected
            </span>
            <span className="flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-cyan-600" />
              100% Evidence Grounded
            </span>
            <span className="flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-500" />
              Sub-15s AI Local SERP Scan
            </span>
          </div>
        </div>

        {/* ── EXPANSIVE VISUAL FEATURE RADAR GRID (Fills Entire Page on PC / Tablet / Mobile) ── */}
        <div className="max-w-6xl mx-auto w-full relative z-10 pt-4">
          <div className="text-center mb-4">
            <span className="text-[11px] font-bold uppercase tracking-widest text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200/80">
              Autonomous Capabilities Ready Upon Setup
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Feature 1: Google Map 3-Pack */}
            <div className="p-4 sm:p-5 rounded-2xl bg-white/90 backdrop-blur-xl border border-slate-200/90 shadow-lg shadow-indigo-950/5 flex flex-col justify-between hover:border-indigo-300 hover:shadow-xl hover:shadow-indigo-500/10 transition-all duration-300 group">
              <div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center mb-3 text-emerald-600 group-hover:scale-105 transition-transform">
                  <MapPin className="w-5 h-5" />
                </div>
                <div className="flex items-center justify-between mb-1.5">
                  <h3 className="font-bold text-slate-900 text-sm">Google Map 3-Pack</h3>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    Rank #1
                  </span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Real-time monitoring of local pack positions to win high-intent nearby phone call inquiries.
                </p>
              </div>
              <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-emerald-600 font-bold">
                <span>+42% Phone Calls</span>
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Feature 2: Local Rival Discovery */}
            <div className="p-4 sm:p-5 rounded-2xl bg-white/90 backdrop-blur-xl border border-slate-200/90 shadow-lg shadow-indigo-950/5 flex flex-col justify-between hover:border-indigo-300 hover:shadow-xl hover:shadow-indigo-500/10 transition-all duration-300 group">
              <div>
                <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center mb-3 text-indigo-600 group-hover:scale-105 transition-transform">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div className="flex items-center justify-between mb-1.5">
                  <h3 className="font-bold text-slate-900 text-sm">Rival Intelligence</h3>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                    +5 Pos
                  </span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Autonomous detection of competitor strategy gaps and displaced search appointments.
                </p>
              </div>
              <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-indigo-600 font-bold">
                <span>Direct Rival Displaced</span>
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Feature 3: Striking-Distance Keywords */}
            <div className="p-4 sm:p-5 rounded-2xl bg-white/90 backdrop-blur-xl border border-slate-200/90 shadow-lg shadow-indigo-950/5 flex flex-col justify-between hover:border-indigo-300 hover:shadow-xl hover:shadow-indigo-500/10 transition-all duration-300 group">
              <div>
                <div className="w-10 h-10 rounded-xl bg-cyan-50 border border-cyan-200 flex items-center justify-center mb-3 text-cyan-600 group-hover:scale-105 transition-transform">
                  <Search className="w-5 h-5" />
                </div>
                <div className="flex items-center justify-between mb-1.5">
                  <h3 className="font-bold text-slate-900 text-sm">Striking Keywords</h3>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-800">
                    Pos 4–10
                  </span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Fastest route to new revenue by pushing low-hanging rankings onto Google Page 1.
                </p>
              </div>
              <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-cyan-600 font-bold">
                <span>High Intent Keywords</span>
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Feature 4: Weekly Action Plans */}
            <div className="p-4 sm:p-5 rounded-2xl bg-white/90 backdrop-blur-xl border border-slate-200/90 shadow-lg shadow-indigo-950/5 flex flex-col justify-between hover:border-indigo-300 hover:shadow-xl hover:shadow-indigo-500/10 transition-all duration-300 group">
              <div>
                <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center mb-3 text-amber-600 group-hover:scale-105 transition-transform">
                  <Target className="w-5 h-5" />
                </div>
                <div className="flex items-center justify-between mb-1.5">
                  <h3 className="font-bold text-slate-900 text-sm">Verified Action Plans</h3>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                    Weekly
                  </span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Zero guesswork. Receive 3 to 5 prioritized, evidence-backed steps to outrank rivals.
                </p>
              </div>
              <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-amber-600 font-bold">
                <span>Zero Vanity Metrics</span>
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const activeBusiness = businesses.find((b) => b.id === selectedBizId) || businesses[0];

  // Computed Dominance Index (0-100) & Metrics
  const totalKeywords = keywords.length;
  const top3Keywords = keywords.filter((k) => k.currentRank && k.currentRank <= 3);
  const strikingKeywords = keywords.filter(
    (k) => k.currentRank && k.currentRank >= 4 && k.currentRank <= 10
  );
  const severeThreats = competitors.filter((c) => c.threatLevel === 'severe');
  const completedRecs = recommendations.filter((r) => r.status === 'completed');
  const activeRecs = recommendations.filter((r) => r.status !== 'dismissed');

  // Grounded Local Dominance Score
  let dominanceScore = 48;
  if (totalKeywords > 0) {
    const kwWeight = Math.min(35, Math.round(((top3Keywords.length * 3 + strikingKeywords.length * 1.5) / Math.max(1, totalKeywords)) * 35));
    dominanceScore += kwWeight;
  } else {
    dominanceScore += 10;
  }
  if (recommendations.length > 0) {
    dominanceScore += Math.round((completedRecs.length / Math.max(1, recommendations.length)) * 18);
  } else {
    dominanceScore += 8;
  }
  if (severeThreats.length > 2) {
    dominanceScore -= 8;
  }
  if (activeBusiness?.dataStale) {
    dominanceScore -= 6;
  }
  dominanceScore = Math.max(28, Math.min(96, dominanceScore));

  const getDominanceTier = (score: number) => {
    if (score >= 80) return { label: 'Market Dominator', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
    if (score >= 65) return { label: 'Strong Contender', color: 'text-indigo-700 bg-indigo-50 border-indigo-200' };
    if (score >= 50) return { label: 'Rising Challenger', color: 'text-amber-700 bg-amber-50 border-amber-200' };
    return { label: 'Needs Velocity', color: 'text-rose-700 bg-rose-50 border-rose-200' };
  };

  const tier = getDominanceTier(dominanceScore);

  return (
    <div className="space-y-8">
      {/* ── 1. EXECUTIVE HEADER BAR ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            {businesses.length > 1 ? (
              <div className="relative inline-block">
                <select
                  value={activeBusiness?.id}
                  onChange={(e) => handleSelectBusiness(e.target.value)}
                  className="text-2xl font-black text-slate-900 bg-transparent pr-8 py-0.5 border-none outline-none cursor-pointer hover:text-indigo-600 transition appearance-none"
                >
                  {businesses.map((b) => (
                    <option key={b.id} value={b.id} className="text-sm font-semibold text-slate-900">
                      {b.name} ({b.city || 'Primary'})
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            ) : (
              <h1 className="text-2xl font-black text-slate-900">{activeBusiness.name}</h1>
            )}

            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
              {activeBusiness.industry || 'Local Business'}
            </span>
          </div>

          <p className="text-sm text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1 font-medium text-slate-600">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              {activeBusiness.city || 'Target Area'}
            </span>
            <span>•</span>
            <a
              href={activeBusiness.websiteUrl}
              target="_blank"
              rel="noreferrer"
              className="text-indigo-600 hover:underline inline-flex items-center gap-1 text-xs"
            >
              <span>{activeBusiness.websiteUrl}</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => setDigestModalOpen(true)}
            className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Mail className="w-3.5 h-3.5 text-indigo-600" />
            <span>Weekly Digest</span>
          </button>

          <Link
            href="/onboarding"
            className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition shadow-xs"
          >
            + Add Business
          </Link>

          <button
            disabled={analyzing}
            onClick={() => handleRunAnalysis(activeBusiness.id)}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 text-white hover:opacity-95 shadow-sm transition disabled:opacity-50 flex items-center gap-2"
          >
            {analyzing ? (
              <>
                <span className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                <span>Analyzing Website...</span>
              </>
            ) : activeBusiness.lastAnalyzedAt ? (
              <span className="inline-flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Re-Analyze Website (AI)</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5" />
                <span>Analyze Website (AI)</span>
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── EXECUTIVE WEEKLY DIGEST PREVIEW MODAL ── */}
      {digestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden animate-scale-up space-y-0">
            {/* Header */}
            <div className="p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center">
                  <Mail className="w-5 h-5 text-cyan-300" />
                </div>
                <div>
                  <div className="text-[10px] font-extrabold uppercase tracking-widest text-cyan-300">
                    Automated Intelligence Brief
                  </div>
                  <h3 className="text-base font-bold text-white">
                    Monday Morning Executive Digest
                  </h3>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setDigestModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200 text-xs text-indigo-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Executive Snapshot for {activeBusiness.name}</span>
                </div>
                <p className="text-[11px] text-indigo-800 leading-relaxed">
                  Scheduled to dispatch every Monday at 8:00 AM directly to stakeholders. Zero vanity metrics—strictly business outcomes and competitive shifts.
                </p>
              </div>

              {/* Digest Content Preview */}
              <div className="space-y-3 text-xs">
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1">
                  <span className="text-[10px] font-extrabold uppercase text-emerald-600">1. Google Maps 3-Pack Momentum</span>
                  <p className="font-bold text-slate-900">
                    {top3Keywords.length > 0
                      ? `${top3Keywords.length} primary service keywords are commanding Top 3 Google Maps positions.`
                      : 'Keywords are currently positioned in Striking Distance (#4–#10).'}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Top performing keyword: &quot;{top3Keywords[0]?.phrase || strikingKeywords[0]?.phrase || 'Local Service'}&quot;
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1">
                  <span className="text-[10px] font-extrabold uppercase text-rose-600">2. Competitor Threat Radar</span>
                  <p className="font-bold text-slate-900">
                    {competitors.length > 0
                      ? `Monitored ${competitors.length} local rivals. Top competitor: ${competitors[0]?.name}.`
                      : 'Zero severe threats detected this cycle.'}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Market vulnerability: Rivals lacking upfront pricing guarantees and instant online booking.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                  <span className="text-[10px] font-extrabold uppercase text-indigo-600">3. Prioritized 3-Step Action Plan</span>
                  <ul className="space-y-1.5 text-[11px] text-slate-700">
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      <span>Embed verified LocalBusiness JSON-LD Schema to capture AI Overviews.</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      <span>Dispatch 5 review requests targeting transparent pricing and friendly staff.</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      <span>Deploy striking-distance keyword page targeting &quot;{strikingKeywords[0]?.phrase || 'Emergency Specialist'}&quot;.</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  const digestText = `*SERP-SCOUT WEEKLY EXECUTIVE DIGEST*\n*Business:* ${activeBusiness.name}\n\n1. 3-Pack Presence: ${top3Keywords.length} keywords in Top 3.\n2. Rival Radar: Monitored ${competitors.length} competitors.\n3. Top Actions: Deploy Local Schema, request reviews, target striking keywords.`;
                  if (typeof navigator !== 'undefined' && navigator.clipboard) {
                    navigator.clipboard.writeText(digestText);
                    setDigestCopied(true);
                    setTimeout(() => setDigestCopied(false), 2000);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-800 font-bold text-xs flex items-center gap-1.5 hover:bg-slate-100 transition cursor-pointer"
              >
                {digestCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                <span>{digestCopied ? 'Copied Brief!' : 'Copy to Clipboard'}</span>
              </button>

              <div className="flex items-center gap-2">
                <Link
                  href="/settings/schedule"
                  onClick={() => setDigestModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-sm"
                >
                  <span>Configure Schedule →</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Analysis Progress Status Banner */}
      {analyzing && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-900 border border-indigo-700/60 text-white shadow-xl shadow-indigo-950/20 animate-fade-in relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-10 h-10 rounded-xl bg-indigo-900/80 border border-indigo-500/50 flex items-center justify-center shrink-0 shadow-inner">
              <span className="h-5 w-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></span>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-cyan-400">
                  Autonomous Background Scout Active
                </span>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping"></span>
              </div>
              <p className="text-sm font-semibold text-slate-100 mt-0.5">
                {analysisStatus || 'Crawling website & extracting competitor landscape...'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Zero manual intervention required. Results and actionable recommendations will populate dynamically below upon completion.
              </p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-sm text-rose-700 animate-fade-in shadow-xs">
          {error}
        </div>
      )}

      {/* Stale Data Indicator Banner */}
      {activeBusiness.dataStale && (
        <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-200 text-sm text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs animate-fade-in">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <strong className="font-semibold">Search Intelligence Data is Stale</strong>
              <p className="text-xs text-amber-800 mt-0.5">
                Last research cycle was over configured threshold ago. Competitor movements and rank fluctuations may have occurred since then.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/settings/schedule"
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition shadow-xs whitespace-nowrap"
            >
              Configure Schedule / Refresh →
            </Link>
          </div>
        </div>
      )}

      {/* ── 3. FOUR COMMAND METRIC TILES ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Local Dominance Index */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Local Dominance Index
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${tier.color}`}>
                {tier.label}
              </span>
            </div>
            <div className="text-3xl font-black text-slate-900 mt-2 flex items-baseline gap-1">
              <span>{dominanceScore}</span>
              <span className="text-xs font-semibold text-slate-400">/ 100</span>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-3">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 via-indigo-600 to-cyan-500 rounded-full transition-all duration-500"
                style={{ width: `${dominanceScore}%` }}
              />
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
            <span>3-Pack & Review Weight</span>
            <span className="text-indigo-600 font-bold">Calculated</span>
          </p>
        </div>

        {/* Metric 2: Google 3-Pack Presence */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Google 3-Pack Presence
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                top3Keywords.length > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
              }`}>
                {top3Keywords.length > 0 ? '#1–#3 In Pack' : 'Striking Distance'}
              </span>
            </div>
            <div className="text-3xl font-black text-slate-900 mt-2">
              {top3Keywords.length}
            </div>
            <p className="text-xs text-slate-600 mt-1">
              Keywords commanding Google Maps Top 3
            </p>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-100">
            <Link
              href="/local"
              className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center justify-between"
            >
              <span>Explore Maps 3-Pack</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Metric 3: Striking-Distance Keywords */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-600">
                Striking Distance (Pos 4–10)
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-50 text-cyan-700 border border-cyan-200">
                Fast Wins
              </span>
            </div>
            <div className="text-3xl font-black text-cyan-600 mt-2">
              {strikingKeywords.length}
            </div>
            <p className="text-xs text-slate-600 mt-1">
              High-intent queries ready for Page 1 sprint
            </p>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-100">
            <Link
              href="/keywords"
              className="text-[11px] font-bold text-cyan-600 hover:text-cyan-700 flex items-center justify-between"
            >
              <span>View Striking Keywords</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Metric 4: Direct Rival Threat Radar */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600">
                Rival Threat Radar
              </span>
              {severeThreats.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                  {severeThreats.length} Severe
                </span>
              )}
            </div>
            <div className="text-3xl font-black text-slate-900 mt-2">
              {competitors.length}
            </div>
            <p className="text-xs text-slate-600 mt-1">
              Direct competitors taking local appointments
            </p>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-100">
            <Link
              href="/competitors"
              className="text-[11px] font-bold text-rose-600 hover:text-rose-700 flex items-center justify-between"
            >
              <span>Inspect Competitor Radar</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* ── 4. WEEKLY HIGH-IMPACT ACTION QUEUE ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                <Target className="w-4 h-4" />
              </span>
              <h3 className="text-sm font-bold text-slate-900">
                Weekly High-Impact Action Queue
              </h3>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-indigo-600 text-white">
                Prioritized
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Top autonomous recommendations ground-truthed against real local SERP movements to outrank rivals.
            </p>
          </div>

          <Link
            href="/reports"
            className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 transition flex items-center gap-1.5 self-start sm:self-auto shrink-0"
          >
            <span>Full Executive Reports</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {activeRecs.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeRecs.slice(0, 3).map((rec) => (
              <div
                key={rec.id}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-indigo-300 transition flex flex-col justify-between space-y-3"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded ${
                      rec.priority === 'P0'
                        ? 'bg-rose-100 text-rose-800'
                        : rec.priority === 'P1'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-indigo-100 text-indigo-800'
                    }`}>
                      {rec.priority} Priority
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">
                      {rec.impact} Impact
                    </span>
                  </div>

                  <h4 className="text-xs font-bold text-slate-900 line-clamp-1">
                    {rec.title}
                  </h4>
                  <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                    {rec.description}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-slate-400">
                    Status:
                  </span>
                  <select
                    disabled={updatingRecId === rec.id}
                    value={rec.status}
                    onChange={(e) => handleUpdateRecStatus(rec.id, e.target.value as any)}
                    className="text-xs font-bold rounded-lg px-2 py-1 bg-white border border-slate-200 text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="planned">Planned</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">✓ Completed</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center bg-slate-50/60 rounded-xl border border-dashed border-slate-200 space-y-2">
            <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto" />
            <h4 className="text-xs font-bold text-slate-800">All Current Actions Addressed or Queued</h4>
            <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
              Run your next weekly search audit to generate new evidence-backed recommendations for this business.
            </p>
            <div className="pt-2">
              <Link
                href="/reports"
                className="px-3.5 py-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg inline-flex items-center gap-1 transition"
              >
                <span>Generate Weekly Action Plan</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* ── 5. TWO-COLUMN INTELLIGENCE SPLIT ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Striking-Distance Keywords Spotlight */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-cyan-50 text-cyan-600">
                <Flame className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Striking-Distance Keywords (Pos 4–10)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Push these onto Page 1 for immediate appointment lift
                </p>
              </div>
            </div>
            <Link
              href="/keywords"
              className="text-xs font-bold text-cyan-600 hover:text-cyan-700 flex items-center gap-1"
            >
              <span>View All</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {strikingKeywords.length > 0 ? (
            <div className="space-y-2.5">
              {strikingKeywords.slice(0, 4).map((kw) => (
                <div
                  key={kw.id}
                  className="p-3 rounded-xl bg-slate-50/70 border border-slate-200/80 flex items-center justify-between gap-3 hover:bg-white transition"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">
                      {kw.phrase}
                    </p>
                    <p className="text-[10px] text-slate-400 capitalize">
                      {kw.intent || 'Transactional'} &bull; {kw.location || activeBusiness.city || 'Local'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="px-2 py-0.5 rounded-md text-xs font-black bg-cyan-100 text-cyan-800 border border-cyan-200">
                      #{kw.currentRank}
                    </span>
                    {kw.delta !== null && kw.delta !== undefined && (
                      <span className={`text-[10px] font-bold ${
                        kw.delta > 0 ? 'text-emerald-600' : kw.delta < 0 ? 'text-rose-600' : 'text-slate-400'
                      }`}>
                        {kw.delta > 0 ? `+${kw.delta}` : kw.delta}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center bg-slate-50 rounded-xl text-xs text-slate-500">
              <Search className="w-5 h-5 text-slate-400 mx-auto mb-1.5" />
              <span>No striking-distance rankings detected yet. Track your core services in the Keywords engine.</span>
            </div>
          )}
        </div>

        {/* Right Column: Rival Threat Spotlight */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-rose-50 text-rose-600">
                <Swords className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Top Competitors Stealing Appointments
                </h3>
                <p className="text-[11px] text-slate-500">
                  Rivals dominating Google 3-Pack search results
                </p>
              </div>
            </div>
            <Link
              href="/competitors"
              className="text-xs font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1"
            >
              <span>View Radar</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {competitors.length > 0 ? (
            <div className="space-y-2.5">
              {competitors.slice(0, 3).map((comp) => (
                <div
                  key={comp.id}
                  className="p-3 rounded-xl bg-slate-50/70 border border-slate-200/80 flex items-center justify-between gap-3 hover:bg-white transition"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">
                      {comp.name}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">
                      {comp.domain}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {comp.rating && (
                      <span className="text-[11px] font-semibold text-amber-500 flex items-center gap-0.5">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                        {comp.rating}
                      </span>
                    )}
                    <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                      comp.threatLevel === 'severe'
                        ? 'bg-rose-100 text-rose-800'
                        : comp.threatLevel === 'emerging'
                        ? 'bg-cyan-100 text-cyan-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}>
                      {comp.threatLevel || 'Rival'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center bg-slate-50 rounded-xl text-xs text-slate-500">
              <Users className="w-5 h-5 text-slate-400 mx-auto mb-1.5" />
              <span>No competitor radar data yet. Run website analysis or scan local competitors.</span>
            </div>
          )}
        </div>
      </div>

      {/* ── 6. LIVE AI WEBSITE ANALYSIS RESULTS (Preserved & Enhanced) ── */}
      {analysisResult && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs hover:shadow-md transition-all duration-200 space-y-6 animate-fade-in">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                AI Website Extraction Report
              </span>
              <h3 className="text-xl font-bold text-slate-900 mt-1">
                Extracted Business Intelligence
              </h3>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Completed
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Detected Category & Services */}
            <div className="space-y-4">
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase">
                  Detected Category
                </span>
                <p className="text-base font-semibold text-slate-800 mt-1">
                  {analysisResult.detectedCategory}
                </p>
              </div>

              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase">
                  Extracted Services ({analysisResult.detectedServices.length})
                </span>
                <div className="flex flex-wrap gap-2 mt-2">
                  {analysisResult.detectedServices.map((svc) => (
                    <span
                      key={svc}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200"
                    >
                      {svc}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase">
                  Detected Target Locations
                </span>
                <div className="flex flex-wrap gap-2 mt-2">
                  {analysisResult.detectedLocations.map((loc) => (
                    <span
                      key={loc}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 inline-flex items-center gap-1"
                    >
                      <MapPin className="w-3 h-3 text-blue-500 shrink-0" />
                      <span>{loc}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Candidate Keywords & Missing Pages */}
            <div className="space-y-4">
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase">
                  Discovered Candidate Keywords ({analysisResult.candidateKeywords.length})
                </span>
                <div className="flex flex-wrap gap-2 mt-2">
                  {analysisResult.candidateKeywords.map((kw) => (
                    <span
                      key={kw}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 inline-flex items-center gap-1"
                    >
                      <Key className="w-3 h-3 text-indigo-500 shrink-0" />
                      <span>{kw}</span>
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase">
                  Missing High-Intent Pages (Opportunities)
                </span>
                <ul className="mt-2 space-y-1 text-sm text-slate-600">
                  {analysisResult.missingOpportunities.servicePages.map((page) => (
                    <li key={page} className="flex items-center gap-2">
                      <span className="text-amber-500 font-bold">•</span>
                      <span>Missing Service Page: {page}</span>
                    </li>
                  ))}
                  {analysisResult.missingOpportunities.locationPages.map((page) => (
                    <li key={page} className="flex items-center gap-2">
                      <span className="text-amber-500 font-bold">•</span>
                      <span>Missing Location Page: {page}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
