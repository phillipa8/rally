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
import { visibleEventsWhere, visiblePostsWhere } from '../lib/visibility.js';
import { postColumns, mapPost } from '../lib/postQuery.js';

const router = Router();

// Returns the urrent UTC time in the storage format ('YYYY-MM-DD HH:MM:SS'), for
// checking if an event's start time is not in the past.
function sqlUtcNow() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

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
    isPrivate: z.boolean().optional(),
  })
  .refine((d) => d.endTime > d.startTime, {
    message: 'End time must be after start time',
    path: ['endTime'],
  })
  .refine((d) => d.startTime >= sqlUtcNow(), {
    message: 'Start time cannot be in the past',
    path: ['startTime'],
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
    isPrivate: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'No fields to update' })
  .refine((d) => d.startTime === undefined || d.endTime === undefined || d.endTime > d.startTime, {
    message: 'End time must be after start time',
    path: ['endTime'],
  });

const inviteSchema = z.object({
  username: z.string().trim().min(1, 'Username is required').max(30),
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
    isPrivate: !!row.is_private,
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

function publicUser(row) {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    bio: row.bio,
    avatarUrl: row.avatar_url,
    isPrivate: !!row.is_private,
    createdAt: row.created_at,
  };
}

// Fetch one event joined to its category + creator, or undefined.
// No visibility gate — used right after create/update where the caller is the creator.

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

function findVisibleEvent(id, viewerId) {
  const v = visibleEventsWhere(viewerId, 'u');
  return db
    .prepare(
      `SELECT e.*, c.slug AS category_slug, c.name AS category_name,
              u.username AS creator_username, u.display_name AS creator_display_name,
              u.avatar_url AS creator_avatar_url
         FROM events e
         JOIN categories c ON c.id = e.category_id
         JOIN users u ON u.id = e.creator_id
        WHERE e.id = ? AND ${v.clause}`
    )
    .get(id, ...v.params);
}

// "Going" count = anyone not explicitly 'not_going' (i.e. going + interested).
function countParticipants(eventId) {
  return db
    .prepare("SELECT COUNT(*) AS n FROM event_participants WHERE event_id = ? AND status != 'not_going'")
    .get(eventId).n;
}

function isBlockedEitherWay(userId, otherId) {
  return !!db
    .prepare(
      `SELECT 1 FROM blocks
        WHERE (blocker_id = ? AND blocked_id = ?)
           OR (blocker_id = ? AND blocked_id = ?)`
    )
    .get(userId, otherId, otherId, userId);
}

function isFollowingAccepted(userId, targetId) {
  return !!db
    .prepare(
      "SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ? AND status = 'accepted'"
    )
    .get(userId, targetId);
}

// Insert an in-app notification (local helper mirroring users.js; supports eventId).
// Swap for Member A's shared createNotification() when it lands.
function notify(recipientId, actorId, type, eventId = null) {
  db.prepare('INSERT INTO notifications (recipient_id, actor_id, type, event_id) VALUES (?, ?, ?, ?)')
    .run(recipientId, actorId, type, eventId);
}

// POST /api/events — create an event (the creator is the logged-in user).
// Visibility defaults to the creator's account setting (issue #40): a private
// account's new events start private unless the form says otherwise.
router.post('/', requireAuth, validate(createEventSchema), (req, res) => {
  const { title, description, categoryId, startTime, endTime, location, ageRestriction, isPrivate } = req.body;
  const creator = db.prepare('SELECT is_private FROM users WHERE id = ?').get(req.userId);
  try {
    const info = db
      .prepare(
        `INSERT INTO events
           (creator_id, title, description, category_id, start_time, end_time, location, age_restriction, is_private)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        req.userId,
        title,
        description ?? null,
        categoryId,
        startTime,
        endTime,
        location ?? null,
        ageRestriction ?? 0,
        (isPrivate ?? !!creator.is_private) ? 1 : 0
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
  // Only show events visible to the viewer (creator account gate + event privacy).
  const v = visibleEventsWhere(req.userId, 'u', 'e');
  clauses.push(v.clause);
  params.push(...v.params);
  const where = `WHERE ${clauses.join(' AND ')}`;
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
  // Visibility-gated too: losing access to a private creator hides their events here.
  const v = visibleEventsWhere(req.userId, 'u', 'e');
  const rows = db
    .prepare(
      `SELECT e.*, c.slug AS category_slug, c.name AS category_name,
              u.username AS creator_username, u.display_name AS creator_display_name,
              u.avatar_url AS creator_avatar_url, ep.status AS my_status
         FROM event_participants ep
         JOIN events e ON e.id = ep.event_id
         JOIN categories c ON c.id = e.category_id
         JOIN users u ON u.id = e.creator_id
        WHERE ep.user_id = ? AND ep.status != 'not_going' AND ${v.clause}
        ORDER BY e.start_time ASC`
    )
    .all(req.userId, ...v.params);
  res.json({ events: rows.map((r) => ({ ...publicEvent(r), myStatus: r.my_status })) });
});

// Discovery feed for the events hub: not-yet-ended events, either soonest-first
// ('upcoming', default) or by most participants ('popular').
const discoverQuerySchema = z.object({
  sort: z.enum(['upcoming', 'popular']).optional(),
});

// GET /api/events/discover?sort=upcoming|popular — up to 10 upcoming events visible
// to the viewer. Registered before /:id so "discover" is never treated as an event id.
// Uses the same visibility predicate as the calendar list so the events page agrees.
router.get('/discover', optionalAuth, validateQuery(discoverQuerySchema), (req, res) => {
  const sort = req.validatedQuery.sort || 'upcoming';
  // ORDER BY is chosen from the validated enum (never interpolated user input).
  const order =
    sort === 'popular' ? 'participant_count DESC, e.start_time ASC' : 'e.start_time ASC';
  const v = visibleEventsWhere(req.userId, 'u', 'e');
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
        WHERE e.end_time >= datetime('now') AND ${v.clause}
        ORDER BY ${order}
        LIMIT 10`
    )
    .all(...v.params);
  res.json({ events: rows.map((r) => ({ ...publicEvent(r), participantCount: r.participant_count })) });
});

// GET /api/events/:id/invitees — people the event owner follows and can invite by DM.
router.get('/:id/invitees', requireAuth, (req, res) => {
  const event = db.prepare('SELECT id, creator_id FROM events WHERE id = ?').get(req.params.id);
  if (!event) return res.status(404).json({ error: 'Event not found' });
  if (event.creator_id !== req.userId) {
    return res.status(403).json({ error: 'You can only invite people to your own events' });
  }

  const rows = db
    .prepare(
      `SELECT u.*
         FROM follows f
         JOIN users u ON u.id = f.following_id
        WHERE f.follower_id = ?
          AND f.status = 'accepted'
          AND NOT EXISTS (
                SELECT 1 FROM blocks b
                 WHERE (b.blocker_id = ? AND b.blocked_id = u.id)
                    OR (b.blocker_id = u.id AND b.blocked_id = ?)
              )
        ORDER BY u.username ASC`
    )
    .all(req.userId, req.userId, req.userId);

  res.json({ users: rows.map(publicUser) });
});

// POST /api/events/:id/invite — send an event link to one followed user by DM.
router.post('/:id/invite', requireAuth, validate(inviteSchema), (req, res) => {
  const event = findEventById(req.params.id);
  if (!event) return res.status(404).json({ error: 'Event not found' });
  if (event.creator_id !== req.userId) {
    return res.status(403).json({ error: 'You can only invite people to your own events' });
  }

  const recipient = db.prepare('SELECT * FROM users WHERE username = ?').get(req.body.username);
  if (!recipient) return res.status(404).json({ error: 'User not found' });
  if (recipient.id === req.userId) return res.status(400).json({ error: 'You cannot invite yourself' });
  if (!isFollowingAccepted(req.userId, recipient.id)) {
    return res.status(403).json({ error: 'You can only invite people you follow' });
  }
  if (isBlockedEitherWay(req.userId, recipient.id)) {
    return res.status(403).json({ error: 'You cannot invite this user' });
  }

  const content = `You're invited to ${event.title}: /events/${event.id}`;
  db.prepare('INSERT INTO direct_messages (sender_id, recipient_id, content) VALUES (?, ?, ?)')
    .run(req.userId, recipient.id, content);

  res.status(201).json({ invited: true, user: publicUser(recipient), message: content });
});

// GET /api/events/:id — one event + participant count, viewer's participation,
// and the visibility-gated posts that share this event (relatedPosts).
// A private creator's event returns 404 for viewers who aren't the creator or an accepted
// follower (404 instead of 403, no existence leak).

router.get('/:id', optionalAuth, (req, res) => {
  const row = findVisibleEvent(req.params.id, req.userId);
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
  const existing = db
    .prepare('SELECT creator_id, start_time FROM events WHERE id = ?')
    .get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Event not found' });
  if (existing.creator_id !== req.userId) {
    return res.status(403).json({ error: 'You can only edit your own events' });
  }
  // Only a *changed* start time must not be in the past — keeping the original
  // start of an already-started event editable (e.g. fixing a typo in the title).
  if (
    req.body.startTime !== undefined &&
    req.body.startTime !== existing.start_time &&
    req.body.startTime < sqlUtcNow()
  ) {
    return res.status(400).json({ error: 'Start time cannot be in the past' });
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
  // Boolean -> 0/1 explicitly; the generic map would bind `true` as-is.
  if (req.body.isPrivate !== undefined) {
    fields.push('is_private = ?');
    params.push(req.body.isPrivate ? 1 : 0);
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
    // Skip participants who can no longer see the event (e.g. it just went private) —
    // their notification link would 404.
    for (const r of recipients) {
      if (findVisibleEvent(eventId, r.user_id)) notify(r.user_id, req.userId, 'event_update', eventId);
    }
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
  // Can't RSVP to an event you can't see (private creators you don't follow).
  const event = findVisibleEvent(req.params.id, req.userId);
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
// Visibility-gated like its POST sibling: hidden and nonexistent both 404,
// so the route can't be used to probe which event ids exist.
router.delete('/:id/participate', requireAuth, (req, res) => {
  const event = findVisibleEvent(req.params.id, req.userId);
  if (!event) return res.status(404).json({ error: 'Event not found' });
  db.prepare('DELETE FROM event_participants WHERE user_id = ? AND event_id = ?').run(req.userId, event.id);
  res.status(204).end();
});

// GET /api/events/:id/participants — everyone who RSVP'd, newest first.
// Gated by event visibility (a private creator's participant list isn't public).
router.get('/:id/participants', optionalAuth, (req, res) => {
  const event = findVisibleEvent(req.params.id, req.userId);
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
