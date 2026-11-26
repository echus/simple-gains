import Dexie, { type EntityTable } from 'dexie';
import type { Alias, Exercise, Setting, Workout, WorkoutItem, WorkoutSet } from './types';

// `exercises` holds custom exercises only: built-in ones ship in the code.
// `settings` is device-only and never exported or synced.
export const db = new Dexie('simple-gains') as Dexie & {
  exercises: EntityTable<Exercise, 'id'>;
  aliases: EntityTable<Alias, 'name'>;
  workouts: EntityTable<Workout, 'id'>;
  items: EntityTable<WorkoutItem, 'id'>;
  sets: EntityTable<WorkoutSet, 'id'>;
  settings: EntityTable<Setting, 'key'>;
};

// Installed apps have this data, so never edit a version once it's released. To change the
// tables or the shape of what's stored, add db.version(2).stores(...) with an .upgrade()
// that brings existing rows up to date.
db.version(1).stores({
  exercises: 'id',
  aliases: 'name, exerciseId',
  workouts: 'id, date',
  items: 'id, workoutId, exerciseId',
  sets: 'id, itemId',
  settings: 'key',
});

/** How long the database gets to answer before the app says it can't read the workouts. */
export const ANSWER_TIME = 10_000;

// How long each try at opening gets. Chrome on Android sometimes fails an open after a
// reload, or never answers it, and a later try works.
const OPEN_TRIES = [3_000, 6_000, 6_000];
const PAUSES = [500, 1_500]; // between tries: the longer wait gives a passing fault time to clear
// For all the tries together. An open that fails does so at once, so it gets all three; one
// that never answers uses the time up in two.
const OPEN_TIME = 10_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The promise's result, or an error once the database has taken too long: a browser whose
 * storage is in a bad state may never answer, rather than fail.
 */
export function inTime<T>(promise: PromiseLike<T>, ms = ANSWER_TIME): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`No answer from the database in ${ms / 1000} seconds.`)), ms);
    Promise.resolve(promise)
      .then(resolve, reject)
      .finally(() => clearTimeout(timer));
  });
}

/**
 * Opens the database, trying again when the browser fails the open or doesn't answer.
 * `onRetry` is called before each new try, for the app to say so.
 */
export async function openDatabase(
  tries = OPEN_TRIES,
  pauses = PAUSES,
  time = OPEN_TIME,
  onRetry = () => {},
): Promise<void> {
  const start = Date.now();
  const left = () => time - (Date.now() - start);
  for (const [i, ms] of tries.entries()) {
    try {
      await inTime(db.open(), Math.min(ms, left()));
      return;
    } catch (e) {
      noteFault(e);
      db.close(); // drops an open still waiting, so the next try starts afresh
      const pause = pauses[i] ?? 0;
      if (i === tries.length - 1 || left() <= pause) throw e;
      onRetry();
      await sleep(pause);
    }
  }
}

/**
 * Whether a newer version of the app (say, in another tab) has upgraded the database. Dexie
 * would open it anyway, but this copy mustn't touch it: it would write rows in the old shape.
 */
export async function isDatabaseNewer(onRetry?: () => void): Promise<boolean> {
  await openDatabase(undefined, undefined, undefined, onRetry);
  return db.backendDB().version / 10 > db.verno; // Dexie stores its version times ten
}

const FAULT = 'database-fault';

/**
 * Keeps the last time the database failed, with the browser's error: the app mostly gets
 * over it unseen, and this is then the only clue to the cause. Shown with the version.
 */
export function noteFault(error: unknown, now = new Date()) {
  const cause = (error as { inner?: unknown } | null)?.inner ?? error; // Dexie wraps the browser's
  const text = cause instanceof Error || cause instanceof DOMException ? `${cause.name}: ${cause.message}` : String(cause);
  try {
    localStorage.setItem(FAULT, `${now.toISOString()} ${text}`);
  } catch {
    // Not kept
  }
}

export function lastFault(): string | null {
  try {
    return localStorage.getItem(FAULT);
  } catch {
    return null;
  }
}
