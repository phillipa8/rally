// App.jsx — providers + client-side routing for the whole app.
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import AppLayout from './components/AppLayout';
import ProtectedRoute from './components/ProtectedRoute';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
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
            <Route path="trending" element={<PlaceholderPage title="Trending" />} />

            {/* Protected pages */}
            <Route
              path="notifications"
              element={
                <ProtectedRoute>
                  <PlaceholderPage title="Notifications" />
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
                  <PlaceholderPage title="Profile" />
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
