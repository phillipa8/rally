// visibility.js — shared SQL predicate for "which posts can this viewer see".
// Apply to EVERY post-returning query (feed, profile, search, thread, single post).
//
// A post by author `u` is visible to viewerId when:
//   - the author is public, OR
//   - the viewer is the author, OR
//   - the viewer is an ACCEPTED follower of the (private) author.
// Unauthenticated viewer (viewerId == null) sees only public authors' posts.
//
// Returns { clause, params } to AND into a WHERE. `authorAlias` is the SQL alias
// of the joined users row (default "u").
//
// Example:
//   const v = visiblePostsWhere(req.userId);
//   db.prepare(`SELECT p.* FROM posts p JOIN users u ON u.id = p.author_id
//               WHERE ${v.clause} ORDER BY p.created_at DESC`).all(...v.params);

export function visiblePostsWhere(viewerId, authorAlias = 'u') {
  if (viewerId == null) {
    return { clause: `${authorAlias}.is_private = 0`, params: [] };
  }
  return {
    clause:
      `(${authorAlias}.is_private = 0 ` +
      `OR ${authorAlias}.id = ? ` +
      `OR EXISTS (SELECT 1 FROM follows f ` +
      `WHERE f.following_id = ${authorAlias}.id AND f.follower_id = ? AND f.status = 'accepted'))`,
    params: [viewerId, viewerId],
  };
}
