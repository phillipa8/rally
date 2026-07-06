// PollBlock.jsx — renders a poll inside a PostCard (Owner: Member B).
// Clickable options until you vote (or if you can't vote), then result bars.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient, { errorMessage } from '../api/client';
import { useMutation } from '../api/hooks';
import { useAuth } from '../context/AuthContext';

export default function PollBlock({ post, onChange }) {
  const poll = post.poll;
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const { mutate, loading } = useMutation((optionId) =>
    apiClient.post(`/posts/${post.id}/vote`, { optionId })
  );

  if (!poll) return null;

  const voted = poll.myVote != null;
  const showResults = voted || !isAuthenticated; // logged-out viewers can't vote -> show results
  const total = poll.totalVotes;

  async function vote(optionId) {
    if (!isAuthenticated) return navigate('/login');
    if (loading || voted) return;
    setError(null);
    try {
      await mutate(optionId);
      onChange?.(); // refetch -> poll updates (myVote + counts)
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="poll" role="group" aria-label="Poll">
      {poll.options.map((o) => {
        const pct = total > 0 ? Math.round((o.votes / total) * 100) : 0;
        const mine = poll.myVote === o.id;
        return showResults ? (
          <div key={o.id} className={`poll-result${mine ? ' poll-result--mine' : ''}`}>
            <div className="poll-result__bar" style={{ width: `${pct}%` }} />
            <span className="poll-result__label">
              {o.text}
              {mine ? ' ✓' : ''}
            </span>
            <span className="poll-result__pct">{pct}%</span>
          </div>
        ) : (
          <button
            key={o.id}
            type="button"
            className="poll-option"
            onClick={() => vote(o.id)}
            disabled={loading}
          >
            {o.text}
          </button>
        );
      })}
      <p className="poll__meta">
        {total} {total === 1 ? 'vote' : 'votes'}
        {error && <span className="poll__error"> · {error}</span>}
      </p>
    </div>
  );
}
