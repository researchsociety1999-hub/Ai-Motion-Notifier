/**
 * Middleware: protect admin routes with a secret key header
 * Usage: add x-admin-key: <ADMIN_SECRET_KEY> to requests
 */
module.exports = (req, res, next) => {
  const key = req.headers['x-admin-key'];
  if (!key || key !== process.env.ADMIN_SECRET_KEY) {
    return res.status(403).json({ error: 'Forbidden: invalid or missing admin key' });
  }
  next();
};
