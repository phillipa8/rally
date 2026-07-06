// PostActions.jsx — reply, repost, quote, like, and bookmark row.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient, { errorMessage } from '../api/client';
import { useMutation } from '../api/hooks';
import { useAuth } from '../context/AuthContext';
import Modal from './Modal';
import QuotePostComposer from './QuotePostComposer';

const KIND = {
  like: { onKey: 'liked', countKey: 'likeCount' },
  repost: { onKey: 'reposted', countKey: 'repostCount' },
  bookmark: { onKey: 'bookmarked', countKey: 'bookmarkCount' },
};

export default function PostActions({ post, onChange }) {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [quoteOpen, setQuoteOpen] = useState(false);
  const { mutate, loading } = useMutation(({ kind, wasOn }) => {
    const url = `/posts/${post.id}/${kind}`;
    return wasOn ? apiClient.delete(url) : apiClient.post(url);
  });
  const del = useMutation(() => apiClient.delete(`/posts/${post.id}`));
  const isOwner = user?.id != null && user.id === post.author?.id;
  const [s, setS] = useState({
    liked: !!post.likedByMe,
    likeCount: post.likeCount ?? 0,
    reposted: !!post.repostedByMe,
    repostCount: post.repostCount ?? 0,
    bookmarked: !!post.bookmarkedByMe,
    bookmarkCount: post.bookmarkCount ?? 0,
    error: null,
  });

  useEffect(() => {
    setS((prev) => ({
      ...prev,
      liked: !!post.likedByMe,
      likeCount: post.likeCount ?? 0,
      reposted: !!post.repostedByMe,
      repostCount: post.repostCount ?? 0,
      bookmarked: !!post.bookmarkedByMe,
      bookmarkCount: post.bookmarkCount ?? 0,
    }));
  }, [
    post.likedByMe,
    post.likeCount,
    post.repostedByMe,
    post.repostCount,
    post.bookmarkedByMe,
    post.bookmarkCount,
  ]);

  async function toggle(kind) {
    if (!isAuthenticated) return navigate('/login');
    if (loading) return;
    const { onKey, countKey } = KIND[kind];
    const wasOn = s[onKey];
    const prev = s;
    // optimistic
    setS((p) => ({ ...p, [onKey]: !wasOn, [countKey]: p[countKey] + (wasOn ? -1 : 1), error: null }));
    try {
      await mutate({ kind, wasOn });
      onChange?.();
    } catch (err) {
      setS({ ...prev, error: errorMessage(err) }); // revert
    }
  }

  function openQuote() {
    if (!isAuthenticated) return navigate('/login');
    setQuoteOpen(true);
  }

  async function handleDelete() {
    if (del.loading) return;
    if (!window.confirm('Delete this post? This cannot be undone.')) return;
    try {
      await del.mutate();
      onChange?.(); // parent refetches -> the post drops out of the list
    } catch {
      /* del.error is shown inline */
    }
  }

  return (
    <>
      <div className="post-actions" aria-busy={loading}>
        <button type="button" className="post-action" title="Reply" onClick={() => navigate(`/posts/${post.id}`)}>
          💬 <span>{post.replyCount ?? 0}</span>
        </button>
        <button
          type="button"
          className={`post-action${s.reposted ? ' post-action--repost-on' : ''}`}
          title="Repost"
          onClick={() => toggle('repost')}
          disabled={loading}
        >
          🔁 <span>{s.repostCount}</span>
        </button>
        <button type="button" className="post-action" title="Quote" onClick={openQuote}>
          ✍️ <span>Quote</span>
        </button>
        <button
          type="button"
          className={`post-action${s.liked ? ' post-action--like-on' : ''}`}
          title="Like"
          onClick={() => toggle('like')}
          disabled={loading}
        >
          {s.liked ? '❤️' : '🤍'} <span>{s.likeCount}</span>
        </button>
        <button
          type="button"
          className={`post-action${s.bookmarked ? ' post-action--bookmark-on' : ''}`}
          title={s.bookmarked ? 'Remove bookmark' : 'Bookmark'}
          onClick={() => toggle('bookmark')}
          disabled={loading}
        >
          {s.bookmarked ? '🔖' : '🏷️'}
        </button>
        {isOwner && (
          <button
            type="button"
            className="post-action post-action--delete"
            title="Delete post"
            onClick={handleDelete}
            disabled={del.loading}
          >
            🗑️
          </button>
        )}
        {(loading || del.loading) && <span className="post-actions__status">Saving...</span>}
        {(s.error || del.error) && (
          <span className="post-actions__error" role="alert">{s.error || del.error}</span>
        )}
      </div>

      <Modal open={quoteOpen} onClose={() => setQuoteOpen(false)} title="Quote post">
        <QuotePostComposer
          post={post}
          onCancel={() => setQuoteOpen(false)}
          onPosted={() => {
            setQuoteOpen(false);
            onChange?.();
          }}
        />
      </Modal>
    </>
  );
}
