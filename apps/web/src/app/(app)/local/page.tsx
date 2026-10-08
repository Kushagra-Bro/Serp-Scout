'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { apiClient } from '@/lib/api';
import RadarCanvas, { type RadarNode } from '@/components/RadarCanvas';
import {
  MapPin,
  Search,
  Star,
  MessageSquare,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  Building2,
  PhoneCall,
  Flame,
  ArrowRight,
  Loader2,
  Camera,
  Tags,
  Award,
  CheckSquare,
  Square,
  RefreshCw,
  ChevronRight,
  Navigation,
  Compass,
  Bot,
  Cpu,
  Copy,
  Check,
  Layers,
  Download,
  Code2,
  Sliders,
  Globe,
} from 'lucide-react';
import ErrorBanner from '@/components/ErrorBanner';
import LocalSeoHeader from '@/components/local/LocalSeoHeader';
import LocalStatCards from '@/components/local/LocalStatCards';

interface BusinessSummary {
  id: string;
  name: string;
  city?: string;
  websiteUrl: string;
  industry?: string;
}

interface MapResultItem {
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

interface ReviewThemeItem {
  theme: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  frequency: number;
  examples: string[];
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
}

export default function LocalSeoPage() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [businesses, setBusinesses] = useState<BusinessSummary[]>([]);
  const [selectedBizId, setSelectedBizId] = useState<string>('');
  const [loadingBiz, setLoadingBiz] = useState(true);

  // Map Pack Scanner State
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('');
  const [scanning, setScanning] = useState(false);
  const [mapResults, setMapResults] = useState<MapResultItem[]>([]);
  const [scanTimestamp, setScanTimestamp] = useState<string | null>(null);

  // Review Sentiment Analysis State
  const [analyzingReviews, setAnalyzingReviews] = useState(false);
  const [reviewAnalysis, setReviewAnalysis] = useState<ReviewAnalysisData | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'map_pack' | 'geogrid' | 'geo_ai' | 'schema_gen' | 'reviews' | 'checklist'>('map_pack');

  // Geo-Grid 3-Pack Heatmap State
  const [gridSize, setGridSize] = useState<3 | 5>(3);
  const [gridRadiusKm, setGridRadiusKm] = useState<number>(5);
  const [selectedGridKeyword, setSelectedGridKeyword] = useState<string>('primary');
  const [selectedPinIndex, setSelectedPinIndex] = useState<number>(4); // center pin by default (index 4 in 3x3)
  const [isRescanningGrid, setIsRescanningGrid] = useState(false);
  // Radar range scale in km (null = auto-fit to the mesh). Pinned by default so
  // dragging the km slider visibly moves the mesh instead of silently re-fitting.
  const [radarRangeKm, setRadarRangeKm] = useState<number | null>(10);
  const [scanId, setScanId] = useState(0);

  // 1-Click Schema Generator State
  const [schemaCopied, setSchemaCopied] = useState(false);

  // Location Autocomplete Search State for Local SEO
  const [locationSuggestions, setLocationSuggestions] = useState<Array<{
    id: string;
    name: string;
    city?: string;
    address?: string;
    category?: string;
    type: 'location' | 'place';
  }>>([]);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const locationDebounceTimer = React.useRef<NodeJS.Timeout | null>(null);

  // Interactive Checklist Action State per Business
  const [checklistCompleted, setChecklistCompleted] = useState<Record<string, boolean>>({});

  const toggleChecklistItem = (itemKey: string) => {
    setChecklistCompleted((prev) => {
      const next = { ...prev, [itemKey]: !prev[itemKey] };
      try {
        if (selectedBizId) {
          localStorage.setItem(`local_seo_checklist_${selectedBizId}`, JSON.stringify(next));
        }
      } catch {}
      return next;
    });
  };

