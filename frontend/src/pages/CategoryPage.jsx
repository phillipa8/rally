// CategoryPage.jsx — browse events + posts for a single category (Owner: Member C).
// It is reached at /category/:slug. The filter bar switches categories via navigation.

import { useParams, useNavigate } from 'react-router-dom';
import { useApi } from '../api/hooks';
import CategoryFilterBar from '../components/CategoryFilterBar';
import EventCard from '../components/EventCard';
import PostList from '../components/PostList';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';

export default function CategoryPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const eventsApi = useApi(`/events?category=${slug}`, [slug]);
  const postsApi = useApi(`/categories/${slug}/posts`, [slug]);

  const events = eventsApi.data?.events || [];
  const category = postsApi.data?.category;

  return (
    <section className="page">
      <h1 className="page__title">{category ? category.name : `#${slug}`}</h1>
      <CategoryFilterBar value={slug} onChange={(s) => navigate(s ? `/category/${s}` : '/explore')} />

      <h2 className="page__subtitle">Events</h2>
      {eventsApi.loading && <LoadingState label="Loading events…" />}
      {eventsApi.error && <ErrorState message={eventsApi.error} onRetry={eventsApi.refetch} />}
      {!eventsApi.loading && !eventsApi.error &&
        (events.length === 0 ? (
          <EmptyState title="No events in this category yet" />
        ) : (
          <div className="event-list">
            {events.map((e) => (
              <EventCard key={e.id} event={e} participantCount={e.participantCount} />
            ))}
          </div>
        ))}

      <h2 className="page__subtitle">Posts</h2>
      <PostList
        posts={postsApi.data?.posts}
        loading={postsApi.loading}
        error={postsApi.error}
        onRetry={postsApi.refetch}
        onChange={postsApi.refetch}
        emptyTitle="No posts in this category yet"
      />
    </section>
  );
}
