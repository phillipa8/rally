// EventChip.jsx — compact "this post is about an event" badge shown inside PostCard
// (Owner: Member C). Is rendered whenever a post has an eventId. It self-fetches the
// event summary and degrades to a plain working link if that fetch fails or the
// event was deleted, so a bad/removed event never breaks the surrounding post.

import { Link } from 'react-router-dom';
import { useApi } from '../api/hooks';
import { formatDate } from '../lib/time';

export default function EventChip({ eventId }) {
  const { data, loading, error } = useApi(`/events/${eventId}`, [eventId]);

  if (loading) {
    return <span className="event-chip event-chip--muted">🎉 Loading event…</span>;
  }

  // Error or deleted event: still offer a link rather than breaking the card.
  if (error || !data?.event) {
    return (
      <Link to={`/events/${eventId}`} className="event-chip" title={error || undefined}>
        🎉 View event
      </Link>
    );
  }

  const { event } = data;
  return (
    <Link to={`/events/${event.id}`} className="event-chip">
      <span aria-hidden="true">🎉</span>
      <span className="event-chip__title">{event.title}</span>
      <span className="event-chip__date muted">· {formatDate(event.startTime, 'MMM D, h:mm A')}</span>
    </Link>
  );
}
