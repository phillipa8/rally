// ImageUploader.jsx — pick + upload a single image (Owner: Member B).
// Validates type/size on the client, uploads to POST /api/media, and returns the URL.
import { useState } from 'react';
import apiClient, { errorMessage } from '../api/client';

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export default function ImageUploader({ value, onChange }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!file) return;
    setError(null);
    if (!file.type.startsWith('image/')) return setError('Please choose an image file.');
    if (file.size > MAX_BYTES) return setError('Image must be 5MB or smaller.');

    const form = new FormData();
    form.append('image', file);
    setBusy(true);
    try {
      const res = await apiClient.post('/media', form);
      onChange(res.data.url);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="image-uploader">
      {value ? (
        <div className="image-uploader__preview">
          <img src={value} alt="upload preview" />
          <button type="button" className="btn btn--small btn--ghost" onClick={() => onChange(null)}>
            Remove
          </button>
        </div>
      ) : (
        <label className="image-uploader__pick">
          <input type="file" accept="image/*" onChange={onFile} disabled={busy} hidden />
          <span className="btn btn--small btn--ghost">{busy ? 'Uploading…' : '📷 Add image'}</span>
        </label>
      )}
      {error && <p className="form__error">{error}</p>}
    </div>
  );
}
