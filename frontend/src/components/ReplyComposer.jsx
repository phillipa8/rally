// ReplyComposer.jsx — creates a reply by reusing POST /posts with parentPostId.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../api/client';
import { useMutation } from '../api/hooks';
import { useAuth } from '../context/AuthContext';
import Avatar from './Avatar';
import CharCounter from './CharCounter';

const MAX = 280;

export default function ReplyComposer({ parentPost, onPosted }) {
  const { isAuthenticated, user } = useAuth();
  const [content, setContent] = useState('');
  const { mutate, loading, error } = useMutation((body) => apiClient.post('/posts', body));

  const empty = content.trim().length === 0;
  const tooLong = content.length > MAX;
  const canReply = isAuthenticated && !empty && !tooLong && !loading;

  async function submit(e) {
    e.preventDefault();
    if (!canReply) return;
    await mutate({ content: content.trim(), parentPostId: parentPost.id });
    setContent('');
    onPosted?.();
  }

  if (!isAuthenticated) {
    return (
      <div className="card reply-composer reply-composer--signed-out">
        <p className="reply-composer__hint">Log in to join this thread.</p>
        <Link to="/login" className="btn btn--small">Log in</Link>
      </div>
    );
  }

  return (
    <form className="card reply-composer" onSubmit={submit}>
      <div className="compose__row">
        <Avatar user={user} size={36} />
        <textarea
          className="compose__input reply-composer__input"
          placeholder={`Reply to @${parentPost.author.username}`}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={2}
          aria-label="Reply content"
        />
      </div>
      {error && <p className="form__error">{error}</p>}
      <div className="compose__footer">
        <CharCounter value={content.length} max={MAX} />
        <button type="submit" className="btn btn--small" disabled={!canReply}>
          {loading ? 'Replying...' : 'Reply'}
        </button>
      </div>
    </form>
  );
}
