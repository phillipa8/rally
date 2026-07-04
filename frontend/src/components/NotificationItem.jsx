// NotificationItem.jsx — one notification row (Owner: Member A).
// Renders the actor's avatar, a type-specific message, and relative time.
// Clicking an unread item marks it read (optimistically) via onRead.
import { Link } from 'react-router-dom';
import Avatar from './Avatar';
import { fromNow } from '../lib/time';

// Verb phrase per notification type; the actor's name is rendered separately.
const MESSAGES = {
  follow: 'started following you',
  follow_request: 'requested to follow you',
  like: 'liked your post',
  reply: 'replied to your post',
  repost: 'reposted your post',
  event_update: 'updated an event you’re attending',
  participate: 'is attending your event',
};

export default function NotificationItem({ notification, onRead }) {
  const { actor, type, isRead, createdAt } = notification;
  const message = MESSAGES[type] || 'sent you a notification';

  const handleClick = () => {
    if (!isRead) onRead?.(notification.id);
  };

  return (
    <div
      className={`notification ${isRead ? '' : 'notification--unread'}`}
      onClick={handleClick}
      role="listitem"
    >
      <Avatar user={actor} size={40} />
      <div className="notification__body">
        <p className="notification__text">
          {actor ? (
            <Link to={`/u/${actor.username}`} className="notification__actor" onClick={(e) => e.stopPropagation()}>
              {actor.displayName}
            </Link>
          ) : (
            <span className="notification__actor">Rally</span>
          )}{' '}
          {message}
        </p>
        <time className="notification__time" dateTime={createdAt}>
          {fromNow(createdAt)}
        </time>
      </div>
      {!isRead && <span className="notification__dot" aria-label="Unread" />}
    </div>
  );
}
