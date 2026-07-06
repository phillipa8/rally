// BlockButton.jsx — block/unblock another user from profile surfaces.
import { useEffect, useState } from 'react';
import apiClient from '../api/client';
import { useMutation } from '../api/hooks';
import { useAuth } from '../context/AuthContext';

export default function BlockButton({ username, initialBlocked = false, onChange }) {
  const { isAuthenticated } = useAuth();
  const [blocked, setBlocked] = useState(initialBlocked);
  const { mutate, loading, error } = useMutation((shouldBlock) =>
    shouldBlock
      ? apiClient.post(`/users/${username}/block`)
      : apiClient.delete(`/users/${username}/block`)
  );

  useEffect(() => {
    setBlocked(initialBlocked);
  }, [initialBlocked]);

  if (!isAuthenticated) return null;

  async function onClick() {
    const next = !blocked;
    try {
      await mutate(next);
      setBlocked(next);
      onChange?.(next);
    } catch {
      /* error is surfaced via the title */
    }
  }

  return (
    <button
      type="button"
      className={`btn btn--small ${blocked ? 'btn--ghost' : 'btn--danger'}`}
      onClick={onClick}
      disabled={loading}
      title={error || undefined}
      aria-pressed={blocked}
    >
      {loading ? '...' : blocked ? 'Unblock' : 'Block'}
    </button>
  );
}
