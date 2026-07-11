// ProfileHeader.jsx — the top of a profile page: identity, bio, counts, and the
// primary action (Follow, or Edit profile when it's you) (Owner: Member A).
// `profile` is the GET /users/:username payload: { user, counts, isMe, followStatus }.
import { Link } from 'react-router-dom';
import Avatar from './Avatar';
import FollowButton from './FollowButton';
import BlockButton from './BlockButton';

export default function ProfileHeader({
  profile,
  onOpenFollowers,
  onOpenFollowing,
  onOpenRequests,
  onChange,
}) {
  const { user, counts, isMe, followStatus, blockedByMe } = profile;

  return (
    <header className="profile">
      <div className="profile__top">
        <Avatar user={user} size={80} />
        <div className="profile__action">
          {isMe ? (
            <Link to="/settings" className="btn btn--small btn--ghost">Edit profile</Link>
          ) : (
            <>
              {!blockedByMe && (
                <FollowButton
                  username={user.username}
                  initialStatus={followStatus}
                  isPrivate={user.isPrivate}
                  onChange={onChange}
                />
              )}
              <BlockButton username={user.username} initialBlocked={blockedByMe} onChange={onChange} />
            </>
          )}
        </div>
      </div>

      <div className="profile__identity">
        <h1 className="profile__name">
          {user.displayName}
          {user.isPrivate && (
            <span className="profile__lock" title="Private account" aria-label="Private account"> 🔒</span>
          )}
        </h1>
        <p className="profile__handle">@{user.username}</p>
      </div>

      {user.bio && <p className="profile__bio">{user.bio}</p>}

      <dl className="profile__stats">
        <span className="stat">
          <dt className="stat__label">Posts</dt>
          <dd className="stat__value">{counts.posts}</dd>
        </span>
        <button type="button" className="stat stat--button" onClick={onOpenFollowers}>
          <dt className="stat__label">Followers</dt>
          <dd className="stat__value">{counts.followers}</dd>
        </button>
        <button type="button" className="stat stat--button" onClick={onOpenFollowing}>
          <dt className="stat__label">Following</dt>
          <dd className="stat__value">{counts.following}</dd>
        </button>
        {isMe && (
          <button type="button" className="stat stat--button" onClick={onOpenRequests}>
            <dt className="stat__label">Requests</dt>
            <dd className="stat__value">{counts.requests ?? 0}</dd>
          </button>
        )}
      </dl>
    </header>
  );
}
