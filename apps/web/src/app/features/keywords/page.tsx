'use client';

import React from 'react';
import Link from 'next/link';
import PublicNavbar from '@/components/PublicNavbar';
import PublicFooter from '@/components/PublicFooter';
import {
  Search,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Target,
  Zap,
  CheckCircle2,
  Lock,
} from 'lucide-react';

export default function KeywordsFeaturePage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 selection:bg-indigo-500 selection:text-white">
      <PublicNavbar />

      {/* Hero Section */}
      <section className="relative pt-16 pb-20 md:pt-24 md:pb-28 overflow-hidden">
        <div className="absolute inset-0 -z-30 opacity-40 pointer-events-none [mask-image:radial-gradient(ellipse_75%_65%_at_50%_40%,#000_50%,transparent_100%)]">
          <svg className="w-full h-full" width="100%" height="100%">
            <defs>
              <pattern id="kw-grid-dots" width="32" height="32" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1.3" fill="#6366f1" opacity="0.35" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#kw-grid-dots)" />
          </svg>
        </div>

        <div className="absolute -top-16 left-10 w-[420px] h-[420px] bg-gradient-to-tr from-indigo-400/25 via-cyan-300/20 to-transparent rounded-full blur-3xl pointer-events-none -z-20 animate-orb-1" />
        <div className="absolute top-16 right-10 w-[460px] h-[460px] bg-gradient-to-bl from-cyan-400/25 via-emerald-300/15 to-indigo-300/15 rounded-full blur-3xl pointer-events-none -z-20 animate-orb-2" />

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-cyan-50 text-cyan-800 border border-cyan-200/80 shadow-2xs mb-6">
            <Search className="w-4 h-4 text-cyan-600" />
            <span>Core Feature &bull; Striking-Distance Keyword Radar</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-slate-900 leading-[1.1] mb-6">
            Find the Keywords That{' '}
            <span className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-cyan-600 bg-clip-text text-transparent">
              Drive Direct Bookings
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-700 font-medium italic mb-4 max-w-2xl mx-auto">
            &ldquo;Success is measured by real business outcomes rather than an arbitrary visibility score.&rdquo;
          </p>

          <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto mb-10 leading-relaxed">
            Stop chasing high-difficulty national keywords you will never rank for. Serp-Scout finds striking-distance local search queries (Positions 4–10) that can break into Google Page 1 Top 3 with rapid, low-effort execution—prioritizing those that drive phone calls and bookings.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/sign-up?redirect_url=/app"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-bold text-sm sm:text-base text-white bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-700 hover:to-cyan-700 shadow-xl shadow-indigo-500/25 hover:scale-[1.02] active:scale-[0.98] transition cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-cyan-200" />
              <span>Discover Keyword Opportunities</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Keyword Opportunity Table */}
      <section className="py-16 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Prioritized By Revenue Potential
            </h2>
            <p className="text-sm sm:text-base text-slate-600 mt-2.5">
              Focus on keywords that are closest to Page 1 with the highest transactional intent.
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
            <div className="grid grid-cols-12 bg-slate-950 text-white text-xs font-bold px-4 sm:px-6 py-3 items-center">
              <div className="col-span-5 sm:col-span-4">Keyword</div>
              <div className="col-span-2 text-center">Position</div>
              <div className="col-span-2 text-center">Intent</div>
              <div className="col-span-3 sm:col-span-4 text-right">Opportunity</div>
            </div>
            <div className="divide-y divide-slate-200">
              {[
                { kw: '"emergency dentist near me"', pos: 4, intent: 'Transactional', opp: 'High — Quick Win' },
                { kw: '"walk in dentist austin"', pos: 5, intent: 'Transactional', opp: 'High — Maps Potential' },
                { kw: '"24 hour dental austin"', pos: 6, intent: 'Transactional', opp: 'High — Urgent Intent' },
                { kw: '"same day dental crown austin"', pos: 8, intent: 'Transactional', opp: 'Med-High — Service Page' },
              ].map((item, i) => (
                <div key={i} className="grid grid-cols-12 px-4 sm:px-6 py-3 items-center hover:bg-slate-50/80 transition">
                  <div className="col-span-5 sm:col-span-4 text-sm font-medium text-slate-900 truncate">{item.kw}</div>
                  <div className="col-span-2 text-center">
                    <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">#{item.pos}</span>
                  </div>
                  <div className="col-span-2 text-center">
                    <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">{item.intent}</span>
                  </div>
                  <div className="col-span-3 sm:col-span-4 text-right text-xs font-bold text-emerald-700">{item.opp}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Feature Deep Dive */}
      <section className="py-16 bg-slate-50 border-y border-slate-200/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 rounded-2xl bg-white border border-slate-200 flex flex-col justify-between hover:shadow-lg hover:scale-[1.01] transition-all animate-fade-in">
              <div>
                <div className="w-12 h-12 rounded-xl bg-cyan-100 flex items-center justify-center text-cyan-600 mb-4">
                  <Target className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Striking-Distance Clustering</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Automatically flags queries currently on positions 4 to 10. These terms require minor on-page adjustments to yield dramatic traffic surges.
                </p>
              </div>
              <div className="pt-4 mt-4 border-t border-slate-200 text-xs font-bold text-cyan-600">
                Positions 4–10 &bull; High Conversion
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-slate-200 flex flex-col justify-between hover:shadow-lg hover:scale-[1.01] transition-all animate-fade-in" style={{ animationDelay: '50ms' }}>
              <div>
                <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600 mb-4">
                  <Zap className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Search Intent Classification</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Categorizes keywords into Transactional (calls, quotes, appointments) vs Informational queries. Focus only on phrases with intent to buy.
                </p>
              </div>
              <div className="pt-4 mt-4 border-t border-slate-200 text-xs font-bold text-indigo-600">
                Transactional Intent Prioritized
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-slate-200 flex flex-col justify-between hover:shadow-lg hover:scale-[1.01] transition-all animate-fade-in" style={{ animationDelay: '100ms' }}>
              <div>
                <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 mb-4">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Estimated CPC Replacement Value</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Reveals how much Google Ads would cost to buy equivalent customer traffic, demonstrating tangible ROI from organic positioning.
                </p>
              </div>
              <div className="pt-4 mt-4 border-t border-slate-200 text-xs font-bold text-emerald-600">
                Ad Spend Dollar Replacement
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
          <h2 className="text-3xl font-extrabold mb-4">Unlock Your Striking-Distance Keywords</h2>
          <p className="text-slate-300 text-sm mb-8">
            Identify which high-intent search queries you are closest to ranking #1 for today—backed by live SERP data.
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
