// CharCounter.jsx — remaining-characters indicator for the composer (Owner: Member B).
export default function CharCounter({ value, max = 280 }) {
  const remaining = max - value;
  if (remaining > 20) return null;
  const cls =
    remaining < 0 ? 'char-counter char-counter--over'
    : remaining <= 20 ? 'char-counter char-counter--warn'
    : 'char-counter';
  return (
    <span className={cls} aria-live="polite">
      {remaining}
    </span>
  );
}
