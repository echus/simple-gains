import '../reset';
import { describe, expect, it } from 'vitest';
import { db } from '$lib/db';
import { addItem, deleteItem } from '$lib/workouts/items';
import { addSet } from '$lib/workouts/sets';
import {
  deleteWorkout,
  dropIfEmpty,
  finishWorkout,
  listWorkouts,
  loadWorkout,
  newWorkout,
  updateWorkout,
  workoutToResume,
} from '$lib/workouts/workouts';

const HOUR = 60 * 60 * 1000;

describe('newWorkout', () => {
  it('has the local date and time', async () => {
    // 23:30 local: toISOString would give the next day in a zone west of UTC, the same in UTC
    const at = new Date(2026, 10, 26, 23, 30);
    const workout = await db.workouts.get(await newWorkout(at));
    expect(workout).toMatchObject({ date: '2026-11-26', time: '23:30', name: '', notes: '', finishedAt: null });
  });
});

describe('workoutToResume', () => {
  it('is the unfinished workout started in the last 6 hours', async () => {
    const now = new Date(2026, 10, 26, 20, 0);
    const id = await newWorkout(new Date(now.getTime() - 2 * HOUR));
    expect((await workoutToResume(now))?.id).toBe(id);
  });

  it('is the newest when there are two', async () => {
    const now = new Date(2026, 10, 26, 20, 0);
    await newWorkout(new Date(now.getTime() - 3 * HOUR));
    const newer = await newWorkout(new Date(now.getTime() - HOUR));
    expect((await workoutToResume(now))?.id).toBe(newer);
  });

  it('is none once finished or older than 6 hours', async () => {
    const now = new Date(2026, 10, 26, 20, 0);
    const finished = await newWorkout(new Date(now.getTime() - HOUR));
    await finishWorkout(finished);
    await newWorkout(new Date(now.getTime() - 7 * HOUR));
    expect(await workoutToResume(now)).toBeUndefined();
  });

  it('finds a workout started before midnight', async () => {
    const now = new Date(2026, 10, 27, 1, 0);
    const id = await newWorkout(new Date(2026, 10, 26, 22, 0));
    expect((await workoutToResume(now))?.id).toBe(id);
  });
});

describe('dropIfEmpty', () => {
  it('deletes a workout with nothing in it', async () => {
    const id = await newWorkout();
    expect(await dropIfEmpty(id)).toBe(true);
    expect(await db.workouts.get(id)).toBeUndefined();
  });

  it('keeps a workout with an exercise, a name or a note', async () => {
    const withExercise = await newWorkout();
    await addItem(withExercise, 'Squat');
    const withName = await newWorkout();
    await updateWorkout(withName, { name: 'Legs' });
    const withNote = await newWorkout();
    await updateWorkout(withNote, { notes: 'Tired' });
    for (const id of [withExercise, withName, withNote]) expect(await dropIfEmpty(id)).toBe(false);
    expect(await db.workouts.count()).toBe(3);
  });
});

describe('addItem', () => {
  it('adds the exercise at the end with one blank set', async () => {
    const id = await newWorkout();
    await addItem(id, '  Bench   press ');
    await addItem(id, 'Lat pulldown');
    const loaded = await loadWorkout(id);
    expect(loaded!.items.map(({ item }) => item.nameAsTyped)).toEqual(['Bench press', 'Lat pulldown']);
    expect(loaded!.items[0].item.exerciseId).toBe('custom_bench_press');
    expect(loaded!.items[0].sets).toHaveLength(1);
    expect(loaded!.items[0].sets[0]).toMatchObject({ weight: null, reps: null, unit: 'kg', done: false });
  });

  it('refuses a blank name', async () => {
    await expect(addItem(await newWorkout(), '   ')).rejects.toThrow();
  });
});

describe('deleting', () => {
  it('takes an exercise with its sets', async () => {
    const id = await newWorkout();
    const itemId = await addItem(id, 'Squat');
    await addSet(itemId);
    await deleteItem(itemId);
    expect(await db.items.count()).toBe(0);
    expect(await db.sets.count()).toBe(0);
  });

  it('takes a workout with its exercises and sets, and leaves the others', async () => {
    const gone = await newWorkout();
    await addItem(gone, 'Squat');
    const kept = await newWorkout();
    await addItem(kept, 'Deadlift');
    await deleteWorkout(gone);
    expect(await loadWorkout(gone)).toBeUndefined();
    expect(await db.items.count()).toBe(1);
    expect(await db.sets.count()).toBe(1);
  });
});

describe('listWorkouts', () => {
  it('lists newest first with exercise names in order', async () => {
    const older = await newWorkout(new Date(2026, 10, 20, 18, 0));
    await addItem(older, 'Squat');
    await addItem(older, 'Deadlift');
    const newer = await newWorkout(new Date(2026, 10, 24, 7, 0));
    const list = await listWorkouts();
    expect(list.map((w) => w.workout.id)).toEqual([newer, older]);
    expect(list[1].exerciseNames).toEqual(['Squat', 'Deadlift']);
  });
});

describe('renameItem', () => {
  it('changes the typed name and the exercise, and leaves other workouts', async () => {
    const { renameItem } = await import('$lib/workouts/items');
    const first = await newWorkout();
    const kept = await addItem(first, 'Sqat');
    const renamed = await addItem(await newWorkout(), 'Sqat');
    await renameItem(renamed, ' Back  squat ');
    expect(await db.items.get(renamed)).toMatchObject({ nameAsTyped: 'Back squat', exerciseId: 'custom_back_squat' });
    expect(await db.items.get(kept)).toMatchObject({ nameAsTyped: 'Sqat', exerciseId: 'custom_sqat' });
  });
});
