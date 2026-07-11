// EventCard.jsx — a compact event summary that links to its full detail page (Owner: Member C).
// participantCount is optional hence shown when the caller has it (calendar, detail, lists).

import { Link } from 'react-router-dom';
import { formatDate } from '../lib/time';

export default function EventCard({ event, participantCount }) {
  if (!event) return null;
  return (
    <Link to={`/events/${event.id}`} className="card event-card">
      <div className="event-card__head">
        {event.category?.name && <span className="chip">{event.category.name}</span>}
        {event.isPrivate && <span className="chip" title="Private event">🔒</span>}
        {typeof participantCount === 'number' && (
          <span className="muted event-card__count">{participantCount} going</span>
        )}
      </div>
      <h3 className="event-card__title">{event.title}</h3>
      <p className="event-card__meta muted">
        <span>🗓 {formatDate(event.startTime, 'ddd, MMM D · h:mm A')}</span>
        {event.creator && (
          <span> · 👤 {event.creator.displayName} (@{event.creator.username})</span>
        )}
        {event.location && <span> · 📍 {event.location}</span>}
      </p>
    </Link>
  );
}
