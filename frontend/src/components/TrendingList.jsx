// TrendingList.jsx — the ranked list for one trending tab (Owner: Member A).
// `type` is 'posts' | 'events' | 'categories'; it fetches /trending/:type and
// renders the matching layout. Public endpoint, so it works logged out too.
// (PostCard/EventCard from tracks B/C will later replace the inline previews.)
import dayjs from 'dayjs';
import { Link } from 'react-router-dom';
import { useApi } from '../api/hooks';
import LoadingState from './LoadingState';
import ErrorState from './ErrorState';
import EmptyState from './EmptyState';

// Rank badge (#1, #2, …) shown to the left of every trending row.
function Rank({ n }) {
  return <span className="trending__rank">#{n}</span>;
}

function PostRow({ post, rank }) {
  return (
    <article className="trending__row">
      <Rank n={rank} />
      <div className="trending__main">
        <p className="trending__content">{post.content}</p>
        <p className="trending__meta">
          <Link to={`/u/${post.username}`}>@{post.username}</Link>
          {' · '}
          {dayjs(post.createdAt).format('MMM D')}
        </p>
      </div>
      <span className="trending__score" title="Likes + reposts in the last 24h">
        🔥 {post.score}
      </span>
    </article>
  );
}

export default function TrendingList({ type }) {
  const { data, loading, error, refetch } = useApi(`/trending/${type}`, [type]);

  if (loading) return <LoadingState label="Loading trending…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  if (type === 'posts') {
    const posts = data?.posts || [];
    if (!posts.length) return <EmptyState title="Nothing trending yet" hint="Popular posts from the last 24 hours show up here." />;
    return (
      <div className="trending">
        {posts.map((p, i) => (
          <PostRow key={p.id} post={p} rank={i + 1} />
        ))}
      </div>
    );
  }

  return null;
}
