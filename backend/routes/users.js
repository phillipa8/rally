// users.js — users & social-graph endpoints (Owner: Member A).
// Profiles, a user's posts, editing your own profile, follower/following lists,
// and follow / unfollow (approval-gated for private accounts).
import { Router } from 'express';
import { z } from 'zod';
import db from '../db/db.js';
import { validate } from '../middleware/validate.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { visibleEventsWhere, visiblePostsWhere } from '../lib/visibility.js';
import { postColumns, mapPost } from '../lib/postQuery.js';

const router = Router();

// Profile edit — every field optional (partial update), but at least one required.
const updateMeSchema = z
  .object({
    displayName: z.string().trim().min(1, 'Display name is required').max(50).optional(),
    bio: z.string().trim().max(160, 'Bio must be at most 160 characters').optional(),
    avatarUrl: z.string().trim().max(500, 'Avatar URL is too long').optional(),
    isPrivate: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'No fields to update' });

// Map a DB user row -> safe public shape (never expose password_hash).
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

function publicEvent(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    startTime: row.startTime,
    endTime: row.endTime,
    location: row.location,
    ageRestriction: row.ageRestriction,
    isPrivate: !!row.isPrivate,
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
      avatarUrl: row.creatorAvatarUrl ?? null,
    },
    participantCount: row.participantCount ?? 0,
  };
}

// Look up a user by username (case-insensitive via the column's COLLATE NOCASE).
// Returns the raw row or undefined.
function findByUsername(username) {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
}

// The follow relationship from viewerId -> targetId, or null.
// Returns 'accepted' | 'pending' | null so the client can render the right button.
function followStatus(viewerId, targetId) {
  if (!viewerId || viewerId === targetId) return null;
  const row = db
    .prepare('SELECT status FROM follows WHERE follower_id = ? AND following_id = ?')
    .get(viewerId, targetId);
  return row ? row.status : null;
}

function blockRelationship(viewerId, targetId) {
  if (!viewerId || viewerId === targetId) {
    return { blockedByMe: false, hasBlockedMe: false };
  }
  const rows = db
    .prepare(
      `SELECT blocker_id AS blockerId, blocked_id AS blockedId
         FROM blocks
        WHERE (blocker_id = ? AND blocked_id = ?)
           OR (blocker_id = ? AND blocked_id = ?)`
    )
    .all(viewerId, targetId, targetId, viewerId);

  return {
    blockedByMe: rows.some((row) => row.blockerId === viewerId && row.blockedId === targetId),
    hasBlockedMe: rows.some((row) => row.blockerId === targetId && row.blockedId === viewerId),
  };
}

function canViewProfileContent(viewerId, target) {
  if (blockRelationship(viewerId, target.id).hasBlockedMe) return false;
  if (!target.is_private || viewerId === target.id) return true;
  return followStatus(viewerId, target.id) === 'accepted';
}

// Aggregate profile counts. Only 'accepted' follows count toward follower/following;
// pending requests are not public relationships yet.
function profileCounts(userId) {
  const followers = db
    .prepare("SELECT COUNT(*) AS n FROM follows WHERE following_id = ? AND status = 'accepted'")
    .get(userId).n;
  const following = db
    .prepare("SELECT COUNT(*) AS n FROM follows WHERE follower_id = ? AND status = 'accepted'")
    .get(userId).n;
  const posts = db
    .prepare('SELECT COUNT(*) AS n FROM posts WHERE author_id = ? AND parent_post_id IS NULL')
    .get(userId).n +
    db.prepare('SELECT COUNT(*) AS n FROM reposts WHERE user_id = ?').get(userId).n;
  const requests = db
    .prepare("SELECT COUNT(*) AS n FROM follows WHERE following_id = ? AND status = 'pending'")
    .get(userId).n;
  const events = db.prepare('SELECT COUNT(*) AS n FROM events WHERE creator_id = ?').get(userId).n;
  return { followers, following, posts, requests, events };
}

// PUT /api/users/me  — update your own profile (displayName, bio, isPrivate).
// Placed before the /:username routes so "me" is never treated as a username.
// Flipping isPrivate from true -> false auto-accepts any pending follow requests,
// matching how real platforms open up a newly-public account.
router.put('/me', requireAuth, validate(updateMeSchema), (req, res) => {
  const { displayName, bio, avatarUrl, isPrivate } = req.body;

  const fields = [];
  const params = [];
  if (displayName !== undefined) { fields.push('display_name = ?'); params.push(displayName); }
  if (bio !== undefined) { fields.push('bio = ?'); params.push(bio); }
  if (avatarUrl !== undefined) { fields.push('avatar_url = ?'); params.push(avatarUrl || null); }
  if (isPrivate !== undefined) { fields.push('is_private = ?'); params.push(isPrivate ? 1 : 0); }

  const apply = db.transaction(() => {
    db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...params, req.userId);
    if (isPrivate === false) {
      db.prepare("UPDATE follows SET status = 'accepted' WHERE following_id = ? AND status = 'pending'")
        .run(req.userId);
    }
  });
  apply();

  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
  res.json({ user: publicUser(row) });
});

