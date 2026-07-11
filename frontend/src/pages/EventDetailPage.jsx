// EventDetailPage.jsx — detailed event view with creator controls plus related posts (Owner: Member C).
// Reads GET /api/events/:id (event, participantCount, isParticipating, relatedPosts).
// Edit/Delete are only shown to the creator. Participation will be implemented later in step 4.

import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useApi, useMutation } from '../api/hooks';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../lib/time';
import Avatar from '../components/Avatar';
import Modal from '../components/Modal';
import EventForm from '../components/EventForm';
import EventInviteModal from '../components/EventInviteModal';
import ShareEventComposer from '../components/ShareEventComposer';
import ParticipateButton from '../components/ParticipateButton';
import PostList from '../components/PostList';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';

export default function EventDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { data, loading, error, refetch } = useApi(`/events/${id}`, [id]);
  const [editing, setEditing] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [inviting, setInviting] = useState(false);
  const del = useMutation(() => apiClient.delete(`/events/${id}`));

  if (loading) return <LoadingState label="Loading event…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!data?.event) return <EmptyState title="Event not found" />;

  const { event, participantCount, isParticipating, relatedPosts } = data;
  const isCreator = user?.id === event.creator.id;
  // Displays the full date on the end time only when the event spans multiple
  // days (compared in the viewer's local timezone).
  const sameDay =
    formatDate(event.startTime, 'YYYY-MM-DD') === formatDate(event.endTime, 'YYYY-MM-DD');

  async function handleDelete() {
    if (!window.confirm('Delete this event? Shared posts remain but lose their event link.')) return;
    try {
      await del.mutate();
      navigate('/events');
    } catch {
      /* error surfaced below */
    }
  }

  return (
    <section className="page">
      <article className="card event-detail">
        <div className="event-detail__head">
          {event.category?.name && (
            <Link to={`/category/${event.category.slug}`} className="chip">
              {event.category.name}
            </Link>
          )}
          {event.isPrivate && (
            <span className="chip" title="Only the host's accepted followers can see this event">
              🔒 Private
            </span>
          )}
          {isCreator && (
            <div className="event-detail__controls">
              <button type="button" className="btn btn--small btn--ghost" onClick={() => setEditing(true)}>
                Edit
              </button>
              <button
                type="button"
                className="btn btn--small btn--ghost"
                onClick={handleDelete}
                disabled={del.loading}
              >
                {del.loading ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          )}
        </div>
        {del.error && <p className="form__error">{del.error}</p>}

        <h1 className="event-detail__title">{event.title}</h1>
        {event.description && <p className="event-detail__desc">{event.description}</p>}

        <dl className="event-detail__facts">
          <div>
            <dt>When</dt>
            <dd>
              {formatDate(event.startTime, 'ddd, MMM D, YYYY · h:mm A')} –{' '}
              {formatDate(event.endTime, sameDay ? 'h:mm A' : 'ddd, MMM D, YYYY · h:mm A')}
            </dd>
          </div>
          {event.location && (
            <div>
              <dt>Where</dt>
              <dd>{event.location}</dd>
            </div>
          )}
          {event.ageRestriction > 0 && (
            <div>
              <dt>Age</dt>
              <dd>{event.ageRestriction}+</dd>
            </div>
          )}
        </dl>

        <div className="event-detail__creator">
          <Avatar user={event.creator} size={32} />
          <span className="muted">
            Hosted by {event.creator.displayName} (@{event.creator.username})
          </span>
        </div>

        <div className="event-detail__actions">
          {isAuthenticated ? (
            <>
              <div className="event-detail__rsvp">
                <ParticipateButton
                  eventId={event.id}
                  participating={isParticipating}
                  count={participantCount}
                />
              </div>
              <div className="event-detail__share-actions">
                {isCreator && (
                  <button type="button" className="btn btn--small btn--ghost" onClick={() => setInviting(true)}>
                    Invite
                  </button>
                )}
                <button type="button" className="btn btn--small" onClick={() => setSharing(true)}>
                  Share to feed
                </button>
              </div>
            </>
          ) : (
            <span className="muted">{participantCount} going</span>
          )}
        </div>
      </article>

      <h2 className="page__subtitle">Posts about this event</h2>
      <PostList
        posts={relatedPosts}
        onChange={refetch}
        emptyTitle="No posts yet"
        emptyHint="Share this event to start the conversation."
      />

      <Modal open={editing} onClose={() => setEditing(false)} title="Edit event">
        <EventForm
          event={event}
          onCancel={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            refetch();
          }}
        />
      </Modal>

      <Modal open={sharing} onClose={() => setSharing(false)} title="Share to feed">
        <ShareEventComposer
          eventId={event.id}
          onShared={() => {
            setSharing(false);
            refetch();
          }}
        />
      </Modal>

      <Modal open={inviting} onClose={() => setInviting(false)} title="Invite people">
        <EventInviteModal event={event} />
      </Modal>
    </section>
  );
}
