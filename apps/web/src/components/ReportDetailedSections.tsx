'use client';

import React, { useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Target,
  Layers,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react';
import type { DetailedReportSections, RankTrendPoint, RankingShiftRow } from '@serp-scout/types';

/**
 * The detailed report blocks shared by the workspace report view and the
 * client-facing shared report: KPI dashboard, the "Search Visibility & Ranking
 * Shifts" table, and the competitor landscape.
 *
 * `detailed` is optional: reports generated before the detailed pipeline carry
 * only the legacy `visibilityChanges.keywordChanges` array, so every block has a
 * fallback and never renders an empty table.
 */

interface Props {
  detailed?: DetailedReportSections | null;
  /** Legacy shape, used when the detailed sections are unavailable. */
  legacyKeywordChanges?: Array<{ keyword: string; oldRank?: number; newRank?: number }>;
  /** Hide the competitor table in client-facing executive mode. */
  showCompetitors?: boolean;
  compact?: boolean;
}

function rankBadge(rank: number | null) {
  if (rank === null) {
    return <span className="text-[11px] italic text-slate-400">not ranking</span>;
  }
  const cls =
    rank <= 3
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : rank <= 10
      ? 'bg-blue-50 text-blue-700 border-blue-200'
      : 'bg-rose-50 text-rose-700 border-rose-200';
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full border text-[11px] font-bold ${cls}`}>#{rank}</span>
  );
}

function shiftBadge(row: RankingShiftRow) {
  if (row.status === 'not-ranking') {
    return <span className="text-[11px] italic text-slate-400">no check yet</span>;
  }
  if (row.status === 'dropped-out') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700">
        <TrendingDown className="w-3 h-3" /> dropped out
      </span>
    );
  }
  if (row.status === 'new') {
    return <span className="text-[11px] font-bold text-indigo-600">first reading</span>;
  }
  if (row.shift === null || row.shift === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500">
        <Minus className="w-3 h-3" /> no change
      </span>
    );
  }
  return row.shift > 0 ? (
    <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-bold text-emerald-700">
      <TrendingUp className="w-3 h-3" /> +{row.shift}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded bg-rose-50 px-1.5 py-0.5 text-[11px] font-bold text-rose-700">
      <TrendingDown className="w-3 h-3" /> {row.shift}
    </span>
  );
}

function KpiCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</div>
      <div className={`mt-1 text-xl font-black ${accent ?? 'text-slate-900'}`}>{value}</div>
      {sub && <div className="text-[10px] font-medium text-slate-400">{sub}</div>}
    </div>
  );
}

/**
 * Rank-trend sparkline, matching the PDF rendering.
 *
 * One point per sweep, oldest on the left, lower rank numbers higher up. A solid
 * segment joins two sweeps that both produced a position; a dashed segment
 * crosses a sweep where the business was absent (interpolated, not measured) and
 * those sweeps get a hollow amber marker on the baseline. Leading absent sweeps
 * are trimmed to one, since a phrase swept six times before it ever ranked would
 * otherwise plot as empty space. All rows share `scaleMax` for comparability.
 */
function Sparkline({
  trend: input,
  scaleMax,
  direction,
}: {
  trend: RankTrendPoint[];
  scaleMax: number;
  direction: 'up' | 'down' | 'flat';
}) {
  const width = 132;
  const height = 30;
  const padX = 4;
  const padY = 4;

  const trend = (input ?? []).slice();
  while (trend.length > 1 && trend[0].rank === null && trend[1].rank === null) trend.shift();

  const rankedCount = trend.filter((p) => p.rank !== null).length;
  const absentCount = trend.length - rankedCount;

  if (rankedCount === 0) {
    return (
      <span className="text-[10px] italic text-slate-300">
        no position in {trend.length} check{trend.length === 1 ? '' : 's'}
      </span>
    );
  }

  const color = direction === 'up' ? '#059669' : direction === 'down' ? '#e11d48' : '#64748b';
  const usableW = width - padX * 2;
  const usableH = height - padY * 2;
  const xFor = (i: number) => (trend.length === 1 ? width / 2 : padX + (i / (trend.length - 1)) * usableW);
  const yFor = (rank: number | null) =>
    padY + ((Math.min(rank ?? scaleMax, scaleMax) - 1) / Math.max(scaleMax - 1, 1)) * usableH;
  const pointAt = (i: number) => ({ x: xFor(i), y: yFor(trend[i].rank) });

  const pathOf = (points: Array<{ x: number; y: number }>) =>
    points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  const solid: Array<{ d: string; area: string }> = [];
  const dashed: string[] = [];
  let run: Array<{ x: number; y: number }> = [];
  let lastKnown: { x: number; y: number } | null = null;

  trend.forEach((point, index) => {
    if (point.rank === null) {
      if (run.length > 1) {
        solid.push({
          d: pathOf(run),
          area: `${pathOf(run)} L${run[run.length - 1].x.toFixed(1)},${height} L${run[0].x.toFixed(1)},${height} Z`,
        });
      }
      run = [];
      return;
    }
    const p = pointAt(index);
    if (run.length === 0 && lastKnown) dashed.push(pathOf([lastKnown, p]));
    run.push(p);
    lastKnown = p;
  });
  if (run.length > 1) {
    solid.push({
      d: pathOf(run),
      area: `${pathOf(run)} L${run[run.length - 1].x.toFixed(1)},${height} L${run[0].x.toFixed(1)},${height} Z`,
    });
  }

  const top3Y = yFor(3);
  const firstRank = trend.find((p) => p.rank !== null)?.rank ?? null;
  const lastRank = [...trend].reverse().find((p) => p.rank !== null)?.rank ?? null;

  return (
    <div className="inline-block">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block">
        {top3Y > padY + 1 && <rect x={0} y={0} width={width} height={top3Y} fill="#10b981" opacity={0.08} />}
        {solid.map((segment, idx) => (
          <path key={`area-${idx}`} d={segment.area} fill={color} opacity={0.1} />
        ))}
        {solid.map((segment, idx) => (
          <path
            key={`line-${idx}`}
            d={segment.d}
            fill="none"
            stroke={color}
            strokeWidth={1.6}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
        {dashed.map((d, idx) => (
          <path
            key={`gap-${idx}`}
            d={d}
            fill="none"
            stroke={color}
            strokeWidth={1.2}
            strokeDasharray="2,2"
            opacity={0.65}
          />
        ))}
        {trend.map((point, i) => {
          const x = xFor(i);
          if (point.rank === null) {
            return (
              <circle key={`pt-${i}`} cx={x} cy={height - padY + 1} r={2} fill="#fff" stroke="#f59e0b" strokeWidth={1.2} />
            );
          }
          const y = yFor(point.rank);
          const isLast = i === trend.length - 1;
          return (
            <circle
              key={`pt-${i}`}
              cx={x}
              cy={y}
              r={isLast ? 2.6 : 1.8}
              fill={isLast ? color : '#fff'}
              stroke={color}
              strokeWidth={1.3}
            />
          );
        })}
      </svg>
      <div className="mt-px whitespace-nowrap text-[9px] font-semibold text-slate-400">
        {`${trend.length} checks · ${firstRank === null ? '—' : `#${firstRank}`} → ${
          lastRank === null ? '—' : `#${lastRank}`
        }`}
        {absentCount > 0 ? ` · ${absentCount} absent` : ''}
      </div>
    </div>
  );
}

/** Shared vertical scale: rank 1 down to the page-2 cutoff (or the worst rank seen). */
function sparklineScaleMax(rows: RankingShiftRow[]): number {
  const worst = rows.reduce((max, row) => {
    const ranks = (row.trend ?? []).map((p) => p.rank ?? 0);
    return ranks.length ? Math.max(max, ...ranks) : max;
  }, 0);
  return Math.max(10, Math.min(worst, 20));
}

function directionOf(row: RankingShiftRow): 'up' | 'down' | 'flat' {
  if (row.shift !== null && row.shift > 0) return 'up';
  if (row.shift !== null && row.shift < 0) return 'down';
  return 'flat';
}

function ShiftTable({ rows, emptyMessage }: { rows: RankingShiftRow[]; emptyMessage: string }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-xs text-slate-500">
        {emptyMessage}
      </div>
    );
  }
  const scaleMax = sparklineScaleMax(rows);
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <th className="px-4 py-2.5 font-semibold">Keyword Phrase</th>
            <th className="px-3 py-2.5 text-center font-semibold">Previous Rank</th>
            <th className="px-3 py-2.5 text-center font-semibold">Current Rank</th>
            <th className="px-3 py-2.5 text-center font-semibold">Position Shift</th>
            <th className="px-3 py-2.5 text-center font-semibold">
              Rank trend <span className="font-normal normal-case text-slate-400">(1 → {scaleMax})</span>
            </th>
            <th className="px-3 py-2.5 text-center font-semibold">Best Rival</th>
            <th className="px-3 py-2.5 font-semibold">Observed</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={`${row.keyword}-${row.status}`} className="hover:bg-slate-50/70">
              <td className="px-4 py-2.5">
                <div className="font-semibold text-slate-900">{row.keyword}</div>
                <div className="text-[10px] text-slate-400">
                  {row.intent || 'commercial'}
                  {row.location ? ` · ${row.location}` : ''}
                </div>
              </td>
              <td className="px-3 py-2.5 text-center font-mono text-slate-500">
                {row.previousRank !== null ? `#${row.previousRank}` : '—'}
              </td>
              <td className="px-3 py-2.5 text-center">{rankBadge(row.currentRank)}</td>
              <td className="px-3 py-2.5 text-center">{shiftBadge(row)}</td>
              <td className="px-3 py-2.5 text-center">
                <Sparkline trend={row.trend ?? []} scaleMax={scaleMax} direction={directionOf(row)} />
              </td>
              <td className="px-3 py-2.5 text-center">
                {row.bestCompetitorRank !== null ? (
                  <div>
                    <span className="font-semibold text-slate-700">#{row.bestCompetitorRank}</span>
                    {row.bestCompetitorDomain && (
                      <div className="mx-auto max-w-[130px] truncate text-[10px] text-slate-400">
                        {row.bestCompetitorDomain}
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="text-slate-300">—</span>
                )}
              </td>
              <td className="px-3 py-2.5 text-[10px] text-slate-400">
                {row.lastObservedAt ? row.lastObservedAt.slice(0, 10) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function legacyToRows(legacy: Props['legacyKeywordChanges']): RankingShiftRow[] {
  return (legacy ?? []).map((k) => ({
    keyword: k.keyword,
    location: null,
    intent: null,
    previousRank: k.oldRank ?? null,
    currentRank: k.newRank ?? null,
    shift: k.oldRank && k.newRank ? k.oldRank - k.newRank : null,
    status:
      k.oldRank && k.newRank
        ? k.oldRank === k.newRank
          ? 'unchanged'
          : k.oldRank > k.newRank
          ? 'climbed'
          : 'declined'
        : 'not-ranking',
    bestCompetitorRank: null,
    bestCompetitorDomain: null,
    opportunityScore: null,
    lastObservedAt: null,
    url: null,
    trend: [],
  }));
}

export default function ReportDetailedSections({
  detailed,
  legacyKeywordChanges,
  showCompetitors = true,
  compact = false,
}: Props) {
  const [showSteady, setShowSteady] = useState(false);
  const [showNotRanking, setShowNotRanking] = useState(false);

  const shifts = detailed?.rankingShifts;
  const rows = shifts
    ? [...shifts.movers, ...shifts.newEntries, ...shifts.droppedOut]
    : legacyToRows(legacyKeywordChanges);

  const kpis = detailed?.kpis;

  return (
    <div className="space-y-6">
      {/* ── KPI dashboard ─────────────────────────────────────────────── */}
      {kpis && (
        <div className={`grid grid-cols-2 gap-3 ${compact ? 'md:grid-cols-4' : 'md:grid-cols-4 lg:grid-cols-6'}`}>
          <KpiCard label="Tracked keywords" value={String(kpis.trackedKeywords)} sub="monitored phrases" accent="text-indigo-600" />
          <KpiCard label="Ranked" value={String(kpis.rankedKeywords)} sub={`${kpis.notRankedKeywords} not ranking`} />
          <KpiCard label="Top 3" value={String(kpis.top3)} sub="3-Pack range" accent="text-emerald-600" />
          <KpiCard label="Page 1 (top 10)" value={String(kpis.top10)} sub="compounding visibility" accent="text-blue-600" />
          <KpiCard
            label="Average position"
            value={kpis.averagePosition !== null ? `#${kpis.averagePosition}` : '—'}
            sub="across ranked keywords"
          />
          <KpiCard label="Climbed" value={String(kpis.improved)} sub={`${kpis.declined} declined`} accent="text-emerald-600" />
          {!compact && (
            <>
              <KpiCard label="First readings" value={String(kpis.newEntries)} sub="only one check so far" />
              <KpiCard label="Dropped out" value={String(kpis.droppedOut)} sub="left the results" accent="text-rose-600" />
              <KpiCard label="Competitors" value={String(kpis.competitors)} sub={`${kpis.severeThreats} severe threats`} accent="text-amber-700" />
              <KpiCard label="Content gaps" value={String(kpis.contentGaps)} sub="topics rivals cover" accent="text-teal-700" />
              <KpiCard label="Open actions" value={String(kpis.openActions)} sub="from the action plan" accent="text-indigo-700" />
              <KpiCard label="Evidence rows" value={String(kpis.evidenceCitations)} sub={`${kpis.observationCount} observations`} />
            </>
          )}
        </div>
      )}

      {/* ── Search Visibility & Ranking Shifts ────────────────────────── */}
      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Layers className="h-4 w-4 text-indigo-600" />
              Search Visibility &amp; Ranking Shifts
            </h3>
            <p className="mt-1 max-w-2xl text-xs text-slate-500">
              Current rank is the best position of your domain in the most recent check; previous rank is the same measure
              from the preceding check, so every shift compares two separate sweeps.{' '}
              <span className="font-semibold text-slate-600">Not ranking</span> means your domain was absent from the
              collected results — it is never replaced with a competitor&apos;s position.
            </p>
          </div>
          {shifts && (
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-600">
              {shifts.summary.periodLabel}
            </span>
          )}
        </div>

        {shifts && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
            {[
              ['Tracked', shifts.summary.totalTracked, 'text-slate-800'],
              ['Ranked', shifts.summary.ranked, 'text-slate-800'],
              ['Not ranking', shifts.summary.notRanked, 'text-slate-500'],
              ['Climbed', shifts.summary.climbed, 'text-emerald-700'],
              ['Declined', shifts.summary.declined, 'text-rose-700'],
              ['Unchanged', shifts.summary.unchanged, 'text-slate-600'],
              ['First readings', shifts.summary.newEntries, 'text-indigo-700'],
              ['Dropped out', shifts.summary.droppedOut, 'text-rose-700'],
              ['Avg position', shifts.summary.averagePosition !== null ? `#${shifts.summary.averagePosition}` : '—', 'text-blue-700'],
              [
                'Avg shift',
                shifts.summary.averageShift === null
                  ? '—'
                  : `${shifts.summary.averageShift > 0 ? '+' : ''}${shifts.summary.averageShift}`,
                'text-purple-700',
              ],
            ].map(([label, value, cls]) => (
              <div key={String(label)} className="rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2">
                <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{label}</div>
                <div className={`text-sm font-black ${cls}`}>{value}</div>
              </div>
            ))}
          </div>
        )}

        <div>
          <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
            <Target className="h-3.5 w-3.5 text-indigo-500" />
            Position movers
          </div>
          <ShiftTable
            rows={rows}
            emptyMessage="No keyword moved between the last two checks. Positions are listed in the sections below."
          />
        </div>

        {shifts && shifts.unchanged.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setShowSteady((v) => !v)}
              className="mb-2 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-800"
            >
              Holding steady ({shifts.unchanged.length})
              {showSteady ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
            {showSteady && <ShiftTable rows={shifts.unchanged} emptyMessage="No unchanged keywords recorded." />}
          </div>
        )}

        {shifts && shifts.notRanking.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setShowNotRanking((v) => !v)}
              className="mb-2 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-700 hover:text-amber-900"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              Visibility gaps — not ranking ({shifts.notRanking.length})
              {showNotRanking ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
            {showNotRanking && (
              <>
                <ShiftTable
                  rows={shifts.notRanking}
                  emptyMessage="Every tracked keyword has a stored position."
                />
                <p className="mt-2 text-[11px] text-slate-500">
                  These phrases returned no position for your domain. They are ranked by opportunity score — treat them as
                  the growth backlog rather than as a rank of zero.
                </p>
              </>
            )}
          </div>
        )}

        {!shifts && rows.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-xs text-slate-500">
            This report was produced before ranking history was recorded. Generate a new report after the next ranking
            sweep to populate this section.
          </div>
        )}
      </div>

      {/* ── Competitor landscape ──────────────────────────────────────── */}
      {showCompetitors && detailed && detailed.competitors.length > 0 && (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Target className="h-4 w-4 text-rose-500" />
              Competitor Landscape
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Scored on service overlap, proximity, reputation, paid-search activity and SERP overlap — derived from stored
              evidence, never from subjective judgement.
            </p>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <th className="px-4 py-2.5 font-semibold">Competitor</th>
                  <th className="px-3 py-2.5 font-semibold">Type</th>
                  <th className="px-3 py-2.5 text-center font-semibold">Threat</th>
                  <th className="px-3 py-2.5 text-center font-semibold">Match</th>
                  <th className="px-3 py-2.5 text-center font-semibold">Rating</th>
                  <th className="px-3 py-2.5 text-center font-semibold">Reviews</th>
                  <th className="px-3 py-2.5 font-semibold">Proximity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {detailed.competitors.slice(0, 15).map((c) => (
                  <tr key={c.domain} className="hover:bg-slate-50/70">
                    <td className="px-4 py-2.5">
                      <div className="font-semibold text-slate-900">{c.name}</div>
                      <div className="text-[10px] text-slate-400">
                        {c.domain}
                        {c.serpOverlapPercent !== null ? ` · ${c.serpOverlapPercent}% SERP overlap` : ''}
                        {c.hasAds ? ' · runs ads' : ''}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">
                      {c.competitorType}
                      <div className="text-[10px] text-slate-400">{c.status}</div>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span
                        className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${
                          c.threatLevel === 'severe'
                            ? 'border-rose-200 bg-rose-50 text-rose-700'
                            : c.threatLevel === 'vulnerable'
                            ? 'border-amber-200 bg-amber-50 text-amber-700'
                            : 'border-slate-200 bg-slate-50 text-slate-600'
                        }`}
                      >
                        {c.threatLevel || 'unrated'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center font-semibold text-slate-700">{c.confidenceScore}%</td>
                    <td className="px-3 py-2.5 text-center text-slate-600">{c.rating !== null ? c.rating.toFixed(1) : '—'}</td>
                    <td className="px-3 py-2.5 text-center text-slate-600">{c.reviewCount ?? '—'}</td>
                    <td className="px-3 py-2.5 text-[11px] text-slate-500">
                      {c.proximityLabel || (c.distanceMiles !== null ? `${c.distanceMiles} mi` : '—')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {detailed.competitors.some((c) => c.threatReason) && (
            <div className="space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Threat rationale</div>
              <ul className="space-y-1.5">
                {detailed.competitors
                  .filter((c) => c.threatReason)
                  .slice(0, 6)
                  .map((c) => (
                    <li key={`reason-${c.domain}`} className="rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2 text-[11px] text-slate-600">
                      <span className="font-bold text-slate-800">{c.name}:</span> {c.threatReason}
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ── Limitations: never leave the reader guessing ───────────────── */}
      {detailed && detailed.limitations.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-amber-800">
            <Info className="h-3.5 w-3.5" />
            Known limitations of this cycle
          </div>
          <ul className="mt-2 list-inside list-disc space-y-1 text-[11px] text-amber-900">
            {detailed.limitations.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
