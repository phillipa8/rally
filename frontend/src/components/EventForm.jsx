// EventForm.jsx — create or edit an event, rendered inside a Modal (Owner: Member C).
// Times are entered as local wall-clock via <input type="datetime-local"> and
// converted to the API's UTC 'YYYY-MM-DD HH:MM:SS' storage format on submit.

import { useState } from 'react';
import { useMutation } from '../api/hooks';
import apiClient from '../api/client';
import { toSqlUtc, toDatetimeLocal, nowDatetimeLocal } from '../lib/time';
import CategorySelect from './CategorySelect';

const MAX_TITLE = 120;

export default function EventForm({ event = null, onSaved, onCancel }) {
  const editing = !!event;
  const [title, setTitle] = useState(event?.title ?? '');
  const [description, setDescription] = useState(event?.description ?? '');
  const [categoryId, setCategoryId] = useState(event?.category?.id ?? null);
  const [startTime, setStartTime] = useState(event ? toDatetimeLocal(event.startTime) : '');
  const [endTime, setEndTime] = useState(event ? toDatetimeLocal(event.endTime) : '');
  const [location, setLocation] = useState(event?.location ?? '');
  const [ageRestriction, setAgeRestriction] = useState(String(event?.ageRestriction ?? 0));

  const { mutate, loading, error } = useMutation((body) =>
    editing ? apiClient.put(`/events/${event.id}`, body) : apiClient.post('/events', body)
  );

  const titleTooLong = title.trim().length > MAX_TITLE;
  // datetime-local strings ('YYYY-MM-DDTHH:mm') compare lexically == chronologically.
  const badRange = startTime !== '' && endTime !== '' && endTime <= startTime;
  // Only a changed start time may not be in the past and editing an already-started
  // event may keep its original start.
  const originalStart = event ? toDatetimeLocal(event.startTime) : null;
  const pastStart =
    startTime !== '' && startTime !== originalStart && startTime < nowDatetimeLocal();
  const canSave =
    title.trim() !== '' &&
    categoryId != null &&
    startTime !== '' &&
    endTime !== '' &&
    !titleTooLong &&
    !badRange &&
    !pastStart &&
    !loading;

  async function submit(e) {
    e.preventDefault();
    if (!canSave) return;
    const body = {
      title: title.trim(),
      description: description.trim() || undefined,
      categoryId,
      startTime: toSqlUtc(startTime),
      endTime: toSqlUtc(endTime),
      location: location.trim() || undefined,
      ageRestriction: Number(ageRestriction) || 0,
    };
    const res = await mutate(body);
    onSaved?.(res.data.event);
  }

  return (
    <form className="event-form" onSubmit={submit}>
      {error && (
        <p className="form__error" role="alert">
          {error}
        </p>
      )}

      <label className="field">
        <span>Title</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={MAX_TITLE} required />
      </label>

      <label className="field">
        <span>Description</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="Optional"
        />
      </label>

      <CategorySelect value={categoryId} onChange={setCategoryId} disabled={loading} />

      <div className="event-form__row">
        <label className="field">
          <span>Starts</span>
          <input
            type="datetime-local"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            required
          />
        </label>
        <label className="field">
          <span>Ends</span>
          <input
            type="datetime-local"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            required
          />
        </label>
      </div>
      {badRange && <p className="form__error">End time must be after start time.</p>}
      {pastStart && <p className="form__error">Start time cannot be in the past.</p>}

      <label className="field">
        <span>Location</span>
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          maxLength={200}
          placeholder="Optional"
        />
      </label>

      <label className="field">
        <span>Minimum age</span>
        <input
          type="number"
          min={0}
          max={99}
          value={ageRestriction}
          onChange={(e) => setAgeRestriction(e.target.value)}
        />
      </label>

      <div className="event-form__actions">
        {onCancel && (
          <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={loading}>
            Cancel
          </button>
        )}
        <button type="submit" className="btn" disabled={!canSave}>
          {loading ? 'Saving…' : editing ? 'Save changes' : 'Create event'}
        </button>
      </div>
    </form>
  );
}
