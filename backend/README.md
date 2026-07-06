# Rally API

REST API for the Rally event-centered microblogging app.
Node.js (ESM) + Express 5 + SQLite (better-sqlite3). Auth via httpOnly session cookie.

**Live API:** https://rally-api-xwg8.onrender.com — health check at `/api/health`.
(Free tier: sleeps after ~15 min idle, so the first request may take ~50s to wake.)
Pushes to `main` touching `backend/` auto-deploy via GitHub Actions → Render Deploy Hook
(`.github/workflows/deploy-backend.yml`).

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

### Posts, feed, media, bookmarks — `routes/posts.js`, `routes/feed.js`, `routes/media.js`, `routes/bookmarks.js`  (Owner: Member B)
Every post is returned in a shared shape (`lib/postQuery.js`): `{ id, content, mediaUrl, eventId, parentPostId, createdAt, author:{id,username,displayName,avatarUrl}, likeCount, repostCount, replyCount, bookmarkCount, likedByMe, repostedByMe, bookmarkedByMe }`. Private authors' posts are gated by `visiblePostsWhere`.

| Method | URL | Auth | Body | Response |
|---|---|---|---|---|
| POST | `/api/posts` | 🔒 | `{ content (1–280), eventId?, parentPostId?, mediaUrl? }` | 201 `{ post }`. 400 on empty/>280 or invalid eventId/parentPostId. |
| GET | `/api/posts/:id` | ⚪ | — | `{ post }`. 404 if not found or hidden (private author). |
| DELETE | `/api/posts/:id` | 🔒 | — | 204 (author). 403 if not the author, 404 if missing. |
| GET | `/api/feed` | 🔒 | — | `{ posts }` — reverse-chron top-level posts from you + accepted-followed, incl. reposts (`repostedBy`). **401 if unauthenticated.** |
| GET | `/api/feed/explore` | 🌐 | — | `{ posts }` — recent top-level posts from public accounts only. |
| POST | `/api/media` | 🔒 | `multipart/form-data`, field `image` (≤5MB, `image/*`) | 201 `{ url }`. 400 on non-image / too large / missing. |
| GET | `/api/bookmarks` | 🔒 | — | `{ posts }` — your saved posts, newest bookmark first. |
| POST | `/api/posts/:id/bookmark` | 🔒 | — | 201 `{ bookmarked: true }` (idempotent). 404 if post missing. |
| DELETE | `/api/posts/:id/bookmark` | 🔒 | — | 204 (idempotent). 404 if post missing. |

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
| POST | `/api/posts/:id/like` | 🔒 | — | 201/200 `{ liked:true, likeCount }` — idempotent; emits `like` notification to the author unless liking your own post. 404 if missing/hidden. |
| DELETE | `/api/posts/:id/like` | 🔒 | — | 204 — idempotent unlike. 404 if missing/hidden. |
| GET | `/api/posts/:id/likes` | ⚪ | — | `{ users:[{ id, username, displayName, avatarUrl, likedAt }] }` newest first. 404 if missing/hidden. |
| POST | `/api/posts/:id/repost` | 🔒 | — | 201/200 `{ reposted:true, repostCount }` — idempotent; emits `repost` notification unless reposting your own post. 404 if missing/hidden. |
| DELETE | `/api/posts/:id/repost` | 🔒 | — | 204 — idempotent unrepost. 404 if missing/hidden. |
| GET | `/api/posts/:id/replies` | ⚪ | — | `{ replies:[…post] }` direct replies, oldest first; private-gated. 404 if parent missing/hidden. |
| GET | `/api/search/posts` | ⚪ | query: `q` | `{ posts:[…post] }` FTS5 first, LIKE fallback, private-gated. |
| GET | `/api/search/users` | 🌐 | query: `q` | `{ users:[{ id, username, displayName, bio, avatarUrl, isPrivate, followStatus, isMe }] }`. |
| GET | `/api/search/events` | 🌐 | query: `q` | `{ events:[…] }` FTS5 first, LIKE fallback. |

### Notifications & trending — `routes/notifications.js`, `routes/trending.js`  (Owner: Member A)
| Method | URL | Auth | Body | Response |
|---|---|---|---|---|
| GET | `/api/notifications` | 🔒 | — | `{ notifications:[{ id, type, isRead, createdAt, postId, eventId, actor }] }` — own notifications, newest first (latest 50); `actor` null for system rows. |
| GET | `/api/notifications/unread-count` | 🔒 | — | `{ count }` — number of unread notifications (badge). |
| PUT | `/api/notifications/:id/read` | 🔒 | — | `{ id, isRead:true }`. Own rows only; 404 if not found/not yours. |
| PUT | `/api/notifications/read-all` | 🔒 | — | `{ updated }` — count of rows marked read. |
| GET | `/api/trending/posts` | 🌐 | — | `{ posts:[{…post, likes, reposts, score}] }` — top-level posts by (likes+reposts) in last 24h, visibility-gated, top 20. |
| GET | `/api/trending/events` | 🌐 | — | `{ events:[{…event, categoryName, participantCount, newParticipants, shares, score}] }` — by 24h participants+shares, top 20. |
| GET | `/api/trending/categories` | 🌐 | — | `{ categories:[{ id, slug, name, newEvents, shares, newParticipants, score }] }` — all 6, ranked by 24h activity. |

### System
| Method | URL | Auth | Body | Response |
|---|---|---|---|---|
| GET | `/api/health` | 🌐 | — | `{ "status": "ok", "service": "rally-api", "time": "..." }` |
