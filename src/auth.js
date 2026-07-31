const { WRITE_ROLES } = require('./helpers');

function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  res.locals.user = req.session.user;
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session.user) return res.redirect('/login');
    if (!roles.includes(req.session.user.role)) {
      return res.status(403).render('erreur', { titre: 'Accès refusé', message: 'Votre rôle ne permet pas d’accéder à cette fonction.' });
    }
    next();
  };
}

// Écriture interdite aux rôles de consultation (DG, IFC)
function requireWrite(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  if (!WRITE_ROLES.includes(req.session.user.role)) {
    return res.status(403).render('erreur', { titre: 'Lecture seule', message: 'Votre profil est en consultation : la modification des données n’est pas autorisée.' });
  }
  next();
}

module.exports = { requireAuth, requireRole, requireWrite };
