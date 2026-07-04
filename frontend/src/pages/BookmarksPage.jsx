// BookmarksPage.jsx — the current user's saved posts (Owner: Member B).
import { useApi } from '../api/hooks';
import PostList from '../components/PostList';

export default function BookmarksPage() {
  const { data, loading, error, refetch } = useApi('/bookmarks');
  return (
    <section className="page">
      <h1 className="page__title">Bookmarks</h1>
      <PostList
        posts={data?.posts}
        loading={loading}
        error={error}
        onRetry={refetch}
        onChange={refetch}
        emptyTitle="No bookmarks yet"
        emptyHint="Tap the bookmark icon on a post to save it here."
      />
    </section>
  );
}
