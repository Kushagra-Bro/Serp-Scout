/**
 * Search provider error classification.
 *
 * Both upstream engines (SerpApi, Tavily) and the app's own workspace meter can
 * reject a search. Routes and workers need one consistent answer so they can
 * respond with the right status code:
 *
 *  - 'workspace-quota': the workspace's own monthly meter is exhausted — a 429
 *    the user can remedy by upgrading / waiting for the monthly reset.
 *  - 'provider-quota': an upstream provider (SerpApi or Tavily) is out of
 *    credits or rate-limiting — also surfaced as a 429, but distinct so the UI
 *    can suggest the other engine instead of asking for a plan upgrade.
 *  - 'other': everything else (auth, bad query, transient network, …).
 */
export type SearchErrorKind = 'workspace-quota' | 'provider-quota' | 'other';

export function classifySearchError(err: unknown): SearchErrorKind {
  const msg =
    err instanceof Error
      ? err.message
      : typeof err === 'object' && err !== null && 'message' in err
        ? String((err as { message: unknown }).message)
        : String(err ?? '');
  const low = msg.toLowerCase();

  // App-level meter (workspaces.monthlyQuota). Every message this app emits for
  // its own meter is anchored on the month ("Monthly search quota exceeded …",
  // "Monthly quota of 500 search units exceeded …") or the API error code.
  if (/monthly (search )?quota|monthly quota of \d+ search units|quota_exceeded/.test(low)) {
    return 'workspace-quota';
  }

  // Upstream provider credit exhaustion or a hard rate limit. Provider-named
  // messages win here even if they contain the words "quota exceeded".
  if (
    /out of credits|no credit|credit limit|insufficient (credit|balance)|credits? exhausted|ran out of credit/i.test(low) ||
    /(serpapi|tavily).*(429|quota exceeded|out of credit)|failed with status 429|http 429/i.test(low)
  ) {
    return 'provider-quota';
  }

  return 'other';
}

/** Human-readable provider name for an upstream quota failure, when known. */
export function providerNameFromError(err: unknown): 'Tavily' | 'SerpApi' | 'search provider' {
  const msg =
    err instanceof Error
      ? err.message
      : typeof err === 'object' && err !== null && 'message' in err
        ? String((err as { message: unknown }).message)
        : String(err ?? '');
  const low = msg.toLowerCase();
  if (low.includes('tavily')) return 'Tavily';
  if (low.includes('serpapi')) return 'SerpApi';
  return 'search provider';
}