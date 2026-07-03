// NotificationsPage.jsx — route-level view for /notifications (Owner: Member A).
// Thin wrapper: the panel owns the data + actions so it can be reused elsewhere.
import NotificationsPanel from '../components/NotificationsPanel';

export default function NotificationsPage() {
  return (
    <section className="page">
      <h1 className="page__title">Notifications</h1>
      <NotificationsPanel />
    </section>
  );
}
