// categories.js — the fixed category set and per-category post browsing (Owner: Member C).
// Mounted at /api/categories. Categories are defined in schema.sql.
// There is no field posts.category_id since a post's category comes from its attached event, therefore
// "posts in a category" means posts whose events are in that category.

import { Router } from 'express';
import db from '../db/db.js';
import { optionalAuth } from '../middleware/auth.js';
import { visiblePostsWhere } from '../lib/visibility.js';
import { postColumns, mapPost } from '../lib/postQuery.js';

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

  // Use the shared serializer so these cards carry full engagement counts + viewer
  // flags (like/repost/bookmark) and render EventChip, consistent with the feed.
  const { columns, viewerParams } = postColumns(req.userId);
  const v = visiblePostsWhere(req.userId, 'u');
  const posts = db
    .prepare(
      `SELECT ${columns}
         FROM posts p
         JOIN users u ON u.id = p.author_id
         JOIN events e ON e.id = p.event_id
        WHERE e.category_id = ? AND ${v.clause}
        ORDER BY p.created_at DESC, p.id DESC
        LIMIT 50`
    )
    .all(...viewerParams, category.id, ...v.params);

  res.json({ category, posts: posts.map(mapPost) });
});
export default router;