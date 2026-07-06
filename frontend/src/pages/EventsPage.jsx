// EventsPage.jsx — events hub (Owner: Member C). Entry point for creating an event
// and a jumping off point to the month calendar, where events are browsed.

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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
        <div className="page__actions">
          <Link to="/calendar" className="btn btn--ghost">
            View calendar
          </Link>
          {isAuthenticated && (
            <button type="button" className="btn" onClick={() => setCreating(true)}>
              ＋ New event
            </button>
          )}
        </div>
      </div>

      <EmptyState
        title="Browse events on the calendar"
        hint={
          isAuthenticated
            ? 'Create an event, or open the calendar to see what’s coming up.'
            : 'Log in to create events, or open the calendar to browse.'
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
