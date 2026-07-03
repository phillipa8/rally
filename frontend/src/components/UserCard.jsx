// UserCard.jsx — compact user row: avatar + name + optional follow button
// (Owner: Member A). Reused in followers/following lists and search results.
import { Link } from 'react-router-dom';
import Avatar from './Avatar';
import FollowButton from './FollowButton';

export default function UserCard({ user, followStatus = null, showFollow = true }) {
  return (
    <div className="user-card">
      <Link to={`/u/${user.username}`} className="user-card__main">
        <Avatar user={user} size={44} />
        <span className="user-card__names">
          <span className="user-card__display">{user.displayName}</span>
          <span className="user-card__handle">@{user.username}</span>
          {user.bio && <span className="user-card__bio">{user.bio}</span>}
        </span>
      </Link>
      {showFollow && (
        <FollowButton username={user.username} initialStatus={followStatus} />
      )}
    </div>
  );
}
