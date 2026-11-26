import { generateKeyBetween } from 'fractional-indexing';
import { ulid } from 'ulid';
import { db } from '../db';
import { defaultUnit } from '../settings';
import type { Unit, WorkoutSet } from '../types';
import { byPosition, positionAtEnd } from './order';

export function firstPosition(): string {
  return generateKeyBetween(null, null);
}

/** Adds a set at the end of an exercise: a copy of the last one, not done. Returns its id. */
export async function addSet(itemId: string): Promise<string> {
  return db.transaction('rw', db.sets, db.settings, async () => {
    const sets = (await db.sets.where('itemId').equals(itemId).toArray()).sort(byPosition);
    const last = sets.at(-1);
    const set: WorkoutSet = {
      id: ulid(),
      itemId,
      position: positionAtEnd(sets),
      weight: last?.weight ?? null,
      unit: last?.unit ?? (await defaultUnit()),
      reps: last?.reps ?? null,
      isWarmup: last?.isWarmup ?? false,
      done: false,
    };
    await db.sets.add(set);
    return set.id;
  });
}

export async function updateSet(
  id: string,
  changes: Partial<Pick<WorkoutSet, 'weight' | 'reps' | 'unit' | 'isWarmup' | 'done'>>,
): Promise<void> {
  await db.sets.update(id, changes);
}

export async function deleteSet(id: string): Promise<void> {
  await db.sets.delete(id);
}

/** Sets every set of an exercise to one unit. The numbers stay as typed. */
export async function setItemUnit(itemId: string, unit: Unit): Promise<void> {
  await db.sets.where('itemId').equals(itemId).modify({ unit });
}

/** What each set's number shows: W for a warm-up, and 1, 2, 3 for working sets without them. */
export function setLabels(sets: Pick<WorkoutSet, 'isWarmup'>[]): string[] {
  let n = 0;
  return sets.map((s) => (s.isWarmup ? 'W' : String(++n)));
}

/** Drops float noise, e.g. 0.1 + 0.2. Weights never need more than 3 decimals. */
function roundWeight(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * A typed number: null for a blank field, undefined for text that isn't a number yet (keep it
 * and don't write). A decimal comma and the minus sign − count.
 */
export function parseWeight(text: string): number | null | undefined {
  const t = text.trim().replace(',', '.').replace('−', '-');
  if (!t) return null;
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(t)) return undefined;
  return roundWeight(Number(t));
}

/** Typed reps: a whole number of 0 or more, null when blank, undefined for anything else. */
export function parseReps(text: string): number | null | undefined {
  const t = text.trim();
  if (!t) return null;
  if (!/^\d+$/.test(t)) return undefined;
  return Number(t);
}

/** A weight or reps for its field. Minus as typed, so it reads back the same. */
export function formatNumber(n: number | null): string {
  return n === null ? '' : String(n);
}
