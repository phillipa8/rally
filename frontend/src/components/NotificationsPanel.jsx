// NotificationsPanel.jsx — the notifications list with mark-read actions
// (Owner: Member A). Reusable on the Notifications page (and later a navbar
// dropdown). Keeps a local copy of the rows so read-state updates feel instant.
import { useState, useEffect } from 'react';
import { useApi, useMutation } from '../api/hooks';
import apiClient from '../api/client';
import NotificationItem from './NotificationItem';
import LoadingState from './LoadingState';
import ErrorState from './ErrorState';
import EmptyState from './EmptyState';

export default function NotificationsPanel() {
  const { data, loading, error, refetch } = useApi('/notifications');
  const [items, setItems] = useState([]);
  const { mutate: markRead } = useMutation((id) => apiClient.put(`/notifications/${id}/read`));
  const { mutate: markAll } = useMutation(() => apiClient.put('/notifications/read-all'));

  // Mirror fetched rows into local state so we can update read-state optimistically.
  useEffect(() => {
    if (data?.notifications) setItems(data.notifications);
  }, [data]);

  const unread = items.filter((n) => !n.isRead).length;

  const onRead = async (id) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    try {
      await markRead(id);
    } catch {
      refetch(); // revert to server truth on failure
    }
  };

  const onReadAll = async () => {
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try {
      await markAll();
    } catch {
      refetch();
    }
  };

  if (loading) return <LoadingState label="Loading notifications…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!items.length) return <EmptyState title="No notifications yet" hint="Follows, likes, and replies will show up here." />;

  return (
    <div className="notifications">
      {unread > 0 && (
        <div className="notifications__toolbar">
          <span className="notifications__count">{unread} unread</span>
          <button type="button" className="btn btn--small btn--ghost" onClick={onReadAll}>
            Mark all read
          </button>
        </div>
      )}
      <div className="notifications__list" role="list">
        {items.map((n) => (
          <NotificationItem key={n.id} notification={n} onRead={onRead} />
        ))}
      </div>
    </div>
  );
}
