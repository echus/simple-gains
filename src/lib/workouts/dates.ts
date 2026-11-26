const pad = (n: number) => String(n).padStart(2, '0');

/** YYYY-MM-DD in local time. toISOString would give the day in UTC. */
export function localDate(at: Date): string {
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
}

/** HH:MM in local time. */
export function localTime(at: Date): string {
  return `${pad(at.getHours())}:${pad(at.getMinutes())}`;
}

/** A stored YYYY-MM-DD as a local date, e.g. "Thu 26 Nov", with the year when it isn't this one. */
export function formatDate(date: string, now = new Date()): string {
  const [y, m, d] = date.split('-').map(Number);
  const day = new Date(y, m - 1, d);
  return day.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(y !== now.getFullYear() && { year: 'numeric' }),
  });
}

/** A stored HH:MM in the browser's own style, e.g. "6:05 pm" or "18:05". */
export function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** Time since the start in whole minutes, e.g. "0 mins", "1 min", "20 mins", "1 hr 5 mins". */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 60_000));
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  const minText = `${mins} ${mins === 1 ? 'min' : 'mins'}`;
  if (!hours) return minText;
  return mins ? `${hours} hr ${minText}` : `${hours} hr`;
}
