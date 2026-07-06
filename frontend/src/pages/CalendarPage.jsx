// CalendarPage.jsx — month calendar of events with a category filter (Owner: Member C).
// On desktop it shows the 7 column grid, mobile falls back to an agenda list (CSS-toggled).
// Days the viewer is participating in are displayed highlighted.

import { useState, useMemo } from 'react';
import dayjs from 'dayjs';
import { useApi } from '../api/hooks';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../lib/time';
import CategoryFilterBar from '../components/CategoryFilterBar';
import CalendarGrid from '../components/CalendarGrid';
import EventCard from '../components/EventCard';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';

export default function CalendarPage() {
  const { isAuthenticated } = useAuth();
  const [month, setMonth] = useState(() => dayjs().startOf('month'));
  const [category, setCategory] = useState(null);

  const monthKey = month.format('YYYY-MM');
  // Widen the range a day each side so UTC<->local edges near midnight aren't clipped.
  const from = month.startOf('month').subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss');
  const to = month.endOf('month').add(1, 'day').format('YYYY-MM-DD HH:mm:ss');
  const query = new URLSearchParams({ from, to });
  if (category) query.set('category', category);

  const { data, loading, error, refetch } = useApi(`/events?${query.toString()}`, [monthKey, category]);
  const mine = useApi('/events/me/participating', [], { enabled: isAuthenticated });

  const events = useMemo(() => data?.events || [], [data]);

  const eventsByDay = useMemo(() => {
    const map = new Map();
    for (const e of events) {
      const day = formatDate(e.startTime, 'YYYY-MM-DD'); // UTC -> viewer-local day
      if (!map.has(day)) map.set(day, []);
      map.get(day).push(e);
    }
    return map;
  }, [events]);

  const participatingDays = useMemo(() => {
    const set = new Set();
    for (const e of mine.data?.events || []) set.add(formatDate(e.startTime, 'YYYY-MM-DD'));
    return set;
  }, [mine.data]);

  const today = dayjs().format('YYYY-MM-DD');

  return (
    <section className="page">
      <div className="page__header">
        <h1 className="page__title">Calendar</h1>
        <div className="cal-nav">
          <button
            type="button"
            className="btn btn--small btn--ghost"
            aria-label="Previous month"
            onClick={() => setMonth((m) => m.subtract(1, 'month'))}
          >
            ‹
          </button>
          <button
            type="button"
            className="btn btn--small btn--ghost"
            onClick={() => setMonth(dayjs().startOf('month'))}
          >
            Today
          </button>
          <button
            type="button"
            className="btn btn--small btn--ghost"
            aria-label="Next month"
            onClick={() => setMonth((m) => m.add(1, 'month'))}
          >
            ›
          </button>
        </div>
      </div>

      <h2 className="cal-month">{month.format('MMMM YYYY')}</h2>
      <CategoryFilterBar value={category} onChange={setCategory} />

      {loading && <LoadingState label="Loading events…" />}
      {error && <ErrorState message={error} onRetry={refetch} />}
      {!loading && !error && (
        <>
          <div className="cal-desktop">
            <CalendarGrid
              month={month}
              eventsByDay={eventsByDay}
              participatingDays={participatingDays}
              today={today}
            />
          </div>
          <div className="cal-agenda">
            {events.length === 0 ? (
              <EmptyState title="No events this month" hint="Try another month or category." />
            ) : (
              events.map((e) => (
                <EventCard key={e.id} event={e} participantCount={e.participantCount} />
              ))
            )}
          </div>
        </>
      )}
    </section>
  );
}
