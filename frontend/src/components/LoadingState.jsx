// LoadingState.jsx — visible loading indicator used for in-flight API calls.
export default function LoadingState({ label = 'Loading…' }) {
  return (
    <div className="state state--loading" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
