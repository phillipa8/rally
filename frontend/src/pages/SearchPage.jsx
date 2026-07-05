// SearchPage.jsx — public search across posts, users, and events.
import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import SearchBar from '../components/SearchBar';
import SearchResults from '../components/SearchResults';

const TABS = [
  { key: 'posts', label: 'Posts' },
  { key: 'users', label: 'People' },
  { key: 'events', label: 'Events' },
];

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const query = params.get('q') || '';
  const [tab, setTab] = useState('posts');

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
      <h1 className="page__title">Search</h1>
      <SearchBar value={query} onSearch={handleSearch} autoFocus className="search-bar--large" />

      <div className="tabs" role="tablist" aria-label="Search result types">
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

      <SearchResults tab={tab} query={query} />
    </section>
  );
}
