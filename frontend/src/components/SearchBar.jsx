// SearchBar.jsx — debounced search input shared by Navbar and SearchPage.
import { useEffect, useState } from 'react';

export default function SearchBar({
  value = '',
  onSearch,
  placeholder = 'Search posts, people, events...',
  autoFocus = false,
  className = '',
  clearOnSearch = false,
  debounce = true,
  showButton = false,
}) {
  const [text, setText] = useState(value);

  useEffect(() => {
    setText(value);
  }, [value]);

  useEffect(() => {
    if (!debounce) return undefined;
    const next = text.trim();
    if (next === value.trim()) return undefined;
    const timer = setTimeout(() => {
      onSearch?.(next);
      if (clearOnSearch && next) setText('');
    }, 350);
    return () => clearTimeout(timer);
  }, [text, value, onSearch, clearOnSearch, debounce]);

  function submit(e) {
    e.preventDefault();
    const next = text.trim();
    onSearch?.(next);
    if (clearOnSearch && next) setText('');
  }

  return (
    <form className={`search-bar ${className}`.trim()} role="search" onSubmit={submit}>
      <input
        type="search"
        value={text}
        placeholder={placeholder}
        aria-label="Search"
        autoFocus={autoFocus}
        onChange={(e) => setText(e.target.value)}
      />
      {showButton && (
        <button type="submit" className="search-bar__button" aria-label="Search">
          Search
        </button>
      )}
    </form>
  );
}
