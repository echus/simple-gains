import { db } from '../db';
import type { Exercise } from '../types';

// Until the built-in list and matching come (build step 3), every typed name is a custom
// exercise of its own. Names that differ only in case or punctuation share one. No aliases are
// saved here: one saved now would later be an exact match that hides the built-in lift.

/** "Cable Y-raise" → "custom_cable_y_raise". */
export function customId(name: string): string {
  const snake = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `custom_${snake || 'exercise'}`;
}

/** The exercise for a typed name, created when there is none. Call inside a transaction. */
export async function exerciseForName(name: string): Promise<Exercise> {
  const id = customId(name);
  const existing = await db.exercises.get(id);
  if (existing) return existing;
  const exercise: Exercise = {
    id,
    displayName: name.trim(),
    movement: null,
    equipment: null,
    grip: null,
    angle: null,
    primaryMuscles: [],
    assisted: false,
    isCustom: true,
  };
  await db.exercises.add(exercise);
  return exercise;
}
