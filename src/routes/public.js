/* Espace public (EF-PAR-05, EF-PLA-01/02/03) : information E&S non confidentielle,
   dépôt de plainte sans authentification (anonyme ou confidentiel) et suivi par code. */
const express = require('express');
const db = require('../db');
const { logAudit, genCodeSuivi } = require('../helpers');

const router = express.Router();

router.get('/', (req, res) => {
  const politiques = db.prepare("SELECT titre, version, date_publication FROM politiques WHERE statut='publiee' AND actif=1 ORDER BY titre").all();
  res.render('public/index', { politiques });
});

router.get('/plainte', (req, res) => {
  const sitesPublics = db.prepare("SELECT s.id, s.nom, s.ville, s.pays FROM sites s WHERE s.actif=1 ORDER BY s.pays, s.nom").all();
  res.render('public/plainte', { sites: sitesPublics, erreur: null });
});

router.post('/plainte', (req, res) => {
  const b = req.body;
  if (!b.description || !b.description.trim()) {
    const sitesPublics = db.prepare("SELECT s.id, s.nom, s.ville, s.pays FROM sites s WHERE s.actif=1 ORDER BY s.pays, s.nom").all();
    return res.status(400).render('public/plainte', { sites: sitesPublics, erreur: 'La description est obligatoire.' });
  }
  const anonyme = b.mode === 'anonyme';
  const sensible = ['harcelement', 'vbg', 'travail_enfants', 'discrimination'].includes(b.nature) ? 1 : 0;
  const code = genCodeSuivi();
  db.prepare(`INSERT INTO plaintes (code_suivi, mecanisme, canal, site_id, nature, description, plaignant_nom, plaignant_contact, anonyme, sensible, gravite, date_accuse, date_echeance)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,datetime('now'),date('now','+15 days'))`)
    .run(code, b.mecanisme === 'interne' ? 'interne' : 'externe', 'web', b.site_id || null, b.nature || null, b.description.trim(),
      anonyme ? null : (b.nom || null), anonyme ? null : (b.contact || null), anonyme ? 1 : 0, sensible, sensible ? 4 : 2);
  logAudit(null, 'creation', 'plainte_publique', null, `${code}${sensible ? ' (circuit sensible)' : ''}`);
  res.render('public/plainte_ok', { code });
});

// Suivi par code (dépôt anonyme comme confidentiel — EF-PLA-02)
router.get('/suivi', (req, res) => {
  const code = (req.query.code || '').trim().toUpperCase();
  let plainte = null, introuvable = false;
  if (code) {
    plainte = db.prepare('SELECT code_suivi, statut, date_depot, date_accuse, resolution, satisfaction FROM plaintes WHERE code_suivi=? AND actif=1').get(code);
    if (!plainte) introuvable = true;
  }
  res.render('public/suivi', { code, plainte, introuvable });
});

module.exports = router;
