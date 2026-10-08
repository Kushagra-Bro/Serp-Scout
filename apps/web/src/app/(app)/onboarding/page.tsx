'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { apiClient } from '@/lib/api';
import AuthLoadingScreen from '@/components/AuthLoadingScreen';
import {
  MapPin,
  TrendingUp,
  Activity,
  Sparkles,
  Compass,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Rocket,
  Search,
  Building,
  Loader2,
} from 'lucide-react';

interface OnboardingFormData {
  businessName: string;
  websiteUrl: string;
  industry: string;
  country: string;
  city: string;
  serviceArea: string;
  servicesInput: string;
  primaryGoal: string;
}

const COUNTRIES = [
  'India',
  'United States',
  'United Kingdom',
  'Canada',
  'Australia',
  'United Arab Emirates',
  'Singapore',
  'Germany',
  'France',
  'Netherlands',
  'Spain',
  'Italy',
  'Brazil',
  'Mexico',
  'South Africa',
  'New Zealand',
  'Ireland',
  'Philippines',
  'Indonesia',
  'Malaysia',
  'Saudi Arabia',
  'Switzerland',
  'Sweden',
  'Other',
];

interface SeoGoalOption {
  id: string;
  label: string;
  badge: string;
  description: string;
}

const SEO_GOALS: SeoGoalOption[] = [
  {
    id: 'calls',
    label: 'More qualified phone calls & inquiries',
    badge: 'Immediate ROI',
    description: 'Capture high-intent local emergency and direct call queries in search results.',
  },
  {
    id: 'maps',
    label: 'Improved local Google Maps Pack visibility',
    badge: 'Map 3-Pack',
    description: 'Rank in top 3 local map spots across targeted neighborhood zones.',
  },
  {
    id: 'rivals',
    label: 'Outrank direct local competitors',
    badge: 'Competitive',
    description: 'Isolate key local rivals and conquer their displaced appointments & search traffic.',
  },
  {
    id: 'keywords',
    label: 'Win striking-distance keywords (Pos 4–15)',
    badge: 'Quick Wins',
    description: 'Identify keywords on the cusp of Page 1 and boost them into top positions.',
  },
  {
    id: 'content',
    label: 'Fix content gaps and missing service pages',
    badge: 'Content Gap',
    description: 'Detect missing service pages, schema markup, and topics that rivals rank for.',
  },
  {
    id: 'bookings',
    label: 'More online bookings or quote requests',
    badge: 'Conversions',
    description: 'Optimize discovery for customers ready to book appointments or request quotes.',
  },
];

const INDUSTRIES = [
  'Dental & Healthcare',
  'Home Services & Trades',
  'Legal & Financial Services',
  'Real Estate',
  'Fitness & Wellness',
  'Restaurants & Hospitality',
  'Professional Consulting',
  'Local Retail',
  'Other',
];

