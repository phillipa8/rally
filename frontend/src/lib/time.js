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

// Convert a browser <input type="datetime-local"> value (local wall-clock,
// 'YYYY-MM-DDTHH:mm') to the UTC 'YYYY-MM-DD HH:MM:SS' string the API stores,
// keeping event times consistent with the UTC-in-storage convention above.
export function toSqlUtc(localInput) {
  return dayjs(localInput).utc().format('YYYY-MM-DD HH:mm:ss');
}

// Inverse of toSqlUtc: a stored UTC timestamp -> the local value a
// datetime-local input expects ('YYYY-MM-DDTHH:mm'), for pre-filling edit forms.
export function toDatetimeLocal(ts) {
  return dayjs.utc(ts).local().format('YYYY-MM-DDTHH:mm');
}

// Current local wall-clock in the datetime-local input format, for checking
// if an event's start time is not in the past.
export function nowDatetimeLocal() {
  return dayjs().format('YYYY-MM-DDTHH:mm');
}
