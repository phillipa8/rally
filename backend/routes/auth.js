// auth.js — authentication endpoints (register / login / logout / me).
// This is the one feature router included in Phase 0 so the foundation is
// testable end-to-end (React -> axios -> cookie -> session -> SQLite -> bcrypt).
import { Router } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import db from '../db/db.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const SALT_ROUNDS = 12;
// Precomputed hash to compare against when a username is unknown, so login response
// timing is the same whether or not the user exists (prevents username enumeration).
const DUMMY_HASH = bcrypt.hashSync('unused-placeholder', SALT_ROUNDS);

const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Use letters, numbers, and underscores only'),
  displayName: z.string().trim().min(1, 'Display name is required').max(50),
  password: z.string().min(8, 'Password must be at least 8 characters').max(100),
});

const loginSchema = z.object({
  username: z.string().trim().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

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

// POST /api/auth/register
router.post('/register', validate(registerSchema), async (req, res) => {
  const { username, displayName, password } = req.body;

  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (exists) return res.status(409).json({ error: 'Username is already taken' });

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  let info;
  try {
    info = db
      .prepare('INSERT INTO users (username, display_name, password_hash) VALUES (?, ?, ?)')
      .run(username, displayName, passwordHash);
  } catch (err) {
    // Handle the check-then-insert race on the UNIQUE username -> clean 409, not 500.
    if (String(err.code).startsWith('SQLITE_CONSTRAINT')) {
      return res.status(409).json({ error: 'Username is already taken' });
    }
    throw err;
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  req.session.userId = user.id;
  res.status(201).json({ user: publicUser(user) });
});

// POST /api/auth/login
router.post('/login', validate(loginSchema), async (req, res) => {
  const { username, password } = req.body;

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  // Always run a real bcrypt comparison (against a dummy hash when the user is unknown)
  // so timing is constant and doesn't reveal whether the username exists.
  const passwordOk = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
  if (!user || !passwordOk) return res.status(401).json({ error: 'Invalid username or password' });

  req.session.userId = user.id;
  res.json({ user: publicUser(user) });
});

// POST /api/auth/logout  (protected: returns 401 if not logged in)
router.post('/logout', requireAuth, (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: 'Could not log out' });
    res.clearCookie('connect.sid');
    res.status(204).end();
  });
});

// GET /api/auth/me  (public probe: 200 with { user } or { user: null })
router.get('/me', (req, res) => {
  const userId = req.session && req.session.userId;
  if (!userId) return res.json({ user: null });
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  res.json({ user: user ? publicUser(user) : null });
});

export default router;
