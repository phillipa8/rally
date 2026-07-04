// posts.js — posts (create / read / delete) + bookmark toggle (Owner: Member B).
// Replies are posts with parent_post_id (reply UX is Member D). Likes/reposts toggles
// live in Member D's routes; their COUNTS are computed here via postColumns.
import { Router } from 'express';
import { z } from 'zod';
import db from '../db/db.js';
import { validate } from '../middleware/validate.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { visiblePostsWhere } from '../lib/visibility.js';
import { postColumns, mapPost } from '../lib/postQuery.js';

const router = Router();

const createPostSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'Post cannot be empty')
    .max(280, 'Post must be at most 280 characters'),
  eventId: z.number().int().positive().optional(),
  parentPostId: z.number().int().positive().optional(),
  mediaUrl: z.string().trim().max(500).optional(),
});

// Fetch one fully-serialized post by id (no visibility gate — caller decides).
function getPostById(id, viewerId) {
  const { columns, viewerParams } = postColumns(viewerId);
  const row = db
    .prepare(`SELECT ${columns} FROM posts p JOIN users u ON u.id = p.author_id WHERE p.id = ?`)
    .get(...viewerParams, id);
  return row ? mapPost(row) : null;
}

// POST /api/posts — create a post (or a reply when parentPostId is set).
router.post('/', requireAuth, validate(createPostSchema), (req, res) => {
  const { content, eventId, parentPostId, mediaUrl } = req.body;
  try {
    const info = db
      .prepare(
        'INSERT INTO posts (author_id, content, event_id, parent_post_id, media_url) VALUES (?, ?, ?, ?, ?)'
      )
      .run(req.userId, content, eventId ?? null, parentPostId ?? null, mediaUrl ?? null);
    res.status(201).json({ post: getPostById(info.lastInsertRowid, req.userId) });
  } catch (err) {
    // FK violation => a referenced event or parent post doesn't exist.
    if (String(err.code).startsWith('SQLITE_CONSTRAINT')) {
      return res.status(400).json({ error: 'Invalid eventId or parentPostId' });
    }
    throw err;
  }
});

// GET /api/posts/:id — a single post, visibility-gated (private authors hidden).
router.get('/:id', optionalAuth, (req, res) => {
  const { columns, viewerParams } = postColumns(req.userId);
  const v = visiblePostsWhere(req.userId, 'u');
  const row = db
    .prepare(
      `SELECT ${columns}
         FROM posts p JOIN users u ON u.id = p.author_id
        WHERE p.id = ? AND ${v.clause}`
    )
    .get(...viewerParams, req.params.id, ...v.params);
  if (!row) return res.status(404).json({ error: 'Post not found' });
  res.json({ post: mapPost(row) });
});

// DELETE /api/posts/:id — author only.
router.delete('/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT author_id FROM posts WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Post not found' });
  if (row.author_id !== req.userId) {
    return res.status(403).json({ error: 'You can only delete your own posts' });
  }
  db.prepare('DELETE FROM posts WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

// POST /api/posts/:id/bookmark — save a post (idempotent).
router.post('/:id/bookmark', requireAuth, (req, res) => {
  const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  db.prepare('INSERT OR IGNORE INTO bookmarks (user_id, post_id) VALUES (?, ?)').run(req.userId, post.id);
  res.status(201).json({ bookmarked: true });
});

// DELETE /api/posts/:id/bookmark — remove a saved post (idempotent).
router.delete('/:id/bookmark', requireAuth, (req, res) => {
  const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  db.prepare('DELETE FROM bookmarks WHERE user_id = ? AND post_id = ?').run(req.userId, post.id);
  res.status(204).end();
});

export default router;
