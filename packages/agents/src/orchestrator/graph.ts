import { StateGraph, START, END } from '@langchain/langgraph';
import {
  CompetitorCandidate,
  ContentGap,
  NormalizedMapsResult,
  NormalizedNewsResult,
  NormalizedSearchResult,
  Recommendation,
} from '@serp-scout/types';
import { analyzeWebsite } from '../website-analyzer/index.js';
import { planCompetitorQueries, PlannedQueries } from '../competitor-discovery/query-planner.js';
import { discoverCompetitors } from '../competitor-discovery/index.js';
import { RawSearchItemWithContext } from '../competitor-discovery/candidate-extractor.js';
import { discoverKeywords } from '../keyword-discovery/index.js';
import { analyzeContentGaps } from '../content-gap/index.js';
import { analyzeCompetitorMessaging } from '../messaging-analysis/index.js';
import { analyzeCustomerReviews, RawReviewSnippet } from '../review-analysis/index.js';
import { analyzeNewsSignals } from '../news-monitor/index.js';
import { generateRecommendations } from '../recommendation-engine/index.js';
import { generateWeeklyReport } from '../report-generator/index.js';
import { AgentContext, AgentState, AgentStateAnnotation, EvidenceLogEntry, SweepIndexEntry } from './state.js';

/**
 * Search providers are injected rather than imported so this package stays free
 * of a hard dependency on a paid API client and the graph remains unit-testable
 * with a fake gateway. `apps/api` supplies the SerpApi-backed implementation.
 */
export interface ResearchSearchGateway {
  searchOrganic(
    query: string,
    opts?: { location?: string }
  ): Promise<{ results: NormalizedSearchResult[]; paaQuestions: string[] }>;
  searchMaps(
    query: string,
    opts?: { location?: string }
  ): Promise<{ results: NormalizedMapsResult[] }>;
  searchNews(query: string): Promise<{ results: NormalizedNewsResult[] }>;
}

export interface ResearchGraphOptions {
  context: AgentContext;
  search: ResearchSearchGateway;
  apiKey?: string;
  /** Reporting window; defaults to the trailing 7 days. */
  periodStart?: string;
  periodEnd?: string;
  /** Cost control: cap on organic queries per run. */
  maxOrganicQueries?: number;
  /** Cost control: cap on Maps (3-Pack) queries per run. */
  maxMapsQueries?: number;
  /** Cost control: cap on candidates sent to Groq for enrichment. */
  maxCandidatesToEnrich?: number;
}

const DEFAULT_MAX_ORGANIC = 6;
const DEFAULT_MAX_MAPS = 3;
const DEFAULT_MAX_ENRICH = 10;

function isoDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  return d.toISOString().split('T')[0];
}

