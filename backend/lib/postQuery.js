// postQuery.js — shared post serialization (Owner: Member B).
// Every post-returning endpoint (feed, single post, profile, bookmarks) uses this so
// the API always returns the same rich shape: author + engagement counts + viewer flags.
// Counts are derived with correlated COUNT()/EXISTS subqueries (fine at course scale).

// SELECT column fragment for a post `p` joined to its author `u`.
// The 3 viewer-scoped EXISTS use `?` placeholders — bind `viewerParams` FIRST, before
// any WHERE-clause params, because these columns appear before the WHERE in the SQL.
export function postColumns(viewerId) {
  const v = viewerId ?? null;
  return {
    columns: `
      p.id, p.content, p.event_id AS eventId, p.parent_post_id AS parentPostId,
      p.media_url AS mediaUrl, p.created_at AS createdAt,
      u.id AS authorId, u.username, u.display_name AS displayName, u.avatar_url AS avatarUrl,
      (SELECT COUNT(*) FROM likes l     WHERE l.post_id = p.id)        AS likeCount,
      (SELECT COUNT(*) FROM reposts r   WHERE r.post_id = p.id)        AS repostCount,
      (SELECT COUNT(*) FROM posts c     WHERE c.parent_post_id = p.id) AS replyCount,
      (SELECT COUNT(*) FROM bookmarks b WHERE b.post_id = p.id)        AS bookmarkCount,
      EXISTS(SELECT 1 FROM likes l     WHERE l.post_id = p.id AND l.user_id = ?) AS likedByMe,
      EXISTS(SELECT 1 FROM reposts r   WHERE r.post_id = p.id AND r.user_id = ?) AS repostedByMe,
      EXISTS(SELECT 1 FROM bookmarks b WHERE b.post_id = p.id AND b.user_id = ?) AS bookmarkedByMe`,
    viewerParams: [v, v, v],
  };
}

// Shape a raw joined row into the public API post object.
export function mapPost(row) {
  return {
    id: row.id,
    content: row.content,
    eventId: row.eventId ?? null,
    parentPostId: row.parentPostId ?? null,
    mediaUrl: row.mediaUrl ?? null,
    createdAt: row.createdAt,
    author: {
      id: row.authorId,
      username: row.username,
      displayName: row.displayName,
      avatarUrl: row.avatarUrl ?? null,
    },
    likeCount: row.likeCount ?? 0,
    repostCount: row.repostCount ?? 0,
    replyCount: row.replyCount ?? 0,
    bookmarkCount: row.bookmarkCount ?? 0,
    likedByMe: !!row.likedByMe,
    repostedByMe: !!row.repostedByMe,
    bookmarkedByMe: !!row.bookmarkedByMe,
    // Set only on feed rows that represent a repost (username of the reposter).
    repostedBy: row.repostedBy ?? undefined,
  };
}
