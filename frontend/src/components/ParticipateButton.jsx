// ParticipateButton.jsx — RSVP toggle for an event (Owner: Member C).
// A going/withdrawn toggle with an optimistic count. Self-contained (owns its own
// going + count state seeded from props) so toggling doesn't force a full-page
// refetch/flash; reconciles with the server's participantCount on success.

import { useState, useEffect } from 'react';
import { useMutation } from '../api/hooks';
import apiClient from '../api/client';

export default function ParticipateButton({ eventId, participating = false, count = 0, onChange }) {
  const [going, setGoing] = useState(participating);
  const [n, setN] = useState(count);

  // Resync if the parent passes fresh values (e.g. after its own reload).
  useEffect(() => {
    setGoing(participating);
    setN(count);
  }, [participating, count]);

  const { mutate, loading, error } = useMutation((join) =>
    join
      ? apiClient.post(`/events/${eventId}/participate`, { status: 'going' })
      : apiClient.delete(`/events/${eventId}/participate`)
  );

  async function toggle() {
    const next = !going;
    // Optimistic update.
    setGoing(next);
    setN((c) => c + (next ? 1 : -1));
    try {
      const res = await mutate(next);
      // POST returns the authoritative count; DELETE has no body.
      if (res?.data?.participantCount != null) setN(res.data.participantCount);
      onChange?.();
    } catch {
      // Roll back on failure.
      setGoing(!next);
      setN((c) => c + (next ? -1 : 1));
    }
  }

  return (
    <span className="participate">
      <button
        type="button"
        className={`btn btn--small${going ? ' btn--ghost' : ''}`}
        onClick={toggle}
        disabled={loading}
        aria-pressed={going}
      >
        {going ? '✓ Going' : 'Join event'}
      </button>
      <span className="muted participate__count">{n} going</span>
      {error && <span className="form__error">{error}</span>}
    </span>
  );
}