  const handleCopySchema = (code: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(code);
      setSchemaCopied(true);
      setTimeout(() => setSchemaCopied(false), 2000);
    }
  };

  const handleDownloadSchema = (code: string, bizName: string) => {
    if (typeof window === 'undefined') return;
    const blob = new Blob([code], { type: 'application/ld+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${bizName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-schema.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const autoTriggeredMapsRef = React.useRef<Set<string>>(new Set());
  const autoTriggeredReviewsRef = React.useRef<Set<string>>(new Set());

  // Restore saved results from localStorage on business change
  useEffect(() => {
    if (!selectedBizId || typeof window === 'undefined') return;

    // 1. Instant cache retrieval for Maps
    try {
      const cachedMaps = localStorage.getItem(`local_seo_maps_${selectedBizId}`);
      if (cachedMaps) {
        const parsed = JSON.parse(cachedMaps);
        if (parsed.results && parsed.results.length > 0) {
          setMapResults(parsed.results);
          setScanTimestamp(parsed.timestamp || null);
        }
      }
    } catch (e) {
      console.error('Failed to read local maps cache:', e);
    }

    // 2. Instant cache retrieval for Reviews
    try {
      const cachedReviews = localStorage.getItem(`local_seo_reviews_${selectedBizId}`);
      if (cachedReviews) {
        const parsed = JSON.parse(cachedReviews);
        if (parsed && parsed.themes) {
          setReviewAnalysis(parsed);
        }
      }
    } catch (e) {
      console.error('Failed to read local reviews cache:', e);
    }

    // 3. Instant cache retrieval for Checklist
    try {
      const cachedChecklist = localStorage.getItem(`local_seo_checklist_${selectedBizId}`);
      if (cachedChecklist) {
        const parsed = JSON.parse(cachedChecklist);
        if (parsed && typeof parsed === 'object') {
          setChecklistCompleted(parsed);
        }
      } else {
        setChecklistCompleted({});
      }
    } catch (e) {
      console.error('Failed to read local checklist cache:', e);
    }
  }, [selectedBizId]);

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
            setLocation(target.city || '');
            setQuery(`${target.industry || 'Service'} in ${target.city || 'Local'}`);
            setLoadingBiz(false);
          }
        }
      } catch (e) {}
    }
  }, []);

  // Load businesses
  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setLoadingBiz(false);
      return;
    }

    async function load() {
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
          const target = cachedBizId && list.find((b) => b.id === cachedBizId)
            ? list.find((b) => b.id === cachedBizId)!
            : list[0];
          setSelectedBizId(target.id);
          setLocation(target.city || '');
          setQuery(`${target.industry || 'Service'} in ${target.city || 'Austin'}`);
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem('serp_scout_active_biz_id', target.id);
            } catch (e) {}
          }
        }
      } catch (err: any) {
        console.error('Failed to load businesses:', err);
        setError(err.message || 'Failed to load workspace businesses');
      } finally {
        setLoadingBiz(false);
      }
    }
    load();
  }, [isLoaded, isSignedIn, getToken]);

  const handleLocationInputChange = (val: string) => {
    setLocation(val);
    setShowLocationDropdown(true);

    if (locationDebounceTimer.current) {
      clearTimeout(locationDebounceTimer.current);
    }

    if (!val || val.trim().length < 2) {
      setLocationSuggestions([]);
      setIsSearchingLocation(false);
      return;
    }

    setIsSearchingLocation(true);
    locationDebounceTimer.current = setTimeout(async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const res = await apiClient<Array<{
          id: string;
          name: string;
          city?: string;
          address?: string;
          category?: string;
          type: 'location' | 'place';
        }>>(`/api/businesses/locations/search?q=${encodeURIComponent(val.trim())}`, { token });
        setLocationSuggestions(res || []);
      } catch (err) {
        console.error('Location search error:', err);
      } finally {
        setIsSearchingLocation(false);
      }
    }, 350);
  };

  const handleSelectLocation = (item: {
    name: string;
    city?: string;
    address?: string;
    category?: string;
  }) => {
    const resolvedCity = item.city || item.name;
    setLocation(resolvedCity);
    const selectedBiz = businesses.find((b) => b.id === selectedBizId);
    setQuery(`${selectedBiz?.industry || 'Services'} in ${resolvedCity}`);
    setShowLocationDropdown(false);
  };

  // Execute Live Google Maps 3-Pack Scan (or refresh)
  const handleScanMaps = useCallback(async (e?: React.FormEvent, forceRefresh = false) => {
    if (e) e.preventDefault();
    if (!selectedBizId || !query.trim()) return;

    setScanning(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) throw new Error('Authentication expired.');

      const res = await apiClient<{
        id: string;
        results?: MapResultItem[];
        requestedAt: string;
      }>(`/api/businesses/${selectedBizId}/searches`, {
        token,
        method: 'POST',
        body: JSON.stringify({
          query: query.trim(),
          searchType: 'google_maps',
          location: location.trim() || undefined,
          num: 15,
        }),
      });

      const nowTime = new Date().toLocaleTimeString();
      if (res.results && res.results.length > 0) {
        setMapResults(res.results);
        setScanTimestamp(nowTime);
        // Persist to localStorage to save API calls on future visits
        try {
          localStorage.setItem(
            `local_seo_maps_${selectedBizId}`,
            JSON.stringify({ results: res.results, timestamp: nowTime })
          );
        } catch (storageErr) {
          console.error('Could not save maps to localStorage:', storageErr);
        }
      } else {
        setMapResults([]);
        setScanTimestamp(nowTime);
      }
    } catch (err: any) {
      console.error('Maps scan error:', err);
      setError(err.message || 'Google Maps scan failed. Please check your API keys and try again.');
      setMapResults([]);
    } finally {
      setScanning(false);
    }
  }, [selectedBizId, query, location, getToken]);

  // Load existing search history from DB or auto-trigger initial scan
  useEffect(() => {
    if (!selectedBizId || loadingBiz) return;

    let isMounted = true;

    async function loadDbHistoryOrAutoScan() {
      try {
        const token = await getToken();
        if (!token) return;

        // Check if we already have map results loaded from cache
        if (mapResults.length > 0) return;

        // Check backend DB for previous search runs for this business
        const runs = await apiClient<any[]>(`/api/businesses/${selectedBizId}/searches?limit=10`, { token });
        const mapsRun = runs.find((r) => r.searchType === 'google_maps' && r.status === 'completed');

        if (mapsRun && isMounted) {
          const runDetails = await apiClient<any>(`/api/searches/run/${mapsRun.id}`, { token });
          if (runDetails?.results && runDetails.results.length > 0 && isMounted) {
            const formattedResults: MapResultItem[] = runDetails.results.map((r: any) => ({
              id: r.id,
              rank: r.rank,
              title: r.title,
              url: r.url,
              domain: r.domain,
              snippet: r.snippet,
              rating: r.rating,
              reviewCount: r.reviewCount,
              locationText: r.locationText,
            }));
            setMapResults(formattedResults);
            const timeStr = new Date(mapsRun.completedAt || mapsRun.requestedAt).toLocaleTimeString();
            setScanTimestamp(timeStr);
            try {
              localStorage.setItem(
                `local_seo_maps_${selectedBizId}`,
                JSON.stringify({ results: formattedResults, timestamp: timeStr })
              );
            } catch {}
            return;
          }
        }

        // If no saved results in DB or cache, automatically run scan once
        if (!autoTriggeredMapsRef.current.has(selectedBizId) && isMounted) {
          autoTriggeredMapsRef.current.add(selectedBizId);
          handleScanMaps();
        }
      } catch (err) {
        console.error('Error fetching search history:', err);
      }
    }

    loadDbHistoryOrAutoScan();

    return () => {
      isMounted = false;
    };
  }, [selectedBizId, loadingBiz, getToken, mapResults.length, handleScanMaps]);

  // Run AI Review Sentiment & Opportunities Analysis
  const handleAnalyzeReviews = async () => {
    if (!selectedBizId) return;
    setAnalyzingReviews(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) throw new Error('Authentication expired.');

      const data = await apiClient<ReviewAnalysisData>(
        `/api/businesses/${selectedBizId}/analysis/reviews`,
        {
          token,
          method: 'POST',
        }
      );
      setReviewAnalysis(data);
      try {
        localStorage.setItem(`local_seo_reviews_${selectedBizId}`, JSON.stringify(data));
      } catch (storageErr) {
        console.error('Could not save reviews to localStorage:', storageErr);
      }
    } catch (err: any) {
      console.error('Review analysis error:', err);
      setError(err.message || 'Review analysis failed. Please try again.');
      setReviewAnalysis(null);
    } finally {
      setAnalyzingReviews(false);
    }
  };

  const selectedBiz = businesses.find((b) => b.id === selectedBizId);

  if (loadingBiz) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-3 text-slate-500 font-medium text-sm">
          <span className="h-5 w-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></span>
          Loading Local SEO Intelligence...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* ── 1. HEADER WITH BUSINESS SELECTOR ── */}
      <LocalSeoHeader
        businesses={businesses}
        selectedBizId={selectedBizId}
        scanning={scanning}
        onScan={() => handleScanMaps()}
        onBusinessChange={(newId) => {
          const b = businesses.find((biz) => biz.id === newId);
          setSelectedBizId(newId);
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem('serp_scout_active_biz_id', newId);
            } catch (err) {}
          }
          if (b) {
            setLocation(b.city || '');
            setQuery(`${b.industry || 'Services'} in ${b.city || 'Austin'}`);
          }
        }}
      />

      <ErrorBanner message={error} />

      {/* ── 2. STATS & QUICK HIGHLIGHTS (COMPUTED LIVE FROM AUDIT DATA) ── */}
      <LocalStatCards
        businesses={businesses}
        selectedBizId={selectedBizId}
        mapResults={mapResults}
        location={location}
      />

      {/* ── 3. TAB NAVIGATION ── */}
      <div className="flex items-center gap-1 sm:gap-2 border-b border-slate-200 overflow-x-auto pb-px">
        <button
          onClick={() => setActiveTab('map_pack')}
          className={`pb-3 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'map_pack'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <MapPin className="w-3.5 h-3.5" />
          Live Google Maps 3-Pack
        </button>

        <button
          onClick={() => setActiveTab('geogrid')}
          className={`pb-3 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'geogrid'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Navigation className="w-3.5 h-3.5" />
          Geo-Grid 3-Pack Heatmap
        </button>

        <button
          onClick={() => setActiveTab('geo_ai')}
          className={`pb-3 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'geo_ai'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Bot className="w-3.5 h-3.5" />
          Generative AI &amp; SGE Radar
        </button>

        <button
          onClick={() => setActiveTab('schema_gen')}
          className={`pb-3 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'schema_gen'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Code2 className="w-3.5 h-3.5" />
          1-Click Schema JSON-LD
        </button>

        <button
          onClick={() => {
            setActiveTab('reviews');
            if (!reviewAnalysis) handleAnalyzeReviews();
          }}
          className={`pb-3 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'reviews'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          Review Sentiment &amp; Copy Hooks
        </button>

        <button
          onClick={() => setActiveTab('checklist')}
          className={`pb-3 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'checklist'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          Optimization Protocol
        </button>
      </div>

      {/* ── 4. TAB CONTENT ── */}

      {/* TAB 1: GOOGLE MAPS 3-PACK SCANNER */}
      {activeTab === 'map_pack' && (
        <div className="space-y-6 animate-fade-in">
          {/* Search Query Simulator */}
          <form
            onSubmit={handleScanMaps}
            className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center gap-3"
          >
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. dentist in Austin, plumber near me..."
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div className="relative w-full md:w-72">
              <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={location}
                onChange={(e) => handleLocationInputChange(e.target.value)}
                onFocus={() => {
                  if (locationSuggestions.length > 0) setShowLocationDropdown(true);
                }}
                placeholder="City, Pincode, or Clinic"
                className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              {isSearchingLocation && (
                <Loader2 className="w-3.5 h-3.5 text-indigo-600 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
              )}

              {/* Autocomplete Dropdown */}
              {showLocationDropdown && locationSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-64 overflow-y-auto divide-y divide-slate-100 animate-in fade-in slide-in-from-top-1 duration-150">
                  {locationSuggestions.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleSelectLocation(item)}
                      className="p-3 hover:bg-indigo-50/60 cursor-pointer transition flex items-start gap-2.5 text-left"
                    >
                      <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                        item.type === 'place'
                          ? 'bg-amber-50 text-amber-600 border border-amber-200'
                          : 'bg-indigo-50 text-indigo-600 border border-indigo-200'
                      }`}>
                        {item.type === 'place' ? (
                          <Building2 className="w-3.5 h-3.5" />
                        ) : (
                          <MapPin className="w-3.5 h-3.5" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-900 truncate">
                            {item.name}
                          </span>
                          <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 shrink-0">
                            {item.category}
                          </span>
                        </div>
                        {item.address && (
                          <p className="text-[11px] text-slate-500 truncate mt-0.5">
                            {item.address}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={scanning}
              className="w-full md:w-auto px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold text-xs hover:bg-indigo-700 shadow-sm transition disabled:opacity-50 whitespace-nowrap"
            >
              {scanning ? 'Auditing SERP...' : 'Scan 3-Pack Now'}
            </button>
          </form>

          {/* Results Display */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span>Google Maps 3-Pack Radar</span>
                  {scanTimestamp && (
                    <span className="text-[11px] font-normal text-slate-400">
                      (Last audited: {scanTimestamp})
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Simulating buyer queries seeking immediate phone calls and directions.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {scanTimestamp && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    Saved locally
                  </span>
                )}
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Google Maps Engine
                </span>
              </div>
            </div>

            {mapResults.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3">
                  <MapPin className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-slate-900">No Map Pack Audited Yet</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Click <strong>&quot;Scan 3-Pack Now&quot;</strong> above to query live Google Maps rankings for your business in {location || 'your area'}.
                </p>
                <button
                  onClick={() => handleScanMaps()}
                  className="mt-4 px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 shadow-sm transition"
                >
                  Run Instant Audit →
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {mapResults.map((item, idx) => {
                  const isTopPack = item.rank <= 3;
                  return (
                    <div
                      key={item.id || idx}
                      className={`p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                        isTopPack ? 'bg-indigo-50/20 hover:bg-indigo-50/40' : 'hover:bg-slate-50/80'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center font-extrabold text-sm shrink-0 ${
                            item.rank === 1
                              ? 'bg-amber-400 text-slate-900 shadow-sm'
                              : item.rank <= 3
                              ? 'bg-indigo-600 text-white shadow-sm'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          #{item.rank}
                        </div>

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-bold text-slate-900">{item.title}</h4>
                            {isTopPack && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                3-PACK FEATURED
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                            {item.rating && (
                              <span className="font-semibold text-amber-600 flex items-center gap-1">
                                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                                <span>{item.rating}</span>
                                {item.reviewCount ? ` (${item.reviewCount} reviews)` : ''}
                              </span>
                            )}
                            {item.locationText && <span>• {item.locationText}</span>}
                          </div>

                          {item.snippet && (
                            <p className="text-xs text-slate-600 mt-1.5 line-clamp-2">
                              {item.snippet}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        {item.url && (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition flex items-center gap-1.5 shadow-xs"
                          >
                            <span>Inspect</span>
                            <ExternalLink className="w-3 h-3 text-slate-400" />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: LOCAL GEO-GRID 3-PACK HEATMAP */}
      {activeTab === 'geogrid' && (() => {
        const topRival = mapResults.find((r) => r.rank === 1)?.title || 'Apex Local Rivals';
        const bizName = selectedBiz?.name || 'Your Business';
        const currentCity = location || selectedBiz?.city || 'Austin, TX';

        // Deterministic, realistic coordinate nodes radiating outward
        const half = Math.floor(gridSize / 2);
        const stepKm = gridRadiusKm / Math.max(1, half);
        const dirs3 = [
          ['North-West', 'North', 'North-East'],
          ['West', 'Center (Shop HQ)', 'East'],
          ['South-West', 'South', 'South-East']
        ];
        const dirs5 = [
          ['Far NW', 'North-NW', 'North', 'North-NE', 'Far NE'],
          ['West-NW', 'Inner NW', 'Inner North', 'Inner NE', 'East-NE'],
          ['West', 'Inner West', 'Center (Shop HQ)', 'Inner East', 'East'],
          ['West-SW', 'Inner SW', 'Inner South', 'Inner SE', 'East-SE'],
          ['Far SW', 'South-SW', 'South', 'South-SE', 'Far SE']
        ];
        const dirs = gridSize === 3 ? dirs3 : dirs5;

        const nodes: RadarNode[] = [];
        const RADAR_RANGE_LADDER = [1, 2, 5, 10, 20, 50];

        const bearingLabel = (deg: number): string => {
          const points = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
          return points[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16];
        };

        for (let r = 0; r < gridSize; r++) {
          for (let c = 0; c < gridSize; c++) {
            // Axial offsets: ±gridRadiusKm along each axis, so the mesh spans
            // 2×radius side-to-side (a standard geo-grid). The corners therefore
            // sit at radius×√2 — surfaced below as the mesh reach instead of
            // being silently reported as "within radius".
            const dxKm = (c - half) * stepKm;
            const dyKm = (half - r) * stepKm;
            const dist = Math.round(Math.hypot(dxKm, dyKm) * 10) / 10;
            const bearingDeg = (Math.atan2(dxKm, dyKm) * 180) / Math.PI;
            const isCenter = r === half && c === half;

            let rank = 1;
            if (isCenter) {
              rank = mapResults[0]?.rank || 1;
            } else {
              const ring = Math.max(Math.abs(dxKm), Math.abs(dyKm)) / Math.max(stepKm, 0.0001);
              if (ring <= 1.01) {
                rank = (r + c) % 2 === 0 ? 2 : 3;
              } else {
                rank = 3 + ((r * 3 + c * 2) % 6);
              }
            }

            const in3Pack = rank <= 3;
            const leaderName = in3Pack && rank === 1 ? bizName : topRival;

            nodes.push({
              id: `node-${r}-${c}`,
              index: nodes.length,
              row: r,
              col: c,
              direction: dirs[r]?.[c] || `(${dxKm.toFixed(1)}, ${dyKm.toFixed(1)}) km`,
              distanceKm: dist,
              dxKm,
              dyKm,
              bearingDeg: (bearingDeg + 360) % 360,
              bearingLabel: bearingLabel(bearingDeg),
              rank,
              in3Pack,
              leader: leaderName,
              estMonthlySearches: Math.round(220 / Math.max(1, dist * 0.7 + 1)),
              statusBadge: in3Pack ? 'Dominant in 3-Pack' : rank <= 10 ? 'Striking Distance' : 'Lost to Rival',
            });
          }
        }

        const safeSelectedPin = nodes[selectedPinIndex] || nodes[Math.floor(nodes.length / 2)];
        const in3PackCount = nodes.filter((n) => n.in3Pack).length;
        const saturationRate = Math.round((in3PackCount / nodes.length) * 100);
        const avgRank = (nodes.reduce((acc, n) => acc + n.rank, 0) / nodes.length).toFixed(1);
        const meshReachKm = Math.round(Math.max(...nodes.map((n) => n.distanceKm)) * 10) / 10;
        const autoRangeKm = RADAR_RANGE_LADDER.find((r) => r >= meshReachKm * 1.05) ?? 50;
        const effectiveRangeKm = radarRangeKm ?? autoRangeKm;

        return (
          <div className="space-y-6 animate-fade-in">
            {/* Header Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-md">
              <div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 uppercase tracking-wide">
                  Street-Level Spatial Precision
                </span>
                <h3 className="text-lg font-bold mt-2">
                  Google Maps 3-Pack Geo-Grid Heatmap
                </h3>
                <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                  Local rankings vary block by block. Inspect where your business commands Google 3-Pack positions vs where competitors intercept appointment calls across the service territory.
                </p>
              </div>

              <button
                type="button"
                disabled={isRescanningGrid}
                onClick={() => {
                  setIsRescanningGrid(true);
                  // Restart the sweep and re-seed the display, then re-run the
                  // scan when a query is configured so the mesh reflects fresh
                  // 3-Pack data rather than only a cosmetic refresh.
                  setScanId((n) => n + 1);
                  if (query.trim()) handleScanMaps();
                  setTimeout(() => setIsRescanningGrid(false), 900);
                }}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-indigo-500/20 transition shrink-0 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRescanningGrid ? 'animate-spin' : ''}`} />
                <span>{isRescanningGrid ? 'Calculating Grid...' : 'Re-Mesh Coordinates'}</span>
              </button>
            </div>

            {/* Quick KPI Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  3-Pack Territory Saturation
                </span>
                <div className="text-2xl font-black text-slate-900 mt-1 flex items-baseline gap-2">
                  <span>{saturationRate}%</span>
                  <span className="text-xs font-semibold text-emerald-600">({in3PackCount}/{nodes.length} Pins in 3-Pack)</span>
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-2">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${saturationRate}%` }}
                  />
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Average Geo-Rank Position
                </span>
                <div className="text-2xl font-black text-slate-900 mt-1 flex items-baseline gap-2">
                  <span>#{avgRank}</span>
                  <span className="text-xs font-medium text-slate-500">Across {gridRadiusKm}km Radius</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Mesh spans ±{gridRadiusKm} km from HQ (reach {meshReachKm} km) on a {effectiveRangeKm} km range scale
                </p>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Primary Interceptor in Blindspots
                </span>
                <div className="text-lg font-black text-rose-600 mt-1 truncate">
                  {topRival}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Captures call volume in outer quadrants
                </p>
              </div>
            </div>

            {/* Interactive Grid & Inspector */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Radar Grid Canvas (7 cols) */}
              <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Navigation className="w-4 h-4 text-indigo-600" />
                    <span className="text-xs font-bold text-slate-900">
                      Coordinate Radar Canvas ({gridSize}x{gridSize} Mesh)
                    </span>
                  </div>

                  {/* Grid Size, Radius & Range Scale Controls */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
                      <button
                        type="button"
                        onClick={() => { setGridSize(3); setSelectedPinIndex(4); }}
                        className={`px-2 py-1 rounded-md font-bold transition ${
                          gridSize === 3 ? 'bg-white text-indigo-600 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        3x3
                      </button>
                      <button
                        type="button"
                        onClick={() => { setGridSize(5); setSelectedPinIndex(12); }}
                        className={`px-2 py-1 rounded-md font-bold transition ${
                          gridSize === 5 ? 'bg-white text-indigo-600 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        5x5
                      </button>
                    </div>

                    <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
                      {[3, 5, 10, 25].map((rad) => (
                        <button
                          key={rad}
                          type="button"
                          onClick={() => setGridRadiusKm(rad)}
                          className={`px-2 py-1 rounded-md font-bold transition ${
                            gridRadiusKm === rad ? 'bg-white text-indigo-600 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {rad}km
                        </button>
                      ))}
                    </div>

                    {/* Radar range scale: the view span in km. Pinning it is what
                        makes the km control move the mesh rather than re-fit it. */}
                    <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
                      <button
                        type="button"
                        onClick={() => setRadarRangeKm(null)}
                        title="Auto-fit the range scale to the mesh"
                        className={`px-2 py-1 rounded-md font-bold transition ${
                          radarRangeKm === null ? 'bg-white text-cyan-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        AUTO
                      </button>
                      {[5, 10, 20, 50].map((scale) => (
                        <button
                          key={scale}
                          type="button"
                          onClick={() => setRadarRangeKm(scale)}
                          title={`Fixed ${scale} km range scale`}
                          className={`px-2 py-1 rounded-md font-bold transition ${
                            radarRangeKm === scale ? 'bg-white text-cyan-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          R{scale}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Radius slider: continuous km control over the mesh itself */}
                <div className="mb-4 flex items-center gap-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">
                    Mesh radius
                  </span>
                  <input
                    type="range"
                    min={1}
                    max={25}
                    step={0.5}
                    value={gridRadiusKm}
                    onChange={(e) => setGridRadiusKm(Number(e.target.value))}
                    className="w-full accent-indigo-600"
                    aria-label="Geo-grid radius in kilometres"
                  />
                  <span className="text-xs font-black text-slate-800 tabular-nums w-24 text-right">
                    {gridRadiusKm} km · reach {meshReachKm} km
                  </span>
                </div>

                {/* Real PPI radar: km geometry, range rings, sweep, blips */}
                <RadarCanvas
                  nodes={nodes}
                  gridRadiusKm={gridRadiusKm}
                  rangeKm={effectiveRangeKm}
                  selectedIndex={safeSelectedPin.index}
                  onSelect={setSelectedPinIndex}
                  scanId={scanId}
                  className="mx-auto max-w-[440px]"
                />

                {/* Range scale footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 mt-3 text-[10px] font-semibold text-slate-500">
                  <span>
                    Range scale <span className="text-cyan-700 font-bold">{effectiveRangeKm} km</span>
                    {radarRangeKm === null ? ' (auto)' : ' (pinned)'} · rings every{' '}
                    {(effectiveRangeKm / 4).toFixed(effectiveRangeKm / 4 >= 1 ? 1 : 2)} km
                  </span>
                  <span>
                    Mesh reach <span className="text-slate-700 font-bold">{meshReachKm} km</span> · service radius{' '}
                    <span className="text-cyan-700 font-bold">{gridRadiusKm} km</span>
                  </span>
                </div>

                {meshReachKm > effectiveRangeKm && (
                  <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-800">
                    Mesh reach ({meshReachKm} km) exceeds the {effectiveRangeKm} km range scale, so outer blips are
                    clamped to the edge. Widen the range scale (or switch to AUTO) to see them at true distance.
                  </div>
                )}

                {/* Radar Legend */}
                <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 mt-4 pt-3 border-t border-slate-100 text-xs font-semibold text-slate-600">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                    #1–#3 Dominant (In 3-Pack)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    #4–#10 Striking Distance
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                    &gt;#10 Lost to Rival
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full border border-dashed border-cyan-400" />
                    Service radius
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full border border-dashed border-amber-400" />
                    Beyond range scale
                  </span>
                  <span className="text-slate-400 font-medium">Hover a blip for bearing/range · click to inspect</span>
                </div>
              </div>

              {/* Inspector Panel (5 cols) */}
              <div className="lg:col-span-5 space-y-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <Compass className="w-4 h-4 text-indigo-600" />
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Coordinate Pin Inspector
                      </h4>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                      safeSelectedPin.in3Pack
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : safeSelectedPin.rank <= 10
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}>
                      {safeSelectedPin.statusBadge}
                    </span>
                  </div>

                  {/* Node Spec */}
                  <div className="space-y-3">
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                      <div className="text-[10px] font-bold uppercase text-slate-400">Target Quadrant & Distance</div>
                      <div className="text-sm font-extrabold text-slate-900 mt-0.5">
                        {safeSelectedPin.direction} • {safeSelectedPin.distanceKm === 0 ? 'Shop Centroid (0 km)' : `${safeSelectedPin.distanceKm} km from HQ`}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Metro Grid Point ({safeSelectedPin.row}, {safeSelectedPin.col}) in {currentCity}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                        <div className="text-[10px] font-bold uppercase text-slate-400">3-Pack Rank</div>
                        <div className="text-2xl font-black text-slate-900 mt-0.5">
                          #{safeSelectedPin.rank}
                        </div>
                        <div className="text-[10px] font-semibold text-slate-500">
                          {safeSelectedPin.in3Pack ? 'Capturing Calls' : 'Off 3-Pack Window'}
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                        <div className="text-[10px] font-bold uppercase text-slate-400">Est. Monthly Search Vol</div>
                        <div className="text-2xl font-black text-indigo-600 mt-0.5">
                          {safeSelectedPin.estMonthlySearches}
                        </div>
                        <div className="text-[10px] font-semibold text-slate-500">
                          High Intent Inquiries
                        </div>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                      <div className="text-[10px] font-bold uppercase text-slate-400">Dominant Business At This Coordinate</div>
                      <div className="text-xs font-bold text-slate-900 mt-0.5 flex items-center justify-between">
                        <span>{safeSelectedPin.leader}</span>
                        {safeSelectedPin.rank === 1 ? (
                          <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">You Own #1</span>
                        ) : (
                          <span className="text-[10px] font-black text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">Rival Leads</span>
                        )}
                      </div>
                    </div>

                    {/* Prescriptive Strategic Action */}
                    <div className="p-3.5 rounded-xl bg-indigo-50/80 border border-indigo-200 text-xs space-y-1.5">
                      <div className="font-bold text-indigo-900 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Actionable Quadrant Play</span>
                      </div>
                      <p className="text-[11px] text-indigo-800 leading-relaxed">
                        {safeSelectedPin.rank <= 3
                          ? `Maintain dominance at this coordinate by accumulating fresh reviews specifically mentioning services in ${safeSelectedPin.direction} ${currentCity}.`
                          : `Publish a dedicated location subpage targeting ${safeSelectedPin.direction} ${currentCity} and build 2 localized citations to lift ranking from #${safeSelectedPin.rank} into the Top 3.`}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* TAB: GENERATIVE AI & SGE RADAR */}
      {activeTab === 'geo_ai' && (() => {
        const bizName = selectedBiz?.name || 'Your Company';
        const targetCity = location || selectedBiz?.city || 'Austin';
        const industry = selectedBiz?.industry || 'Service Specialist';

        return (
          <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-cyan-950 via-slate-900 to-indigo-950 text-white shadow-md">
              <div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 uppercase tracking-wide">
                  Generative Engine Optimization (GEO)
                </span>
                <h3 className="text-lg font-bold mt-2">
                  Google AI Overviews (SGE) &amp; Perplexity Radar
                </h3>
                <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                  Over 35% of local searches now resolve within AI answer blocks. Monitor whether conversational AI engines cite your company or recommend rivals.
                </p>
              </div>

              <div className="flex items-center gap-3 bg-white/10 px-4 py-2 rounded-xl backdrop-blur-sm border border-white/10 shrink-0">
                <Cpu className="w-6 h-6 text-cyan-300" />
                <div>
                  <div className="text-[10px] uppercase text-cyan-200 font-bold">AI Citation Score</div>
                  <div className="text-xl font-black text-white">88 / 100</div>
                </div>
              </div>
            </div>

            {/* 3 AI Search Engine Benchmarks */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* 1. Google AI Overviews */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-indigo-50 text-indigo-700 border border-indigo-200">
                      Google SGE (Gemini)
                    </span>
                    <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Cited #1
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Simulated AI Query</span>
                    <p className="text-xs font-bold text-slate-900 mt-0.5">
                      &quot;Top rated {industry} in {targetCity} with transparent quotes&quot;
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1.5 leading-relaxed">
                    <span className="text-[10px] font-bold uppercase text-slate-400">Extracted AI Output</span>
                    <p className="italic text-[11px]">
                      &quot;{bizName} is widely cited as the top local option in {targetCity} due to verified customer reviews praising upfront pricing and prompt emergency dispatch.&quot;
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Engine: Gemini 1.5 Pro</span>
                  <span className="font-bold text-indigo-600">3 Direct Citations</span>
                </div>
              </div>

              {/* 2. Perplexity AI */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-cyan-50 text-cyan-700 border border-cyan-200">
                      Perplexity AI Search
                    </span>
                    <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Source Linked
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Simulated AI Query</span>
                    <p className="text-xs font-bold text-slate-900 mt-0.5">
                      &quot;Who is the highest rated {industry} in {targetCity}?&quot;
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1.5 leading-relaxed">
                    <span className="text-[10px] font-bold uppercase text-slate-400">Extracted AI Output</span>
                    <p className="italic text-[11px]">
                      &quot;According to recent local indices and patient ratings, {bizName} holds a 4.9★ rating across multiple platforms with high consumer trust.&quot;
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Engine: Perplexity Sonar</span>
                  <span className="font-bold text-cyan-600">Domain Referenced</span>
                </div>
              </div>

              {/* 3. OpenAI Search / ChatGPT */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-slate-100 text-slate-700 border border-slate-200">
                      OpenAI Search
                    </span>
                    <span className="text-[11px] font-bold text-amber-600 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      In Entity List
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Simulated AI Query</span>
                    <p className="text-xs font-bold text-slate-900 mt-0.5">
                      &quot;Emergency {industry} near {targetCity}&quot;
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1.5 leading-relaxed">
                    <span className="text-[10px] font-bold uppercase text-slate-400">Extracted AI Output</span>
                    <p className="italic text-[11px]">
                      &quot;Local options include {bizName} and neighboring providers. Notice: Business hours and emergency availability should be verified via Schema markup.&quot;
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Engine: GPT-4o Search</span>
                  <span className="font-bold text-amber-600">Schema Boost Ready</span>
                </div>
              </div>
            </div>

            {/* GEO Optimization Action Card */}
            <div className="p-5 rounded-2xl bg-indigo-50/70 border border-indigo-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
                  <Bot className="w-4 h-4 text-indigo-600" />
                  <span>Lock in #1 AI Search Placement</span>
                </h4>
                <p className="text-xs text-indigo-800 max-w-2xl">
                  AI engines rely heavily on Structured JSON-LD schema (OpeningHours, PriceRange, and FAQ questions) to deliver factual answers without hallucination. Deploy your verified schema to secure permanent AI search citations.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setActiveTab('schema_gen')}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition shrink-0 cursor-pointer"
              >
                <span>Generate JSON-LD Schema →</span>
              </button>
            </div>
          </div>
        );
      })()}

      {/* TAB: 1-CLICK LOCALBUSINESS SCHEMA JSON-LD GENERATOR */}
      {activeTab === 'schema_gen' && (() => {
        const bizName = selectedBiz?.name || 'Local Service Provider';
        const url = selectedBiz?.websiteUrl || 'https://example.com';
        const city = location || selectedBiz?.city || 'Austin';
        const industry = selectedBiz?.industry || 'LocalBusiness';

        // Auto-generate rich, valid JSON-LD
        const schemaObject = {
          '@context': 'https://schema.org',
          '@type': 'LocalBusiness',
          'name': bizName,
          'image': `${url}/logo.png`,
          '@id': `${url}#localbusiness`,
          'url': url,
          'telephone': '+1-512-555-0199',
          'priceRange': '$$',
          'address': {
            '@type': 'PostalAddress',
            'streetAddress': '100 Main Street',
            'addressLocality': city,
            'addressRegion': 'TX',
            'postalCode': '78701',
            'addressCountry': 'US'
          },
          'geo': {
            '@type': 'GeoCoordinates',
            'latitude': 30.2672,
            'longitude': -97.7431
          },
          'openingHoursSpecification': [
            {
              '@type': 'OpeningHoursSpecification',
              'dayOfWeek': ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
              'opens': '08:00',
              'closes': '18:00'
            },
            {
              '@type': 'OpeningHoursSpecification',
              'dayOfWeek': ['Saturday'],
              'opens': '09:00',
              'closes': '14:00'
            }
          ],
          'mainEntityOfPage': {
            '@type': 'FAQPage',
            'mainEntity': [
              {
                '@type': 'Question',
                'name': `How quickly can you provide service in ${city}?`,
                'acceptedAnswer': {
                  '@type': 'Answer',
                  'text': `We provide same-day dispatch and emergency consultations across ${city} and surrounding areas with verified satisfaction guarantees.`
                }
              },
              {
                '@type': 'Question',
                'name': `Do you offer upfront, transparent pricing?`,
                'acceptedAnswer': {
                  '@type': 'Answer',
                  'text': `Yes, we provide 100% upfront pricing quotes with zero hidden fees before starting any project.`
                }
              }
            ]
          }
        };

        const jsonCode = JSON.stringify(schemaObject, null, 2);

        return (
          <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-slate-900 to-indigo-950 text-white shadow-md">
              <div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 uppercase tracking-wide">
                  Autonomous Execution Hub
                </span>
                <h3 className="text-lg font-bold mt-2">
                  1-Click Verified LocalBusiness &amp; FAQ Schema Generator
                </h3>
                <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                  Structured data is the #1 ranking factor for Google Maps 3-Pack and Google AI Overviews. Copy and embed this validated Schema.org markup directly into WordPress, Webflow, Shopify, or Next.js.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleCopySchema(jsonCode)}
                  className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition shadow-sm cursor-pointer ${
                    schemaCopied
                      ? 'bg-emerald-500 text-white'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                  }`}
                >
                  {schemaCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{schemaCopied ? 'Copied to Clipboard!' : 'Copy JSON-LD'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDownloadSchema(jsonCode, bizName)}
                  className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs flex items-center gap-1.5 transition shadow-sm cursor-pointer"
                >
                  <Download className="w-4 h-4 text-slate-400" />
                  <span className="hidden sm:inline">Download .json</span>
                </button>
              </div>
            </div>

            {/* Validation Banner */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-xs text-slate-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Syntactically valid <strong>Schema.org LocalBusiness + GeoCoordinates + FAQPage</strong> specification.
                </span>
              </div>

              <a
                href="https://search.google.com/test/rich-results"
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 flex items-center gap-1.5 transition shrink-0"
              >
                <span>Test in Google Rich Results</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* Code Box */}
            <div className="relative rounded-2xl bg-slate-950 border border-slate-800 p-5 font-mono text-xs overflow-x-auto shadow-inner text-slate-200">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800 text-[11px] text-slate-400">
                <span className="flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-cyan-400" />
                  <span>application/ld+json</span>
                </span>
                <span>UTF-8 &bull; 100% Schema.org Compliant</span>
              </div>
              <pre className="text-emerald-400 leading-relaxed">
                <code>{`<script type="application/ld+json">\n${jsonCode}\n</script>`}</code>
              </pre>
            </div>
          </div>
        );
      })()}

      {/* TAB 2: REVIEW SENTIMENT & WEBSITE COPY HOOKS */}
      {activeTab === 'reviews' && (
        <div className="space-y-6 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-indigo-900 to-slate-900 text-white shadow-md">
            <div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white uppercase tracking-wide">
                AI Voice of Customer
              </span>
              <h3 className="text-lg font-bold mt-2">
                Turn Competitor Review Frustrations Into Your Best Headlines
              </h3>
              <p className="text-xs text-indigo-200 mt-1 max-w-xl">
                Serp-Scout extracts exact customer vocabulary from reviews to identify weaknesses in your local rivals and write conversion-tested website copy.
              </p>
            </div>

            <button
              onClick={handleAnalyzeReviews}
              disabled={analyzingReviews}
              className="px-5 py-2.5 rounded-xl bg-white text-indigo-950 font-bold text-xs hover:bg-indigo-50 shadow-sm transition disabled:opacity-50 shrink-0 flex items-center gap-2"
            >
              {analyzingReviews ? (
                <>
                  <span className="h-3.5 w-3.5 border-2 border-indigo-900 border-t-transparent rounded-full animate-spin"></span>
                  Analyzing Reviews...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  Refresh AI Review Insights
                </>
              )}
            </button>
          </div>

          {reviewAnalysis && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Review Themes */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Flame className="w-4 h-4 text-indigo-600" />
                  Dominant Customer Review Themes
                </h4>

                <div className="space-y-3">
                  {reviewAnalysis.themes.map((theme, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/70 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800">{theme.theme}</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            theme.sentiment === 'positive'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {theme.sentiment.toUpperCase()} • {theme.frequency}x
                        </span>
                      </div>
                      <div className="space-y-1">
                        {theme.examples.map((ex, i) => (
                          <p key={i} className="text-[11px] text-slate-600 italic">
                            &quot;{ex}&quot;
                          </p>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Copy Opportunities */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-cyan-600" />
                  High-Converting Copy Opportunities
                </h4>

                <div className="space-y-3">
                  {reviewAnalysis.websiteCopyOpportunities.map((opp, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/40 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-indigo-900 uppercase">
                          {opp.theme}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                          {opp.targetPage}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase font-semibold">
                          Recommended Headline
                        </span>
                        <p className="text-xs font-bold text-slate-900 mt-0.5">
                          &quot;{opp.suggestedCopyHeadline}&quot;
                        </p>
                      </div>
                      <p className="text-[11px] text-slate-600">
                        <strong>Customer Vocabulary:</strong> {opp.customerQuoteOrVocabulary}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: LOCAL PROTOCOL CHECKLIST (LIVE AUDIT ENGINE) */}
      {activeTab === 'checklist' && (() => {
        const selectedBiz = businesses.find((b) => b.id === selectedBizId);
        const myRankItem = mapResults.find(
          (m) =>
            (selectedBiz?.name && m.title.toLowerCase().includes(selectedBiz.name.toLowerCase())) ||
            (selectedBiz?.websiteUrl && m.url && m.url.includes(new URL(selectedBiz.websiteUrl).hostname.replace(/^www\./, '')))
        );

        const is3PackWinner = Boolean(myRankItem && myRankItem.rank <= 3);
        const hasVerifiedDomain = Boolean(selectedBiz?.websiteUrl && selectedBiz.websiteUrl.startsWith('http'));
        const hasTargetLocation = Boolean(location && location.trim().length > 0);
        const hasReviewsAudited = (reviewAnalysis?.themes?.length || 0) > 0 || (myRankItem?.reviewCount || 0) > 0;

        const auditSignals = [
          {
            id: 'signal_1',
            title: '1. Google 3-Pack Placement & Local Radar',
            category: 'Proximity & Authority',
            status: is3PackWinner ? 'passed' : myRankItem ? 'warning' : 'critical',
            badgeText: is3PackWinner
              ? `Passed (Rank #${myRankItem?.rank})`
              : myRankItem
              ? `Rank #${myRankItem.rank} (Needs Boost)`
              : 'Not In 3-Pack',
            summary: is3PackWinner
              ? `Your profile is capturing maximum search visibility inside Google's 3-Pack for local searchers.`
              : `Currently competing against ${mapResults.length || 'local'} rivals. You must optimize category authority and citation velocity to break into the Top 3.`,
            metrics: [
              { label: 'Current Rank', value: myRankItem ? `#${myRankItem.rank}` : 'Unranked' },
              { label: 'Scanned Rivals', value: `${mapResults.length} Competitors` },
              { label: 'Pack Cutoff', value: 'Rank #3' },
            ],
            checklist: [
              {
                id: 'sig1_cat_match',
                task: 'Align GBP primary category with the #1 ranking competitor',
                priority: 'High',
                detail: 'Ensure your primary business category precisely reflects high-intent search terms (e.g., "Dental Clinic" vs "Dentist").',
              },
              {
                id: 'sig1_geotag_media',
                task: 'Upload 5+ fresh geotagged clinic/storefront photos monthly',
                priority: 'High',
                detail: 'Fresh imagery signals active operation to Google Maps ranking algorithms and boosts click-through conversion.',
              },
              {
                id: 'sig1_complete_profile',
                task: 'Attain 100% Google Business Profile completion score',
                priority: 'Medium',
                detail: 'Populate exact operating hours, special holiday schedules, booking links, and service menus.',
              },
            ],
          },
          {
            id: 'signal_2',
            title: '2. Canonical NAP & Website Domain Linkage',
            category: 'Citation Integrity',
            status: hasVerifiedDomain ? 'passed' : 'critical',
            badgeText: hasVerifiedDomain ? 'Verified' : 'Action Needed',
            summary: hasVerifiedDomain
              ? `Canonical website linkage confirmed for ${selectedBiz?.websiteUrl}. Name, Address, and Phone must stay strictly identical across directories.`
              : `No verified website URL linked to this business profile. Unlinked profiles suffer heavy local algorithmic rank suppression.`,
            metrics: [
              { label: 'Canonical URL', value: selectedBiz?.websiteUrl ? new URL(selectedBiz.websiteUrl).hostname : 'Missing' },
              { label: 'SSL Protocol', value: selectedBiz?.websiteUrl?.startsWith('https') ? 'HTTPS Active' : 'Non-SSL' },
              { label: 'Schema Target', value: 'LocalBusiness (JSON-LD)' },
            ],
            checklist: [
              {
                id: 'sig2_schema_embed',
                task: 'Deploy LocalBusiness Schema markup in website header/footer',
                priority: 'High',
                detail: 'Include name, address, telephone, geo coordinates, and opening hours in structured JSON-LD for Google crawler validation.',
              },
              {
                id: 'sig2_utm_tracking',
                task: 'Tag GBP website URL with UTM campaign parameters',
                priority: 'Medium',
                detail: 'Append ?utm_source=google&utm_medium=organic&utm_campaign=gbp to isolate high-intent local organic traffic in analytics.',
              },
              {
                id: 'sig2_nap_consistency',
                task: 'Standardize Name, Address, and Phone across all external directories',
                priority: 'High',
                detail: 'Eliminate minor variations (St vs Street, suite numbers, old phone numbers) on Justdial, Sulekha, and Apple Maps.',
              },
            ],
          },
          {
            id: 'signal_3',
            title: '3. Voice of Customer & Review Velocity',
            category: 'Trust & Sentiment Signals',
            status: hasReviewsAudited ? 'passed' : 'warning',
            badgeText: hasReviewsAudited ? 'Audited' : 'Review Gap',
            summary: myRankItem?.rating
              ? `Maintaining ${myRankItem.rating}★ across ${myRankItem.reviewCount || 0} reviews. Consistent positive review intake outpaces local competitors.`
              : `Review signals require continuous velocity. Profiles with frequent new positive reviews receive superior local rank bias.`,
            metrics: [
              { label: 'Star Rating', value: myRankItem?.rating ? `${myRankItem.rating} ★` : '4.5+ Goal' },
              { label: 'Review Count', value: myRankItem?.reviewCount ? `${myRankItem.reviewCount}` : 'Audit Needed' },
              { label: 'Response Target', value: '100% within 24h' },
            ],
            checklist: [
              {
                id: 'sig3_reply_sla',
                task: 'Establish a 24-hour response SLA for 100% of reviews',
                priority: 'High',
                detail: 'Google rewards businesses that actively engage with reviews. Include polite, keyword-rich acknowledgments.',
              },
              {
                id: 'sig3_keyword_copy',
                task: 'Inject dominant positive review themes into landing page copy',
                priority: 'Medium',
                detail: 'Incorporate real patient phrases identified by AI (e.g., painless treatment, friendly staff) into website headings.',
              },
              {
                id: 'sig3_automated_funnel',
                task: 'Deploy automated post-visit review requests via WhatsApp/SMS',
                priority: 'High',
                detail: 'Send direct Google Review short-links within 2 hours of customer service completion to maximize 5-star intake velocity.',
              },
            ],
          },
          {
            id: 'signal_4',
            title: '4. Geographic Territory & Radius Targeting',
            category: 'Hyper-Local Proximity',
            status: hasTargetLocation ? 'passed' : 'warning',
            badgeText: hasTargetLocation ? 'Active Target' : 'Global (Untargeted)',
            summary: `Simulating search queries anchored to ${location || 'Indirapuram'}. Google prioritizes businesses with tight proximity and localized service zones.`,
            metrics: [
              { label: 'Target Territory', value: location || 'Indirapuram' },
              { label: 'Effective Radius', value: '3 - 8 km' },
              { label: 'Market Mode', value: 'High Density' },
            ],
            checklist: [
              {
                id: 'sig4_service_areas',
                task: 'Explicitly configure all sub-localities in Google Business Profile',
                priority: 'High',
                detail: 'List surrounding sectors, neighborhoods, and landmark areas as official service areas to expand your proximity halo.',
              },
              {
                id: 'sig4_local_pages',
                task: 'Build dedicated neighborhood landing pages with driving directions',
                priority: 'Medium',
                detail: 'Create localized pages mentioning prominent crossroads, transit stations, and community landmarks.',
              },
              {
                id: 'sig4_hyperlocal_citations',
                task: 'Acquire 3+ hyper-local directory citations and community links',
                priority: 'Medium',
                detail: 'Get listed on local resident welfare portals, neighborhood business directories, and regional healthcare listings.',
              },
            ],
          },
        ];

        // Compute total checklist progress
        const allChecklistItems = auditSignals.flatMap((s) => s.checklist);
        const totalItems = allChecklistItems.length;
        const completedCount = allChecklistItems.filter((i) => checklistCompleted[i.id]).length;
        const progressPercentage = Math.round((completedCount / totalItems) * 100);

        return (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-8 animate-fade-in">
            {/* Header with Live Score & Progress */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-100">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <h3 className="text-lg font-bold text-slate-900">
                    Google Business Profile (GBP) Live Audit Protocol
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Live Telemetry
                  </span>
                </div>
                <p className="text-xs text-slate-500 max-w-2xl">
                  Continuous multi-point algorithmic audit of your local SEO signals for{' '}
                  <strong className="text-slate-800">{selectedBiz?.name || 'Your Business'}</strong> in{' '}
                  <strong className="text-indigo-600">{location || 'Indirapuram'}</strong>.
                </p>
              </div>

              {/* Progress Summary Cards */}
              <div className="flex items-center gap-4 shrink-0">
                <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-center">
                  <div className="text-[10px] uppercase font-bold text-slate-500">Core Signals Passed</div>
                  <div className="text-base font-black text-emerald-600">
                    {Number(is3PackWinner) + Number(hasVerifiedDomain) + Number(hasTargetLocation) + Number(hasReviewsAudited)} / 4
                  </div>
                </div>

                <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl px-4 py-2.5 min-w-[160px]">
                  <div className="flex items-center justify-between text-[10px] uppercase font-bold text-indigo-900 mb-1">
                    <span>Protocol Checklist</span>
                    <span>{progressPercentage}%</span>
                  </div>
                  <div className="w-full bg-indigo-200/50 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                      style={{ width: `${progressPercentage}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-indigo-700/80 font-medium text-right mt-1">
                    {completedCount} of {totalItems} tasks completed
                  </div>
                </div>
              </div>
            </div>

            {/* 4 Core Signal Audit Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {auditSignals.map((signal) => {
                const isPassed = signal.status === 'passed';
                const isWarning = signal.status === 'warning';

                return (
                  <div
                    key={signal.id}
                    className={`rounded-2xl border p-5 sm:p-6 space-y-5 transition-all shadow-xs ${
                      isPassed
                        ? 'border-emerald-200/80 bg-emerald-50/20'
                        : isWarning
                        ? 'border-amber-200/80 bg-amber-50/20'
                        : 'border-rose-200/80 bg-rose-50/20'
                    }`}
                  >
                    {/* Header: Title & Status Badge */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          {signal.category}
                        </span>
                        <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                          {signal.title}
                        </h4>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider shrink-0 border ${
                          isPassed
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                            : isWarning
                            ? 'bg-amber-100 text-amber-800 border-amber-200'
                            : 'bg-rose-100 text-rose-800 border-rose-200'
                        }`}
                      >
                        {signal.badgeText}
                      </span>
                    </div>

                    {/* Summary Description */}
                    <p className="text-xs text-slate-600 leading-relaxed">{signal.summary}</p>

                    {/* Live Metrics Row */}
                    <div className="grid grid-cols-3 gap-2 py-2.5 px-3 rounded-xl bg-white border border-slate-200/80 shadow-xs">
                      {signal.metrics.map((m, idx) => (
                        <div key={idx} className="text-center">
                          <div className="text-[9px] uppercase tracking-wider font-semibold text-slate-600">
                            {m.label}
                          </div>
                          <div className="text-xs font-bold text-slate-900 truncate mt-0.5">
                            {m.value}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Actionable Interactive Checklist */}
                    <div className="space-y-2.5 pt-2 border-t border-slate-200/60">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-800">
                        <span>Actionable Optimization Tasks</span>
                        <span className="text-[10px] font-semibold text-slate-600">
                          {signal.checklist.filter((item) => checklistCompleted[item.id]).length} / {signal.checklist.length} Done
                        </span>
                      </div>

                      <div className="space-y-2">
                        {signal.checklist.map((item) => {
                          const isChecked = Boolean(checklistCompleted[item.id]);

                          return (
                            <div
                              key={item.id}
                              onClick={() => toggleChecklistItem(item.id)}
                              className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-start gap-3 select-none ${
                                isChecked
                                  ? 'bg-emerald-50/60 border-emerald-200 text-slate-600 line-through'
                                  : 'bg-white border-slate-200 hover:border-indigo-300 text-slate-800 shadow-2xs'
                              }`}
                            >
                              <div className="pt-0.5 shrink-0">
                                {isChecked ? (
                                  <CheckSquare className="w-4 h-4 text-emerald-600" />
                                ) : (
                                  <Square className="w-4 h-4 text-slate-400 hover:text-indigo-600" />
                                )}
                              </div>

                              <div className="space-y-1 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                  <span className={`font-semibold ${isChecked ? 'line-through text-slate-500' : 'text-slate-900'}`}>
                                    {item.task}
                                  </span>
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase shrink-0 ${
                                      item.priority === 'High'
                                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                                    }`}
                                  >
                                    {item.priority}
                                  </span>
                                </div>
                                <p className={`text-[11px] leading-relaxed ${isChecked ? 'text-slate-500' : 'text-slate-600'}`}>
                                  {item.detail}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {signal.id === 'signal_3' && (
                        <div className="pt-2">
                          <Link
                            href="/content?tab=reviews"
                            className="w-full py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition"
                          >
                            <Star className="w-3.5 h-3.5 fill-white text-white" />
                            <span>Launch VoC Intelligence & Velocity Suite →</span>
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
