// NotFoundPage.jsx — 404 for unknown in-app routes.
import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <section className="page page--center">
      <h1 className="page__title">404</h1>
      <p>That page doesn't exist.</p>
      <Link to="/" className="btn">
        Back home
      </Link>
    </section>
  );
}
