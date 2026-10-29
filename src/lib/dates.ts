// Dates are calendar dates from content (no time of day), so format in UTC to
// avoid shifting a day in visitors' or builders' time zones.
const display = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

/** "26 Oct 2026", as in the brief's Steps example. */
export function formatDate(date: Date): string {
  return display.format(date);
}

/** "2026-10-26", for <time datetime> and structured data. */
export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
