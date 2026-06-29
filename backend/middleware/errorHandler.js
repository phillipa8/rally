// errorHandler.js — 404 + central JSON error handler. Mount these LAST in server.js.

export function notFound(req, res) {
  res.status(404).json({ error: `Not found: ${req.method} ${req.originalUrl}` });
}

// Express 5 forwards rejected async handlers here automatically.
// Throw an error with a `.status` to control the HTTP code.
export function errorHandler(err, _req, res, next) {
  // If a response was already partially sent, delegate to Express's default handler.
  if (res.headersSent) return next(err);
  // eslint-disable-next-line no-console
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({
    error: status === 500 ? 'Internal server error' : err.message,
  });
}
