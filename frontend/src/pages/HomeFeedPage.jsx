// HomeFeedPage.jsx — the authenticated home: composer + Following / For You tabs
// (Owner: Member B). "Following" is the classic reverse-chron feed of accounts you
// follow; "For You" surfaces recent public posts from all of Rally (issue #26).
import { useState } from 'react';
import { useApi } from '../api/hooks';
import ComposePost from '../components/ComposePost';
import PostList from '../components/PostList';

const TABS = [
  { key: 'following', label: 'Following', path: '/feed' },
  { key: 'foryou', label: 'For You', path: '/feed/explore' },
];

export default function HomeFeedPage() {
  const [tab, setTab] = useState('following');
  const active = TABS.find((t) => t.key === tab);
  const { data, loading, error, refetch } = useApi(active.path, [tab]);

  return (
    <section className="page">
      <ComposePost onPosted={refetch} />

      <div className="tabs" role="tablist" aria-label="Home feed">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={`tab ${tab === t.key ? 'tab--active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <PostList
        posts={data?.posts}
        loading={loading}
        error={error}
        onRetry={refetch}
        onChange={refetch}
        emptyTitle={tab === 'following' ? 'Your feed is empty' : 'Nothing here yet'}
        emptyHint={
          tab === 'following'
            ? 'Follow people or post something to get started.'
            : 'Public posts from around Rally will show up here.'
        }
      />
    </section>
  );
}
