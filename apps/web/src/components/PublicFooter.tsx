'use client';

import React from 'react';
import Link from 'next/link';
import { useUser, SignedIn, SignedOut } from '@/lib/auth';
import { User } from 'lucide-react';

function getUserDisplayName(user: any): string {
  if (!user) return 'Dashboard';
  if (user.name && user.name.trim()) return user.name;
  if (user.email) return user.email.split('@')[0];
  return 'Dashboard';
}

export default function PublicFooter() {
  const { user } = useUser();
  return (
    <footer className="bg-slate-950 text-slate-400 py-12 border-t border-slate-800 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
        <div className="col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" className="w-5 h-5">
                <defs>
                  <linearGradient id="footer-logo-accent" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#38bdf8" />
                    <stop offset="100%" stopColor="#10b981" />
                  </linearGradient>
                </defs>
                <rect width="32" height="32" rx="8" fill="#0f172a" />
                <circle cx="16" cy="16" r="10" stroke="#4f46e5" strokeWidth="1.5" strokeDasharray="4 2" fill="none" opacity="0.6" />
                <circle cx="16" cy="16" r="6.5" stroke="#38bdf8" strokeWidth="1.5" fill="none" opacity="0.8" />
                <circle cx="16" cy="16" r="3" fill="url(#footer-logo-accent)" />
                <path d="M16 3 L16 8 M16 24 L16 29 M3 16 L8 16 M24 16 L29 16" stroke="#38bdf8" strokeWidth="1.5" strokeLinecap="round" opacity="0.9" />
              </svg>
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
            <li>
              <Link href="/how-it-works" className="hover:text-indigo-400 transition">
                How It Works
              </Link>
            </li>
            <li>
              <Link href="/features/competitors" className="hover:text-indigo-400 transition">
                Competitor Discovery
              </Link>
            </li>
            <li>
              <Link href="/features/keywords" className="hover:text-indigo-400 transition">
                Keyword Opportunity Radar
              </Link>
            </li>
            <li>
              <Link href="/features/content-gaps" className="hover:text-indigo-400 transition">
                Content Gap Engine
              </Link>
            </li>
            <li>
              <Link href="/features/action-plans" className="hover:text-indigo-400 transition">
                Evidence-Backed Actions
              </Link>
            </li>
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
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} alt={getUserDisplayName(user)} className="w-4 h-4 rounded-full object-cover ring-1 ring-cyan-400/60" />
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
  );
}
