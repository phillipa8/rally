# Rally — Design Document

> Submitted as PDF on the LMS. Target **800–1200 words + diagrams**. This is a concise
> technical record of design decisions, not a report. Fill each section below; owners noted
> in italics (Member A–D — no real names in the document). Delete these quote blocks before export.

---

## 2.1 Application Overview  *(owner: Member B + all)*
> What the platform does, who it's for, and what makes it distinct from a generic CRUD app.
> List the chosen extended features and the reasoning.

Rally is an **event-centered microblogging platform**: short posts + follows + a
reverse-chronological feed, organized around **public events** users create and **join** via a
participate button, with a **calendar** for date-based discovery and **fixed categories**
(instead of hashtags). It is for people who want to meet others around shared interests
(sports, anime, music, gaming, food, study).

What makes it more than CRUD: the core flow combines social posting, an approval-gated social
graph, event discovery, and participation — a post can *share* an event, the calendar
aggregates events by date and shows what you're attending, and trending surfaces the most
engaging events in the last 24 hours.

**Chosen extended features (and why):** _TODO — reposts, likes, replies, search, media,
notifications, trending, bookmarks, fixed categories; explain how each supports the
"discover and show up to events" product vision._

## 2.2 Architecture Diagram  *(owner: Member A)*
> UML component diagram: React frontend ↔ Express backend ↔ SQLite. Mark which interactions
> are REST API calls and which are direct.

_TODO — insert diagram._ Summary: the **React (Vite) client** calls the **Express REST API**
over HTTP (axios, credentialed cookie) — this is the only client↔server channel (**no
WebSockets, no direct DB access from the client**). Express talks to **SQLite** directly via
better-sqlite3 (synchronous, in-process). Sessions are stored in the same SQLite database.

```
[React SPA] --REST/JSON (axios, cookie)--> [Express API] --in-process (better-sqlite3)--> [SQLite]
```

## 2.3 Data Model  *(owner: Member A)*
> UML ER diagram consistent with schema.sql.

_TODO — insert ER diagram._ 12 tables: `users`, `categories`, `events`, `posts`, `follows`,
`likes`, `reposts`, `bookmarks`, `event_participants`, `notifications` (+ `posts_fts`,
`events_fts`). Highlights: replies are `posts` with `parent_post_id`; a post shares an event
via nullable `event_id`; engagement counts are derived; `follows.status` (pending/accepted)
implements approval-gated private accounts. Full DDL: see `backend/db/schema.sql`.

## 2.4 API Design  *(owner: Member A + D)*
> How routes are organized, how auth is enforced, and non-obvious decisions (feed query, follow modeling).

_TODO._ Routes grouped by resource (`auth`, `users`, `posts`, `feed`, `events`, `categories`,
`search`, `trending`, `notifications`, `media`). Auth = httpOnly **session cookie**;
`requireAuth` returns **401** on protected routes; every POST/PUT validated with zod (400) and
toggles 404 on bad ids. Non-obvious: the **feed** is a UNION of authored posts + reposts of
accepted-followed users ordered by time; **follows** are a `(follower, following, status)`
table where an `accepted` row grants visibility of private posts.

## 2.5 Influence from Real Platforms  *(owner: Member A)*
> At least one concrete architectural/design decision a real platform made that influenced ours.

_TODO — e.g., Twitter/Instagram **approval-gated private accounts**: following a private
account is a request the owner approves before private posts become visible. We modeled this
with `follows.status` rather than self-serve follows, mirroring that privacy model._

## 2.6 Trade-offs and Scope Decisions  *(owner: Member C)*
> At least two trade-offs: what production does vs our simplification, and why ours fits our scope.

_TODO — examples:_
1. **Derived counts vs denormalized counters.** Production caches like/repost counts; we
   `COUNT()` on read. Correct + simple at course scale, and required anyway for 24h trending.
2. **Polling vs real-time (WebSockets).** Production pushes live updates; we refetch over REST
   to honor the "REST-only" constraint and keep the system simple.
3. _(optional)_ **Render ephemeral storage** for uploaded images — production uses object
   storage/CDN; we accept the trade-off (or attach a persistent disk) and document it.
