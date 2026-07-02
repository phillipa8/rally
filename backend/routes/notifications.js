// notifications.js — in-app notifications (Owner: Member A).
// Mounted at /api/notifications. Every route is scoped to the logged-in user's
// OWN notifications (recipient_id = req.userId), so a user can never read or
// mutate someone else's. Rows are written by other features (follow, like,
// reply, repost, event_update, participate); this router only reads/marks them.
import { Router } from 'express';
import db from '../db/db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Shape a joined row -> client notification. actor_* is null for system rows.
function toNotification(row) {
  return {
    id: row.id,
    type: row.type,
    isRead: !!row.is_read,
    createdAt: row.created_at,
    postId: row.post_id,
    eventId: row.event_id,
    actor: row.actor_id
      ? {
          id: row.actor_id,
          username: row.actor_username,
          displayName: row.actor_display_name,
          avatarUrl: row.actor_avatar_url,
        }
      : null,
  };
}

// GET /api/notifications  — the user's notifications, newest first (latest 50).
// Left-joins the actor so the client can render "X followed you" without a
// second request; actor is null for system-generated notifications.
router.get('/', requireAuth, (req, res) => {
  const rows = db
    .prepare(
      `SELECT n.id, n.type, n.is_read, n.created_at, n.post_id, n.event_id, n.actor_id,
              u.username     AS actor_username,
              u.display_name AS actor_display_name,
              u.avatar_url   AS actor_avatar_url
         FROM notifications n
         LEFT JOIN users u ON u.id = n.actor_id
        WHERE n.recipient_id = ?
        ORDER BY n.created_at DESC, n.id DESC
        LIMIT 50`
    )
    .all(req.userId);

  res.json({ notifications: rows.map(toNotification) });
});

export default router;
