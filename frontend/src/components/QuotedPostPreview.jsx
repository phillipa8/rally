// QuotedPostPreview.jsx — compact embedded preview for quote posts.
import { Link } from 'react-router-dom';
import { fromNow } from '../lib/time';
import Avatar from './Avatar';

export default function QuotedPostPreview({ post }) {
  if (!post) return null;

  if (post.unavailable) {
    return (
      <div className="quoted-post quoted-post--unavailable">
        This post is unavailable.
      </div>
    );
  }

  const author = post.author || {
    username: post.username,
    displayName: post.displayName,
    avatarUrl: post.avatarUrl,
  };

  return (
    <Link to={`/posts/${post.id}`} className="quoted-post">
      <div className="quoted-post__head">
        <Avatar user={author} size={24} />
        <span className="quoted-post__name">{author.displayName}</span>
        <span className="quoted-post__handle">@{author.username}</span>
        <span className="quoted-post__time">{fromNow(post.createdAt)}</span>
      </div>
      <p className="quoted-post__content">{post.content}</p>
      {post.mediaUrl && (
        <img className="quoted-post__media" src={post.mediaUrl} alt="quoted attachment" loading="lazy" />
      )}
    </Link>
  );
}
