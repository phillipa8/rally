// EventInviteModal.jsx — owner-only event invitation list.
import { useState } from 'react';
import apiClient from '../api/client';
import { useApi, useMutation } from '../api/hooks';
import EmptyState from './EmptyState';
import ErrorState from './ErrorState';
import LoadingState from './LoadingState';
import UserCard from './UserCard';

export default function EventInviteModal({ event }) {
  const invitees = useApi(`/events/${event.id}/invitees`, [event.id]);
  const { mutate, loading, error } = useMutation((username) =>
    apiClient.post(`/events/${event.id}/invite`, { username })
  );
  const [sent, setSent] = useState(() => new Set());
  const [activeUsername, setActiveUsername] = useState(null);

  async function invite(username) {
    setActiveUsername(username);
    try {
      await mutate(username);
      setSent((prev) => new Set(prev).add(username));
    } catch {
      /* error is rendered above the list */
    } finally {
      setActiveUsername(null);
    }
  }

  if (invitees.loading) return <LoadingState label="Loading people..." />;
  if (invitees.error) return <ErrorState message={invitees.error} onRetry={invitees.refetch} />;

  const users = invitees.data?.users || [];
  if (!users.length) {
    return <EmptyState title="No people to invite" hint="Follow someone first, then invite them." />;
  }

  return (
    <div className="invite-list">
      {error && <p className="form__error">{error}</p>}
      {users.map((user) => {
        const alreadySent = sent.has(user.username);
        const busy = loading && activeUsername === user.username;
        return (
          <div className="invite-user" key={user.id}>
            <UserCard user={user} showFollow={false} />
            <button
              type="button"
              className={`btn btn--small${alreadySent ? ' btn--ghost' : ''}`}
              onClick={() => invite(user.username)}
              disabled={loading || alreadySent}
            >
              {busy ? 'Sending...' : alreadySent ? 'Sent' : 'Invite'}
            </button>
          </div>
        );
      })}
    </div>
  );
}
