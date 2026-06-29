// HomePage.jsx — authenticated landing. In Phase 0 it confirms the foundation works
// (auth round-trip + a live API call via useApi). Track B replaces this with the feed.
import { useAuth } from '../context/AuthContext';
import { useApi } from '../api/hooks';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import Avatar from '../components/Avatar';

export default function HomePage() {
  const { user } = useAuth();
  // Demonstrates the loading/error pattern against a real endpoint.
  const { data, loading, error, refetch } = useApi('/health');

  return (
    <section className="page">
      <div className="card welcome">
        <Avatar user={user} size={56} />
        <div>
          <h1 className="welcome__title">Welcome, {user.displayName}!</h1>
          <p className="welcome__sub">You're logged in as @{user.username}.</p>
        </div>
      </div>

      <div className="card">
        <h2>API status</h2>
        {loading && <LoadingState label="Pinging the API…" />}
        {error && <ErrorState message={error} onRetry={refetch} />}
        {data && (
          <p className="api-ok">
            ✅ <code>{data.service}</code> — <strong>{data.status}</strong> @ {data.time}
          </p>
        )}
      </div>

      <div className="card">
        <h2>Phase 0 foundation is ready 🎉</h2>
        <p>The shared infrastructure is in place. Feature tracks build on top of it:</p>
        <ul className="checklist">
          <li>✅ Auth (register / login / logout), session cookie, persisted across refresh</li>
          <li>✅ API client + <code>useApi</code> / <code>useMutation</code> (loading + error on every call)</li>
          <li>✅ App shell, routing, protected routes, shared UI states</li>
          <li>⏭️ Next: posts &amp; feed, events &amp; calendar, engagement &amp; search, notifications</li>
        </ul>
        <p className="muted">Foundation ready — feature tracks are in progress.</p>
      </div>
    </section>
  );
}
