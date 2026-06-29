// RegisterPage.jsx — create an account. Mirrors the backend zod rules for fast feedback.
import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { errorMessage } from '../api/client';

export default function RegisterPage() {
  const { register, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isAuthenticated) navigate('/', { replace: true });
  }, [isAuthenticated, navigate]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Light client-side checks (server is the source of truth).
    if (username.trim().length < 3) return setError('Username must be at least 3 characters');
    if (!displayName.trim()) return setError('Display name is required');
    if (password.length < 8) return setError('Password must be at least 8 characters');

    setLoading(true);
    try {
      await register({ username: username.trim(), displayName: displayName.trim(), password });
      navigate('/', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={onSubmit}>
        <h1 className="auth-card__title">Join Rally</h1>
        <p className="auth-card__subtitle">Create your account</p>

        {error && <p className="form__error" role="alert">{error}</p>}

        <label className="field">
          <span>Username</span>
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
          <small className="field__hint">3–30 chars: letters, numbers, underscores.</small>
        </label>
        <label className="field">
          <span>Display name</span>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} autoComplete="name" required />
        </label>
        <label className="field">
          <span>Password</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required />
          <small className="field__hint">At least 8 characters.</small>
        </label>

        <button type="submit" className="btn btn--block" disabled={loading}>
          {loading ? 'Creating account…' : 'Sign up'}
        </button>

        <p className="auth-card__alt">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </form>
    </div>
  );
}
