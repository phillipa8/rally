// postQuery.js — shared post serialization (Owner: Member B).
// Every post-returning endpoint (feed, single post, profile, bookmarks) uses this so
// the API always returns the same rich shape: author + engagement counts + viewer flags.
// Counts are derived with correlated COUNT()/EXISTS subqueries (fine at course scale).
import db from '../db/db.js';
import { visiblePostsWhere } from './visibility.js';

// SELECT column fragment for a post `p` joined to its author `u`.
// The 3 viewer-scoped EXISTS use `?` placeholders — bind `viewerParams` FIRST, before
// any WHERE-clause params, because these columns appear before the WHERE in the SQL.
export function postColumns(viewerId) {
  const v = viewerId ?? null;
  const quoteVisibility = visiblePostsWhere(viewerId, 'qu');
  const quoteParams = [];
  const quoted = (expr) => {
    quoteParams.push(...quoteVisibility.params);
    return `(SELECT ${expr}
               FROM posts qp
               JOIN users qu ON qu.id = qp.author_id
              WHERE qp.id = p.quoted_post_id AND ${quoteVisibility.clause})`;
  };

  return {
    columns: `
      p.id, p.content, p.event_id AS eventId, p.parent_post_id AS parentPostId,
      p.quoted_post_id AS quotedPostId, p.media_url AS mediaUrl,
      p.comments_disabled AS commentsDisabled, p.created_at AS createdAt,
      u.id AS authorId, u.username, u.display_name AS displayName, u.avatar_url AS avatarUrl,
      (SELECT COUNT(*) FROM likes l     WHERE l.post_id = p.id)        AS likeCount,
      ((SELECT COUNT(*) FROM reposts r  WHERE r.post_id = p.id) +
       (SELECT COUNT(*) FROM posts qp   WHERE qp.quoted_post_id = p.id)) AS repostCount,
      (SELECT COUNT(*) FROM posts c     WHERE c.parent_post_id = p.id) AS replyCount,
      (SELECT COUNT(*) FROM bookmarks b WHERE b.post_id = p.id)        AS bookmarkCount,
      EXISTS(SELECT 1 FROM likes l     WHERE l.post_id = p.id AND l.user_id = ?) AS likedByMe,
      EXISTS(SELECT 1 FROM reposts r   WHERE r.post_id = p.id AND r.user_id = ?) AS repostedByMe,
      EXISTS(SELECT 1 FROM bookmarks b WHERE b.post_id = p.id AND b.user_id = ?) AS bookmarkedByMe,
      ${quoted('qp.id')} AS quotedVisibleId,
      ${quoted('qp.content')} AS quotedContent,
      ${quoted('qp.event_id')} AS quotedEventId,
      ${quoted('qp.parent_post_id')} AS quotedParentPostId,
      ${quoted('qp.media_url')} AS quotedMediaUrl,
      ${quoted('qp.created_at')} AS quotedCreatedAt,
      ${quoted('qu.id')} AS quotedAuthorId,
      ${quoted('qu.username')} AS quotedUsername,
      ${quoted('qu.display_name')} AS quotedDisplayName,
      ${quoted('qu.avatar_url')} AS quotedAvatarUrl`,
    viewerParams: [v, v, v, ...quoteParams],
  };
}

// Poll for a post, or null if it isn't a poll. Options carry public vote counts;
// myVote is the viewer's chosen option_id (null when logged out or not voted).
export function getPoll(postId, viewerId = null) {
  const options = db
    .prepare(
      `SELECT o.id, o.text,
              (SELECT COUNT(*) FROM poll_votes v WHERE v.option_id = o.id) AS votes
         FROM poll_options o
        WHERE o.post_id = ?
        ORDER BY o.position, o.id`
    )
    .all(postId);
  if (options.length === 0) return null;
  const totalVotes = options.reduce((n, o) => n + o.votes, 0);
  let myVote = null;
  if (viewerId != null) {
    const row = db
      .prepare('SELECT option_id FROM poll_votes WHERE post_id = ? AND user_id = ?')
      .get(postId, viewerId);
    myVote = row ? row.option_id : null;
  }
  return { options, totalVotes, myVote };
}

// Shape a raw joined row into the public API post object.
// `opts.viewerId` scopes the poll's `myVote`. Existing `rows.map(mapPost)` callers pass
// the array index as the 2nd arg, which harmlessly yields viewerId=undefined -> myVote=null.
export function mapPost(row, opts = {}) {
  return {
    id: row.id,
    content: row.content,
    eventId: row.eventId ?? null,
    parentPostId: row.parentPostId ?? null,
    quotedPostId: row.quotedPostId ?? null,
    mediaUrl: row.mediaUrl ?? null,
    commentsDisabled: !!row.commentsDisabled,
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
    quotedPost: row.quotedPostId
      ? row.quotedVisibleId
        ? {
            id: row.quotedVisibleId,
            content: row.quotedContent,
            eventId: row.quotedEventId ?? null,
            parentPostId: row.quotedParentPostId ?? null,
            mediaUrl: row.quotedMediaUrl ?? null,
            createdAt: row.quotedCreatedAt,
            author: {
              id: row.quotedAuthorId,
              username: row.quotedUsername,
              displayName: row.quotedDisplayName,
              avatarUrl: row.quotedAvatarUrl ?? null,
            },
          }
        : { id: row.quotedPostId, unavailable: true }
      : null,
    poll: getPoll(row.id, opts.viewerId ?? null),
    // Set only on feed rows that represent a repost (username of the reposter).
    repostedBy: row.repostedBy ?? undefined,
  };
}
