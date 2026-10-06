import { NormalizedSearchResult, NormalizedMapsResult } from '@serp-scout/types';

export interface RawSearchItemWithContext {
  query: string;
  source: 'google' | 'google_maps';
  item: NormalizedSearchResult | NormalizedMapsResult;
}

export interface ExtractedCandidateDomain {
  domain: string;
  name: string;
  websiteUrl: string;
  mapsUrl?: string;
  address?: string;
  rating?: number;
  reviewsCount?: number;
  category?: string;
  bestRank: number;
  appearancesCount: number;
  queriesAppearedIn: string[];
  observedSnippets: string[];
  hasAds?: boolean;
  latitude?: number;
  longitude?: number;
}

export function extractDomain(url: string): string {
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    return parsed.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return url.replace(/^www\./, '').toLowerCase();
  }
}

export function extractCompetitorCandidates(
  items: RawSearchItemWithContext[],
  userWebsiteUrl?: string
): ExtractedCandidateDomain[] {
  const userDomain = userWebsiteUrl ? extractDomain(userWebsiteUrl) : '';
  const domainMap = new Map<string, ExtractedCandidateDomain>();

  for (const { query, source, item } of items) {
    let url = '';
    let name = item.title;
    let mapsUrl: string | undefined;
    let rating: number | undefined;
    let reviewsCount: number | undefined;
    let address: string | undefined;
    let category: string | undefined;
    let isAd = false;
    let latitude: number | undefined;
    let longitude: number | undefined;

    if (source === 'google') {
      const organic = item as NormalizedSearchResult;
      url = organic.url;
      isAd = !!organic.isAd || organic.serpFeatures?.includes('google_ads') || false;
      latitude = (organic.raw as any)?.gps_coordinates?.latitude;
      longitude = (organic.raw as any)?.gps_coordinates?.longitude;
    } else {
      const maps = item as NormalizedMapsResult;
      // Maps items reach this extractor in two shapes:
      //   1. the live SerpApi NormalizedMapsResult (`website`, `latitude`, ...)
      //   2. a row rehydrated from `search_results` by the discover route, which
      //      only carries the normalized `url` plus the untouched provider
      //      payload under `raw`.
      // Reading both matters: SerpApi's google_maps payload exposes the site as
      // `website` and never as `link`, so a row-shape-only lookup silently
      // discarded every 3-Pack candidate as "no website".
      const raw = (maps.raw ?? {}) as Record<string, any>;
      url = maps.website || (item as any).url || raw.website || raw.link || '';
      mapsUrl = raw.place_id_search || raw.link || undefined;
      rating = maps.rating;
      reviewsCount = maps.reviewsCount;
      address = maps.address;
      category = maps.category || raw.type || undefined;
      latitude = maps.latitude || raw.gps_coordinates?.latitude;
      longitude = maps.longitude || raw.gps_coordinates?.longitude;
    }

    if (!url) continue;

    const domain = extractDomain(url);
    if (!domain || (userDomain && domain === userDomain)) {
      continue; // Skip user's own domain or invalid domains
    }

    const snippet = (item as NormalizedSearchResult).snippet || address || '';

    if (domainMap.has(domain)) {
      const existing = domainMap.get(domain)!;
      existing.appearancesCount++;
      if (item.rank < existing.bestRank) existing.bestRank = item.rank;
      if (!existing.queriesAppearedIn.includes(query)) existing.queriesAppearedIn.push(query);
      if (snippet && !existing.observedSnippets.includes(snippet)) existing.observedSnippets.push(snippet);
      if (!existing.mapsUrl && mapsUrl) existing.mapsUrl = mapsUrl;
      if (!existing.rating && rating) existing.rating = rating;
      if (!existing.reviewsCount && reviewsCount) existing.reviewsCount = reviewsCount;
      if (!existing.category && category) existing.category = category;
      if (isAd) existing.hasAds = true;
      if (!existing.latitude && latitude) {
        existing.latitude = latitude;
        existing.longitude = longitude;
      }
    } else {
      domainMap.set(domain, {
        domain,
        name: name || domain,
        websiteUrl: url,
        mapsUrl,
        address,
        rating,
        reviewsCount,
        category,
        bestRank: item.rank,
        appearancesCount: 1,
        queriesAppearedIn: [query],
        observedSnippets: snippet ? [snippet] : [],
        hasAds: isAd,
        latitude,
        longitude,
      });
    }
  }

  // Sort by frequency of appearance desc, then best rank asc
  return Array.from(domainMap.values()).sort((a, b) => {
    if (b.appearancesCount !== a.appearancesCount) {
      return b.appearancesCount - a.appearancesCount;
    }
    return a.bestRank - b.bestRank;
  });
}
