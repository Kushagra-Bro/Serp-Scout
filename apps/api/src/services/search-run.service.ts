import { eq, desc, and, sql } from 'drizzle-orm';
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
import { searchTavily } from './tavily.service.js';
import { MarketShiftService } from './market-shift.service.js';
import { env } from '../config/env.js';

export interface ExecuteSearchOptions {
  businessId: string;
  workspaceId: string;
  searchType: 'google' | 'google_maps' | 'google_news';
  provider?: 'serpapi' | 'tavily' | 'auto';
  query: string;
  location?: string;
  language?: string;
  country?: string;
  device?: 'desktop' | 'mobile';
  num?: number;
}

function resolveCountryCode(country?: string): string {
  if (!country) return 'us';
  const c = country.trim().toLowerCase();
  if (c.length === 2) return c;
  const map: Record<string, string> = {
    india: 'in',
    'united states': 'us',
    usa: 'us',
    'united kingdom': 'uk',
    uk: 'uk',
    canada: 'ca',
    australia: 'au',
    germany: 'de',
    france: 'fr',
    singapore: 'sg',
    uae: 'ae',
    'united arab emirates': 'ae',
    netherlands: 'nl',
    spain: 'es',
    italy: 'it',
    brazil: 'br',
  };
  return map[c] || 'us';
}

