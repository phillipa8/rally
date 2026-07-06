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

const quotePostSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'Quote cannot be empty')
    .max(280, 'Quote must be at most 280 characters'),
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

function getVisiblePostForAction(id, viewerId) {
  const v = visiblePostsWhere(viewerId, 'u');
  return db
    .prepare(
      `SELECT p.id, p.author_id AS authorId
         FROM posts p
         JOIN users u ON u.id = p.author_id
        WHERE p.id = ? AND ${v.clause}`
    )
    .get(id, ...v.params);
}

function likeCount(postId) {
  return db.prepare('SELECT COUNT(*) AS n FROM likes WHERE post_id = ?').get(postId).n;
}

function repostCount(postId) {
  return db.prepare('SELECT COUNT(*) AS n FROM reposts WHERE post_id = ?').get(postId).n;
}

function notifyPostAuthor(post, actorId, type) {
  if (post.authorId === actorId) return;
  db.prepare(
    'INSERT INTO notifications (recipient_id, actor_id, type, post_id) VALUES (?, ?, ?, ?)'
  ).run(post.authorId, actorId, type, post.id);
}

// POST /api/posts — create a post (or a reply when parentPostId is set).
router.post('/', requireAuth, validate(createPostSchema), (req, res) => {
  const { content, eventId, parentPostId, mediaUrl } = req.body;
  const parentPost = parentPostId ? getVisiblePostForAction(parentPostId, req.userId) : null;
  if (parentPostId && !parentPost) return res.status(400).json({ error: 'Invalid parentPostId' });

  try {
    const info = db
      .prepare(
        'INSERT INTO posts (author_id, content, event_id, parent_post_id, media_url) VALUES (?, ?, ?, ?, ?)'
      )
      .run(req.userId, content, eventId ?? null, parentPostId ?? null, mediaUrl ?? null);
    if (parentPost) notifyPostAuthor(parentPost, req.userId, 'reply');
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

// GET /api/posts/:id/replies — direct replies to a visible post, oldest first.
router.get('/:id/replies', optionalAuth, (req, res) => {
  const parent = getVisiblePostForAction(req.params.id, req.userId);
  if (!parent) return res.status(404).json({ error: 'Post not found' });

  const { columns, viewerParams } = postColumns(req.userId);
  const v = visiblePostsWhere(req.userId, 'u');
  const rows = db
    .prepare(
      `SELECT ${columns}
         FROM posts p
         JOIN users u ON u.id = p.author_id
        WHERE p.parent_post_id = ? AND ${v.clause}
        ORDER BY p.created_at ASC, p.id ASC`
    )
    .all(...viewerParams, parent.id, ...v.params);

  res.json({ replies: rows.map(mapPost) });
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

// POST /api/posts/:id/like — like a visible post (idempotent).
router.post('/:id/like', requireAuth, (req, res) => {
  const post = getVisiblePostForAction(req.params.id, req.userId);
  if (!post) return res.status(404).json({ error: 'Post not found' });

  const result = db.transaction(() => {
    const info = db
      .prepare('INSERT OR IGNORE INTO likes (user_id, post_id) VALUES (?, ?)')
      .run(req.userId, post.id);
    if (info.changes > 0) notifyPostAuthor(post, req.userId, 'like');
    return { created: info.changes > 0, likeCount: likeCount(post.id) };
  })();

  res.status(result.created ? 201 : 200).json({ liked: true, likeCount: result.likeCount });
});

// DELETE /api/posts/:id/like — unlike a visible post (idempotent).
router.delete('/:id/like', requireAuth, (req, res) => {
  const post = getVisiblePostForAction(req.params.id, req.userId);
  if (!post) return res.status(404).json({ error: 'Post not found' });

  db.prepare('DELETE FROM likes WHERE user_id = ? AND post_id = ?').run(req.userId, post.id);
  res.status(204).end();
});

// GET /api/posts/:id/likes — users who liked a visible post, newest first.
router.get('/:id/likes', optionalAuth, (req, res) => {
  const post = getVisiblePostForAction(req.params.id, req.userId);
  if (!post) return res.status(404).json({ error: 'Post not found' });

  const rows = db
    .prepare(
      `SELECT u.id, u.username, u.display_name AS displayName, u.avatar_url AS avatarUrl,
              l.created_at AS likedAt
         FROM likes l
         JOIN users u ON u.id = l.user_id
        WHERE l.post_id = ?
        ORDER BY l.created_at DESC, u.id DESC`
    )
    .all(post.id);

  res.json({
    users: rows.map((row) => ({
      id: row.id,
      username: row.username,
      displayName: row.displayName,
      avatarUrl: row.avatarUrl ?? null,
      likedAt: row.likedAt,
    })),
  });
});

// POST /api/posts/:id/repost — repost a visible post (idempotent).
router.post('/:id/repost', requireAuth, (req, res) => {
  const post = getVisiblePostForAction(req.params.id, req.userId);
  if (!post) return res.status(404).json({ error: 'Post not found' });

  const result = db.transaction(() => {
    const info = db
      .prepare('INSERT OR IGNORE INTO reposts (user_id, post_id) VALUES (?, ?)')
      .run(req.userId, post.id);
    if (info.changes > 0) notifyPostAuthor(post, req.userId, 'repost');
    return { created: info.changes > 0, repostCount: repostCount(post.id) };
  })();

  res.status(result.created ? 201 : 200).json({ reposted: true, repostCount: result.repostCount });
});

// DELETE /api/posts/:id/repost — remove a repost (idempotent).
router.delete('/:id/repost', requireAuth, (req, res) => {
  const post = getVisiblePostForAction(req.params.id, req.userId);
  if (!post) return res.status(404).json({ error: 'Post not found' });

  db.prepare('DELETE FROM reposts WHERE user_id = ? AND post_id = ?').run(req.userId, post.id);
  res.status(204).end();
});

// POST /api/posts/:id/quote — create a new post that quotes a visible post.
router.post('/:id/quote', requireAuth, validate(quotePostSchema), (req, res) => {
  const quotedPost = getVisiblePostForAction(req.params.id, req.userId);
  if (!quotedPost) return res.status(404).json({ error: 'Post not found' });

  const { content, mediaUrl } = req.body;
  const info = db
    .prepare('INSERT INTO posts (author_id, content, quoted_post_id, media_url) VALUES (?, ?, ?, ?)')
    .run(req.userId, content, quotedPost.id, mediaUrl ?? null);

  notifyPostAuthor(quotedPost, req.userId, 'repost');
  res.status(201).json({ post: getPostById(info.lastInsertRowid, req.userId) });
});

// POST /api/posts/:id/bookmark — save a post (idempotent).
router.post('/:id/bookmark', requireAuth, (req, res) => {
  const post = getVisiblePostForAction(req.params.id, req.userId);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  db.prepare('INSERT OR IGNORE INTO bookmarks (user_id, post_id) VALUES (?, ?)').run(req.userId, post.id);
  res.status(201).json({ bookmarked: true });
});

// DELETE /api/posts/:id/bookmark — remove a saved post (idempotent).
router.delete('/:id/bookmark', requireAuth, (req, res) => {
  const post = getVisiblePostForAction(req.params.id, req.userId);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  db.prepare('DELETE FROM bookmarks WHERE user_id = ? AND post_id = ?').run(req.userId, post.id);
  res.status(204).end();
});

export default router;
