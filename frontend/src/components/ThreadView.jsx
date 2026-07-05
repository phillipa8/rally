// ThreadView.jsx — direct replies for a post detail page.
import { useApi } from '../api/hooks';
import PostList from './PostList';

export default function ThreadView({ postId, refreshKey = 0, onChange }) {
  const { data, loading, error, refetch } = useApi(`/posts/${postId}/replies`, [postId, refreshKey]);

  return (
    <section className="thread">
      <h2 className="thread__title">Replies</h2>
      <PostList
        posts={data?.replies}
        loading={loading}
        error={error}
        onRetry={refetch}
        onChange={() => {
          refetch();
          onChange?.();
        }}
        emptyTitle="No replies yet"
        emptyHint="Be the first to continue the conversation."
      />
    </section>
  );
}
