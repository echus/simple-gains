import { ulid } from 'ulid';
import { db } from '../db';
import { exerciseForName } from '../exercises/custom';
import { defaultUnit } from '../settings';
import type { WorkoutItem, WorkoutSet } from '../types';
import { positionAtEnd } from './order';
import { firstPosition } from './sets';

/** Adds an exercise by name at the end of the workout, with one blank set. Returns its id. */
export async function addItem(workoutId: string, name: string): Promise<string> {
  const typed = name.trim().replace(/\s+/g, ' ');
  if (!typed) throw new Error('An exercise needs a name.');
  return db.transaction('rw', [db.exercises, db.items, db.sets, db.settings], async () => {
    const exercise = await exerciseForName(typed);
    const siblings = await db.items.where('workoutId').equals(workoutId).toArray();
    const item: WorkoutItem = {
      id: ulid(),
      workoutId,
      exerciseId: exercise.id,
      nameAsTyped: typed,
      position: positionAtEnd(siblings),
      notes: '',
    };
    const set: WorkoutSet = {
      id: ulid(),
      itemId: item.id,
      position: firstPosition(),
      weight: null,
      unit: await defaultUnit(),
      reps: null,
      isWarmup: false,
      done: false,
    };
    await db.items.add(item);
    await db.sets.add(set);
    return item.id;
  });
}

export async function updateItemNotes(id: string, notes: string): Promise<void> {
  await db.items.update(id, { notes });
}

/** Deletes an exercise from its workout, with its sets. */
export async function deleteItem(id: string): Promise<void> {
  await db.transaction('rw', db.items, db.sets, async () => {
    await db.sets.where('itemId').equals(id).delete();
    await db.items.delete(id);
  });
}

/**
 * Renames an exercise in a workout: the typed name and the exercise it points to. Other
 * workouts keep theirs. Until the picker (build step 3) the name decides the exercise.
 */
export async function renameItem(id: string, name: string): Promise<void> {
  const typed = name.trim().replace(/\s+/g, ' ');
  if (!typed) throw new Error('An exercise needs a name.');
  await db.transaction('rw', db.exercises, db.items, async () => {
    const exercise = await exerciseForName(typed);
    await db.items.update(id, { nameAsTyped: typed, exerciseId: exercise.id });
  });
}
