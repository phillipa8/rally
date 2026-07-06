// SettingsPage.jsx — manage your own account (Owner: Member A).
// Edit display name + bio, toggle private mode, and review incoming follow
// requests. All writes go through PUT /users/me and the /follow-requests API;
// after a change we refresh AuthContext so the navbar/profile reflect it.
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useMutation } from '../api/hooks';
import apiClient from '../api/client';
import PrivacyToggle from '../components/PrivacyToggle';
import BlockedUsersPanel from '../components/BlockedUsersPanel';

export default function SettingsPage() {
  const { user, refresh } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [saved, setSaved] = useState(false);
  const { mutate, loading, error } = useMutation((body) => apiClient.put('/users/me', body));

  // Sync form once the session user is available/changes.
  useEffect(() => {
    setDisplayName(user?.displayName || '');
    setBio(user?.bio || '');
  }, [user]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setSaved(false);
    try {
      await mutate({ displayName: displayName.trim(), bio: bio.trim() });
      await refresh();
      setSaved(true);
    } catch {
      /* error surfaced below */
    }
  };

  return (
    <section className="page">
      <h1 className="page__title">Settings</h1>

      <form className="card settings__section" onSubmit={onSubmit}>
        <h2 className="settings__heading">Profile</h2>
        {error && <p className="form__error" role="alert">{error}</p>}
        {saved && <p className="form__ok" role="status">Saved.</p>}

        <label className="field">
          <span>Display name</span>
          <input value={displayName} onChange={(e) => { setDisplayName(e.target.value); setSaved(false); }} maxLength={50} required />
        </label>
        <label className="field">
          <span>Bio</span>
          <textarea value={bio} onChange={(e) => { setBio(e.target.value); setSaved(false); }} maxLength={160} rows={3} />
        </label>

        <button type="submit" className="btn btn--small" disabled={loading}>
          {loading ? 'Saving…' : 'Save changes'}
        </button>
      </form>

      <div className="card settings__section">
        <h2 className="settings__heading">Privacy</h2>
        <PrivacyToggle isPrivate={user?.isPrivate} onChange={refresh} />
      </div>

      <div className="card settings__section">
        <h2 className="settings__heading">Blocked users</h2>
        <BlockedUsersPanel />
      </div>
    </section>
  );
}
