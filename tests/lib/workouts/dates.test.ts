import { describe, expect, it } from 'vitest';
import { formatElapsed, formatTime, localDate, localTime } from '$lib/workouts/dates';

const MIN = 60_000;

describe('formatElapsed', () => {
  it.each([
    [0, '0 mins'],
    [59_999, '0 mins'],
    [MIN, '1 min'],
    [20 * MIN + 59_000, '20 mins'],
    [60 * MIN, '1 hr'],
    [61 * MIN, '1 hr 1 min'],
    [125 * MIN, '2 hr 5 mins'],
  ])('shows %i ms as %j', (ms, text) => {
    expect(formatElapsed(ms)).toBe(text);
  });

  it('shows 0 for a start a moment ahead, as a clock that is a little off gives', () => {
    expect(formatElapsed(-5_000)).toBe('0 mins');
  });
});

describe('formatTime', () => {
  it("shows the time in the browser's own style", () => {
    const expected = new Date(2000, 0, 1, 18, 5).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    expect(formatTime('18:05')).toBe(expected);
  });
});

describe('localDate and localTime', () => {
  it('use local time', () => {
    const at = new Date(2026, 0, 2, 3, 4);
    expect(localDate(at)).toBe('2026-01-02');
    expect(localTime(at)).toBe('03:04');
  });
});
