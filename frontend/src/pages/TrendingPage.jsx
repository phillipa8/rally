// TrendingPage.jsx — public discovery of what's hot in the last 24h (Owner: Member A).
// Tabs switch between trending posts, events, and categories; each renders through
// the shared TrendingList. No auth required.
import { useState } from 'react';
import TrendingList from '../components/TrendingList';

const TABS = [
  { key: 'posts', label: 'Posts' },
  { key: 'events', label: 'Events' },
  { key: 'categories', label: 'Categories' },
];

export default function TrendingPage() {
  const [tab, setTab] = useState('posts');

  return (
    <section className="page">
      <h1 className="page__title">Trending</h1>

      <div className="tabs" role="tablist" aria-label="Trending categories">
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

      <TrendingList type={tab} />
    </section>
  );
}
