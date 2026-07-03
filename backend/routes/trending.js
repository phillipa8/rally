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
import { visiblePostsWhere } from '../lib/visibility.js';

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

export default router;
