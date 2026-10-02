import {
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
  boolean,
  integer,
  numeric,
  real,
  jsonb,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// 1. Workspaces
export const workspaces = pgTable('workspaces', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  ownerId: varchar('owner_id', { length: 255 }).notNull(),
  timezone: varchar('timezone', { length: 100 }).default('UTC').notNull(),
  monthlyQuota: integer('monthly_quota').default(500).notNull(),
  usedQuota: integer('used_quota').default(0).notNull(),
  refreshCadence: varchar('refresh_cadence', { length: 50 }).default('weekly').notNull(), // 'daily' | 'weekly' | 'monthly' | 'manual'
  notificationEmail: varchar('notification_email', { length: 255 }),
  staleDaysThreshold: integer('stale_days_threshold').default(7).notNull(),
  lastScheduledRunAt: timestamp('last_scheduled_run_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 2. Users
export const users = pgTable('users', {
  id: varchar('id', { length: 255 }).primaryKey(), // User ID (e.g. usr_...)
  workspaceId: uuid('workspace_id')
    .references(() => workspaces.id, { onDelete: 'set null' }),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  passwordHash: varchar('password_hash', { length: 255 }),
  avatarUrl: text('avatar_url'),
  role: varchar('role', { length: 50 }).default('owner').notNull(), // 'owner' | 'admin' | 'analyst' | 'viewer'
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 3. Businesses
export const businesses = pgTable('businesses', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id')
    .references(() => workspaces.id, { onDelete: 'cascade' })
    .notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  websiteUrl: text('website_url').notNull(),
  industry: varchar('industry', { length: 255 }),
  description: text('description'),
  country: varchar('country', { length: 100 }),
  city: varchar('city', { length: 100 }),
  serviceArea: text('service_area'),
  primaryGoal: text('primary_goal'),
  timezone: varchar('timezone', { length: 100 }).default('UTC'),
  dataStale: boolean('data_stale').default(false).notNull(),
  lastAnalyzedAt: timestamp('last_analyzed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 4. Business Locations
export const businessLocations = pgTable('business_locations', {
  id: uuid('id').defaultRandom().primaryKey(),
  businessId: uuid('business_id')
    .references(() => businesses.id, { onDelete: 'cascade' })
    .notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  address: text('address'),
  latitude: numeric('latitude', { precision: 10, scale: 7 }),
  longitude: numeric('longitude', { precision: 10, scale: 7 }),
  country: varchar('country', { length: 100 }),
  city: varchar('city', { length: 100 }),
  radius: integer('radius'), // in km or miles
  mapsProfileUrl: text('maps_profile_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 5. Services
export const services = pgTable('services', {
  id: uuid('id').defaultRandom().primaryKey(),
  businessId: uuid('business_id')
    .references(() => businesses.id, { onDelete: 'cascade' })
    .notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  priority: integer('priority').default(1).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 6. Competitors
export const competitors = pgTable('competitors', {
  id: uuid('id').defaultRandom().primaryKey(),
  businessId: uuid('business_id')
    .references(() => businesses.id, { onDelete: 'cascade' })
    .notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  domain: varchar('domain', { length: 255 }).notNull(),
  websiteUrl: text('website_url').notNull(),
  mapsUrl: text('maps_url'),
  category: varchar('category', { length: 255 }),
  competitorType: varchar('competitor_type', { length: 50 }).default('search').notNull(), // 'direct' | 'geographic' | 'search' | 'indirect' | 'directory' | 'publisher' | 'irrelevant'
  confidenceScore: real('confidence_score').default(0.0).notNull(),
  status: varchar('status', { length: 50 }).default('candidate').notNull(), // 'candidate' | 'confirmed' | 'rejected' | 'indirect'
  userNotes: text('user_notes'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 7. Keywords
export const keywords = pgTable('keywords', {
  id: uuid('id').defaultRandom().primaryKey(),
  businessId: uuid('business_id')
    .references(() => businesses.id, { onDelete: 'cascade' })
    .notNull(),
  phrase: varchar('phrase', { length: 255 }).notNull(),
  location: varchar('location', { length: 255 }),
  language: varchar('language', { length: 50 }).default('en'),
  intent: varchar('intent', { length: 50 }), // 'informational' | 'commercial' | 'transactional' | 'local' | 'navigational' | 'comparison' | 'problem-based'
  status: varchar('status', { length: 50 }).default('candidate').notNull(), // 'candidate' | 'approved' | 'rejected' | 'tracking'
  opportunityScore: real('opportunity_score').default(0.0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 8. Search Runs
export const searchRuns = pgTable('search_runs', {
  id: uuid('id').defaultRandom().primaryKey(),
  businessId: uuid('business_id')
    .references(() => businesses.id, { onDelete: 'cascade' })
    .notNull(),
  provider: varchar('provider', { length: 50 }).default('serpapi').notNull(),
  searchType: varchar('search_type', { length: 50 }).notNull(), // 'google' | 'google_maps' | 'google_news' | 'google_shopping'
  query: text('query').notNull(),
  location: varchar('location', { length: 255 }),
  language: varchar('language', { length: 50 }).default('en'),
  device: varchar('device', { length: 50 }).default('desktop'),
  requestedAt: timestamp('requested_at', { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  status: varchar('status', { length: 50 }).default('pending').notNull(), // 'pending' | 'completed' | 'failed'
  errorMessage: text('error_message'),
  costUnits: integer('cost_units').default(1).notNull(),
});

// 9. Search Results
export const searchResults = pgTable('search_results', {
  id: uuid('id').defaultRandom().primaryKey(),
  searchRunId: uuid('search_run_id')
    .references(() => searchRuns.id, { onDelete: 'cascade' })
    .notNull(),
  resultType: varchar('result_type', { length: 50 }).notNull(),
  rank: integer('rank').notNull(),
  title: text('title').notNull(),
  url: text('url').notNull(),
  domain: varchar('domain', { length: 255 }).notNull(),
  businessName: varchar('business_name', { length: 255 }),
  snippet: text('snippet'),
  rating: numeric('rating', { precision: 3, scale: 2 }),
  reviewCount: integer('review_count'),
  locationText: text('location_text'),
  rawReference: jsonb('raw_reference'),
});

// 10. Ranking Observations
export const rankingObservations = pgTable('ranking_observations', {
  id: uuid('id').defaultRandom().primaryKey(),
  businessId: uuid('business_id')
    .references(() => businesses.id, { onDelete: 'cascade' })
    .notNull(),
  keywordId: uuid('keyword_id')
    .references(() => keywords.id, { onDelete: 'cascade' })
    .notNull(),
  domain: varchar('domain', { length: 255 }).notNull(),
  url: text('url').notNull(),
  rank: integer('rank').notNull(),
  resultType: varchar('result_type', { length: 50 }).default('organic').notNull(),
  serpFeatures: jsonb('serp_features'),
  searchRunId: uuid('search_run_id').references(() => searchRuns.id, { onDelete: 'set null' }),
  observedAt: timestamp('observed_at', { withTimezone: true }).defaultNow().notNull(),
});

// 11. Content Gaps
export const contentGaps = pgTable('content_gaps', {
  id: uuid('id').defaultRandom().primaryKey(),
  businessId: uuid('business_id')
    .references(() => businesses.id, { onDelete: 'cascade' })
    .notNull(),
  competitorId: uuid('competitor_id').references(() => competitors.id, { onDelete: 'cascade' }),
  topic: text('topic').notNull(),
  evidence: jsonb('evidence'),
  recommendedPageType: varchar('recommended_page_type', { length: 100 }),
  suggestedTitle: text('suggested_title'),
  suggestedHeadings: jsonb('suggested_headings'),
  suggestedFaqs: jsonb('suggested_faqs'),
  targetIntent: varchar('target_intent', { length: 50 }),
  priority: varchar('priority', { length: 10 }).default('P1').notNull(), // 'P0' | 'P1' | 'P2' | 'P3'
  effort: varchar('effort', { length: 20 }).default('medium').notNull(), // 'low' | 'medium' | 'high'
  impact: varchar('impact', { length: 20 }).default('medium').notNull(), // 'low' | 'medium' | 'high'
  status: varchar('status', { length: 50 }).default('open').notNull(), // 'open' | 'in_progress' | 'completed' | 'dismissed'
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 12. Review Themes
export const reviewThemes = pgTable('review_themes', {
  id: uuid('id').defaultRandom().primaryKey(),
  competitorId: uuid('competitor_id').references(() => competitors.id, { onDelete: 'cascade' }),
  theme: text('theme').notNull(),
  sentiment: varchar('sentiment', { length: 20 }).notNull(), // 'positive' | 'negative' | 'neutral'
  frequency: integer('frequency').default(1).notNull(),
  examples: jsonb('examples'),
  sourceReference: text('source_reference'),
  observedAt: timestamp('observed_at', { withTimezone: true }).defaultNow().notNull(),
});

// 13. Reports
export const reports = pgTable('reports', {
  id: uuid('id').defaultRandom().primaryKey(),
  businessId: uuid('business_id')
    .references(() => businesses.id, { onDelete: 'cascade' })
    .notNull(),
  periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
  periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
  summary: jsonb('summary').notNull(),
  status: varchar('status', { length: 50 }).default('draft').notNull(), // 'draft' | 'published' | 'failed'
  pdfUrl: text('pdf_url'),
  generatedAt: timestamp('generated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 14. Recommendations
export const recommendations = pgTable('recommendations', {
  id: uuid('id').defaultRandom().primaryKey(),
  businessId: uuid('business_id')
    .references(() => businesses.id, { onDelete: 'cascade' })
    .notNull(),
  reportId: uuid('report_id').references(() => reports.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  description: text('description').notNull(),
  evidence: jsonb('evidence'),
  impact: varchar('impact', { length: 20 }).notNull(), // 'high' | 'medium' | 'low'
  effort: varchar('effort', { length: 20 }).notNull(), // 'low' | 'medium' | 'high'
  priority: varchar('priority', { length: 10 }).notNull(), // 'P0' | 'P1' | 'P2' | 'P3'
  confidence: varchar('confidence', { length: 20 }).notNull(), // 'high' | 'medium' | 'low'
  status: varchar('status', { length: 50 }).default('planned').notNull(), // 'planned' | 'in_progress' | 'completed' | 'dismissed'
  checklist: jsonb('checklist'), // { steps: string[]; completed: boolean[] }
  ownerId: varchar('owner_id', { length: 255 }).references(() => users.id, { onDelete: 'set null' }),
  dueDate: timestamp('due_date', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 15. Source Evidence
export const sourceEvidence = pgTable('source_evidence', {
  id: uuid('id').defaultRandom().primaryKey(),
  businessId: uuid('business_id')
    .references(() => businesses.id, { onDelete: 'cascade' })
    .notNull(),
  recommendationId: uuid('recommendation_id').references(() => recommendations.id, {
    onDelete: 'cascade',
  }),
  searchRunId: uuid('search_run_id').references(() => searchRuns.id, { onDelete: 'set null' }),
  sourceUrl: text('source_url').notNull(),
  sourceTitle: text('source_title'),
  claim: text('claim').notNull(),
  collectedAt: timestamp('collected_at', { withTimezone: true }).defaultNow().notNull(),
});

// 16. Notifications
export const notifications = pgTable('notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id')
    .references(() => workspaces.id, { onDelete: 'cascade' })
    .notNull(),
  reportId: uuid('report_id').references(() => reports.id, { onDelete: 'cascade' }),
  businessId: uuid('business_id').references(() => businesses.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 50 }).default('report_ready').notNull(), // 'report_ready' | 'stale_warning' | 'alert'
  channel: varchar('channel', { length: 50 }).default('email').notNull(), // 'email' | 'in_app'
  recipient: varchar('recipient', { length: 255 }).notNull(),
  subject: text('subject').notNull(),
  body: text('body'),
  status: varchar('status', { length: 50 }).default('sent').notNull(), // 'pending' | 'sent' | 'failed'
  externalId: varchar('external_id', { length: 255 }), // e.g. Resend ID
  sentAt: timestamp('sent_at', { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 17. Report Shares (Public Tokenized Links)
export const reportShares = pgTable('report_shares', {
  id: uuid('id').defaultRandom().primaryKey(),
  reportId: uuid('report_id')
    .references(() => reports.id, { onDelete: 'cascade' })
    .notNull(),
  businessId: uuid('business_id')
    .references(() => businesses.id, { onDelete: 'cascade' })
    .notNull(),
  shareToken: varchar('share_token', { length: 64 }).notNull().unique(),
  viewMode: varchar('view_mode', { length: 20 }).default('executive').notNull(), // 'executive' | 'specialist'
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 18. Market Alerts (Emergency Market Shifts)
export const marketAlerts = pgTable('market_alerts', {
  id: uuid('id').defaultRandom().primaryKey(),
  businessId: uuid('business_id')
    .references(() => businesses.id, { onDelete: 'cascade' })
    .notNull(),
  type: varchar('type', { length: 50 }).notNull(), // '3pack_displacement' | 'review_spike' | 'competitor_ads' | 'critical_rank_drop'
  severity: varchar('severity', { length: 20 }).default('critical').notNull(), // 'critical' | 'high' | 'medium'
  title: text('title').notNull(),
  description: text('description').notNull(),
  details: jsonb('details'),
  dismissed: boolean('dismissed').default(false).notNull(),
  detectedAt: timestamp('detected_at', { withTimezone: true }).defaultNow().notNull(),
});

// Relations
export const workspacesRelations = relations(workspaces, ({ many }) => ({
  users: many(users),
  businesses: many(businesses),
  notifications: many(notifications),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [notifications.workspaceId],
    references: [workspaces.id],
  }),
  report: one(reports, {
    fields: [notifications.reportId],
    references: [reports.id],
  }),
  business: one(businesses, {
    fields: [notifications.businessId],
    references: [businesses.id],
  }),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [users.workspaceId],
    references: [workspaces.id],
  }),
  assignedRecommendations: many(recommendations),
}));

export const businessesRelations = relations(businesses, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [businesses.workspaceId],
    references: [workspaces.id],
  }),
  locations: many(businessLocations),
  services: many(services),
  competitors: many(competitors),
  keywords: many(keywords),
  searchRuns: many(searchRuns),
  rankingObservations: many(rankingObservations),
  contentGaps: many(contentGaps),
  reports: many(reports),
  recommendations: many(recommendations),
  sourceEvidence: many(sourceEvidence),
  reportShares: many(reportShares),
  marketAlerts: many(marketAlerts),
}));

export const competitorsRelations = relations(competitors, ({ one, many }) => ({
  business: one(businesses, {
    fields: [competitors.businessId],
    references: [businesses.id],
  }),
  contentGaps: many(contentGaps),
  reviewThemes: many(reviewThemes),
}));

export const recommendationsRelations = relations(recommendations, ({ one, many }) => ({
  business: one(businesses, {
    fields: [recommendations.businessId],
    references: [businesses.id],
  }),
  report: one(reports, {
    fields: [recommendations.reportId],
    references: [reports.id],
  }),
  owner: one(users, {
    fields: [recommendations.ownerId],
    references: [users.id],
  }),
  evidence: many(sourceEvidence),
}));

export const reportsRelations = relations(reports, ({ one, many }) => ({
  business: one(businesses, {
    fields: [reports.businessId],
    references: [businesses.id],
  }),
  recommendations: many(recommendations),
  shares: many(reportShares),
}));

export const reportSharesRelations = relations(reportShares, ({ one }) => ({
  report: one(reports, {
    fields: [reportShares.reportId],
    references: [reports.id],
  }),
  business: one(businesses, {
    fields: [reportShares.businessId],
    references: [businesses.id],
  }),
}));

export const marketAlertsRelations = relations(marketAlerts, ({ one }) => ({
  business: one(businesses, {
    fields: [marketAlerts.businessId],
    references: [businesses.id],
  }),
}));

export const searchRunsRelations = relations(searchRuns, ({ one, many }) => ({
  business: one(businesses, {
    fields: [searchRuns.businessId],
    references: [businesses.id],
  }),
  results: many(searchResults),
  rankingObservations: many(rankingObservations),
}));
