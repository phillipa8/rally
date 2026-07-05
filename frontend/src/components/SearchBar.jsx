// SearchBar.jsx — debounced search input shared by Navbar and SearchPage.
import { useEffect, useState } from 'react';

export default function SearchBar({
  value = '',
  onSearch,
  placeholder = 'Search posts, people, events...',
  autoFocus = false,
  className = '',
}) {
  const [text, setText] = useState(value);

  useEffect(() => {
    setText(value);
  }, [value]);

  useEffect(() => {
    const next = text.trim();
    if (next === value.trim()) return undefined;
    const timer = setTimeout(() => onSearch?.(next), 350);
    return () => clearTimeout(timer);
  }, [text, value, onSearch]);

  function submit(e) {
    e.preventDefault();
    onSearch?.(text.trim());
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
    </form>
  );
}
