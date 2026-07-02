// users.js — users & social-graph endpoints (Owner: Member A).
// Profiles, a user's posts, editing your own profile, follower/following lists,
// and follow / unfollow (approval-gated for private accounts).
import { Router } from 'express';
import { z } from 'zod';
import db from '../db/db.js';
import { validate } from '../middleware/validate.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { visiblePostsWhere } from '../lib/visibility.js';

const router = Router();

// Profile edit — every field optional (partial update), but at least one required.
const updateMeSchema = z
  .object({
    displayName: z.string().trim().min(1, 'Display name is required').max(50).optional(),
    bio: z.string().trim().max(160, 'Bio must be at most 160 characters').optional(),
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
    .get(userId).n;
  return { followers, following, posts };
}

// PUT /api/users/me  — update your own profile (displayName, bio, isPrivate).
// Placed before the /:username routes so "me" is never treated as a username.
// Flipping isPrivate from true -> false auto-accepts any pending follow requests,
// matching how real platforms open up a newly-public account.
router.put('/me', requireAuth, validate(updateMeSchema), (req, res) => {
  const { displayName, bio, isPrivate } = req.body;

  const fields = [];
  const params = [];
  if (displayName !== undefined) { fields.push('display_name = ?'); params.push(displayName); }
  if (bio !== undefined) { fields.push('bio = ?'); params.push(bio); }
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

// GET /api/users/:username  — public profile (private content is gated elsewhere).
// Includes follower/following/post counts and, for a logged-in viewer, how they
// currently relate to this profile (followStatus + isMe).
router.get('/:username', optionalAuth, (req, res) => {
  const row = findByUsername(req.params.username);
  if (!row) return res.status(404).json({ error: 'User not found' });

  res.json({
    user: publicUser(row),
    counts: profileCounts(row.id),
    isMe: req.userId === row.id,
    followStatus: followStatus(req.userId, row.id),
  });
});

// GET /api/users/:username/posts  — a user's top-level posts, newest first.
// Replies (parent_post_id IS NOT NULL) are excluded from the profile timeline.
// visiblePostsWhere gates private accounts: only the owner or an accepted
// follower sees a private user's posts; everyone else gets an empty list.
router.get('/:username/posts', optionalAuth, (req, res) => {
  const author = findByUsername(req.params.username);
  if (!author) return res.status(404).json({ error: 'User not found' });

  const v = visiblePostsWhere(req.userId);
  const rows = db
    .prepare(
      `SELECT p.id, p.content, p.event_id AS eventId, p.media_url AS mediaUrl, p.created_at AS createdAt,
              u.username, u.display_name AS displayName, u.avatar_url AS avatarUrl
         FROM posts p
         JOIN users u ON u.id = p.author_id
        WHERE p.author_id = ? AND p.parent_post_id IS NULL AND ${v.clause}
        ORDER BY p.created_at DESC, p.id DESC`
    )
    .all(author.id, ...v.params);

  res.json({ posts: rows });
});

// GET /api/users/:username/followers  — accepted followers of this user.
router.get('/:username/followers', optionalAuth, (req, res) => {
  const target = findByUsername(req.params.username);
  if (!target) return res.status(404).json({ error: 'User not found' });

  const rows = db
    .prepare(
      `SELECT u.* FROM follows f
         JOIN users u ON u.id = f.follower_id
        WHERE f.following_id = ? AND f.status = 'accepted'
        ORDER BY f.created_at DESC`
    )
    .all(target.id);

  res.json({ users: rows.map(publicUser) });
});

// GET /api/users/:username/following  — accounts this user follows (accepted).
router.get('/:username/following', optionalAuth, (req, res) => {
  const target = findByUsername(req.params.username);
  if (!target) return res.status(404).json({ error: 'User not found' });

  const rows = db
    .prepare(
      `SELECT u.* FROM follows f
         JOIN users u ON u.id = f.following_id
        WHERE f.follower_id = ? AND f.status = 'accepted'
        ORDER BY f.created_at DESC`
    )
    .all(target.id);

  res.json({ users: rows.map(publicUser) });
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

export default router;
