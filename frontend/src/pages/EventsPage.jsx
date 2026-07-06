// EventsPage.jsx — the events hub (Owner: Member C). One page: create an event,
// browse the month calendar, discover events (upcoming or most popular via a dropdown),
// and see the events you've joined.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../api/hooks';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import EventForm from '../components/EventForm';
import Calendar from '../components/Calendar';
import EventCardList from '../components/EventCardList';

export default function EventsPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [creating, setCreating] = useState(false);
  const [sort, setSort] = useState('upcoming'); // default: recent/upcoming

  const discover = useApi(`/events/discover?sort=${sort}`, [sort]);
  const joined = useApi('/events/me/participating', [], { enabled: isAuthenticated });

  return (
    <section className="page">
      <div className="page__header">
        <h1 className="page__title">Events</h1>
        {isAuthenticated && (
          <button type="button" className="btn" onClick={() => setCreating(true)}>
            ＋ New event
          </button>
        )}
      </div>

      <Calendar />

      <div className="section-head">
        <h2 className="page__subtitle">Discover</h2>
        <select
          className="sort-select"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          aria-label="Sort discovered events"
        >
          <option value="upcoming">Upcoming</option>
          <option value="popular">Most popular</option>
        </select>
      </div>
      <EventCardList
        events={discover.data?.events}
        loading={discover.loading}
        error={discover.error}
        onRetry={discover.refetch}
        emptyTitle={sort === 'popular' ? 'No popular events yet' : 'No upcoming events'}
        emptyHint="Events show up here once they’re created."
      />

      {isAuthenticated && (
        <>
          <h2 className="page__subtitle">Joined Events</h2>
          <EventCardList
            events={joined.data?.events}
            loading={joined.loading}
            error={joined.error}
            onRetry={joined.refetch}
            emptyTitle="You haven’t joined any events yet"
            emptyHint="RSVP to an event and it’ll show up here."
          />
        </>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="New event">
        <EventForm
          onCancel={() => setCreating(false)}
          onSaved={(ev) => {
            setCreating(false);
            navigate(`/events/${ev.id}`);
          }}
        />
      </Modal>
    </section>
  );
}
