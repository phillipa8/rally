// App.jsx — providers + client-side routing for the whole app.
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import AppLayout from './components/AppLayout';
import ProtectedRoute from './components/ProtectedRoute';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ProfilePage from './pages/ProfilePage';
import NotificationsPage from './pages/NotificationsPage';
import TrendingPage from './pages/TrendingPage';
import PlaceholderPage from './pages/PlaceholderPage';
import NotFoundPage from './pages/NotFoundPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Auth pages (no app shell) */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* In-app pages (navbar + sidebar shell) */}
          <Route element={<AppLayout />}>
            <Route
              index
              element={
                <ProtectedRoute>
                  <HomePage />
                </ProtectedRoute>
              }
            />
            {/* Public discovery pages (feature tracks fill these in) */}
            <Route path="explore" element={<PlaceholderPage title="Explore" />} />
            <Route path="calendar" element={<PlaceholderPage title="Calendar" />} />
            <Route path="search" element={<PlaceholderPage title="Search" />} />
            <Route path="trending" element={<TrendingPage />} />

            {/* Protected pages */}
            <Route
              path="notifications"
              element={
                <ProtectedRoute>
                  <NotificationsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="bookmarks"
              element={
                <ProtectedRoute>
                  <PlaceholderPage title="Bookmarks" />
                </ProtectedRoute>
              }
            />
            <Route
              path="profile"
              element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              }
            />
            {/* Public profiles keyed by username (private posts gated server-side) */}
            <Route path="u/:username" element={<ProfilePage />} />

            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
