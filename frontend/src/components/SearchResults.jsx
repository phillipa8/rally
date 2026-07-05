// SearchResults.jsx — tab-specific search results with loading/error states.
import dayjs from 'dayjs';
import { Link } from 'react-router-dom';
import { useApi } from '../api/hooks';
import EmptyState from './EmptyState';
import ErrorState from './ErrorState';
import LoadingState from './LoadingState';
import PostList from './PostList';
import UserCard from './UserCard';

function EventResult({ event }) {
  return (
    <article className="event-result">
      <div className="event-result__main">
        <p className="event-result__title">{event.title}</p>
        {event.description && <p className="event-result__description">{event.description}</p>}
        <p className="event-result__meta">
          <span className="chip">{event.category.name}</span>
          {' · '}
          {dayjs(event.startTime).format('MMM D, h:mm A')}
          {event.location ? ` · ${event.location}` : ''}
          {' · '}
          {event.participantCount} attending
        </p>
      </div>
      <Link to={`/u/${event.creator.username}`} className="event-result__creator">
        @{event.creator.username}
      </Link>
    </article>
  );
}

export default function SearchResults({ tab, query }) {
  const q = query.trim();
  const path = `/search/${tab}?q=${encodeURIComponent(q)}`;
  const { data, loading, error, refetch } = useApi(path, [tab, q], { enabled: q.length > 0 });

  if (!q) {
    return <EmptyState title="Search Rally" hint="Look for posts, people, and events." />;
  }

  if (tab === 'posts') {
    return (
      <PostList
        posts={data?.posts}
        loading={loading}
        error={error}
        onRetry={refetch}
        onChange={refetch}
        emptyTitle="No matching posts"
        emptyHint="Try a different word or phrase."
      />
    );
  }

  if (loading) return <LoadingState label="Searching..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  if (tab === 'users') {
    const users = data?.users || [];
    if (!users.length) return <EmptyState title="No matching people" hint="Try a username or display name." />;
    return (
      <div className="search-results">
        {users.map((user) => (
          <UserCard
            key={user.id}
            user={user}
            followStatus={user.followStatus}
            showFollow={!user.isMe}
          />
        ))}
      </div>
    );
  }

  const events = data?.events || [];
  if (!events.length) return <EmptyState title="No matching events" hint="Try an event title, topic, or location." />;
  return (
    <div className="search-results">
      {events.map((event) => (
        <EventResult key={event.id} event={event} />
      ))}
    </div>
  );
}
