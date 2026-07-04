// time.js — timestamp helpers.
// SQLite stores `created_at` as 'YYYY-MM-DD HH:MM:SS' in UTC (via datetime('now')),
// with no timezone marker. dayjs would otherwise parse it as *local* time and show
// the wrong offset. Parse it as UTC, then render in the viewer's local timezone.
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(utc);
dayjs.extend(relativeTime);

// Relative time, e.g. "a few seconds ago".
export function fromNow(ts) {
  return dayjs.utc(ts).local().fromNow();
}

// Absolute date/time in the viewer's timezone, e.g. "Jul 4, 2026".
export function formatDate(ts, fmt = 'MMM D, YYYY') {
  return dayjs.utc(ts).local().format(fmt);
}
