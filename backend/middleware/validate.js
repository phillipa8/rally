// validate.js — request-body validation factory using zod.
// Usage:  router.post('/x', validate(mySchema), handler)
// On failure returns 400 with the list of issues. On success replaces req.body
// with the parsed/coerced data so handlers get clean, typed input.

export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: 'Validation failed',
      issues: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }
  req.body = result.data;
  next();
};

// Same, for query params (?from=&to=). Parsed query is attached to req.validatedQuery
// (Express 5's req.query is a read-only getter, so we don't overwrite it).
export const validateQuery = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.query);
  if (!result.success) {
    return res.status(400).json({
      error: 'Invalid query parameters',
      issues: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }
  req.validatedQuery = result.data;
  next();
};
