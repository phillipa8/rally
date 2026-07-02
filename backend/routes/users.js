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

export default router;
