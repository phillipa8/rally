// ProfilePage.jsx — a user's public profile (Owner: Member A).
// Serves two routes: "/profile" (your own, via AuthContext) and "/u/:username".
// Fetches the profile + that user's posts; private accounts you can't see show a
// locked notice instead of posts. (PostCard from track B will later replace the
// inline post preview below.)
import { useState } from 'react';
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

  const { data, loading, error, refetch } = useApi(`/users/${handle}`, [handle], {
    enabled: !!handle,
  });
  const posts = useApi(`/users/${handle}/posts`, [handle], { enabled: !!handle });

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

      <div className="profile__posts">
        {isLocked ? (
          <EmptyState
            title="This account is private"
            hint="Follow this account to see their posts."
          />
        ) : (
          <PostList
            posts={posts.data?.posts}
            loading={posts.loading}
            error={posts.error}
            onRetry={posts.refetch}
            onChange={posts.refetch}
            emptyTitle="No posts yet"
          />
        )}
      </div>
    </section>
  );
}
