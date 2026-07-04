// bookmarks.js — list the current user's bookmarked posts (Owner: Member B).
// Bookmark/unbookmark toggles live in posts.js (POST/DELETE /api/posts/:id/bookmark).
import { Router } from 'express';
import db from '../db/db.js';
import { requireAuth } from '../middleware/auth.js';
import { postColumns, mapPost } from '../lib/postQuery.js';

const router = Router();

// GET /api/bookmarks — your saved posts, most recently bookmarked first.
router.get('/', requireAuth, (req, res) => {
  const { columns, viewerParams } = postColumns(req.userId);
  const rows = db
    .prepare(
      `SELECT ${columns}, b.created_at AS bookmarkedAt
         FROM bookmarks b
         JOIN posts p ON p.id = b.post_id
         JOIN users u ON u.id = p.author_id
        WHERE b.user_id = ?
        ORDER BY b.created_at DESC`
    )
    .all(...viewerParams, req.userId);
  res.json({ posts: rows.map(mapPost) });
});

export default router;