function today(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Wraps a node so a transient failure is recorded on the `errors` channel
 * instead of aborting the whole run. The append reducer on that channel makes
 * concurrent failures accumulate rather than overwrite each other.
 */
async function safeNode(
  name: string,
  state: AgentState,
  run: (state: AgentState) => Promise<Partial<AgentState>>
): Promise<Partial<AgentState>> {
  try {
    return await run(state);
  } catch (err: any) {
    const message = err?.message || String(err);
    console.error(`[ResearchGraph] Node "${name}" failed: ${message}`);
    return { errors: [`${name}: ${message}`] };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Nodes
// ─────────────────────────────────────────────────────────────────────────────

/** Scrapes and AI-enriches the business website to seed services and queries. */
async function analyzeWebsiteNode(
  state: AgentState,
  config: ResearchGraphOptions
): Promise<Partial<AgentState>> {
  const { context, apiKey } = config;
  if (!context.websiteUrl) return {};

  const analysis = await analyzeWebsite(context.websiteUrl, {
    businessNameHint: context.businessName,
    industryHint: context.industry,
    cityHint: context.city,
    apiKey,
  });

  return {
    websiteAnalysis: analysis,
    // Backfill services so later nodes have something to work with.
    context: {
      ...context,
      services: context.services?.length ? context.services : analysis.detectedServices,
      industry: context.industry || analysis.detectedCategory,
    },
    evidenceLog: [
      {
        query: context.websiteUrl,
        source: 'Website Analysis',
        date: today(),
        resultType: 'website',
        url: context.websiteUrl,
      },
    ],
  };
}

/** Expands the business profile into a bounded, intent-tagged query plan. */
async function planQueriesNode(
  state: AgentState,
  config: ResearchGraphOptions
): Promise<Partial<AgentState>> {
  const ctx = state.context || config.context;
  const services = ctx.services?.length ? ctx.services : state.websiteAnalysis?.detectedServices || [];

  const planned: PlannedQueries = planCompetitorQueries({
    businessName: ctx.businessName || 'Local Business',
    category: ctx.industry,
    services,
    city: ctx.city,
    serviceArea: ctx.serviceArea,
  });

  // Fold in any extra competitor queries the website analyzer suggested.
  const extra = state.websiteAnalysis?.candidateCompetitorQueries || [];
  const merged = Array.from(new Set([...planned.allQueries, ...extra]));

  return {
    plannedQueries: { ...planned, allQueries: merged },
  };
}

/**
 * Executes the bounded SERP sweep. Organic, Maps and News run concurrently;
 * each result is tagged with its query so downstream nodes can cite it.
 */
async function searchSweepNode(
  state: AgentState,
  config: ResearchGraphOptions
): Promise<Partial<AgentState>> {
  const planned = state.plannedQueries;
  if (!planned) return {};

  const { search, context, maxOrganicQueries, maxMapsQueries } = config;
  const organicCap = maxOrganicQueries ?? DEFAULT_MAX_ORGANIC;
  const mapsCap = maxMapsQueries ?? DEFAULT_MAX_MAPS;
  const location = context.city;

  const organicQueries = planned.allQueries.slice(0, organicCap);
  const mapsQueries = planned.localQueries.slice(0, mapsCap);
  const newsQuery = planned.commercialQueries[0] || planned.allQueries[0] || context.businessName || '';

  const organicSettled = await Promise.allSettled(
    organicQueries.map((query) => search.searchOrganic(query, { location }))
  );
  const mapsSettled = await Promise.allSettled(
    mapsQueries.map((query) => search.searchMaps(query, { location }))
  );
  const newsSettled = await Promise.allSettled([search.searchNews(newsQuery)]);

  const organicResults: NormalizedSearchResult[] = [];
  const mapsResults: NormalizedMapsResult[] = [];
  const newsResults: NormalizedNewsResult[] = [];
  const paaQuestions: string[] = [];
  const evidenceLog: EvidenceLogEntry[] = [];
  const sweepIndex: SweepIndexEntry[] = [];
  const errors: string[] = [];

  // Promise.allSettled preserves input order, so appending each query's results
  // in order lets us record an exact count-based provenance index below.
  organicSettled.forEach((outcome, i) => {
    const query = organicQueries[i];
    if (outcome.status === 'fulfilled') {
      organicResults.push(...outcome.value.results);
      sweepIndex.push({ query, source: 'google', count: outcome.value.results.length });
      outcome.value.paaQuestions.forEach((q) => {
        if (!paaQuestions.includes(q)) paaQuestions.push(q);
      });
      evidenceLog.push({ query, source: 'Google Search', date: today(), resultType: 'organic' });
    } else {
      errors.push(`search_sweep[google:"${query}"]: ${outcome.reason?.message || outcome.reason}`);
    }
  });

  mapsSettled.forEach((outcome, i) => {
    const query = mapsQueries[i];
    if (outcome.status === 'fulfilled') {
      mapsResults.push(...outcome.value.results);
      sweepIndex.push({ query, source: 'google_maps', count: outcome.value.results.length });
      evidenceLog.push({ query, source: 'Google Maps', date: today(), resultType: 'maps' });
    } else {
      errors.push(`search_sweep[maps:"${query}"]: ${outcome.reason?.message || outcome.reason}`);
    }
  });

  newsSettled.forEach((outcome) => {
    if (outcome.status === 'fulfilled') {
      newsResults.push(...outcome.value.results);
      evidenceLog.push({ query: newsQuery, source: 'Google News', date: today(), resultType: 'news' });
    } else {
      errors.push(`search_sweep[news]: ${outcome.reason?.message || outcome.reason}`);
    }
  });

  if (errors.length > 0) errors.forEach((e) => console.warn(`[ResearchGraph] ${e}`));

  // Append reducers merge these into the accumulated state.
  return { organicResults, mapsResults, newsResults, paaQuestions, evidenceLog, sweepIndex, errors };
}

/** Turns the raw SERP sweep into scored, threat-levelled competitor candidates. */
async function discoverCompetitorsNode(
  state: AgentState,
  config: ResearchGraphOptions
): Promise<Partial<AgentState>> {
  if (state.organicResults.length === 0 && state.mapsResults.length === 0) return {};

  const ctx = state.context || config.context;

  // Re-attribute each flattened result to the query that actually produced it.
  const fallbackQuery = state.plannedQueries?.allQueries[0] || ctx.businessName || '';
  const searchItems: RawSearchItemWithContext[] = [];
  let organicCursor = 0;
  let mapsCursor = 0;

  for (const entry of state.sweepIndex) {
    if (entry.source === 'google') {
      for (let i = 0; i < entry.count; i++) {
        const item = state.organicResults[organicCursor++];
        if (item) searchItems.push({ query: entry.query, source: 'google', item });
      }
    } else {
      for (let i = 0; i < entry.count; i++) {
        const item = state.mapsResults[mapsCursor++];
        if (item) searchItems.push({ query: entry.query, source: 'google_maps', item });
      }
    }
  }

  // Defensive: if the index is missing or inconsistent, fall back to a single
  // query label rather than dropping results on the floor.
  if (searchItems.length === 0) {
    state.organicResults.forEach((item) => searchItems.push({ query: fallbackQuery, source: 'google', item }));
    state.mapsResults.forEach((item) => searchItems.push({ query: fallbackQuery, source: 'google_maps', item }));
  }

  const candidates: CompetitorCandidate[] = await discoverCompetitors({
    business: {
      name: ctx.businessName || 'Local Business',
      websiteUrl: ctx.websiteUrl || '',
      category: ctx.industry,
      services: ctx.services || [],
      city: ctx.city || '',
      coordinates: null,
    },
    searchItems,
    maxCandidatesToEnrich: config.maxCandidatesToEnrich ?? DEFAULT_MAX_ENRICH,
    apiKey: config.apiKey,
  });

  return { competitorCandidates: candidates };
}

/** Generates, classifies and scores commercial keyword opportunities. */
async function discoverKeywordsNode(
  state: AgentState,
  config: ResearchGraphOptions
): Promise<Partial<AgentState>> {
  const ctx = state.context || config.context;
  const services = ctx.services?.length ? ctx.services : state.websiteAnalysis?.detectedServices || [];
  if (services.length === 0 && !ctx.businessName) return {};

  const keywordCandidates = await discoverKeywords({
    business: {
      name: ctx.businessName || 'Local Business',
      category: ctx.industry,
      services,
      city: ctx.city,
    },
    websiteKeywords: state.websiteAnalysis?.candidateKeywords,
    serpTitles: state.organicResults.slice(0, 10).map((r) => r.title),
    paaQuestions: state.paaQuestions,
    apiKey: config.apiKey,
  });

  return { keywordCandidates };
}

/** Self-gating fan-out node: no competitors means nothing to gap against. */
async function contentGapNode(
  state: AgentState,
  config: ResearchGraphOptions
): Promise<Partial<AgentState>> {
  const rivals = state.competitorCandidates
    .filter((c) => c.competitorType !== 'irrelevant' && c.competitorType !== 'directory')
    .slice(0, 6);
  if (rivals.length === 0) return {};

  const ctx = state.context || config.context;
  const contentGaps: ContentGap[] = await analyzeContentGaps({
    business: {
      name: ctx.businessName || 'Local Business',
      websiteUrl: ctx.websiteUrl || '',
      services: ctx.services || [],
      city: ctx.city,
    },
    competitors: rivals.map((c) => ({
      name: c.name,
      domain: c.domain,
      websiteUrl: c.websiteUrl,
      observedSnippets: c.evidence.map((e) => `${e.query} (position ${e.position})`),
    })),
    serpQueries: (state.plannedQueries?.allQueries || []).slice(0, 6),
    apiKey: config.apiKey,
  });

  return { contentGaps };
}

/** Self-gating fan-out node: extracts how rivals position themselves. */
async function messagingNode(
  state: AgentState,
  config: ResearchGraphOptions
): Promise<Partial<AgentState>> {
  const rivals = state.competitorCandidates
    .filter((c) => c.competitorType !== 'irrelevant' && c.competitorType !== 'directory')
    .slice(0, 6);
  if (rivals.length === 0) return {};

  const ctx = state.context || config.context;
  const result = await analyzeCompetitorMessaging({
    business: {
      name: ctx.businessName || 'Local Business',
      services: ctx.services || [],
      city: ctx.city,
    },
    competitorData: rivals.map((c) => ({
      name: c.name,
      domain: c.domain,
      websiteUrl: c.websiteUrl,
      snippets: c.evidence.map((e) => e.query),
      extractedProfile: c.extractedProfile,
    })),
    apiKey: config.apiKey,
  });

  return { messagingPatterns: result.marketPatterns };
}

/** Self-gating fan-out node: voice-of-customer from 3-Pack review signals. */
async function reviewNode(
  state: AgentState,
  config: ResearchGraphOptions
): Promise<Partial<AgentState>> {
  if (state.mapsResults.length === 0) return {};

  const ctx = state.context || config.context;
  const reviews: RawReviewSnippet[] = state.mapsResults.slice(0, 20).map((r) => ({
    competitorName: r.title,
    sourceUrl: (r.raw as any)?.link,
    rating: r.rating,
    snippet: r.address || `${r.title} local business listing.`,
  }));

  const result = await analyzeCustomerReviews({
    business: {
      name: ctx.businessName || 'Local Business',
      services: ctx.services || [],
      city: ctx.city,
    },
    reviews,
    competitors: state.competitorCandidates.slice(0, 8).map((c) => ({
      name: c.name,
      rating: c.rating,
      reviewCount: c.reviewCount,
      domain: c.domain,
    })),
    apiKey: config.apiKey,
  });

  return { reviewThemes: result.themes };
}

/** Self-gating fan-out node: only runs if the news sweep returned articles. */
async function newsSignalNode(
  state: AgentState,
  config: ResearchGraphOptions
): Promise<Partial<AgentState>> {
  if (state.newsResults.length === 0) return {};

  const ctx = state.context || config.context;
  const newsSignals = await analyzeNewsSignals({
    business: {
      name: ctx.businessName || 'Local Business',
      services: ctx.services || [],
      city: ctx.city,
    },
    articles: state.newsResults.slice(0, 15).map((n) => ({
      title: n.title,
      source: n.source,
      url: n.link,
      snippet: n.snippet,
      date: n.date,
    })),
    apiKey: config.apiKey,
  });

  return { newsSignals };
}

/** Fans every accumulated evidence channel into 3–5 prioritized actions. */
async function recommendationsNode(
  state: AgentState,
  config: ResearchGraphOptions
): Promise<Partial<AgentState>> {
  const ctx = state.context || config.context;
  const hasEvidence =
    state.keywordCandidates.length > 0 ||
    state.contentGaps.length > 0 ||
    state.messagingPatterns.length > 0 ||
    state.reviewThemes.length > 0 ||
    state.newsSignals.length > 0;

  if (!hasEvidence) return {};

  const recommendations: Recommendation[] = await generateRecommendations({
    business: {
      name: ctx.businessName || 'Local Business',
      websiteUrl: ctx.websiteUrl || '',
      services: ctx.services || [],
      city: ctx.city,
    },
    rankingChanges: state.keywordCandidates.slice(0, 8).map((k) => ({
      phrase: k.phrase,
      currentRank: k.currentRank ?? null,
      previousRank: null,
      delta: null,
      bestCompetitorRank: k.bestCompetitorRank ?? null,
      bestCompetitorDomain: state.competitorCandidates[0]?.domain ?? null,
    })),
    contentGaps: state.contentGaps,
    messagingPatterns: state.messagingPatterns,
    reviewThemes: state.reviewThemes,
    newsSignals: state.newsSignals,
    apiKey: config.apiKey,
  });

  return { recommendations };
}

/** Produces the final executive report from the completed action plan. */
async function reportNode(
  state: AgentState,
  config: ResearchGraphOptions
): Promise<Partial<AgentState>> {
  const ctx = state.context || config.context;
  if (state.recommendations.length === 0) return {};

  const report = await generateWeeklyReport({
    business: {
      name: ctx.businessName || 'Local Business',
      websiteUrl: ctx.websiteUrl || '',
      services: ctx.services || [],
      city: ctx.city,
    },
    periodStart: config.periodStart || isoDate(7),
    periodEnd: config.periodEnd || today(),
    keywordRankings: state.keywordCandidates.slice(0, 10).map((k) => ({
      phrase: k.phrase,
      currentRank: k.currentRank ?? null,
      previousRank: null,
      delta: null,
      bestCompetitorRank: k.bestCompetitorRank ?? null,
      bestCompetitorDomain: state.competitorCandidates[0]?.domain ?? null,
    })),
    contentGaps: state.contentGaps,
    competitorChanges: state.competitorCandidates
      .filter((c) => c.threatLevel === 'severe' || c.threatLevel === 'vulnerable')
      .slice(0, 5)
      .map((c) => `${c.name} (${c.domain}) rated "${c.threatLevel}": ${c.threatReason || 'outranking you on core local queries'}`),
    reviewThemes: state.reviewThemes,
    newsSignals: state.newsSignals,
    evidenceLog: state.evidenceLog,
    apiKey: config.apiKey,
  });

  return { report };
}

// ─────────────────────────────────────────────────────────────────────────────
// Graph assembly
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds the compiled research graph, closing over the injected config so each
 * node can reach the search gateway. Compile once per run and discard — the
 * gateway is a live object, so a shared cached graph would be incorrect.
 *
 *   START -> analyze_website -> plan_queries -> search_sweep
 *         -> discover_competitors -> discover_keywords
 *         -> [content_gap | messaging | review | news_signals]   (parallel)
 *         -> recommendation_engine -> report_generator -> END
 *
 * The four analysis nodes fan out from `discover_keywords` and fan back in at
 * `recommendation_engine`. LangGraph waits for every incoming edge before
 * running a node, so the fan-in is a barrier; the append reducers on their
 * output channels are what make the concurrent writes safe.
 *
 * Node names must not collide with state channel names (LangGraph rejects
 * that at compile time), which is why the recommendation node is
 * `recommendation_engine` rather than `recommendations`.
 */
export function buildResearchGraph(config: ResearchGraphOptions) {
  const node =
    (
      name: string,
      run: (state: AgentState, config: ResearchGraphOptions) => Promise<Partial<AgentState>>
    ) =>
    (state: AgentState) =>
      safeNode(name, state, (s) => run(s, config));

  return new StateGraph(AgentStateAnnotation)
    .addNode('analyze_website', node('analyze_website', analyzeWebsiteNode))
    .addNode('plan_queries', node('plan_queries', planQueriesNode))
    .addNode('search_sweep', node('search_sweep', searchSweepNode))
    .addNode('discover_competitors', node('discover_competitors', discoverCompetitorsNode))
    .addNode('discover_keywords', node('discover_keywords', discoverKeywordsNode))
    .addNode('content_gap', node('content_gap', contentGapNode))
    .addNode('messaging', node('messaging', messagingNode))
    .addNode('review', node('review', reviewNode))
    .addNode('news_signals', node('news_signals', newsSignalNode))
    .addNode('recommendation_engine', node('recommendation_engine', recommendationsNode))
    .addNode('report_generator', node('report_generator', reportNode))
    .addEdge(START, 'analyze_website')
    .addEdge('analyze_website', 'plan_queries')
    .addEdge('plan_queries', 'search_sweep')
    .addEdge('search_sweep', 'discover_competitors')
    .addEdge('discover_competitors', 'discover_keywords')
    .addEdge('discover_keywords', 'content_gap')
    .addEdge('discover_keywords', 'messaging')
    .addEdge('discover_keywords', 'review')
    .addEdge('discover_keywords', 'news_signals')
    .addEdge('content_gap', 'recommendation_engine')
    .addEdge('messaging', 'recommendation_engine')
    .addEdge('review', 'recommendation_engine')
    .addEdge('news_signals', 'recommendation_engine')
    .addEdge('recommendation_engine', 'report_generator')
    .addEdge('report_generator', END)
    .compile();
}

/**
 * Runs the full research pipeline for one business.
 *
 * Nodes never throw: a failure is appended to the `errors` channel and the run
 * continues, so a partial research pass still yields a usable report.
 */
export async function runResearchGraph(options: ResearchGraphOptions): Promise<AgentState> {
  const app = buildResearchGraph(options);
  return (await app.invoke({
    context: options.context,
    errors: [],
  } as any)) as AgentState;
}
