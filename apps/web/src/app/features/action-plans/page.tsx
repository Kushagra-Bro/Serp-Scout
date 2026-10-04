'use client';

import React from 'react';
import Link from 'next/link';
import PublicNavbar from '@/components/PublicNavbar';
import PublicFooter from '@/components/PublicFooter';
import {
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Target,
  ShieldCheck,
  Zap,
  Activity,
  Lock,
} from 'lucide-react';

export default function ActionPlansFeaturePage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 selection:bg-indigo-500 selection:text-white">
      <PublicNavbar />

      {/* Hero Section */}
      <section className="relative pt-16 pb-20 md:pt-24 md:pb-28 overflow-hidden">
        <div className="absolute inset-0 -z-30 opacity-40 pointer-events-none [mask-image:radial-gradient(ellipse_75%_65%_at_50%_40%,#000_50%,transparent_100%)]">
          <svg className="w-full h-full" width="100%" height="100%">
            <defs>
              <pattern id="act-grid-dots" width="32" height="32" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1.3" fill="#6366f1" opacity="0.35" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#act-grid-dots)" />
          </svg>
        </div>

        <div className="absolute -top-16 left-10 w-[420px] h-[420px] bg-gradient-to-tr from-indigo-400/25 via-cyan-300/20 to-transparent rounded-full blur-3xl pointer-events-none -z-20 animate-orb-1" />
        <div className="absolute top-16 right-10 w-[460px] h-[460px] bg-gradient-to-bl from-cyan-400/25 via-emerald-300/15 to-indigo-300/15 rounded-full blur-3xl pointer-events-none -z-20 animate-orb-2" />

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-2xs mb-6">
            <Target className="w-4 h-4 text-emerald-600" />
            <span>Core Feature &bull; 100% Evidence-Backed Actions</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-slate-900 leading-[1.1] mb-6">
            No 90-Page Audits.{' '}
            <span className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-cyan-600 bg-clip-text text-transparent">
              Just 3 to 5 Proven Steps.
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-700 font-medium italic mb-4 max-w-2xl mx-auto">
            &ldquo;Success is measured by real business outcomes rather than an arbitrary visibility score.&rdquo;
          </p>

          <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto mb-10 leading-relaxed">
            Eliminate vanity metrics. Every week, Serp-Scout analyzes your local Google SERP shifts and delivers 3 to 5 high-impact, verified tasks that directly win customer phone calls and outrank your top competitors—each backed by a live SERP citation.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/sign-up?redirect_url=/app"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-bold text-sm sm:text-base text-white bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-700 hover:to-cyan-700 shadow-xl shadow-indigo-500/25 hover:scale-[1.02] active:scale-[0.98] transition cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-cyan-200 animate-pulse-glow" />
              <span>Get Your Action Plan</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Action Plan Preview */}
      <section className="py-16 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Actionable, Verifiable, Prioritized
            </h2>
            <p className="text-sm sm:text-base text-slate-600 mt-2.5">
              Get concrete steps with evidence links—so you know exactly why each task matters.
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-6 space-y-4">
            {[
              { title: 'Publish "Emergency Dental Austin" service page', impact: 'High', effort: 'Low', evidence: 'SERP Citation #SERP-8492' },
              { title: 'Update Google Business Profile primary category to Emergency Dental Service', impact: 'High', effort: 'Low', evidence: 'Maps 3-Pack analysis' },
              { title: 'Add location schema + openingHours for same-day availability', impact: 'High', effort: 'Low', evidence: 'Competitor schema diff' },
            ].map((item, i) => (
              <div key={i} className="p-4 rounded-xl border border-slate-200 bg-slate-50/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-slate-900 text-sm">{item.title}</h3>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">{item.impact} Impact</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold">{item.effort} Effort</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">{item.evidence}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-emerald-700 font-bold self-start sm:self-auto">
                  <CheckCircle2 className="w-4 h-4" />
                  Evidence-Backed
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Deep Dive */}
      <section className="py-16 bg-slate-50 border-y border-slate-200/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 rounded-2xl bg-white border border-slate-200 flex flex-col justify-between hover:shadow-lg hover:scale-[1.01] transition-all animate-fade-in">
              <div>
                <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 mb-4">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">100% Evidence Grounded</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  No AI hallucinations. Every action item links directly to a verifiable SERP citation or competitor strategy element that justified the recommendation.
                </p>
              </div>
              <div className="pt-4 mt-4 border-t border-slate-200 text-xs font-bold text-emerald-600">
                Verifiable SERP Citations
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-slate-200 flex flex-col justify-between hover:shadow-lg hover:scale-[1.01] transition-all animate-fade-in" style={{ animationDelay: '50ms' }}>
              <div>
                <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600 mb-4">
                  <Zap className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Zero Vanity Metrics</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  We don&apos;t celebrate abstract &quot;domain authority&quot; or &quot;visibility scores.&quot; Success is measured by phone inquiries, booking clicks, and outranking rivals.
                </p>
              </div>
              <div className="pt-4 mt-4 border-t border-slate-200 text-xs font-bold text-indigo-600">
                Business Outcome Oriented
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-slate-200 flex flex-col justify-between hover:shadow-lg hover:scale-[1.01] transition-all animate-fade-in" style={{ animationDelay: '100ms' }}>
              <div>
                <div className="w-12 h-12 rounded-xl bg-cyan-100 flex items-center justify-center text-cyan-600 mb-4">
                  <Activity className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Autonomous Weekly Refresh</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  The engine automatically re-scrapes search results weekly or monthly, evaluates progress, and delivers fresh prioritized tasks directly to your dashboard.
                </p>
              </div>
              <div className="pt-4 mt-4 border-t border-slate-200 text-xs font-bold text-cyan-600">
                Automated BullMQ Workflows
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
          <h2 className="text-3xl font-extrabold mb-4">Execute Verified Actions That Win Clients</h2>
          <p className="text-slate-300 text-sm mb-8">
            Start your free scout to get your first week of prioritized, evidence-backed SEO actions—each verifiable with live SERP citations.
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
