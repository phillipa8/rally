// server.js — Rally API entry point (Phase 0 foundation).
// Wires security/config + sessions, mounts feature routers, and exposes /api/health.
// Feature tracks add their routers where marked below.
import 'dotenv/config';
import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import session from 'express-session';
import SqliteStoreFactory from 'better-sqlite3-session-store';

import db from './db/db.js';
import authRouter from './routes/auth.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

const app = express();
const PORT = process.env.PORT || 4000;
const isProd = process.env.NODE_ENV === 'production';
const SqliteStore = SqliteStoreFactory(session);

// Behind Render's TLS-terminating proxy in production so secure cookies are set.
app.set('trust proxy', 1);

// --- Security / config middleware (must come BEFORE routes) ---------------
// cross-origin CORP so images served from /uploads load on a different frontend origin.
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
// Credentialed CORS — origin must be the specific frontend origin (not "*").
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
    credentials: true,
  })
);
app.use(express.json());
app.use(morgan('dev'));

// --- Sessions (httpOnly cookie, stored in the same SQLite DB) -------------
app.use(
  session({
    store: new SqliteStore({ client: db, expired: { clear: true, intervalMs: 15 * 60 * 1000 } }),
    secret: process.env.SESSION_SECRET || 'dev-only-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProd, // requires HTTPS in production
      sameSite: isProd ? 'none' : 'lax', // cross-site cookie in prod (Vercel <-> Render)
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  })
);

// --- Static uploads (multer writes here in the media feature) -------------
app.use('/uploads', express.static(process.env.UPLOAD_DIR || path.join(import.meta.dirname, 'uploads')));

// --- Routes ---------------------------------------------------------------
app.get('/api/health', (_req, res) =>
  res.json({ status: 'ok', service: 'rally-api', time: new Date().toISOString() })
);
app.use('/api/auth', authRouter);
// TODO (feature tracks):
//   app.use('/api/users', usersRouter);          // A
//   app.use('/api/follow-requests', ...);        // A
//   app.use('/api/notifications', ...);          // A
//   app.use('/api/trending', ...);               // A
//   app.use('/api/posts', postsRouter);          // B (+ likes/reposts/replies from D)
//   app.use('/api/feed', feedRouter);            // B
//   app.use('/api/media', mediaRouter);          // B
//   app.use('/api/bookmarks', ...);              // B
//   app.use('/api/events', eventsRouter);        // C
//   app.use('/api/categories', categoriesRouter);// C
//   app.use('/api/search', searchRouter);        // D

// --- 404 + central error handler (LAST) ----------------------------------
app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[rally-api] listening on http://localhost:${PORT}`);
});
