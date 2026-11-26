import type { Table as DexieTable } from 'dexie';
import { db } from '../db';
import type { Workout, WorkoutItem, WorkoutSet } from '../types';

// Undo and redo for the open workout, as in Dumb Tasks: each step remembers how the rows it
// touched looked before and after, and undo or redo writes back only the fields it changed. A
// change made since to another field of the same row stays.
//
// A step is found by reading the whole workout (its row, exercises and sets) before and after
// the change - a workout is a few dozen rows, and no action has to list what it touches.

type Table = 'workouts' | 'items' | 'sets';
type Row = Workout | WorkoutItem | WorkoutSet;

interface Change {
  table: Table;
  id: string;
  before: Row | undefined; // undefined: the row didn't exist yet
  after: Row | undefined; // undefined: the row was deleted
  fields: string[]; // the fields that differ, or every field for a row made or deleted
}

interface Step {
  changes: Change[];
  typing: string | null; // the field typed in: key presses in one field add to one step
}

const LIMIT = 100;
const undoStack: Step[] = [];
const redoStack: Step[] = [];
let typingDone = true; // the next key press starts a new step
let applying = false; // undo or redo is letting go of the focused field

export const history = $state({ canUndo: false, canRedo: false });

// Changes with every edit of a workout, so on its own it isn't a change to undo
const IGNORED = new Set(['updatedAt']);

function refresh() {
  history.canUndo = undoStack.length > 0;
  history.canRedo = redoStack.length > 0;
}

/** Forgets every step: the history belongs to the workout on screen. */
export function clearHistory() {
  undoStack.length = 0;
  redoStack.length = 0;
  typingDone = true;
  refresh();
}

/** Ends the typing step: call when a field gets focus, so each visit to a field is one step. */
export function endTyping() {
  typingDone = true;
}

async function snapshot(workoutId: string): Promise<Map<string, { table: Table; row: Row }>> {
  const rows = new Map<string, { table: Table; row: Row }>();
  const workout = await db.workouts.get(workoutId);
  if (workout) rows.set(`workouts:${workout.id}`, { table: 'workouts', row: workout });
  const items = await db.items.where('workoutId').equals(workoutId).toArray();
  for (const row of items) rows.set(`items:${row.id}`, { table: 'items', row });
  const sets = await db.sets.where('itemId').anyOf(items.map((i) => i.id)).toArray();
  for (const row of sets) rows.set(`sets:${row.id}`, { table: 'sets', row });
  return rows;
}

function changedFields(before: Row | undefined, after: Row | undefined): string[] {
  if (!before || !after) return before === after ? [] : Object.keys((before ?? after)!);
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys].filter(
    (k) => !IGNORED.has(k) && JSON.stringify(before[k as keyof Row]) !== JSON.stringify(after[k as keyof Row]),
  );
}

function diff(
  before: Map<string, { table: Table; row: Row }>,
  after: Map<string, { table: Table; row: Row }>,
): Change[] {
  const changes: Change[] = [];
  for (const key of new Set([...before.keys(), ...after.keys()])) {
    const was = before.get(key);
    const now = after.get(key);
    const table = (was ?? now)!.table;
    const fields = changedFields(was?.row, now?.row);
    if (fields.length) changes.push({ table, id: (was ?? now)!.row.id, before: was?.row, after: now?.row, fields });
  }
  return changes;
}

/**
 * Runs a change to a workout and records it as one undo step. `typing` names the field being
 * typed in (e.g. "sets:<id>:weight"): key presses in it join the step before, until endTyping.
 * The action runs inside a database transaction, so it may only wait on the database.
 */
export async function edit<T>(workoutId: string, action: () => Promise<T>, typing: string | null = null): Promise<T> {
  // All in one transaction, so a change made meanwhile in another tab isn't taken for this one
  const { result, changes } = await db.transaction(
    'rw',
    [db.workouts, db.items, db.sets, db.exercises, db.settings],
    async () => {
      const before = await snapshot(workoutId);
      const result = await action();
      return { result, changes: diff(before, await snapshot(workoutId)) };
    },
  );
  if (changes.length) push({ changes, typing });
  return result;
}

function push(step: Step) {
  const top = undoStack.at(-1);
  if (step.typing && !typingDone && top?.typing === step.typing && !redoStack.length) {
    joinInto(top, step);
    if (!top.changes.length) undoStack.pop(); // typed back to how it was
  } else {
    undoStack.push(step);
    if (undoStack.length > LIMIT) undoStack.shift();
  }
  typingDone = !step.typing;
  redoStack.length = 0;
  refresh();
}

/** Adds a later step's changes to an earlier one: the earlier before, the later after. */
function joinInto(top: Step, step: Step) {
  for (const c of step.changes) {
    const same = top.changes.find((t) => t.table === c.table && t.id === c.id);
    if (!same) top.changes.push(c);
    else {
      same.after = c.after;
      same.fields = changedFields(same.before, same.after);
    }
  }
  top.changes = top.changes.filter((c) => c.fields.length);
}

async function apply(changes: Change[], to: 'before' | 'after') {
  await db.transaction('rw', db.workouts, db.items, db.sets, async () => {
    for (const c of changes) {
      const table = db[c.table] as unknown as DexieTable<Row, string>;
      const target = c[to];
      const current = await table.get(c.id);
      if (!target) await table.delete(c.id);
      else if (!current) await table.put(target);
      else await table.update(c.id, Object.fromEntries(c.fields.map((f) => [f, target[f as keyof Row]])));
    }
  });
}

/**
 * A field with focus shows what was typed: let it go, so it shows the undone value. A field
 * that saves when it's left (the exercise name) checks isLeavingForUndo and drops its edit.
 */
function leaveField() {
  if (typeof document === 'undefined' || !(document.activeElement instanceof HTMLElement)) return;
  applying = true;
  try {
    document.activeElement.blur();
  } finally {
    applying = false;
  }
}

/** True while undo or redo takes focus from a field: its unsaved edit goes, not saved. */
export function isLeavingForUndo(): boolean {
  return applying;
}

export async function undo() {
  const step = undoStack.pop();
  if (!step) return;
  leaveField();
  typingDone = true;
  await apply(step.changes, 'before');
  redoStack.push(step);
  refresh();
}

export async function redo() {
  const step = redoStack.pop();
  if (!step) return;
  leaveField();
  typingDone = true;
  await apply(step.changes, 'after');
  undoStack.push(step);
  refresh();
}
