// events.js — events CRUD and related posts (Owner: Member C).
// Mounted at /api/events. An event's category comes from categories(id); a post
// "shares" an event via posts.event_id (see PostCard's EventChip). Participation
// toggles, the calendar range query, and event_update notifications are added to
// this same router in later steps (see TODO markers below).

import { Router } from 'express';
import { z } from 'zod';
import db from '../db/db.js';
import { validate } from '../middleware/validate.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { visiblePostsWhere } from '../lib/visibility.js';
import { postColumns, mapPost } from '../lib/postQuery.js';

const router = Router();

// Create: all core fields required. endTime > startTime is enforced here AND by the
// events.end_time >= start_time CHECK (belt-and-suspenders). Times are the same
// 'YYYY-MM-DD HH:MM:SS' strings used across the app; lexical compare == chronological.
const createEventSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(120),
    description: z.string().trim().max(2000).optional(),
    categoryId: z.number().int().positive(),
    startTime: z.string().trim().min(1, 'Start time is required'),
    endTime: z.string().trim().min(1, 'End time is required'),
    location: z.string().trim().max(200).optional(),
    ageRestriction: z.number().int().min(0).max(99).optional(),
  })
  .refine((d) => d.endTime > d.startTime, {
    message: 'End time must be after start time',
    path: ['endTime'],
  });

// Update: every field optional (partial), at least one required. Cross-field
// end > start is only checkable here when BOTH are sent; otherwise the merged
// values are validated by the DB CHECK and surfaced as 400 via the catch below.
const updateEventSchema = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(2000).optional(),
    categoryId: z.number().int().positive().optional(),
    startTime: z.string().trim().min(1).optional(),
    endTime: z.string().trim().min(1).optional(),
    location: z.string().trim().max(200).optional(),
    ageRestriction: z.number().int().min(0).max(99).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'No fields to update' })
  .refine((d) => d.startTime === undefined || d.endTime === undefined || d.endTime > d.startTime, {
    message: 'End time must be after start time',
    path: ['endTime'],
  });

// Map a joined event row -> safe public shape (camelCase, with category + creator).
function publicEvent(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    startTime: row.start_time,
    endTime: row.end_time,
    location: row.location,
    ageRestriction: row.age_restriction,
    createdAt: row.created_at,
    category: { id: row.category_id, slug: row.category_slug, name: row.category_name },
    creator: {
      id: row.creator_id,
      username: row.creator_username,
      displayName: row.creator_display_name,
      avatarUrl: row.creator_avatar_url,
    },
  };
}

// Fetch one event joined to its category + creator, or undefined.
function findEventById(id) {
  return db
    .prepare(
      `SELECT e.*, c.slug AS category_slug, c.name AS category_name,
              u.username AS creator_username, u.display_name AS creator_display_name,
              u.avatar_url AS creator_avatar_url
         FROM events e
         JOIN categories c ON c.id = e.category_id
         JOIN users u ON u.id = e.creator_id
        WHERE e.id = ?`
    )
    .get(id);
}

// POST /api/events — create an event (the creator is the logged-in user).
router.post('/', requireAuth, validate(createEventSchema), (req, res) => {
  const { title, description, categoryId, startTime, endTime, location, ageRestriction } = req.body;
  try {
    const info = db
      .prepare(
        `INSERT INTO events
           (creator_id, title, description, category_id, start_time, end_time, location, age_restriction)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        req.userId,
        title,
        description ?? null,
        categoryId,
        startTime,
        endTime,
        location ?? null,
        ageRestriction ?? 0
      );
    res.status(201).json({ event: publicEvent(findEventById(info.lastInsertRowid)) });
  } catch (err) {
    // FK violation => bad categoryId; CHECK violation => end < start (backstop).
    if (String(err.code).startsWith('SQLITE_CONSTRAINT')) {
      return res.status(400).json({ error: 'Invalid category or event times' });
    }
    throw err;
  }
});

// GET /api/events/:id — one event + participant count, viewer's participation,
// and the visibility-gated posts that share this event (relatedPosts).
router.get('/:id', optionalAuth, (req, res) => {
  const row = findEventById(req.params.id);
  if (!row) return res.status(404).json({ error: 'Event not found' });

  const participantCount = db
    .prepare("SELECT COUNT(*) AS n FROM event_participants WHERE event_id = ? AND status != 'not_going'")
    .get(row.id).n;

  const isParticipating = req.userId
    ? !!db
        .prepare(
          "SELECT 1 FROM event_participants WHERE event_id = ? AND user_id = ? AND status != 'not_going'"
        )
        .get(row.id, req.userId)
    : false;

  // relatedPosts: reuse the shared post serializer + visibility predicate.
  // viewerParams (SELECT-clause EXISTS binds) come FIRST, then the WHERE params.
  const { columns, viewerParams } = postColumns(req.userId);
  const v = visiblePostsWhere(req.userId, 'u');
  const posts = db
    .prepare(
      `SELECT ${columns}
         FROM posts p JOIN users u ON u.id = p.author_id
        WHERE p.event_id = ? AND ${v.clause}
        ORDER BY p.created_at DESC, p.id DESC
        LIMIT 50`
    )
    .all(...viewerParams, row.id, ...v.params);

  res.json({
    event: publicEvent(row),
    participantCount,
    isParticipating,
    relatedPosts: posts.map(mapPost),
  });
});

// PUT /api/events/:id — creator-only edit. 404 before 403 (no existence leak of
// which ids exist). Builds a partial UPDATE like users.js PUT /me.
router.put('/:id', requireAuth, validate(updateEventSchema), (req, res) => {
  const existing = db.prepare('SELECT creator_id FROM events WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Event not found' });
  if (existing.creator_id !== req.userId) {
    return res.status(403).json({ error: 'You can only edit your own events' });
  }

  const map = {
    title: 'title',
    description: 'description',
    categoryId: 'category_id',
    startTime: 'start_time',
    endTime: 'end_time',
    location: 'location',
    ageRestriction: 'age_restriction',
  };
  const fields = [];
  const params = [];
  for (const [key, col] of Object.entries(map)) {
    if (req.body[key] !== undefined) {
      fields.push(`${col} = ?`);
      params.push(req.body[key]);
    }
  }

  try {
    db.prepare(`UPDATE events SET ${fields.join(', ')} WHERE id = ?`).run(...params, req.params.id);
  } catch (err) {
    if (String(err.code).startsWith('SQLITE_CONSTRAINT')) {
      return res.status(400).json({ error: 'Invalid category or event times' });
    }
    throw err;
  }

  // TODO (step 7): fan out an 'event_update' notification to each participant
  // (excluding the creator) inside a db.transaction.

  res.json({ event: publicEvent(findEventById(req.params.id)) });
});

// DELETE /api/events/:id — creator-only. posts.event_id is ON DELETE SET NULL,
// so shared posts survive (they simply lose their EventChip).
router.delete('/:id', requireAuth, (req, res) => {
  const existing = db.prepare('SELECT creator_id FROM events WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Event not found' });
  if (existing.creator_id !== req.userId) {
    return res.status(403).json({ error: 'You can only delete your own events' });
  }
  db.prepare('DELETE FROM events WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

// TODO (step 4): POST/DELETE /:id/participate (upsert event_participants; notify
//   creator on join) + GET /:id/participants.
// TODO (step 5): GET /?from&to&category via validateQuery (read req.validatedQuery,
//   NOT req.query — Express 5) + GET /me/participating.

export default router;
