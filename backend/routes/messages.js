// messages.js — direct messages between a user and their followers.
import { Router } from 'express';
import { z } from 'zod';
import db from '../db/db.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

const messageSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'Message cannot be empty')
    .max(1000, 'Message must be at most 1000 characters'),
});

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

function publicUserFromAlias(row, prefix) {
  return {
    id: row[`${prefix}Id`],
    username: row[`${prefix}Username`],
    displayName: row[`${prefix}DisplayName`],
    avatarUrl: row[`${prefix}AvatarUrl`] ?? null,
  };
}

function messageFromRow(row) {
  return {
    id: row.id,
    content: row.content,
    createdAt: row.created_at,
    sender: publicUserFromAlias(row, 'sender'),
    recipient: publicUserFromAlias(row, 'recipient'),
  };
}

function findByUsername(username) {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
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

function hasMessageAccess(userId, otherId) {
  if (userId === otherId || isBlockedEitherWay(userId, otherId)) return false;
  return !!db
    .prepare(
      `SELECT 1 FROM follows
        WHERE status = 'accepted'
          AND ((follower_id = ? AND following_id = ?)
            OR (follower_id = ? AND following_id = ?))
        LIMIT 1`
    )
    .get(otherId, userId, userId, otherId);
}

// GET /api/messages — followers plus active conversations, newest first.
router.get('/', requireAuth, (req, res) => {
  const rows = db
    .prepare(
      `WITH people(id) AS (
         SELECT follower_id
           FROM follows
          WHERE following_id = ? AND status = 'accepted'
         UNION
         SELECT CASE WHEN sender_id = ? THEN recipient_id ELSE sender_id END
           FROM direct_messages
          WHERE sender_id = ? OR recipient_id = ?
       )
       SELECT u.*,
              (SELECT dm.content
                 FROM direct_messages dm
                WHERE (dm.sender_id = ? AND dm.recipient_id = u.id)
                   OR (dm.sender_id = u.id AND dm.recipient_id = ?)
                ORDER BY dm.created_at DESC, dm.id DESC
                LIMIT 1) AS lastMessage,
              (SELECT dm.created_at
                 FROM direct_messages dm
                WHERE (dm.sender_id = ? AND dm.recipient_id = u.id)
                   OR (dm.sender_id = u.id AND dm.recipient_id = ?)
                ORDER BY dm.created_at DESC, dm.id DESC
                LIMIT 1) AS lastMessageAt
          FROM people p
          JOIN users u ON u.id = p.id
         WHERE NOT EXISTS (
                 SELECT 1 FROM blocks b
                  WHERE (b.blocker_id = ? AND b.blocked_id = u.id)
                     OR (b.blocker_id = u.id AND b.blocked_id = ?)
               )
         ORDER BY lastMessageAt IS NULL, lastMessageAt DESC, u.username ASC`
    )
    .all(
      req.userId,
      req.userId,
      req.userId,
      req.userId,
      req.userId,
      req.userId,
      req.userId,
      req.userId,
      req.userId,
      req.userId
    );

  res.json({
    conversations: rows.map((row) => ({
      user: publicUser(row),
      lastMessage: row.lastMessage ?? null,
      lastMessageAt: row.lastMessageAt ?? null,
    })),
  });
});

// GET /api/messages/:username — message thread between the viewer and one user.
router.get('/:username', requireAuth, (req, res) => {
  const other = findByUsername(req.params.username);
  if (!other) return res.status(404).json({ error: 'User not found' });
  if (!hasMessageAccess(req.userId, other.id)) {
    return res.status(403).json({ error: 'You can only message accepted followers' });
  }

  const rows = db
    .prepare(
      `SELECT dm.*,
              su.id AS senderId, su.username AS senderUsername,
              su.display_name AS senderDisplayName, su.avatar_url AS senderAvatarUrl,
              ru.id AS recipientId, ru.username AS recipientUsername,
              ru.display_name AS recipientDisplayName, ru.avatar_url AS recipientAvatarUrl
         FROM direct_messages dm
         JOIN users su ON su.id = dm.sender_id
         JOIN users ru ON ru.id = dm.recipient_id
        WHERE (dm.sender_id = ? AND dm.recipient_id = ?)
           OR (dm.sender_id = ? AND dm.recipient_id = ?)
        ORDER BY dm.created_at ASC, dm.id ASC
        LIMIT 100`
    )
    .all(req.userId, other.id, other.id, req.userId);

  res.json({ user: publicUser(other), messages: rows.map(messageFromRow) });
});

// POST /api/messages/:username — send a direct message.
router.post('/:username', requireAuth, validate(messageSchema), (req, res) => {
  const other = findByUsername(req.params.username);
  if (!other) return res.status(404).json({ error: 'User not found' });
  if (!hasMessageAccess(req.userId, other.id)) {
    return res.status(403).json({ error: 'You can only message accepted followers' });
  }

  const info = db
    .prepare('INSERT INTO direct_messages (sender_id, recipient_id, content) VALUES (?, ?, ?)')
    .run(req.userId, other.id, req.body.content);

  const row = db
    .prepare(
      `SELECT dm.*,
              su.id AS senderId, su.username AS senderUsername,
              su.display_name AS senderDisplayName, su.avatar_url AS senderAvatarUrl,
              ru.id AS recipientId, ru.username AS recipientUsername,
              ru.display_name AS recipientDisplayName, ru.avatar_url AS recipientAvatarUrl
         FROM direct_messages dm
         JOIN users su ON su.id = dm.sender_id
         JOIN users ru ON ru.id = dm.recipient_id
        WHERE dm.id = ?`
    )
    .get(info.lastInsertRowid);

  res.status(201).json({ message: messageFromRow(row) });
});

export default router;
