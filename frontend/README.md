# Rally Frontend

Client-side React app (Vite, no SSR) for the Rally event-centered microblogging platform.
Talks to the backend **exclusively via the REST API** (axios) — no direct DB access.

## Stack
- React 19 + Vite (`react` template, plain JSX)
- react-router-dom 7 (client-side routing)
- axios (single instance, `withCredentials: true`, 401 interceptor)
- dayjs (event times + calendar math)

## Run locally

```bash
cd frontend
cp .env.example .env          # set VITE_API_URL (default http://localhost:4000/api)
npm install
npm run dev                   # http://localhost:5173
```

The backend must be running first (see `../backend/README.md`).

## Conventions (Phase 0 foundation)
- **Every API call goes through `src/api/client.js`** and the `useApi` / `useMutation` hooks,
  which provide loading + error state for **every** request (no silent failures).
  Do **not** call `apiClient` directly from components.
- Auth is persisted by the httpOnly session cookie; `AuthContext` rehydrates via `GET /auth/me` on mount.
- Responsive: usable on mobile and desktop (sidebar → bottom tab bar; calendar → agenda list).

## Source layout
```
src/
├── api/          # axios client + useApi/useMutation hooks
├── context/      # AuthContext / AuthProvider
├── components/   # reusable, single-responsibility components
├── pages/        # route-level views
├── App.jsx       # router + providers + layout
└── main.jsx      # entry
```

## Component map (planned)
- **Shell/shared:** `AppLayout`, `Navbar`, `SidebarNav`, `LoadingState`, `ErrorState`, `EmptyState`, `Modal`, `Avatar`, `ProtectedRoute`
- **Identity/social (A):** `RegisterPage`, `LoginPage`, `ProfilePage`, `ProfileHeader`, `FollowButton`, `FollowRequestsPanel`, `UserCard`, `SettingsPage`, `PrivacyToggle`, `NotificationsPanel`, `NotificationItem`, `NotificationsPage`, `TrendingPage`, `TrendingList`
- **Content/feed (B):** `HomeFeedPage`, `ExplorePage`, `ComposePost`, `CharCounter`, `ImageUploader`, `PostCard`, `PostList`, `BookmarksPage`
- **Events/calendar (C):** `CalendarPage`, `CalendarGrid`, `CalendarDayCell`, `EventDetailPage`, `EventForm`, `EventCard`, `EventChip`, `ParticipateButton`, `CategoryFilterBar`, `CategorySelect`, `CategoryPage`
- **Engagement/search (D):** `PostDetailPage`, `ThreadView`, `ReplyComposer`, `PostActions`, `SearchBar`, `SearchResults`, `SearchPage`
