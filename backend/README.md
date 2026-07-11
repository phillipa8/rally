# Rally API

REST API for the Rally event-centered microblogging app.
Node.js (ESM) + Express 5 + SQLite (better-sqlite3). Auth via httpOnly session cookie.

**Live API:** https://rally-api-xwg8.onrender.com — health check at `/api/health`.
(Free tier: sleeps after ~15 min idle, so the first request may take ~50s to wake.)
Pushes to `main` touching `backend/` auto-deploy via GitHub Actions → Render Deploy Hook
(`.github/workflows/deploy-backend.yml`).

Every endpoint below is documented with its method, URL, authentication requirement,
request body, and example response.

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
The user object returned by these endpoints is `{ id, username, displayName, bio, avatarUrl, isPrivate, createdAt }` (never the password hash). A successful register or login sets the `connect.sid` httpOnly session cookie.

| Method | URL | Auth | Body | Response |
|---|---|---|---|---|
| POST | `/api/auth/register` | 🌐 | `{ username (3–30, letters/numbers/underscore), displayName (1–50), password (8–100) }` | 201 `{ user }` + session cookie. 400 on invalid fields; 409 if the username is taken. |
| POST | `/api/auth/login` | 🌐 | `{ username, password }` | 200 `{ user }` + session cookie. 401 on wrong username/password (constant-time, no user-enumeration). |
| POST | `/api/auth/logout` | 🔒 | — | 204 — destroys the session and clears the cookie. **401 if not logged in.** |
| GET  | `/api/auth/me` | ⚪ | — | 200 `{ user }` when a valid session exists, else 200 `{ user: null }`. Used on app load to rehydrate auth across refresh. |

**Example — `POST /api/auth/register`**
```jsonc
// request
{ "username": "maya_rivers", "displayName": "Maya Rivers", "password": "s3cret-passw0rd" }
// 201 response
{ "user": { "id": 1, "username": "maya_rivers", "displayName": "Maya Rivers",
            "bio": null, "avatarUrl": null, "isPrivate": false,
            "createdAt": "2026-07-11 14:57:13" } }
```

### Users & social graph — `routes/users.js`  (Owner: Member A)
| Method | URL | Auth | Body | Response |
|---|---|---|---|---|
| GET | `/api/users/:username` | ⚪ | — | `{ user, counts:{followers,following,posts}, isMe, followStatus }` where `followStatus` ∈ `accepted`\|`pending`\|`null`. 404 if unknown. |
| GET | `/api/users/:username/posts` | ⚪ | — | `{ posts:[…] }` top-level posts, newest first; private authors gated (owner/accepted follower only). 404 if unknown. |
| PUT | `/api/users/me` | 🔒 | `{ displayName?, bio?, avatarUrl?, isPrivate? }` (≥1 field) | `{ user }`. `avatarUrl:""` clears the picture (upload via `POST /media` first). Setting `isPrivate:false` auto-accepts pending requests. 400 if empty/invalid. |
| GET | `/api/users/:username/followers` | ⚪ | — | `{ users:[…] }` accepted followers. 404 if unknown. |
| GET | `/api/users/:username/following` | ⚪ | — | `{ users:[…] }` accepted follows. 404 if unknown. |
| POST | `/api/users/:username/follow` | 🔒 | — | 201 `{ status }` — `accepted` (public) or `pending` (private); emits `follow`/`follow_request` notification. Idempotent. 400 self-follow, 404 unknown. |
| DELETE | `/api/users/:username/follow` | 🔒 | — | 204 — unfollow or cancel a pending request (idempotent). 404 unknown. |
| GET | `/api/follow-requests` | 🔒 | — | `{ requests:[{…user, requestedAt}] }` — incoming pending, newest first. |
| PUT | `/api/follow-requests/:id/accept` | 🔒 | — | `{ status:"accepted" }`; `:id` = requester's user id; notifies them (`follow`). 404 if no pending request. |
| PUT | `/api/follow-requests/:id/reject` | 🔒 | — | `{ status:"rejected" }`; removes the pending row. 404 if no pending request. |

### Posts, feed, media, bookmarks — `routes/posts.js`, `routes/feed.js`, `routes/media.js`, `routes/bookmarks.js`  (Owner: Member B)
Every post is returned in a shared shape (`lib/postQuery.js`): `{ id, content, mediaUrl, eventId, parentPostId, commentsDisabled, createdAt, author:{id,username,displayName,avatarUrl}, likeCount, repostCount, replyCount, bookmarkCount, likedByMe, repostedByMe, bookmarkedByMe }`. Private authors' posts are gated by `visiblePostsWhere`.

