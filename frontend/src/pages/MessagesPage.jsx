// MessagesPage.jsx — direct messages with followers.
import { useState } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import apiClient from '../api/client';
import { useApi, useMutation } from '../api/hooks';
import { useAuth } from '../context/AuthContext';
import { formatDate, fromNow } from '../lib/time';
import Avatar from '../components/Avatar';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import LoadingState from '../components/LoadingState';

const MAX = 1000;

export default function MessagesPage() {
  const { username } = useParams();
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const conversations = useApi('/messages');
  const thread = useApi(`/messages/${username || ''}`, [username], { enabled: !!username });
  const send = useMutation((body) => apiClient.post(`/messages/${username}`, body));

  const people = conversations.data?.conversations || [];
  const messages = thread.data?.messages || [];
  const target = thread.data?.user;
  const empty = content.trim().length === 0;
  const tooLong = content.length > MAX;
  const canSend = !!username && !empty && !tooLong && !send.loading;

  async function onSubmit(e) {
    e.preventDefault();
    if (!canSend) return;
    try {
      await send.mutate({ content: content.trim() });
      setContent('');
      await thread.refetch();
      await conversations.refetch();
    } catch {
      /* send.error is rendered below */
    }
  }

  return (
    <section className="page dm-page">
      <h1 className="page__title">DMs</h1>

      <div className="dm-shell">
        <aside className="dm-list" aria-label="Conversations">
          {conversations.loading ? (
            <LoadingState label="Loading DMs..." />
          ) : conversations.error ? (
            <ErrorState message={conversations.error} onRetry={conversations.refetch} />
          ) : !people.length ? (
            <EmptyState title="No followers yet" hint="Accepted followers will appear here." />
          ) : (
            people.map(({ user: person, lastMessage, lastMessageAt }) => (
              <NavLink
                key={person.id}
                to={`/messages/${person.username}`}
                className={({ isActive }) => `dm-person${isActive ? ' dm-person--active' : ''}`}
              >
                <Avatar user={person} size={40} />
                <span className="dm-person__body">
                  <span className="dm-person__name">{person.displayName}</span>
                  <span className="dm-person__meta">
                    {lastMessage || `@${person.username}`}
                  </span>
                </span>
                {lastMessageAt && <span className="dm-person__time">{fromNow(lastMessageAt)}</span>}
              </NavLink>
            ))
          )}
        </aside>

        <section className="dm-thread" aria-label="Message thread">
          {!username ? (
            <EmptyState title="Select a conversation" hint="Choose a follower to open your messages." />
          ) : thread.loading ? (
            <LoadingState label="Loading conversation..." />
          ) : thread.error ? (
            <ErrorState message={thread.error} onRetry={thread.refetch} />
          ) : (
            <>
              <header className="dm-thread__head">
                <Avatar user={target} size={36} />
                <div>
                  <h2 className="dm-thread__name">{target?.displayName}</h2>
                  <p className="dm-thread__handle">@{target?.username}</p>
                </div>
              </header>

              <div className="dm-thread__messages">
                {!messages.length ? (
                  <EmptyState title="No messages yet" />
                ) : (
                  messages.map((message) => {
                    const mine = message.sender.id === user?.id;
                    return (
                      <article
                        key={message.id}
                        className={`dm-message${mine ? ' dm-message--mine' : ''}`}
                      >
                        <p className="dm-message__content">{message.content}</p>
                        <time className="dm-message__time" dateTime={message.createdAt}>
                          {formatDate(message.createdAt, 'MMM D, h:mm A')}
                        </time>
                      </article>
                    );
                  })
                )}
              </div>

              <form className="dm-compose" onSubmit={onSubmit}>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Write a message"
                  rows={2}
                  maxLength={MAX + 1}
                  aria-label="Message"
                />
                <button type="submit" className="btn btn--small" disabled={!canSend}>
                  {send.loading ? 'Sending...' : 'Send'}
                </button>
              </form>
              {send.error && <p className="form__error">{send.error}</p>}
            </>
          )}
        </section>
      </div>
    </section>
  );
}
