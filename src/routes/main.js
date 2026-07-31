const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireAuth } = require('../auth');
const { logAudit, joursRestants, niveauAlerte, indicateursSST, inventaireGES } = require('../helpers');

const router = express.Router();

router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/tableau-de-bord');
  res.render('login', { erreur: null });
});

router.post('/login', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE email = ? AND actif = 1').get((req.body.email || '').trim().toLowerCase());
  if (!user || !bcrypt.compareSync(req.body.password || '', user.password_hash)) {
    return res.status(401).render('login', { erreur: 'Identifiants invalides.' });
  }
  req.session.user = { id: user.id, nom: user.nom, email: user.email, role: user.role, entite_id: user.entite_id, site_id: user.site_id };
  logAudit(req.session.user, 'connexion', 'session', user.id, null);
  res.redirect('/tableau-de-bord');
});

router.post('/logout', (req, res) => req.session.destroy(() => res.redirect('/')));

// ---- Tableau de bord Groupe / filiale / site (Module 19)
router.get('/tableau-de-bord', requireAuth, (req, res) => {
  const annee = String(new Date().getFullYear());
  const entiteId = req.query.entite ? Number(req.query.entite) : null;
  const entites = db.prepare("SELECT * FROM entites WHERE actif=1 ORDER BY type DESC, nom").all();
  const filtreSites = entiteId ? 'AND s.entite_id = ' + entiteId : '';

  const sst = indicateursSST(annee);
  const ges = inventaireGES(annee);

  const permis = db.prepare(`SELECT p.*, s.nom site_nom FROM permis p JOIN sites s ON s.id=p.site_id WHERE p.actif=1 ${filtreSites}`).all()
    .map((p) => ({ ...p, jours: joursRestants(p.date_expiration), alerte: niveauAlerte(joursRestants(p.date_expiration)) }));
  const permisAlerte = permis.filter((p) => p.alerte);

  const actions = db.prepare('SELECT statut, COUNT(*) n FROM actions WHERE actif=1 GROUP BY statut').all();
  const actionsRetard = db.prepare("SELECT COUNT(*) n FROM actions WHERE actif=1 AND statut NOT IN ('cloturee') AND echeance < date('now')").get().n;
  const paes = db.prepare("SELECT * FROM actions WHERE origine='PAES' AND actif=1 ORDER BY ref_paes").all();

  const plaintes = db.prepare(`SELECT COUNT(*) total,
      SUM(CASE WHEN statut IN ('resolue','close') THEN 1 ELSE 0 END) resolues,
      SUM(CASE WHEN sensible=1 THEN 1 ELSE 0 END) sensibles
    FROM plaintes WHERE actif=1`).get();

  const incidentsRecents = db.prepare(`SELECT i.*, s.nom site_nom FROM incidents i JOIN sites s ON s.id=i.site_id
    WHERE i.actif=1 ${filtreSites} ORDER BY i.date_evenement DESC LIMIT 6`).all();
  const incidentsSignificatifs = db.prepare("SELECT COUNT(*) n FROM incidents WHERE actif=1 AND gravite >= 4").get().n;

  const nc = db.prepare("SELECT COUNT(*) n FROM non_conformites WHERE actif=1 AND statut NOT IN ('verifiee')").get().n;
  const nbSites = db.prepare(`SELECT COUNT(*) n FROM sites s WHERE s.actif=1 ${filtreSites}`).get().n;

  // Complétude de la donnée (7.6) : sites ayant déclaré effectifs sur la dernière période
  const dernierePeriode = db.prepare('SELECT MAX(periode) p FROM effectifs').get().p;
  const completude = dernierePeriode
    ? db.prepare(`SELECT COUNT(DISTINCT site_id) n FROM effectifs WHERE periode = ?`).get(dernierePeriode).n
    : 0;

  res.render('dashboard', {
    annee, entites, entiteId, nbSites, sst, ges, permisAlerte, actions, actionsRetard, paes,
    plaintes, incidentsRecents, incidentsSignificatifs, nc,
    completude, dernierePeriode,
  });
});

module.exports = router;