| Method | URL | Auth | Body | Response |
|---|---|---|---|---|
| POST | `/api/posts` | 🔒 | `{ content (1–280), eventId?, parentPostId?, mediaUrl?, commentsDisabled? }` | 201 `{ post }`. 400 on empty/>280, invalid eventId/parentPostId, or `commentsDisabled` on a reply. 403 when replying to a replies-off post (the author may still reply). |
| GET | `/api/posts/:id` | ⚪ | — | `{ post }`. 404 if not found or hidden (private author). |
| DELETE | `/api/posts/:id` | 🔒 | — | 204 (author). 403 if not the author, 404 if missing. |
| GET | `/api/feed` | 🔒 | — | `{ posts }` — reverse-chron top-level posts from you + accepted-followed, incl. reposts (`repostedBy`). **401 if unauthenticated.** |
| GET | `/api/feed/explore` | 🌐 | — | `{ posts }` — recent top-level posts from public accounts only. |
| POST | `/api/media` | 🔒 | `multipart/form-data`, field `image` (≤5MB, `image/*`) | 201 `{ url }`. 400 on non-image / too large / missing. |
| GET | `/api/bookmarks` | 🔒 | — | `{ posts }` — your saved posts, newest bookmark first. |
| POST | `/api/posts/:id/bookmark` | 🔒 | — | 201 `{ bookmarked: true }` (idempotent). 404 if post missing. |
| DELETE | `/api/posts/:id/bookmark` | 🔒 | — | 204 (idempotent). 404 if post missing. |

### Events, participation, calendar, categories — `routes/events.js`, `routes/categories.js`  (Owner: Member C)
Events can be **private**: visible only to their creator and the creator's accepted followers
(`visibleEventsWhere` gates every event-returning query — hidden events 404 like missing ones).
`isPrivate` defaults to the creator's account privacy setting.

| Method | URL | Auth | Body | Response |
|---|---|---|---|---|
| POST | `/api/events` | 🔒 | `{ title (1–120), description?, categoryId, startTime, endTime, location?, ageRestriction?, isPrivate? }` (times: `YYYY-MM-DD HH:MM:SS` UTC) | 201 `{ event }`. 400 on bad category/times. |
| GET | `/api/events` | ⚪ | query: `from`,`to`,`category` (slug or id) | `{ events:[…] }` calendar range + filter, each with `participantCount`, start-time asc. |
| GET | `/api/events/:id` | ⚪ | — | `{ event, participantCount, isParticipating, relatedPosts }`. 404 if missing/hidden. |
| PUT | `/api/events/:id` | 🔒 | any subset of the POST fields (≥1) | `{ event }` (creator only; notifies participants who can still see it). 403 not creator, 404 missing. |
| DELETE | `/api/events/:id` | 🔒 | — | 204 (creator only; shared posts survive, losing their event link). |
| POST | `/api/events/:id/participate` | 🔒 | `{ status? }` ∈ going\|interested\|not_going (default going) | 201/200 `{ status, participating, participantCount }`; notifies the creator on first RSVP. 404 if missing/hidden. |
| DELETE | `/api/events/:id/participate` | 🔒 | — | 204 — withdraw RSVP (idempotent). 404 if missing/hidden. |
| GET | `/api/events/:id/participants` | ⚪ | — | `{ participants:[{…user, status}] }` newest first. 404 if missing/hidden. |
| GET | `/api/events/me/participating` | 🔒 | — | `{ events:[…] }` your going/interested events, soonest first. |
| GET | `/api/events/discover` | ⚪ | query: `sort` ∈ upcoming\|popular | `{ events:[…] }` up to 10 not-yet-ended events. |
| GET | `/api/categories` | 🌐 | — | `{ categories:[{id, slug, name}] }` fixed list of 6. |
| GET | `/api/categories/:slug/posts` | ⚪ | — | `{ category, posts:[…] }` posts sharing this category's events. 404 unknown slug. |

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
| POST | `/api/admin/import` | 🔑 | fixture payload (users, follows, events, posts, engagement, DMs, notifications) | Token-gated bulk fixture loader for demo/staging DBs; **404 unless the `ADMIN_TOKEN` env var is set** and a matching `x-admin-token` header is sent. 201 `{ imported: {…counts} }`. |
