// CategoryFilterBar.jsx — a pill list to filter events/posts by category (Owner: Member C).
// 'value' is either a category slug when selected or "all categories" when null.
// It is used above the calendar and on the discovery/browse pages.
// Fails quiet-but-visible: on error it shows a retry pill
// instead of blocking the page it sits on.

import { useApi } from '../api/hooks';

export default function CategoryFilterBar({ value, onChange }) {
  const { data, loading, error, refetch } = useApi('/categories');
  const categories = data?.categories || [];

  if (loading) {
    return (
      <div className="filter-bar" aria-busy="true">
        <span className="muted">Loading categories…</span>
      </div>
    );
  }
  if (error) {
    return (
      <div className="filter-bar">
        <span className="form__error">{error}</span>
        <button type="button" className="filter-pill" onClick={refetch}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="filter-bar" role="group" aria-label="Filter by category">
      <button
        type="button"
        className={`filter-pill${value == null ? ' filter-pill--active' : ''}`}
        onClick={() => onChange(null)}
      >
        All
      </button>
      {categories.map((c) => (
        <button
          key={c.id}
          type="button"
          className={`filter-pill${value === c.slug ? ' filter-pill--active' : ''}`}
          onClick={() => onChange(c.slug)}
        >
          {c.name}
        </button>
      ))}
    </div>
  );
}