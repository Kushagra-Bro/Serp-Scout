import { Annotation } from '@langchain/langgraph';
import {
  WebsiteAnalysis,
  CompetitorCandidate,
  KeywordCandidate,
  ContentGap,
  Recommendation,
  GeneratedReport,
  ReviewTheme,
  NewsSignal,
  NormalizedSearchResult,
  NormalizedMapsResult,
  NormalizedNewsResult,
} from '@serp-scout/types';
import type { PlannedQueries } from '../competitor-discovery/query-planner.js';
import type { MarketPatternInsight } from '../messaging-analysis/index.js';

export interface AgentContext {
  businessId: string;
  businessName?: string;
  websiteUrl?: string;
  industry?: string;
  city?: string;
  country?: string;
  serviceArea?: string;
  /** Services the business actually offers. Seeded from the DB or website analysis. */
  services?: string[];
}

/** A single citation proving where an observation came from. */
export interface EvidenceLogEntry {
  query: string;
  source: string;
  date: string;
  resultType: 'organic' | 'maps' | 'news' | 'website' | 'competitor_site';
  url?: string;
}

/**
 * Preserves which query produced which batch of results. The SERP sweep
 * flattens every query's results into one array, so this side-channel is what
 * lets downstream nodes attribute a competitor to the exact query it ranked for.
 */
export interface SweepIndexEntry {
  query: string;
  source: 'google' | 'google_maps';
  /** How many consecutive results in the flattened array came from this query. */
  count: number;
}

export const AgentStateAnnotation = Annotation.Root({
  // Business context
  context: Annotation<AgentContext>(),

  // Pipeline stage outputs
  websiteAnalysis: Annotation<WebsiteAnalysis | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),

  // Search Results
  organicResults: Annotation<NormalizedSearchResult[]>({
    reducer: (curr, next) => [...curr, ...next],
    default: () => [],
  }),
  mapsResults: Annotation<NormalizedMapsResult[]>({
    reducer: (curr, next) => [...curr, ...next],
    default: () => [],
  }),
  newsResults: Annotation<NormalizedNewsResult[]>({
    reducer: (curr, next) => [...curr, ...next],
    default: () => [],
  }),

  // People Also Ask questions harvested during the SERP sweep
  paaQuestions: Annotation<string[]>({
    reducer: (curr, next) => [...curr, ...next],
    default: () => [],
  }),

  // Query plan produced by the query planner, consumed by the SERP sweep
  plannedQueries: Annotation<PlannedQueries | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),

  // Provenance side-channel for the flattened SERP sweep results
  sweepIndex: Annotation<SweepIndexEntry[]>({
    reducer: (curr, next) => [...curr, ...next],
    default: () => [],
  }),

  // Competitors & Keywords
  competitorCandidates: Annotation<CompetitorCandidate[]>({
    reducer: (curr, next) => [...curr, ...next],
    default: () => [],
  }),
  keywordCandidates: Annotation<KeywordCandidate[]>({
    reducer: (curr, next) => [...curr, ...next],
    default: () => [],
  }),

  // Gaps & Recommendations
  contentGaps: Annotation<ContentGap[]>({
    reducer: (curr, next) => [...curr, ...next],
    default: () => [],
  }),

  // Voice-of-customer, messaging and market signals.
  // These are written concurrently by the parallel analysis fan-out, so they
  // MUST use append reducers to merge safely.
  reviewThemes: Annotation<ReviewTheme[]>({
    reducer: (curr, next) => [...curr, ...next],
    default: () => [],
  }),
  messagingPatterns: Annotation<MarketPatternInsight[]>({
    reducer: (curr, next) => [...curr, ...next],
    default: () => [],
  }),
  newsSignals: Annotation<NewsSignal[]>({
    reducer: (curr, next) => [...curr, ...next],
    default: () => [],
  }),

  // Provenance for every observation that fed the report
  evidenceLog: Annotation<EvidenceLogEntry[]>({
    reducer: (curr, next) => [...curr, ...next],
    default: () => [],
  }),

  recommendations: Annotation<Recommendation[]>({
    reducer: (curr, next) => [...curr, ...next],
    default: () => [],
  }),

  // Final Generated Report
  report: Annotation<GeneratedReport | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),

  // Accumulated errors across nodes
  errors: Annotation<string[]>({
    reducer: (curr, next) => [...curr, ...next],
    default: () => [],
  }),
});

export type AgentState = typeof AgentStateAnnotation.State;
export type AgentStateUpdate = typeof AgentStateAnnotation.Update;
