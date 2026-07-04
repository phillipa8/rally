// PostList.jsx — renders a list of posts with built-in loading / error / empty
// states (Owner: Member B). Reused by feed, explore, bookmarks, and profile.
import LoadingState from './LoadingState';
import ErrorState from './ErrorState';
import EmptyState from './EmptyState';
import PostCard from './PostCard';

export default function PostList({
  posts,
  loading,
  error,
  onRetry,
  onChange,
  emptyTitle = 'No posts yet',
  emptyHint,
}) {
  if (loading) return <LoadingState label="Loading posts…" />;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (!posts || posts.length === 0) return <EmptyState title={emptyTitle} hint={emptyHint} />;

  return (
    <div className="post-list">
      {posts.map((p) => (
        <PostCard key={`${p.id}-${p.repostedBy || 'own'}`} post={p} onChange={onChange} />
      ))}
    </div>
  );
}
