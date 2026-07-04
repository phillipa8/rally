// ExplorePage.jsx — public feed of posts from public accounts (Owner: Member B).
import { useApi } from '../api/hooks';
import PostList from '../components/PostList';

export default function ExplorePage() {
  const { data, loading, error, refetch } = useApi('/feed/explore');
  return (
    <section className="page">
      <h1 className="page__title">Explore</h1>
      <PostList
        posts={data?.posts}
        loading={loading}
        error={error}
        onRetry={refetch}
        onChange={refetch}
        emptyTitle="Nothing to explore yet"
        emptyHint="Public posts from around Rally will show up here."
      />
    </section>
  );
}
