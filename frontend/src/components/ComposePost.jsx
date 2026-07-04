// ComposePost.jsx — write a new post with an optional image (Owner: Member B).
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import apiClient, { errorMessage } from '../api/client';
import Avatar from './Avatar';
import CharCounter from './CharCounter';
import ImageUploader from './ImageUploader';

const MAX = 280;

export default function ComposePost({ onPosted }) {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [mediaUrl, setMediaUrl] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const tooLong = content.length > MAX;
  const empty = content.trim().length === 0;
  const canPost = !empty && !tooLong && !busy;

  async function submit(e) {
    e.preventDefault();
    if (!canPost) return;
    setBusy(true);
    setError(null);
    try {
      await apiClient.post('/posts', {
        content: content.trim(),
        mediaUrl: mediaUrl || undefined,
      });
      setContent('');
      setMediaUrl(null);
      onPosted?.();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card compose" onSubmit={submit}>
      <div className="compose__row">
        <Avatar user={user} size={40} />
        <textarea
          className="compose__input"
          placeholder="What's happening?"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
          aria-label="Post content"
        />
      </div>
      <ImageUploader value={mediaUrl} onChange={setMediaUrl} />
      {error && <p className="form__error">{error}</p>}
      <div className="compose__footer">
        <CharCounter value={content.length} max={MAX} />
        <button type="submit" className="btn" disabled={!canPost}>
          {busy ? 'Posting…' : 'Post'}
        </button>
      </div>
    </form>
  );
}
