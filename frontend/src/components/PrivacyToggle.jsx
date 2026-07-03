// PrivacyToggle.jsx — switch the account between public and private (Owner: Member A).
// Persists via PUT /users/me. Flipping to public makes the server auto-accept any
// pending follow requests, so onChange lets the parent refresh those views.
import { useState } from 'react';
import { useMutation } from '../api/hooks';
import apiClient from '../api/client';

export default function PrivacyToggle({ isPrivate, onChange }) {
  const [priv, setPriv] = useState(!!isPrivate);
  const { mutate, loading, error } = useMutation((next) =>
    apiClient.put('/users/me', { isPrivate: next })
  );

  const toggle = async () => {
    const next = !priv;
    setPriv(next); // optimistic
    try {
      await mutate(next);
      onChange?.(next);
    } catch {
      setPriv(!next); // revert on failure
    }
  };

  return (
    <div className="setting-row">
      <div className="setting-row__text">
        <p className="setting-row__label">Private account</p>
        <p className="setting-row__hint">
          When on, people must request to follow you before they can see your posts.
        </p>
        {error && <p className="form__error" role="alert">{error}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={priv}
        className={`switch ${priv ? 'switch--on' : ''}`}
        onClick={toggle}
        disabled={loading}
      >
        <span className="switch__knob" />
      </button>
    </div>
  );
}
