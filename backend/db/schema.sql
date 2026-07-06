-- ============================================================================
-- schema.sql — Rally database schema
-- Recreate the database with:  sqlite3 app.db < backend/db/schema.sql
-- Also run on startup by db/db.js (statements are idempotent: IF NOT EXISTS).
-- NOTE: better-sqlite3 must ALSO run db.pragma('foreign_keys = ON') per connection.
-- ============================================================================

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- ============ USERS ============
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY,
  username      TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  display_name  TEXT    NOT NULL,
  password_hash TEXT    NOT NULL,                 -- bcrypt hash, never plaintext
  bio           TEXT,
  avatar_url    TEXT,
  is_private    INTEGER NOT NULL DEFAULT 0 CHECK (is_private IN (0,1)),
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  CHECK (length(trim(username))     BETWEEN 1 AND 30),
  CHECK (length(trim(display_name)) BETWEEN 1 AND 50)
);

-- ============ CATEGORIES (fixed seed; the hashtag substitute) ============
CREATE TABLE IF NOT EXISTS categories (
  id   INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL UNIQUE
);

-- ============ EVENTS ============
CREATE TABLE IF NOT EXISTS events (
  id              INTEGER PRIMARY KEY,
  creator_id      INTEGER NOT NULL,
  title           TEXT    NOT NULL,
  description     TEXT,
  category_id     INTEGER NOT NULL,
  start_time      TEXT    NOT NULL,               -- ISO8601 'YYYY-MM-DD HH:MM:SS'
  end_time        TEXT    NOT NULL,
  location        TEXT,
  age_restriction INTEGER NOT NULL DEFAULT 0 CHECK (age_restriction BETWEEN 0 AND 99),
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (creator_id)  REFERENCES users(id)      ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
  CHECK (length(trim(title)) BETWEEN 1 AND 120),
  CHECK (end_time >= start_time)
);

-- ============ POSTS (original posts, replies, event-shares) ============
CREATE TABLE IF NOT EXISTS posts (
  id             INTEGER PRIMARY KEY,
  author_id      INTEGER NOT NULL,
  content        TEXT    NOT NULL,
  event_id       INTEGER,                          -- nullable: this post shares an event
  parent_post_id INTEGER,                          -- nullable: this post is a reply
  quoted_post_id INTEGER,                          -- nullable: this post quotes another post
  media_url      TEXT,                             -- nullable: single image
  created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (author_id)      REFERENCES users(id)  ON DELETE CASCADE,
  FOREIGN KEY (event_id)       REFERENCES events(id) ON DELETE SET NULL,
  FOREIGN KEY (parent_post_id) REFERENCES posts(id)  ON DELETE CASCADE,
  FOREIGN KEY (quoted_post_id) REFERENCES posts(id)  ON DELETE SET NULL,
  CHECK (length(content) <= 280 AND length(trim(content)) > 0)  -- 280 limit + non-empty
);

-- ============ FOLLOWS (approval-gated social graph) ============
CREATE TABLE IF NOT EXISTS follows (
  follower_id  INTEGER NOT NULL,
  following_id INTEGER NOT NULL,
  status       TEXT    NOT NULL DEFAULT 'accepted' CHECK (status IN ('pending','accepted')),
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (follower_id, following_id),
  FOREIGN KEY (follower_id)  REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE,
  CHECK (follower_id <> following_id)
);

-- ============ BLOCKS ============
CREATE TABLE IF NOT EXISTS blocks (
  blocker_id INTEGER NOT NULL,
  blocked_id INTEGER NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (blocker_id, blocked_id),
  FOREIGN KEY (blocker_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (blocked_id) REFERENCES users(id) ON DELETE CASCADE,
  CHECK (blocker_id <> blocked_id)
);

-- ============ LIKES ============
CREATE TABLE IF NOT EXISTS likes (
  user_id    INTEGER NOT NULL,
  post_id    INTEGER NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, post_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
);

-- ============ REPOSTS ============
CREATE TABLE IF NOT EXISTS reposts (
  user_id    INTEGER NOT NULL,
  post_id    INTEGER NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, post_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
);

-- ============ BOOKMARKS (private saved posts) ============
CREATE TABLE IF NOT EXISTS bookmarks (
  user_id    INTEGER NOT NULL,
  post_id    INTEGER NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, post_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
);

-- ============ EVENT PARTICIPATION ============
CREATE TABLE IF NOT EXISTS event_participants (
  user_id    INTEGER NOT NULL,
  event_id   INTEGER NOT NULL,
  status     TEXT    NOT NULL DEFAULT 'going' CHECK (status IN ('going','interested','not_going')),
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, event_id),
  FOREIGN KEY (user_id)  REFERENCES users(id)  ON DELETE CASCADE,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

-- ============ DIRECT MESSAGES ============
CREATE TABLE IF NOT EXISTS direct_messages (
  id           INTEGER PRIMARY KEY,
  sender_id    INTEGER NOT NULL,
  recipient_id INTEGER NOT NULL,
  content      TEXT    NOT NULL,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  read_at      TEXT,
  FOREIGN KEY (sender_id)    REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE,
  CHECK (sender_id <> recipient_id),
  CHECK (length(trim(content)) BETWEEN 1 AND 1000)
);

-- ============ NOTIFICATIONS (in-app) ============
CREATE TABLE IF NOT EXISTS notifications (
  id           INTEGER PRIMARY KEY,
  recipient_id INTEGER NOT NULL,
  actor_id     INTEGER,                            -- who triggered it (nullable for system)
  type         TEXT    NOT NULL CHECK (type IN
                 ('follow','follow_request','like','reply','repost','event_update','participate')),
  post_id      INTEGER,
  event_id     INTEGER,
  is_read      INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0,1)),
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (recipient_id) REFERENCES users(id)  ON DELETE CASCADE,
  FOREIGN KEY (actor_id)     REFERENCES users(id)  ON DELETE CASCADE,
  FOREIGN KEY (post_id)      REFERENCES posts(id)  ON DELETE CASCADE,
  FOREIGN KEY (event_id)     REFERENCES events(id) ON DELETE CASCADE
);

