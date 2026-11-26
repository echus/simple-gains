import { ulid } from 'ulid';
import { db } from '../db';
import type { Workout, WorkoutItem, WorkoutSet } from '../types';
import { localDate, localTime } from './dates';
import { byPosition } from './order';

/** How long after its start an unfinished workout is still the one the app opens into. */
export const RESUME_WITHIN = 6 * 60 * 60 * 1000;

/** A blank workout for now. Returns its id. */
export async function newWorkout(now = new Date()): Promise<string> {
  const at = now.toISOString();
  const workout: Workout = {
    id: ulid(now.getTime()),
    date: localDate(now),
    time: localTime(now),
    name: '',
    notes: '',
    finishedAt: null,
    createdAt: at,
    updatedAt: at,
  };
  await db.workouts.add(workout);
  return workout.id;
}

export async function updateWorkout(
  id: string,
  changes: Partial<Pick<Workout, 'name' | 'notes' | 'date' | 'time'>>,
  now = new Date(),
): Promise<void> {
  await db.workouts.update(id, { ...changes, updatedAt: now.toISOString() });
}

export async function finishWorkout(id: string, now = new Date()): Promise<void> {
  const at = now.toISOString();
  await db.workouts.update(id, { finishedAt: at, updatedAt: at });
}

/** Deletes a workout with its exercises and sets. */
export async function deleteWorkout(id: string): Promise<void> {
  await db.transaction('rw', db.workouts, db.items, db.sets, async () => {
    const itemIds = await db.items.where('workoutId').equals(id).primaryKeys();
    await db.sets.where('itemId').anyOf(itemIds).delete();
    await db.items.bulkDelete(itemIds);
    await db.workouts.delete(id);
  });
}

/**
 * Deletes a workout that was opened and left with nothing in it, so stray taps on New don't
 * fill the list. Returns whether it did.
 */
export async function dropIfEmpty(id: string): Promise<boolean> {
  return db.transaction('rw', db.workouts, db.items, async () => {
    const workout = await db.workouts.get(id);
    if (!workout || workout.name.trim() || workout.notes.trim()) return false;
    if ((await db.items.where('workoutId').equals(id).count()) > 0) return false;
    await db.workouts.delete(id);
    return true;
  });
}

/** The unfinished workout started in the last 6 hours, if any: the app opens into it. */
export async function workoutToResume(now = new Date()): Promise<Workout | undefined> {
  const since = now.getTime() - RESUME_WITHIN;
  const recent = await db.workouts
    .where('date')
    .aboveOrEqual(localDate(new Date(since)))
    .filter((w) => !w.finishedAt && Date.parse(w.createdAt) >= since && Date.parse(w.createdAt) <= now.getTime())
    .toArray();
  return recent.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
}

export interface LoadedItem {
  item: WorkoutItem;
  sets: WorkoutSet[];
}

export interface LoadedWorkout {
  workout: Workout;
  items: LoadedItem[];
}

/** A workout with its exercises and sets in order, or undefined once it's gone. */
export async function loadWorkout(id: string): Promise<LoadedWorkout | undefined> {
  return db.transaction('r', db.workouts, db.items, db.sets, async () => {
    const workout = await db.workouts.get(id);
    if (!workout) return undefined;
    const items = (await db.items.where('workoutId').equals(id).toArray()).sort(byPosition);
    const sets = await db.sets.where('itemId').anyOf(items.map((i) => i.id)).toArray();
    return {
      workout,
      items: items.map((item) => ({ item, sets: sets.filter((s) => s.itemId === item.id).sort(byPosition) })),
    };
  });
}

export interface WorkoutSummary {
  workout: Workout;
  exerciseNames: string[];
}

/** Newest first: by date, then time, then when it was made. */
export function byNewest(a: Workout, b: Workout): number {
  const ka = `${a.date} ${a.time ?? ''} ${a.createdAt}`;
  const kb = `${b.date} ${b.time ?? ''} ${b.createdAt}`;
  return ka < kb ? 1 : ka > kb ? -1 : 0;
}

/** Every workout newest first, with the names of its exercises in order. */
export async function listWorkouts(): Promise<WorkoutSummary[]> {
  return db.transaction('r', db.workouts, db.items, async () => {
    const [workouts, items] = await Promise.all([db.workouts.toArray(), db.items.toArray()]);
    const byWorkout = new Map<string, WorkoutItem[]>();
    for (const item of items) byWorkout.set(item.workoutId, [...(byWorkout.get(item.workoutId) ?? []), item]);
    return workouts.sort(byNewest).map((workout) => ({
      workout,
      exerciseNames: (byWorkout.get(workout.id) ?? []).sort(byPosition).map((i) => i.nameAsTyped),
    }));
  });
}
