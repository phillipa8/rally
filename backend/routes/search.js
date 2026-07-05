// search.js — Member D search endpoints for posts, users, and events.
// FTS5 is used when available; LIKE fallback keeps local/demo DBs searchable.
import { Router } from 'express';
import { z } from 'zod';
import db from '../db/db.js';
import { optionalAuth } from '../middleware/auth.js';
import { validateQuery } from '../middleware/validate.js';
import { visiblePostsWhere } from '../lib/visibility.js';
import { postColumns, mapPost } from '../lib/postQuery.js';

const router = Router();

const searchQuerySchema = z.object({
  q: z.string().trim().min(1, 'Search query is required').max(100, 'Search query is too long'),
});

function likePattern(q) {
  return `%${q.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_')}%`;
}

function ftsQuery(q) {
  const terms = q
    .split(/\s+/)
    .map((term) => term.replace(/[^\p{L}\p{N}_]+/gu, ''))
    .filter(Boolean)
    .slice(0, 8);
  return terms.map((term) => `${term}*`).join(' ');
}

function publicUser(row) {
  return {
    id: row.id,
    username: row.username,
    displayName: row.displayName,
    bio: row.bio,
    avatarUrl: row.avatarUrl ?? null,
    isPrivate: !!row.isPrivate,
    followStatus: row.followStatus ?? null,
    isMe: !!row.isMe,
  };
}

function eventFromRow(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? null,
    location: row.location ?? null,
    startTime: row.startTime,
    endTime: row.endTime,
    ageRestriction: row.ageRestriction,
    createdAt: row.createdAt,
    category: {
      id: row.categoryId,
      slug: row.categorySlug,
      name: row.categoryName,
    },
    creator: {
      id: row.creatorId,
      username: row.creatorUsername,
      displayName: row.creatorDisplayName,
    },
    participantCount: row.participantCount ?? 0,
  };
}

function searchPostsFts(q, viewerId) {
  const match = ftsQuery(q);
  if (!match) return [];
  const { columns, viewerParams } = postColumns(viewerId);
  const v = visiblePostsWhere(viewerId, 'u');
  const rows = db
    .prepare(
      `SELECT ${columns}
         FROM posts_fts
         JOIN posts p ON p.id = posts_fts.rowid
         JOIN users u ON u.id = p.author_id
        WHERE posts_fts MATCH ? AND ${v.clause}
        ORDER BY bm25(posts_fts), p.created_at DESC
        LIMIT 50`
    )
    .all(...viewerParams, match, ...v.params);
  return rows.map(mapPost);
}

function searchPostsLike(q, viewerId) {
  const { columns, viewerParams } = postColumns(viewerId);
  const v = visiblePostsWhere(viewerId, 'u');
  const rows = db
    .prepare(
      `SELECT ${columns}
         FROM posts p
         JOIN users u ON u.id = p.author_id
        WHERE p.content LIKE ? ESCAPE '\\' AND ${v.clause}
        ORDER BY p.created_at DESC, p.id DESC
        LIMIT 50`
    )
    .all(...viewerParams, likePattern(q), ...v.params);
  return rows.map(mapPost);
}

function searchEventsFts(q) {
  const match = ftsQuery(q);
  if (!match) return [];
  const rows = db
    .prepare(
      `SELECT e.id, e.title, e.description, e.location,
              e.start_time AS startTime, e.end_time AS endTime,
              e.age_restriction AS ageRestriction, e.created_at AS createdAt,
              c.id AS categoryId, c.slug AS categorySlug, c.name AS categoryName,
              u.id AS creatorId, u.username AS creatorUsername, u.display_name AS creatorDisplayName,
              (SELECT COUNT(*) FROM event_participants ep
                WHERE ep.event_id = e.id AND ep.status IN ('going','interested')) AS participantCount
         FROM events_fts
         JOIN events e ON e.id = events_fts.rowid
         JOIN categories c ON c.id = e.category_id
         JOIN users u ON u.id = e.creator_id
        WHERE events_fts MATCH ?
        ORDER BY bm25(events_fts), e.start_time ASC
        LIMIT 50`
    )
    .all(match);
  return rows.map(eventFromRow);
}

function searchEventsLike(q) {
  const pattern = likePattern(q);
  const rows = db
    .prepare(
      `SELECT e.id, e.title, e.description, e.location,
              e.start_time AS startTime, e.end_time AS endTime,
              e.age_restriction AS ageRestriction, e.created_at AS createdAt,
              c.id AS categoryId, c.slug AS categorySlug, c.name AS categoryName,
              u.id AS creatorId, u.username AS creatorUsername, u.display_name AS creatorDisplayName,
              (SELECT COUNT(*) FROM event_participants ep
                WHERE ep.event_id = e.id AND ep.status IN ('going','interested')) AS participantCount
         FROM events e
         JOIN categories c ON c.id = e.category_id
         JOIN users u ON u.id = e.creator_id
        WHERE e.title LIKE ? ESCAPE '\\'
           OR e.description LIKE ? ESCAPE '\\'
           OR e.location LIKE ? ESCAPE '\\'
        ORDER BY e.start_time ASC, e.id ASC
        LIMIT 50`
    )
    .all(pattern, pattern, pattern);
  return rows.map(eventFromRow);
}

router.get('/posts', optionalAuth, validateQuery(searchQuerySchema), (req, res) => {
  const { q } = req.validatedQuery;
  let posts = [];
  try {
    posts = searchPostsFts(q, req.userId);
  } catch (_err) {
    posts = [];
  }
  if (!posts.length) posts = searchPostsLike(q, req.userId);
  res.json({ posts });
});

router.get('/users', optionalAuth, validateQuery(searchQuerySchema), (req, res) => {
  const { q } = req.validatedQuery;
  const pattern = likePattern(q);
  const rows = db
    .prepare(
      `SELECT u.id, u.username, u.display_name AS displayName, u.bio,
              u.avatar_url AS avatarUrl, u.is_private AS isPrivate,
              CASE WHEN ? IS NULL OR ? = u.id THEN NULL
                   ELSE (SELECT f.status FROM follows f
                          WHERE f.follower_id = ? AND f.following_id = u.id)
              END AS followStatus,
              CASE WHEN ? = u.id THEN 1 ELSE 0 END AS isMe
         FROM users u
        WHERE u.username LIKE ? ESCAPE '\\'
           OR u.display_name LIKE ? ESCAPE '\\'
           OR u.bio LIKE ? ESCAPE '\\'
        ORDER BY
          CASE WHEN lower(u.username) = lower(?) THEN 0 ELSE 1 END,
          u.username ASC
        LIMIT 50`
    )
    .all(req.userId, req.userId, req.userId, req.userId, pattern, pattern, pattern, q);

  res.json({ users: rows.map(publicUser) });
});

router.get('/events', optionalAuth, validateQuery(searchQuerySchema), (req, res) => {
  const { q } = req.validatedQuery;
  let events = [];
  try {
    events = searchEventsFts(q);
  } catch (_err) {
    events = [];
  }
  if (!events.length) events = searchEventsLike(q);
  res.json({ events });
});

export default router;
