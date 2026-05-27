/**
 * Global Express error handler
 * Catches any unhandled errors thrown in route handlers
 */
module.exports = (err, req, res, next) => {
  const status = err.status || 500;
  const message = err.message || 'Internal server error';

  console.error(`[ERROR] ${req.method} ${req.path} →`, err.stack || message);

  // Don't leak stack traces in production
  res.status(status).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};
