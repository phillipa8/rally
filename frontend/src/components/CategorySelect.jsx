// CategorySelect.jsx — deploys a labeled <select> dropdown which covers the fixed categories (Owner: Member C).
// Used inside EventForm; value/onChange work on the category ID (what the events API expects). 
// Renders its own loading/error message and a "retry" button.

import { useApi } from '../api/hooks';

export default function CategorySelect({ value, onChange, disabled = false }) {
  const { data, loading, error, refetch } = useApi('/categories');
  const categories = data?.categories || [];

  if (error) {
    return (
      <label className="field">
        Category
        <p className="form__error">
          {error}{' '}
          <button type="button" className="btn btn--small btn--ghost" onClick={refetch}>
            Retry
          </button>
        </p>
      </label>
    );
  }

  return (
    <label className="field">
      Category
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        disabled={disabled || loading}
        required
      >
        <option value="" disabled>
          {loading ? 'Loading categories…' : 'Pick a category'}
        </option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </label>
  );
}