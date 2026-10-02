/**
 * Website URL normalization for duplicate-business detection.
 *
 * Users enter the same site in many shapes (`https://Example.com/`,
 * `http://www.example.com`, `example.com/#team`), so a raw string comparison
 * misses real duplicates. This produces a stable comparison key.
 *
 * Deliberately conservative: the path is kept (so `/about` is not treated as
 * the homepage), and only the fragment is dropped.
 */
export function normalizeWebsiteUrl(rawUrl: string): string {
  if (!rawUrl) return '';

  let value = rawUrl.trim().toLowerCase();

  // Drop the fragment — it never identifies a different page for our purposes.
  const hashIndex = value.indexOf('#');
  if (hashIndex !== -1) value = value.slice(0, hashIndex);

  // Strip the scheme so http/https/www variants compare equal.
  value = value.replace(/^https?:\/\//, '');

  // Strip a leading `www.` — it is almost always the same site.
  value = value.replace(/^www\./, '');

  // Drop a trailing slash (but preserve a bare `/` path).
  if (value.length > 1 && value.endsWith('/')) {
    value = value.replace(/\/+$/, '');
  }

  return value;
}

/** True when two website URLs refer to the same site. */
export function isSameWebsiteUrl(a: string, b: string): boolean {
  const left = normalizeWebsiteUrl(a);
  const right = normalizeWebsiteUrl(b);
  return left.length > 0 && left === right;
}
