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
| GET | `/api/users/:username` | ⚪ | — | `{ user, counts:{followers,following,posts}, isMe, followStatus }` where `followStatus` ∈ `accepted`\|`pending`\|`null`. 404 if unknown. |
| GET | `/api/users/:username/posts` | ⚪ | — | `{ posts:[…] }` top-level posts, newest first; private authors gated (owner/accepted follower only). 404 if unknown. |
| PUT | `/api/users/me` | 🔒 | `{ displayName?, bio?, isPrivate? }` (≥1 field) | `{ user }`. Setting `isPrivate:false` auto-accepts pending requests. 400 if empty/invalid. |
| GET | `/api/users/:username/followers` | ⚪ | — | `{ users:[…] }` accepted followers. 404 if unknown. |
| GET | `/api/users/:username/following` | ⚪ | — | `{ users:[…] }` accepted follows. 404 if unknown. |
| POST | `/api/users/:username/follow` | 🔒 | — | 201 `{ status }` — `accepted` (public) or `pending` (private); emits `follow`/`follow_request` notification. Idempotent. 400 self-follow, 404 unknown. |
| DELETE | `/api/users/:username/follow` | 🔒 | — | 204 — unfollow or cancel a pending request (idempotent). 404 unknown. |
| GET | `/api/follow-requests` | 🔒 | — | `{ requests:[{…user, requestedAt}] }` — incoming pending, newest first. |
| PUT | `/api/follow-requests/:id/accept` | 🔒 | — | `{ status:"accepted" }`; `:id` = requester's user id; notifies them (`follow`). 404 if no pending request. |
| PUT | `/api/follow-requests/:id/reject` | 🔒 | — | `{ status:"rejected" }`; removes the pending row. 404 if no pending request. |

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
