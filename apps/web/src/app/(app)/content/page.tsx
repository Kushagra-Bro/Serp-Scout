'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';
import { apiClient } from '@/lib/api';
import {
  Sparkles,
  Megaphone,
  Star,
  X,
  Newspaper,
  TrendingUp,
  FileText,
  Check,
  AlertTriangle,
  Shield,
  ShieldAlert,
  Copy,
  ExternalLink,
  QrCode,
  Calculator,
  Zap,
  MessageSquare,
  Flame,
  CheckCircle2,
  ChevronRight,
  ThumbsUp,
  ThumbsDown,
  Clock,
  Send,
  Loader2,
  Target,
  Swords,
  Phone,
  Mail,
  Users,
  RefreshCw,
  ArrowRight,
  Smile,
  Printer,
  Download,
} from 'lucide-react';
import type {
  CompetitorVulnerability,
  ReviewVelocityBenchmark,
  ReviewRequestTemplate,
  AIReviewDeescalation,
  ReviewReplyResult,
} from '@serp-scout/types';

interface BusinessSummary {
  id: string;
  name: string;
  city?: string;
}

interface ContentGapItem {
  id: string;
  topic: string;
  recommendedPageType: string;
  suggestedTitle: string;
  suggestedHeadings: string[];
  suggestedFaqs: string[];
  targetIntent: string;
  priority: string;
  effort: string;
  impact: string;
  status: string;
  evidence?: {
    competitorDomain?: string;
    competitorUrl?: string;
  };
}

interface MessagingData {
  competitors: Array<{
    competitorName: string;
    domain: string;
    headline: string;
    primaryOffer: string;
    differentiator: string;
    priceLanguage: string | null;
    guarantees?: string | null;
    speedOfService?: string | null;
    cta: string;
    trustSignals: string[];
    sourceEvidence?: string;
    sourceUrl?: string;
    isLiveGrounded?: boolean;
    features?: {
      hasOnlineBooking: boolean;
      hasEmergencyService: boolean;
      hasTransparentPricing: boolean;
      hasSatisfactionGuarantee: boolean;
    };
  }>;
  marketPatterns: Array<{
    pattern: string;
    observedFacts: string[];
    aiInterpretation: string;
    recommendedAction: string;
  }>;
  deployableHeadlines?: Array<{
    hook: string;
    rationale: string;
    targetLocationOrService?: string;
  }>;
  overallTakeaway: string;
}

interface ReviewThemeItem {
  theme: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  frequency: number;
  examples: string[];
  suggestedCopyOpportunity?: string;
}

interface ReviewAnalysisData {
  themes: ReviewThemeItem[];
  commonPraise: string[];
  commonComplaints: string[];
  websiteCopyOpportunities: Array<{
    theme: string;
    customerQuoteOrVocabulary: string;
    suggestedCopyHeadline: string;
    targetPage: string;
  }>;
  serviceImprovementOpportunities: string[];
  competitorVulnerabilities?: CompetitorVulnerability[];
  velocityBenchmark?: ReviewVelocityBenchmark;
  requestTemplates?: ReviewRequestTemplate[];
  crisisResponses?: AIReviewDeescalation[];
}

interface NewsSignalItem {
  headline: string;
  source: string;
  url: string;
  date?: string;
  category: string;
  summary: string;
}

interface ChangeDetectionData {
  query: string;
  summary: string;
  rankShifts: Array<{
    domain: string;
    previousRank: number;
    currentRank: number;
    delta: number;
    url: string;
  }>;
  newEntrants: Array<{ domain: string; rank: number; title: string }>;
  droppedOut: Array<{ domain: string; rank: number; title: string }>;
}

