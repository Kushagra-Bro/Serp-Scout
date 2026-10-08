import { NormalizedSearchResult, NormalizedMapsResult, NormalizedNewsResult } from './serpapi.js';

export interface WebsiteAnalysis {
  url: string;
  businessName?: string;
  detectedCategory?: string;
  detectedServices: string[];
  detectedLocations: string[];
  metaTitle?: string;
  metaDescription?: string;
  headings: {
    h1: string[];
    h2: string[];
    h3: string[];
  };
  callsToAction: string[];
  contactDetails: {
    phone?: string;
    email?: string;
    address?: string;
    bookingUrl?: string;
  };
  missingOpportunities: {
    servicePages: string[];
    locationPages: string[];
  };
  candidateKeywords: string[];
  candidateCompetitorQueries: string[];
}

export type CompetitorType =
  | 'direct'
  | 'geographic'
  | 'search'
  | 'indirect'
  | 'directory'
  | 'publisher'
  | 'irrelevant';

export type ThreatLevel = 'severe' | 'vulnerable' | 'emerging' | 'moderate';

export interface CompetitorExtractedProfile {
  bookingTech?: string[];
  offers?: string[];
  callsToAction?: string[];
  phone?: string;
  hasOnlineBooking?: boolean;
}

export interface CompetitorCandidate {
  domain: string;
  name: string;
  websiteUrl: string;
  mapsUrl?: string;
  category?: string;
  competitorType: CompetitorType;
  confidenceScore: number;
  evidence: {
    query: string;
    position: number;
    source: 'google' | 'google_maps';
    locationMatch?: string;
    serviceOverlap?: string[];
  }[];
  threatLevel?: ThreatLevel;
  threatReason?: string;
  distanceMiles?: number;
  proximityLabel?: string;
  hasAds?: boolean;
  serpOverlapPercent?: number;
  extractedProfile?: CompetitorExtractedProfile;
  rating?: number;
  reviewCount?: number;
}

export type SearchIntent =
  | 'informational'
  | 'commercial'
  | 'transactional'
  | 'local'
  | 'navigational'
  | 'comparison'
  | 'problem-based';

export interface KeywordCandidate {
  phrase: string;
  intent: SearchIntent;
  opportunityScore: number;
  relevanceScore: number;
  commercialScore: number;
  currentRank?: number;
  bestCompetitorRank?: number;
  serpFeatures?: string[];
  reasoning?: string;
}

export interface ContentGap {
  topic: string;
  competitorDomain: string;
  competitorUrl: string;
  recommendedPageType: 'service' | 'location' | 'faq' | 'comparison' | 'guide';
  suggestedTitle: string;
  suggestedHeadings: string[];
  suggestedFaqs: string[];
  targetIntent: SearchIntent;
  estimatedImpact: 'high' | 'medium' | 'low';
  estimatedEffort: 'low' | 'medium' | 'high';
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  evidenceUrls: string[];
}

export interface MessagingPattern {
  headline: string;
  primaryOffer: string;
  differentiator: string;
  priceLanguage?: string;
  guarantees?: string;
  speedOfService?: string;
  cta: string;
  trustSignals: string[];
  observedPatterns: string[];
}

export interface ReviewTheme {
  theme: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  frequency: number;
  examples: string[];
  sourceUrl?: string;
  suggestedCopyOpportunity?: string;
}

export interface CompetitorVulnerability {
  competitorName: string;
  weaknessTheme: string;
  complaintSample: string;
  counterPositioningHeadline: string;
  trustBadgeCopy: string;
  exploitStrategy: string;
}

export interface ReviewVelocityBenchmark {
  currentReviews: number;
  currentRating: number;
  leaderName: string;
  leaderReviews: number;
  leaderRating: number;
  gapReviews: number;
  weeklyPaceNeeded30Days: number;
  weeklyPaceNeeded60Days: number;
  weeklyPaceNeeded90Days: number;
  leaderStagnant: boolean;
  leaderDaysSinceLastReview?: number;
  strategicAdvice: string;
}

export interface ReviewRequestTemplate {
  channel: 'sms' | 'email' | 'in_person';
  title: string;
  previewText: string;
  body: string;
  timing: string;
}

export interface AIReviewDeescalation {
  customerReviewSnippet: string;
  starRating: number;
  detectedIssue: string;
  suggestedPublicResponse: string;
  seoAnchorKeywordsIncluded: string[];
  internalStaffAction: string;
}

export interface ReviewReplyResult {
  suggestedReply: string;
  sentiment: 'negative' | 'neutral' | 'positive';
  seoKeywordsIncluded: string[];
  internalStaffAction: string;
  disclaimer: string;
}

export interface NewsSignal {
  headline: string;
  source: string;
  date?: string;
  category:
    | 'opportunity'
    | 'competitive_activity'
    | 'market_trend'
    | 'reputation_risk'
    | 'regulatory'
    | 'low_relevance';
  summary: string;
  url: string;
}

export interface Recommendation {
  title: string;
  problem: string;
  evidenceSummary: string;
  sourceUrls: string[];
  searchQueries: string[];
  expectedImpact: 'high' | 'medium' | 'low';
  estimatedEffort: 'low' | 'medium' | 'high';
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  confidence: 'high' | 'medium' | 'low';
  suggestedOwner?: string;
  suggestedDeadline?: string;
  implementationSteps?: string[];
}

export interface ReportShare {
  id: string;
  reportId: string;
  businessId: string;
  shareToken: string;
  viewMode: 'executive' | 'specialist';
  expiresAt?: string | null;
  createdAt: string;
}

