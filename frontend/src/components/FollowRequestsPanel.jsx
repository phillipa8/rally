// FollowRequestsPanel.jsx — approve or decline incoming follow requests
// (Owner: Member A). Only meaningful for private accounts. Uses the
// /follow-requests API; ":id" is the requester's user id. Rows are removed
// from the local list as they're actioned so the UI stays responsive.
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useApi, useMutation } from '../api/hooks';
import apiClient from '../api/client';
import Avatar from './Avatar';
import LoadingState from './LoadingState';
import ErrorState from './ErrorState';
import EmptyState from './EmptyState';

export default function FollowRequestsPanel({ onChange }) {
  const { data, loading, error, refetch } = useApi('/follow-requests');
  const [requests, setRequests] = useState([]);
  const { mutate: act, loading: acting } = useMutation((id, decision) =>
    apiClient.put(`/follow-requests/${id}/${decision}`)
  );

  useEffect(() => {
    if (data?.requests) setRequests(data.requests);
  }, [data]);

  const decide = async (id, decision) => {
    const prev = requests;
    setRequests((r) => r.filter((u) => u.id !== id)); // optimistic remove
    try {
      await act(id, decision);
      onChange?.();
    } catch {
      setRequests(prev); // restore on failure
    }
  };

  if (loading) return <LoadingState label="Loading requests…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!requests.length) return <EmptyState title="No pending requests" />;

  return (
    <div className="request-list">
      {requests.map((u) => (
        <div key={u.id} className="request">
          <Link to={`/u/${u.username}`} className="request__main">
            <Avatar user={u} size={44} />
            <span className="request__names">
              <span className="request__display">{u.displayName}</span>
              <span className="request__handle">@{u.username}</span>
            </span>
          </Link>
          <div className="request__actions">
            <button type="button" className="btn btn--small" disabled={acting} onClick={() => decide(u.id, 'accept')}>
              Accept
            </button>
            <button type="button" className="btn btn--small btn--ghost" disabled={acting} onClick={() => decide(u.id, 'reject')}>
              Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
