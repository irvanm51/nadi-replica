function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.session.user || !allowedRoles.includes(req.session.user.role)) {
      return res.status(403).render('error', { message: 'Akses ditolak untuk role Anda.' });
    }
    next();
  };
}

module.exports = { requireRole };
