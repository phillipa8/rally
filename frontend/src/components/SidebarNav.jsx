// SidebarNav.jsx — primary navigation. Renders as a left sidebar on desktop and a
// bottom tab bar on mobile (see index.css). Links cover the planned feature pages.
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ITEMS = [
  { to: '/', label: 'Home', icon: '🏠', end: true },
  { to: '/explore', label: 'Explore', icon: '🔭' },
  { to: '/messages', label: 'DMs', icon: '✉️', auth: true },
  { to: '/calendar', label: 'Calendar', icon: '📅' },
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

  return (
    <nav className="sidebar" aria-label="Primary">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) => `sidebar__link${isActive ? ' sidebar__link--active' : ''}`}
        >
          <span className="sidebar__icon" aria-hidden="true">
            {item.icon}
          </span>
          <span className="sidebar__label">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
