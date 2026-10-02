'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserButton } from '@/components/UserButton';
import {
  LayoutDashboard,
  Users,
  Search,
  FileText,
  MapPin,
  BarChart3,
  Settings,
  Menu,
  X,
  ExternalLink,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { label: 'Overview', href: '/app', icon: LayoutDashboard },
  { label: 'Competitors', href: '/competitors', icon: Users },
  { label: 'Keywords', href: '/keywords', icon: Search },
  { label: 'Content Gaps', href: '/content', icon: FileText },
  { label: 'Local SEO', href: '/local', icon: MapPin },
  { label: 'Reports', href: '/reports', icon: BarChart3 },
  { label: 'Settings', href: '/settings', icon: Settings },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === '/app') {
      return pathname === '/app';
    }
    return pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 selection:bg-indigo-500 selection:text-white">
      {/* ── 1. THEMED GLASSMORPHIC HEADER ── */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-white/85 border-b border-slate-200/80 shadow-xs transition-all duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6 lg:gap-8">
            {/* Brand Logo - Matched exactly to Landing Page */}
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
                <span className="hidden sm:block text-[10px] text-slate-400 font-semibold tracking-wider uppercase mt-0.5">
                  Autonomous SEO
                </span>
              </div>
            </Link>

            {/* Desktop Navigation Links with Smooth Active Pill Highlights */}
            <nav className="hidden lg:flex items-center gap-1">
              {navItems.map((item) => {
                const active = isActive(item.href);
                const IconComponent = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`relative px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all duration-200 ${
                      active
                        ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/70 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/90'
                    }`}
                  >
                    <IconComponent className={`w-3.5 h-3.5 ${active ? 'text-indigo-600' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                    {active && (
                      <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-gradient-to-r from-indigo-600 to-cyan-600 rounded-full" />
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-3">
            {/* Quick Home Link */}
            <Link
              href="/"
              title="Return to Home"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition"
            >
              <span>Home</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </Link>

            {/* Clerk User Profile */}
            <div className="pl-1 border-l border-slate-200">
              <UserButton afterSignOutUrl="/" />
            </div>

            {/* Mobile Menu Toggle Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-200 bg-white/95 backdrop-blur-md px-4 pt-3 pb-5 space-y-1 animate-fade-in shadow-lg">
            {navItems.map((item) => {
              const active = isActive(item.href);
              const IconComponent = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition ${
                    active
                      ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/80 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <IconComponent className={`w-4 h-4 ${active ? 'text-indigo-600' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-end px-3">
              <Link href="/" className="text-xs font-semibold text-indigo-600 hover:underline flex items-center gap-1">
                <span>Return to Home</span>
                <ExternalLink className="w-3 h-3 text-indigo-500" />
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ── 2. MAIN CONTENT AREA WITH ANIMATIONS ── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
        {children}
      </main>
    </div>
  );
}
