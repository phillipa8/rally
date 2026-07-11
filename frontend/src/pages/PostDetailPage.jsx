// PostDetailPage.jsx — a single post plus its reply thread.
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useApi } from '../api/hooks';
import { useAuth } from '../context/AuthContext';
import PostCard from '../components/PostCard';
import ReplyComposer from '../components/ReplyComposer';
import ThreadView from '../components/ThreadView';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';

export default function PostDetailPage() {
  const { id } = useParams();
  const { user, loading: authLoading } = useAuth();
  const { data, loading, error, refetch } = useApi(`/posts/${id}`, [id]);
  const [threadVersion, setThreadVersion] = useState(0);

  function refreshThread() {
    refetch();
    setThreadVersion((v) => v + 1);
  }

  // Wait for the session probe too, so the replies-off gate below never flashes
  // the "turned off" notice at the post's own author.
  if (loading || authLoading) return <LoadingState label="Loading post…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!data?.post) return <EmptyState title="Post not found" />;

  return (
    <section className="page">
      <PostCard post={data.post} onChange={refreshThread} />
      {data.post.commentsDisabled && user?.id !== data.post.author?.id ? (
        <div className="card reply-composer reply-composer--signed-out">
          <p className="reply-composer__hint">🚫 Replies are turned off for this post.</p>
        </div>
      ) : (
        <ReplyComposer parentPost={data.post} onPosted={refreshThread} />
      )}
      <ThreadView postId={id} refreshKey={threadVersion} onChange={refreshThread} />
    </section>
  );
}
