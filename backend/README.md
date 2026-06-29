# Rally API

REST API for the Rally event-centered microblogging app.
Node.js (ESM) + Express 5 + SQLite (better-sqlite3). Auth via httpOnly session cookie.

> **Status:** scaffold. Endpoints below are the agreed surface.
> Each endpoint owner fills in the **request body** and **example response** columns as they build.

## Run locally

```bash
cd backend
cp .env.example .env          # then edit values
npm install
npm run dev                   # nodemon -> http://localhost:4000
# health check:
curl http://localhost:4000/api/health
```

## Conventions

- Base URL: `http://localhost:4000/api`
- Auth: session cookie (sent automatically with `credentials: true`). Protected routes return **401** when not logged in.
- Validation: every `POST`/`PUT` body is validated (zod). Invalid input → **400** with `{ error, issues }`. Toggles on a missing `:id` → **404**.
- Content type: `application/json` except `POST /media` (multipart/form-data).

## Endpoints

Legend — **Auth**: 🔒 requires login · 🌐 public (private content filtered) · ⚪ optional auth.

### Auth — `routes/auth.js`  (Owner: Member A)
| Method | URL | Auth | Body | Response |
|---|---|---|---|---|
| POST | `/api/auth/register` | 🌐 | TODO | TODO |
| POST | `/api/auth/login` | 🌐 | TODO | TODO |
| POST | `/api/auth/logout` | 🔒 | — | TODO |
| GET  | `/api/auth/me` | ⚪ | — | TODO |

### Users & social graph — `routes/users.js`  (Owner: Member A)
| Method | URL | Auth | Body | Response |
|---|---|---|---|---|
| GET | `/api/users/:username` | ⚪ | — | TODO (profile + follower/following/post counts + isFollowedByMe) |
| GET | `/api/users/:username/posts` | ⚪ | — | TODO |
| PUT | `/api/users/me` | 🔒 | TODO (displayName, bio, isPrivate) | TODO |
| GET | `/api/users/:username/followers` | ⚪ | — | TODO |
| GET | `/api/users/:username/following` | ⚪ | — | TODO |
| POST | `/api/users/:username/follow` | 🔒 | — | TODO (→ accepted for public, pending for private) |
| DELETE | `/api/users/:username/follow` | 🔒 | — | TODO (unfollow / cancel request) |
| GET | `/api/follow-requests` | 🔒 | — | TODO (incoming pending) |
| PUT | `/api/follow-requests/:id/accept` | 🔒 | — | TODO |
| PUT | `/api/follow-requests/:id/reject` | 🔒 | — | TODO |

### Posts, feed, media, bookmarks — `routes/posts.js`, `routes/feed.js`, `routes/media.js`  (Owner: Member B)
| Method | URL | Auth | Body | Response |
|---|---|---|---|---|
| POST | `/api/posts` | 🔒 | TODO (content ≤280, optional eventId, parentPostId, mediaUrl) | TODO |
| GET | `/api/posts/:id` | ⚪ | — | TODO |
| DELETE | `/api/posts/:id` | 🔒 | — | TODO (owner → 204, else 403) |
| GET | `/api/feed` | 🔒 | — | TODO (reverse-chron, followed + self + reposts) |
| GET | `/api/feed/explore` | 🌐 | — | TODO (public accounts only) |
| POST | `/api/media` | 🔒 | multipart (single image ≤5MB) | TODO `{ url }` |
| GET | `/api/bookmarks` | 🔒 | — | TODO |
| POST | `/api/posts/:id/bookmark` | 🔒 | — | TODO |
| DELETE | `/api/posts/:id/bookmark` | 🔒 | — | TODO |

### Events, participation, calendar, categories — `routes/events.js`, `routes/categories.js`  (Owner: Member C)
| Method | URL | Auth | Body | Response |
|---|---|---|---|---|
| POST | `/api/events` | 🔒 | TODO (title, description, categoryId, start, end, location, ageRestriction) | TODO |
| GET | `/api/events` | ⚪ | query: `from`,`to`,`category` | TODO (calendar range + filter) |
| GET | `/api/events/:id` | ⚪ | — | TODO (+ participantCount, isParticipating, relatedPosts) |
| PUT | `/api/events/:id` | 🔒 | TODO | TODO (creator only; fires event_update notifications) |
| DELETE | `/api/events/:id` | 🔒 | — | TODO (creator only) |
| POST | `/api/events/:id/participate` | 🔒 | TODO (status) | TODO |
| DELETE | `/api/events/:id/participate` | 🔒 | — | TODO |
| GET | `/api/events/:id/participants` | ⚪ | — | TODO |
| GET | `/api/users/me/events/participating` | 🔒 | — | TODO |
| GET | `/api/categories` | 🌐 | — | TODO (fixed list) |
| GET | `/api/categories/:slug/posts` | ⚪ | — | TODO |

### Engagement & search — `routes/posts.js` (likes/reposts/replies), `routes/search.js`  (Owner: Member D)
| Method | URL | Auth | Body | Response |
|---|---|---|---|---|
| POST | `/api/posts/:id/like` | 🔒 | — | TODO |
| DELETE | `/api/posts/:id/like` | 🔒 | — | TODO |
| GET | `/api/posts/:id/likes` | ⚪ | — | TODO |
| POST | `/api/posts/:id/repost` | 🔒 | — | TODO |
| DELETE | `/api/posts/:id/repost` | 🔒 | — | TODO |
| GET | `/api/posts/:id/replies` | ⚪ | — | TODO (thread) |
| GET | `/api/search/posts` | ⚪ | query: `q` | TODO (FTS5, private-gated) |
| GET | `/api/search/users` | 🌐 | query: `q` | TODO |
| GET | `/api/search/events` | 🌐 | query: `q` | TODO (FTS5) |

### Notifications & trending — `routes/notifications.js`, `routes/trending.js`  (Owner: Member A)
| Method | URL | Auth | Body | Response |
|---|---|---|---|---|
| GET | `/api/notifications` | 🔒 | — | TODO |
| GET | `/api/notifications/unread-count` | 🔒 | — | TODO |
| PUT | `/api/notifications/:id/read` | 🔒 | — | TODO |
| PUT | `/api/notifications/read-all` | 🔒 | — | TODO |
| GET | `/api/trending/posts` | 🌐 | — | TODO (last 24h) |
| GET | `/api/trending/events` | 🌐 | — | TODO (last 24h) |
| GET | `/api/trending/categories` | 🌐 | — | TODO (last 24h) |

### System
| Method | URL | Auth | Body | Response |
|---|---|---|---|---|
| GET | `/api/health` | 🌐 | — | `{ "status": "ok", "service": "rally-api", "time": "..." }` |
