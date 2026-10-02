'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useAuth, useUser } from '@/lib/auth';
import { User, LogOut, Settings, LayoutDashboard } from 'lucide-react';

export function UserButton({ afterSignOutUrl = '/' }: { afterSignOutUrl?: string }) {
  const { user } = useUser();
  const { signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) return null;

  const initials = user.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'U';

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-cyan-500 text-white font-bold text-xs flex items-center justify-center shadow-xs hover:ring-2 hover:ring-indigo-400 focus:outline-none transition"
        aria-label="User menu"
      >
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt={user.name} className="w-full h-full rounded-full object-cover" />
        ) : (
          <span>{initials}</span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="px-4 py-2 border-b border-slate-100">
            <p className="text-xs font-bold text-slate-900 truncate">{user.name}</p>
            <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
          </div>

          <Link
            href="/app"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-indigo-600 transition"
          >
            <LayoutDashboard className="w-3.5 h-3.5 text-slate-400" />
            <span>Dashboard</span>
          </Link>

          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-indigo-600 transition"
          >
            <Settings className="w-3.5 h-3.5 text-slate-400" />
            <span>Settings</span>
          </Link>

          <div className="border-t border-slate-100 my-1" />

          <button
            onClick={() => {
              setOpen(false);
              signOut();
            }}
            className="w-full text-left flex items-center gap-2 px-4 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default UserButton;
