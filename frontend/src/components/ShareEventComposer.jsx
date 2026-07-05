// ShareEventComposer.jsx — write a post attached to an event (Owner: Member C).
// This is the write path for event-share linkage: it calls POST /posts with an
// eventId, which sets posts.event_id so the post shows an EventChip everywhere.
// Kept separate from Member B's ComposePost to stay decoupled; reuses CharCounter.

import { useState } from 'react';
import { useMutation } from '../api/hooks';
import apiClient from '../api/client';
import CharCounter from './CharCounter';

const MAX = 280;

export default function ShareEventComposer({ eventId, onShared }) {
  const [content, setContent] = useState('');
  const { mutate, loading, error } = useMutation((body) => apiClient.post('/posts', body));

  const tooLong = content.length > MAX;
  const empty = content.trim().length === 0;
  const canPost = !empty && !tooLong && !loading;

  async function submit(e) {
    e.preventDefault();
    if (!canPost) return;
    try {
      await mutate({ content: content.trim(), eventId });
      setContent('');
      onShared?.();
    } catch {
      /* error surfaced below */
    }
  }

  return (
    <form className="event-share" onSubmit={submit}>
      <textarea
        className="compose__input"
        placeholder="Say something about this event…"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={3}
        aria-label="Post content"
      />
      {error && <p className="form__error">{error}</p>}
      <div className="compose__footer">
        <CharCounter value={content.length} max={MAX} />
        <button type="submit" className="btn" disabled={!canPost}>
          {loading ? 'Sharing…' : 'Share'}
        </button>
      </div>
    </form>
  );
}
