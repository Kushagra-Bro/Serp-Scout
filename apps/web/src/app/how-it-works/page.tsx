'use client';

import React from 'react';
import Link from 'next/link';
import PublicNavbar from '@/components/PublicNavbar';
import PublicFooter from '@/components/PublicFooter';
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Activity,
  Zap,
  Target,
  Search,
  Users,
  CheckCircle2,
  TrendingUp,
  MapPin,
  FileText,
  Lock,
  Layers,
  BarChart3,
  ChevronRight,
} from 'lucide-react';

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 selection:bg-indigo-500 selection:text-white">
      <PublicNavbar />

      {/* ── HERO SECTION ── */}
      <section className="relative pt-16 pb-20 md:pt-24 md:pb-28 overflow-hidden">
        {/* Background Motion Visuals */}
        <div className="absolute inset-0 -z-30 opacity-40 pointer-events-none [mask-image:radial-gradient(ellipse_75%_65%_at_50%_40%,#000_50%,transparent_100%)]">
          <svg className="w-full h-full" width="100%" height="100%">
            <defs>
              <pattern id="how-grid-dots" width="32" height="32" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1.3" fill="#6366f1" opacity="0.35" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#how-grid-dots)" />
          </svg>
        </div>

        <div className="absolute -top-16 left-10 w-[450px] h-[450px] bg-gradient-to-tr from-indigo-400/25 via-cyan-300/20 to-transparent rounded-full blur-3xl pointer-events-none -z-20 animate-orb-1" />
        <div className="absolute top-16 right-10 w-[480px] h-[480px] bg-gradient-to-bl from-cyan-400/25 via-emerald-300/15 to-indigo-300/15 rounded-full blur-3xl pointer-events-none -z-20 animate-orb-2" />

        {/* Rotating Radar Scanner */}
        <div className="hidden lg:block absolute top-10 right-10 xl:right-32 w-80 h-80 -z-10 pointer-events-none opacity-40">
          <div className="relative w-full h-full flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border border-indigo-400/30 border-dashed animate-spin" style={{ animationDuration: '60s' }} />
            <div className="absolute inset-8 rounded-full border border-cyan-400/35" />
            <div className="absolute inset-16 rounded-full border border-indigo-500/20" />
            <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-indigo-600/25 via-transparent to-transparent animate-radar" />
            <div className="absolute w-full h-[1px] bg-indigo-400/25" />
            <div className="absolute h-full w-[1px] bg-indigo-400/25" />
            <div className="absolute top-12 left-16 w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
            <div className="absolute top-12 left-16 w-3 h-3 rounded-full bg-emerald-500" />
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-2xs mb-6">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span>Complete Architecture &bull; Autonomous Competitive Ranking</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-slate-900 leading-[1.1] mb-6">
            How Serp-Scout Ranks Your Business{' '}
            <span className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-cyan-600 bg-clip-text text-transparent">
              Against Direct Competitors
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-700 font-medium italic mb-4 max-w-2xl mx-auto">
            &ldquo;Success is measured by real business outcomes rather than an arbitrary visibility score.&rdquo;
          </p>

          <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto mb-10 leading-relaxed">
            Legacy tools confuse Yelp, YellowPages, and Wikipedia with your real rivals. Serp-Scout isolates who actually takes paying clients from you, uncovers striking-distance opportunities, and tells you exactly what to do each week—backed by real Google SERP evidence.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/sign-up?redirect_url=/app"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-bold text-sm sm:text-base text-white bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-700 hover:to-cyan-700 shadow-xl shadow-indigo-500/25 hover:scale-[1.02] active:scale-[0.98] transition cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-cyan-200 animate-pulse-glow" />
              <span>Run Free Competitive Scan</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── 4-STEP METHODOLOGY BREAKDOWN ── */}
      <section className="py-16 bg-white border-y border-slate-200/80 relative">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200">
              The 4-Step Engine
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mt-3.5 tracking-tight">
              From Raw Google SERP Data to Direct Customer Calls
            </h2>
            <p className="text-sm sm:text-base text-slate-600 mt-2.5">
              Here's how our zero-trust pipeline transforms raw search data into revenue-driving actions you can execute in minutes.
            </p>
          </div>

          <div className="space-y-12">
            {/* Step 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-slate-50 p-6 sm:p-10 rounded-3xl border border-slate-200/80">
              <div className="lg:col-span-6 space-y-4">
                <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-indigo-600 bg-indigo-100 px-3 py-1 rounded-lg">
                  Step 01 &bull; Zero-Trust Multi-Engine Ingestion
                </div>
                <h3 className="text-2xl font-bold text-slate-900">
                  Real Local SERP &amp; Map 3-Pack Scraping
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Instead of querying centralized proxy databases that are weeks old, Serp-Scout queries Google Web, Maps 3-Pack, and News in real-time. Our zero-trust SSRF protection layer securely grounds all search data without exposing customer systems or secrets.
                </p>
                <ul className="space-y-2 text-xs text-slate-700 font-medium">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    Real-time geo-located coordinates matching your actual business city
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    Google Maps Pack positions 1, 2, and 3 tracked alongside organic web results
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    Zero directory pollution — automatically filters out Yelp, Angi, YellowPages
                  </li>
                </ul>
              </div>
              <div className="lg:col-span-6 bg-slate-900 text-slate-200 p-5 rounded-2xl font-mono text-xs border border-slate-800 shadow-xl">
                <div className="text-slate-400 mb-3 flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="flex items-center gap-1.5 font-bold text-slate-200">
                    <Activity className="w-3.5 h-3.5 text-cyan-400" />
                    SERP Ingestion Stream
                  </span>
                  <span className="text-[10px] text-emerald-400 font-bold">200 OK &bull; 142ms</span>
                </div>
                <div className="space-y-1.5 text-[11px]">
                  <div className="text-emerald-400">&gt; Query: &quot;emergency dental austin tx&quot;</div>
                  <div className="text-slate-400">&gt; Engine: Google Map 3-Pack + Organic SERP (Top 20)</div>
                  <div className="text-indigo-400">&gt; Filter: Directories pruned (Yelp, Healthgrades removed)</div>
                  <div className="text-cyan-300">&gt; Verified Local Rival: &quot;Austin Dental Care (Rank #1)&quot;</div>
                  <div className="text-slate-400">&gt; Grounded Evidence: Citation #SERP-8492 validated</div>
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-slate-50 p-6 sm:p-10 rounded-3xl border border-slate-200/80">
              <div className="lg:col-span-6 order-2 lg:order-1 bg-white p-6 rounded-2xl border border-slate-200 shadow-md">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Striking Distance Detection</div>
                <div className="space-y-3">
                  <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-xs text-slate-900">&quot;emergency dentist near me&quot;</div>
                      <div className="text-[11px] text-slate-500">Vol: 880 &bull; Intent: Transactional</div>
                    </div>
                    <span className="px-2 py-1 rounded bg-emerald-600 text-white font-black text-xs">
                      Pos #4 &rarr; #2
                    </span>
                  </div>
                  <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-200 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-xs text-slate-900">&quot;walk in dentist austin&quot;</div>
                      <div className="text-[11px] text-slate-500">Vol: 540 &bull; Intent: Urgent Booking</div>
                    </div>
                    <span className="px-2 py-1 rounded bg-indigo-600 text-white font-black text-xs">
                      Pos #6 &rarr; #3
                    </span>
                  </div>
                </div>
              </div>
              <div className="lg:col-span-6 order-1 lg:order-2 space-y-4">
                <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-indigo-600 bg-indigo-100 px-3 py-1 rounded-lg">
                  Step 02 &bull; Opportunity Pinpointing
                </div>
                <h3 className="text-2xl font-bold text-slate-900">
                  Striking-Distance Keyword Prioritization
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Ranking #48 for a high-difficulty keyword won&apos;t produce revenue this quarter. Serp-Scout isolates keywords hovering between positions 4 and 10—keywords that are just 1 or 2 small on-page adjustments away from Google Page 1 Top 3.
                </p>
                <div className="pt-2 text-xs text-indigo-700 font-bold flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-indigo-600" />
                  Fastest path to qualified inbound customer inquiries
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-slate-50 p-6 sm:p-10 rounded-3xl border border-slate-200/80">
              <div className="lg:col-span-6 space-y-4">
                <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-indigo-600 bg-indigo-100 px-3 py-1 rounded-lg">
                  Step 03 &bull; AI Semantic Extraction
                </div>
                <h3 className="text-2xl font-bold text-slate-900">
                  Automated Competitor Strategy Auditing
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Our LLM extraction pipeline analyzes the exact pages beating you in local search. It identifies missing pricing tables, lack of emergency same-day booking schemas, missing service-area landing pages, and weak location signals.
                </p>
                <div className="text-xs text-slate-500">
                  Citing direct competitor evidence rather than generic SEO boilerplate advice.
                </div>
                <div className="pt-1 text-xs font-semibold text-indigo-700 flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5" />
                  Grounded in live SERP citations for 100% verifiability
                </div>
              </div>
              <div className="lg:col-span-6 bg-slate-900 text-slate-200 p-5 rounded-2xl font-mono text-xs border border-slate-800 shadow-xl">
                <div className="text-slate-400 mb-2 pb-2 border-b border-slate-800 text-[11px] font-bold">
                  Competitor Strategy Diff: Austin Smile Studio vs Capital Smiles
                </div>
                <div className="space-y-2 text-[11px]">
                  <div className="text-rose-400">- Missing: Dedicated &quot;/emergency-same-day&quot; URL</div>
                  <div className="text-rose-400">- Missing: Local Business Schema &quot;openingHoursSpecification&quot;</div>
                  <div className="text-emerald-400">+ Opportunity: Add 24/7 call button + emergency pricing</div>
                  <div className="text-cyan-300">&gt; Impact Projection: ~35-50 calls/month</div>
                </div>
              </div>
            </div>

            {/* Step 4 */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-slate-50 p-6 sm:p-10 rounded-3xl border border-slate-200/80">
              <div className="lg:col-span-6 order-2 lg:order-1 bg-white p-6 rounded-2xl border border-slate-200 shadow-md">
                <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-4 flex items-center justify-between">
                  <span>Weekly Action Plan Preview</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">Verified</span>
                </div>
                <div className="space-y-2.5 text-xs text-slate-700 font-medium">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-slate-900">Publish &quot;Emergency Dental Austin&quot; Page</div>
                      <div className="text-slate-500 text-[11px] mt-0.5">Grounding: Rival outranks you by having dedicated symptom checklist.</div>
                    </div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-slate-900">Update Google Maps Business Primary Category</div>
                      <div className="text-slate-500 text-[11px] mt-0.5">Rival captures 3-Pack with category &quot;Emergency Dental Service&quot;.</div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="lg:col-span-6 order-1 lg:order-2 space-y-4">
                <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-indigo-600 bg-indigo-100 px-3 py-1 rounded-lg">
                  Step 04 &bull; Execution &amp; Results
                </div>
                <h3 className="text-2xl font-bold text-slate-900">
                  Weekly Evidence-Backed Action Playbook
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Instead of dumping a 90-page PDF report with hundreds of technical audit warnings you will never fix, Serp-Scout gives you 3 to 5 prioritized, concrete actions every week designed specifically to win client appointments.
                </p>
                <div className="text-xs font-bold text-emerald-700 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Real business outcomes over vanity visibility scores
                </div>
                <div className="text-xs text-slate-600 flex items-center gap-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Each action links to a verified citation you can audit yourself
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA BANNER ── */}
      <section className="py-20 bg-gradient-to-b from-slate-900 to-indigo-950 text-white relative overflow-hidden">
        <div className="absolute inset-0 -z-10 opacity-30">
          <div className="absolute -bottom-20 left-10 w-80 h-80 bg-cyan-500/20 rounded-full blur-3xl animate-orb-1" />
          <div className="absolute bottom-20 right-10 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl animate-orb-2" />
        </div>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <span className="text-xs font-extrabold uppercase tracking-wider text-cyan-400 bg-cyan-950/90 px-3.5 py-1.5 rounded-full border border-cyan-800/80 inline-flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse-glow" />
            Ready To Outrank Your Competitors?
          </span>
          <h2 className="text-3xl sm:text-5xl font-black text-white mt-4 mb-4 tracking-tight">
            See Your Real Local Ranking in 2 Minutes
          </h2>
          <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto mb-8 leading-relaxed">
            Enter your business name and target city. We&apos;ll automatically isolate your direct competitors and generate your first weekly action plan—no fluff, just evidence.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/sign-up?redirect_url=/app"
              className="w-full sm:w-auto px-8 py-4 rounded-xl font-bold text-sm sm:text-base text-slate-900 bg-white hover:bg-slate-100 shadow-xl hover:scale-105 transition flex items-center justify-center gap-2"
            >
              <span>Scan Your Company Now</span>
              <ArrowRight className="w-4 h-4 text-indigo-600" />
            </Link>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
