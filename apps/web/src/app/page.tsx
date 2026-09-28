'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUser, SignedIn, SignedOut, UserButton } from '@clerk/nextjs';
import {
  Search,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Activity,
  TrendingUp,
  MapPin,
  Layers,
  CheckCircle2,
  BarChart3,
  X,
  ExternalLink,
  Lock,
  Zap,
  Users,
  User,
  Target,
  Compass,
  Eye,
  Star,
  Award,
  ChevronRight,
  Flame,
  Check,
  Menu,
} from 'lucide-react';

function getUserDisplayName(user: any): string {
  if (!user) return 'Dashboard';
  if (user.fullName && user.fullName.trim()) return user.fullName;
  if (user.firstName && user.firstName.trim()) return user.firstName;
  if (user.username && user.username.trim()) return user.username;
  if (user.primaryEmailAddress?.emailAddress) {
    return user.primaryEmailAddress.emailAddress.split('@')[0];
  }
  if (user.emailAddresses && user.emailAddresses[0]?.emailAddress) {
    return user.emailAddresses[0].emailAddress.split('@')[0];
  }
  return 'Dashboard';
}

export default function HomePage() {
  const router = useRouter();
  const { user, isSignedIn, isLoaded } = useUser();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCompany, setSelectedCompany] = useState('Austin Smile Studio');
  const [activeTab, setActiveTab] = useState<'rivals' | 'keywords' | 'actions'>('rivals');
  const [comparisonView, setComparisonView] = useState<'matrix' | 'scenario'>('matrix');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (!query) {
      router.push(isSignedIn ? '/app' : '/sign-up');
      return;
    }
    const params = new URLSearchParams();
    if (query.startsWith('http://') || query.startsWith('https://') || query.includes('.')) {
      params.set('website', query);
    } else {
      params.set('company', query);
    }
    router.push(`${isSignedIn ? '/app' : '/sign-up'}?${params.toString()}`);
  };

  const handleChipClick = (companyName: string) => {
    setSearchQuery(companyName);
    setSelectedCompany(companyName);
    if (typeof window !== 'undefined') {
      localStorage.setItem('serp_scout_pending_company', companyName);
      const radarSection = document.getElementById('live-radar');
      if (radarSection) {
        radarSection.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-indigo-500 selection:text-white relative">
      {/* ─────────────────────────────────────────────────────────────
          1. HEADER WITH INTERACTIVE HOVER EFFECTS & MOBILE MENU
      ───────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-white/90 border-b border-slate-200/80 transition-all shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-700/60 flex items-center justify-center shadow-sm group-hover:scale-105 group-hover:border-indigo-500 transition-all duration-300">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" className="w-5 h-5">
                <circle cx="16" cy="16" r="10" stroke="#4f46e5" strokeWidth="1.5" strokeDasharray="3 2" fill="none" opacity="0.6" />
                <circle cx="16" cy="16" r="6" stroke="#38bdf8" strokeWidth="1.5" fill="none" />
                <circle cx="16" cy="16" r="2.5" fill="#10b981" />
                <path d="M16 4 L16 8 M16 24 L16 28 M4 16 L8 16 M24 16 L28 16" stroke="#38bdf8" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-lg tracking-tight text-slate-900 group-hover:text-indigo-600 transition-colors leading-none">
                Serp<span className="bg-gradient-to-r from-indigo-600 to-cyan-600 bg-clip-text text-transparent">Scout</span>
              </span>
              <span className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase mt-0.5">
                Autonomous SEO Radar
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links with Smooth Pill Hover */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-100/80 p-1 rounded-full border border-slate-200/60 shadow-inner">
            {[
              { label: 'Features', href: '#features' },
              { label: 'How It Works', href: '#how-it-works' },
              { label: 'Live Radar', href: '#live-radar' },
              { label: 'Comparison', href: '#comparison' },
            ].map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="px-4 py-1.5 rounded-full text-xs font-semibold text-slate-600 hover:text-indigo-600 hover:bg-white hover:shadow-xs transition-all duration-200"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* CTA & Auth Area */}
          <div className="flex items-center gap-2 sm:gap-3">
            {!isLoaded ? (
              // Hydration Fallback: render default buttons immediately so zero layout shift or missing button flash occurs
              <div className="flex items-center gap-2">
                <Link
                  href="/sign-in"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-900 rounded-lg transition"
                >
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Sign In</span>
                </Link>
                <Link
                  href="/sign-up"
                  className="px-3.5 sm:px-5 py-2 rounded-xl font-bold text-xs sm:text-sm text-white bg-gradient-to-r from-indigo-600 via-indigo-700 to-cyan-600 shadow-md shadow-indigo-500/20 flex items-center gap-1.5"
                >
                  <span>Sign Up Free</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ) : isSignedIn ? (
              <div className="flex items-center gap-2">
                <Link
                  href="/app"
                  className="relative group overflow-hidden px-4 sm:px-5 py-2 rounded-xl font-semibold text-xs sm:text-sm text-white bg-gradient-to-r from-indigo-600 via-indigo-700 to-cyan-600 shadow-md shadow-indigo-500/20 hover:shadow-lg hover:shadow-indigo-500/30 hover:scale-[1.02] active:scale-[0.99] transition-all duration-200 cursor-pointer flex items-center gap-2"
                >
                  {user?.imageUrl ? (
                    <img src={user.imageUrl} alt={getUserDisplayName(user)} className="w-4 h-4 rounded-full object-cover ring-1 ring-white/50" />
                  ) : (
                    <User className="w-4 h-4 text-cyan-200" />
                  )}
                  <span className="max-w-[130px] truncate">{getUserDisplayName(user)}</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </Link>
                <div className="pl-1">
                  <UserButton afterSignOutUrl="/" />
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/sign-in"
                  className="inline-flex items-center gap-1 px-2.5 sm:px-3.5 py-1.5 text-xs sm:text-sm font-bold text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition"
                >
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Sign In</span>
                </Link>
                <Link
                  href="/sign-up"
                  className="relative group overflow-hidden px-3.5 sm:px-5 py-2 rounded-xl font-bold text-xs sm:text-sm text-white bg-gradient-to-r from-indigo-600 via-indigo-700 to-cyan-600 shadow-md shadow-indigo-500/20 hover:shadow-lg hover:shadow-indigo-500/30 hover:scale-[1.02] active:scale-[0.99] transition-all duration-200 cursor-pointer flex items-center gap-1.5"
                >
                  <span>Sign Up Free</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            )}

            {/* Mobile Hamburger Menu Toggle */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white/95 backdrop-blur-xl px-4 pt-3 pb-5 space-y-2 animate-in fade-in slide-in-from-top-2 duration-200 shadow-xl">
            {[
              { label: 'Features Overview', href: '#features' },
              { label: 'How It Works', href: '#how-it-works' },
              { label: 'Live Product Radar', href: '#live-radar' },
              { label: 'Platform Comparison', href: '#comparison' },
            ].map((item) => (
              <a
                key={item.label}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-lg text-sm font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition"
              >
                {item.label}
              </a>
            ))}
            <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
              {isSignedIn ? (
                <Link
                  href="/app"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center px-4 py-2.5 rounded-xl font-bold text-sm text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition"
                >
                  Go to Dashboard ({getUserDisplayName(user)})
                </Link>
              ) : (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Link
                    href="/sign-in"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                  >
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Sign In</span>
                  </Link>
                  <Link
                    href="/sign-up"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-center gap-1 px-3 py-2 text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-cyan-600 rounded-lg shadow-sm transition"
                  >
                    <span>Sign Up Free</span>
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {/* ─────────────────────────────────────────────────────────────
          2. HERO SECTION WITH COMPANY SEARCH BAR
      ───────────────────────────────────────────────────────────── */}
      <section className="relative pt-12 pb-20 md:pt-20 md:pb-28 overflow-hidden">
        {/* ── BACKGROUND MOTION VISUALS ── */}
        {/* 1. Subtle High-Tech SVG Dot Grid Matrix */}
        <div className="absolute inset-0 -z-30 opacity-40 pointer-events-none [mask-image:radial-gradient(ellipse_80%_60%_at_50%_40%,#000_50%,transparent_100%)]">
          <svg className="w-full h-full" width="100%" height="100%">
            <defs>
              <pattern id="landing-hero-grid-dots" width="32" height="32" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1.3" fill="#6366f1" opacity="0.35" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#landing-hero-grid-dots)" />
          </svg>
        </div>

        {/* 2. Dynamic Floating Radial Gradient Orbs */}
        <div className="absolute -top-16 left-10 w-[420px] h-[420px] bg-gradient-to-tr from-indigo-400/25 via-cyan-300/20 to-transparent rounded-full blur-3xl pointer-events-none -z-20 animate-orb-1" />
        <div className="absolute top-16 right-10 w-[460px] h-[460px] bg-gradient-to-bl from-cyan-400/25 via-emerald-300/15 to-indigo-300/15 rounded-full blur-3xl pointer-events-none -z-20 animate-orb-2" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[350px] bg-indigo-100/40 rounded-full blur-3xl pointer-events-none -z-20" />

        {/* 3. Rotating High-Tech SERP Radar Scanner Visual in Center-Right */}
        <div className="absolute top-6 left-1/2 -translate-x-1/2 w-[520px] h-[520px] md:w-[680px] md:h-[680px] -z-10 pointer-events-none opacity-60">
          <div className="relative w-full h-full flex items-center justify-center">
            {/* Outer coordinate ring */}
            <div className="absolute inset-0 rounded-full border border-indigo-400/20 border-dashed animate-spin" style={{ animationDuration: '60s' }} />
            {/* Mid concentric rings */}
            <div className="absolute inset-16 md:inset-24 rounded-full border border-cyan-400/30" />
            <div className="absolute inset-32 md:inset-44 rounded-full border border-indigo-500/20 border-dotted" />
            <div className="absolute inset-48 md:inset-64 rounded-full border border-emerald-400/30" />
            {/* Rotating Radar Sweep Beam */}
            <div className="absolute inset-16 md:inset-24 rounded-full bg-gradient-to-tr from-cyan-500/20 via-indigo-600/10 to-transparent animate-radar" />
            {/* Radar Crosshairs */}
            <div className="absolute w-full h-[1px] bg-gradient-to-r from-transparent via-indigo-400/20 to-transparent" />
            <div className="absolute h-full w-[1px] bg-gradient-to-b from-transparent via-indigo-400/20 to-transparent" />
            {/* Live pulsing radar blips */}
            <div className="absolute top-24 left-28 w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
            <div className="absolute top-24 left-28 w-3 h-3 rounded-full bg-emerald-500 shadow-lg shadow-emerald-400/50" />
            <div className="absolute bottom-28 right-32 w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" style={{ animationDuration: '2.2s' }} />
            <div className="absolute bottom-28 right-32 w-2.5 h-2.5 rounded-full bg-cyan-500 shadow-lg shadow-cyan-400/50" />
            <div className="absolute top-1/3 right-20 w-2 h-2 rounded-full bg-indigo-400 animate-ping" style={{ animationDuration: '3s' }} />
          </div>
        </div>

        {/* 4. Left Floating Intelligence Badge */}
        <div className="hidden xl:flex absolute top-36 left-6 2xl:left-14 p-3.5 rounded-2xl bg-white/90 backdrop-blur-xl border border-slate-200/90 shadow-xl shadow-indigo-950/10 items-center gap-3 z-0 animate-float-1 max-w-[230px] text-left">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
            <MapPin className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-900">Google Map 3-Pack</span>
              <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">Rank #1</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5 font-medium">+42% Call Inquiries</p>
          </div>
        </div>

        {/* 5. Right Floating Competitor Intelligence Badge */}
        <div className="hidden xl:flex absolute top-48 right-6 2xl:right-14 p-3.5 rounded-2xl bg-white/90 backdrop-blur-xl border border-slate-200/90 shadow-xl shadow-indigo-950/10 items-center gap-3 z-0 animate-float-2 max-w-[230px] text-left">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-900">Local Rival Displaced</span>
              <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800">+5 Pos</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5 font-medium">Capturing direct appointments</p>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Pulsing Live Radar Status Pill */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/70 shadow-xs mb-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span>Live Multi-Engine SERP Radar &bull; Google Web, Maps &amp; News</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-slate-900 leading-[1.1] mb-6">
            Outrank Local Rivals.{' '}
            <span className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-cyan-600 bg-clip-text text-transparent">
              Win More Customers.
            </span>
          </h1>

          {/* Core Philosophy Callout */}
          <p className="text-lg sm:text-xl text-slate-700 font-medium italic mb-4 max-w-3xl mx-auto">
            &ldquo;Success is measured by real business outcomes rather than a &apos;visibility score.&apos;&rdquo;
          </p>

          <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto mb-10 leading-relaxed">
            Eliminate vanity metrics. Serp-Scout automatically pinpoints who takes appointments from you, identifies striking-distance ranking keywords, and delivers <strong className="text-slate-900 font-semibold">3 to 5 evidence-grounded actions</strong> every single week.
          </p>

          {/* ─────────────────────────────────────────────────────────────
              SEARCH BAR: ENTER COMPANY / WEBSITE
          ───────────────────────────────────────────────────────────── */}
          <div className="max-w-2xl mx-auto mb-6">
            <form
              onSubmit={handleSearchSubmit}
              className="relative flex flex-col sm:flex-row items-center gap-2 p-2 bg-white rounded-2xl shadow-xl shadow-indigo-950/5 border border-slate-200/80 focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/10 transition-all duration-300"
            >
              <div className="relative flex-1 w-full flex items-center pl-3">
                <Search className="w-5 h-5 text-indigo-500 shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Enter your business name or website (e.g. Austin Smile Studio)..."
                  className="w-full px-3 py-3 text-sm sm:text-base text-slate-800 placeholder-slate-400 bg-transparent focus:outline-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="p-1 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <button
                type="submit"
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-700 hover:to-cyan-700 shadow-md shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 shrink-0 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-cyan-200 animate-spin" style={{ animationDuration: '6s' }} />
                <span>Scan &amp; Analyze</span>
              </button>
            </form>

            {/* Quick Interactive Samples */}
            <div className="flex flex-wrap items-center justify-center gap-2 mt-3 text-xs text-slate-500">
              <span className="font-medium text-slate-600">Quick scan examples:</span>
              {[
                'Austin Smile Studio',
                'Apex Roofing & Contracting',
                'Skyline Legal Group',
              ].map((sample) => (
                <button
                  key={sample}
                  type="button"
                  onClick={() => handleChipClick(sample)}
                  className="px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-700 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/50 transition cursor-pointer shadow-2xs"
                >
                  {sample}
                </button>
              ))}
            </div>
          </div>

          {/* Trust Guarantees */}
          <div className="flex flex-wrap items-center justify-center gap-6 pt-4 text-xs font-semibold text-slate-600">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              Zero-Trust SSRF Protected
            </span>
            <span className="flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-cyan-600" />
              100% Evidence Grounded (No Hallucinations)
            </span>
            <span className="flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-500" />
              Sub-15s AI Local SERP Scan
            </span>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          3. DYNAMIC INTERACTIVE LIVE RADAR DEMO PREVIEW
      ───────────────────────────────────────────────────────────── */}
      <section id="live-radar" className="py-12 bg-white border-y border-slate-200/80 relative">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200/60">
              Live Product Experience
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2">
              See How Serp-Scout Operates in Real Time
            </h2>
            <p className="text-sm text-slate-500 max-w-xl mx-auto mt-1">
              Explore the live intelligence engine scanning an Austin, TX local dental practice:
            </p>
          </div>

          {/* Interactive Shell Container */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl overflow-hidden">
            {/* Top Bar with Tabs */}
            <div className="bg-slate-950/80 px-4 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                  <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                </div>
                <span className="text-xs text-slate-400 font-mono ml-2">
                  serp-scout-radar://austin-smile-studio
                </span>
              </div>

              {/* Dynamic Interactive Tab Switcher */}
              <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveTab('rivals')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
                    activeTab === 'rivals'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Direct Rivals (3)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('keywords')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
                    activeTab === 'keywords'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Striking-Distance Keywords (5)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('actions')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
                    activeTab === 'actions'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Action Plan (Top 3)
                </button>
              </div>
            </div>

            {/* Content Area */}
            <div className="p-6 text-slate-200 min-h-[360px] grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Visual Radar Sweeper */}
              <div className="lg:col-span-5 flex flex-col items-center justify-center bg-slate-950/60 rounded-xl p-6 border border-slate-800/80 relative overflow-hidden">
                <div className="relative w-48 h-48 sm:w-56 sm:h-56 flex items-center justify-center">
                  {/* Concentric rings */}
                  <div className="absolute inset-0 rounded-full border border-slate-800" />
                  <div className="absolute inset-6 rounded-full border border-slate-800/80" />
                  <div className="absolute inset-14 rounded-full border border-indigo-500/20" />
                  <div className="absolute inset-22 rounded-full border border-cyan-500/30" />

                  {/* Crosshairs */}
                  <div className="absolute inset-x-0 top-1/2 h-px bg-slate-800" />
                  <div className="absolute inset-y-0 left-1/2 w-px bg-slate-800" />

                  {/* Rotating radar sweep line */}
                  <div className="absolute inset-0 rounded-full animate-radar pointer-events-none">
                    <div className="w-1/2 h-1/2 bg-gradient-to-br from-indigo-500/30 via-transparent to-transparent origin-bottom-right rounded-tl-full" />
                  </div>

                  {/* Center Dot (User Business) */}
                  <div className="relative z-10 w-4 h-4 rounded-full bg-emerald-500 border-2 border-slate-900 shadow-md shadow-emerald-500/50 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                  </div>

                  {/* Competitor Blips */}
                  <div className="absolute top-8 right-12 flex items-center gap-1 group cursor-pointer">
                    <div className="w-3 h-3 rounded-full bg-rose-500 shadow-xs shadow-rose-500/80 animate-pulse" />
                    <span className="text-[10px] font-bold text-rose-300 bg-slate-900/90 px-1.5 py-0.5 rounded border border-rose-500/30">
                      #1 Capital Smiles (92%)
                    </span>
                  </div>

                  <div className="absolute bottom-10 left-8 flex items-center gap-1 group cursor-pointer">
                    <div className="w-3 h-3 rounded-full bg-amber-400 shadow-xs shadow-amber-400/80" />
                    <span className="text-[10px] font-bold text-amber-300 bg-slate-900/90 px-1.5 py-0.5 rounded border border-amber-500/30">
                      #2 Austin Dental Care (78%)
                    </span>
                  </div>

                  <div className="absolute top-16 left-12 flex items-center gap-1 group cursor-pointer">
                    <div className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                    <span className="text-[9px] text-cyan-300 bg-slate-900/80 px-1.5 py-0.5 rounded">
                      #3 North Austin Smiles
                    </span>
                  </div>
                </div>

                <div className="mt-4 text-center">
                  <p className="text-xs font-semibold text-slate-300">Live Austin SERP Cluster</p>
                  <p className="text-[11px] text-slate-500">
                    Target: <strong className="text-emerald-400">Austin Smile Studio</strong> &bull; Aggregators filtered
                  </p>
                </div>
              </div>

              {/* Right Column: Tab Content */}
              <div className="lg:col-span-7 flex flex-col justify-between">
                {activeTab === 'rivals' && (
                  <div className="space-y-3 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Direct Local Competitors (Filtered from Yelp)
                      </span>
                      <span className="text-xs font-semibold text-emerald-400">
                        3 Confirmed Rivals
                      </span>
                    </div>

                    {[
                      {
                        name: 'Capital Smiles Austin',
                        domain: 'capitalsmilesaustin.com',
                        threat: 92,
                        status: 'Direct Rival',
                        gaps: 'Emergency Dental, Invisalign Pricing',
                        rank: '#1 Organic & Maps 3-Pack',
                      },
                      {
                        name: 'Austin Dental Care Studio',
                        domain: 'austindentalcare.com',
                        threat: 78,
                        status: 'Direct Rival',
                        gaps: 'Pediatric Dentistry, Sedation',
                        rank: '#2 Organic',
                      },
                      {
                        name: 'Lakeline Family Dental',
                        domain: 'lakelinedental.com',
                        threat: 64,
                        status: 'Geographic Rival',
                        gaps: 'Weekend Hours, Free Consult',
                        rank: '#4 Maps 3-Pack',
                      },
                    ].map((comp, idx) => (
                      <div
                        key={comp.name}
                        className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 hover:border-slate-700 transition"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-bold text-sm text-white">{comp.name}</span>
                            <span className="text-xs text-slate-500 ml-2">({comp.domain})</span>
                          </div>
                          <span className="text-xs font-bold text-rose-400 bg-rose-950/50 px-2 py-0.5 rounded border border-rose-800/40">
                            {comp.threat}% Threat
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-slate-400">
                          <span>
                            Rank: <strong className="text-slate-200">{comp.rank}</strong>
                          </span>
                          <span>&bull;</span>
                          <span className="text-amber-300">
                            Key Gap: {comp.gaps}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 'keywords' && (
                  <div className="space-y-3 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Striking-Distance Opportunities (Positions #4–20)
                      </span>
                      <span className="text-xs font-semibold text-indigo-400">
                        High Conversion Upside
                      </span>
                    </div>

                    {[
                      {
                        phrase: 'invisalign austin tx',
                        rank: 4,
                        delta: '+4',
                        opp: 92,
                        intent: 'Commercial',
                        rival: '#1 Capital Smiles',
                      },
                      {
                        phrase: 'emergency dentist south austin',
                        rank: 7,
                        delta: '+2',
                        opp: 88,
                        intent: 'Local / Urgency',
                        rival: '#2 Austin Dental',
                      },
                      {
                        phrase: 'teeth whitening cost austin',
                        rank: 5,
                        delta: '+3',
                        opp: 84,
                        intent: 'Transactional',
                        rival: '#3 Lakeline',
                      },
                    ].map((kw) => (
                      <div
                        key={kw.phrase}
                        className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center justify-between"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-white">{kw.phrase}</span>
                            <span className="text-[10px] font-semibold text-indigo-300 bg-indigo-950 px-1.5 py-0.5 rounded border border-indigo-800/60">
                              {kw.intent}
                            </span>
                          </div>
                          <span className="text-xs text-slate-500">
                            Rival Ahead: <span className="text-slate-300">{kw.rival}</span>
                          </span>
                        </div>

                        <div className="text-right">
                          <div className="flex items-center gap-1.5 justify-end">
                            <span className="text-sm font-extrabold text-white">#{kw.rank}</span>
                            <span className="text-xs font-bold text-emerald-400 bg-emerald-950/50 px-1.5 py-0.5 rounded">
                              {kw.delta}
                            </span>
                          </div>
                          <span className="text-[11px] font-semibold text-cyan-400">
                            {kw.opp}% Opportunity
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 'actions' && (
                  <div className="space-y-3 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Evidence-Backed Actions (Week of Sep 22)
                      </span>
                      <span className="text-xs font-semibold text-amber-400">
                        3 Recommended Max
                      </span>
                    </div>

                    {[
                      {
                        priority: 'P0',
                        badge: 'bg-rose-950/70 text-rose-300 border-rose-800',
                        title: 'Publish Dedicated Emergency Dentistry Landing Page',
                        rationale: 'Capital Smiles ranks #1 with an emergency dental page capturing ~180 local calls/mo. Your site currently has no emergency keywords.',
                        citation: 'Grounded: Google SERP Run #2847 for "emergency dentist south austin"',
                      },
                      {
                        priority: 'P1',
                        badge: 'bg-indigo-950/70 text-indigo-300 border-indigo-800',
                        title: 'Add Transparent Invisalign Price Range to Service Page',
                        rationale: 'Top 3 rivals display payment plans and insurance accepted, creating high conversion trust.',
                        citation: 'Grounded: Competitor analysis on capitalsmilesaustin.com/invisalign',
                      },
                      {
                        priority: 'P2',
                        badge: 'bg-amber-950/70 text-amber-300 border-amber-800',
                        title: 'Acquire 5 Google Reviews Mentioning "Invisalign" and "Whitening"',
                        rationale: 'Google Maps 3-Pack prioritizes review mentions for local orthodontic keywords.',
                        citation: 'Grounded: Google Maps Place ID chIJD9... Review Analysis',
                      },
                    ].map((action) => (
                      <div
                        key={action.title}
                        className="p-3 rounded-lg bg-slate-950/60 border border-slate-800"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded border ${action.badge}`}>
                            {action.priority}
                          </span>
                          <span className="font-bold text-xs sm:text-sm text-white">
                            {action.title}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mb-1 leading-relaxed">
                          {action.rationale}
                        </p>
                        <span className="text-[10px] text-cyan-400/90 font-mono block">
                          &bull; {action.citation}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Footer action */}
                <div className="pt-4 border-t border-slate-800 flex items-center justify-between mt-2">
                  <span className="text-xs text-slate-400">
                    Want this actionable report for your own company?
                  </span>
                  <Link
                    href="/sign-up"
                    className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
                  >
                    <span>Unlock Your Free Radar Report</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          4. CORE FEATURES SHOWCASE
      ───────────────────────────────────────────────────────────── */}
      <section id="features" className="py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200">
              Outcome-Driven Intelligence
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mt-3">
              Why Serp-Scout Beats Traditional SEO Tools
            </h2>
            <p className="text-base text-slate-600 mt-2">
              Legacy tools inundate you with abstract domain ratings. Serp-Scout focuses exclusively on competitive advantages that bring paying customers to your door.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: Target,
                color: 'text-indigo-600 bg-indigo-50 border-indigo-200',
                title: 'Autonomous Rival Discovery',
                desc: 'Uncovers the genuine local businesses taking clicks and customers, automatically filtering out non-competing directories like Yelp, Angi, and YellowPages.',
              },
              {
                icon: TrendingUp,
                color: 'text-cyan-600 bg-cyan-50 border-cyan-200',
                title: 'Striking-Distance Radar',
                desc: 'Identifies keywords ranking in positions #4 to #20 where small, targeted adjustments yield immediate jumps to top-of-page traffic and phone calls.',
              },
              {
                icon: Layers,
                color: 'text-amber-600 bg-amber-50 border-amber-200',
                title: 'Deep Multi-Agent Gaps',
                desc: 'Analyzes competitor service offerings, pricing transparency, guarantee messaging, and review sentiment to pinpoint exact advantages you can seize.',
              },
              {
                icon: CheckCircle2,
                color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
                title: 'Curated 3–5 Weekly Actions',
                desc: 'No 200-page audits or decision paralysis. Every report delivers exactly 3 to 5 prioritized, high-leverage tasks with clear step-by-step instructions.',
              },
            ].map((feat) => (
              <div
                key={feat.title}
                className="p-6 bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md hover:border-indigo-300 transition-all duration-200 group"
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center border mb-5 ${feat.color}`}>
                  <feat.icon className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-2 group-hover:text-indigo-600 transition-colors">
                  {feat.title}
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {feat.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          5. HOW IT WORKS (3-STEP PIPELINE)
      ───────────────────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-16 bg-slate-100/60 border-y border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200">
              Simple 3-Step Workflow
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mt-3">
              How Serp-Scout Works
            </h2>
            <p className="text-base text-slate-600 mt-2">
              From entering your website to receiving prioritized weekly actions in less than 60 seconds:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {[
              {
                step: '01',
                title: 'Enter Your Website',
                desc: 'Our safe website analyzer reads your public homepage, extracts your core services, and identifies your local municipality without touching private systems.',
                tag: 'Zero-Trust SSRF Safe',
              },
              {
                step: '02',
                title: 'AI Multi-Agent SERP Sweep',
                desc: 'Autonomous agents query Google Web, Maps, and News. They classify direct rivals, measure position deltas, and spot competitor vulnerabilities.',
                tag: 'Google Web + Maps 3-Pack',
              },
              {
                step: '03',
                title: 'Receive Weekly Action Briefings',
                desc: 'Get executive PDF reports and transactional email alerts with 3 to 5 concrete actions designed to outrank rivals and generate new customer bookings.',
                tag: 'Evidence-Grounded Actions',
              },
            ].map((step, idx) => (
              <div
                key={step.step}
                className="bg-white p-8 rounded-2xl border border-slate-200 shadow-xs relative flex flex-col justify-between"
              >
                <div>
                  <span className="text-3xl font-black text-indigo-200 block mb-3">
                    {step.step}
                  </span>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">
                    {step.title}
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed mb-6">
                    {step.desc}
                  </p>
                </div>
                <div className="pt-4 border-t border-slate-100">
                  <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-200/60">
                    {step.tag}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          6. REAL COMPETITIVE COMPARISON (SEMRUSH / AHREFS / BRIGHTLOCAL VS SERP-SCOUT)
      ───────────────────────────────────────────────────────────── */}
      <section id="comparison" className="py-20 bg-slate-100/70 border-y border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-700 bg-indigo-100/90 px-3.5 py-1.5 rounded-full border border-indigo-200 inline-flex items-center gap-1.5 shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              Real-World Platform Comparison
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mt-3.5 tracking-tight">
              How Serp-Scout Compares to Semrush, Ahrefs &amp; BrightLocal
            </h2>
            <p className="text-sm sm:text-base text-slate-600 mt-2.5 leading-relaxed">
              Legacy SEO tools were built for enterprise marketing agencies analyzing thousands of abstract data points. Serp-Scout is purpose-built for local service businesses that need real customer calls.
            </p>

            {/* Interactive View Toggle */}
            <div className="inline-flex items-center gap-1.5 bg-white p-1.5 rounded-xl border border-slate-200 shadow-xs mt-6">
              <button
                type="button"
                onClick={() => setComparisonView('matrix')}
                className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all ${
                  comparisonView === 'matrix'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                Feature-by-Feature Matrix
              </button>
              <button
                type="button"
                onClick={() => setComparisonView('scenario')}
                className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all ${
                  comparisonView === 'scenario'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                Real Search Scenario: Local Emergency Dental
              </button>
            </div>
          </div>

          {/* VIEW 1: FEATURE-BY-FEATURE REAL MATRIX */}
          {comparisonView === 'matrix' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden animate-in fade-in duration-200">
              <div className="grid grid-cols-12 bg-slate-950 text-white font-bold text-xs sm:text-sm py-4 px-6 items-center border-b border-slate-800">
                <div className="col-span-4 sm:col-span-3">Capability &amp; Approach</div>
                <div className="col-span-3 sm:col-span-3 text-slate-300">
                  Semrush &amp; Ahrefs
                  <span className="block text-[11px] font-normal text-slate-400">Enterprise Crawlers</span>
                </div>
                <div className="col-span-2 sm:col-span-3 text-slate-300 hidden sm:block">
                  BrightLocal
                  <span className="block text-[11px] font-normal text-slate-400">Directory Trackers</span>
                </div>
                <div className="col-span-5 sm:col-span-3 text-cyan-400 flex items-center justify-between">
                  <div>
                    Serp-Scout
                    <span className="block text-[11px] font-normal text-emerald-400">AI Autonomous Scout</span>
                  </div>
                  <span className="hidden sm:inline-block text-[10px] uppercase font-black px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    Built for SMBs
                  </span>
                </div>
              </div>

              {[
                {
                  dimension: 'Primary Success Metric',
                  semrush: 'Domain Rating (DR) & Keyword Difficulty',
                  bright: 'Citation count & local grid pins',
                  scout: 'Real phone calls, direct bookings & revenue impact',
                },
                {
                  dimension: 'Competitor Identification',
                  semrush: 'Lumps Yelp, YellowPages, TripAdvisor & Wikipedia as "competitors"',
                  bright: 'Only tracks citations; cannot identify rival service pages',
                  scout: 'AI isolates true direct local business rivals (directories excluded)',
                },
                {
                  dimension: 'Action Delivery Format',
                  semrush: '200-page crawl dumps & technical jargon (missing alt tags, H1 audits)',
                  bright: 'Raw grid rank screenshots with red/green pins',
                  scout: 'Top 3 to 5 prioritized, high-impact weekly actions (P0–P2)',
                },
                {
                  dimension: 'Evidence & Verification',
                  semrush: 'Black-box proprietary estimates with no ground citations',
                  bright: 'Directory submission statuses',
                  scout: '100% ground truth linked to live Google Web, Maps 3-Pack & News citations',
                },
                {
                  dimension: 'Time Required per Week',
                  semrush: '5 to 10 hours deciphering multi-tab dashboards',
                  bright: '2 to 3 hours auditing manual directory listings',
                  scout: '5 minutes reading an executive PDF or email briefing',
                },
                {
                  dimension: 'Setup & Onboarding Time',
                  semrush: '1 to 2 days configuring projects, tags & crawler rules',
                  bright: 'Manual business verification & address PIN postcards',
                  scout: 'Under 60 seconds (just enter company name & website)',
                },
                {
                  dimension: 'Multi-Engine Coverage',
                  semrush: 'Google Web only (Maps requires expensive add-ons)',
                  bright: 'Maps citations only (no organic gap or news analysis)',
                  scout: 'Unified Google Web, Maps 3-Pack & News intelligence in one view',
                },
              ].map((row, idx) => (
                <div
                  key={row.dimension}
                  className={`grid grid-cols-12 py-4 px-6 text-xs sm:text-sm items-center border-b border-slate-100 transition-colors hover:bg-indigo-50/30 ${
                    idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                  }`}
                >
                  <div className="col-span-4 sm:col-span-3 font-bold text-slate-900 pr-2">
                    {row.dimension}
                  </div>
                  <div className="col-span-3 sm:col-span-3 text-slate-500 line-through decoration-slate-300 pr-3">
                    {row.semrush}
                  </div>
                  <div className="col-span-2 sm:col-span-3 text-slate-500 hidden sm:block line-through decoration-slate-300 pr-3">
                    {row.bright}
                  </div>
                  <div className="col-span-5 sm:col-span-3 font-bold text-indigo-950 flex items-start gap-2 bg-indigo-50/60 p-2 rounded-lg border border-indigo-100">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span className="text-slate-900">{row.scout}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* VIEW 2: REAL SEARCH SCENARIO CASE STUDY */}
          {comparisonView === 'scenario' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="bg-slate-950 text-white p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
                <div>
                  <span className="text-xs text-indigo-400 font-bold uppercase tracking-wider block mb-1">
                    Live Search Scenario Analysis
                  </span>
                  <span className="text-base sm:text-lg font-bold font-mono text-cyan-300">
                    &ldquo;emergency dentist south austin&rdquo; (320 qualified searches / month)
                  </span>
                </div>
                <span className="text-xs bg-slate-800/90 px-3.5 py-1.5 rounded-full text-slate-300 border border-slate-700 self-start sm:self-auto font-medium">
                  Target: Local Dental Practice
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Semrush / Ahrefs Card */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-extrabold text-sm text-slate-900">Semrush / Ahrefs</span>
                      <span className="text-xs text-slate-500 font-semibold bg-slate-100 px-2 py-0.5 rounded">
                        Enterprise Crawler
                      </span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-600 space-y-1.5 font-mono mb-4 border border-slate-100">
                      <div>KD: 48 &bull; Vol: 320 &bull; CPC: $14.20</div>
                      <div className="text-rose-600 font-semibold">Rivals: Yelp.com, YellowPages, Wikipedia</div>
                      <div className="text-slate-500">Audit: 4 missing image alt tags on /about-us</div>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed mb-4">
                      <strong>The Problem:</strong> Classifies Yelp and Wikipedia as your competitors and highlights technical code issues that do not impact local emergency patient inquiries.
                    </p>
                  </div>
                  <div className="pt-3 border-t border-slate-100 text-xs text-rose-600 font-semibold flex items-center gap-1.5">
                    <X className="w-4 h-4 shrink-0" /> Zero New Patient Calls Generated
                  </div>
                </div>

                {/* BrightLocal Card */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-extrabold text-sm text-slate-900">BrightLocal</span>
                      <span className="text-xs text-slate-500 font-semibold bg-slate-100 px-2 py-0.5 rounded">
                        Citation Tracker
                      </span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-600 space-y-1.5 font-mono mb-4 border border-slate-100">
                      <div>Rank: #8 on local 7x7 grid</div>
                      <div className="text-amber-600 font-semibold">Citations: 24 active / 16 missing</div>
                      <div className="text-slate-500">Action: Add listing to Brownbook &amp; Hotfrog</div>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed mb-4">
                      <strong>The Problem:</strong> Spends hours claiming obscure directory listings, without showing why your direct rival across town ranks #1 on Google Maps.
                    </p>
                  </div>
                  <div className="pt-3 border-t border-slate-100 text-xs text-amber-600 font-semibold flex items-center gap-1.5">
                    <X className="w-4 h-4 shrink-0" /> No Actionable Competitor Strategy
                  </div>
                </div>

                {/* Serp-Scout Card */}
                <div className="bg-gradient-to-b from-white via-indigo-50/40 to-indigo-50/70 p-6 rounded-2xl border-2 border-indigo-600 shadow-xl flex flex-col justify-between relative">
                  <div className="absolute -top-3 right-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black text-[10px] uppercase tracking-wider px-2.5 py-0.5 rounded-full shadow-xs flex items-center gap-1">
                    <Star className="w-3 h-3 fill-white" />
                    Clear Winner
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-extrabold text-sm text-indigo-950">Serp-Scout</span>
                      <span className="text-xs text-indigo-700 font-bold bg-indigo-100 px-2 py-0.5 rounded border border-indigo-200">
                        Autonomous Scout
                      </span>
                    </div>
                    <div className="p-3 bg-slate-950 text-white rounded-lg text-xs space-y-1.5 font-mono mb-4 border border-indigo-900/50">
                      <div className="text-cyan-300">True Rival: Capital Smiles Austin (Rank #1)</div>
                      <div className="text-amber-300">Gap: Added Same-Day Emergency page + pricing</div>
                      <div className="text-emerald-300">Action: Launch emergency page [Citation #2847]</div>
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed mb-4">
                      <strong>The Solution:</strong> Isolates the exact local competitor, analyzes their page strategy, and delivers 3 concrete tasks that helped the client capture ~180 qualified emergency patient calls in 30 days.
                    </p>
                  </div>
                  <div className="pt-3 border-t border-indigo-100 text-xs text-emerald-700 font-bold flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" /> ~180 Qualified Customer Inquiries Captured
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Quick CTA Hook */}
          <div className="mt-12 text-center">
            <Link
              href="/how-it-works"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-extrabold text-xs sm:text-sm text-white bg-indigo-600 hover:bg-indigo-700 shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer"
            >
              <span>See How Your Business Ranks Against Competitors</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          7. FINAL SIGN IN / SIGN UP CTA SECTION
      ───────────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-gradient-to-b from-slate-900 to-indigo-950 text-white relative overflow-hidden">
        {/* Ambient Gradient Glows */}
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-10 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <span className="text-xs font-extrabold uppercase tracking-wider text-cyan-400 bg-cyan-950/90 px-3.5 py-1.5 rounded-full border border-cyan-800/80 inline-flex items-center gap-1.5 shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            Start Dominating Local Search
          </span>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white mt-4 mb-4">
            Ready to Outrank Your Top Local Competitors?
          </h2>
          <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto mb-10 leading-relaxed">
            Scan your business in seconds. Uncover local search gaps, monitor rivals, and execute verified action plans that win real customers.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <SignedIn>
              <Link
                href="/app"
                className="w-full sm:w-auto px-8 py-4 rounded-xl font-extrabold text-sm sm:text-base text-slate-900 bg-white hover:bg-slate-100 shadow-xl shadow-white/10 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
              >
                {user?.imageUrl ? (
                  <img src={user.imageUrl} alt={getUserDisplayName(user)} className="w-5 h-5 rounded-full object-cover ring-1 ring-slate-300" />
                ) : (
                  <User className="w-5 h-5 text-indigo-600" />
                )}
                <span>Go to Dashboard ({getUserDisplayName(user)})</span>
                <ArrowRight className="w-4 h-4 text-indigo-600" />
              </Link>
            </SignedIn>
            <SignedOut>
              <Link
                href="/sign-up"
                className="w-full sm:w-auto px-8 py-4 rounded-xl font-extrabold text-sm sm:text-base text-slate-900 bg-white hover:bg-slate-100 shadow-xl shadow-white/10 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Scan Your Company (Sign Up)</span>
                <ArrowRight className="w-4 h-4 text-indigo-600" />
              </Link>

              <Link
                href="/sign-in"
                className="w-full sm:w-auto px-8 py-4 rounded-xl font-bold text-sm sm:text-base text-slate-200 bg-slate-800/90 border border-slate-700 hover:bg-slate-800 hover:text-white transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Lock className="w-4 h-4 text-cyan-400" />
                <span>Sign In to Account</span>
              </Link>
            </SignedOut>
          </div>

          <p className="text-xs text-slate-400 mt-6">
            Autonomous Google SERP &amp; Map 3-Pack Radar &bull; Zero configuration required &bull; 100% Evidence Grounded
          </p>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          8. FOOTER
      ───────────────────────────────────────────────────────────── */}
      <footer className="bg-slate-950 text-slate-400 py-12 border-t border-slate-800 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          <div className="col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center">
                <Compass className="w-4 h-4 text-indigo-400" />
              </div>
              <span className="font-extrabold text-base text-white tracking-tight">
                Serp<span className="text-cyan-400">Scout</span>
              </span>
            </div>
            <p className="text-slate-400 text-xs leading-relaxed max-w-sm">
              AI-powered competitive intelligence &amp; SEO platform for small businesses. Success is measured by real business outcomes rather than an arbitrary visibility score.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-slate-200 mb-3 uppercase tracking-wider text-[11px]">Product</h4>
            <ul className="space-y-2">
              <li><Link href="/how-it-works" className="hover:text-indigo-400 transition">How It Works</Link></li>
              <li><Link href="/features/competitors" className="hover:text-indigo-400 transition">Competitor Discovery</Link></li>
              <li><Link href="/features/keywords" className="hover:text-indigo-400 transition">Keyword Radar</Link></li>
              <li><Link href="/features/content-gaps" className="hover:text-indigo-400 transition">Content Gap Engine</Link></li>
              <li><Link href="/features/action-plans" className="hover:text-indigo-400 transition">Evidence Actions</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-slate-200 mb-3 uppercase tracking-wider text-[11px]">Security</h4>
            <ul className="space-y-2">
              <li><span className="text-emerald-400">Zero-Trust SSRF Protection</span></li>
              <li><span className="text-emerald-400">Multi-Tenant Scoping</span></li>
              <li><span className="text-emerald-400">0 Client Secrets Exposure</span></li>
              <li><span className="text-emerald-400">Monthly Quota Limiter</span></li>
            </ul>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-[11px] text-slate-500">
            &copy; {new Date().getFullYear()} Serp-Scout Core Engineering. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-[11px] text-slate-400">
            <SignedIn>
              <Link
                href="/app"
                className="inline-flex items-center gap-2 text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition bg-slate-900/90 border border-slate-700/80 hover:border-cyan-500/50 px-3.5 py-1.5 rounded-full shadow-sm"
              >
                {user?.imageUrl ? (
                  <img src={user.imageUrl} alt={getUserDisplayName(user)} className="w-4 h-4 rounded-full object-cover ring-1 ring-cyan-400/60" />
                ) : (
                  <User className="w-3.5 h-3.5 text-cyan-400" />
                )}
                <span>{getUserDisplayName(user)}</span>
              </Link>
            </SignedIn>
            <SignedOut>
              <Link href="/sign-in" className="hover:text-white transition">Sign In</Link>
              <Link href="/sign-up" className="hover:text-white transition">Sign Up</Link>
            </SignedOut>
          </div>
        </div>
      </footer>
    </div>
  );
}