-- ============ INDEXES (hot queries) ============
CREATE INDEX IF NOT EXISTS idx_posts_author_created   ON posts(author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_parent           ON posts(parent_post_id);
CREATE INDEX IF NOT EXISTS idx_posts_event            ON posts(event_id);
CREATE INDEX IF NOT EXISTS idx_posts_quoted           ON posts(quoted_post_id);
CREATE INDEX IF NOT EXISTS idx_posts_created          ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_follows_following      ON follows(following_id, status);
CREATE INDEX IF NOT EXISTS idx_blocks_blocked         ON blocks(blocked_id);
CREATE INDEX IF NOT EXISTS idx_likes_post            ON likes(post_id);
CREATE INDEX IF NOT EXISTS idx_likes_created         ON likes(created_at);
CREATE INDEX IF NOT EXISTS idx_reposts_post          ON reposts(post_id);
CREATE INDEX IF NOT EXISTS idx_reposts_user_created  ON reposts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reposts_created       ON reposts(created_at);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_created ON bookmarks(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_start          ON events(start_time);
CREATE INDEX IF NOT EXISTS idx_events_start_end      ON events(start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_events_category_start ON events(category_id, start_time);
CREATE INDEX IF NOT EXISTS idx_events_creator        ON events(creator_id);
CREATE INDEX IF NOT EXISTS idx_eparts_event          ON event_participants(event_id);
CREATE INDEX IF NOT EXISTS idx_dms_sender_recipient_created ON direct_messages(sender_id, recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dms_recipient_created ON direct_messages(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifs_recipient_created ON notifications(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifs_recipient_unread  ON notifications(recipient_id, is_read);

-- ============ FULL-TEXT SEARCH (FTS5) ============
-- If your sqlite build lacks FTS5, comment these out and use LIKE '%q%' in search.
CREATE VIRTUAL TABLE IF NOT EXISTS posts_fts  USING fts5(content, content='posts', content_rowid='id');
CREATE TRIGGER IF NOT EXISTS posts_ai AFTER INSERT ON posts BEGIN
  INSERT INTO posts_fts(rowid, content) VALUES (new.id, new.content);
END;
CREATE TRIGGER IF NOT EXISTS posts_ad AFTER DELETE ON posts BEGIN
  INSERT INTO posts_fts(posts_fts, rowid, content) VALUES('delete', old.id, old.content);
END;
CREATE TRIGGER IF NOT EXISTS posts_au AFTER UPDATE ON posts BEGIN
  INSERT INTO posts_fts(posts_fts, rowid, content) VALUES('delete', old.id, old.content);
  INSERT INTO posts_fts(rowid, content) VALUES (new.id, new.content);
END;

CREATE VIRTUAL TABLE IF NOT EXISTS events_fts USING fts5(title, description, content='events', content_rowid='id');
CREATE TRIGGER IF NOT EXISTS events_ai AFTER INSERT ON events BEGIN
  INSERT INTO events_fts(rowid, title, description) VALUES (new.id, new.title, new.description);
END;
CREATE TRIGGER IF NOT EXISTS events_ad AFTER DELETE ON events BEGIN
  INSERT INTO events_fts(events_fts, rowid, title, description) VALUES('delete', old.id, old.title, old.description);
END;
CREATE TRIGGER IF NOT EXISTS events_au AFTER UPDATE ON events BEGIN
  INSERT INTO events_fts(events_fts, rowid, title, description) VALUES('delete', old.id, old.title, old.description);
  INSERT INTO events_fts(rowid, title, description) VALUES (new.id, new.title, new.description);
END;

-- ============ SEED: fixed categories ============
INSERT OR IGNORE INTO categories (slug, name) VALUES
  ('sports','Sports'), ('anime','Anime'), ('music','Music'),
  ('gaming','Gaming'), ('food','Food'), ('study','Study');
