function esPeticionJSON(req) {
  return req.headers.accept && req.headers.accept.includes('application/json');
}

/** Exige que haya una sesión activa. */
function requireAuth(req, res, next) {
  if (req.session && req.session.usuarioId) {
    return next();
  }
  if (esPeticionJSON(req)) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  return res.redirect('/login.html');
}

/**
 * Exige que la sesión activa tenga uno de los roles permitidos.
 * Uso: requireRole('administrador') o requireRole('administrador', 'asesor')
 */
function requireRole(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.session || !req.session.usuarioId) {
      if (esPeticionJSON(req)) return res.status(401).json({ error: 'No autenticado' });
      return res.redirect('/login.html');
    }
    if (!rolesPermitidos.includes(req.session.usuarioRol)) {
      return res.status(403).json({ error: 'No tienes permisos para esta acción.' });
    }
    return next();
  };
}

module.exports = { requireAuth, requireRole };
