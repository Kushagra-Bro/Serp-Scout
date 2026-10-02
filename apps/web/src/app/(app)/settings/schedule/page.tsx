'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { apiClient } from '@/lib/api';
import { Zap, Check, CheckCircle2, AlertTriangle } from 'lucide-react';

interface ScheduleSettings {
  workspaceId: string;
  refreshCadence: 'daily' | 'weekly' | 'monthly' | 'manual';
  notificationEmail: string | null;
  staleDaysThreshold: number;
  lastScheduledRunAt: string | null;
  nextRunAt: string | null;
  cronPattern: string | null;
  primaryBusiness: {
    id: string;
    name: string;
    dataStale: boolean;
    lastAnalyzedAt: string | null;
  } | null;
}

interface JobItem {
  id: string;
  queue: string;
  name: string;
  state: string;
  failedReason?: string;
  timestamp: number;
  processedOn?: number;
  finishedOn?: number;
}

interface NotificationItem {
  id: string;
  reportId: string | null;
  businessId: string | null;
  type: string;
  channel: string;
  recipient: string;
  subject: string;
  status: string;
  externalId: string | null;
  sentAt: string;
}

export default function ScheduleSettingsPage() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [schedule, setSchedule] = useState<ScheduleSettings | null>(null);
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [notificationsList, setNotificationsList] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [triggerMsg, setTriggerMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [cadence, setCadence] = useState<'daily' | 'weekly' | 'monthly' | 'manual'>('weekly');
  const [email, setEmail] = useState('');
  const [staleDays, setStaleDays] = useState(7);

  const loadData = useCallback(async () => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setLoading(false);
      return;
    }

    try {
      const token = await getToken();
      if (!token) return;

      const [schedRes, jobsRes, notifsRes] = await Promise.all([
        apiClient<ScheduleSettings>('/api/workspaces/me/schedule', { token }),
        apiClient<JobItem[]>('/api/workspaces/me/schedule/jobs', { token }),
        apiClient<NotificationItem[]>('/api/workspaces/me/schedule/notifications', { token }),
      ]);

      setSchedule(schedRes);
      setCadence(schedRes.refreshCadence || 'weekly');
      setEmail(schedRes.notificationEmail || '');
      setStaleDays(schedRes.staleDaysThreshold || 7);
      setJobs(jobsRes || []);
      setNotificationsList(notifsRes || []);
    } catch (err: any) {
      console.error('Failed to load schedule data:', err);
      setError(err.message || 'Failed to load scheduling preferences');
    } finally {
      setLoading(false);
    }
  }, [isLoaded, isSignedIn, getToken]);

  useEffect(() => {
    if (isLoaded) {
      loadData();
    }
  }, [isLoaded, isSignedIn, loadData]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);
    setError(null);

    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');

      await apiClient('/api/workspaces/me/schedule', {
        token,
        method: 'PUT',
        body: JSON.stringify({
          refreshCadence: cadence,
          notificationEmail: email.trim() || undefined,
          staleDaysThreshold: Number(staleDays),
        }),
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to save schedule');
    } finally {
      setSaving(false);
    }
  };

  const handleTriggerNow = async () => {
    setTriggering(true);
    setTriggerMsg('Enqueueing immediate research & report cycle...');
    setError(null);

    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');

      const res = await apiClient<{ message: string; jobId: string }>('/api/workspaces/me/schedule/trigger', {
        token,
        method: 'POST',
      });

      setTriggerMsg(`Enqueued successfully (Job #${res.jobId}). Refreshing background jobs...`);
      setTimeout(() => {
        setTriggering(false);
        setTriggerMsg(null);
        loadData();
      }, 3000);
    } catch (err: any) {
      setTriggering(false);
      setTriggerMsg(null);
      setError(err.message || 'Failed to trigger refresh');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-3 text-slate-500 font-medium">
          <span className="h-5 w-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></span>
          Loading scheduling preferences...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <Link href="/settings" className="hover:text-indigo-600">Settings</Link>
            <span>/</span>
            <span className="text-slate-900">Automation & Schedules</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Scheduled Research & Alerts</h1>
          <p className="text-sm text-slate-500 mt-1">
            Configure automated SERP tracking, weekly intelligence briefings, and data freshness policies.
          </p>
        </div>

        <div>
          <button
            disabled={triggering}
            onClick={handleTriggerNow}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm transition disabled:opacity-50 flex items-center gap-2"
          >
            {triggering ? (
              <>
                <span className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                Dispatching Research...
              </>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 fill-white" />
                <span>Run Immediate Refresh Now</span>
              </span>
            )}
          </button>
        </div>
      </div>

      {triggerMsg && (
        <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200 text-sm text-indigo-800">
          {triggerMsg}
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700">
          {error}
        </div>
      )}

      {saveSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-800 font-medium flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Schedule and notification preferences updated successfully!</span>
        </div>
      )}

      {/* Primary Business Freshness Banner */}
      {schedule?.primaryBusiness && (
        <div className={`p-5 rounded-2xl border ${
          schedule.primaryBusiness.dataStale
            ? 'bg-amber-50 border-amber-200 text-amber-900'
            : 'bg-emerald-50 border-emerald-200 text-emerald-900'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xl">
                {schedule.primaryBusiness.dataStale ? (
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                )}
              </span>
              <div>
                <h3 className="text-sm font-bold">
                  {schedule.primaryBusiness.name} — Status: {schedule.primaryBusiness.dataStale ? 'Data is Stale' : 'Data is Fresh'}
                </h3>
                <p className="text-xs opacity-80 mt-0.5">
                  Last analyzed:{' '}
                  {schedule.primaryBusiness.lastAnalyzedAt
                    ? new Date(schedule.primaryBusiness.lastAnalyzedAt).toLocaleString()
                    : 'Never'}
                  {schedule.nextRunAt && ` • Next scheduled refresh: ${new Date(schedule.nextRunAt).toLocaleString()}`}
                </p>
              </div>
            </div>
            {schedule.primaryBusiness.dataStale && (
              <button
                onClick={handleTriggerNow}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition shadow-sm"
              >
                Refresh Now
              </button>
            )}
          </div>
        </div>
      )}

      {/* Configuration Form */}
      <form onSubmit={handleSave} className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
        <div>
          <h2 className="text-base font-bold text-slate-900">Refresh Frequency & Schedule</h2>
          <p className="text-xs text-slate-500 mt-1">
            Choose how frequently Serp-Scout automatically collects SERP data, updates competitor movements, and delivers reports.
          </p>
        </div>

        {/* Cadence Selection */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              id: 'weekly',
              label: 'Weekly Briefing',
              desc: 'Every Monday at 06:00 UTC (Recommended)',
              badge: 'Recommended',
            },
            {
              id: 'daily',
              label: 'Daily Refresh',
              desc: 'Every day at 06:00 UTC for fast-moving markets',
            },
            {
              id: 'monthly',
              label: 'Monthly Review',
              desc: '1st of each month at 06:00 UTC',
            },
            {
              id: 'manual',
              label: 'Manual Refresh Only',
              desc: 'Pause automation; update only on demand',
            },
          ].map((opt) => (
            <label
              key={opt.id}
              className={`relative flex flex-col p-4 rounded-xl border cursor-pointer transition ${
                cadence === opt.id
                  ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-600/20'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <input
                  type="radio"
                  name="cadence"
                  value={opt.id}
                  checked={cadence === opt.id}
                  onChange={() => setCadence(opt.id as any)}
                  className="h-4 w-4 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                />
                {opt.badge && (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-indigo-100 text-indigo-700">
                    {opt.badge}
                  </span>
                )}
              </div>
              <span className="text-sm font-semibold text-slate-900">{opt.label}</span>
              <span className="text-xs text-slate-500 mt-1">{opt.desc}</span>
            </label>
          ))}
        </div>

        <hr className="border-slate-100" />

        {/* Email & Freshness Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Notification Recipient Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. owner@austindentistry.com"
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              We send exactly <strong>one executive briefing</strong> per completed report with 3–5 prioritized actions.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Stale Data Warning Threshold (Days)
            </label>
            <input
              type="number"
              min={1}
              max={90}
              value={staleDays}
              onChange={(e) => setStaleDays(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              Flag business data as stale on your dashboard if unrefreshed for more than this number of days.
            </p>
          </div>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Scheduling Preferences'}
          </button>
        </div>
      </form>

      {/* Failed Jobs & Diagnostic Queue History */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Execution Diagnostics & Job History</h2>
            <p className="text-xs text-slate-500 mt-1">
              Live status across BullMQ worker queues. Failed jobs are clearly displayed with error root causes.
            </p>
          </div>
          <button
            onClick={loadData}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
          >
            ↻ Refresh Log
          </button>
        </div>

        {jobs.length === 0 ? (
          <div className="text-xs text-slate-400 py-6 text-center border border-dashed border-slate-200 rounded-xl">
            No recent background jobs found. Click &quot;Run Immediate Refresh&quot; to queue a research task.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Job ID</th>
                  <th className="py-2.5 px-3">Queue</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Triggered / Queued</th>
                  <th className="py-2.5 px-3">Failure Reason / Diagnostics</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {jobs.map((job) => {
                  const isFailed = job.state === 'failed';
                  const isCompleted = job.state === 'completed';

                  return (
                    <tr key={`${job.queue}-${job.id}`} className={isFailed ? 'bg-rose-50/50' : ''}>
                      <td className="py-3 px-3 font-semibold text-slate-800">#{job.id.slice(0, 12)}</td>
                      <td className="py-3 px-3 font-sans">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                          {job.queue}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-sans">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          isFailed
                            ? 'bg-rose-100 text-rose-800'
                            : isCompleted
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {job.state.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-500 font-sans">
                        {new Date(job.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="py-3 px-3 font-sans">
                        {isFailed ? (
                          <span className="text-rose-700 font-medium inline-flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                            <span>{job.failedReason || 'Unknown failure'}</span>
                          </span>
                        ) : isCompleted ? (
                          <span className="text-emerald-700">Completed successfully</span>
                        ) : (
                          <span className="text-slate-400">Processing in queue...</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Sent Notifications History */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">Delivered Notification History</h2>
          <p className="text-xs text-slate-500 mt-1">
            Transactional email log sent via Resend API.
          </p>
        </div>

        {notificationsList.length === 0 ? (
          <div className="text-xs text-slate-400 py-6 text-center border border-dashed border-slate-200 rounded-xl">
            No notifications sent yet. Briefings are delivered once weekly research completes.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Sent At</th>
                  <th className="py-2.5 px-3">Recipient</th>
                  <th className="py-2.5 px-3">Subject</th>
                  <th className="py-2.5 px-3">Delivery Status</th>
                  <th className="py-2.5 px-3">External ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {notificationsList.map((n) => (
                  <tr key={n.id}>
                    <td className="py-3 px-3 text-slate-500">
                      {new Date(n.sentAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-800">{n.recipient}</td>
                    <td className="py-3 px-3 text-slate-700">{n.subject}</td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        n.status === 'sent'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {n.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-slate-400">
                      {n.externalId || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <Link href="/settings" className="text-sm font-semibold text-indigo-600 hover:underline">
          ← Back to General Settings
        </Link>
      </div>
    </div>
  );
}
