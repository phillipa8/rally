// PostDetailPage.jsx — a single post view (Owner: Member B; minimal).
// Member D extends the replies section below with the threaded ThreadView.
import { useParams } from 'react-router-dom';
import { useApi } from '../api/hooks';
import PostCard from '../components/PostCard';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';

export default function PostDetailPage() {
  const { id } = useParams();
  const { data, loading, error, refetch } = useApi(`/posts/${id}`, [id]);

  if (loading) return <LoadingState label="Loading post…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!data?.post) return <EmptyState title="Post not found" />;

  return (
    <section className="page">
      <PostCard post={data.post} onChange={refetch} />
      {/* Member D replaces this with the reply composer + ThreadView. */}
      <EmptyState title="Replies coming soon" hint="Threaded replies are part of an upcoming update." />
    </section>
  );
}
