'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth, useUser } from '@/lib/auth';
import { apiClient } from '@/lib/api';
import {
  Search,
  Globe,
  Loader2,
  Zap,
  CheckCircle2,
  Sparkles,
  AlertTriangle,
  Trash2,
  User,
  Camera,
  Edit3,
  Lock,
  Check,
  AlertCircle,
  X,
} from 'lucide-react';

interface ProviderQuotaDetail {
  provider: 'serpapi' | 'tavily';
  name: string;
  monthlyLimit: number;
  used: number;
  remaining: number;
  percentage: number;
  description: string;
}

interface WorkspaceData {
  id: string;
  name: string;
  monthlyQuota: number;
  usedQuota: number;
  timezone: string;
  providerQuotas?: {
    serpapi: ProviderQuotaDetail;
    tavily: ProviderQuotaDetail;
  };
}

export default function SettingsPage() {
  const { isLoaded, isSignedIn, getToken, signOut } = useAuth();
  const { user, updateUser } = useUser();
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmationInput, setDeleteConfirmationInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Profile Customization State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');
  const [changePassword, setChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState<string | null>(null);
  const [profileErrorMsg, setProfileErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setLoading(false);
      return;
    }

    async function loadWorkspace() {
      try {
        const token = await getToken();
        if (!token) return;
        const res = await apiClient<{ activeWorkspace: WorkspaceData | null }>('/api/workspaces/me', { token });
        setWorkspace(res.activeWorkspace);
      } catch (err) {
        console.error('Failed to load workspace:', err);
      } finally {
        setLoading(false);
      }
    }
    loadWorkspace();
  }, [isLoaded, isSignedIn, getToken]);

  // Provider metrics with safe fallbacks
  const serpapiLimit = workspace?.providerQuotas?.serpapi?.monthlyLimit ?? (workspace?.monthlyQuota || 500);
  const serpapiUsed = workspace?.providerQuotas?.serpapi?.used ?? (workspace?.usedQuota || 0);
  const serpapiRemaining = workspace?.providerQuotas?.serpapi?.remaining ?? Math.max(0, serpapiLimit - serpapiUsed);
  const serpapiPercent = Math.min(100, Math.round((serpapiUsed / serpapiLimit) * 100));

  const tavilyLimit = workspace?.providerQuotas?.tavily?.monthlyLimit ?? ((workspace?.monthlyQuota || 500) * 2);
  const tavilyUsed = workspace?.providerQuotas?.tavily?.used ?? 0;
  const tavilyRemaining = workspace?.providerQuotas?.tavily?.remaining ?? Math.max(0, tavilyLimit - tavilyUsed);
  const tavilyPercent = Math.min(100, Math.round((tavilyUsed / tavilyLimit) * 100));

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="pb-4 border-b border-slate-200">
        <h1 className="text-2xl font-bold text-slate-900">Workspace & Account Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Manage your team, research schedule, and usage limits.</p>
      </div>

      {/* Quota & Usage Card: SerpApi & Tavily Side-by-Side in the same box */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">Monthly Provider Quotas & Search Limits</h2>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                Hybrid Search Architecture
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Dedicated monthly quotas for high-fidelity Google searches and fast AI web sweeps.
            </p>
          </div>
          <div className="text-left sm:text-right shrink-0">
            <span className="text-xs font-semibold text-slate-700 block">Workspace: {workspace?.name || 'Active Workspace'}</span>
            <span className="text-[11px] text-slate-400">Resets on 1st of each month</span>
          </div>
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
            <span>Loading provider quotas...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Left Column: SerpApi Google Engine */}
            <div className="border border-indigo-100 bg-indigo-50/20 rounded-2xl p-5 space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                    <Search className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">SerpApi (Google Engine)</h3>
                    <p className="text-[11px] text-slate-500">Google Maps 3-Pack, Organic, & Reviews</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Active Provider
                </span>
              </div>

              {/* Progress and Numbers */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-baseline justify-between text-xs">
                  <span className="font-extrabold text-slate-900 text-sm">
                    {serpapiUsed} <span className="text-slate-400 text-xs font-normal">/ {serpapiLimit} searches</span>
                  </span>
                  <span className="text-indigo-600 font-bold">
                    {serpapiRemaining} remaining ({serpapiPercent}%)
                  </span>
                </div>
                <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden p-0.5">
                  <div
                    className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                    style={{ width: `${serpapiPercent}%` }}
                  />
                </div>
              </div>

              {/* Capabilities checklist */}
              <div className="pt-2 border-t border-indigo-100/60 space-y-1.5 text-[11px] text-slate-600">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span>Google Maps 3-Pack Rank Audits (Indirapuram & local zones)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span>Google Organic Search & People Also Ask (PAA)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span>Live Place Reviews & Customer Feedback ingestion</span>
                </div>
              </div>
            </div>

            {/* Right Column: Tavily AI Search Engine */}
            <div className="border border-teal-100 bg-teal-50/20 rounded-2xl p-5 space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-xs">
                    <Globe className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Tavily (AI Sweep Engine)</h3>
                    <p className="text-[11px] text-slate-500">Fast Web Sweeps, Messaging, & News</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
                  High-Speed Sweep
                </span>
              </div>

              {/* Progress and Numbers */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-baseline justify-between text-xs">
                  <span className="font-extrabold text-slate-900 text-sm">
                    {tavilyUsed} <span className="text-slate-400 text-xs font-normal">/ {tavilyLimit} sweeps</span>
                  </span>
                  <span className="text-teal-600 font-bold">
                    {tavilyRemaining} remaining ({tavilyPercent}%)
                  </span>
                </div>
                <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden p-0.5">
                  <div
                    className="h-full bg-teal-600 rounded-full transition-all duration-500"
                    style={{ width: `${tavilyPercent}%` }}
                  />
                </div>
              </div>

              {/* Capabilities checklist */}
              <div className="pt-2 border-t border-teal-100/60 space-y-1.5 text-[11px] text-slate-600">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                  <span>Token-conserving parallel web sweeps (0 SerpApi cost)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                  <span>Competitor Messaging & value proposition extraction</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                  <span>Real-time local industry news & press release discovery</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Informational Footer inside the box */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-700">
            <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>
              <strong>Intelligent Hybrid Routing:</strong> Serp-Scout automatically leverages Tavily for broad web sweeps, conserving your SerpApi Google credits for high-value Maps 3-Pack and deep rank audits.
            </span>
          </div>
          <span className="text-[11px] text-slate-400 shrink-0">
            Fair Use Policy Active
          </span>
        </div>
      </div>

      {/* Automation & Schedule Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">Automation, Schedule & Alerts</h2>
          <p className="text-xs text-slate-500 mt-1">
            Configure refresh frequency (daily, weekly, monthly), notification email recipients, and monitor BullMQ job diagnostics.
          </p>
        </div>
        <div>
          <Link
            href="/settings/schedule"
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition shadow-sm inline-block whitespace-nowrap"
          >
            Manage Schedule →
          </Link>
        </div>
      </div>

      {/* User Profile & Account */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Profile & Account</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Customize your profile name, avatar representation, and account security.
            </p>
          </div>
          {profileSuccessMsg && (
            <div className="px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-medium flex items-center gap-1.5 animate-in fade-in">
              <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>{profileSuccessMsg}</span>
            </div>
          )}
        </div>

        {!isEditingProfile ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 p-4 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="flex items-center gap-4">
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user?.name || 'User'}
                  className="w-14 h-14 rounded-2xl object-cover shadow-md ring-2 ring-indigo-500/20"
                />
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white font-bold text-xl shadow-md uppercase">
                  {user?.name?.[0] || user?.email?.[0] || 'U'}
                </div>
              )}
              <div>
                <h3 className="text-base font-bold text-slate-900">{user?.name || 'User'}</h3>
                <p className="text-xs text-slate-500 font-medium">{user?.email || 'Authenticated User'}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-white text-slate-600 border border-slate-200">
                    ID: {user?.id || 'usr_unknown'}
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200 uppercase text-[10px]">
                    {user?.role || 'owner'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={() => {
                  setEditName(user?.name || '');
                  setEditAvatarUrl(user?.avatarUrl || '');
                  setChangePassword(false);
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                  setProfileErrorMsg(null);
                  setIsEditingProfile(true);
                }}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition shadow-xs flex items-center gap-1.5"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Customize Profile</span>
              </button>
              <button
                onClick={() => signOut()}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 transition shadow-xs"
              >
                Sign Out
              </button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setProfileErrorMsg(null);
              setProfileSuccessMsg(null);

              if (!editName.trim()) {
                setProfileErrorMsg('Full name cannot be empty.');
                return;
              }

              if (changePassword) {
                if (!currentPassword) {
                  setProfileErrorMsg('Current password is required to change your password.');
                  return;
                }
                if (newPassword.length < 6) {
                  setProfileErrorMsg('New password must be at least 6 characters.');
                  return;
                }
                if (newPassword !== confirmPassword) {
                  setProfileErrorMsg('New password and confirmation do not match.');
                  return;
                }
              }

              setSavingProfile(true);

              try {
                const token = await getToken();
                if (!token) throw new Error('Authentication expired. Please sign in again.');

                const bodyPayload: Record<string, any> = {
                  name: editName.trim(),
                  avatarUrl: editAvatarUrl.trim() || null,
                };

                if (changePassword) {
                  bodyPayload.currentPassword = currentPassword;
                  bodyPayload.newPassword = newPassword;
                }

                const res = await apiClient<{ user: { id: string; name: string; email: string; role: string; avatarUrl?: string | null } }>(
                  '/api/auth/profile',
                  {
                    token,
                    method: 'PATCH',
                    body: JSON.stringify(bodyPayload),
                  }
                );

                updateUser(res.user);
                setProfileSuccessMsg('Profile customized successfully!');
                setTimeout(() => setProfileSuccessMsg(null), 4000);
                setIsEditingProfile(false);
              } catch (err: any) {
                setProfileErrorMsg(err.message || 'Failed to update profile. Please try again.');
              } finally {
                setSavingProfile(false);
              }
            }}
            className="p-5 sm:p-6 rounded-xl bg-slate-50 border border-slate-200/90 space-y-6"
          >
            {profileErrorMsg && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{profileErrorMsg}</span>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Display Name
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="e.g. Dr. Sarah Jenkins"
                  className="w-full max-w-md px-3.5 py-2 text-sm rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Avatar Image
                </label>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <div className="relative shrink-0">
                    {editAvatarUrl ? (
                      <img
                        src={editAvatarUrl}
                        alt="Preview"
                        className="w-16 h-16 rounded-2xl object-cover ring-2 ring-indigo-500/30 shadow-md bg-white"
                        onError={() => setEditAvatarUrl('')}
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white font-bold text-2xl shadow-md uppercase">
                        {editName?.[0] || user?.name?.[0] || 'U'}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 w-full space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="url"
                        value={editAvatarUrl}
                        onChange={(e) => setEditAvatarUrl(e.target.value)}
                        placeholder="Paste image URL (e.g. https://...)"
                        className="flex-1 max-w-md px-3.5 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      {editAvatarUrl && (
                        <button
                          type="button"
                          onClick={() => setEditAvatarUrl('')}
                          className="px-2.5 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition"
                        >
                          Clear
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap pt-1">
                      <span className="text-[11px] font-semibold text-slate-400">Presets:</span>
                      {[
                        { name: 'Alex', url: 'https://api.dicebear.com/7.x/personas/svg?seed=Alex' },
                        { name: 'Sarah', url: 'https://api.dicebear.com/7.x/personas/svg?seed=Sarah' },
                        { name: 'Michael', url: 'https://api.dicebear.com/7.x/personas/svg?seed=Michael' },
                        { name: 'Elena', url: 'https://api.dicebear.com/7.x/personas/svg?seed=Elena' },
                        { name: 'Bot', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Scout' },
                      ].map((preset) => (
                        <button
                          key={preset.name}
                          type="button"
                          onClick={() => setEditAvatarUrl(preset.url)}
                          className={`w-7 h-7 rounded-full overflow-hidden border transition ${
                            editAvatarUrl === preset.url
                              ? 'ring-2 ring-indigo-600 border-transparent scale-110'
                              : 'border-slate-200 hover:border-slate-400 opacity-80 hover:opacity-100'
                          }`}
                          title={`Choose ${preset.name}`}
                        >
                          <img src={preset.url} alt={preset.name} className="w-full h-full object-cover bg-white" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200/80">
                <label className="inline-flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={changePassword}
                    onChange={(e) => setChangePassword(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                  />
                  <span>Change Password</span>
                </label>

                {changePassword && (
                  <div className="mt-3 p-4 rounded-xl bg-white border border-slate-200/80 space-y-3 max-w-md animate-in fade-in duration-150">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Current Password
                      </label>
                      <input
                        type="password"
                        required={changePassword}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        New Password (min 6 characters)
                      </label>
                      <input
                        type="password"
                        required={changePassword}
                        minLength={6}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Confirm New Password
                      </label>
                      <input
                        type="password"
                        required={changePassword}
                        minLength={6}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="submit"
                disabled={savingProfile}
                className="px-5 py-2 text-xs font-bold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition shadow-sm disabled:opacity-50 flex items-center gap-1.5"
              >
                {savingProfile ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
              <button
                type="button"
                disabled={savingProfile}
                onClick={() => {
                  setIsEditingProfile(false);
                  setProfileErrorMsg(null);
                }}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 transition shadow-xs"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Danger Zone: Workspace & Data Deletion */}
      <div className="bg-white border border-rose-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
              <h2 className="text-base font-bold text-rose-900">Danger Zone: Delete Workspace</h2>
            </div>
            <p className="text-xs text-rose-600 mt-1 max-w-2xl leading-relaxed">
              Permanently delete <strong>{workspace?.name || 'this workspace'}</strong>, including all associated business profiles, competitors, tracked keywords, historical SERP ranking observations, and executive reports. Your user account credentials will remain valid so you can set up or join another workspace.
            </p>
          </div>

          {!showDeleteModal && (
            <button
              onClick={() => {
                setShowDeleteModal(true);
                setDeleteError(null);
                setDeleteConfirmationInput('');
              }}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-rose-600 text-white hover:bg-rose-700 transition shadow-sm shrink-0 flex items-center gap-1.5 self-start"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Workspace</span>
            </button>
          )}
        </div>

        {/* Confirmation Form */}
        {showDeleteModal && (
          <div className="p-4 sm:p-5 rounded-xl bg-rose-50/60 border border-rose-200 space-y-3.5 mt-2">
            <div className="space-y-1">
              <span className="text-xs font-bold text-rose-900 block">
                Confirm Permanent Workspace Deletion
              </span>
              <p className="text-xs text-rose-700">
                To confirm, type <strong className="font-mono bg-rose-100 px-1.5 py-0.5 rounded text-rose-900 select-all">{workspace?.name}</strong> below:
              </p>
            </div>

            {deleteError && (
              <div className="p-2.5 rounded-lg bg-rose-100/80 border border-rose-300 text-xs text-rose-800 font-medium">
                {deleteError}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <input
                type="text"
                value={deleteConfirmationInput}
                onChange={(e) => {
                  setDeleteConfirmationInput(e.target.value);
                  setDeleteError(null);
                }}
                disabled={isDeleting}
                placeholder={`Type "${workspace?.name}"`}
                className="flex-1 px-3.5 py-2 text-xs rounded-lg border border-rose-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500 font-mono"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isDeleting || deleteConfirmationInput.trim() !== workspace?.name.trim()}
                  onClick={async () => {
                    if (!workspace) return;
                    if (deleteConfirmationInput.trim() !== workspace.name.trim()) {
                      setDeleteError(`Please type "${workspace.name}" exactly to confirm deletion.`);
                      return;
                    }

                    setIsDeleting(true);
                    setDeleteError(null);

                    try {
                      const token = await getToken();
                      if (!token) throw new Error('Authentication expired. Please sign in again.');

                      await apiClient(`/api/workspaces/${workspace.id}`, {
                        token,
                        method: 'DELETE',
                      });

                      // Clear all local cached workspace and business data to prevent redirect loops
                      if (typeof window !== 'undefined') {
                        localStorage.removeItem('serp_scout_workspace_id');
                        localStorage.removeItem('serp_scout_cached_businesses');
                        localStorage.removeItem('serp_scout_active_biz_id');
                      }

                      // Redirect to onboarding with new=true to guarantee fresh initialization
                      window.location.href = '/onboarding?new=true';
                    } catch (err: any) {
                      setDeleteError(err.message || 'Failed to delete workspace. Please try again.');
                      setIsDeleting(false);
                    }
                  }}
                  className="px-4 py-2 text-xs font-bold rounded-lg bg-rose-600 text-white hover:bg-rose-700 transition shadow-sm disabled:opacity-50 flex items-center justify-center gap-1.5 min-w-[140px]"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Confirm Delete</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeleteConfirmationInput('');
                    setDeleteError(null);
                  }}
                  className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 transition shadow-xs"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div>
        <Link href="/app" className="text-sm font-semibold text-indigo-600 hover:underline">
          ← Back to Overview
        </Link>
      </div>
    </div>
  );
}
