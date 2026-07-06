// BlockedUsersPanel.jsx — manage the current user's block list from Settings.
import apiClient from '../api/client';
import { useApi, useMutation } from '../api/hooks';
import EmptyState from './EmptyState';
import ErrorState from './ErrorState';
import LoadingState from './LoadingState';
import UserCard from './UserCard';

export default function BlockedUsersPanel() {
  const { data, loading, error, refetch } = useApi('/users/me/blocks');
  const { mutate, loading: acting, error: actionError } = useMutation((username) =>
    apiClient.delete(`/users/${username}/block`)
  );

  async function unblock(username) {
    try {
      await mutate(username);
      await refetch();
    } catch {
      /* actionError is rendered above the list */
    }
  }

  if (loading) return <LoadingState label="Loading blocked users..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const users = data?.users || [];
  if (!users.length) {
    return <EmptyState title="No blocked users" hint="Users you block will appear here." />;
  }

  return (
    <div className="blocked-list">
      {actionError && <p className="form__error">{actionError}</p>}
      {users.map((user) => (
        <div className="blocked-user" key={user.id}>
          <UserCard user={user} showFollow={false} />
          <button
            type="button"
            className="btn btn--small btn--ghost"
            onClick={() => unblock(user.username)}
            disabled={acting}
          >
            {acting ? 'Unblocking...' : 'Unblock'}
          </button>
        </div>
      ))}
    </div>
  );
}