export default function ContentAndAnalysisPage() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [businesses, setBusinesses] = useState<BusinessSummary[]>([]);
  const [selectedBizId, setSelectedBizId] = useState<string>('');

  // Active Tab
  const [activeTab, setActiveTab] = useState<'gaps' | 'messaging' | 'reviews' | 'news' | 'changes'>('gaps');

  // Loading and error states
  const [loading, setLoading] = useState(false);
  const [analyzingGaps, setAnalyzingGaps] = useState(false);
  const [analyzingMessaging, setAnalyzingMessaging] = useState(false);
  const [analyzingReviews, setAnalyzingReviews] = useState(false);
  const [analyzingNews, setAnalyzingNews] = useState(false);
  const [analyzingChanges, setAnalyzingChanges] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Data states
  const [contentGapsList, setContentGapsList] = useState<ContentGapItem[]>([]);
  const [messagingData, setMessagingData] = useState<MessagingData | null>(null);
  const [reviewData, setReviewData] = useState<ReviewAnalysisData | null>(null);
  const [newsSignals, setNewsSignals] = useState<NewsSignalItem[]>([]);
  const [changeData, setChangeData] = useState<ChangeDetectionData | null>(null);
  const autoTriggeredGapsRef = React.useRef<Set<string>>(new Set());

  // Tab 3: VoC Interactivity State
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const [customTargetReviews, setCustomTargetReviews] = useState<number | null>(null);

  // Tab 3: Interactive AI Reputation Shield State
  const [customReviewInput, setCustomReviewInput] = useState('');
  const [customStarRating, setCustomStarRating] = useState<number>(1);
  const [customReviewerName, setCustomReviewerName] = useState('');
  const [isGeneratingReply, setIsGeneratingReply] = useState(false);
  const [generatedReplyResult, setGeneratedReplyResult] = useState<ReviewReplyResult | null>(null);
  const [shieldError, setShieldError] = useState<string | null>(null);
  const [battlecardOpen, setBattlecardOpen] = useState(false);

  const handleCopy = (key: string, text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  };

  const handleGenerateCustomReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBizId || !customReviewInput.trim()) return;
    setIsGeneratingReply(true);
    setShieldError(null);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await apiClient<ReviewReplyResult>(`/api/businesses/${selectedBizId}/analysis/review-reply`, {
        method: 'POST',
        token,
        body: JSON.stringify({
          reviewText: customReviewInput.trim(),
          starRating: customStarRating,
          reviewerName: customReviewerName.trim() || undefined,
        }),
      });
      setGeneratedReplyResult(res);
    } catch (err: any) {
      console.error('Shield generation error:', err);
      setShieldError(err.message || 'Failed to generate diplomatic reply');
    } finally {
      setIsGeneratingReply(false);
    }
  };

  // Check URL search params for deep linking (e.g. from local tab)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab && ['gaps', 'messaging', 'reviews', 'news', 'changes'].includes(tab)) {
        setActiveTab(tab as any);
      }
    }
  }, []);

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

  // Instant cache retrieval on business change
  useEffect(() => {
    if (!selectedBizId || typeof window === 'undefined') return;

    try {
      const cachedGaps = localStorage.getItem(`content_gaps_${selectedBizId}`);
      if (cachedGaps) {
        const parsed = JSON.parse(cachedGaps);
        if (Array.isArray(parsed) && parsed.length > 0) setContentGapsList(parsed);
      }

      const cachedMessaging = localStorage.getItem(`content_messaging_${selectedBizId}`);
      if (cachedMessaging) {
        const parsed = JSON.parse(cachedMessaging);
        if (parsed) setMessagingData(parsed);
      }

      const cachedReviews = localStorage.getItem(`content_reviews_${selectedBizId}`);
      if (cachedReviews) {
        const parsed = JSON.parse(cachedReviews);
        if (parsed) setReviewData(parsed);
      }

      const cachedNews = localStorage.getItem(`content_news_${selectedBizId}`);
      if (cachedNews) {
        const parsed = JSON.parse(cachedNews);
        if (Array.isArray(parsed)) setNewsSignals(parsed);
      }

      const cachedChanges = localStorage.getItem(`content_changes_${selectedBizId}`);
      if (cachedChanges) {
        const parsed = JSON.parse(cachedChanges);
        if (parsed) setChangeData(parsed);
      }
    } catch (e) {
      console.error('Failed to read content cache:', e);
    }
  }, [selectedBizId]);

  // Load business list
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

  // Trigger Content Gap Analysis
  const handleRunContentGaps = useCallback(async (targetBizId?: string) => {
    const bizId = targetBizId || selectedBizId;
    if (!bizId) return;
    setAnalyzingGaps(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await apiClient<{ count: number; contentGaps: ContentGapItem[] }>(
        `/api/businesses/${bizId}/analysis/content-gaps`,
        { method: 'POST', token }
      );
      setSuccessMsg(`Identified ${res.count} actionable content gaps!`);
      const refreshed = await apiClient<ContentGapItem[]>(`/api/businesses/${bizId}/analysis/content-gaps`, { token });
      setContentGapsList(refreshed);
      try {
        localStorage.setItem(`content_gaps_${bizId}`, JSON.stringify(refreshed));
      } catch {}
    } catch (err: any) {
      console.error('Content gap error:', err);
      setError(err.message || 'Failed to analyze content gaps');
    } finally {
      setAnalyzingGaps(false);
    }
  }, [selectedBizId, getToken]);

  // Load existing Content Gaps
  const loadContentGaps = useCallback(async () => {
    if (!selectedBizId) return;
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const gaps = await apiClient<ContentGapItem[]>(`/api/businesses/${selectedBizId}/analysis/content-gaps`, { token });
      setContentGapsList(gaps);
      try {
        localStorage.setItem(`content_gaps_${selectedBizId}`, JSON.stringify(gaps));
      } catch {}

      // Auto-trigger if 0 content gaps found
      if (gaps.length === 0 && !autoTriggeredGapsRef.current.has(selectedBizId)) {
        autoTriggeredGapsRef.current.add(selectedBizId);
        handleRunContentGaps(selectedBizId);
      }
    } catch (err: any) {
      console.error('Failed to load content gaps:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedBizId, getToken, handleRunContentGaps]);

  useEffect(() => {
    loadContentGaps();
  }, [selectedBizId, loadContentGaps]);

  // Trigger Competitor Messaging Analysis
  const handleRunMessaging = useCallback(async () => {
    if (!selectedBizId) return;
    setAnalyzingMessaging(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await apiClient<MessagingData>(`/api/businesses/${selectedBizId}/analysis/messaging`, {
        method: 'POST',
        token,
      });
      setMessagingData(res);
      try {
        localStorage.setItem(`content_messaging_${selectedBizId}`, JSON.stringify(res));
      } catch {}
      setActiveTab('messaging');
    } catch (err: any) {
      console.error('Messaging error:', err);
      setError(err.message || 'Failed to analyze competitor messaging');
    } finally {
      setAnalyzingMessaging(false);
    }
  }, [selectedBizId, getToken]);

  // Trigger Customer Review Analysis
  const handleRunReviews = useCallback(async () => {
    if (!selectedBizId) return;
    setAnalyzingReviews(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await apiClient<ReviewAnalysisData>(`/api/businesses/${selectedBizId}/analysis/reviews`, {
        method: 'POST',
        token,
      });
      setReviewData(res);
      try {
        localStorage.setItem(`content_reviews_${selectedBizId}`, JSON.stringify(res));
      } catch {}
      setActiveTab('reviews');
    } catch (err: any) {
      console.error('Review error:', err);
      setError(err.message || 'Failed to analyze reviews');
    } finally {
      setAnalyzingReviews(false);
    }
  }, [selectedBizId, getToken]);

  // Trigger News Signals Analysis
  const handleRunNews = useCallback(async () => {
    if (!selectedBizId) return;
    setAnalyzingNews(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await apiClient<NewsSignalItem[]>(`/api/businesses/${selectedBizId}/analysis/news`, {
        method: 'POST',
        token,
      });
      setNewsSignals(res);
      try {
        localStorage.setItem(`content_news_${selectedBizId}`, JSON.stringify(res));
      } catch {}
      setActiveTab('news');
    } catch (err: any) {
      console.error('News error:', err);
      setError(err.message || 'Failed to analyze news');
    } finally {
      setAnalyzingNews(false);
    }
  }, [selectedBizId, getToken]);

  // Trigger Change Detection
  const handleRunChanges = useCallback(async () => {
    if (!selectedBizId) return;
    setAnalyzingChanges(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await apiClient<ChangeDetectionData>(`/api/businesses/${selectedBizId}/analysis/changes`, {
        method: 'POST',
        token,
      });
      setChangeData(res);
      try {
        localStorage.setItem(`content_changes_${selectedBizId}`, JSON.stringify(res));
      } catch {}
      setActiveTab('changes');
    } catch (err: any) {
      console.error('Change detection error:', err);
      setError(err.message || 'Failed to detect changes');
    } finally {
      setAnalyzingChanges(false);
    }
  }, [selectedBizId, getToken]);

  // Update Gap Status
  const handleUpdateGapStatus = async (gapId: string, status: 'open' | 'in_progress' | 'completed' | 'dismissed') => {
    try {
      const token = await getToken();
      if (!token) return;
      await apiClient(`/api/analysis/content-gaps/${gapId}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ status }),
      });
      setContentGapsList((prev) =>
        prev.map((g) => (g.id === gapId ? { ...g, status } : g))
      );
    } catch (err: any) {
      console.error('Failed to update gap status:', err);
      setError(err.message || 'Failed to update gap status');
    }
  };

  // Metrics
  const p0Count = contentGapsList.filter((g) => g.priority === 'P0').length;
  const p1Count = contentGapsList.filter((g) => g.priority === 'P1').length;
  const openCount = contentGapsList.filter((g) => g.status === 'open' || g.status === 'in_progress').length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">SEO & Market Analysis</h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Uncover actionable content gaps, competitor messaging patterns, customer voice, and market movements.
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
            onClick={() => handleRunContentGaps()}
            disabled={analyzingGaps || !selectedBizId}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 text-white hover:opacity-95 shadow-sm transition-all disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{analyzingGaps ? 'Analyzing Gaps...' : 'Find Content Gaps'}</span>
          </button>

          <button
            onClick={handleRunMessaging}
            disabled={analyzingMessaging || !selectedBizId}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 shadow-xs transition-colors disabled:opacity-50"
          >
            <Megaphone className="w-3.5 h-3.5" />
            <span>{analyzingMessaging ? 'Scanning...' : 'Messaging'}</span>
          </button>

          <button
            onClick={handleRunReviews}
            disabled={analyzingReviews || !selectedBizId}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 shadow-xs transition-colors disabled:opacity-50"
          >
            <Star className="w-3.5 h-3.5" />
            <span>{analyzingReviews ? 'Extracting...' : 'Reviews (VoC)'}</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-xs font-medium flex items-center justify-between animate-fade-in shadow-xs">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700 ml-2">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-xs font-medium flex items-center justify-between animate-fade-in shadow-xs">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-600 hover:text-emerald-800 ml-2">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Overview Metrics with Elevation */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Active Opportunities</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{openCount}</span>
            <span className="text-xs text-slate-400">content gaps</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">P0 Immediate Priority</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-rose-600">{p0Count}</span>
            <span className="text-xs text-rose-600 font-medium">high impact / low effort</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">P1 Strategic Priority</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-indigo-600">{p1Count}</span>
            <span className="text-xs text-slate-400">high impact</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Market Intelligence</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">
              {messagingData ? 'Analyzed' : 'Ready'}
            </span>
            <span className="text-xs text-emerald-600 font-medium">AI powered</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-slate-200 flex items-center justify-between">
        <nav className="flex space-x-6">
          <button
            onClick={() => setActiveTab('gaps')}
            className={`py-3 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'gaps'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Content Gaps ({contentGapsList.length})
          </button>
          <button
            onClick={() => {
              if (!messagingData) handleRunMessaging();
              else setActiveTab('messaging');
            }}
            className={`py-3 text-xs font-semibold border-b-2 transition-colors inline-flex items-center gap-1.5 ${
              activeTab === 'messaging'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Megaphone className="w-3.5 h-3.5" />
            <span>Competitor Messaging Patterns</span>
          </button>
          <button
            onClick={() => {
              if (!reviewData) handleRunReviews();
              else setActiveTab('reviews');
            }}
            className={`py-3 text-xs font-semibold border-b-2 transition-colors inline-flex items-center gap-1.5 ${
              activeTab === 'reviews'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Star className="w-3.5 h-3.5" />
            <span>Review Voice (VoC)</span>
          </button>
          <button
            onClick={() => {
              if (newsSignals.length === 0) handleRunNews();
              else setActiveTab('news');
            }}
            className={`py-3 text-xs font-semibold border-b-2 transition-colors inline-flex items-center gap-1.5 ${
              activeTab === 'news'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Newspaper className="w-3.5 h-3.5" />
            <span>Market News Signals</span>
          </button>
          <button
            onClick={() => {
              if (!changeData) handleRunChanges();
              else setActiveTab('changes');
            }}
            className={`py-3 text-xs font-semibold border-b-2 transition-colors inline-flex items-center gap-1.5 ${
              activeTab === 'changes'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>SERP Change Detection</span>
          </button>
        </nav>
      </div>

      {/* Tab 1: Content Gaps */}
      {activeTab === 'gaps' && (
        <div className="space-y-4">
          {loading ? (
            <div className="p-12 text-center text-sm text-slate-400">Loading content gaps...</div>
          ) : contentGapsList.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-sm">
              <div className="flex items-center justify-center mb-3">
                <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-xs">
                  <FileText className="w-6 h-6" />
                </div>
              </div>
              <h3 className="text-sm font-semibold text-slate-800">No Content Gaps Detected Yet</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Compare your site against confirmed competitors to discover missing high-value service pages, location guides, and customer FAQs.
              </p>
              <button
                onClick={() => handleRunContentGaps()}
                disabled={analyzingGaps}
                className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 shadow-sm"
              >
                {analyzingGaps ? 'Analyzing...' : 'Run Content Gap Analysis'}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {contentGapsList.map((gap) => (
                <div
                  key={gap.id}
                  className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3 hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase ${
                            gap.priority === 'P0'
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : gap.priority === 'P1'
                              ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {gap.priority} Priority
                        </span>
                        <span className="px-2 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-600 rounded capitalize">
                          {gap.recommendedPageType} page
                        </span>
                        <span className="px-2 py-0.5 text-[10px] font-medium bg-purple-50 text-purple-700 border border-purple-100 rounded capitalize">
                          {gap.targetIntent}
                        </span>
                      </div>
                      <h3 className="font-bold text-slate-900 text-sm mt-2">{gap.topic}</h3>
                    </div>

                    <select
                      value={gap.status}
                      onChange={(e) => handleUpdateGapStatus(gap.id, e.target.value as any)}
                      className="text-[11px] font-medium border border-slate-200 rounded px-2 py-1 bg-white text-slate-700"
                    >
                      <option value="open">Open</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="dismissed">Dismissed</option>
                    </select>
                  </div>

                  <div className="bg-slate-50 rounded-lg p-3 text-xs space-y-1.5 border border-slate-100">
                    <p className="text-slate-500 font-semibold text-[11px]">Suggested SEO Title:</p>
                    <p className="font-medium text-slate-800 italic">"{gap.suggestedTitle}"</p>

                    {gap.suggestedHeadings && gap.suggestedHeadings.length > 0 && (
                      <div>
                        <p className="text-slate-500 font-semibold text-[11px] mt-2">Recommended Sections:</p>
                        <ul className="list-disc list-inside text-slate-700 text-[11px] space-y-0.5 mt-0.5">
                          {gap.suggestedHeadings.slice(0, 3).map((h, i) => (
                            <li key={i}>{h}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {gap.suggestedFaqs && gap.suggestedFaqs.length > 0 && (
                      <div>
                        <p className="text-slate-500 font-semibold text-[11px] mt-2">FAQs to Answer:</p>
                        <ul className="list-disc list-inside text-slate-700 text-[11px] space-y-0.5 mt-0.5">
                          {gap.suggestedFaqs.slice(0, 2).map((q, i) => (
                            <li key={i}>{q}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {gap.evidence?.competitorDomain && (
                    <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1">
                      <span>Outranked by: <strong className="text-slate-600">{gap.evidence.competitorDomain}</strong></span>
                      <span className="capitalize text-slate-500">Impact: {gap.impact} • Effort: {gap.effort}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Competitor Messaging Analysis */}
      {activeTab === 'messaging' && (
        <div className="space-y-6">
          {analyzingMessaging ? (
            <div className="p-16 text-center bg-white rounded-2xl border border-slate-200 shadow-xs">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-900">Scraping & Analyzing Competitor Positioning...</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Extracting live homepage titles, lead offers, CTAs, and verified hooks across your direct search competitors.
              </p>
            </div>
          ) : messagingData ? (
            <>
              {/* Header Action Bar */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
                      Brand Positioning Radar
                    </span>
                    <span className="text-xs text-slate-400">
                      {businesses.find((b) => b.id === selectedBizId)?.name || 'Selected Business'}
                    </span>
                  </div>
                  <h2 className="text-base font-bold text-slate-900 mt-1 flex items-center gap-2">
                    Competitor Messaging & Positioning Patterns
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Live verified headlines, lead offers, guarantees, and conversion hooks ground-truthed against real local competitors.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setBattlecardOpen(!battlecardOpen)}
                    className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1.5 transition border border-slate-200 shadow-2xs cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5 text-indigo-600" />
                    <span>{battlecardOpen ? 'Close Battlecard' : '1-Page Sales Battlecard'}</span>
                  </button>

                  <button
                    onClick={handleRunMessaging}
                    disabled={analyzingMessaging}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${analyzingMessaging ? 'animate-spin' : ''}`} />
                    <span>Re-Scan Live Messaging</span>
                  </button>
                </div>
              </div>

              {/* 1-Page Executive Sales Battlecard */}
              {battlecardOpen && (
                <div className="bg-white border-2 border-indigo-200 rounded-2xl p-6 shadow-md animate-fade-in space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                    <div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-indigo-50 text-indigo-700 border border-indigo-200">
                        Front-Desk &amp; Sales Pitch Brief
                      </span>
                      <h3 className="text-base font-black text-slate-900 mt-1">
                        Executive Competitor Counter-Battlecard
                      </h3>
                      <p className="text-xs text-slate-500">
                        Printable 1-page intelligence brief to help staff win prospects inquiring about local rivals.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          const markdownText = `# COMPETITOR COUNTER-BATTLECARD\n\n## Market Summary\n${messagingData.overallTakeaway}\n\n## Competitor Vulnerabilities to Exploit\n${messagingData.competitors.map((c) => `- ${c.competitorName} (${c.domain}): ${c.primaryOffer || c.differentiator}`).join('\n')}\n\n## Ready-to-Deploy Counter Headlines\n${(messagingData.deployableHeadlines || []).map((h) => `- ${h.hook}: ${h.rationale}`).join('\n')}`;
                          handleCopy('battlecard_full', markdownText);
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 flex items-center gap-1.5 transition"
                      >
                        {copiedKey === 'battlecard_full' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                        <span>{copiedKey === 'battlecard_full' ? 'Copied Battlecard!' : 'Copy Markdown'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (typeof window !== 'undefined') window.print();
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 flex items-center gap-1.5 transition"
                      >
                        <Printer className="w-3.5 h-3.5 text-slate-500" />
                        <span>Print</span>
                      </button>
                    </div>
                  </div>

                  {/* 3 Core Battlecard Pillars */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    {/* Column 1: The "Why Choose Us" Talk Track */}
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600">
                        1. Primary Winning Angle
                      </span>
                      <h4 className="font-bold text-slate-900">
                        Guaranteed Upfront Certainty
                      </h4>
                      <p className="text-slate-600 text-[11px] leading-relaxed">
                        &quot;Unlike other shops where pricing is ambiguous until the final bill, we provide 100% upfront quotes and same-day scheduling guaranteed.&quot;
                      </p>
                    </div>

                    {/* Column 2: What to Say When Prospect Mentions a Rival */}
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-600">
                        2. Objection Neutralizer
                      </span>
                      <h4 className="font-bold text-slate-900">
                        If They Mention Calling Rivals
                      </h4>
                      <p className="text-slate-600 text-[11px] leading-relaxed">
                        &quot;Many clients who called other providers found wait times excessive or were asked to leave a voicemail. We can lock in your exact confirmed slot right now.&quot;
                      </p>
                    </div>

                    {/* Column 3: High Converting Offer */}
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600">
                        3. Deal Closer Offer
                      </span>
                      <h4 className="font-bold text-slate-900">
                        Zero-Risk Guarantee Hook
                      </h4>
                      <p className="text-slate-600 text-[11px] leading-relaxed">
                        &quot;We stand behind our work with our 100% satisfaction commitment. If you aren&apos;t completely satisfied, we make it right at zero additional cost.&quot;
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Strategic Market Summary */}
              <div className="bg-gradient-to-r from-indigo-900 to-slate-900 text-white rounded-2xl p-6 shadow-sm space-y-2">
                <div className="flex items-center gap-2 text-indigo-300">
                  <Megaphone className="w-4 h-4" />
                  <span className="text-[10px] font-extrabold uppercase tracking-wider">
                    Executive Market Takeaway
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-indigo-50 leading-relaxed font-medium">
                  {messagingData.overallTakeaway}
                </p>
              </div>

              {/* ── 1. MARKET FEATURE & CONVERSION HOOK MATRIX ── */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs space-y-0">
                <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-500" />
                      <span>Market Feature & Conversion Hook Matrix</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Direct audit of which core booking capabilities your competitors actively promote on the web.
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 self-start sm:self-auto">
                    {messagingData.competitors.length} Rivals Audited
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 text-[11px]">
                        <th className="py-3 px-4 font-bold">Competitor</th>
                        <th className="py-3 px-3 font-bold text-center">📱 Online Booking</th>
                        <th className="py-3 px-3 font-bold text-center">⚡ Same-Day / Emergency</th>
                        <th className="py-3 px-3 font-bold text-center">💳 Clear Pricing / Deals</th>
                        <th className="py-3 px-3 font-bold text-center">🛡️ Guarantees</th>
                        <th className="py-3 px-4 font-bold">Primary Lead Hook</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {messagingData.competitors.map((c, i) => (
                        <tr key={i} className="hover:bg-slate-50/80 transition">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-900">{c.competitorName}</span>
                              {c.sourceUrl && (
                                <a
                                  href={c.sourceUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-slate-400 hover:text-indigo-600 transition"
                                  title="View Competitor Website"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono block">{c.domain}</span>
                          </td>
                          <td className="py-3.5 px-3 text-center">
                            {c.features?.hasOnlineBooking ? (
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </span>
                            ) : (
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-50 text-slate-300">
                                <X className="w-3.5 h-3.5" />
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-3 text-center">
                            {c.features?.hasEmergencyService || c.speedOfService?.toLowerCase().includes('same day') || c.speedOfService?.toLowerCase().includes('emergency') ? (
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </span>
                            ) : (
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-50 text-slate-300">
                                <X className="w-3.5 h-3.5" />
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-3 text-center">
                            {c.features?.hasTransparentPricing || Boolean(c.priceLanguage) ? (
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </span>
                            ) : (
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-50 text-slate-300">
                                <X className="w-3.5 h-3.5" />
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-3 text-center">
                            {c.features?.hasSatisfactionGuarantee || Boolean(c.guarantees) ? (
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </span>
                            ) : (
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-50 text-slate-300">
                                <X className="w-3.5 h-3.5" />
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-semibold text-slate-800 text-xs block">
                              {c.primaryOffer || c.headline}
                            </span>
                            {c.priceLanguage && (
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-100 inline-block mt-0.5">
                                {c.priceLanguage}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ── 2. OBSERVED MARKET PATTERNS (Evidence vs Action) ── */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Target className="w-4 h-4 text-indigo-600" />
                  <span>Observed Competitor Market Patterns</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {messagingData.marketPatterns.map((p, idx) => (
                    <div
                      key={idx}
                      className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3 flex flex-col justify-between"
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 font-extrabold text-[11px] flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <h4 className="font-bold text-xs text-slate-900 leading-snug">{p.pattern}</h4>
                        </div>

                        <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-100 space-y-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                            Direct Grounded Evidence:
                          </span>
                          <p className="text-slate-700 italic text-[11px] leading-relaxed">
                            &quot;{p.observedFacts.join('&quot; &bull; &quot;')}&quot;
                          </p>
                        </div>

                        <div className="text-xs text-slate-600">
                          <strong className="text-slate-800 block text-[11px] mb-0.5">Market Meaning:</strong>
                          <p className="text-[11px] leading-relaxed">{p.aiInterpretation}</p>
                        </div>
                      </div>

                      <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 text-xs">
                        <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block mb-0.5">
                          Recommended Action for Your Site:
                        </span>
                        <p className="text-indigo-950 font-medium text-[11px] leading-relaxed">
                          {p.recommendedAction}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── 3. DETAILED COMPETITOR POSITIONING MATRIX ── */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Swords className="w-4 h-4 text-indigo-600" />
                  <span>Competitor Landing Copy & Verified Evidence</span>
                </h3>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {messagingData.competitors.map((c, i) => (
                    <div
                      key={i}
                      className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3.5 flex flex-col justify-between"
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <h4 className="font-bold text-sm text-slate-900">{c.competitorName}</h4>
                              {c.sourceUrl && (
                                <a
                                  href={c.sourceUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-slate-400 hover:text-indigo-600 transition"
                                  title="Open Competitor URL"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono">{c.domain}</span>
                          </div>

                          <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded border shrink-0 ${
                            c.isLiveGrounded !== false
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                          }`}>
                            {c.isLiveGrounded !== false ? '✓ Live Scraped Fact' : 'SERP Evidence'}
                          </span>
                        </div>

                        {/* Primary Headline & Lead Offer */}
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                            Primary Hook / Headline:
                          </span>
                          <p className="text-xs font-bold text-slate-900">
                            &quot;{c.headline || c.primaryOffer}&quot;
                          </p>
                          {c.primaryOffer && c.primaryOffer !== c.headline && (
                            <p className="text-[11px] text-indigo-700 font-medium pt-0.5">
                              Offer: {c.primaryOffer}
                            </p>
                          )}
                        </div>

                        {/* Source Evidence Quote */}
                        {c.sourceEvidence && (
                          <div className="p-2.5 rounded-lg bg-amber-50/50 border border-amber-100 text-[11px]">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block">
                              Observed Snippet / Proof:
                            </span>
                            <p className="text-slate-700 italic mt-0.5">
                              &quot;{c.sourceEvidence}&quot;
                            </p>
                          </div>
                        )}

                        {/* Differentiator & CTA */}
                        <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                          <div>
                            <span className="text-[10px] text-slate-400 font-semibold block">Differentiator:</span>
                            <p className="text-slate-700 text-[11px] font-medium mt-0.5">{c.differentiator}</p>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 font-semibold block">Primary CTA:</span>
                            <span className="inline-block mt-0.5 px-2 py-0.5 bg-slate-100 text-slate-800 rounded font-semibold text-[10px]">
                              {c.cta}
                            </span>
                          </div>
                        </div>

                        {/* Trust Signals */}
                        {c.trustSignals && c.trustSignals.length > 0 && (
                          <div className="pt-1">
                            <span className="text-[10px] text-slate-400 font-semibold block mb-1">
                              Trust Signals:
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {c.trustSignals.map((t, idx) => (
                                <span
                                  key={idx}
                                  className="text-[10px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md font-medium"
                                >
                                  {t}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── 4. DEPLOYABLE HIGH-CONVERTING HEADLINES (COPY-TO-CLIPBOARD) ── */}
              {messagingData.deployableHeadlines && messagingData.deployableHeadlines.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-indigo-600" />
                      <span>Ready-to-Deploy Counter-Positioning Headlines</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      High-converting hero headlines crafted from competitor positioning voids. Copy directly into your website hero or Google Ad extensions.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {messagingData.deployableHeadlines.map((head, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-white hover:border-indigo-300 transition space-y-2 flex flex-col justify-between"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                              {head.targetLocationOrService || 'Hero / Homepage'}
                            </span>
                            <button
                              onClick={() => handleCopy(`dep_head_${idx}`, head.hook)}
                              className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-indigo-600 bg-white hover:bg-indigo-50 rounded-lg border border-slate-200 transition flex items-center gap-1"
                            >
                              <Copy className="w-3 h-3" />
                              <span>{copiedKey === `dep_head_${idx}` ? 'Copied!' : 'Copy'}</span>
                            </button>
                          </div>

                          <h4 className="text-xs font-bold text-slate-900 leading-snug">
                            &quot;{head.hook}&quot;
                          </h4>

                          <p className="text-[11px] text-slate-500 leading-relaxed">
                            {head.rationale}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 shadow-xs">
              <Megaphone className="w-10 h-10 text-indigo-600 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-900">Competitor Positioning & Conversion Hooks</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-6">
                Scan your confirmed search competitors to extract real landing page hooks, lead offers, and conversion feature matrices.
              </p>
              <button
                onClick={handleRunMessaging}
                className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 shadow-sm transition inline-flex items-center gap-2"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Scan Live Competitor Messaging</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Customer Review Voice (VoC) */}
      {activeTab === 'reviews' && (
        <div className="space-y-6">
          {analyzingReviews ? (
            <div className="p-16 text-center bg-white rounded-2xl border border-slate-200 shadow-xs">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-900">Auditing Customer Voice & Competitor Reviews...</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Extracting competitor vulnerabilities, computing Google 3-Pack review velocity targets, and generating high-converting review request copy.
              </p>
            </div>
          ) : reviewData ? (
            <>
              {/* Header Action Bar */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
                      VoC Intelligence Suite
                    </span>
                    <span className="text-xs text-slate-400">
                      {businesses.find(b => b.id === selectedBizId)?.name || 'Selected Business'}
                    </span>
                  </div>
                  <h2 className="text-base font-bold text-slate-900 mt-1 flex items-center gap-2">
                    Customer Voice & Review Intelligence
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Counter-position against rival complaints, calculate Google 3-Pack review velocity, and deploy automated 5-star review funnels.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <button
                    onClick={() => setShowQrModal(true)}
                    className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    <QrCode className="w-3.5 h-3.5 text-slate-600" />
                    <span>QR Stand Card</span>
                  </button>
                  <button
                    onClick={handleRunReviews}
                    disabled={analyzingReviews}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${analyzingReviews ? 'animate-spin' : ''}`} />
                    <span>Re-Analyze Market VoC</span>
                  </button>
                </div>
              </div>

              {/* PILLAR 1: Competitor Vulnerabilities & Counter-Positioning */}
              <div id="voc-vulnerabilities" className="space-y-4 pt-1 scroll-mt-16">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Swords className="w-4 h-4 text-indigo-600" />
                      <span>1. Competitor Weakness & Sentiment Void Matrix</span>
                      <span className="text-[11px] font-normal text-slate-400">
                        (Direct Counter-Positioning Assets)
                      </span>
                    </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        These are recurring 1★–3★ complaints at rival businesses. Use our counter-positioning headlines and trust badges to win defecting customers.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {(reviewData.competitorVulnerabilities || []).map((vuln, idx) => (
                      <div
                        key={idx}
                        className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-slate-300 transition space-y-3.5"
                      >
                        {/* Rival Header */}
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-100">
                              Rival Weakness
                            </span>
                            <h4 className="text-sm font-bold text-slate-900 mt-1">
                              {vuln.weaknessTheme}
                            </h4>
                            <p className="text-xs text-slate-500">
                              Observed at: <span className="font-semibold text-slate-700">{vuln.competitorName}</span>
                            </p>
                          </div>
                          <div className="p-2 rounded-xl bg-rose-50 text-rose-600 shrink-0">
                            <AlertTriangle className="w-4 h-4" />
                          </div>
                        </div>

                        {/* Complaint Sample */}
                        <div className="p-3 rounded-xl bg-rose-50/40 border border-rose-100 text-xs">
                          <span className="text-[10px] font-bold uppercase text-rose-800 tracking-wider block">
                            Real Customer Complaint
                          </span>
                          <p className="text-slate-700 italic mt-0.5">
                            &quot;{vuln.complaintSample}&quot;
                          </p>
                        </div>

                        {/* Counter-Positioning Asset */}
                        <div className="p-3.5 rounded-xl bg-indigo-50/50 border border-indigo-100 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-extrabold uppercase text-indigo-700 tracking-wider">
                              Your Counter-Positioning Headline
                            </span>
                            <button
                              onClick={() => handleCopy(`head_${idx}`, vuln.counterPositioningHeadline)}
                              className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                            >
                              <Copy className="w-3 h-3" />
                              <span>{copiedKey === `head_${idx}` ? 'Copied!' : 'Copy'}</span>
                            </button>
                          </div>
                          <p className="text-xs font-bold text-slate-900">
                            &quot;{vuln.counterPositioningHeadline}&quot;
                          </p>
                        </div>

                        {/* Trust Badge & Exploit Strategy */}
                        <div className="pt-1 flex items-center justify-between gap-3 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-semibold text-slate-400">Trust Badge:</span>
                            <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 inline-flex items-center gap-1.5">
                              {vuln.trustBadgeCopy}
                            </span>
                            <button
                              onClick={() => handleCopy(`badge_${idx}`, vuln.trustBadgeCopy)}
                              className="p-1 text-slate-400 hover:text-slate-600"
                              title="Copy Trust Badge"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        <div className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          <strong className="text-slate-700">Exploit Strategy:</strong> {vuln.exploitStrategy}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              {/* PILLAR 2: Google 3-Pack Review Velocity & Calculator */}
              <div id="voc-velocity" className="space-y-5 pt-8 border-t border-slate-200 scroll-mt-16">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Target className="w-4 h-4 text-indigo-600" />
                      <span>2. Google 3-Pack Review Velocity Benchmark & Pace Calculator</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Audited review count and velocity compared against local search leaders to calculate catch-up milestones.
                    </p>
                  </div>
                </div>

                {/* Benchmarking Summary */}
                  {reviewData.velocityBenchmark && (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
                          <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                            Your Profile
                          </span>
                          <div className="text-2xl font-black text-slate-900 mt-1 flex items-baseline gap-1.5">
                            <span>{reviewData.velocityBenchmark.currentReviews}</span>
                            <span className="text-xs font-semibold text-amber-500 flex items-center gap-0.5">
                              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                              {reviewData.velocityBenchmark.currentRating}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">Total audited reviews</p>
                        </div>

                        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
                          <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                            #1 Market Leader
                          </span>
                          <div className="text-2xl font-black text-slate-900 mt-1 flex items-baseline gap-1.5">
                            <span>{reviewData.velocityBenchmark.leaderReviews}</span>
                            <span className="text-xs font-semibold text-amber-500 flex items-center gap-0.5">
                              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                              {reviewData.velocityBenchmark.leaderRating}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5 truncate" title={reviewData.velocityBenchmark.leaderName}>
                            {reviewData.velocityBenchmark.leaderName}
                          </p>
                        </div>

                        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
                          <span className="text-[10px] font-bold uppercase text-indigo-600 tracking-wider">
                            Review Gap
                          </span>
                          <div className="text-2xl font-black text-indigo-600 mt-1">
                            +{reviewData.velocityBenchmark.gapReviews}
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">5-star reviews to lead pack</p>
                        </div>

                        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
                          <span className="text-[10px] font-bold uppercase text-emerald-600 tracking-wider">
                            Opportunity Status
                          </span>
                          <div className="text-sm font-bold text-emerald-700 mt-2 flex items-center gap-1.5">
                            <Zap className="w-4 h-4 text-emerald-500" />
                            <span>Leader Stagnant</span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {reviewData.velocityBenchmark.leaderDaysSinceLastReview || 35} days since rival's last review
                          </p>
                        </div>
                      </div>

                      {/* Strategic Velocity Paces */}
                      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                          <div>
                            <h3 className="text-sm font-bold text-slate-900">
                              Target Acquisition Paces to Overtake #1 Rank
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                              Google Maps algorithm weighs both total reviews and 30-day velocity. Choose your acquisition sprint speed:
                            </p>
                          </div>
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 self-start">
                            Pace Calculator
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="p-4 rounded-xl border-2 border-indigo-600 bg-indigo-50/20 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-indigo-700 flex items-center gap-1">
                                <Zap className="w-3.5 h-3.5" />
                                <span>Sprint Pace (30 Days)</span>
                              </span>
                              <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-indigo-600 text-white">
                                Fast Track
                              </span>
                            </div>
                            <div className="text-2xl font-black text-slate-900">
                              {reviewData.velocityBenchmark.weeklyPaceNeeded30Days}{' '}
                              <span className="text-xs font-semibold text-slate-500">reviews / week</span>
                            </div>
                            <p className="text-[11px] text-slate-500">
                              Requires ~{Math.ceil(reviewData.velocityBenchmark.weeklyPaceNeeded30Days * 4.2)} total verified reviews over 30 days to displace the market leader.
                            </p>
                          </div>

                          <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-900 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Steady Pace (60 Days)</span>
                              </span>
                              <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                                Recommended
                              </span>
                            </div>
                            <div className="text-2xl font-black text-slate-900">
                              {reviewData.velocityBenchmark.weeklyPaceNeeded60Days}{' '}
                              <span className="text-xs font-semibold text-slate-500">reviews / week</span>
                            </div>
                            <p className="text-[11px] text-slate-500">
                              Natural organic velocity. Zero suspicion of artificial review spikes by Google anti-spam filters.
                            </p>
                          </div>

                          <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-900 flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5 text-slate-500" />
                                <span>Sustainable (90 Days)</span>
                              </span>
                              <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                                Low Touch
                              </span>
                            </div>
                            <div className="text-2xl font-black text-slate-900">
                              {reviewData.velocityBenchmark.weeklyPaceNeeded90Days}{' '}
                              <span className="text-xs font-semibold text-slate-500">reviews / week</span>
                            </div>
                            <p className="text-[11px] text-slate-500">
                              Comfortable routine using automated post-visit SMS/Email triggers at checkout.
                            </p>
                          </div>
                        </div>

                        {/* Interactive Target Customizer */}
                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                              <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                                <Calculator className="w-3.5 h-3.5 text-indigo-600" />
                                <span>Custom Goal Simulator</span>
                              </span>
                              <p className="text-[11px] text-slate-500">
                                What if you want to reach a specific review milestone?
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-600">Target Reviews:</span>
                              <input
                                type="number"
                                min={reviewData.velocityBenchmark.currentReviews + 1}
                                max={5000}
                                value={customTargetReviews ?? (reviewData.velocityBenchmark.leaderReviews + 15)}
                                onChange={(e) => setCustomTargetReviews(Number(e.target.value))}
                                className="w-24 px-2.5 py-1 text-xs font-bold border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                              />
                            </div>
                          </div>

                          {(() => {
                            const target = customTargetReviews ?? (reviewData.velocityBenchmark.leaderReviews + 15);
                            const current = reviewData.velocityBenchmark.currentReviews;
                            const diff = Math.max(1, target - current);
                            const weekly30 = Math.max(1, Math.ceil(diff / 4.2));
                            const weekly60 = Math.max(1, Math.ceil(diff / 8.5));
                            const weekly90 = Math.max(1, Math.ceil(diff / 12.8));
                            return (
                              <div className="text-xs text-slate-700 flex flex-wrap items-center gap-x-4 gap-y-2 pt-1 border-t border-slate-200/80">
                                <span>
                                  To reach <strong>{target} reviews</strong> (+{diff} new reviews):
                                </span>
                                <span className="text-indigo-700 font-semibold">
                                  30-Day: <strong>{weekly30}/wk</strong>
                                </span>
                                <span className="text-emerald-700 font-semibold">
                                  60-Day: <strong>{weekly60}/wk</strong>
                                </span>
                                <span className="text-slate-600 font-semibold">
                                  90-Day: <strong>{weekly90}/wk</strong>
                                </span>
                              </div>
                            );
                          })()}
                        </div>

                        {/* Strategic Advice Card */}
                        <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200 text-xs text-amber-900">
                          <strong className="block font-bold text-amber-950 mb-1">
                            Market Strategy & Competitor Intelligence:
                          </strong>
                          {reviewData.velocityBenchmark.strategicAdvice}
                        </div>
                      </div>
                    </>
                  )}
                </div>

              {/* PILLAR 3: Review Request Funnel & QR Toolkit */}
              <div id="voc-funnel" className="space-y-5 pt-8 border-t border-slate-200 scroll-mt-16">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Send className="w-4 h-4 text-indigo-600" />
                    <span>3. Multi-Channel Review Generation Funnel</span>
                    <span className="text-[11px] font-normal text-slate-400">(Ready-to-Deploy Copy)</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Personalized outreach copy engineered with natural customer vocabulary to maximize Google review conversion.
                  </p>
                </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {(reviewData.requestTemplates || []).map((tmpl, idx) => (
                      <div
                        key={idx}
                        className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between space-y-4"
                      >
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                              tmpl.channel === 'sms'
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-100'
                                : tmpl.channel === 'email'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                : 'bg-amber-50 text-amber-700 border-amber-100'
                            }`}>
                              {tmpl.channel.toUpperCase()}
                            </span>
                            <span className="text-[11px] text-slate-400 font-medium">
                              {tmpl.timing}
                            </span>
                          </div>

                          <h4 className="text-xs font-bold text-slate-900">{tmpl.title}</h4>
                          <p className="text-[11px] text-slate-400">{tmpl.previewText}</p>

                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 font-mono text-[11px] text-slate-800 whitespace-pre-wrap leading-relaxed">
                            {tmpl.body}
                          </div>
                        </div>

                        <button
                          onClick={() => handleCopy(`tmpl_${idx}`, tmpl.body)}
                          className="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>{copiedKey === `tmpl_${idx}` ? 'Copied to Clipboard!' : 'Copy Template'}</span>
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* QR Card Prompt Banner */}
                  <div className="bg-gradient-to-r from-indigo-900 to-slate-900 text-white rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-300">
                        In-Store / Clinic Checkout Stand
                      </span>
                      <h4 className="text-sm font-bold text-white">
                        Deploy a Physical NFC/QR Google Review Counter Card
                      </h4>
                      <p className="text-xs text-indigo-200 max-w-xl">
                        Customers are 4x more likely to leave a 5-star review while still physically on site. Open our printable QR display stand card for your checkout counter.
                      </p>
                    </div>
                    <button
                      onClick={() => setShowQrModal(true)}
                      className="px-5 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-xs flex items-center justify-center gap-2 shrink-0 transition"
                    >
                      <QrCode className="w-4 h-4" />
                      <span>Open QR Stand Card</span>
                    </button>
                  </div>
                </div>

              {/* PILLAR 4: AI Reputation Shield & De-escalator */}
              <div id="voc-shield" className="space-y-6 pt-8 border-t border-slate-200 scroll-mt-16">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-rose-600" />
                    <span>4. AI Reputation Shield & Crisis De-escalator</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Google algorithms evaluate owner responses. Generate diplomatic, high-EQ public replies that neutralize anger, weave in positive local SEO keywords, and move disputes to private phone/email.
                  </p>
                </div>

                  {/* Interactive Live Generator */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
                    <div className="border-b border-slate-100 pb-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                        Interactive Review Response Generator
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Received a negative or mixed review on Google? Paste it below to generate a tailored, SEO-protective public reply.
                      </p>
                    </div>

                    <form onSubmit={handleGenerateCustomReply} className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-2">
                          <label className="text-[11px] font-bold text-slate-700 block mb-1">
                            Reviewer Name (Optional)
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Rahul S. or Customer"
                            value={customReviewerName}
                            onChange={(e) => setCustomReviewerName(e.target.value)}
                            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-700 block mb-1">
                            Star Rating Received
                          </label>
                          <select
                            value={customStarRating}
                            onChange={(e) => setCustomStarRating(Number(e.target.value))}
                            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-semibold text-slate-800"
                          >
                            <option value={1}>⭐ 1 Star (Hostile / Urgent)</option>
                            <option value={2}>⭐⭐ 2 Stars (Disappointed)</option>
                            <option value={3}>⭐⭐⭐ 3 Stars (Mixed Feedback)</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">
                          Customer Review Text
                        </label>
                        <textarea
                          rows={3}
                          placeholder="Paste the customer's exact review here (e.g. 'I was charged double what they promised and waited 40 minutes in the lobby...')"
                          value={customReviewInput}
                          onChange={(e) => setCustomReviewInput(e.target.value)}
                          className="w-full p-3 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none leading-relaxed"
                          required
                        />
                      </div>

                      {shieldError && (
                        <div className="p-3 rounded-xl bg-rose-50 text-rose-700 text-xs border border-rose-200">
                          {shieldError}
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-slate-400">
                          Embeds local service keywords & avoids legal liability admission.
                        </span>
                        <button
                          type="submit"
                          disabled={isGeneratingReply || !customReviewInput.trim()}
                          className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center gap-2 shadow-sm transition disabled:opacity-50"
                        >
                          {isGeneratingReply ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Drafting Diplomatic Response...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>Generate Diplomatic SEO Response</span>
                            </>
                          )}
                        </button>
                      </div>
                    </form>

                    {/* Result Card */}
                    {generatedReplyResult && (
                      <div className="mt-4 p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-3 animate-in fade-in duration-200">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            Recommended Public Reply
                          </span>
                          <button
                            onClick={() => handleCopy('custom_reply', generatedReplyResult.suggestedReply)}
                            className="px-3 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 flex items-center gap-1.5 transition"
                          >
                            <Copy className="w-3 h-3 text-slate-500" />
                            <span>{copiedKey === 'custom_reply' ? 'Copied!' : 'Copy Reply'}</span>
                          </button>
                        </div>

                        <p className="text-xs text-slate-900 font-medium whitespace-pre-wrap leading-relaxed bg-white p-4 rounded-xl border border-slate-200">
                          {generatedReplyResult.suggestedReply}
                        </p>

                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <span className="text-[10px] font-bold text-slate-500">SEO Keywords Embedded:</span>
                          {generatedReplyResult.seoKeywordsIncluded.map((kw, i) => (
                            <span key={i} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[10px] font-semibold border border-indigo-100">
                              ✓ {kw}
                            </span>
                          ))}
                        </div>

                        <div className="text-[11px] text-slate-600 bg-white p-3 rounded-lg border border-slate-100">
                          <strong className="text-slate-800">Internal Staff Mitigation:</strong> {generatedReplyResult.internalStaffAction}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Pre-Analyzed Sample Scenarios */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Standard Market De-escalation Scenarios
                    </h4>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {(reviewData.crisisResponses || []).map((crisis, idx) => (
                        <div key={idx} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-100">
                              {crisis.starRating}★ Review Scenario
                            </span>
                            <span className="text-[11px] text-slate-400 font-medium">
                              Issue: {crisis.detectedIssue}
                            </span>
                          </div>

                          <div className="p-2.5 rounded-lg bg-slate-50 text-xs text-slate-700 italic border border-slate-100">
                            &quot;{crisis.customerReviewSnippet}&quot;
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">
                                Recommended Public Reply
                              </span>
                              <button
                                onClick={() => handleCopy(`crisis_${idx}`, crisis.suggestedPublicResponse)}
                                className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
                              >
                                <Copy className="w-3 h-3" />
                                <span>{copiedKey === `crisis_${idx}` ? 'Copied' : 'Copy'}</span>
                              </button>
                            </div>
                            <p className="text-xs text-slate-800 leading-relaxed bg-indigo-50/20 p-3 rounded-xl border border-indigo-100/60">
                              {crisis.suggestedPublicResponse}
                            </p>
                          </div>

                          <div className="text-[11px] text-slate-500 pt-1">
                            <strong className="text-slate-700">Staff Action:</strong> {crisis.internalStaffAction}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

              {/* PILLAR 5: VoC Themes & High-Converting Copy */}
              <div id="voc-themes" className="space-y-6 pt-8 border-t border-slate-200 scroll-mt-16">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Smile className="w-4 h-4 text-emerald-600" />
                      <span>5. VoC Themes & High-Converting Copy Opportunities</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Synthesized customer sentiment themes and ready-to-deploy headline copy extracted from natural customer vocabulary.
                    </p>
                  </div>
                </div>

                {/* Praise vs Complaints Row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-emerald-50/60 border border-emerald-100 rounded-2xl p-5 space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700">
                          <ThumbsUp className="w-4 h-4" />
                        </div>
                        <h3 className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                          Top Customer Praise Elements
                        </h3>
                      </div>
                      <ul className="space-y-1.5 text-xs text-emerald-900">
                        {reviewData.commonPraise.map((p, i) => (
                          <li key={i} className="flex items-center gap-2">
                            <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>{p}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="bg-rose-50/60 border border-rose-100 rounded-2xl p-5 space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-rose-100 text-rose-700">
                          <ThumbsDown className="w-4 h-4" />
                        </div>
                        <h3 className="text-xs font-bold text-rose-950 uppercase tracking-wider">
                          Recurring Market Complaints
                        </h3>
                      </div>
                      <ul className="space-y-1.5 text-xs text-rose-900">
                        {reviewData.commonComplaints.map((c, i) => (
                          <li key={i} className="flex items-center gap-2">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                            <span>{c}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Website Copy Opportunities */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-900">
                        High-Converting Website Copy Opportunities
                      </h3>
                      <span className="text-xs text-slate-500">
                        Derived from natural buyer vocabulary
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {reviewData.websiteCopyOpportunities.map((op, idx) => (
                        <div key={idx} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                              {op.targetPage}
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium">Theme: {op.theme}</span>
                          </div>

                          <div className="text-xs">
                            <span className="text-[10px] text-slate-400 block font-semibold">Natural Customer Vocabulary:</span>
                            <p className="text-slate-700 italic text-[11px] mt-0.5">&quot;{op.customerQuoteOrVocabulary}&quot;</p>
                          </div>

                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-slate-400 block font-semibold">Suggested Headline:</span>
                              <button
                                onClick={() => handleCopy(`voc_copy_${idx}`, op.suggestedCopyHeadline)}
                                className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800"
                              >
                                {copiedKey === `voc_copy_${idx}` ? 'Copied!' : 'Copy'}
                              </button>
                            </div>
                            <p className="font-bold text-slate-900 text-xs mt-0.5">
                              &quot;{op.suggestedCopyHeadline}&quot;
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Sentiment Themes Breakdown */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-slate-900">
                      Extracted Customer Review Themes
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {reviewData.themes.map((t, idx) => (
                        <div key={idx} className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-2">
                          <div className="flex items-center justify-between">
                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                              t.sentiment === 'positive'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : t.sentiment === 'negative'
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : 'bg-slate-100 text-slate-700'
                            }`}>
                              {t.sentiment}
                            </span>
                            <span className="text-xs font-semibold text-slate-500">
                              ~{t.frequency} mentions
                            </span>
                          </div>
                          <h4 className="text-xs font-bold text-slate-900">{t.theme}</h4>
                          {t.examples.length > 0 && (
                            <p className="text-[11px] text-slate-500 italic">
                              &quot;{t.examples[0]}&quot;
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
            </>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center shadow-xs">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mx-auto mb-4">
                <Star className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Customer Voice & Review Intelligence</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1.5 mb-6">
                Run an automated audit across public competitor reviews to uncover competitor vulnerabilities, calculate your Google 3-Pack review velocity catch-up target, and generate ready-to-deploy review request funnels.
              </p>
              <button
                onClick={handleRunReviews}
                disabled={analyzingReviews}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition inline-flex items-center gap-2 disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                <span>Run Full Review Intelligence Audit</span>
              </button>
            </div>
          )}

          {/* QR Code Counter Stand Modal */}
          {showQrModal && (
            <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
              <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 text-center border border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                    Printable Counter Card
                  </span>
                  <button
                    onClick={() => setShowQrModal(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-1">
                  <h3 className="text-base font-black text-slate-900">
                    {businesses.find(b => b.id === selectedBizId)?.name || 'Our Business'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    &quot;Loved your experience today? Tap or scan to leave a 5-star review!&quot;
                  </p>
                </div>

                {/* QR Display */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 inline-block mx-auto">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                      `https://search.google.com/local/writereview?query=${encodeURIComponent(
                        businesses.find(b => b.id === selectedBizId)?.name || 'review'
                      )}`
                    )}`}
                    alt="Review QR Code"
                    className="w-48 h-48 mx-auto rounded-lg shadow-xs"
                  />
                </div>

                <p className="text-[11px] text-slate-400">
                  Place this stand directly by your payment terminal or front desk checkout counter to maximize real-time review conversions.
                </p>

                <div className="pt-2 flex gap-2">
                  <button
                    onClick={() => window.print()}
                    className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 shadow-sm transition"
                  >
                    Print Stand Card
                  </button>
                  <button
                    onClick={() => setShowQrModal(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: News Signals */}
      {activeTab === 'news' && (
        <div className="space-y-4">
          {analyzingNews ? (
            <div className="p-12 text-center text-sm text-slate-400">Scanning news signals...</div>
          ) : newsSignals.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-sm">
              <div className="flex items-center justify-center mb-3">
                <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-xs">
                  <Newspaper className="w-6 h-6" />
                </div>
              </div>
              <h3 className="text-sm font-semibold text-slate-800">No News Signals Found</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Scan Google News for industry expansion, competitor activity, and local market trends.
              </p>
              <button
                onClick={handleRunNews}
                className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 shadow-sm"
              >
                Scan Google News Signals
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {newsSignals.map((item, idx) => (
                <div key={idx} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase ${
                        item.category === 'opportunity'
                          ? 'bg-emerald-100 text-emerald-800'
                          : item.category === 'competitive_activity'
                          ? 'bg-purple-100 text-purple-800'
                          : item.category === 'reputation_risk'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {item.category.replace('_', ' ')}
                    </span>
                    <span className="text-[10px] text-slate-400">{item.source}</span>
                  </div>

                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-bold text-slate-900 text-xs hover:text-indigo-600 block line-clamp-2"
                  >
                    {item.headline}
                  </a>

                  <p className="text-xs text-slate-600">{item.summary}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 5: SERP Change Detection */}
      {activeTab === 'changes' && (
        <div className="space-y-4">
          {analyzingChanges ? (
            <div className="p-12 text-center text-sm text-slate-400">Comparing search runs...</div>
          ) : changeData ? (
            <div className="space-y-4">
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                <h3 className="text-xs font-bold text-indigo-900 uppercase tracking-wider">SERP Movement Summary</h3>
                <p className="text-xs text-indigo-900 mt-1">{changeData.summary}</p>
              </div>

              {changeData.rankShifts.length > 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                        <th className="py-2.5 px-4 font-semibold">Competitor Domain</th>
                        <th className="py-2.5 px-3 font-semibold text-center">Previous Rank</th>
                        <th className="py-2.5 px-3 font-semibold text-center">Current Rank</th>
                        <th className="py-2.5 px-3 font-semibold text-center">Position Shift</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {changeData.rankShifts.map((shift, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="py-3 px-4 font-medium text-slate-800">{shift.domain}</td>
                          <td className="py-3 px-3 text-center text-slate-400 font-mono">#{shift.previousRank}</td>
                          <td className="py-3 px-3 text-center font-bold text-slate-800 font-mono">#{shift.currentRank}</td>
                          <td className="py-3 px-3 text-center">
                            {shift.delta > 0 ? (
                              <span className="text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded text-[11px]">
                                ↑ Climbed +{shift.delta}
                              </span>
                            ) : (
                              <span className="text-rose-600 font-semibold bg-rose-50 px-2 py-0.5 rounded text-[11px]">
                                ↓ Slipped {shift.delta}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-xs text-slate-400">
                  No rank shifts detected between the latest completed runs.
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <button
                onClick={handleRunChanges}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 shadow-sm"
              >
                Detect SERP Changes
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
