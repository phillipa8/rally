// EventsPage.jsx — events hub or entry point for creating events (Owner: Member C).
// An explorable month calendar will be implemented later in step 5. For now this page hosts the
// "New event" flow and each created event links out to its detail page.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import EventForm from '../components/EventForm';
import EmptyState from '../components/EmptyState';

export default function EventsPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [creating, setCreating] = useState(false);

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

      <EmptyState
        title="Browse events on the calendar"
        hint={
          isAuthenticated
            ? 'Create an event to get started. The calendar view is coming soon.'
            : 'Log in to create events.'
        }
      />

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
