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
import { env } from '../config/env.js';

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
    query: string
  ): Promise<string> {
    const [run] = await db
      .insert(searchRuns)
      .values({
        businessId: this.businessId,
        provider: 'serpapi',
        searchType,
        query,
        location: this.location,
        costUnits: 1,
        status: 'pending',
      })
      .returning();
    return run.id;
  }

  private async completeRun(
    runId: string,
    rows: Array<Record<string, any>>
  ): Promise<void> {
    if (rows.length > 0) {
      await db.insert(searchResults).values(
        rows.map((r) => ({
          searchRunId: runId,
          resultType: r.resultType,
          rank: r.rank,
          title: r.title,
          url: r.url,
          domain: r.domain || 'unknown',
          businessName: r.businessName,
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
      .set({ status: 'completed', completedAt: new Date() })
      .where(eq(searchRuns.id, runId));

    await db
      .update(workspaces)
      .set({
        usedQuota: sql`${workspaces.usedQuota} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(workspaces.id, this.workspaceId));
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

  async searchOrganic(
    query: string,
    opts?: { location?: string }
  ): Promise<{
    results: Awaited<ReturnType<typeof searchGoogle>>['results'];
    paaQuestions: string[];
  }> {
    const runId = await this.createRun('google', query);
    try {
      const resp = await searchGoogle(
        { query, location: opts?.location || this.location },
        env.SERPAPI_KEY
      );
      await this.completeRun(
        runId,
        resp.results.map((r) => ({
          resultType: 'organic',
          rank: r.rank,
          title: r.title,
          url: r.url,
          domain: r.domain,
          businessName: r.title,
          snippet: r.snippet,
          rawReference: r.raw,
        }))
      );
      return { results: resp.results, paaQuestions: resp.paaQuestions };
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
      const resp = await searchGoogleNews({ query }, env.SERPAPI_KEY);
      await this.completeRun(
        runId,
        resp.results.map((n) => ({
          resultType: 'news',
          rank: n.rank,
          title: n.title,
          url: n.link,
          domain: n.source || 'news',
          businessName: n.source,
          snippet: n.snippet,
          rawReference: n.raw,
        }))
      );
      return { results: resp.results };
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
