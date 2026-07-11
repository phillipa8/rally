// admin.js — operations utility: bulk fixture import for demo/staging instances.
// POST /api/admin/import loads a full fixture payload (users, follows, events,
// posts, engagement, DMs, notifications) with explicit ids and timestamps so a
// freshly-created database can be populated in one call — useful because free
// hosting tiers wipe the SQLite file on every restart.
//
// SECURITY: the router is INERT unless the ADMIN_TOKEN environment variable is
// set. Without it — or with a wrong x-admin-token header — every request gets a
// 404, as if the route didn't exist. The token lives only in the host's
// environment (never in the repo), and comparison is constant-time.
import { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import db from '../db/db.js';
import { validate } from '../middleware/validate.js';

const router = Router();
const SALT_ROUNDS = 12; // matches routes/auth.js

function requireAdminToken(req, res, next) {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return res.status(404).json({ error: 'Not found' });
  const given = Buffer.from(req.get('x-admin-token') || '');
  const expected = Buffer.from(token);
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
    return res.status(404).json({ error: 'Not found' });
  }
  next();
}

// All timestamps must be the storage format used across the app: UTC
// 'YYYY-MM-DD HH:MM:SS' (space separator, compares lexically with datetime('now')).
const sqlTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/, "Use UTC 'YYYY-MM-DD HH:MM:SS'");
const id = z.number().int().positive();

const importSchema = z.object({
  reset: z.boolean().optional(), // clear existing app data first (categories/sessions kept)
  users: z
    .array(
      z.object({
        id,
        username: z.string().trim().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/),
        displayName: z.string().trim().min(1).max(50),
        password: z.string().min(8).max(100), // hashed server-side with bcrypt
        bio: z.string().trim().max(160).optional(),
        avatarUrl: z.string().trim().max(500).optional(),
        isPrivate: z.boolean().optional(),
        createdAt: sqlTime,
      })
    )
    .max(500) // bcrypt hashing is synchronous — bound the work a single request can demand
    .default([]),
  follows: z
    .array(
      z.object({
        followerId: id,
        followingId: id,
        status: z.enum(['pending', 'accepted']).default('accepted'),
        createdAt: sqlTime,
      })
    )
    .default([]),
  events: z
    .array(
      z.object({
        id,
        creatorId: id,
        title: z.string().trim().min(1).max(120),
        description: z.string().trim().max(2000).optional(),
        categorySlug: z.string().trim().min(1),
        startTime: sqlTime,
        endTime: sqlTime,
        location: z.string().trim().max(200).optional(),
        ageRestriction: z.number().int().min(0).max(99).optional(),
        isPrivate: z.boolean().optional(),
        createdAt: sqlTime,
      })
    )
    .default([]),
  posts: z
    .array(
      z.object({
        id,
        authorId: id,
        content: z.string().trim().min(1).max(280),
        eventId: id.optional(),
        parentPostId: id.optional(), // must reference a lower post id
        quotedPostId: id.optional(), // must reference a lower post id
        mediaUrl: z.string().trim().max(500).optional(),
        commentsDisabled: z.boolean().optional(),
        createdAt: sqlTime,
      })
    )
    .default([]),
  pollOptions: z
    .array(z.object({ id, postId: id, position: z.number().int().min(0), text: z.string().trim().min(1).max(80) }))
    .default([]),
  pollVotes: z.array(z.object({ postId: id, userId: id, optionId: id, createdAt: sqlTime })).default([]),
  likes: z.array(z.object({ userId: id, postId: id, createdAt: sqlTime })).default([]),
  reposts: z.array(z.object({ userId: id, postId: id, createdAt: sqlTime })).default([]),
  bookmarks: z.array(z.object({ userId: id, postId: id, createdAt: sqlTime })).default([]),
  eventParticipants: z
    .array(
      z.object({
        userId: id,
        eventId: id,
        status: z.enum(['going', 'interested', 'not_going']).default('going'),
        createdAt: sqlTime,
      })
    )
    .default([]),
  messages: z
    .array(
      z.object({
        id,
        senderId: id,
        recipientId: id,
        content: z.string().trim().min(1).max(1000),
        createdAt: sqlTime,
        readAt: sqlTime.nullable().optional(),
      })
    )
    .default([]),
  notifications: z
    .array(
      z.object({
        recipientId: id,
        actorId: id.optional(),
        type: z.enum(['follow', 'follow_request', 'like', 'reply', 'repost', 'event_update', 'participate']),
        postId: id.optional(),
        eventId: id.optional(),
        isRead: z.boolean().optional(),
        createdAt: sqlTime,
      })
    )
    .default([]),
});

// Children before parents so foreign keys never dangle mid-reset.
const RESET_ORDER = [
  'notifications',
  'poll_votes',
  'poll_options',
  'direct_messages',
  'event_participants',
  'bookmarks',
  'reposts',
  'likes',
  'posts',
  'events',
  'blocks',
  'follows',
  'users',
];