export default function OnboardingPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn, getToken } = useAuth();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [checkingExisting, setCheckingExisting] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<'starter' | 'pro' | 'agency'>('pro');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');
  const [selectedIndustry, setSelectedIndustry] = useState<string>('Dental & Healthcare');
  const [customIndustry, setCustomIndustry] = useState<string>('');

  const [selectedCountry, setSelectedCountry] = useState<string>('India');
  const [customCountry, setCustomCountry] = useState<string>('');

  const [selectedGoals, setSelectedGoals] = useState<string[]>([
    'More qualified phone calls & inquiries',
    'Improved local Google Maps Pack visibility',
    'Outrank direct local competitors',
  ]);

  const [formData, setFormData] = useState<OnboardingFormData>({
    businessName: '',
    websiteUrl: '',
    industry: 'Dental & Healthcare',
    country: 'India',
    city: '',
    serviceArea: '',
    servicesInput: '',
    primaryGoal: 'More qualified phone calls & inquiries; Improved local Google Maps Pack visibility; Outrank direct local competitors',
  });

  // Location Autocomplete Search State (City / Pincode / Place)
  const [locationQuery, setLocationQuery] = useState('');
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

  // Auto-redirect if the user already has at least one monitored business in their workspace
  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setCheckingExisting(false);
      return;
    }

    const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const isExplicitNew = params?.get('new') === 'true' || params?.get('force') === 'true';
    if (isExplicitNew) {
      setCheckingExisting(false);
      return;
    }

    // 1. Instant check from local cache
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('serp_scout_cached_businesses');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            router.replace('/app');
            return;
          }
        }
      } catch (e) {}
    }

    // 2. Authoritative check from API
    async function verifyBusinesses() {
      try {
        const token = await getToken();
        if (!token) {
          setCheckingExisting(false);
          return;
        }

        const list = await apiClient<any[]>('/api/businesses', { token });
        if (list && list.length > 0) {
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem('serp_scout_cached_businesses', JSON.stringify(list));
              if (!localStorage.getItem('serp_scout_active_biz_id')) {
                localStorage.setItem('serp_scout_active_biz_id', list[0].id);
              }
            } catch (e) {}
          }
          router.replace('/app');
          return;
        }
      } catch (err) {
        console.warn('Unable to verify businesses in onboarding:', err);
      } finally {
        setCheckingExisting(false);
      }
    }

    verifyBusinesses();
  }, [isLoaded, isSignedIn, getToken, router]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const queryCompany = params.get('company') || params.get('businessName');
      const queryUrl = params.get('url') || params.get('websiteUrl');
      const queryPlan = params.get('plan') || localStorage.getItem('serp_scout_selected_plan');
      const queryBilling = params.get('billing') || localStorage.getItem('serp_scout_billing_cycle');
      const savedCompany = localStorage.getItem('serp_scout_pending_company');

      if (queryPlan === 'starter' || queryPlan === 'pro' || queryPlan === 'agency') {
        setSelectedPlan(queryPlan);
      }
      if (queryBilling === 'monthly' || queryBilling === 'annual') {
        setBillingCycle(queryBilling);
      }

      const targetCompany = queryCompany || savedCompany;
      if (targetCompany) {
        const isUrl = targetCompany.includes('.') || targetCompany.startsWith('http');
        setFormData((prev) => ({
          ...prev,
          businessName: prev.businessName || (isUrl ? targetCompany.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '') : targetCompany),
          websiteUrl: prev.websiteUrl || (isUrl ? (targetCompany.startsWith('http') ? targetCompany : `https://${targetCompany}`) : ''),
        }));
      }
      if (queryUrl) {
        setFormData((prev) => ({
          ...prev,
          websiteUrl: queryUrl.startsWith('http') ? queryUrl : `https://${queryUrl}`,
        }));
      }
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleIndustryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedIndustry(val);
    if (val !== 'Other') {
      setFormData((prev) => ({ ...prev, industry: val }));
    } else {
      setFormData((prev) => ({ ...prev, industry: customIndustry.trim() || 'Other' }));
    }
  };

  const handleCustomIndustryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomIndustry(val);
    setFormData((prev) => ({ ...prev, industry: val.trim() || 'Other' }));
  };

  const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedCountry(val);
    if (val !== 'Other') {
      setFormData((prev) => ({ ...prev, country: val }));
    } else {
      setFormData((prev) => ({ ...prev, country: customCountry.trim() || 'Other' }));
    }
  };

  const handleCustomCountryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomCountry(val);
    setFormData((prev) => ({ ...prev, country: val.trim() || 'Other' }));
  };

  const handleLocationInputChange = (val: string) => {
    setLocationQuery(val);
    setFormData((prev) => ({ ...prev, city: val, serviceArea: val }));
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
    const resolvedArea = item.address || item.name;
    setLocationQuery(resolvedCity);
    setFormData((prev) => ({
      ...prev,
      city: resolvedCity,
      serviceArea: resolvedArea,
    }));
    setShowLocationDropdown(false);
  };

  const toggleGoal = (goalLabel: string) => {
    setSelectedGoals((prev) => {
      if (prev.includes(goalLabel)) {
        if (prev.length === 1) return prev; // keep at least 1 selected
        return prev.filter((g) => g !== goalLabel);
      } else {
        return [...prev, goalLabel];
      }
    });
  };

  const toggleAllGoals = () => {
    if (selectedGoals.length === SEO_GOALS.length) {
      setSelectedGoals([SEO_GOALS[0].label]);
    } else {
      setSelectedGoals(SEO_GOALS.map((g) => g.label));
    }
  };

  const validateStep1 = () => {
    if (!formData.businessName.trim()) {
      setError('Business name is required.');
      return false;
    }
    if (!formData.websiteUrl.trim()) {
      setError('Website URL is required.');
      return false;
    }
    try {
      const url = new URL(formData.websiteUrl.startsWith('http') ? formData.websiteUrl : `https://${formData.websiteUrl}`);
      if (!['http:', 'https:'].includes(url.protocol)) {
        setError('Please enter a valid web URL (http or https).');
        return false;
      }
    } catch {
      setError('Please enter a valid website address (e.g., https://example.com).');
      return false;
    }
    if (selectedIndustry === 'Other' && !customIndustry.trim()) {
      setError('Please enter your primary industry.');
      return false;
    }
    setError(null);
    return true;
  };

  const validateStep2 = () => {
    if (!formData.city.trim()) {
      setError('City/location is required for local competitive analysis.');
      return false;
    }
    if (selectedCountry === 'Other' && !customCountry.trim()) {
      setError('Please specify your country.');
      return false;
    }
    setError(null);
    return true;
  };

  const validateStep3 = () => {
    if (selectedGoals.length === 0) {
      setError('Please select at least one SEO goal.');
      return false;
    }
    setError(null);
    return true;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) setStep(2);
    if (step === 2 && validateStep2()) setStep(3);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep3()) return;
    setLoading(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) {
        throw new Error('Authentication session expired. Please sign in again.');
      }

      // 1. Ensure user has a workspace created
      let workspaceId: string;
      try {
        const myWs = await apiClient<{ activeWorkspace: { id: string } | null }>('/api/workspaces/me', { token });
        if (myWs.activeWorkspace) {
          workspaceId = myWs.activeWorkspace.id;
        } else {
          // Create new workspace
          const newWs = await apiClient<{ id: string }>('/api/workspaces', {
            token,
            method: 'POST',
            body: JSON.stringify({
              name: `${formData.businessName} Workspace`,
              plan: selectedPlan,
            }),
          });
          workspaceId = newWs.id;
        }
      } catch {
        // Fallback workspace creation
        const newWs = await apiClient<{ id: string }>('/api/workspaces', {
          token,
          method: 'POST',
          body: JSON.stringify({
            name: `${formData.businessName} Workspace`,
            plan: selectedPlan,
          }),
        });
        workspaceId = newWs.id;
      }

      // 2. Parse services from comma-separated input
      const servicesList = formData.servicesInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((name, idx) => ({
          name,
          priority: idx + 1,
        }));

      // Normalize website URL format
      const formattedUrl = formData.websiteUrl.startsWith('http')
        ? formData.websiteUrl
        : `https://${formData.websiteUrl}`;

      const effectiveIndustry =
        selectedIndustry === 'Other'
          ? (customIndustry.trim() || 'Other')
          : (formData.industry || selectedIndustry);

      const effectiveCountry =
        selectedCountry === 'Other'
          ? (customCountry.trim() || 'Other')
          : (formData.country || selectedCountry);

      const effectiveGoals = selectedGoals.join('; ');

      // 3. Create Business profile
      const bizRes = await apiClient<{ id: string } | any>('/api/businesses', {
        token,
        workspaceId,
        method: 'POST',
        body: JSON.stringify({
          name: formData.businessName,
          websiteUrl: formattedUrl,
          industry: effectiveIndustry,
          city: formData.city,
          country: effectiveCountry,
          serviceArea: formData.serviceArea || formData.city,
          primaryGoal: effectiveGoals,
          locations: [
            {
              name: `${formData.city} Primary Location`,
              city: formData.city,
              country: effectiveCountry,
            },
          ],
          services: servicesList,
        }),
      });

      const createdBusinessId = bizRes?.id || bizRes?.data?.id;
      const researchJobId = bizRes?.researchJobId || bizRes?.data?.researchJobId || null;

      // 4. Automatically trigger website analysis in the background
      let jobId: string | null = null;
      if (createdBusinessId) {
        try {
          const analyzeRes = await apiClient<{ jobId?: string; data?: { jobId?: string } }>(
            `/api/businesses/${createdBusinessId}/analyze`,
            {
              token,
              workspaceId,
              method: 'POST',
            }
          );
          jobId = analyzeRes?.jobId || analyzeRes?.data?.jobId || null;
        } catch (analyzeErr) {
          console.warn('Auto-analysis background dispatch notice:', analyzeErr);
        }
      }

      // #region agent log
      fetch('http://127.0.0.1:7537/ingest/08159c05-3a23-4a09-bfe4-16a226612021',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'97920a'},body:JSON.stringify({sessionId:'97920a',runId:'pre-fix',hypothesisId:'A',location:'onboarding/page.tsx:create',message:'Business created; jobs queued',data:{createdBusinessId,researchJobId,analyzeJobId:jobId,willPassJobIdToOverview:Boolean(jobId)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion

      // 5. Route to overview dashboard with auto-analysis parameters
      if (typeof window !== 'undefined' && createdBusinessId) {
        try {
          localStorage.setItem('serp_scout_active_biz_id', createdBusinessId);
        } catch (e) {}
      }

      const navParams = new URLSearchParams();
      navParams.set('auto_analyze', 'true');
      if (createdBusinessId) navParams.set('biz_id', createdBusinessId);
      if (jobId) navParams.set('job_id', jobId);

      router.push(`/app?${navParams.toString()}`);
    } catch (err: any) {
      console.error('Onboarding submission failed:', err);
      if (err?.code === 'DUPLICATE_WEBSITE') {
        setError(
          `${err.message} Use a different website, or open the existing profile from your dashboard to add a new location.`
        );
      } else {
        setError(err.message || 'Failed to complete onboarding. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (checkingExisting) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-full max-w-md">
          <AuthLoadingScreen
            message="Checking Workspace Status..."
            subMessage="Verifying your business profile and preparing competitive intelligence radar..."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[calc(100vh-4rem)] py-8 sm:py-12 px-4 overflow-hidden flex flex-col justify-center">
      {/* ── BACKGROUND MOTION VISUALS ── */}
      {/* 1. Subtle SVG Dot Grid Matrix */}
      <div className="absolute inset-0 -z-30 opacity-40 pointer-events-none [mask-image:radial-gradient(ellipse_75%_65%_at_50%_50%,#000_60%,transparent_100%)]">
        <svg className="w-full h-full" width="100%" height="100%">
          <defs>
            <pattern id="onboarding-grid-dots" width="28" height="28" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.2" fill="#6366f1" opacity="0.35" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#onboarding-grid-dots)" />
        </svg>
      </div>

      {/* 2. Dynamic Floating Radial Gradient Orbs */}
      <div className="absolute top-6 left-1/4 -translate-x-1/2 w-96 h-96 bg-gradient-to-tr from-indigo-500/25 via-cyan-400/20 to-transparent rounded-full blur-3xl pointer-events-none -z-20 animate-orb-1" />
      <div className="absolute bottom-6 right-1/4 translate-x-1/2 w-[480px] h-[480px] bg-gradient-to-bl from-cyan-500/20 via-emerald-400/15 to-indigo-500/15 rounded-full blur-3xl pointer-events-none -z-20 animate-orb-2" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-indigo-600/10 rounded-full blur-3xl pointer-events-none -z-20 animate-pulse" />

      {/* 3. Animated High-Tech Radar Scanning Sweep Visual */}
      <div className="hidden lg:block absolute top-12 right-6 xl:right-20 w-72 h-72 -z-10 pointer-events-none opacity-45">
        <div className="relative w-full h-full flex items-center justify-center">
          {/* Outer Ring with Coordinate Ticks */}
          <div className="absolute inset-0 rounded-full border border-indigo-400/25 border-dashed animate-spin" style={{ animationDuration: '60s' }} />
          {/* Middle Concentric Ring */}
          <div className="absolute inset-8 rounded-full border border-cyan-400/30" />
          {/* Inner Target Core */}
          <div className="absolute inset-16 rounded-full border border-indigo-500/20 bg-indigo-950/5" />
          <div className="absolute inset-24 rounded-full border border-emerald-400/40" />
          {/* Rotating Radar Sweep Cone */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-indigo-600/30 via-transparent to-transparent animate-radar" />
          {/* Target Crosshairs */}
          <div className="absolute w-full h-[1px] bg-indigo-400/20" />
          <div className="absolute h-full w-[1px] bg-indigo-400/20" />
          {/* Pulsing Target Pings */}
          <div className="absolute top-10 left-14 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          <div className="absolute top-10 left-14 w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <div className="absolute bottom-14 right-16 w-2 h-2 rounded-full bg-cyan-400 animate-ping" style={{ animationDuration: '2s' }} />
          <div className="absolute bottom-14 right-16 w-2 h-2 rounded-full bg-cyan-500" />
        </div>
      </div>

      {/* 4. Left Moving SERP Intelligence Badge */}
      <div className="hidden xl:flex absolute top-36 left-6 2xl:left-14 p-4 rounded-2xl bg-white/90 backdrop-blur-xl border border-slate-200/90 shadow-xl shadow-indigo-950/10 items-center gap-3.5 z-0 animate-float-1 max-w-[240px]">
        <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
          <MapPin className="w-5 h-5 text-emerald-600" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-900">Google Map 3-Pack</span>
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
              Rank #1
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">+42% Local Inquiries</p>
        </div>
      </div>

      {/* 5. Left Lower Moving Competitor Displaced Badge */}
      <div className="hidden xl:flex absolute bottom-28 left-6 2xl:left-16 p-4 rounded-2xl bg-white/90 backdrop-blur-xl border border-slate-200/90 shadow-xl shadow-indigo-950/10 items-center gap-3.5 z-0 animate-float-2 max-w-[240px]">
        <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center shrink-0">
          <TrendingUp className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-900">Rival Displaced</span>
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
              +5 Pos
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">Capturing appointments</p>
        </div>
      </div>

      {/* 6. Right Lower Moving Radar Status Badge */}
      <div className="hidden xl:flex absolute bottom-28 right-6 2xl:right-20 p-4 rounded-2xl bg-white/90 backdrop-blur-xl border border-slate-200/90 shadow-xl shadow-indigo-950/10 items-center gap-3.5 z-0 animate-float-1 max-w-[240px]" style={{ animationDelay: '2s' }}>
        <div className="w-10 h-10 rounded-xl bg-cyan-50 border border-cyan-200 flex items-center justify-center shrink-0">
          <Activity className="w-5 h-5 text-cyan-600" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-900">Autonomous Radar</span>
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">Evidence Grounded</p>
        </div>
      </div>

      {/* ── CARD CONTENT ── */}
      <div className="max-w-2xl w-full mx-auto relative z-10">
        {/* Progress Bar Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              Step {step} of 3
            </span>
            <span className="font-bold text-slate-700">
              {step === 1 && 'Business Identity'}
              {step === 2 && 'Location & Services'}
              {step === 3 && 'Goals & Alignment'}
            </span>
          </div>
          <div className="h-2 w-full bg-slate-200/80 rounded-full overflow-hidden shadow-inner">
            <div
              className="h-full bg-gradient-to-r from-indigo-600 via-indigo-700 to-cyan-500 transition-all duration-500 rounded-full"
              style={{ width: `${(step / 3) * 100}%` }}
            />
          </div>
        </div>

        {/* Card Form */}
        <div className="bg-white/95 backdrop-blur-xl border border-slate-200/90 rounded-3xl p-6 sm:p-10 shadow-xl shadow-indigo-950/5">
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700 font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* STEP 1 */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">What is your business?</h2>
                <p className="text-sm text-slate-500 mt-1">
                  We will discover your competitors and audit your search visibility automatically.
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Business Name *
                </label>
                <input
                  type="text"
                  name="businessName"
                  value={formData.businessName}
                  onChange={handleInputChange}
                  placeholder="e.g. Apex Dental Studio"
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Website URL *
                </label>
                <input
                  type="text"
                  name="websiteUrl"
                  value={formData.websiteUrl}
                  onChange={handleInputChange}
                  placeholder="e.g. https://apexdental.com"
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Primary Industry
                </label>
                <select
                  name="industry"
                  value={selectedIndustry}
                  onChange={handleIndustryChange}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white"
                >
                  {INDUSTRIES.map((ind) => (
                    <option key={ind} value={ind}>
                      {ind}
                    </option>
                  ))}
                </select>

                {selectedIndustry === 'Other' && (
                  <div className="mt-3 animate-in fade-in slide-in-from-top-1 duration-200">
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Specify Your Industry *
                    </label>
                    <input
                      type="text"
                      value={customIndustry}
                      onChange={handleCustomIndustryChange}
                      placeholder="e.g. Accounting, Solar Roofing, Pet Grooming, Architecture..."
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white"
                      autoFocus
                    />
                    <p className="text-xs text-slate-400 mt-1">
                      Serp-Scout will tailor competitor research, local keywords, and content gaps to this specific niche.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-4">
                <button
                  type="button"
                  onClick={handleNext}
                  className="px-6 py-2.5 rounded-lg bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 transition"
                >
                  Continue to Location →
                </button>
              </div>
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Where do you operate?</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Local search rankings and competitor discovery depend on your target city.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="relative">
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    City, Pincode, or Clinic/Shop Location *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      name="city"
                      value={locationQuery || formData.city}
                      onChange={(e) => handleLocationInputChange(e.target.value)}
                      onFocus={() => {
                        if (locationSuggestions.length > 0) setShowLocationDropdown(true);
                      }}
                      placeholder="e.g. Indirapuram, 201014, or Clove Dental"
                      className="w-full pl-9 pr-8 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                      required
                    />
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    {isSearchingLocation && (
                      <Loader2 className="w-4 h-4 text-indigo-600 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Search by city name, postal pincode, or business landmark to auto-detect canonical location.
                  </p>

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
                              <Building className="w-3.5 h-3.5" />
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

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Country *
                  </label>
                  <select
                    name="country"
                    value={selectedCountry}
                    onChange={handleCountryChange}
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white"
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>

                  {selectedCountry === 'Other' && (
                    <div className="mt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                      <input
                        type="text"
                        value={customCountry}
                        onChange={handleCustomCountryChange}
                        placeholder="Enter your country name"
                        className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white"
                        autoFocus
                      />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Primary Services (Comma-separated)
                </label>
                <input
                  type="text"
                  name="servicesInput"
                  value={formData.servicesInput}
                  onChange={handleInputChange}
                  placeholder="e.g. Teeth Whitening, Dental Implants, Emergency Dentist"
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Our website analyzer will also extract additional services automatically.
                </p>
              </div>

              <div className="flex justify-between items-center pt-4">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-800 transition"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  className="px-6 py-2.5 rounded-lg bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 transition"
                >
                  Continue to Goals →
                </button>
              </div>
            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">What are your SEO goals?</h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Select multiple options. Serp-Scout aligns rank audits, keyword opportunities, and weekly tasks to your selected targets.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={toggleAllGoals}
                  className="self-start sm:self-auto text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-1.5 rounded-lg transition"
                >
                  {selectedGoals.length === SEO_GOALS.length ? 'Clear All' : 'Select All'} ({selectedGoals.length}/{SEO_GOALS.length})
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {SEO_GOALS.map((goal) => {
                  const isChecked = selectedGoals.includes(goal.label);
                  return (
                    <div
                      key={goal.id}
                      onClick={() => toggleGoal(goal.label)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all duration-200 flex items-start gap-3.5 ${
                        isChecked
                          ? 'border-indigo-600 bg-indigo-50/50 shadow-xs'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 pointer-events-none"
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className={`text-sm font-bold ${isChecked ? 'text-indigo-950' : 'text-slate-800'}`}>
                            {goal.label}
                          </span>
                          <span
                            className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                              isChecked
                                ? 'bg-indigo-100/90 text-indigo-800 border-indigo-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            {goal.badge}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                          {goal.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-between items-center pt-4">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-800 transition"
                  disabled={loading}
                >
                  ← Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-8 py-3 rounded-lg bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 transition disabled:opacity-50 flex items-center gap-2 shadow-md shadow-indigo-600/20"
                >
                  {loading ? (
                    <>
                      <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      Launching Scout &amp; Running Analysis...
                    </>
                  ) : (
                    <span className="inline-flex items-center gap-1.5">
                      <span>Complete Setup &amp; Launch</span>
                      <Rocket className="w-4 h-4" />
                    </span>
                  )}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  </div>
);
}
