'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import {
  Radar,
  Radio,
  Target,
  Zap,
  RefreshCw,
  Plus,
  ExternalLink,
  Check,
  X,
  HelpCircle,
  Trash2,
  AlertCircle,
  ShieldAlert,
  TrendingUp,
  Activity,
  MapPin,
  Sparkles,
  Calendar,
  Tag,
  Phone,
  ChevronDown,
  ChevronUp,
  Layers,
  Flame,
  Star,
} from 'lucide-react';
import { apiClient } from '@/lib/api';

export interface CompetitorMetadata {
  threatLevel?: 'severe' | 'vulnerable' | 'emerging' | 'moderate';
  threatReason?: string;
  distanceMiles?: number;
  proximityLabel?: string;
  hasAds?: boolean;
  serpOverlapPercent?: number;
  rating?: number;
  reviewCount?: number;
  extractedProfile?: {
    bookingTech?: string[];
    offers?: string[];
    callsToAction?: string[];
    phone?: string;
    hasOnlineBooking?: boolean;
  };
}

interface CompetitorRecord {
  id: string;
  businessId: string;
  name: string;
  domain: string;
  websiteUrl: string;
  mapsUrl?: string;
  category?: string;
  competitorType: string;
  confidenceScore: number;
  status: 'candidate' | 'confirmed' | 'rejected' | 'indirect';
  userNotes?: string;
  metadata?: CompetitorMetadata;
  createdAt: string;
}

interface BusinessSummary {
  id: string;
  name: string;
  city?: string;
}

