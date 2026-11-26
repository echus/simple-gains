import { generateKeyBetween } from 'fractional-indexing';

/**
 * Sorts by fractional index. Plain `<` on purpose: the keys compare by character code, and
 * localeCompare would order them by the user's language. Ties (two devices that moved rows
 * to the same spot) fall back to the id.
 */
export function byPosition<T extends { id: string; position: string }>(a: T, b: T): number {
  return a.position < b.position ? -1 : a.position > b.position ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** A position after every row given. */
export function positionAtEnd(rows: { position: string }[]): string {
  const last = rows.reduce<string | null>((max, r) => (max === null || r.position > max ? r.position : max), null);
  return generateKeyBetween(last, null);
}
