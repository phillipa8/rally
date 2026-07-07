// SidebarNav.jsx — primary navigation. Renders as a left sidebar on desktop and a
// bottom tab bar on mobile (see index.css). Links cover the planned feature pages.
import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import apiClient from '../api/client';
import { useApi } from '../api/hooks';
import { useAuth } from '../context/AuthContext';

const ITEMS = [
  { to: '/', label: 'Home', icon: '🏠', end: true },
  { to: '/explore', label: 'Explore', icon: '🔭' },
  { to: '/messages', label: 'DMs', icon: '✉️', auth: true },
  { to: '/events', label: 'Events', icon: '🎉' },
  { to: '/search', label: 'Search', icon: '🔍' },
  { to: '/trending', label: 'Trending', icon: '🔥' },
  { to: '/notifications', label: 'Alerts', icon: '🔔', auth: true },
  { to: '/bookmarks', label: 'Saved', icon: '🔖', auth: true },
  { to: '/profile', label: 'Profile', icon: '👤', auth: true },
];

export default function SidebarNav() {
  const { isAuthenticated } = useAuth();
  const items = ITEMS.filter((i) => !i.auth || isAuthenticated);
  const unreadApi = useApi('/messages/unread-count', [], { enabled: isAuthenticated });
  const [unreadDms, setUnreadDms] = useState(0);

  useEffect(() => {
    setUnreadDms(unreadApi.data?.unreadCount ?? 0);
  }, [unreadApi.data?.unreadCount]);

  useEffect(() => {
    const clearBadge = () => setUnreadDms(0);
    window.addEventListener('messages:read', clearBadge);
    return () => window.removeEventListener('messages:read', clearBadge);
  }, []);

  async function handleClick(item) {
    if (item.to !== '/messages') return;
    setUnreadDms(0);
    try {
      await apiClient.put('/messages/read-all');
      window.dispatchEvent(new CustomEvent('messages:read'));
    } catch {
      /* best effort: opening DMs should still navigate */
    }
  }

  return (
    <nav className="sidebar" aria-label="Primary">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={() => handleClick(item)}
          className={({ isActive }) => `sidebar__link${isActive ? ' sidebar__link--active' : ''}`}
        >
          <span className="sidebar__icon-wrap">
            <span className="sidebar__icon" aria-hidden="true">
              {item.icon}
            </span>
            {item.to === '/messages' && unreadDms > 0 && (
              <span className="sidebar__badge" aria-label={`${unreadDms} unread messages`}>
                {unreadDms > 99 ? '99+' : unreadDms}
              </span>
            )}
          </span>
          <span className="sidebar__label">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
