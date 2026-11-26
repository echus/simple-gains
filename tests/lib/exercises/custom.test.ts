import '../reset';
import { describe, expect, it } from 'vitest';
import { db } from '$lib/db';
import { customId, exerciseForName } from '$lib/exercises/custom';

describe('customId', () => {
  it('is the name in snake case', () => {
    expect(customId('Cable Y-raise')).toBe('custom_cable_y_raise');
    expect(customId('  Pec   Deck  ')).toBe('custom_pec_deck');
    expect(customId('Café curl')).toBe('custom_cafe_curl');
  });

  it('has a name for a name with no letters or digits', () => {
    expect(customId('!!!')).toBe('custom_exercise');
  });
});

describe('exerciseForName', () => {
  it('gives names that differ only in case and punctuation one exercise', async () => {
    const a = await exerciseForName('Bench press');
    const b = await exerciseForName('bench-press');
    expect(b.id).toBe(a.id);
    expect(b.displayName).toBe('Bench press');
    expect(await db.exercises.count()).toBe(1);
  });

  it('makes a custom exercise with only a name', async () => {
    const e = await exerciseForName('Pec deck');
    expect(e).toMatchObject({ id: 'custom_pec_deck', isCustom: true, movement: null, primaryMuscles: [] });
  });

  it('saves no alias', async () => {
    await exerciseForName('RDL');
    expect(await db.aliases.count()).toBe(0);
  });
});
