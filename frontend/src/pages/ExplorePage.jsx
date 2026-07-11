// ExplorePage.jsx — the discovery hub: search across Rally, with what's trending
// shown until you type a query. Absorbs the old /search and /trending pages
// (issue #26); those routes redirect here and the navbar search lands here too.
import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import SearchBar from '../components/SearchBar';
import SearchResults from '../components/SearchResults';
import TrendingList from '../components/TrendingList';

const SEARCH_TABS = [
  { key: 'posts', label: 'Posts' },
  { key: 'users', label: 'People' },
  { key: 'events', label: 'Events' },
];

const TREND_TABS = [
  { key: 'posts', label: 'Posts' },
  { key: 'events', label: 'Events' },
  { key: 'categories', label: 'Categories' },
];

function TabStrip({ tabs, active, onSelect, label }) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={active === t.key}
          className={`tab ${active === t.key ? 'tab--active' : ''}`}
          onClick={() => onSelect(t.key)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export default function ExplorePage() {
  const [params, setParams] = useSearchParams();
  const query = params.get('q') || '';
  const [searchTab, setSearchTab] = useState('posts');
  const [trendTab, setTrendTab] = useState('posts');

  const handleSearch = useCallback(
    (nextQuery) => {
      if (nextQuery) {
        setParams({ q: nextQuery }, { replace: true });
      } else {
        setParams({}, { replace: true });
      }
    },
    [setParams]
  );

  return (
    <section className="page search-page">
      <h1 className="page__title">Explore</h1>
      <SearchBar
        value={query}
        onSearch={handleSearch}
        placeholder="Search events, posts, people..."
        className="search-bar--large"
      />

      {query ? (
        <>
          <TabStrip tabs={SEARCH_TABS} active={searchTab} onSelect={setSearchTab} label="Search result types" />
          <SearchResults tab={searchTab} query={query} />
        </>
      ) : (
        <>
          <h2 className="page__subtitle">🔥 Trending in the last 24 hours</h2>
          <TabStrip tabs={TREND_TABS} active={trendTab} onSelect={setTrendTab} label="Trending types" />
          <TrendingList type={trendTab} />
        </>
      )}
    </section>
  );
}
