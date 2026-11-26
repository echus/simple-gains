import { liveQuery } from 'dexie';
import { noteFault } from '../db';
import { showUnreadable } from './status.svelte';

/**
 * Runs a query now and again whenever what it read changes, from any tab. For a component's
 * $effect: returns how to stop. A failed read shows the "can't read" message.
 */
export function watch<T>(query: () => Promise<T>, next: (value: T) => void): () => void {
  const sub = liveQuery(query).subscribe({
    next,
    error(e) {
      noteFault(e);
      showUnreadable(e);
    },
  });
  return () => sub.unsubscribe();
}
