// FollowListModal.jsx — followers / following list in a dialog (Owner: Member A).
// `tab` is 'followers' | 'following' | null; null keeps the modal closed. The
// endpoint returns only accepted relationships, so private-account privacy holds.
import Modal from './Modal';
import UserCard from './UserCard';
import { useApi } from '../api/hooks';
import LoadingState from './LoadingState';
import ErrorState from './ErrorState';
import EmptyState from './EmptyState';

export default function FollowListModal({ username, tab, onClose }) {
  const { data, loading, error, refetch } = useApi(
    `/users/${username}/${tab}`,
    [username, tab],
    { enabled: !!tab }
  );

  const title = tab === 'followers' ? 'Followers' : 'Following';

  return (
    <Modal open={!!tab} onClose={onClose} title={title}>
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : !data?.users?.length ? (
        <EmptyState title={tab === 'followers' ? 'No followers yet' : 'Not following anyone yet'} />
      ) : (
        <div className="user-list">
          {data.users.map((u) => (
            <UserCard key={u.id} user={u} />
          ))}
        </div>
      )}
    </Modal>
  );
}
