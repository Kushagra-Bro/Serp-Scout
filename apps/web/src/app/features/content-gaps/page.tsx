'use client';

import React from 'react';
import Link from 'next/link';
import PublicNavbar from '@/components/PublicNavbar';
import PublicFooter from '@/components/PublicFooter';
import {
  FileText,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Layers,
  Search,
  Lock,
} from 'lucide-react';

export default function ContentGapsFeaturePage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 selection:bg-indigo-500 selection:text-white">
      <PublicNavbar />

      {/* Hero Section */}
      <section className="relative pt-16 pb-20 md:pt-24 md:pb-28 overflow-hidden">
        <div className="absolute inset-0 -z-30 opacity-40 pointer-events-none [mask-image:radial-gradient(ellipse_75%_65%_at_50%_40%,#000_50%,transparent_100%)]">
          <svg className="w-full h-full" width="100%" height="100%">
            <defs>
              <pattern id="content-grid-dots" width="32" height="32" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1.3" fill="#6366f1" opacity="0.35" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#content-grid-dots)" />
          </svg>
        </div>

        <div className="absolute -top-16 left-10 w-[420px] h-[420px] bg-gradient-to-tr from-indigo-400/25 via-cyan-300/20 to-transparent rounded-full blur-3xl pointer-events-none -z-20 animate-orb-1" />
        <div className="absolute top-16 right-10 w-[460px] h-[460px] bg-gradient-to-bl from-cyan-400/25 via-emerald-300/15 to-indigo-300/15 rounded-full blur-3xl pointer-events-none -z-20 animate-orb-2" />

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/80 shadow-2xs mb-6">
            <FileText className="w-4 h-4 text-indigo-600" />
            <span>Core Feature &bull; Autonomous Content Gap Engine</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-slate-900 leading-[1.1] mb-6">
            Find the Exact Pages Your Rivals Have{' '}
            <span className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-cyan-600 bg-clip-text text-transparent">
              That You Are Missing
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-700 font-medium italic mb-4 max-w-2xl mx-auto">
            &ldquo;Success is measured by real business outcomes rather than an arbitrary visibility score.&rdquo;
          </p>

          <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto mb-10 leading-relaxed">
            If a rival ranks #1 for a high-intent treatment, it's usually because they have a dedicated page you don't. Serp-Scout crawls rival sitemaps, analyzes their top-performing pages, and pinpoints exactly which high-converting pages you're missing.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/sign-up?redirect_url=/app"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-bold text-sm sm:text-base text-white bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-700 hover:to-cyan-700 shadow-xl shadow-indigo-500/25 hover:scale-[1.02] active:scale-[0.98] transition cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-cyan-200" />
              <span>Audit Content Gaps</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Gap Analysis Illustration */}
      <section className="py-16 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Turn Missing Pages Into Ranking Gains
            </h2>
            <p className="text-sm sm:text-base text-slate-600 mt-2.5">
              See exactly what content your rivals have that you're missing—ordered by revenue potential.
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
            <div className="grid grid-cols-12 bg-slate-950 text-white text-xs font-bold px-4 sm:px-6 py-3 items-center">
              <div className="col-span-6">Missing Page/Topic</div>
              <div className="col-span-3">Rival Has It</div>
              <div className="col-span-3 text-right">Priority</div>
            </div>
            <div className="divide-y divide-slate-200">
              {[
                { title: '/emergency-same-day-dentist-austin', rival: 'Yes (Ranks #1)', prio: 'Critical' },
                { title: '/dental-extractions-austin', rival: 'Yes (Top 3)', prio: 'High' },
                { title: '/service-areas/north-austin', rival: 'Yes (Service Area Pages)', prio: 'High' },
                { title: '/insurance/financing', rival: 'Yes (FAQ + Snippets)', prio: 'High' },
              ].map((item, i) => (
                <div key={i} className="grid grid-cols-12 px-4 sm:px-6 py-3 items-center hover:bg-slate-50/80 transition">
                  <div className="col-span-6 text-sm font-medium text-slate-900 truncate">{item.title}</div>
                  <div className="col-span-3">
                    <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">{item.rival}</span>
                  </div>
                  <div className="col-span-3 text-right">
                    <span className="text-xs font-bold text-indigo-700">{item.prio}</span>
                  </div>
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
                <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600 mb-4">
                  <Layers className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Service-Area Page Audits</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Reveals the localized neighborhood and suburb pages your competitors built to dominate neighboring zip codes.
                </p>
              </div>
              <div className="pt-4 mt-4 border-t border-slate-200 text-xs font-bold text-indigo-600">
                Neighborhood Geo-Targeting
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-slate-200 flex flex-col justify-between hover:shadow-lg hover:scale-[1.01] transition-all animate-fade-in" style={{ animationDelay: '50ms' }}>
              <div>
                <div className="w-12 h-12 rounded-xl bg-cyan-100 flex items-center justify-center text-cyan-600 mb-4">
                  <Search className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Missing Treatment &amp; FAQ Gaps</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Extracts the exact FAQs, pricing breakdowns, and insurance information competitors feature that Google uses to award rich snippets.
                </p>
              </div>
              <div className="pt-4 mt-4 border-t border-slate-200 text-xs font-bold text-cyan-600">
                Rich Snippet Qualification
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-slate-200 flex flex-col justify-between hover:shadow-lg hover:scale-[1.01] transition-all animate-fade-in" style={{ animationDelay: '100ms' }}>
              <div>
                <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 mb-4">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">AI Outline Generator</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Generates ready-to-publish content briefs grounded in real search results, complete with header structures and target local terms.
                </p>
              </div>
              <div className="pt-4 mt-4 border-t border-slate-200 text-xs font-bold text-emerald-600">
                Instant Publishing Briefs
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
          <h2 className="text-3xl font-extrabold mb-4">Close Your Content Gaps Today</h2>
          <p className="text-slate-300 text-sm mb-8">
            See which high-converting landing pages your competitors are using to capture appointments—backed by live SERP evidence.
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
