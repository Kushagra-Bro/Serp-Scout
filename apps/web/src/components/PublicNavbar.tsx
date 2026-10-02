'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useUser, SignedIn, SignedOut } from '@/lib/auth';
import { UserButton } from '@/components/UserButton';
import { ArrowRight, Menu, X, Lock, User as UserIcon } from 'lucide-react';

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

export default function PublicNavbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user } = useUser();
  const displayName = getUserDisplayName(user);

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-white/85 border-b border-slate-200/80 shadow-xs transition-all duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo with Favicon SVG Mark */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-700/60 flex items-center justify-center shadow-sm group-hover:scale-105 group-hover:border-indigo-500 transition-all duration-300">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" className="w-5 h-5">
              <defs>
                <linearGradient id="nav-logo-accent" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#38bdf8" />
                  <stop offset="100%" stopColor="#10b981" />
                </linearGradient>
              </defs>
              <rect width="32" height="32" rx="8" fill="#0f172a" />
              <circle cx="16" cy="16" r="10" stroke="#4f46e5" strokeWidth="1.5" strokeDasharray="4 2" fill="none" opacity="0.6" />
              <circle cx="16" cy="16" r="6.5" stroke="#38bdf8" strokeWidth="1.5" fill="none" opacity="0.8" />
              <circle cx="16" cy="16" r="3" fill="url(#nav-logo-accent)" />
              <path d="M16 3 L16 8 M16 24 L16 29 M3 16 L8 16 M24 16 L29 16" stroke="#38bdf8" strokeWidth="1.5" strokeLinecap="round" opacity="0.9" />
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

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 bg-slate-100/80 p-1 rounded-full border border-slate-200/60 shadow-inner">
          {[
            { label: 'How It Works', href: '/how-it-works' },
            { label: 'Competitors', href: '/features/competitors' },
            { label: 'Keywords', href: '/features/keywords' },
            { label: 'Content Gaps', href: '/features/content-gaps' },
            { label: 'Action Plans', href: '/features/action-plans' },
          ].map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="px-3.5 py-1.5 rounded-full text-xs font-semibold text-slate-600 hover:text-indigo-600 hover:bg-white hover:shadow-xs transition-all duration-200"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Right CTA Area */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <SignedIn>
            <div className="flex items-center gap-2">
              <Link
                href="/app"
                className="relative group overflow-hidden px-4 sm:px-5 py-2 rounded-xl font-semibold text-xs sm:text-sm text-white bg-gradient-to-r from-indigo-600 via-indigo-700 to-cyan-600 shadow-md shadow-indigo-500/20 hover:shadow-lg hover:shadow-indigo-500/30 hover:scale-[1.02] active:scale-[0.99] transition-all duration-200 cursor-pointer flex items-center gap-2"
              >
                {user?.imageUrl ? (
                  <img src={user.imageUrl} alt={displayName} className="w-4 h-4 rounded-full object-cover ring-1 ring-white/50" />
                ) : (
                  <UserIcon className="w-4 h-4 text-cyan-200" />
                )}
                <span className="max-w-[130px] truncate">{displayName}</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <div className="hidden sm:block pl-1">
                <UserButton afterSignOutUrl="/" />
              </div>
            </div>
          </SignedIn>
          <SignedOut>
            <Link
              href="/sign-in"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
            >
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              <span>Sign In</span>
            </Link>

            <Link
              href="/sign-up"
              className="relative group overflow-hidden px-4 sm:px-5 py-2 rounded-xl font-semibold text-xs sm:text-sm text-white bg-gradient-to-r from-indigo-600 via-indigo-700 to-cyan-600 shadow-md shadow-indigo-500/20 hover:shadow-lg hover:shadow-indigo-500/30 hover:scale-[1.02] active:scale-[0.99] transition-all duration-200 cursor-pointer flex items-center gap-1.5"
            >
              <span>Start Free Scout</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </SignedOut>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white/95 backdrop-blur-md px-4 pt-3 pb-5 space-y-2 animate-fade-in shadow-lg">
          {[
            { label: 'How It Works', href: '/how-it-works' },
            { label: 'Competitor Discovery', href: '/features/competitors' },
            { label: 'Keyword Opportunity Radar', href: '/features/keywords' },
            { label: 'Content Gap Engine', href: '/features/content-gaps' },
            { label: 'Evidence-Backed Actions', href: '/features/action-plans' },
          ].map((item) => (
            <Link
              key={item.label}
              href={item.href}
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition"
            >
              {item.label}
            </Link>
          ))}
          <SignedIn>
            <Link
              href="/app"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition"
            >
              Go to Dashboard ({displayName})
            </Link>
          </SignedIn>
          <SignedOut>
            <Link
              href="/sign-in"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Sign In
            </Link>
            <Link
              href="/sign-up"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition"
            >
              Start Free Scout
            </Link>
          </SignedOut>
        </div>
      )}
    </header>
  );
}
