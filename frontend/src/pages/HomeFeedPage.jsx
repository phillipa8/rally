// HomeFeedPage.jsx — the authenticated home feed + composer (Owner: Member B).
import { useApi } from '../api/hooks';
import ComposePost from '../components/ComposePost';
import PostList from '../components/PostList';

export default function HomeFeedPage() {
  const { data, loading, error, refetch } = useApi('/feed');
  return (
    <section className="page">
      <ComposePost onPosted={refetch} />
      <PostList
        posts={data?.posts}
        loading={loading}
        error={error}
        onRetry={refetch}
        onChange={refetch}
        emptyTitle="Your feed is empty"
        emptyHint="Follow people or post something to get started."
      />
    </section>
  );
}
