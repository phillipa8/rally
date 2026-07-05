// categories.js — the fixed category set and per-category post browsing (Owner: Member C).
// Mounted at /api/categories. Categories are defined in schema.sql.
// There is no field posts.category_id since a post's category comes from its attached event, therefore
// "posts in a category" means posts whose events are in that category.

import { Router } from 'express';
import db from '../db/db.js';
import { optionalAuth } from '../middleware/auth.js';
import { visiblePostsWhere } from '../lib/visibility.js';

const router = Router();

// GET /api/categories — the fixed seeded list (feeds CategorySelect/CategoryFilterBar).
router.get('/', (_req, res) => {
  const categories = db.prepare('SELECT id, slug, name FROM categories ORDER BY name').all();
  res.json({ categories });
});

// GET /api/categories/:slug/posts — returns posts featuring an event in this category. newest first. 
// Public discovery surface: anonymous callers see only public
// authors' posts while logged in callers additionally see post from private authors they follow.

router.get('/:slug/posts', optionalAuth, (req, res) => {
  const category = db
    .prepare('SELECT id, slug, name FROM categories WHERE slug = ?')
    .get(req.params.slug);
  if (!category) return res.status(404).json({ error: 'Category not found' });

  const v = visiblePostsWhere(req.userId); // predicate over author alias "u"
  const posts = db
    .prepare(
      `SELECT p.id, p.content, p.media_url AS mediaUrl, p.created_at AS createdAt,
              u.username, u.display_name AS displayName, u.avatar_url AS avatarUrl,
              e.id AS eventId, e.title AS eventTitle, e.start_time AS eventStartTime
         FROM posts p
         JOIN events e ON e.id = p.event_id
         JOIN users u ON u.id = p.author_id
        WHERE e.category_id = ? AND ${v.clause}
        ORDER BY p.created_at DESC
        LIMIT 50`
    )
    .all(category.id, ...v.params);

  res.json({ category, posts });
});
export default router;