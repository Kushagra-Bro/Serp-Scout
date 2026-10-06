/**
 * Postgres `varchar(n)` columns reject over-long values outright, and the text
 * we write into them comes from search providers and LLMs, which are unbounded.
 * One long page title must never abort a whole search or ranking sweep, so every
 * externally-sourced string destined for a bounded column goes through here.
 */
export function clampText(
  value: string | null | undefined,
  maxLength: number
): string | undefined {
  if (value === null || value === undefined) return undefined;
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}
