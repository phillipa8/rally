// ThemeToggle.jsx — light/dark mode switch shown in the navbar.
// The initial theme is applied before first paint in main.jsx (localStorage
// 'rally-theme', falling back to the OS prefers-color-scheme); this button
// just flips the <html data-theme> attribute and persists the choice.
import { useState } from 'react';

export default function ThemeToggle() {
  const [theme, setTheme] = useState(document.documentElement.dataset.theme || 'light');

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('rally-theme', next);
    setTheme(next);
  };

  const label = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  return (
    <button
      type="button"
      className="btn btn--small btn--ghost theme-toggle"
      onClick={toggle}
      title={label}
      aria-label={label}
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  );
}
