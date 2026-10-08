'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { apiClient } from '@/lib/api';
import {
  Sparkles,
  RefreshCw,
  Plus,
  Radio,
  Search,
  X,
  Trash2,
} from 'lucide-react';

interface BusinessSummary {
  id: string;
  name: string;
  city?: string;
  industry?: string;
  websiteUrl?: string;
}

interface KeywordRankingDetail {
  keyword: {
    id: string;
    phrase: string;
    location: string | null;
    intent: string | null;
    status: string;
    opportunityScore: number;
    createdAt: string;
  };
  currentRank: number | null;
  previousRank: number | null;
  delta: number | null;
  resultType: string | null;
  url: string | null;
  serpFeatures: string[] | null;
  lastObservedAt: string | null;
  /** When the phrase was last swept, whether or not the business appeared. */
  lastCheckedAt?: string | null;
  /** Newest sweep found no position for this business (not the same as never checked). */
  absentFromLatestCheck?: boolean;
  bestCompetitorRank: number | null;
  bestCompetitorDomain: string | null;
}

interface SearchResultItem {
  id: string;
  rank: number;
  title: string;
  url: string;
  domain: string;
  snippet?: string;
  rating?: string;
  reviewCount?: number;
  locationText?: string;
}

interface SearchRunRecord {
  id: string;
  searchType: string;
  query: string;
  location?: string;
  status: string;
  requestedAt: string;
  results?: SearchResultItem[];
}

