import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { db, inTime, isDatabaseNewer, openDatabase } from '$lib/db';

describe('isDatabaseNewer', () => {
  it('is false for the version this app declares', async () => {
    expect(await isDatabaseNewer()).toBe(false);
  });

  it('is true once a newer version of the app has upgraded the database', async () => {
    db.close();
    const newer = new Dexie('simple-gains');
    newer.version(db.verno).stores({
      exercises: 'id',
      aliases: 'name, exerciseId',
      workouts: 'id, date',
      items: 'id, workoutId, exerciseId',
      sets: 'id, itemId',
      settings: 'key',
    });
    newer.version(db.verno + 1).stores({ workouts: 'id, date, finishedAt' });
    await newer.open();
    newer.close();

    expect(await isDatabaseNewer()).toBe(true);
  });
});

describe('inTime', () => {
  afterEach(() => vi.useRealTimers());

  it('passes on the result or the error of a database that answers', async () => {
    expect(await inTime(Promise.resolve(1))).toBe(1);
    await expect(inTime(Promise.reject(new Error('Blocked')))).rejects.toThrow('Blocked');
  });

  it('fails when the database never answers', async () => {
    vi.useFakeTimers();
    const result = inTime(new Promise(() => {}), 10_000);
    const failed = expect(result).rejects.toThrow('No answer from the database in 10 seconds.');
    await vi.advanceTimersByTimeAsync(10_000);
    await failed;
  });
});

describe('openDatabase', () => {
  afterEach(() => vi.restoreAllMocks());

  it('opens on a later try when the browser fails the first', async () => {
    db.close();
    const open = vi.spyOn(db, 'open').mockRejectedValueOnce(new Error('Internal error'));
    await openDatabase([1_000, 1_000], [0]);
    expect(open).toHaveBeenCalledTimes(2);
    expect(db.isOpen()).toBe(true);
  });

  it('opens on a later try when the browser gives no answer to the first', async () => {
    db.close();
    const open = vi.spyOn(db, 'open').mockReturnValueOnce(new Promise(() => {}) as never);
    await openDatabase([20, 1_000], [0]);
    expect(open).toHaveBeenCalledTimes(2);
    expect(db.isOpen()).toBe(true);
  });

  it('fails with the last error once every try has failed', async () => {
    db.close();
    const open = vi.spyOn(db, 'open').mockRejectedValue(new Error('Internal error'));
    await expect(openDatabase([1_000, 1_000, 1_000], [0, 0])).rejects.toThrow('Internal error');
    expect(open).toHaveBeenCalledTimes(3);
  });

  it('stops trying once its time is up, when the browser gives no answer', async () => {
    db.close();
    const open = vi.spyOn(db, 'open').mockReturnValue(new Promise(() => {}) as never);
    await expect(openDatabase([30, 60, 60], [5, 15], 100)).rejects.toThrow('No answer from the database');
    expect(open).toHaveBeenCalledTimes(2);
  });
});