// GET /api/users/me/blocks — users you have blocked, newest first.
router.get('/me/blocks', requireAuth, (req, res) => {
  const rows = db
    .prepare(
      `SELECT u.*, b.created_at AS blockedAt
         FROM blocks b
         JOIN users u ON u.id = b.blocked_id
        WHERE b.blocker_id = ?
        ORDER BY b.created_at DESC, u.username ASC`
    )
    .all(req.userId);

  res.json({
    users: rows.map((row) => ({ ...publicUser(row), blockedAt: row.blockedAt })),
  });
});

// GET /api/users/:username  — public profile (private content is gated elsewhere).
// Includes follower/following/post counts and, for a logged-in viewer, how they
// currently relate to this profile (followStatus + isMe).
router.get('/:username', optionalAuth, (req, res) => {
  const row = findByUsername(req.params.username);
  if (!row) return res.status(404).json({ error: 'User not found' });
  const blocks = blockRelationship(req.userId, row.id);
  if (blocks.hasBlockedMe) return res.status(403).json({ error: 'You cannot view this profile' });

  res.json({
    user: publicUser(row),
    counts: profileCounts(row.id),
    isMe: req.userId === row.id,
    followStatus: followStatus(req.userId, row.id),
    blockedByMe: blocks.blockedByMe,
  });
});

// GET /api/users/:username/posts  — a user's top-level posts, newest first.
// Replies (parent_post_id IS NOT NULL) are excluded from the profile timeline.
// visiblePostsWhere gates private accounts: only the owner or an accepted
// follower sees a private user's posts; everyone else gets an empty list.
router.get('/:username/posts', optionalAuth, (req, res) => {
  const author = findByUsername(req.params.username);
  if (!author) return res.status(404).json({ error: 'User not found' });
  if (!canViewProfileContent(req.userId, author)) return res.json({ posts: [] });

  const v = visiblePostsWhere(req.userId);
  const { columns, viewerParams } = postColumns(req.userId);
  const sql = `
    SELECT ${columns}, p.created_at AS sortTime, NULL AS repostedBy
      FROM posts p
      JOIN users u ON u.id = p.author_id
     WHERE p.author_id = ? AND p.parent_post_id IS NULL AND ${v.clause}
    UNION ALL
    SELECT ${columns}, r.created_at AS sortTime, ru.username AS repostedBy
      FROM reposts r
      JOIN posts p ON p.id = r.post_id
      JOIN users u ON u.id = p.author_id
      JOIN users ru ON ru.id = r.user_id
     WHERE r.user_id = ? AND ${v.clause}
     ORDER BY sortTime DESC
     LIMIT 100`;
  const rows = db
    .prepare(sql)
    .all(...viewerParams, author.id, ...v.params, ...viewerParams, author.id, ...v.params);

  res.json({ posts: rows.map(mapPost) });
});

// GET /api/users/:username/likes — posts this user liked, newest liked first.
router.get('/:username/likes', optionalAuth, (req, res) => {
  const target = findByUsername(req.params.username);
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (!canViewProfileContent(req.userId, target)) return res.json({ posts: [] });

  const v = visiblePostsWhere(req.userId);
  const { columns, viewerParams } = postColumns(req.userId);
  const rows = db
    .prepare(
      `SELECT ${columns}, l.created_at AS likedAt
         FROM likes l
         JOIN posts p ON p.id = l.post_id
         JOIN users u ON u.id = p.author_id
        WHERE l.user_id = ? AND ${v.clause}
        ORDER BY l.created_at DESC, p.created_at DESC
        LIMIT 100`
    )
    .all(...viewerParams, target.id, ...v.params);

  res.json({ posts: rows.map(mapPost) });
});

// GET /api/users/:username/events — events hosted by this user.
router.get('/:username/events', optionalAuth, (req, res) => {
  const target = findByUsername(req.params.username);
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (!canViewProfileContent(req.userId, target)) return res.json({ events: [] });

  const v = visibleEventsWhere(req.userId, 'u');
  const rows = db
    .prepare(
      `SELECT e.id, e.title, e.description, e.location,
              e.start_time AS startTime, e.end_time AS endTime,
              e.age_restriction AS ageRestriction, e.is_private AS isPrivate,
              e.created_at AS createdAt,
              c.id AS categoryId, c.slug AS categorySlug, c.name AS categoryName,
              u.id AS creatorId, u.username AS creatorUsername,
              u.display_name AS creatorDisplayName, u.avatar_url AS creatorAvatarUrl,
              (SELECT COUNT(*) FROM event_participants ep
                WHERE ep.event_id = e.id AND ep.status IN ('going','interested')) AS participantCount
         FROM events e
         JOIN categories c ON c.id = e.category_id
         JOIN users u ON u.id = e.creator_id
        WHERE e.creator_id = ? AND ${v.clause}
        ORDER BY e.start_time DESC, e.id DESC
        LIMIT 100`
    )
    .all(target.id, ...v.params);

  res.json({ events: rows.map(publicEvent) });
});

