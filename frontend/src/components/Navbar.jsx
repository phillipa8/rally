// Navbar.jsx — top bar: brand, search, and auth actions.
import { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Avatar from './Avatar';
import SearchBar from './SearchBar';

export default function Navbar() {
  const { isAuthenticated, user, logout, loading } = useAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleSearch = useCallback(
    (query) => {
      if (!query) return;
      navigate(`/search?q=${encodeURIComponent(query)}`);
    },
    [navigate]
  );

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      navigate('/login');
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <header className="navbar">
      <Link to="/" className="navbar__brand">
        🗓️ Rally
      </Link>

      <div className="navbar__search">
        <SearchBar
          onSearch={handleSearch}
          placeholder="Search events, posts, people..."
          clearOnSearch
          debounce={false}
          showButton
        />
      </div>

      <nav className="navbar__actions">
        {loading ? (
          // Reserve space during the initial session probe to avoid an auth-state flicker.
          <span className="navbar__placeholder" aria-hidden="true" />
        ) : isAuthenticated ? (
          <>
            <span className="navbar__user">
              <Avatar user={user} size={32} />
              <span className="navbar__username">@{user.username}</span>
            </span>
            <button type="button" className="btn btn--small" onClick={handleLogout} disabled={loggingOut}>
              {loggingOut ? 'Logging out…' : 'Log out'}
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className="btn btn--small btn--ghost">
              Log in
            </Link>
            <Link to="/register" className="btn btn--small">
              Sign up
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
