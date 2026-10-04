'use client';

import React from 'react';
import Link from 'next/link';
import PublicNavbar from '@/components/PublicNavbar';
import PublicFooter from '@/components/PublicFooter';
import {
  Users,
  Sparkles,
  ArrowRight,
  TrendingUp,
  MapPin,
  CheckCircle2,
  ShieldCheck,
  Zap,
  Target,
  Search,
  Lock,
} from 'lucide-react';

export default function CompetitorsFeaturePage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 selection:bg-indigo-500 selection:text-white">
      <PublicNavbar />

      {/* Hero Section */}
      <section className="relative pt-16 pb-20 md:pt-24 md:pb-28 overflow-hidden">
        <div className="absolute inset-0 -z-30 opacity-40 pointer-events-none [mask-image:radial-gradient(ellipse_75%_65%_at_50%_40%,#000_50%,transparent_100%)]">
          <svg className="w-full h-full" width="100%" height="100%">
            <defs>
              <pattern id="comp-grid-dots" width="32" height="32" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1.3" fill="#6366f1" opacity="0.35" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#comp-grid-dots)" />
          </svg>
        </div>

        <div className="absolute -top-16 left-10 w-[420px] h-[420px] bg-gradient-to-tr from-indigo-400/25 via-cyan-300/20 to-transparent rounded-full blur-3xl pointer-events-none -z-20 animate-orb-1" />
        <div className="absolute top-16 right-10 w-[460px] h-[460px] bg-gradient-to-bl from-cyan-400/25 via-emerald-300/15 to-indigo-300/15 rounded-full blur-3xl pointer-events-none -z-20 animate-orb-2" />

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/80 shadow-2xs mb-6">
            <Users className="w-4 h-4 text-indigo-600" />
            <span>Core Feature &bull; Autonomous Competitor Discovery</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-slate-900 leading-[1.1] mb-6">
            Stop Guessing Who Takes{' '}
            <span className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-cyan-600 bg-clip-text text-transparent">
              Your Appointments
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-700 font-medium italic mb-4 max-w-2xl mx-auto">
            &ldquo;Success is measured by real business outcomes rather than an arbitrary visibility score.&rdquo;
          </p>

          <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto mb-10 leading-relaxed">
            Legacy tools flag Yelp, YellowPages, and Forbes as your competitors. Serp-Scout automatically filters out directories and pinpoints the actual local businesses taking customer phone calls and bookings in your target metro area—so every action you take hits a real rival.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/sign-up?redirect_url=/app"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-bold text-sm sm:text-base text-white bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-700 hover:to-cyan-700 shadow-xl shadow-indigo-500/25 hover:scale-[1.02] active:scale-[0.98] transition cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-cyan-200" />
              <span>Launch Competitor Radar</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Before/After Illustration */}
      <section className="py-16 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200">
              Before vs. After
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-3.5 tracking-tight">
              Cut the Noise. Focus on Real Rivals.
            </h2>
            <p className="text-sm sm:text-base text-slate-600 mt-2.5">
              Most tools show directories. Serp-Scout shows the businesses actually winning appointments in your city.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="px-2 py-0.5 rounded bg-rose-200 text-rose-800 text-[10px] font-black uppercase tracking-wider">Legacy Tools</span>
                <span className="text-xs text-rose-700">Directory-heavy, noisy</span>
              </div>
              <div className="space-y-2 text-xs text-slate-700">
                <div className="p-2 rounded-lg bg-white border border-rose-100">Yelp &bull; Yelp-style aggregator (Position #1)</div>
                <div className="p-2 rounded-lg bg-white border border-rose-100">YellowPages &bull; Directory</div>
                <div className="p-2 rounded-lg bg-white border border-rose-100">Angi &bull; Lead aggregator</div>
                <div className="p-2 rounded-lg bg-white border border-rose-100">Thumbtack &bull; Marketplace</div>
                <div className="p-2 rounded-lg bg-white border border-rose-100">Local Practice A &bull; Real competitor</div>
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="px-2 py-0.5 rounded bg-emerald-200 text-emerald-800 text-[10px] font-black uppercase tracking-wider">Serp-Scout</span>
                <span className="text-xs text-emerald-700">Only true direct rivals</span>
              </div>
              <div className="space-y-2 text-xs text-slate-700">
                <div className="p-2 rounded-lg bg-white border border-emerald-100 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Local Practice A &bull; Real competitor (Maps #2)
                </div>
                <div className="p-2 rounded-lg bg-white border border-emerald-100 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Local Practice B &bull; Real competitor (Maps #1)
                </div>
                <div className="p-2 rounded-lg bg-white border border-emerald-100 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Local Practice C &bull; Real competitor (Maps #3)
                </div>
                <div className="p-2 rounded-lg bg-white border border-emerald-100 text-slate-500 italic">
                  Directories filtered out automatically
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Deep Dive */}
      <section className="py-16 bg-white border-y border-slate-200/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              See What Makes a True Competitor
            </h2>
            <p className="text-sm sm:text-base text-slate-600 mt-2.5">
              Real rival detection, verified on live Google SERPs with full geo accuracy.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-between hover:shadow-lg hover:scale-[1.01] transition-all animate-fade-in">
              <div>
                <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600 mb-4">
                  <MapPin className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Google Maps 3-Pack Isolation</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Monitors the top 3 spots in Google Maps for local queries. Alerts you the instant a rival enters the 3-Pack and identifies why Google rewarded them.
                </p>
              </div>
              <div className="pt-4 mt-4 border-t border-slate-200 text-xs font-bold text-indigo-600">
                Live Maps Scraping &bull; Geo-Fenced
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-between hover:shadow-lg hover:scale-[1.01] transition-all animate-fade-in" style={{ animationDelay: '50ms' }}>
              <div>
                <div className="w-12 h-12 rounded-xl bg-cyan-100 flex items-center justify-center text-cyan-600 mb-4">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Market Share Overlap Matrix</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Calculates true competitive overlap based on transaction-intent searches, not informational vanity terms. You see exactly which queries drive revenue.
                </p>
              </div>
              <div className="pt-4 mt-4 border-t border-slate-200 text-xs font-bold text-cyan-600">
                Intent-Based Overlap Scoring
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-between hover:shadow-lg hover:scale-[1.01] transition-all animate-fade-in" style={{ animationDelay: '100ms' }}>
              <div>
                <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 mb-4">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Zero Directory Pollution</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Aggressively purges aggregator directories (Yelp, Angi, Thumbtack, YellowPages) so your action plans focus 100% on beating direct peer businesses.
                </p>
              </div>
              <div className="pt-4 mt-4 border-t border-slate-200 text-xs font-bold text-emerald-600">
                Filtered Real-World Rivals
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 bg-gradient-to-b from-slate-900 to-indigo-950 text-white relative overflow-hidden">
        <div className="absolute inset-0 -z-10 opacity-30">
          <div className="absolute -bottom-20 left-10 w-80 h-80 bg-cyan-500/20 rounded-full blur-3xl animate-orb-1" />
          <div className="absolute bottom-20 right-10 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl animate-orb-2" />
        </div>
        <div className="max-w-3xl mx-auto px-4 relative z-10">
          <h2 className="text-3xl font-extrabold mb-4">Ready to See Your Direct Competitors?</h2>
          <p className="text-slate-300 text-sm mb-8">
            Start your free scout to unlock real rival discovery, maps tracking, and evidence-backed actions.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/sign-up?redirect_url=/app"
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-bold bg-white hover:bg-slate-100 text-slate-900 transition flex items-center justify-center gap-2 shadow-xl hover:scale-105"
            >
              <span>Get Started Free</span>
              <ArrowRight className="w-4 h-4 text-indigo-600" />
            </Link>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
