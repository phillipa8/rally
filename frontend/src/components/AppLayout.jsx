// AppLayout.jsx — app shell shared by all in-app routes: navbar + sidebar + content.
// Uses react-router's <Outlet/> to render the active page.
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import SidebarNav from './SidebarNav';
import ErrorState from './ErrorState';
import { useAuth } from '../context/AuthContext';

export default function AppLayout() {
  const { authError, refresh } = useAuth();
  return (
    <div className="app">
      <Navbar />
      <div className="app__body">
        <SidebarNav />
        <main className="app__content">
          {authError && <ErrorState message={authError} onRetry={refresh} />}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
