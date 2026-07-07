// Calendar.jsx — reusable month calendar module consisting of events with a category filter (Owner: Member C).
// Embeddable (no page chrome): its own month toolbar + filter, a 7 column grid,
// plus a compact agenda list on mobile. Highlights days the viewer is attending.
// Tapping a day switches the focus to that day and tapping it again reverts to the month.

import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import { useApi } from '../api/hooks';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../lib/time';
import CategoryFilterBar from './CategoryFilterBar';
import CalendarGrid from './CalendarGrid';
import LoadingState from './LoadingState';
import ErrorState from './ErrorState';
import EmptyState from './EmptyState';

export default function Calendar() {
  const { isAuthenticated } = useAuth();
  const [month, setMonth] = useState(() => dayjs().startOf('month'));
  const [category, setCategory] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null); // 'YYYY-MM-DD' agenda scope, or null for the whole month

  // A selected day belongs to the shown month, so month navigation clears it.
  const changeMonth = (next) => {
    setMonth(next);
    setSelectedDay(null);
  };
  const toggleDay = (day) => setSelectedDay((d) => (d === day ? null : day));

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
  const agendaEvents = selectedDay ? eventsByDay.get(selectedDay) || [] : events;

  return (
    <div className="calendar">
      <div className="cal-toolbar">
        <h2 className="cal-month">{month.format('MMMM YYYY')}</h2>
        <div className="cal-nav">
          <button
            type="button"
            className="btn btn--small btn--ghost"
            aria-label="Previous month"
            onClick={() => changeMonth(month.subtract(1, 'month'))}
          >
            ‹
          </button>
          <button
            type="button"
            className="btn btn--small btn--ghost"
            onClick={() => changeMonth(dayjs().startOf('month'))}
          >
            Today
          </button>
          <button
            type="button"
            className="btn btn--small btn--ghost"
            aria-label="Next month"
            onClick={() => changeMonth(month.add(1, 'month'))}
          >
            ›
          </button>
        </div>
      </div>

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
              selectedDay={selectedDay}
              onSelectDay={toggleDay}
            />
          </div>
          <div className="cal-agenda">
            <h3 className="cal-agenda__title">
              {selectedDay ? `Events on ${dayjs(selectedDay).format('MMM D')}` : 'Events this month'}
            </h3>
            {agendaEvents.length === 0 ? (
              <EmptyState
                title={selectedDay ? 'No events this day' : 'No events this month'}
                hint={
                  selectedDay
                    ? 'Tap the day again to see the whole month.'
                    : 'Try another month or category.'
                }
              />
            ) : (
              <div className="cal-agenda__list">
                {agendaEvents.map((e) => (
                  <Link key={e.id} to={`/events/${e.id}`} className="cal-agenda__row">
                    <span className="cal-agenda__date">{formatDate(e.startTime, 'ddd D')}</span>
                    <span className="cal-agenda__name">{e.title}</span>
                    {typeof e.participantCount === 'number' && (
                      <span className="cal-agenda__count">{e.participantCount} going</span>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