export interface MarketAlert {
  id: string;
  businessId: string;
  type: '3pack_displacement' | 'review_spike' | 'competitor_ads' | 'critical_rank_drop';
  severity: 'critical' | 'high' | 'medium';
  title: string;
  description: string;
  details?: Record<string, any>;
  dismissed: boolean;
  detectedAt: string;
}

export interface GeneratedReport {
  executiveSummary: {
    importantChanges: string;
    mainOpportunity: string;
    mainCompetitiveThreat: string;
    weeklyFocus: string;
  };
  visibilityChanges: {
    keywordChanges: Array<{ keyword: string; oldRank?: number; newRank?: number }>;
    mapsChanges: Array<{ business: string; change: string }>;
    serpFeatureChanges: string[];
  };
  competitorChanges: string[];
  contentOpportunities: ContentGap[];
  actionPlan: Recommendation[]; // max 3 to 5
  evidenceAppendix: Array<{
    query: string;
    source: string;
    date: string;
    resultType: string;
    url?: string;
  }>;

  /**
   * Optional detailed-report material. Present on reports generated by the
   * detailed pipeline; older stored reports simply omit it, so every consumer
   * must treat these as optional.
   */
  detailed?: DetailedReportSections;
}

/** Headline numbers shown on the report cover and KPI dashboard. */
export interface ReportKpis {
  trackedKeywords: number;
  rankedKeywords: number;
  notRankedKeywords: number;
  top3: number;
  top10: number;
  averagePosition: number | null;
  improved: number;
  declined: number;
  unchanged: number;
  newEntries: number;
  droppedOut: number;
  largestGain: { keyword: string; delta: number } | null;
  largestDrop: { keyword: string; delta: number } | null;
  competitors: number;
  severeThreats: number;
  contentGaps: number;
  openActions: number;
  evidenceCitations: number;
  observationCount: number;
}

/**
 * One point on a keyword's rank trend.
 *
 * `rank` is null when the phrase was swept and the business did not appear in
 * that sweep — plotting that gap is what makes a drop-out visible instead of a
 * straight line through missing data.
 */
export interface RankTrendPoint {
  /** ISO timestamp of the sweep. */
  at: string;
  rank: number | null;
}

/**
 * One row of "Search Visibility & Ranking Shifts".
 *
 * `previousRank`/`currentRank` are the business's own positions, taken from the
 * most recent two checks (one check = one search run): previousRank is the best
 * own-domain position in the previous check, currentRank the same for the latest
 * check. `shift` is positive when the business moved up.
 */
export interface RankingShiftRow {
  keyword: string;
  location: string | null;
  intent: string | null;
  previousRank: number | null;
  currentRank: number | null;
  /** previousRank - currentRank; positive = climbed. Null when not comparable. */
  shift: number | null;
  status: 'climbed' | 'declined' | 'unchanged' | 'new' | 'dropped-out' | 'not-ranking';
  bestCompetitorRank: number | null;
  bestCompetitorDomain: string | null;
  opportunityScore: number | null;
  lastObservedAt: string | null;
  url: string | null;
  /** Chronological position history (oldest first), capped to the last sweeps. */
  trend: RankTrendPoint[];
}

export interface ReportRankingShifts {
  summary: {
    totalTracked: number;
    ranked: number;
    notRanked: number;
    climbed: number;
    declined: number;
    unchanged: number;
    newEntries: number;
    droppedOut: number;
    averagePosition: number | null;
    averageShift: number | null;
    periodLabel: string;
  };
  distribution: {
    top3: number;
    top4to10: number;
    page2: number;
    beyond: number;
  };
  movers: RankingShiftRow[];
  unchanged: RankingShiftRow[];
  newEntries: RankingShiftRow[];
  droppedOut: RankingShiftRow[];
  notRanking: RankingShiftRow[];
}

export interface ReportCompetitorRow {
  name: string;
  domain: string;
  competitorType: string;
  status: string;
  confidenceScore: number;
  threatLevel: string | null;
  threatReason: string | null;
  category: string | null;
  rating: number | null;
  reviewCount: number | null;
  distanceMiles: number | null;
  proximityLabel: string | null;
  hasAds: boolean;
  serpOverlapPercent: number | null;
}

export interface ReportActionRow extends Recommendation {
  id?: string;
  status?: string;
  checklist?: { steps: string[]; completed: boolean[] } | null;
  dueDate?: string | null;
}

export interface ReportReputationTheme {
  theme: string;
  sentiment: string;
  frequency: number;
  examples: string[];
  competitorDomain: string | null;
}

export interface DetailedReportSections {
  meta: {
    businessName: string;
    websiteUrl: string;
    city: string | null;
    industry: string | null;
    country: string | null;
    services: string[];
    periodStart: string;
    periodEnd: string;
    generatedAt: string;
    reportId?: string | null;
    workspaceName?: string | null;
  };
  kpis: ReportKpis;
  rankingShifts: ReportRankingShifts;
  competitors: ReportCompetitorRow[];
  /** Content gaps with the full page plan (title, headings, FAQs). */
  contentGaps: ContentGap[];
  reputation: {
    themes: ReportReputationTheme[];
    positiveCount: number;
    negativeCount: number;
    neutralCount: number;
    summary: string;
  };
  localPresence: {
    hasMapsData: boolean;
    threePackMentions: number;
    topRivalByReviews: { name: string; domain: string; reviewCount: number | null; rating: number | null } | null;
    notes: string[];
  };
  actions: ReportActionRow[];
  evidence: Array<{
    query: string;
    source: string;
    date: string;
    resultType: string;
    url?: string;
  }>;
  methodology: string[];
  /** Explicit statements about what could not be measured, so nothing is implied. */
  limitations: string[];
}
