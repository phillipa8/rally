// TrendingList.jsx — the ranked list for one trending tab (Owner: Member A).
// `type` is 'posts' | 'events' | 'categories'; it fetches /trending/:type and
// renders the matching layout. Public endpoint, so it works logged out too.
// (PostCard/EventCard from tracks B/C will later replace the inline previews.)
import dayjs from 'dayjs';
import { Link } from 'react-router-dom';
import { useApi } from '../api/hooks';
import { formatDate } from '../lib/time';
import LoadingState from './LoadingState';
import ErrorState from './ErrorState';
import EmptyState from './EmptyState';

// Rank badge (#1, #2, …) shown to the left of every trending row.
function Rank({ n }) {
  return <span className="trending__rank">#{n}</span>;
}

// Each row links to its detail surface. The whole row is the click target (a single
// Link), so inner links are kept as plain text to avoid invalid nested anchors —
// e.g. the post row's author becomes text; open the post to reach the author.
function PostRow({ post, rank }) {
  return (
    <Link className="trending__row" to={`/posts/${post.id}`}>
      <Rank n={rank} />
      <div className="trending__main">
        <p className="trending__content">{post.content}</p>
        <p className="trending__meta">
          @{post.username}
          {' · '}
          {formatDate(post.createdAt, 'MMM D')}
        </p>
      </div>
      <span className="trending__score" title="Likes + reposts in the last 24h">
        🔥 {post.score}
      </span>
    </Link>
  );
}

function EventRow({ event, rank }) {
  return (
    <Link className="trending__row" to={`/events/${event.id}`}>
      <Rank n={rank} />
      <div className="trending__main">
        <p className="trending__content">{event.title}</p>
        <p className="trending__meta">
          <span className="chip">{event.categoryName}</span>
          {' · '}
          {dayjs(event.startTime).format('MMM D, h:mm A')}
          {' · '}
          {event.participantCount} attending
        </p>
      </div>
      <span className="trending__score" title="New participants + shares in the last 24h">
        🔥 {event.score}
      </span>
    </Link>
  );
}

function CategoryRow({ category, rank }) {
  return (
    <Link className="trending__row" to={`/category/${category.slug}`}>
      <Rank n={rank} />
      <div className="trending__main">
        <p className="trending__content">{category.name}</p>
        <p className="trending__meta">
          {category.newEvents} new events · {category.shares} shares · tap to see events
        </p>
      </div>
      <span className="trending__score" title="Activity in the last 24h">
        🔥 {category.score}
      </span>
    </Link>
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

  if (type === 'events') {
    const events = data?.events || [];
    if (!events.length) return <EmptyState title="No trending events" hint="Events gaining participants in the last 24 hours show up here." />;
    return (
      <div className="trending">
        {events.map((e, i) => (
          <EventRow key={e.id} event={e} rank={i + 1} />
        ))}
      </div>
    );
  }

  if (type === 'categories') {
    // Categories are the fixed set, always returned; hide any with zero 24h activity.
    const categories = (data?.categories || []).filter((c) => c.score > 0);
    if (!categories.length) return <EmptyState title="No category activity yet" hint="Categories heat up as people post and join events." />;
    return (
      <div className="trending">
        {categories.map((c, i) => (
          <CategoryRow key={c.id} category={c} rank={i + 1} />
        ))}
      </div>
    );
  }

  return null;
}
