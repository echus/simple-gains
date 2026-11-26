import { db } from './db';
import { UNITS, type Unit } from './types';

/** The unit for a new set when there is no earlier set to copy. */
export async function defaultUnit(): Promise<Unit> {
  const row = await db.settings.get('unit');
  return UNITS.includes(row?.value as Unit) ? (row!.value as Unit) : 'kg';
}
