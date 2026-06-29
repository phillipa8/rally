// EmptyState.jsx — friendly placeholder when a successful request returns nothing.
export default function EmptyState({ title = 'Nothing here yet', hint, children }) {
  return (
    <div className="state state--empty">
      <p className="state__title">{title}</p>
      {hint && <p className="state__hint">{hint}</p>}
      {children}
    </div>
  );
}