export default function CompetitorsPage() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [businesses, setBusinesses] = useState<BusinessSummary[]>([]);
  const [selectedBizId, setSelectedBizId] = useState<string>('');
  const [competitors, setCompetitors] = useState<CompetitorRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [discovering, setDiscovering] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'candidate' | 'confirmed' | 'indirect' | 'rejected'>('all');
  const [error, setError] = useState<string | null>(null);

  const autoTriggeredRef = React.useRef<Set<string>>(new Set());

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
            setLoading(false);
          }
        }
      } catch (e) {}
    }
  }, []);

  // Manual Add Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualUrl, setManualUrl] = useState('');
  const [manualCategory, setManualCategory] = useState('');
  const [manualType, setManualType] = useState('direct');
  const [manualNotes, setManualNotes] = useState('');
  const [adding, setAdding] = useState(false);
  const [expandedIntel, setExpandedIntel] = useState<Record<string, boolean>>({});

  const toggleIntel = (id: string) => {
    setExpandedIntel((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Load businesses
  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setLoading(false);
      return;
    }

    async function init() {
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
          let initialBizId = list[0].id;
          if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const paramBizId = params.get('biz_id') || params.get('business_id');
            const cachedBizId = localStorage.getItem('serp_scout_active_biz_id');
            if (paramBizId && list.some((b) => b.id === paramBizId)) {
              initialBizId = paramBizId;
            } else if (cachedBizId && list.some((b) => b.id === cachedBizId)) {
              initialBizId = cachedBizId;
            }
          }
          setSelectedBizId(initialBizId);
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem('serp_scout_active_biz_id', initialBizId);
            } catch (e) {}
          }
        }
      } catch (err: any) {
        console.error('Failed to load businesses:', err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [isLoaded, isSignedIn, getToken]);

  const handleDiscover = useCallback(
    async (targetBizId?: string) => {
      const bizId = targetBizId || selectedBizId;
      if (!bizId) return;
      setDiscovering(true);
      setError(null);
      try {
        const token = await getToken();
        if (!token) throw new Error('Authentication expired. Please sign in again.');

        await apiClient(`/api/businesses/${bizId}/competitors/discover`, {
          token,
          method: 'POST',
        });
        // Reload competitors after discovery
        const refreshed = await apiClient<CompetitorRecord[]>(`/api/businesses/${bizId}/competitors`, { token });
        setCompetitors(refreshed);
      } catch (err: any) {
        console.error('Discovery failed:', err);
        setError(err.message || 'Competitor discovery failed. Please check network and credentials.');
      } finally {
        setDiscovering(false);
      }
    },
    [selectedBizId, getToken]
  );

  // Load competitors for active business
  const loadCompetitors = useCallback(
    async (bizIdToLoad?: string) => {
      const targetId = bizIdToLoad || selectedBizId;
      if (!targetId) return;
      setLoading(true);
      try {
        const token = await getToken();
        if (!token) return;
        const list = await apiClient<CompetitorRecord[]>(`/api/businesses/${targetId}/competitors`, { token });
        setCompetitors(list);

        // Auto-trigger discovery if 0 competitors or auto_discover query param
        let shouldAutoDiscover = false;
        if (typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search);
          if (params.get('auto_discover') === 'true') {
            shouldAutoDiscover = true;
          }
        }

        if ((list.length === 0 || shouldAutoDiscover) && !autoTriggeredRef.current.has(targetId)) {
          autoTriggeredRef.current.add(targetId);
          // #region agent log
          fetch('http://127.0.0.1:7537/ingest/08159c05-3a23-4a09-bfe4-16a226612021',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'97920a'},body:JSON.stringify({sessionId:'97920a',runId:'pre-fix',hypothesisId:'D',location:'competitors/page.tsx:loadCompetitors',message:'Competitors tab mounted; auto-discover because empty',data:{targetId,compCount:list.length,shouldAutoDiscover},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
          handleDiscover(targetId);
        } else {
          // #region agent log
          fetch('http://127.0.0.1:7537/ingest/08159c05-3a23-4a09-bfe4-16a226612021',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'97920a'},body:JSON.stringify({sessionId:'97920a',runId:'pre-fix',hypothesisId:'D',location:'competitors/page.tsx:loadCompetitors',message:'Competitors tab mounted; using existing rows',data:{targetId,compCount:list.length,shouldAutoDiscover,alreadyAutoTriggered:autoTriggeredRef.current.has(targetId)},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
        }
      } catch (err: any) {
        console.error('Failed to load competitors:', err);
        setError(err.message || 'Failed to load competitors');
      } finally {
        setLoading(false);
      }
    },
    [selectedBizId, getToken, handleDiscover]
  );

  useEffect(() => {
    if (selectedBizId) {
      loadCompetitors(selectedBizId);
    }
  }, [selectedBizId, loadCompetitors]);

  const handleUpdateStatus = async (competitorId: string, status: 'confirmed' | 'rejected' | 'indirect') => {
    try {
      const token = await getToken();
      if (!token) return;

      await apiClient(`/api/competitors/competitor/${competitorId}`, {
        token,
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setCompetitors((prev) =>
        prev.map((c) => (c.id === competitorId ? { ...c, status } : c))
      );
    } catch (err: any) {
      console.error('Failed to update competitor status:', err);
      setError(err.message || 'Failed to update status');
    }
  };

  const handleDelete = async (competitorId: string) => {
    if (!confirm('Are you sure you want to remove this competitor?')) return;
    try {
      const token = await getToken();
      if (!token) return;

      await apiClient(`/api/competitors/competitor/${competitorId}`, {
        token,
        method: 'DELETE',
      });
      setCompetitors((prev) => prev.filter((c) => c.id !== competitorId));
    } catch (err: any) {
      console.error('Failed to delete competitor:', err);
      setError(err.message || 'Failed to remove competitor');
    }
  };

  const handleAddManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBizId || !manualName.trim() || !manualUrl.trim()) return;

    setAdding(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error('Authentication expired.');

      await apiClient('/api/competitors/competitor', {
        token,
        method: 'POST',
        body: JSON.stringify({
          businessId: selectedBizId,
          name: manualName.trim(),
          websiteUrl: manualUrl.startsWith('http') ? manualUrl.trim() : `https://${manualUrl.trim()}`,
          category: manualCategory.trim() || undefined,
          competitorType: manualType,
          userNotes: manualNotes.trim() || undefined,
        }),
      });

      setShowAddModal(false);
      setManualName('');
      setManualUrl('');
      setManualCategory('');
      setManualNotes('');
      await loadCompetitors(selectedBizId);
    } catch (err: any) {
      console.error('Manual competitor add failed:', err);
      setError(err.message || 'Failed to add competitor');
    } finally {
      setAdding(false);
    }
  };

  const filteredCompetitors = competitors.filter((c) => {
    if (activeTab === 'all') return true;
    return c.status === activeTab;
  });

  const activeBusiness = businesses.find((b) => b.id === selectedBizId);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-200 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Competitor Discovery & Radar</h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Discover who competes for your local search customers and evaluate their organic and local overlap.
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
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition shadow-xs inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5 text-slate-500" />
            <span>Add Competitor Manually</span>
          </button>
          <button
            onClick={() => handleDiscover()}
            disabled={discovering || !selectedBizId}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 text-white hover:opacity-95 shadow-sm transition disabled:opacity-50 flex items-center gap-2"
          >
            {discovering ? (
              <>
                <span className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                Discovering Competitors...
              </>
            ) : competitors.length > 0 ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 text-white" />
                <span>Re-Scan Competitors</span>
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5 text-white fill-white" />
                <span>Discover Competitors</span>
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium animate-fade-in shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => handleDiscover()}
            className="ml-4 underline hover:text-rose-900 font-semibold inline-flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Autonomous Radar Scanning Card */}
      {discovering && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/30 p-6 shadow-xl text-white animate-fade-in">
          <div className="absolute -right-12 -top-12 w-48 h-48 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex flex-col md:flex-row items-center gap-6 relative z-10">
            {/* Animated Radar Pulse */}
            <div className="relative flex items-center justify-center shrink-0 w-16 h-16">
              <div className="absolute inset-0 rounded-full border border-cyan-500/30 animate-ping opacity-75" />
              <div className="absolute inset-1.5 rounded-full border border-indigo-400/40 animate-pulse" />
              <div className="w-12 h-12 rounded-full bg-indigo-600/25 border border-indigo-500/60 flex items-center justify-center text-cyan-300 backdrop-blur-sm shadow-inner shadow-indigo-500/30">
                <Radar className="w-6 h-6 animate-spin text-cyan-300" style={{ animationDuration: '4s' }} />
              </div>
            </div>

            <div className="flex-1 text-center md:text-left space-y-1.5">
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-400/30 text-cyan-300 text-[11px] font-semibold tracking-wide uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                Autonomous Discovery in Progress
              </div>
              <h3 className="text-base font-bold text-white">
                Discovering local competitors for {activeBusiness?.name || 'your business'}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
                Executing 3-query parallel sweep across Google Organic, Maps 3-Pack, and Commercial search. Evaluating physical proximity, scraping homepage booking tech, and calculating threat levels in the background...
              </p>
            </div>

            <div className="shrink-0 flex items-center gap-2 text-xs font-semibold text-indigo-200 bg-indigo-900/50 px-4 py-2 rounded-xl border border-indigo-700/40">
              <svg className="animate-spin h-4 w-4 text-cyan-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <span>Multi-Query Sweep</span>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-1">
        {(['all', 'candidate', 'confirmed', 'indirect', 'rejected'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-xs font-semibold rounded-lg capitalize transition ${
              activeTab === tab
                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            {tab} (
            {tab === 'all'
              ? competitors.length
              : competitors.filter((c) => c.status === tab).length}
            )
          </button>
        ))}
      </div>

      {/* Competitors List */}
      {loading ? (
        <div className="py-20 text-center text-sm text-slate-500">Loading competitor records...</div>
      ) : filteredCompetitors.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center max-w-lg mx-auto shadow-xs">
          <div className="flex items-center justify-center mb-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-xs">
              {discovering ? (
                <Radar className="w-7 h-7 text-indigo-600 animate-spin" style={{ animationDuration: '3s' }} />
              ) : (
                <Target className="w-7 h-7 text-indigo-600" />
              )}
            </div>
          </div>
          <h3 className="text-base font-bold text-slate-800">
            {discovering ? 'Scanning for competitors...' : 'No competitors in this view'}
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            {discovering
              ? 'Our AI pipeline is currently searching Google and local business listings. Discovered competitors will appear here automatically.'
              : 'Click "Discover Competitors" to analyze your search results and find businesses ranking in your service area.'}
          </p>
          {!discovering && (
            <button
              onClick={() => handleDiscover()}
              className="mt-4 px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition shadow-xs inline-flex items-center gap-1.5"
            >
              <Zap className="w-3.5 h-3.5 text-white fill-white" />
              <span>Run Discovery Now</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredCompetitors.map((comp) => {
            const score = Math.round(comp.confidenceScore);
            const meta = comp.metadata;
            const threat = meta?.threatLevel || 'moderate';
            const threatReason = meta?.threatReason;
            const proximityLabel = meta?.proximityLabel || (comp.mapsUrl ? 'Local Maps 3-Pack' : 'Regional');
            const hasAds = meta?.hasAds;
            const overlap = meta?.serpOverlapPercent ?? (score >= 80 ? 67 : 33);
            const rating = meta?.rating;
            const reviewCount = meta?.reviewCount;
            const profile = meta?.extractedProfile;
            const isIntelOpen = !!expandedIntel[comp.id];

            return (
              <div
                key={comp.id}
                className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between space-y-4 hover:border-slate-300 transition"
              >
                <div>
                  {/* Header Row: Name & Badges */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-bold text-slate-900">{comp.name}</h3>
                        {hasAds && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                            <Sparkles className="w-2.5 h-2.5 text-purple-600 fill-purple-600" />
                            Google Ads Rival
                          </span>
                        )}
                      </div>
                      <a
                        href={comp.websiteUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-indigo-600 hover:underline inline-flex items-center gap-1"
                      >
                        <span>{comp.domain}</span>
                        <ExternalLink className="w-3 h-3 text-indigo-500 shrink-0" />
                      </a>
                    </div>

                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      {/* Threat Level Badge */}
                      {threat === 'severe' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          <Flame className="w-3 h-3 text-rose-500 fill-rose-500" />
                          Severe Threat
                        </span>
                      )}
                      {threat === 'vulnerable' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          <Target className="w-3 h-3 text-amber-600" />
                          Vulnerable Rival
                        </span>
                      )}
                      {threat === 'emerging' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-cyan-50 text-cyan-700 border border-cyan-200">
                          <TrendingUp className="w-3 h-3 text-cyan-600" />
                          Emerging Threat
                        </span>
                      )}
                      {threat === 'moderate' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                          <Activity className="w-3 h-3 text-slate-500" />
                          Moderate Threat
                        </span>
                      )}

                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                          score >= 80
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : score >= 60
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}
                      >
                        {score}% Match
                      </span>
                    </div>
                  </div>

                  {/* Pills: Proximity, Category, and Rating */}
                  <div className="flex items-center gap-2 flex-wrap mt-3">
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                      <MapPin className="w-3 h-3 text-indigo-500 shrink-0" />
                      {proximityLabel}
                    </span>

                    {typeof rating === 'number' && rating > 0 && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-500 shrink-0" />
                        {rating.toFixed(1)} ★ {reviewCount ? `(${reviewCount})` : ''}
                      </span>
                    )}

                    {comp.category && (
                      <span className="text-[11px] font-medium text-slate-500 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100">
                        {comp.category}
                      </span>
                    )}

                    <span className="text-[10px] uppercase font-semibold text-slate-400 ml-auto">
                      {comp.competitorType}
                    </span>
                  </div>

                  {/* Threat Reason */}
                  {threatReason && (
                    <div className="mt-2.5 p-2 rounded-xl bg-slate-50 border border-slate-100 text-[11px] text-slate-600 leading-relaxed italic">
                      "{threatReason}"
                    </div>
                  )}

                  {/* Keyword & SERP Overlap Progress Bar */}
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between text-[11px] font-semibold mb-1">
                      <span className="text-slate-500 inline-flex items-center gap-1">
                        <Layers className="w-3 h-3 text-slate-400" />
                        Keyword & SERP Overlap
                      </span>
                      <span className="text-indigo-600 font-bold">{overlap}% Coverage</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          overlap >= 60 ? 'bg-indigo-600' : overlap >= 30 ? 'bg-cyan-500' : 'bg-slate-400'
                        }`}
                        style={{ width: `${overlap}%` }}
                      />
                    </div>
                  </div>

                  {/* Extracted Deep Intel Accordion */}
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => toggleIntel(comp.id)}
                      className="w-full py-1.5 px-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200/80 text-xs font-semibold text-slate-700 flex items-center justify-between transition"
                    >
                      <span className="inline-flex items-center gap-1.5 text-indigo-700">
                        <Zap className="w-3.5 h-3.5 text-indigo-600" />
                        Competitor Intelligence & Tech
                      </span>
                      {isIntelOpen ? (
                        <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                      )}
                    </button>

                    {isIntelOpen && (
                      <div className="mt-2 p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs animate-fade-in">
                        {/* Booking Tech */}
                        <div>
                          <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1 mb-1">
                            <Calendar className="w-3 h-3 text-slate-500" />
                            Booking Engine & Tech
                          </div>
                          {profile?.bookingTech && profile.bookingTech.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {profile.bookingTech.map((tech, idx) => (
                                <span
                                  key={idx}
                                  className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold"
                                >
                                  {tech}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">No online scheduling tech detected</span>
                          )}
                        </div>

                        {/* Offers */}
                        {profile?.offers && profile.offers.length > 0 && (
                          <div className="pt-2 border-t border-slate-200/70">
                            <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1 mb-1">
                              <Tag className="w-3 h-3 text-slate-500" />
                              Active Offers & Specials
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {profile.offers.map((offer, idx) => (
                                <span
                                  key={idx}
                                  className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-semibold"
                                >
                                  {offer}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Primary CTAs */}
                        {profile?.callsToAction && profile.callsToAction.length > 0 && (
                          <div className="pt-2 border-t border-slate-200/70">
                            <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1 mb-1">
                              <Target className="w-3 h-3 text-slate-500" />
                              Conversion CTAs
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {profile.callsToAction.map((cta, idx) => (
                                <span
                                  key={idx}
                                  className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-medium"
                                >
                                  "{cta}"
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Phone */}
                        {profile?.phone && (
                          <div className="pt-2 border-t border-slate-200/70 flex items-center gap-1 text-[11px] text-slate-600 font-medium">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>Phone: {profile.phone}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {comp.userNotes && (
                    <div className="mt-3 p-2 rounded bg-amber-50 border border-amber-100 text-xs text-amber-900">
                      <strong>Notes:</strong> {comp.userNotes}
                    </div>
                  )}
                </div>

                {/* Actions Bar */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-100 text-xs">
                  <div className="flex items-center gap-2">
                    {comp.status !== 'confirmed' && (
                      <button
                        onClick={() => handleUpdateStatus(comp.id, 'confirmed')}
                        className="px-2.5 py-1 rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-semibold transition inline-flex items-center gap-1"
                      >
                        <Check className="w-3 h-3" />
                        <span>Confirm</span>
                      </button>
                    )}
                    {comp.status !== 'indirect' && (
                      <button
                        onClick={() => handleUpdateStatus(comp.id, 'indirect')}
                        className="px-2.5 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium transition inline-flex items-center gap-1"
                      >
                        <HelpCircle className="w-3 h-3 text-slate-500" />
                        <span>Mark Indirect</span>
                      </button>
                    )}
                    {comp.status !== 'rejected' && (
                      <button
                        onClick={() => handleUpdateStatus(comp.id, 'rejected')}
                        className="px-2.5 py-1 rounded bg-rose-50 text-rose-700 hover:bg-rose-100 font-medium transition inline-flex items-center gap-1"
                      >
                        <X className="w-3 h-3" />
                        <span>Reject</span>
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => handleDelete(comp.id)}
                    className="text-slate-400 hover:text-rose-600 font-medium transition inline-flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Manual Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-xl border border-slate-200">
            <h2 className="text-xl font-bold text-slate-900">Add Competitor Manually</h2>
            <p className="text-xs text-slate-500 mt-1 mb-6">
              Track a specific competitor regardless of search ranking discovery.
            </p>

            <form onSubmit={handleAddManualSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Competitor Name *
                </label>
                <input
                  type="text"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="e.g. Downtown Dental Care"
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Website URL *
                </label>
                <input
                  type="text"
                  value={manualUrl}
                  onChange={(e) => setManualUrl(e.target.value)}
                  placeholder="e.g. https://downtowndental.example.com"
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Category
                  </label>
                  <input
                    type="text"
                    value={manualCategory}
                    onChange={(e) => setManualCategory(e.target.value)}
                    placeholder="e.g. Cosmetic Dentistry"
                    className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Competitor Type
                  </label>
                  <select
                    value={manualType}
                    onChange={(e) => setManualType(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="direct">Direct</option>
                    <option value="geographic">Geographic</option>
                    <option value="search">Search</option>
                    <option value="indirect">Indirect</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Notes
                </label>
                <textarea
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                  placeholder="e.g. Main downtown competitor, offers Invisalign discounts"
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  rows={2}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg text-slate-600 hover:bg-slate-100"
                  disabled={adding}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adding}
                  className="px-5 py-2 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {adding ? 'Adding...' : 'Add Competitor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
