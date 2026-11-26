import '../reset';
import { describe, expect, it } from 'vitest';
import { db } from '$lib/db';
import { addItem } from '$lib/workouts/items';
import { byPosition } from '$lib/workouts/order';
import {
  addSet,
  formatNumber,
  parseReps,
  parseWeight,
  setItemUnit,
  setLabels,
  updateSet,
} from '$lib/workouts/sets';
import { newWorkout } from '$lib/workouts/workouts';

describe('setLabels', () => {
  it('numbers working sets without the warm-ups', () => {
    const sets = [true, true, false, false, true, false].map((isWarmup) => ({ isWarmup }));
    expect(setLabels(sets)).toEqual(['W', 'W', '1', '2', 'W', '3']);
  });
});

describe('parseWeight', () => {
  it.each([
    ['60', 60],
    ['62.5', 62.5],
    ['62,5', 62.5],
    ['-20', -20],
    ['−20', -20],
    ['62.', 62],
    ['.5', 0.5],
    [' 40 ', 40],
  ])('reads %j as %j', (text, weight) => {
    expect(parseWeight(text)).toBe(weight);
  });

  it('is null for a blank field', () => {
    expect(parseWeight('')).toBeNull();
    expect(parseWeight('  ')).toBeNull();
  });

  it('is undefined for text that is not a number yet', () => {
    for (const text of ['-', '.', 'abc', '6o', '1.2.3']) expect(parseWeight(text)).toBeUndefined();
  });
});

describe('parseReps', () => {
  it('reads whole numbers only', () => {
    expect(parseReps('8')).toBe(8);
    expect(parseReps('')).toBeNull();
    expect(parseReps('8.5')).toBeUndefined();
    expect(parseReps('-1')).toBeUndefined();
  });
});

describe('formatNumber', () => {
  it('shows a blank for null', () => {
    expect(formatNumber(null)).toBe('');
    expect(formatNumber(62.5)).toBe('62.5');
  });
});

describe('addSet', () => {
  async function anItem() {
    return addItem(await newWorkout(), 'Bench press');
  }

  const setsOf = async (itemId: string) => (await db.sets.where('itemId').equals(itemId).toArray()).sort(byPosition);

  it('copies the last set, not done', async () => {
    const itemId = await anItem();
    const [first] = await setsOf(itemId);
    await updateSet(first.id, { weight: 60, reps: 8, unit: 'lb', isWarmup: true, done: true });
    await addSet(itemId);
    const [, second] = await setsOf(itemId);
    expect(second).toMatchObject({ weight: 60, reps: 8, unit: 'lb', isWarmup: true, done: false });
  });

  it('adds each set after the last', async () => {
    const itemId = await anItem();
    const ids = [await addSet(itemId), await addSet(itemId), await addSet(itemId)];
    const sets = await setsOf(itemId);
    expect(sets.slice(1).map((s) => s.id)).toEqual(ids);
  });

  it('is blank in the default unit for an exercise with no sets', async () => {
    const itemId = await anItem();
    await db.sets.where('itemId').equals(itemId).delete();
    await db.settings.put({ key: 'unit', value: 'lb' });
    await addSet(itemId);
    expect((await setsOf(itemId))[0]).toMatchObject({ weight: null, reps: null, unit: 'lb' });
  });
});

describe('setItemUnit', () => {
  it('switches every set of the exercise and keeps the numbers', async () => {
    const itemId = await addItem(await newWorkout(), 'Leg press');
    const [first] = await db.sets.where('itemId').equals(itemId).toArray();
    await updateSet(first.id, { weight: 100 });
    await addSet(itemId);
    await setItemUnit(itemId, 'lb');
    const sets = await db.sets.where('itemId').equals(itemId).toArray();
    expect(sets.map((s) => [s.unit, s.weight])).toEqual([
      ['lb', 100],
      ['lb', 100],
    ]);
  });
});
