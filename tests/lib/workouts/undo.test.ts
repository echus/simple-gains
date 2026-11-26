import '../reset';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '$lib/db';
import { clearHistory, edit, endTyping, history, redo, undo } from '$lib/workouts/undo.svelte';
import { addItem, deleteItem } from '$lib/workouts/items';
import { addSet, updateSet } from '$lib/workouts/sets';
import { newWorkout, updateWorkout } from '$lib/workouts/workouts';

beforeEach(clearHistory);

async function aWorkout() {
  const workoutId = await newWorkout();
  const itemId = await addItem(workoutId, 'Squat');
  const [set] = await db.sets.where('itemId').equals(itemId).toArray();
  return { workoutId, itemId, setId: set.id };
}

describe('undo and redo', () => {
  it('take back an added set and put it back', async () => {
    const { workoutId, itemId } = await aWorkout();
    const id = await edit(workoutId, () => addSet(itemId));
    expect(history.canUndo).toBe(true);

    await undo();
    expect(await db.sets.get(id)).toBeUndefined();
    expect(history).toEqual({ canUndo: false, canRedo: true });

    await redo();
    expect(await db.sets.get(id)).toBeDefined();
  });

  it('bring back a deleted exercise with its sets and their ids', async () => {
    const { workoutId, itemId, setId } = await aWorkout();
    await updateSet(setId, { weight: 100, reps: 5 });
    await edit(workoutId, () => deleteItem(itemId));
    await undo();
    expect(await db.items.get(itemId)).toMatchObject({ nameAsTyped: 'Squat' });
    expect(await db.sets.get(setId)).toMatchObject({ weight: 100, reps: 5 });
  });

  it('make one step of the key presses in one visit to a field', async () => {
    const { workoutId, setId } = await aWorkout();
    endTyping(); // the field gets focus
    for (const weight of [1, 10, 100]) {
      await edit(workoutId, () => updateSet(setId, { weight }), `sets:${setId}:weight`);
    }
    await undo();
    expect((await db.sets.get(setId))!.weight).toBeNull();
    expect(history.canUndo).toBe(false);
  });

  it('make a new step for each visit to a field', async () => {
    const { workoutId, setId } = await aWorkout();
    const type = (weight: number) => edit(workoutId, () => updateSet(setId, { weight }), `sets:${setId}:weight`);
    endTyping();
    await type(60);
    endTyping();
    await type(80);
    await undo();
    expect((await db.sets.get(setId))!.weight).toBe(60);
  });

  it('keep a field changed since that the step did not touch', async () => {
    const { workoutId, setId } = await aWorkout();
    await edit(workoutId, () => updateSet(setId, { weight: 60 }));
    await updateSet(setId, { reps: 8 }); // say, in another tab
    await undo();
    expect(await db.sets.get(setId)).toMatchObject({ weight: null, reps: 8 });
  });

  it('do not count a workout edit that only moves updatedAt', async () => {
    const { workoutId } = await aWorkout();
    await edit(workoutId, () => updateWorkout(workoutId, {}));
    expect(history.canUndo).toBe(false);
  });

  it('forget the redo after a new change', async () => {
    const { workoutId, setId } = await aWorkout();
    await edit(workoutId, () => updateSet(setId, { done: true }));
    await undo();
    await edit(workoutId, () => updateSet(setId, { reps: 3 }));
    expect(history.canRedo).toBe(false);
  });
});
