import { and, eq, sql } from 'drizzle-orm';
import {
  db,
  workspaces,
  businesses,
  searchRuns,
  searchResults,
} from '../db/index.js';
import {
  searchGoogle,
  searchGoogleMaps,
  searchGoogleNews,
} from '@serp-scout/serpapi';
import type { ResearchSearchGateway } from '@serp-scout/agents';
import type { NormalizedSearchResult, NormalizedNewsResult } from '@serp-scout/types';
import { searchTavily } from './tavily.service.js';
import { env } from '../config/env.js';
import { clampText } from '../lib/text.js';

/**
 * SerpApi-backed implementation of the research graph's search gateway.
 *
 * Every query is recorded as a `search_runs` row with its normalized results so
 * that change detection and ranking deltas keep working across graph runs, and
 * each paid query increments the workspace quota atomically.
 */
export class SerpApiResearchGateway implements ResearchSearchGateway {
  constructor(
    private readonly businessId: string,
    private readonly workspaceId: string,
    private readonly location?: string
  ) {}

  /** Throws before spending any tokens if the workspace is out of quota. */
  async assertQuotaAvailable(): Promise<void> {
    const [workspace] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, this.workspaceId))
      .limit(1);

    if (!workspace) {
      throw new Error(`Workspace not found: ${this.workspaceId}`);
    }
    if (workspace.usedQuota >= workspace.monthlyQuota) {
      throw new Error(
        `Monthly search quota exceeded (${workspace.usedQuota}/${workspace.monthlyQuota} units used).`
      );
    }
  }

  private async createRun(
    searchType: 'google' | 'google_maps' | 'google_news',
    query: string,
    provider: 'serpapi' | 'tavily' = 'serpapi'
  ): Promise<string> {
    const [run] = await db
      .insert(searchRuns)
      .values({
        businessId: this.businessId,
        provider,
        searchType,
        query,
        location: clampText(this.location, 255),
        costUnits: provider === 'tavily' ? 0 : 1,
        status: 'pending',
      })
      .returning();
    return run.id;
  }

  private async completeRun(
    runId: string,
    rows: Array<Record<string, any>>,
    provider: 'serpapi' | 'tavily' = 'serpapi'
  ): Promise<void> {
    if (rows.length > 0) {
      await db.insert(searchResults).values(
        rows.map((r) => ({
          searchRunId: runId,
          resultType: r.resultType,
          rank: r.rank,
          title: r.title,
          url: r.url,
          domain: clampText(r.domain || 'unknown', 255) || 'unknown',
          businessName: clampText(r.businessName, 255),
          snippet: r.snippet,
          rating: r.rating,
          reviewCount: r.reviewCount,
          locationText: r.locationText,
          rawReference: r.rawReference,
        }))
      );
    }

    await db
      .update(searchRuns)
      .set({
        status: 'completed',
        provider,
        costUnits: provider === 'tavily' ? 0 : 1,
        completedAt: new Date(),
      })
      .where(eq(searchRuns.id, runId));

    // Only paid SerpApi searches consume workspace meter units.
    if (provider !== 'tavily') {
      await db
        .update(workspaces)
        .set({
          usedQuota: sql`${workspaces.usedQuota} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(workspaces.id, this.workspaceId));
    }
  }

  private async failRun(runId: string, err: unknown): Promise<void> {
    await db
      .update(searchRuns)
      .set({
        status: 'failed',
        errorMessage: err instanceof Error ? err.message : String(err),
        completedAt: new Date(),
      })
      .where(eq(searchRuns.id, runId));
  }

  /**
   * Runs a SerpApi organic/news search, falling back to Tavily when SerpApi is
   * out of credits or hard rate-limited, so a single provider outage does not
   * take down the whole research pipeline. Tavily output is normalized into the
   * same result shapes the graph consumes.
   */
  private async searchOrganicOrNewsWithFallback(
    searchType: 'google' | 'google_news',
    query: string,
    opts?: { location?: string }
  ): Promise<{
    results: NormalizedSearchResult[] | NormalizedNewsResult[];
    provider: 'serpapi' | 'tavily';
    paaQuestions: string[];
  }> {
    try {
      const resp =
        searchType === 'google'
          ? await searchGoogle(
              { query, location: opts?.location || this.location },
              env.SERPAPI_KEY
            )
          : await searchGoogleNews({ query }, env.SERPAPI_KEY);
      return {
        results: resp.results,
        provider: 'serpapi',
        paaQuestions: searchType === 'google' ? (resp as any).paaQuestions ?? [] : [],
      };
    } catch (serpErr: any) {
      if (!env.TAVILY_API_KEY) throw serpErr;

      let tavilyResults: Awaited<ReturnType<typeof searchTavily>>;
      try {
        tavilyResults = await searchTavily({
          query,
          apiKey: env.TAVILY_API_KEY,
          num: 15,
        });
      } catch {
        // Both providers failed — surface the original SerpApi error.
        throw serpErr;
      }

      console.warn(
        `[SerpApiResearchGateway] ${searchType} via SerpApi failed (${serpErr?.message ?? serpErr}); serving from Tavily.`
      );

      const results: NormalizedSearchResult[] | NormalizedNewsResult[] =
        searchType === 'google'
          ? (tavilyResults.map((r) => ({
              rank: r.rank,
              title: r.title ?? '',
              url: r.url ?? '',
              domain: r.domain ?? '',
              snippet: r.snippet ?? '',
              serpFeatures: ['tavily_web'],
              raw: r.raw,
            })) as NormalizedSearchResult[])
          : (tavilyResults.map((r) => ({
              rank: r.rank,
              title: r.title ?? '',
              source: r.domain || r.url || 'news',
              link: r.url ?? '',
              snippet: r.snippet ?? '',
              raw: r.raw,
            })) as NormalizedNewsResult[]);

      return { results, provider: 'tavily', paaQuestions: [] };
    }
  }

  async searchOrganic(
    query: string,
    opts?: { location?: string }
  ): Promise<{
    results: Awaited<ReturnType<typeof searchGoogle>>['results'];
    paaQuestions: string[];
  }> {
    const runId = await this.createRun('google', query);
    try {
      const { results, provider, paaQuestions } = await this.searchOrganicOrNewsWithFallback('google', query, opts);
      const typed = results as NormalizedSearchResult[];
      await this.completeRun(
        runId,
        typed.map((r) => ({
          resultType: 'organic',
          rank: r.rank,
          title: r.title,
          url: r.url,
          domain: r.domain,
          businessName: r.title,
          snippet: r.snippet,
          rawReference: r.raw,
        })),
        provider
      );
      return { results: typed, paaQuestions };
    } catch (err) {
      await this.failRun(runId, err);
      throw err;
    }
  }

  async searchMaps(query: string, opts?: { location?: string }): Promise<{
    results: Awaited<ReturnType<typeof searchGoogleMaps>>['results'];
  }> {
    const runId = await this.createRun('google_maps', query);
    try {
      const resp = await searchGoogleMaps(
        { query, location: opts?.location || this.location },
        env.SERPAPI_KEY
      );
      await this.completeRun(
        runId,
        resp.results.map((m) => ({
          resultType: 'maps',
          rank: m.rank,
          title: m.title,
          url: m.website || (m.raw?.link as string) || '',
          domain: m.website ? m.website.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0] : 'unknown',
          businessName: m.title,
          snippet: m.address,
          rating: m.rating ? String(m.rating) : undefined,
          reviewCount: m.reviewsCount,
          locationText: m.address,
          rawReference: m.raw,
        }))
      );
      return { results: resp.results };
    } catch (err) {
      await this.failRun(runId, err);
      throw err;
    }
  }

  async searchNews(query: string): Promise<{
    results: Awaited<ReturnType<typeof searchGoogleNews>>['results'];
  }> {
    const runId = await this.createRun('google_news', query);
    try {
      const { results, provider } = await this.searchOrganicOrNewsWithFallback('google_news', query);
      const typed = results as NormalizedNewsResult[];
      await this.completeRun(
        runId,
        typed.map((n) => ({
          resultType: 'news',
          rank: n.rank,
          title: n.title,
          url: n.link,
          domain: n.source || 'news',
          businessName: n.source,
          snippet: n.snippet,
          rawReference: n.raw,
        })),
        provider
      );
      return { results: typed };
    } catch (err) {
      await this.failRun(runId, err);
      throw err;
    }
  }
}

/** Verifies the business belongs to the workspace before a run starts. */
export async function assertBusinessInWorkspace(
  businessId: string,
  workspaceId: string
): Promise<void> {
  const [biz] = await db
    .select({ id: businesses.id })
    .from(businesses)
    .where(and(eq(businesses.id, businessId), eq(businesses.workspaceId, workspaceId)))
    .limit(1);

  if (!biz) {
    throw new Error(`Business ${businessId} not found in workspace ${workspaceId}`);
  }
}
