// App.jsx — providers + client-side routing for the whole app.
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import AppLayout from './components/AppLayout';
import ProtectedRoute from './components/ProtectedRoute';
import HomeFeedPage from './pages/HomeFeedPage';
import ExplorePage from './pages/ExplorePage';
import BookmarksPage from './pages/BookmarksPage';
import PostDetailPage from './pages/PostDetailPage';
import MessagesPage from './pages/MessagesPage';
import EventsPage from './pages/EventsPage';
import EventDetailPage from './pages/EventDetailPage';
import CategoryPage from './pages/CategoryPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ProfilePage from './pages/ProfilePage';
import NotificationsPage from './pages/NotificationsPage';
import SettingsPage from './pages/SettingsPage';
import NotFoundPage from './pages/NotFoundPage';

// Search and Trending merged into Explore (issue #26); forward the old URLs.
// Keeps ?q= intact so bookmarked /search?q=… links still work.
function SearchRedirect() {
  const { search } = useLocation();
  return <Navigate to={`/explore${search}`} replace />;
}

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
                  <HomeFeedPage />
                </ProtectedRoute>
              }
            />
            {/* Public discovery pages */}
            <Route path="explore" element={<ExplorePage />} />
            {/* Calendar now lives inside the events hub; keep the old path working. */}
            <Route path="calendar" element={<Navigate to="/events" replace />} />
            {/* Search + Trending now live inside Explore; keep the old paths working. */}
            <Route path="search" element={<SearchRedirect />} />
            <Route path="trending" element={<Navigate to="/explore" replace />} />

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
                  <BookmarksPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="messages"
              element={
                <ProtectedRoute>
                  <MessagesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="messages/:username"
              element={
                <ProtectedRoute>
                  <MessagesPage />
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
            {/* Single post view (Member D extends with the reply thread) */}
            <Route path="posts/:id" element={<PostDetailPage />} />
            {/* Events: browse/create hub + single event (public read, create requires auth) */}
            <Route path="events" element={<EventsPage />} />
            <Route path="events/:id" element={<EventDetailPage />} />
            {/* Browse one category's events + posts */}
            <Route path="category/:slug" element={<CategoryPage />} />
            <Route
              path="settings"
              element={
                <ProtectedRoute>
                  <SettingsPage />
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
