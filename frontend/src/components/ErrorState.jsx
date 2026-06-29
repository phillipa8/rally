// ErrorState.jsx — visible error message with an optional retry, so no API
// failure is silent (project requirement).
export default function ErrorState({ message = 'Something went wrong.', onRetry }) {
  return (
    <div className="state state--error" role="alert">
      <p className="state__message">⚠️ {message}</p>
      {onRetry && (
        <button type="button" className="btn btn--small" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}
