import { describe, expect, it } from 'vitest';
import { exerciseColours } from '$lib/workouts/colours';

const hueOf = (colour: string) => Number(/^hsl\(([\d.]+) /.exec(colour)![1]);
const distance = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));

describe('exerciseColours', () => {
  it('gives an exercise the same colour in every workout', () => {
    const [squat] = exerciseColours(['custom_squat']);
    expect(exerciseColours(['custom_squat', 'custom_bench'])[0]).toBe(squat);
  });

  it('keeps neighbouring cards apart and in the fluoro range', () => {
    const ids = Array.from({ length: 40 }, (_, i) => `custom_exercise_${i}`);
    const hues = exerciseColours(ids).map(hueOf);
    for (const hue of hues) expect(hue >= 44 && hue <= 346).toBe(true);
    for (let i = 1; i < hues.length; i++) expect(distance(hues[i], hues[i - 1])).toBeGreaterThanOrEqual(60);
  });
});