router.post('/import', requireAdminToken, validate(importSchema), (req, res) => {
  const p = req.body;

  // Hash each distinct password once (bcrypt cost 12 is ~250ms per hash).
  const hashCache = new Map();
  const hashOf = (pw) => {
    if (!hashCache.has(pw)) hashCache.set(pw, bcrypt.hashSync(pw, SALT_ROUNDS));
    return hashCache.get(pw);
  };

  const counts = {};
  const run = db.transaction(() => {
    if (p.reset) for (const table of RESET_ORDER) db.prepare(`DELETE FROM ${table}`).run();

    const insertUser = db.prepare(
      `INSERT INTO users (id, username, display_name, password_hash, bio, avatar_url, is_private, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const u of p.users) {
      insertUser.run(u.id, u.username, u.displayName, hashOf(u.password), u.bio ?? null,
        u.avatarUrl ?? null, u.isPrivate ? 1 : 0, u.createdAt);
    }

    const insertFollow = db.prepare(
      'INSERT INTO follows (follower_id, following_id, status, created_at) VALUES (?, ?, ?, ?)'
    );
    for (const f of p.follows) insertFollow.run(f.followerId, f.followingId, f.status, f.createdAt);

    const categoryBySlug = new Map(
      db.prepare('SELECT id, slug FROM categories').all().map((c) => [c.slug, c.id])
    );
    const insertEvent = db.prepare(
      `INSERT INTO events (id, creator_id, title, description, category_id, start_time, end_time,
                           location, age_restriction, is_private, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const e of p.events) {
      const categoryId = categoryBySlug.get(e.categorySlug);
      if (!categoryId) throw Object.assign(new Error(`Unknown category slug: ${e.categorySlug}`), { status: 400 });
      insertEvent.run(e.id, e.creatorId, e.title, e.description ?? null, categoryId, e.startTime,
        e.endTime, e.location ?? null, e.ageRestriction ?? 0, e.isPrivate ? 1 : 0, e.createdAt);
    }

    const insertPost = db.prepare(
      `INSERT INTO posts (id, author_id, content, event_id, parent_post_id, quoted_post_id,
                          media_url, comments_disabled, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    // Ascending ids so parent/quoted references (always lower ids) already exist.
    for (const post of [...p.posts].sort((a, b) => a.id - b.id)) {
      insertPost.run(post.id, post.authorId, post.content, post.eventId ?? null,
        post.parentPostId ?? null, post.quotedPostId ?? null, post.mediaUrl ?? null,
        post.commentsDisabled ? 1 : 0, post.createdAt);
    }

    const insertOption = db.prepare(
      'INSERT INTO poll_options (id, post_id, position, text) VALUES (?, ?, ?, ?)'
    );
    for (const o of p.pollOptions) insertOption.run(o.id, o.postId, o.position, o.text);

    const insertVote = db.prepare(
      'INSERT INTO poll_votes (post_id, user_id, option_id, created_at) VALUES (?, ?, ?, ?)'
    );
    for (const v of p.pollVotes) insertVote.run(v.postId, v.userId, v.optionId, v.createdAt);

    const insertLike = db.prepare('INSERT INTO likes (user_id, post_id, created_at) VALUES (?, ?, ?)');
    for (const l of p.likes) insertLike.run(l.userId, l.postId, l.createdAt);

    const insertRepost = db.prepare('INSERT INTO reposts (user_id, post_id, created_at) VALUES (?, ?, ?)');
    for (const r of p.reposts) insertRepost.run(r.userId, r.postId, r.createdAt);

    const insertBookmark = db.prepare('INSERT INTO bookmarks (user_id, post_id, created_at) VALUES (?, ?, ?)');
    for (const b of p.bookmarks) insertBookmark.run(b.userId, b.postId, b.createdAt);

    const insertParticipant = db.prepare(
      'INSERT INTO event_participants (user_id, event_id, status, created_at) VALUES (?, ?, ?, ?)'
    );
    for (const ep of p.eventParticipants) insertParticipant.run(ep.userId, ep.eventId, ep.status, ep.createdAt);

    const insertMessage = db.prepare(
      `INSERT INTO direct_messages (id, sender_id, recipient_id, content, created_at, read_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    for (const m of p.messages) insertMessage.run(m.id, m.senderId, m.recipientId, m.content, m.createdAt, m.readAt ?? null);

    const insertNotification = db.prepare(
      `INSERT INTO notifications (recipient_id, actor_id, type, post_id, event_id, is_read, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    for (const n of p.notifications) {
      insertNotification.run(n.recipientId, n.actorId ?? null, n.type, n.postId ?? null,
        n.eventId ?? null, n.isRead ? 1 : 0, n.createdAt);
    }

    counts.users = p.users.length;
    counts.follows = p.follows.length;
    counts.events = p.events.length;
    counts.posts = p.posts.length;
    counts.pollOptions = p.pollOptions.length;
    counts.pollVotes = p.pollVotes.length;
    counts.likes = p.likes.length;
    counts.reposts = p.reposts.length;
    counts.bookmarks = p.bookmarks.length;
    counts.eventParticipants = p.eventParticipants.length;
    counts.messages = p.messages.length;
    counts.notifications = p.notifications.length;
  });

  try {
    run();
  } catch (err) {
    if (err.status === 400 || String(err.code).startsWith('SQLITE_CONSTRAINT')) {
      return res.status(400).json({ error: err.message });
    }
    throw err;
  }

  res.status(201).json({ imported: counts, reset: !!p.reset });
});

export default router;
