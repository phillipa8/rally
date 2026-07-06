// PostCard.jsx — renders a single post (Owner: Member B). Owns the post display
// contract used by the feed, profile, bookmarks, explore, and trending.

import { Link } from 'react-router-dom';
import { fromNow } from '../lib/time';
import Avatar from './Avatar';
import PostActions from './PostActions';
import EventChip from './EventChip';
import QuotedPostPreview from './QuotedPostPreview';

export default function PostCard({ post, onChange }) {
  if (!post) return null;
  // Tolerate both the rich shape ({author:{...}}) and a flat legacy shape.
  const author = post.author || {
    username: post.username,
    displayName: post.displayName,
    avatarUrl: post.avatarUrl,
  };

  return (
    <article className="post">
      {post.repostedBy && <p className="post__repost">🔁 Reposted by @{post.repostedBy}</p>}

      <div className="post__head">
        <Link to={`/u/${author.username}`} className="post__author">
          <Avatar user={author} size={40} />
          <span className="post__names">
            <span className="post__name">{author.displayName}</span>
            <span className="post__handle">@{author.username}</span>
          </span>
        </Link>
        <Link to={`/posts/${post.id}`} className="post__time" title={post.createdAt}>
          {fromNow(post.createdAt)}
        </Link>
      </div>

      <Link to={`/posts/${post.id}`} className="post__content">
        {post.content}
      </Link>

      {post.mediaUrl && (
        <Link to={`/posts/${post.id}`} className="post__media-wrap">
          <img className="post__media" src={post.mediaUrl} alt="attachment" loading="lazy" />
        </Link>
      )}

      {post.quotedPost && <QuotedPostPreview post={post.quotedPost} />}

      {/* EventChip slot (Member C): shown when the post shares an event. */}
      {post.eventId && <EventChip eventId={post.eventId} />}

      <PostActions post={post} onChange={onChange} />
    </article>
  );
}
