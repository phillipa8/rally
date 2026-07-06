// QuotePostComposer.jsx — creates a new post that quotes another post.
import { useState } from 'react';
import apiClient from '../api/client';
import { useMutation } from '../api/hooks';
import { useAuth } from '../context/AuthContext';
import Avatar from './Avatar';
import CharCounter from './CharCounter';
import QuotedPostPreview from './QuotedPostPreview';

const MAX = 280;

export default function QuotePostComposer({ post, onPosted, onCancel }) {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const { mutate, loading, error } = useMutation((body) =>
    apiClient.post(`/posts/${post.id}/quote`, body)
  );

  const empty = content.trim().length === 0;
  const tooLong = content.length > MAX;
  const canPost = !empty && !tooLong && !loading;

  async function submit(e) {
    e.preventDefault();
    if (!canPost) return;
    try {
      await mutate({ content: content.trim() });
      setContent('');
      onPosted?.();
    } catch {
      /* error is rendered below */
    }
  }

  return (
    <form className="quote-composer" onSubmit={submit}>
      <div className="compose__row">
        <Avatar user={user} size={36} />
        <textarea
          className="compose__input quote-composer__input"
          placeholder="Add a comment"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
          aria-label="Quote post content"
        />
      </div>

      <QuotedPostPreview post={post} />

      {error && <p className="form__error">{error}</p>}

      <div className="compose__footer">
        <CharCounter value={content.length} max={MAX} />
        <div className="quote-composer__actions">
          <button type="button" className="btn btn--small btn--ghost" onClick={onCancel} disabled={loading}>
            Cancel
          </button>
          <button type="submit" className="btn btn--small" disabled={!canPost}>
            {loading ? 'Posting...' : 'Quote'}
          </button>
        </div>
      </div>
    </form>
  );
}
