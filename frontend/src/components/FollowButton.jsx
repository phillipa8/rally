// FollowButton.jsx — follow / unfollow / cancel-request, reused on profiles and
// user cards (Owner: Member A). Owns its own optimistic status so the button
// reacts instantly; reverts on error. `initialStatus` is 'accepted' | 'pending' | null.
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useMutation } from '../api/hooks';
import apiClient from '../api/client';

export default function FollowButton({ username, initialStatus = null, onChange }) {
  const { isAuthenticated } = useAuth();
  const [status, setStatus] = useState(initialStatus); // null | 'pending' | 'accepted'
  const { mutate, loading, error } = useMutation((action) =>
    action === 'follow'
      ? apiClient.post(`/users/${username}/follow`)
      : apiClient.delete(`/users/${username}/follow`)
  );

  // Not logged in: send them to login rather than firing a doomed request.
  if (!isAuthenticated) return null;

  const isFollowing = status === 'accepted';
  const isPending = status === 'pending';

  const label = loading
    ? '…'
    : isFollowing
      ? 'Following'
      : isPending
        ? 'Requested'
        : 'Follow';

  const onClick = async () => {
    const next = status ? null : 'follow'; // any active state -> unfollow/cancel
    try {
      if (next === 'follow') {
        const res = await mutate('follow');
        const newStatus = res?.data?.status ?? 'accepted'; // accepted (public) or pending (private)
        setStatus(newStatus);
        onChange?.(newStatus);
      } else {
        await mutate('unfollow');
        setStatus(null);
        onChange?.(null);
      }
    } catch {
      /* useMutation surfaces the error; status is left unchanged */
    }
  };

  return (
    <button
      type="button"
      className={`btn btn--small ${status ? 'btn--ghost' : ''}`}
      onClick={onClick}
      disabled={loading}
      aria-pressed={!!status}
      title={error || undefined}
    >
      {label}
    </button>
  );
}