export default function KeywordsPage() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [businesses, setBusinesses] = useState<BusinessSummary[]>([]);
  const [selectedBizId, setSelectedBizId] = useState<string>('');
  const [keywords, setKeywords] = useState<KeywordRankingDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Tabs: 'tracked' | 'candidates' | 'all' | 'serp_radar'
  const [activeTab, setActiveTab] = useState<'tracked' | 'candidates' | 'all' | 'serp_radar'>('tracked');

  // Manual Add Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPhrase, setNewPhrase] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newIntent, setNewIntent] = useState<string>('commercial');
  const [submittingAdd, setSubmittingAdd] = useState(false);

  // Live SERP Radar State
  const [radarQuery, setRadarQuery] = useState('');
  const [radarType, setRadarType] = useState<'google' | 'google_maps' | 'google_news'>('google');
  const [radarSearching, setRadarSearching] = useState(false);
  const [radarHistory, setRadarHistory] = useState<SearchRunRecord[]>([]);
  const [activeRadarDetails, setActiveRadarDetails] = useState<SearchRunRecord | null>(null);

  const autoTriggeredKeywordsRef = React.useRef<Set<string>>(new Set());

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
            const target = cachedBizId && parsed.find((b: any) => b.id === cachedBizId)
              ? parsed.find((b: any) => b.id === cachedBizId)
              : parsed[0];
            setSelectedBizId(target.id);
            setNewLocation(target.city || '');
            setRadarQuery(target.city ? `${target.industry || 'service'} in ${target.city}` : 'local search');
          }
        }
      } catch (e) {}
    }
  }, []);

  // Instant cache retrieval on business change
  useEffect(() => {
    if (!selectedBizId || typeof window === 'undefined') return;
    try {
      const cached = localStorage.getItem(`keywords_cache_${selectedBizId}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setKeywords(parsed);
        }
      }
    } catch (e) {
      console.error('Failed to read keywords cache:', e);
    }
  }, [selectedBizId]);

  // Load Businesses on Mount
  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) return;

    async function loadBusinesses() {
      try {
        const token = await getToken();
        if (!token) return;
        const bizList = await apiClient<BusinessSummary[]>('/api/businesses', { token });
        setBusinesses(bizList);
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('serp_scout_cached_businesses', JSON.stringify(bizList));
          } catch (e) {}
        }
        if (bizList.length > 0) {
          const cachedBizId = typeof window !== 'undefined' ? localStorage.getItem('serp_scout_active_biz_id') : null;
          const target = cachedBizId && bizList.find((b) => b.id === cachedBizId)
            ? bizList.find((b) => b.id === cachedBizId)!
            : bizList[0];
          setSelectedBizId(target.id);
          setNewLocation(target.city || '');
          setRadarQuery(target.city ? `${target.industry || 'service'} in ${target.city}` : 'local search');
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem('serp_scout_active_biz_id', target.id);
            } catch (e) {}
          }
        }
      } catch (err: any) {
        console.error('Failed to load businesses:', err);
      }
    }
    loadBusinesses();
  }, [isLoaded, isSignedIn, getToken]);

  // Run AI Keyword Discovery
  const handleDiscoverKeywords = useCallback(async (targetBizId?: string) => {
    const bizId = targetBizId || selectedBizId;
    if (!bizId) return;
    setDiscovering(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await apiClient<{ discoveredCount: number }>(
        `/api/businesses/${bizId}/keywords/discover`,
        {
          method: 'POST',
          token,
        }
      );
      setSuccessMsg(`Discovered ${res.discoveredCount} new high-intent keyword candidates!`);
      // Reload keywords after discovery
      const refreshed = await apiClient<KeywordRankingDetail[]>(`/api/businesses/${bizId}/keywords`, { token });
      setKeywords(refreshed);
      try {
        localStorage.setItem(`keywords_cache_${bizId}`, JSON.stringify(refreshed));
      } catch {}
    } catch (err: any) {
      console.error('Failed to discover keywords:', err);
      setError(err.message || 'Failed to discover keywords');
    } finally {
      setDiscovering(false);
    }
  }, [selectedBizId, getToken]);

  // Load Keywords & Rankings
  const loadKeywords = useCallback(async () => {
    if (!selectedBizId) return;
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) return;
      const data = await apiClient<KeywordRankingDetail[]>(`/api/businesses/${selectedBizId}/keywords`, { token });
      setKeywords(data);
      try {
        localStorage.setItem(`keywords_cache_${selectedBizId}`, JSON.stringify(data));
      } catch {}

      // Auto-trigger discovery if 0 keywords exist for this business
      if (data.length === 0 && !autoTriggeredKeywordsRef.current.has(selectedBizId)) {
        autoTriggeredKeywordsRef.current.add(selectedBizId);
        // #region agent log
        fetch('http://127.0.0.1:7537/ingest/08159c05-3a23-4a09-bfe4-16a226612021',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'97920a'},body:JSON.stringify({sessionId:'97920a',runId:'pre-fix',hypothesisId:'D',location:'keywords/page.tsx:loadKeywords',message:'Keywords tab mounted; auto-discover because empty',data:{selectedBizId,kwCount:data.length},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        handleDiscoverKeywords(selectedBizId);
      } else {
        // #region agent log
        fetch('http://127.0.0.1:7537/ingest/08159c05-3a23-4a09-bfe4-16a226612021',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'97920a'},body:JSON.stringify({sessionId:'97920a',runId:'pre-fix',hypothesisId:'D',location:'keywords/page.tsx:loadKeywords',message:'Keywords tab mounted; using existing rows',data:{selectedBizId,kwCount:data.length,alreadyAutoTriggered:autoTriggeredKeywordsRef.current.has(selectedBizId)},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
      }
    } catch (err: any) {
      console.error('Failed to load keywords:', err);
      setError(err.message || 'Failed to fetch keywords');
    } finally {
      setLoading(false);
    }
  }, [selectedBizId, getToken, handleDiscoverKeywords]);

  // Load Search History for Radar tab
  const loadRadarHistory = useCallback(async () => {
    if (!selectedBizId) return;
    try {
      const token = await getToken();
      if (!token) return;
      const history = await apiClient<SearchRunRecord[]>(`/api/businesses/${selectedBizId}/searches`, { token });
      setRadarHistory(history);
      if (history.length > 0 && !activeRadarDetails) {
        const details = await apiClient<SearchRunRecord>(`/api/searches/run/${history[0].id}`, { token });
        setActiveRadarDetails(details);
      }
    } catch (err: any) {
      console.error('Failed to load radar history:', err);
    }
  }, [selectedBizId, getToken, activeRadarDetails]);

  useEffect(() => {
    loadKeywords();
    loadRadarHistory();
  }, [selectedBizId, loadKeywords, loadRadarHistory]);

  // Keyword discovery and the research pipeline always write `candidate` rows,
  // while the page opens on the "Tracked" tab — so a business with a full
  // candidate queue rendered as "0 of N" and an empty table. Land on the tab
  // that actually has data, once per business, and only when nothing is tracked.
  const autoTabRef = React.useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!selectedBizId || keywords.length === 0) return;
    if (autoTabRef.current.has(selectedBizId)) return;
    autoTabRef.current.add(selectedBizId);

    const hasTracked = keywords.some(
      (k) => k.keyword.status === 'tracking' || k.keyword.status === 'approved'
    );
    if (!hasTracked) setActiveTab('candidates');
  }, [selectedBizId, keywords]);

  // Run Ranking Refresh
  const handleRefreshRankings = async () => {
    if (!selectedBizId) return;
    setRefreshing(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await apiClient<{
        refreshedCount: number;
        failedCount?: number;
        failures?: Array<{ phrase: string; error: string }>;
      }>(
        `/api/businesses/${selectedBizId}/rankings/refresh`,
        {
          method: 'POST',
          token,
          body: JSON.stringify({ searchType: 'google' }),
        }
      );
      const failed = res.failedCount ?? 0;
      if (failed > 0) {
        setError(
          `Refreshed ${res.refreshedCount} keyword(s); ${failed} failed — e.g. "${res.failures?.[0]?.phrase}": ` +
            `${res.failures?.[0]?.error ?? 'search provider error'}`
        );
      } else {
        setSuccessMsg(`Refreshed rankings across ${res.refreshedCount} keywords.`);
      }
      await loadKeywords();
    } catch (err: any) {
      console.error('Refresh error:', err);
      setError(err.message || 'Failed to refresh rankings');
    } finally {
      setRefreshing(false);
    }
  };

  // Update Keyword Status
  const handleUpdateStatus = async (keywordId: string, status: 'tracking' | 'approved' | 'rejected' | 'candidate') => {
    try {
      const token = await getToken();
      if (!token) return;
      await apiClient(`/api/keywords/keyword/${keywordId}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ status }),
      });
      setKeywords((prev) =>
        prev.map((k) => (k.keyword.id === keywordId ? { ...k, keyword: { ...k.keyword, status } } : k))
      );
    } catch (err: any) {
      console.error('Failed to update keyword:', err);
      setError(err.message || 'Failed to update keyword');
    }
  };

  // Delete Keyword
  const handleDeleteKeyword = async (keywordId: string) => {
    if (!confirm('Are you sure you want to delete this keyword?')) return;
    try {
      const token = await getToken();
      if (!token) return;
      await apiClient(`/api/keywords/keyword/${keywordId}`, {
        method: 'DELETE',
        token,
      });
      setKeywords((prev) => prev.filter((k) => k.keyword.id !== keywordId));
    } catch (err: any) {
      console.error('Failed to delete keyword:', err);
      setError(err.message || 'Failed to delete keyword');
    }
  };

  // Manual Add Form Submit
  const handleAddKeyword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPhrase.trim()) return;
    setSubmittingAdd(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) return;
      await apiClient(`/api/businesses/${selectedBizId}/keywords`, {
        method: 'POST',
        token,
        body: JSON.stringify({
          phrase: newPhrase.trim(),
          location: newLocation.trim() || undefined,
          intent: newIntent,
          status: 'tracking',
        }),
      });
      setShowAddModal(false);
      setNewPhrase('');
      await loadKeywords();
      setSuccessMsg('Keyword added to tracking list.');
    } catch (err: any) {
      console.error('Failed to add keyword:', err);
      setError(err.message || 'Failed to add keyword');
    } finally {
      setSubmittingAdd(false);
    }
  };

  // Execute Live Radar Search
  const handleExecuteRadarSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBizId || !radarQuery.trim()) return;
    setRadarSearching(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await apiClient<{ run: SearchRunRecord; resultsCount: number }>(
        `/api/businesses/${selectedBizId}/searches`,
        {
          method: 'POST',
          token,
          body: JSON.stringify({
            query: radarQuery.trim(),
            searchType: radarType,
            num: 15,
          }),
        }
      );
      const details = await apiClient<SearchRunRecord>(`/api/searches/run/${res.run.id}`, { token });
      setActiveRadarDetails(details);
      await loadRadarHistory();
    } catch (err: any) {
      console.error('Search run failed:', err);
      setError(err.message || 'Failed to execute search run');
    } finally {
      setRadarSearching(false);
    }
  };

  // Filter keywords according to active tab
  const filteredKeywords = keywords.filter((k) => {
    if (activeTab === 'tracked') return k.keyword.status === 'tracking' || k.keyword.status === 'approved';
    if (activeTab === 'candidates') return k.keyword.status === 'candidate';
    return true; // 'all'
  });

  // Calculate Metrics
  const trackedCount = keywords.filter((k) => k.keyword.status === 'tracking' || k.keyword.status === 'approved').length;
  const top3Count = keywords.filter((k) => k.currentRank !== null && k.currentRank <= 3).length;
  const top10Count = keywords.filter((k) => k.currentRank !== null && k.currentRank <= 10).length;
  const rankedKeywords = keywords.filter((k) => k.currentRank !== null);
  const avgRank = rankedKeywords.length > 0
    ? (rankedKeywords.reduce((acc, k) => acc + (k.currentRank || 0), 0) / rankedKeywords.length).toFixed(1)
    : '—';

  const getIntentBadgeClass = (intent: string | null) => {
    switch (intent) {
      case 'local':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'commercial':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'transactional':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'problem-based':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'comparison':
        return 'bg-pink-100 text-pink-800 border-pink-200';
      case 'informational':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Keyword & Ranking Monitoring</h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Track business outcome keywords, SERP positions, competitor rankings, and opportunity scores.
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
            onClick={() => handleDiscoverKeywords()}
            disabled={discovering || !selectedBizId}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-colors disabled:opacity-50 shadow-xs"
          >
            {discovering ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5 text-indigo-600" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
                Analyzing SERP...
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Discover Keywords</span>
              </>
            )}
          </button>

          <button
            onClick={handleRefreshRankings}
            disabled={refreshing || !selectedBizId}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors disabled:opacity-50 shadow-xs"
          >
            {refreshing ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
                Checking SERP...
              </>
            ) : (
              <>
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh Rankings</span>
              </>
            )}
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 text-white hover:opacity-95 shadow-sm transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Keyword</span>
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

      {/* Metrics Row with Subtle Elevation */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tracked Keywords</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{trackedCount}</span>
            <span className="text-xs text-slate-400">of {keywords.length} total</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Top 3 Rankings</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-600">{top3Count}</span>
            <span className="text-xs text-emerald-600 font-medium">high-converting</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Page 1 (Top 10)</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-indigo-600">{top10Count}</span>
            <span className="text-xs text-slate-400">visibility</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Average Position</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{avgRank}</span>
            <span className="text-xs text-slate-400">organic</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 flex items-center justify-between">
        <nav className="flex space-x-6">
          <button
            onClick={() => setActiveTab('tracked')}
            className={`py-3 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'tracked'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Tracked Keywords ({trackedCount})
          </button>
          <button
            onClick={() => setActiveTab('candidates')}
            className={`py-3 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'candidates'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Candidate Queue ({keywords.filter((k) => k.keyword.status === 'candidate').length})
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={`py-3 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'all'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            All Keywords ({keywords.length})
          </button>
          <button
            onClick={() => setActiveTab('serp_radar')}
            className={`py-3 text-xs font-semibold border-b-2 transition-colors inline-flex items-center gap-1.5 ${
              activeTab === 'serp_radar'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Live SERP Radar</span>
          </button>
        </nav>
      </div>

      {/* Main Content Area */}
      {activeTab !== 'serp_radar' ? (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          {loading ? (
            <div className="p-12 text-center text-sm text-slate-400">Loading keywords and rankings...</div>
          ) : filteredKeywords.length === 0 ? (
            <div className="p-12 text-center">
              <div className="flex items-center justify-center mb-3">
                <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
                  <Search className="w-6 h-6" />
                </div>
              </div>
              <h3 className="text-sm font-semibold text-slate-800">No keywords found in this tab</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {activeTab === 'candidates'
                  ? 'Click "Discover Keywords" to generate intent-categorized phrases from your website and competitors.'
                  : 'Add a keyword manually or discover new opportunities using the actions above.'}
              </p>
              <div className="mt-4">
                <button
                  onClick={() => handleDiscoverKeywords()}
                  disabled={discovering}
                  className="px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 shadow-sm"
                >
                  Discover Keywords
                </button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                    <th className="py-3 px-4 font-semibold">Keyword Phrase</th>
                    <th className="py-3 px-3 font-semibold">Intent</th>
                    <th className="py-3 px-3 font-semibold text-center">Current Rank</th>
                    <th className="py-3 px-3 font-semibold text-center">Δ Change</th>
                    <th className="py-3 px-3 font-semibold text-center">Best Rival</th>
                    <th className="py-3 px-3 font-semibold text-center">Opportunity Score</th>
                    <th className="py-3 px-3 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredKeywords.map((item) => {
                    const kw = item.keyword;
                    const isRanked = item.currentRank !== null;
                    const oppScore = Math.round(kw.opportunityScore);

                    return (
                      <tr key={kw.id} className="hover:bg-slate-50/75 transition-colors">
                        {/* Phrase & Location */}
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{kw.phrase}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {kw.location || 'All Locations'}
                          </div>
                        </td>

                        {/* Intent Badge */}
                        <td className="py-3 px-3">
                          <span
                            className={`inline-block px-2 py-0.5 text-[10px] font-medium rounded-full border capitalize ${getIntentBadgeClass(
                              kw.intent
                            )}`}
                          >
                            {kw.intent || 'commercial'}
                          </span>
                        </td>

                        {/* Current Rank */}
                        <td className="py-3 px-3 text-center">
                          {isRanked ? (
                            <span
                              className={`inline-block px-2 py-0.5 rounded font-bold ${
                                item.currentRank! <= 3
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : item.currentRank! <= 10
                                  ? 'bg-indigo-100 text-indigo-800'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              #{item.currentRank}
                            </span>
                          ) : item.absentFromLatestCheck ? (
                            // Checked, but the newest sweep found no position for
                            // this business — distinct from "never checked".
                            <span
                              className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200"
                              title={
                                item.previousRank
                                  ? `Last seen at #${item.previousRank}. Not present in the most recent sweep.`
                                  : 'Not present in the most recent sweep.'
                              }
                            >
                              not in top 20
                              {item.previousRank ? <span className="block text-[9px] text-amber-600">was #{item.previousRank}</span> : null}
                            </span>
                          ) : (
                            <span className="text-slate-300 font-mono text-xs" title="No sweep has covered this phrase yet">
                              —
                            </span>
                          )}
                        </td>

                        {/* Delta */}
                        <td className="py-3 px-3 text-center">
                          {item.delta !== null ? (
                            item.delta > 0 ? (
                              <span className="text-emerald-600 font-semibold text-[11px] bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                                ↑ +{item.delta}
                              </span>
                            ) : item.delta < 0 ? (
                              <span className="text-red-600 font-semibold text-[11px] bg-red-50 px-1.5 py-0.5 rounded border border-red-100">
                                ↓ {item.delta}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[11px]">—</span>
                            )
                          ) : (
                            <span className="text-slate-300 text-[11px]">—</span>
                          )}
                        </td>

                        {/* Best Competitor */}
                        <td className="py-3 px-3 text-center">
                          {item.bestCompetitorRank !== null ? (
                            <div title={item.bestCompetitorDomain || undefined}>
                              <span className="font-semibold text-slate-700">#{item.bestCompetitorRank}</span>
                              {item.bestCompetitorDomain && (
                                <div className="text-[10px] text-slate-400 truncate max-w-[120px] mx-auto">
                                  {item.bestCompetitorDomain}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </td>

                        {/* Opportunity Score Progress */}
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  oppScore >= 80
                                    ? 'bg-emerald-500'
                                    : oppScore >= 60
                                    ? 'bg-amber-500'
                                    : 'bg-slate-400'
                                }`}
                                style={{ width: `${oppScore}%` }}
                              ></div>
                            </div>
                            <span className="text-[11px] font-semibold text-slate-700 w-6 text-right">
                              {oppScore}
                            </span>
                          </div>
                        </td>

                        {/* Status Badge */}
                        <td className="py-3 px-3">
                          <span
                            className={`inline-block px-2 py-0.5 text-[10px] font-medium rounded-full ${
                              kw.status === 'tracking'
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                : kw.status === 'approved'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : kw.status === 'candidate'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-red-50 text-red-700 border border-red-200'
                            }`}
                          >
                            {kw.status}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {kw.status === 'candidate' && (
                              <button
                                onClick={() => handleUpdateStatus(kw.id, 'tracking')}
                                className="px-2 py-1 bg-indigo-600 text-white rounded text-[10px] font-medium hover:bg-indigo-700 transition-colors"
                              >
                                Track
                              </button>
                            )}

                            {kw.status === 'tracking' && (
                              <button
                                onClick={() => handleUpdateStatus(kw.id, 'rejected')}
                                className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-[10px] font-medium hover:bg-slate-200 transition-colors"
                              >
                                Stop
                              </button>
                            )}

                            {kw.status === 'rejected' && (
                              <button
                                onClick={() => handleUpdateStatus(kw.id, 'tracking')}
                                className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-[10px] font-medium hover:bg-slate-200 transition-colors"
                              >
                                Re-track
                              </button>
                            )}

                            <button
                              onClick={() => handleDeleteKeyword(kw.id)}
                              className="text-slate-400 hover:text-red-600 p-1 transition-colors"
                              title="Delete Keyword"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* Live SERP Radar Tab (Retains Full M3 functionality) */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left panel: Search Execution & History */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-800 mb-3">Execute Live Search</h2>
              <form onSubmit={handleExecuteRadarSearch} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Search Engine Source</label>
                  <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg text-xs font-medium">
                    <button
                      type="button"
                      onClick={() => setRadarType('google')}
                      className={`py-1.5 rounded-md text-center transition-all ${
                        radarType === 'google' ? 'bg-white shadow text-indigo-600 font-semibold' : 'text-slate-600'
                      }`}
                    >
                      Web
                    </button>
                    <button
                      type="button"
                      onClick={() => setRadarType('google_maps')}
                      className={`py-1.5 rounded-md text-center transition-all ${
                        radarType === 'google_maps' ? 'bg-white shadow text-indigo-600 font-semibold' : 'text-slate-600'
                      }`}
                    >
                      Maps Pack
                    </button>
                    <button
                      type="button"
                      onClick={() => setRadarType('google_news')}
                      className={`py-1.5 rounded-md text-center transition-all ${
                        radarType === 'google_news' ? 'bg-white shadow text-indigo-600 font-semibold' : 'text-slate-600'
                      }`}
                    >
                      News
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Query Phrase</label>
                  <input
                    type="text"
                    value={radarQuery}
                    onChange={(e) => setRadarQuery(e.target.value)}
                    placeholder="e.g. cosmetic dentist Austin TX"
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={radarSearching || !selectedBizId || !radarQuery.trim()}
                  className="w-full py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
                >
                  {radarSearching ? 'Running Search...' : 'Run Search Now'}
                </button>
              </form>
            </div>

            {/* Run History List */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">Recent Searches</h3>
              {radarHistory.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 text-center">No search history recorded yet.</p>
              ) : (
                <div className="space-y-1.5 max-h-72 overflow-y-auto">
                  {radarHistory.map((run) => (
                    <button
                      key={run.id}
                      onClick={async () => {
                        const token = await getToken();
                        if (token) {
                          const details = await apiClient<SearchRunRecord>(`/api/searches/run/${run.id}`, { token });
                          setActiveRadarDetails(details);
                        }
                      }}
                      className={`w-full text-left p-2.5 rounded-lg text-xs transition-colors ${
                        activeRadarDetails?.id === run.id ? 'bg-indigo-50 border border-indigo-200' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="font-medium text-slate-800 truncate">{run.query}</div>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                        <span className="capitalize">{run.searchType.replace('_', ' ')}</span>
                        <span>{new Date(run.requestedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right panel: Search Results Table */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            {activeRadarDetails ? (
              <div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">
                      Results for: <span className="text-indigo-600">"{activeRadarDetails.query}"</span>
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Type: {activeRadarDetails.searchType} • Executed at:{' '}
                      {new Date(activeRadarDetails.requestedAt).toLocaleString()}
                    </p>
                  </div>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[11px] font-medium">
                    {activeRadarDetails.results?.length || 0} items
                  </span>
                </div>

                <div className="space-y-2.5 max-h-[500px] overflow-y-auto">
                  {activeRadarDetails.results?.map((item) => (
                    <div key={item.id} className="p-3 rounded-lg border border-slate-100 bg-slate-50/50 hover:bg-slate-50">
                      <div className="flex items-start gap-2.5">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">
                          {item.rank}
                        </span>
                        <div className="flex-1 min-w-0">
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium text-slate-900 hover:text-indigo-600 text-xs block truncate"
                          >
                            {item.title}
                          </a>
                          <div className="text-[11px] text-indigo-700 font-mono mt-0.5 truncate">{item.domain}</div>
                          {item.snippet && <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{item.snippet}</p>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-20 text-center text-sm text-slate-400">
                Select or execute a search query to view SERP rankings.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Keyword Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5 border border-slate-100">
            <h3 className="text-base font-bold text-slate-900 mb-1">Add Keyword to Monitor</h3>
            <p className="text-xs text-slate-500 mb-4">
              Monitor rankings, competitor positions, and search intent over time.
            </p>

            <form onSubmit={handleAddKeyword} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Keyword Phrase *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. emergency dentist Austin"
                  value={newPhrase}
                  onChange={(e) => setNewPhrase(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Location Modifier</label>
                <input
                  type="text"
                  placeholder="e.g. Austin, TX"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Search Intent</label>
                <select
                  value={newIntent}
                  onChange={(e) => setNewIntent(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="commercial">Commercial Investigation</option>
                  <option value="transactional">Transactional (Ready to Buy / Book)</option>
                  <option value="local">Local Intent (Near me / City)</option>
                  <option value="problem-based">Problem-based (Emergency / Repair)</option>
                  <option value="comparison">Comparison (Alternatives / Reviews)</option>
                  <option value="informational">Informational (Guides / How-to)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAdd || !newPhrase.trim()}
                  className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
                >
                  {submittingAdd ? 'Saving...' : 'Add Keyword'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
