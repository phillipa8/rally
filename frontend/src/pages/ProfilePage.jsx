// ProfilePage.jsx — a user's public profile (Owner: Member A).
// Serves two routes: "/profile" (your own, via AuthContext) and "/u/:username".
// Fetches the profile + that user's activity; private accounts you can't see show a
// locked notice instead of posts/likes.
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useApi } from '../api/hooks';
import ProfileHeader from '../components/ProfileHeader';
import FollowListModal from '../components/FollowListModal';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import PostList from '../components/PostList';

export default function ProfilePage() {
  const { username } = useParams();
  const { user } = useAuth();
  const handle = username || user?.username; // "/profile" falls back to the logged-in user
  const [listTab, setListTab] = useState(null); // 'followers' | 'following' | null
  const [activityTab, setActivityTab] = useState('posts');

  const { data, loading, error, refetch } = useApi(`/users/${handle}`, [handle], {
    enabled: !!handle,
  });

  const canLoadActivity =
    !!handle &&
    !!data &&
    (!data.user.isPrivate || data.isMe || data.followStatus === 'accepted');
  const posts = useApi(`/users/${handle}/posts`, [handle, activityTab], {
    enabled: canLoadActivity && activityTab === 'posts',
  });
  const likes = useApi(`/users/${handle}/likes`, [handle, activityTab], {
    enabled: canLoadActivity && activityTab === 'likes',
  });

  useEffect(() => {
    setActivityTab('posts');
  }, [handle]);

  if (loading) return <LoadingState label="Loading profile…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!data) return null;

  const profile = data; // { user, counts, isMe, followStatus }
  const isLocked =
    profile.user.isPrivate && !profile.isMe && profile.followStatus !== 'accepted';

  return (
    <section className="page">
      <ProfileHeader
        profile={profile}
        onOpenFollowers={() => setListTab('followers')}
        onOpenFollowing={() => setListTab('following')}
      />

      <FollowListModal username={handle} tab={listTab} onClose={() => setListTab(null)} />

      {isLocked ? (
        <div className="profile__posts">
          <EmptyState
            title="This account is private"
            hint="Follow this account to see their posts."
          />
        </div>
      ) : (
        <>
          <div className="tabs" role="tablist" aria-label="Profile activity">
            <button
              type="button"
              role="tab"
              aria-selected={activityTab === 'posts'}
              className={`tab ${activityTab === 'posts' ? 'tab--active' : ''}`}
              onClick={() => setActivityTab('posts')}
            >
              Posts
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activityTab === 'likes'}
              className={`tab ${activityTab === 'likes' ? 'tab--active' : ''}`}
              onClick={() => setActivityTab('likes')}
            >
              Likes
            </button>
          </div>

          <div className="profile__posts">
            {activityTab === 'posts' ? (
              <PostList
                posts={posts.data?.posts}
                loading={posts.loading}
                error={posts.error}
                onRetry={posts.refetch}
                onChange={posts.refetch}
                emptyTitle="No posts yet"
              />
            ) : (
              <PostList
                posts={likes.data?.posts}
                loading={likes.loading}
                error={likes.error}
                onRetry={likes.refetch}
                onChange={likes.refetch}
                emptyTitle="No liked posts yet"
                emptyHint="Posts this user likes will show up here."
              />
            )}
          </div>
        </>
      )}
    </section>
  );
}
