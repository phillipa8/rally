// PostActions.jsx — reply / repost / like / bookmark row (Owner: Member B).
// Bookmark is fully wired (Member B endpoint). Like & repost call the agreed
// Member D endpoints (POST|DELETE /api/posts/:id/{like,repost}); their counts render
// now, and the toggles activate once Member D ships those endpoints. Reply links to
// the post detail page (Member D adds the thread there).
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient, { errorMessage } from '../api/client';
import { useMutation } from '../api/hooks';
import { useAuth } from '../context/AuthContext';

const KIND = {
  like: { onKey: 'liked', countKey: 'likeCount' },
  repost: { onKey: 'reposted', countKey: 'repostCount' },
  bookmark: { onKey: 'bookmarked', countKey: 'bookmarkCount' },
};

export default function PostActions({ post, onChange }) {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { mutate, loading } = useMutation(({ kind, wasOn }) => {
    const url = `/posts/${post.id}/${kind}`;
    return wasOn ? apiClient.delete(url) : apiClient.post(url);
  });
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

  return (
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
      {loading && <span className="post-actions__status">Saving...</span>}
      {s.error && <span className="post-actions__error" role="alert">{s.error}</span>}
    </div>
  );
}
