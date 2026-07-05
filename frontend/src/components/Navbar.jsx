// Navbar.jsx — top bar: brand, (placeholder) search, and auth actions.
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Avatar from './Avatar';

export default function Navbar() {
  const { isAuthenticated, user, logout, loading } = useAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

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

      {/* Search is wired up by Track D; this is the shell slot. */}
      <div className="navbar__search">
        <input type="search" placeholder="Search events, posts, people…" aria-label="Search" disabled />
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
