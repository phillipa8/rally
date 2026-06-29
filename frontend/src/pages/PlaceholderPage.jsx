// PlaceholderPage.jsx — temporary page for routes a feature track will build.
// Keeps navigation working from day one without crashing on missing pages.
import EmptyState from '../components/EmptyState';

export default function PlaceholderPage({ title = 'Coming soon' }) {
  return (
    <section className="page">
      <h1 className="page__title">{title}</h1>
      <EmptyState
        title={`${title} is on the way`}
        hint="This page is part of an upcoming feature track."
      />
    </section>
  );
}
