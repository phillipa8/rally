// trending.js — "what's hot in the last 24 hours" (Owner: Member A).
// Mounted at /api/trending. All routes are public discovery surfaces
// (optionalAuth): anonymous callers see only public content; a logged-in
// caller sees the same plus anything their visibility allows.
//
// "Trending" = engagement created within the last 24h (datetime('now','-1 day')),
// NOT total lifetime engagement — so the lists turn over as activity moves.
import { Router } from 'express';
import db from '../db/db.js';
import { optionalAuth } from '../middleware/auth.js';
import { visibleEventsWhere, visiblePostsWhere } from '../lib/visibility.js';

const router = Router();

// GET /api/trending/posts  — top-level posts by (likes + reposts) in the last 24h.
// Posts with zero recent engagement are excluded; ties broken by recency.
router.get('/posts', optionalAuth, (req, res) => {
  const v = visiblePostsWhere(req.userId); // predicate over author alias "u"
  const rows = db
    .prepare(
      `SELECT * FROM (
         SELECT p.id, p.content, p.event_id AS eventId, p.media_url AS mediaUrl, p.created_at AS createdAt,
                u.username, u.display_name AS displayName, u.avatar_url AS avatarUrl,
                (SELECT COUNT(*) FROM likes   l WHERE l.post_id = p.id AND l.created_at >= datetime('now','-1 day')) AS likes,
                (SELECT COUNT(*) FROM reposts r WHERE r.post_id = p.id AND r.created_at >= datetime('now','-1 day')) AS reposts
           FROM posts p
           JOIN users u ON u.id = p.author_id
          WHERE p.parent_post_id IS NULL AND ${v.clause}
       )
       WHERE (likes + reposts) > 0
       ORDER BY (likes + reposts) DESC, createdAt DESC
       LIMIT 20`
    )
    .all(...v.params);

  res.json({ posts: rows.map((r) => ({ ...r, score: r.likes + r.reposts })) });
});

// GET /api/trending/events  — events gaining traction in the last 24h,
// scored by new participants (going/interested) + posts sharing the event.
// participantCount is the running total; score is the 24h movement only.
router.get('/events', optionalAuth, (req, res) => {
  const v = visibleEventsWhere(req.userId, 'u');
  const rows = db
    .prepare(
      `SELECT * FROM (
         SELECT e.id, e.title, e.description, e.location,
                e.start_time AS startTime, e.end_time AS endTime, e.created_at AS createdAt,
                c.slug AS categorySlug, c.name AS categoryName,
                u.username AS creatorUsername, u.display_name AS creatorDisplayName,
                (SELECT COUNT(*) FROM event_participants ep
                   WHERE ep.event_id = e.id AND ep.status IN ('going','interested')) AS participantCount,
                (SELECT COUNT(*) FROM event_participants ep
                   WHERE ep.event_id = e.id AND ep.status IN ('going','interested')
                     AND ep.created_at >= datetime('now','-1 day')) AS newParticipants,
                (SELECT COUNT(*) FROM posts p
                   WHERE p.event_id = e.id AND p.created_at >= datetime('now','-1 day')) AS shares
           FROM events e
           JOIN categories c ON c.id = e.category_id
           JOIN users u ON u.id = e.creator_id
          WHERE ${v.clause}
       )
       WHERE (newParticipants + shares) > 0
       ORDER BY (newParticipants + shares) DESC, startTime ASC
       LIMIT 20`
    )
    .all(...v.params);

  res.json({ events: rows.map((r) => ({ ...r, score: r.newParticipants + r.shares })) });
});

// GET /api/trending/categories  — the 6 fixed categories ranked by last-24h
// activity. Categories attach to EVENTS, so a category's activity = new events
// + posts sharing those events + new participants, all within 24h. The full set
// is returned (ordered) so the client can render a "trending categories" bar.
router.get('/categories', optionalAuth, (_req, res) => {
  const rows = db
    .prepare(
      `SELECT c.id, c.slug, c.name,
              (SELECT COUNT(*) FROM events e
                 WHERE e.category_id = c.id AND e.created_at >= datetime('now','-1 day')) AS newEvents,
              (SELECT COUNT(*) FROM posts p JOIN events e ON e.id = p.event_id
                 WHERE e.category_id = c.id AND p.created_at >= datetime('now','-1 day')) AS shares,
              (SELECT COUNT(*) FROM event_participants ep JOIN events e ON e.id = ep.event_id
                 WHERE e.category_id = c.id AND ep.status IN ('going','interested')
                   AND ep.created_at >= datetime('now','-1 day')) AS newParticipants
         FROM categories c
        ORDER BY (newEvents + shares + newParticipants) DESC, c.name ASC`
    )
    .all();

  res.json({
    categories: rows.map((r) => ({ ...r, score: r.newEvents + r.shares + r.newParticipants })),
  });
});

export default router;
