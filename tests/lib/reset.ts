import 'fake-indexeddb/auto';
import { beforeEach } from 'vitest';
import { db } from '$lib/db';

// Every test starts on an empty database
beforeEach(async () => {
  if (!db.isOpen()) await db.open();
  await Promise.all(db.tables.map((t) => t.clear()));
});
