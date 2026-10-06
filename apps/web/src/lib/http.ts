/**
 * Defensive JSON handling for browser calls to the API.
 *
 * Every request in the app goes through the Next dev rewrite (`/api/:path*` →
 * `NEXT_PUBLIC_API_URL`), so a response is not always ours: while the API is
 * starting, restarting (tsx watch reloads on every save), or briefly
 * unreachable, the hop in front answers with a plain-text 500 such as
 * "Internal Server Error". Calling `res.json()` on that throws the raw parser
 * error (`Unexpected token 'I', "Internal S"... is not valid JSON`), which then
 * surfaces to the user as if it were a credential problem.
 *
 * These helpers turn any response into a safe result object with a human
 * message, and retry the transient startup window.
 */

export interface ParsedApiResponse<T> {
  ok: boolean;
  status: number;
  data: T | null;
  /** Always a human-readable message — never a JSON parser error. */
  error: string | null;
  /** True when the server answered with something other than our JSON envelope. */
  nonJson: boolean;
}

interface ApiEnvelope<T> {
  success?: boolean;
  data?: T;
  error?: { code?: string; message?: string };
}

function describeNonJson(status: number, body: string): string {
  const snippet = body.trim().slice(0, 60);
  if (status >= 500) {
    return (
      `The API answered with HTTP ${status} but not JSON${snippet ? ` ("${snippet}")` : ''}. ` +
      'It is probably still starting up or restarting — wait a moment and try again.'
    );
  }
  if (status === 0) {
    return 'Could not reach the API server. Check that it is running on http://localhost:3001.';
  }
  return `Unexpected non-JSON response (HTTP ${status})${snippet ? `: ${snippet}` : ''}`;
}

/** Parses an API response, tolerating HTML/plain-text error bodies. */
export async function parseApiResponse<T>(res: Response): Promise<ParsedApiResponse<T>> {
  const contentType = res.headers.get('content-type') || '';
  const raw = await res.text();

  if (contentType.includes('application/json') && raw.trim().length > 0) {
    try {
      const body = JSON.parse(raw) as ApiEnvelope<T>;
      if (!res.ok || body?.success === false) {
        return {
          ok: false,
          status: res.status,
          data: null,
          error: body?.error?.message || `Request failed with status ${res.status}`,
          nonJson: false,
        };
      }
      return { ok: true, status: res.status, data: (body?.data ?? null) as T, error: null, nonJson: false };
    } catch {
      // Falls through to the non-JSON branch: a wrong content-type or a
      // truncated body must not reach the user as a parser error.
    }
  }

  return { ok: false, status: res.status, data: null, error: describeNonJson(res.status, raw), nonJson: true };
}

export interface FetchApiOptions extends RequestInit {
  /** Extra attempts when the server is not answering with JSON yet (default 2). */
  retries?: number;
  retryDelayMs?: number;
}

/**
 * `fetch` + `parseApiResponse`, retrying the narrow window where the API is not
 * yet serving JSON (proxy/plain-text 5xx) so a restarting dev server does not
 * look like a failed sign-in.
 */
export async function fetchApiJson<T>(
  url: string,
  options: FetchApiOptions = {}
): Promise<ParsedApiResponse<T>> {
  const { retries = 2, retryDelayMs = 700, ...init } = options;

  let last: ParsedApiResponse<T> | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, init);
      last = await parseApiResponse<T>(res);
      if (!last.nonJson || last.status < 500) return last;
    } catch (err: any) {
      // Network-level failure (API down): same retry budget as a plain-text 5xx.
      last = {
        ok: false,
        status: 0,
        data: null,
        error: `Could not reach the API server (${err?.message || 'network error'}). Is it running?`,
        nonJson: true,
      };
    }

    if (attempt < retries) await new Promise((r) => setTimeout(r, retryDelayMs * (attempt + 1)));
  }

  return last as ParsedApiResponse<T>;
}
