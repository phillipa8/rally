// ComposePost.jsx — write a new post with an optional image or poll (Owner: Member B).
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api/client';
import { useMutation } from '../api/hooks';
import Avatar from './Avatar';
import CharCounter from './CharCounter';
import ImageUploader from './ImageUploader';

const MAX = 280;

export default function ComposePost({ onPosted }) {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [mediaUrl, setMediaUrl] = useState(null);
  const [poll, setPoll] = useState(null); // null = no poll | array of 2–4 option strings
  const { mutate, loading, error } = useMutation((body) => apiClient.post('/posts', body));

  const tooLong = content.length > MAX;
  const empty = content.trim().length === 0;
  const pollActive = poll != null;
  const filledOptions = pollActive ? poll.map((o) => o.trim()).filter(Boolean) : [];
  const pollValid = !pollActive || filledOptions.length >= 2;
  const canPost = !empty && !tooLong && !loading && pollValid;

  const togglePoll = () => setPoll(pollActive ? null : ['', '']);
  const setOption = (i, val) => setPoll((opts) => opts.map((o, idx) => (idx === i ? val : o)));
  const addOption = () => setPoll((opts) => (opts.length < 4 ? [...opts, ''] : opts));
  const removeOption = (i) => setPoll((opts) => (opts.length > 2 ? opts.filter((_, idx) => idx !== i) : opts));

  async function submit(e) {
    e.preventDefault();
    if (!canPost) return;
    try {
      await mutate({
        content: content.trim(),
        mediaUrl: mediaUrl || undefined,
        pollOptions: pollActive ? filledOptions : undefined,
      });
      setContent('');
      setMediaUrl(null);
      setPoll(null);
      onPosted?.();
    } catch {
      /* error surfaced below */
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

      {pollActive && (
        <div className="poll-editor">
          {poll.map((opt, i) => (
            <div className="poll-editor__row" key={i}>
              <input
                className="poll-editor__input"
                type="text"
                placeholder={`Option ${i + 1}`}
                value={opt}
                maxLength={80}
                onChange={(e) => setOption(i, e.target.value)}
                aria-label={`Poll option ${i + 1}`}
              />
              {poll.length > 2 && (
                <button
                  type="button"
                  className="poll-editor__remove"
                  onClick={() => removeOption(i)}
                  aria-label="Remove option"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          <div className="poll-editor__actions">
            {poll.length < 4 && (
              <button type="button" className="btn btn--small btn--ghost" onClick={addOption}>
                ＋ Add option
              </button>
            )}
            <button type="button" className="btn btn--small btn--ghost" onClick={togglePoll}>
              Remove poll
            </button>
          </div>
        </div>
      )}

      {!pollActive && <ImageUploader value={mediaUrl} onChange={setMediaUrl} />}

      {error && <p className="form__error">{error}</p>}

      <div className="compose__footer">
        <div className="compose__tools">
          <CharCounter value={content.length} max={MAX} />
          {!mediaUrl && (
            <button
              type="button"
              className={`compose__tool${pollActive ? ' compose__tool--on' : ''}`}
              onClick={togglePoll}
              title={pollActive ? 'Remove poll' : 'Add a poll'}
              aria-pressed={pollActive}
            >
              📊 Poll
            </button>
          )}
        </div>
        <button type="submit" className="btn" disabled={!canPost}>
          {loading ? 'Posting…' : 'Post'}
        </button>
      </div>
    </form>
  );
}