// GET /api/users/:username/followers  — accepted followers of this user.
router.get('/:username/followers', optionalAuth, (req, res) => {
  const target = findByUsername(req.params.username);
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (!canViewProfileContent(req.userId, target)) {
    return res.status(403).json({ error: 'You cannot view this profile' });
  }

  const rows = db
    .prepare(
      `SELECT u.* FROM follows f
         JOIN users u ON u.id = f.follower_id
        WHERE f.following_id = ? AND f.status = 'accepted'
        ORDER BY f.created_at DESC`
    )
    .all(target.id);

  res.json({
    users: rows.map((u) => ({
      ...publicUser(u),
      followStatus: followStatus(req.userId, u.id), // viewer -> this user (null if logged out / self)
      isMe: req.userId === u.id,
    })),
  });
});

// GET /api/users/:username/following  — accounts this user follows (accepted).
router.get('/:username/following', optionalAuth, (req, res) => {
  const target = findByUsername(req.params.username);
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (!canViewProfileContent(req.userId, target)) {
    return res.status(403).json({ error: 'You cannot view this profile' });
  }

  const rows = db
    .prepare(
      `SELECT u.* FROM follows f
         JOIN users u ON u.id = f.following_id
        WHERE f.follower_id = ? AND f.status = 'accepted'
        ORDER BY f.created_at DESC`
    )
    .all(target.id);

  res.json({
    users: rows.map((u) => ({
      ...publicUser(u),
      followStatus: followStatus(req.userId, u.id), // viewer -> this user (null if logged out / self)
      isMe: req.userId === u.id,
    })),
  });
});

// Insert an in-app notification. The notifications router (Member A) reads these.
// Kept local so this router owns its own side effects; safe to swap for a shared
// helper later without changing callers.
function notify(recipientId, actorId, type) {
  db.prepare('INSERT INTO notifications (recipient_id, actor_id, type) VALUES (?, ?, ?)')
    .run(recipientId, actorId, type);
}

// POST /api/users/:username/follow  — follow (public) or request to follow (private).
// Public target  -> status 'accepted' immediately + 'follow' notification.
// Private target -> status 'pending' (awaits approval) + 'follow_request' notification.
// Idempotent: following again returns the current status without duplicating rows.
router.post('/:username/follow', requireAuth, (req, res) => {
  const target = findByUsername(req.params.username);
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (target.id === req.userId) return res.status(400).json({ error: 'You cannot follow yourself' });
  const blocks = blockRelationship(req.userId, target.id);
  if (blocks.hasBlockedMe) return res.status(403).json({ error: 'You are blocked by this user' });
  if (blocks.blockedByMe) {
    return res.status(403).json({ error: 'Unblock this user before following them' });
  }

  const existing = db
    .prepare('SELECT status FROM follows WHERE follower_id = ? AND following_id = ?')
    .get(req.userId, target.id);
  if (existing) return res.json({ status: existing.status });

  const status = target.is_private ? 'pending' : 'accepted';
  db.prepare('INSERT INTO follows (follower_id, following_id, status) VALUES (?, ?, ?)')
    .run(req.userId, target.id, status);
  notify(target.id, req.userId, status === 'pending' ? 'follow_request' : 'follow');

  res.status(201).json({ status });
});

// DELETE /api/users/:username/follow  — unfollow, or cancel a pending request.
// 204 whether or not a row existed (idempotent from the client's perspective).
router.delete('/:username/follow', requireAuth, (req, res) => {
  const target = findByUsername(req.params.username);
  if (!target) return res.status(404).json({ error: 'User not found' });

  db.prepare('DELETE FROM follows WHERE follower_id = ? AND following_id = ?')
    .run(req.userId, target.id);

  res.status(204).end();
});

// POST /api/users/:username/block — block a user and remove follow edges both ways.
router.post('/:username/block', requireAuth, (req, res) => {
  const target = findByUsername(req.params.username);
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (target.id === req.userId) return res.status(400).json({ error: 'You cannot block yourself' });

  db.transaction(() => {
    db.prepare('INSERT OR IGNORE INTO blocks (blocker_id, blocked_id) VALUES (?, ?)')
      .run(req.userId, target.id);
    db.prepare(
      `DELETE FROM follows
        WHERE (follower_id = ? AND following_id = ?)
           OR (follower_id = ? AND following_id = ?)`
    ).run(target.id, req.userId, req.userId, target.id);
  })();

  res.status(201).json({ blocked: true, user: publicUser(target) });
});

// DELETE /api/users/:username/block — unblock a user.
router.delete('/:username/block', requireAuth, (req, res) => {
  const target = findByUsername(req.params.username);
  if (!target) return res.status(404).json({ error: 'User not found' });

  db.prepare('DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?')
    .run(req.userId, target.id);

  res.status(204).end();
});

export default router;
