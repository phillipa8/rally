// EventCardList.jsx — a list of events as cards with built-in states loading, error, empty
// states (Owner: Member C). Mirrors PostList: used for the popular or joined events sections.

import LoadingState from './LoadingState';
import ErrorState from './ErrorState';
import EmptyState from './EmptyState';
import EventCard from './EventCard';

export default function EventCardList({
  events,
  loading,
  error,
  onRetry,
  emptyTitle = 'No events',
  emptyHint,
}) {
  if (loading) return <LoadingState label="Loading events…" />;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (!events || events.length === 0) return <EmptyState title={emptyTitle} hint={emptyHint} />;

  return (
    <div className="event-list">
      {events.map((e) => (
        <EventCard key={e.id} event={e} participantCount={e.participantCount} />
      ))}
    </div>
  );
}
