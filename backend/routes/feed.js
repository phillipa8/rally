// feed.js — the home feed and the public explore feed (Owner: Member B).
import { Router } from 'express';
import db from '../db/db.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { postColumns, mapPost } from '../lib/postQuery.js';
import { visiblePostsWhere } from '../lib/visibility.js';

const router = Router();

// GET /api/feed — authenticated, reverse-chronological.
// Top-level posts by you + accounts you follow (accepted), UNION reposts by that same
// set (each shown as the original post, tagged with who reposted).
router.get('/', requireAuth, (req, res) => {
  const { columns, viewerParams } = postColumns(req.userId);
  const v = visiblePostsWhere(req.userId, 'u');
  const sql = `
    SELECT ${columns}, p.created_at AS sortTime, NULL AS repostedBy
      FROM posts p
      JOIN users u ON u.id = p.author_id
     WHERE p.parent_post_id IS NULL
       AND (p.author_id = ?
            OR p.author_id IN (SELECT following_id FROM follows
                                WHERE follower_id = ? AND status = 'accepted'))
    UNION ALL
    SELECT ${columns}, rp.created_at AS sortTime, ru.username AS repostedBy
      FROM reposts rp
      JOIN posts p  ON p.id = rp.post_id
      JOIN users u  ON u.id = p.author_id
      JOIN users ru ON ru.id = rp.user_id
     WHERE (rp.user_id = ?
            OR rp.user_id IN (SELECT following_id FROM follows
                               WHERE follower_id = ? AND status = 'accepted'))
       AND ${v.clause}
     ORDER BY sortTime DESC
     LIMIT 100`;
  const params = [
    ...viewerParams, req.userId, req.userId, // first branch
    ...viewerParams, req.userId, req.userId, ...v.params, // second branch
  ];
  const rows = db.prepare(sql).all(...params);
  res.json({ posts: rows.map(mapPost) });
});

// GET /api/feed/explore — public: recent top-level posts from public accounts only.
// Visitors (and logged-in users) can browse without following anyone.
router.get('/explore', optionalAuth, (req, res) => {
  const { columns, viewerParams } = postColumns(req.userId);
  const rows = db
    .prepare(
      `SELECT ${columns}
         FROM posts p JOIN users u ON u.id = p.author_id
        WHERE p.parent_post_id IS NULL AND u.is_private = 0
        ORDER BY p.created_at DESC, p.id DESC
        LIMIT 100`
    )
    .all(...viewerParams);
  res.json({ posts: rows.map(mapPost) });
});

export default router;
