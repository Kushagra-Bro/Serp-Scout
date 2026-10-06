export interface TavilySearchResult {
  rank: number;
  title: string;
  url: string;
  domain: string;
  snippet: string;
  score?: number;
  raw?: Record<string, any>;
}

export interface TavilySearchOptions {
  query: string;
  apiKey: string;
  num?: number;
  searchDepth?: 'basic' | 'advanced';
}

/**
 * Executes a search query using the Tavily Search API.
 * Returns normalized search results suitable for candidate extraction and research.
 */
export async function searchTavily(
  options: TavilySearchOptions
): Promise<TavilySearchResult[]> {
  const { query, apiKey, num = 15, searchDepth = 'basic' } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000); // 12-second timeout

  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: searchDepth,
        max_results: Math.min(num, 20),
        include_images: false,
        include_answer: false,
      }),
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Tavily API responded with HTTP ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as { results?: Array<{ title?: string; url?: string; content?: string; score?: number; [key: string]: any }> };
    const results: TavilySearchResult[] = [];

    if (Array.isArray(data.results)) {
      for (let i = 0; i < data.results.length; i++) {
        const item = data.results[i];
        let domain = '';
        try {
          domain = new URL(item.url || '').hostname.replace(/^www\./, '');
        } catch {
          // Never fall back to the raw URL: `domain` is stored in a varchar(255)
          // column (an over-long URL overflows the insert and kills the whole
          // run) and a URL is not a domain for rank matching either.
          domain = (item.url || '')
            .replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
            .split('/')[0]
            .split('?')[0]
            .replace(/^www\./, '');
        }

        results.push({
          rank: i + 1,
          title: item.title || '',
          url: item.url || '',
          domain,
          snippet: item.content || '',
          score: item.score,
          raw: item,
        });
      }
    }

    return results;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error(`Tavily search timed out for query: "${query}"`);
    }
    throw err;
  }
}
