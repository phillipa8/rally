// followRequests.js — approval-gated follow requests (Owner: Member A).
// Mounted at /api/follow-requests. All routes require auth and act on the
// logged-in user's INCOMING pending requests. Since `follows` has a composite
// PK (follower_id, following_id) and no surrogate id, ":id" here is the
// requester's user id (the person who asked to follow you).
import { Router } from 'express';
import db from '../db/db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

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

// GET /api/follow-requests  — people awaiting your approval, newest first.
router.get('/', requireAuth, (req, res) => {
  const rows = db
    .prepare(
      `SELECT u.*, f.created_at AS requested_at
         FROM follows f
         JOIN users u ON u.id = f.follower_id
        WHERE f.following_id = ? AND f.status = 'pending'
        ORDER BY f.created_at DESC`
    )
    .all(req.userId);

  res.json({
    requests: rows.map((r) => ({ ...publicUser(r), requestedAt: r.requested_at })),
  });
});

// PUT /api/follow-requests/:id/accept  — approve requester :id.
// Notifies the requester ('follow') that they now follow you.
router.put('/:id/accept', requireAuth, (req, res) => {
  const requesterId = Number(req.params.id);
  const info = db
    .prepare(
      "UPDATE follows SET status = 'accepted' WHERE follower_id = ? AND following_id = ? AND status = 'pending'"
    )
    .run(requesterId, req.userId);
  if (info.changes === 0) return res.status(404).json({ error: 'No pending request from that user' });

  db.prepare('INSERT INTO notifications (recipient_id, actor_id, type) VALUES (?, ?, ?)')
    .run(requesterId, req.userId, 'follow');

  res.json({ status: 'accepted' });
});

// PUT /api/follow-requests/:id/reject  — decline requester :id (row is removed).
router.put('/:id/reject', requireAuth, (req, res) => {
  const requesterId = Number(req.params.id);
  const info = db
    .prepare(
      "DELETE FROM follows WHERE follower_id = ? AND following_id = ? AND status = 'pending'"
    )
    .run(requesterId, req.userId);
  if (info.changes === 0) return res.status(404).json({ error: 'No pending request from that user' });

  res.json({ status: 'rejected' });
});

export default router;
