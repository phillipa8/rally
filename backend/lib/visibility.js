// visibility.js — shared SQL predicate for "which posts can this viewer see".
// Apply to EVERY post-returning query (feed, profile, search, thread, single post).
//
// A post by author `u` is visible to viewerId when:
//   - the author is public, OR
//   - the viewer is the author, OR
//   - the viewer is an ACCEPTED follower of the (private) author.
//   - the author has not blocked the viewer.
// Unauthenticated viewer (viewerId == null) sees only public authors' posts.
//
// Returns { clause, params } to AND into a WHERE. `authorAlias` is the SQL alias
// of the joined users row (default "u").
//
// Example:
//   const v = visiblePostsWhere(req.userId);
//   db.prepare(`SELECT p.* FROM posts p JOIN users u ON u.id = p.author_id
//               WHERE ${v.clause} ORDER BY p.created_at DESC`).all(...v.params);

export function notBlockedWhere(viewerId, authorAlias = 'u') {
  if (viewerId == null) return { clause: '1 = 1', params: [] };
  return {
    clause:
      `NOT EXISTS (SELECT 1 FROM blocks bl ` +
      `WHERE bl.blocker_id = ${authorAlias}.id AND bl.blocked_id = ?)`,
    params: [viewerId],
  };
}

export function visiblePostsWhere(viewerId, authorAlias = 'u') {
  if (viewerId == null) {
    return { clause: `${authorAlias}.is_private = 0`, params: [] };
  }
  const block = notBlockedWhere(viewerId, authorAlias);
  return {
    clause:
      `(( ${authorAlias}.is_private = 0 ` +
      `OR ${authorAlias}.id = ? ` +
      `OR EXISTS (SELECT 1 FROM follows f ` +
      `WHERE f.following_id = ${authorAlias}.id AND f.follower_id = ? AND f.status = 'accepted')) ` +
      `AND ${block.clause})`,
    params: [viewerId, viewerId, ...block.params],
  };
}

// Which events can this viewer see. Two gates, both must pass:
//   1. the creator's account is visible (same rules as visiblePostsWhere), AND
//   2. the event itself is public, OR the viewer is the creator, OR the viewer
//      is an ACCEPTED follower of the creator (private events are follower-only).
// `eventAlias` is the SQL alias of the events row (default "e").
export function visibleEventsWhere(viewerId, creatorAlias = 'u', eventAlias = 'e') {
  if (viewerId == null) {
    return {
      clause: `(${creatorAlias}.is_private = 0 AND ${eventAlias}.is_private = 0)`,
      params: [],
    };
  }
  const account = visiblePostsWhere(viewerId, creatorAlias);
  return {
    clause:
      `(${account.clause} ` +
      `AND (${eventAlias}.is_private = 0 ` +
      `OR ${creatorAlias}.id = ? ` +
      `OR EXISTS (SELECT 1 FROM follows ef ` +
      `WHERE ef.following_id = ${creatorAlias}.id AND ef.follower_id = ? AND ef.status = 'accepted')))`,
    params: [...account.params, viewerId, viewerId],
  };
}