export async function executeSearchRun(options: ExecuteSearchOptions) {
  const {
    businessId,
    workspaceId,
    searchType,
    provider = 'auto',
    query,
    location,
    language = 'en',
    country = 'us',
    device = 'desktop',
    num = 20,
  } = options;

  // 1. Verify workspace exists and check monthly quota
  const [workspace] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  if (!workspace) {
    throw new Error(`Workspace not found: ${workspaceId}`);
  }

  // Determine actual search provider
  // Tavily is used for organic searches when requested or available in 'auto' mode to save SerpApi tokens
  const canUseTavily = Boolean(env.TAVILY_API_KEY) && searchType !== 'google_maps';
  const actualProvider: 'serpapi' | 'tavily' =
    provider === 'tavily' && canUseTavily
      ? 'tavily'
      : provider === 'auto' && canUseTavily
      ? 'tavily'
      : 'serpapi';

  const costUnits = actualProvider === 'tavily' ? 0 : 1;

  if (costUnits > 0 && workspace.usedQuota >= workspace.monthlyQuota) {
    throw new Error(
      `Monthly search quota exceeded (${workspace.usedQuota}/${workspace.monthlyQuota} units used). Please upgrade or wait for the next billing cycle.`
    );
  }

  // 2. Verify business belongs to workspace
  const [business] = await db
    .select()
    .from(businesses)
    .where(and(eq(businesses.id, businessId), eq(businesses.workspaceId, workspaceId)))
    .limit(1);

  if (!business) {
    throw new Error(`Business ${businessId} not found in workspace ${workspaceId}`);
  }

  // 3. Create search_runs record with status 'pending'
  const [run] = await db
    .insert(searchRuns)
    .values({
      businessId,
      provider: actualProvider,
      searchType,
      query,
      location: location || business.city || undefined,
      language,
      device,
      costUnits,
      status: 'pending',
    })
    .returning();

  const resolvedCountry = options.country && options.country !== 'us'
    ? resolveCountryCode(options.country)
    : resolveCountryCode(business.country || country);

  try {
    let rawResults: any[] = [];
    const searchLocation = location || business.city || undefined;

    // Executes a single search against one concrete provider. Maps is always
    // SerpApi (Tavily has no Maps engine); organic/news can ride on either.
    const searchWithProvider = async (provider: 'serpapi' | 'tavily'): Promise<any[]> => {
      if (provider === 'tavily' && env.TAVILY_API_KEY) {
        const tavilyQuery = searchLocation && !query.toLowerCase().includes(searchLocation.toLowerCase())
          ? `${query} ${searchLocation}`
          : query;

        const tavilyResults = await searchTavily({
          query: tavilyQuery,
          apiKey: env.TAVILY_API_KEY,
          num,
        });

        return tavilyResults.map((r) => ({
          resultType: 'organic',
          rank: r.rank,
          title: r.title,
          url: r.url,
          domain: r.domain,
          businessName: r.title,
          snippet: r.snippet,
          serpFeatures: ['tavily_web'],
          rawReference: r.raw,
        }));
      }

      if (searchType === 'google') {
        const resp = await searchGoogle(
          { query, location: searchLocation, language, country: resolvedCountry, device, num },
          env.SERPAPI_KEY
        );
        return resp.results.map((r) => ({
          resultType: 'organic',
          rank: r.rank,
          title: r.title,
          url: r.url,
          domain: r.domain,
          businessName: r.title,
          snippet: r.snippet,
          serpFeatures: r.serpFeatures,
          rawReference: r.raw,
        }));
      }

      if (searchType === 'google_maps') {
        const mapsQuery = searchLocation && !query.toLowerCase().includes(searchLocation.toLowerCase())
          ? `${query} in ${searchLocation}`
          : query;

        const resp = await searchGoogleMaps(
          { query: mapsQuery, location: searchLocation, language },
          env.SERPAPI_KEY
        );
        return resp.results.map((m) => ({
          resultType: 'maps',
          rank: m.rank,
          title: m.title,
          url: m.website || m.raw?.link || '',
          domain: m.website ? new URL(m.website).hostname.replace(/^www\./, '') : '',
          businessName: m.title,
          snippet: m.address,
          rating: m.rating ? String(m.rating) : undefined,
          reviewCount: m.reviewsCount,
          locationText: m.address,
          rawReference: m.raw,
        }));
      }

      const resp = await searchGoogleNews(
        { query, language, country: resolvedCountry },
        env.SERPAPI_KEY
      );
      return resp.results.map((n) => ({
        resultType: 'news',
        rank: n.rank,
        title: n.title,
        url: n.link,
        domain: n.source,
        businessName: n.source,
        snippet: n.snippet,
        rawReference: n.raw,
      }));
    };

    // Cross-provider fallback: one provider being out of credits or hard
    // rate-limited must not take down every organic/news sweep. Retry once on
    // the other engine. Falling back onto SerpApi is only allowed while the
    // workspace meter still has room; falling back onto Tavily is always free.
    let finalProvider: 'serpapi' | 'tavily' = actualProvider;
    try {
      rawResults = await searchWithProvider(actualProvider);
    } catch (firstErr: any) {
      const fallback: 'serpapi' | 'tavily' =
        actualProvider === 'tavily' ? 'serpapi' : 'tavily';
      const fallbackAllowed =
        searchType !== 'google_maps' &&
        (actualProvider === 'tavily'
          ? workspace.usedQuota < workspace.monthlyQuota
          : Boolean(env.TAVILY_API_KEY));

      if (!fallbackAllowed) throw firstErr;

      console.warn(
        `[SearchRunService] ${actualProvider} search failed (${firstErr?.message ?? firstErr}); ` +
          `falling back to ${fallback}.`
      );
      try {
        rawResults = await searchWithProvider(fallback);
        finalProvider = fallback;
      } catch (secondErr) {
        // Surface the primary provider's error; it is usually the more
        // actionable one for the user.
        throw firstErr;
      }
    }

    // 5. Persist normalized results
    if (rawResults.length > 0) {
      await db.insert(searchResults).values(
        rawResults.map((item) => ({
          searchRunId: run.id,
          resultType: item.resultType || searchType,
          rank: item.rank,
          title: item.title,
          url: item.url,
          domain: item.domain || 'unknown',
          businessName: item.businessName,
          snippet: item.snippet,
          rating: item.rating ? String(item.rating) : undefined,
          reviewCount: item.reviewCount,
          locationText: item.locationText,
          rawReference: item.rawReference,
        }))
      );
    }

    // 6. Update search run status to 'completed' (record which provider really served)
    const finalCostUnits = finalProvider === 'tavily' ? 0 : 1;
    const [completedRun] = await db
      .update(searchRuns)
      .set({
        status: 'completed',
        provider: finalProvider,
        costUnits: finalCostUnits,
        completedAt: new Date(),
      })
      .where(eq(searchRuns.id, run.id))
      .returning();

    // 7. Increment workspace quota count atomically (only for paid providers)
    if (finalCostUnits > 0) {
      await db
        .update(workspaces)
        .set({
          usedQuota: sql`${workspaces.usedQuota} + ${finalCostUnits}`,
          updatedAt: new Date(),
        })
        .where(eq(workspaces.id, workspaceId));
    }

    // 8. Trigger background emergency market shift check
    MarketShiftService.analyzeBusiness(businessId).catch((err) => {
      console.warn(`[SearchRunService] Background market shift analysis notice:`, err);
    });

    return {
      run: completedRun,
      resultsCount: rawResults.length,
      results: rawResults,
    };
  } catch (err: any) {
    // On failure, preserve the search_run row with error message
    await db
      .update(searchRuns)
      .set({
        status: 'failed',
        errorMessage: err.message,
        completedAt: new Date(),
      })
      .where(eq(searchRuns.id, run.id));

    throw err;
  }
}

export async function listSearchRunsForBusiness(businessId: string, limit = 20) {
  return db
    .select()
    .from(searchRuns)
    .where(eq(searchRuns.businessId, businessId))
    .orderBy(desc(searchRuns.requestedAt))
    .limit(limit);
}

export async function getSearchRunDetails(runId: string) {
  const [run] = await db
    .select()
    .from(searchRuns)
    .where(eq(searchRuns.id, runId))
    .limit(1);

  if (!run) return null;

  const results = await db
    .select()
    .from(searchResults)
    .where(eq(searchResults.searchRunId, runId))
    .orderBy(searchResults.rank);

  return {
    ...run,
    results,
  };
}
