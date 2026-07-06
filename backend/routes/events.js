// events.js — events CRUD and related posts (Owner: Member C).
// Mounted at /api/events. An event's category comes from categories(id); a post
// "shares" an event via posts.event_id (see PostCard's EventChip). Participation
// toggles, the calendar range query, and event_update notifications are added to
// this same router in later steps (see TODO markers below).

import { Router } from 'express';
import { z } from 'zod';
import db from '../db/db.js';
import { validate, validateQuery } from '../middleware/validate.js';
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

// "Going" count = anyone not explicitly 'not_going' (i.e. going + interested).
function countParticipants(eventId) {
  return db
    .prepare("SELECT COUNT(*) AS n FROM event_participants WHERE event_id = ? AND status != 'not_going'")
    .get(eventId).n;
}

// Insert an in-app notification (local helper mirroring users.js; supports eventId).
// Swap for Member A's shared createNotification() when it lands.
function notify(recipientId, actorId, type, eventId = null) {
  db.prepare('INSERT INTO notifications (recipient_id, actor_id, type, event_id) VALUES (?, ?, ?, ?)')
    .run(recipientId, actorId, type, eventId);
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

// Calendar / discovery filters. All optional; `category` accepts a slug or numeric id.
const calendarQuerySchema = z.object({
  from: z.string().trim().min(1).optional(),
  to: z.string().trim().min(1).optional(),
  category: z.string().trim().min(1).optional(),
});

// GET /api/events?from=&to=&category= — events for the calendar / category filter.
// Each row carries participantCount; ordered by start time ascending.
router.get('/', optionalAuth, validateQuery(calendarQuerySchema), (req, res) => {
  const { from, to, category } = req.validatedQuery;
  const clauses = [];
  const params = [];
  if (from) { clauses.push('e.start_time >= ?'); params.push(from); }
  if (to) { clauses.push('e.start_time <= ?'); params.push(to); }
  if (category) {
    if (/^\d+$/.test(category)) { clauses.push('e.category_id = ?'); params.push(Number(category)); }
    else { clauses.push('c.slug = ?'); params.push(category); }
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db
    .prepare(
      `SELECT e.*, c.slug AS category_slug, c.name AS category_name,
              u.username AS creator_username, u.display_name AS creator_display_name,
              u.avatar_url AS creator_avatar_url,
              (SELECT COUNT(*) FROM event_participants ep
                WHERE ep.event_id = e.id AND ep.status != 'not_going') AS participant_count
         FROM events e
         JOIN categories c ON c.id = e.category_id
         JOIN users u ON u.id = e.creator_id
         ${where}
        ORDER BY e.start_time ASC`
    )
    .all(...params);
  res.json({ events: rows.map((r) => ({ ...publicEvent(r), participantCount: r.participant_count })) });
});

// GET /api/events/me/participating — events the viewer is going/interested in.
// Registered before /:id so "me" is never treated as an event id.
// (Kept here under /api/events to avoid colliding with Member A's /api/users routes.)
router.get('/me/participating', requireAuth, (req, res) => {
  const rows = db
    .prepare(
      `SELECT e.*, c.slug AS category_slug, c.name AS category_name,
              u.username AS creator_username, u.display_name AS creator_display_name,
              u.avatar_url AS creator_avatar_url, ep.status AS my_status
         FROM event_participants ep
         JOIN events e ON e.id = ep.event_id
         JOIN categories c ON c.id = e.category_id
         JOIN users u ON u.id = e.creator_id
        WHERE ep.user_id = ? AND ep.status != 'not_going'
        ORDER BY e.start_time ASC`
    )
    .all(req.userId);
  res.json({ events: rows.map((r) => ({ ...publicEvent(r), myStatus: r.my_status })) });
});

// GET /api/events/:id — one event + participant count, viewer's participation,
// and the visibility-gated posts that share this event (relatedPosts).
router.get('/:id', optionalAuth, (req, res) => {
  const row = findEventById(req.params.id);
  if (!row) return res.status(404).json({ error: 'Event not found' });

  const participantCount = countParticipants(row.id);

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

  // Notify every participant (except the editor) that the event changed.
  const eventId = Number(req.params.id);
  const fanOut = db.transaction(() => {
    const recipients = db
      .prepare(
        "SELECT user_id FROM event_participants WHERE event_id = ? AND user_id != ? AND status != 'not_going'"
      )
      .all(eventId, req.userId);
    for (const r of recipients) notify(r.user_id, req.userId, 'event_update', eventId);
  });
  fanOut();

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

// Participation status; defaults to 'going' when omitted.
const participateSchema = z.object({
  status: z.enum(['going', 'interested', 'not_going']).optional(),
});

// POST /api/events/:id/participate — join or change RSVP (idempotent upsert on the PK).
// Notifies the creator the first time someone RSVPs going/interested (not on repeats,
// not for the creator's own RSVP).
router.post('/:id/participate', requireAuth, validate(participateSchema), (req, res) => {
  const event = db.prepare('SELECT id, creator_id FROM events WHERE id = ?').get(req.params.id);
  if (!event) return res.status(404).json({ error: 'Event not found' });
  const status = req.body.status || 'going';

  const existing = db
    .prepare('SELECT status FROM event_participants WHERE user_id = ? AND event_id = ?')
    .get(req.userId, event.id);

  db.prepare(
    `INSERT INTO event_participants (user_id, event_id, status) VALUES (?, ?, ?)
       ON CONFLICT(user_id, event_id) DO UPDATE SET status = excluded.status`
  ).run(req.userId, event.id, status);

  if (!existing && status !== 'not_going' && event.creator_id !== req.userId) {
    notify(event.creator_id, req.userId, 'participate', event.id);
  }

  res.status(existing ? 200 : 201).json({
    status,
    participating: status !== 'not_going',
    participantCount: countParticipants(event.id),
  });
});

// DELETE /api/events/:id/participate — withdraw RSVP (idempotent → 204).
router.delete('/:id/participate', requireAuth, (req, res) => {
  const event = db.prepare('SELECT id FROM events WHERE id = ?').get(req.params.id);
  if (!event) return res.status(404).json({ error: 'Event not found' });
  db.prepare('DELETE FROM event_participants WHERE user_id = ? AND event_id = ?').run(req.userId, event.id);
  res.status(204).end();
});

// GET /api/events/:id/participants — everyone who RSVP'd, newest first.
router.get('/:id/participants', (req, res) => {
  const event = db.prepare('SELECT id FROM events WHERE id = ?').get(req.params.id);
  if (!event) return res.status(404).json({ error: 'Event not found' });
  const participants = db
    .prepare(
      `SELECT u.id, u.username, u.display_name AS displayName, u.avatar_url AS avatarUrl, ep.status
         FROM event_participants ep
         JOIN users u ON u.id = ep.user_id
        WHERE ep.event_id = ?
        ORDER BY ep.created_at DESC`
    )
    .all(event.id);
  res.json({ participants });
});

export default router;
