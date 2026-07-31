/* Module 19 / chapitre 8 : rapport annuel de suivi E&S (AMR) généré depuis les données,
   notification d'incident au format IFC, exports CSV traçables. */
const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');
const { logAudit, indicateursSST, inventaireGES, joursRestants, niveauAlerte } = require('../helpers');
const { piecesPour } = require('../upload');

const router = express.Router();
router.use(requireAuth);

router.get('/reporting', (req, res) => {
  const incidents = db.prepare(`SELECT i.id, i.type, i.gravite, i.date_evenement, s.nom site_nom FROM incidents i
    JOIN sites s ON s.id=i.site_id WHERE i.actif=1 AND i.gravite>=4 ORDER BY i.date_evenement DESC`).all();
  res.render('reporting/index', { incidents });
});

// ---- Rapport annuel de suivi (8.1)
router.get('/reporting/rapport-annuel', (req, res) => {
  const annee = req.query.annee || String(new Date().getFullYear());
  const sst = indicateursSST(annee);
  const ges = inventaireGES(annee);

  const paes = db.prepare("SELECT * FROM actions WHERE origine='PAES' AND actif=1 ORDER BY ref_paes").all();
  const incidentsSign = db.prepare(`SELECT i.*, s.nom site_nom FROM incidents i JOIN sites s ON s.id=i.site_id
    WHERE i.actif=1 AND i.gravite>=4 AND i.date_evenement LIKE ? ORDER BY i.date_evenement`).all(`${annee}-%`);
  const plaintes = db.prepare(`SELECT COUNT(*) total,
      SUM(CASE WHEN mecanisme='externe' THEN 1 ELSE 0 END) externes,
      SUM(CASE WHEN mecanisme='interne' THEN 1 ELSE 0 END) internes,
      SUM(CASE WHEN sensible=1 THEN 1 ELSE 0 END) sensibles,
      SUM(CASE WHEN statut IN ('resolue','close') THEN 1 ELSE 0 END) resolues,
      ROUND(AVG(julianday(COALESCE(cloture_le, datetime('now'))) - julianday(date_depot)),1) delai_moyen
    FROM plaintes WHERE actif=1 AND date_depot LIKE ?`).get(`${annee}-%`);
  const permis = db.prepare(`SELECT p.*, s.nom site_nom FROM permis p JOIN sites s ON s.id=p.site_id WHERE p.actif=1`).all()
    .map((p) => ({ ...p, jours: joursRestants(p.date_expiration), alerte: niveauAlerte(joursRestants(p.date_expiration)) }));
  const exigences = db.prepare('SELECT * FROM exigences_legales WHERE actif=1').all();
  const nc = db.prepare(`SELECT COUNT(*) total, SUM(CASE WHEN statut='verifiee' THEN 1 ELSE 0 END) closes FROM non_conformites WHERE actif=1`).get();
  const effectifs = db.prepare(`SELECT SUM(effectif) total, SUM(femmes) femmes, SUM(cdi) cdi, SUM(sous_traitants) st
    FROM effectifs WHERE periode = (SELECT MAX(periode) FROM effectifs WHERE periode LIKE ?)`).get(`${annee}-%`);
  const formations = db.prepare(`SELECT COUNT(*) sessions, COALESCE(SUM(participants),0) participants, COALESCE(SUM(duree_heures*participants),0) heures
    FROM formations WHERE actif=1 AND date_session LIKE ?`).get(`${annee}-%`);
  const dechets = db.prepare(`SELECT flux, SUM(quantite_kg) kg FROM dechets WHERE actif=1 AND periode LIKE ? GROUP BY flux`).all(`${annee}-%`);
  const nbSites = db.prepare('SELECT COUNT(*) n FROM sites WHERE actif=1').get().n;
  const nbEntites = db.prepare("SELECT COUNT(*) n FROM entites WHERE actif=1 AND type='filiale'").get().n;

  logAudit(req.session.user, 'export', 'rapport_annuel', null, `AMR ${annee}`);
  res.render('reporting/rapport_annuel', {
    annee, sst, ges, paes, incidentsSign, plaintes, permis, exigences, nc, effectifs, formations, dechets, nbSites, nbEntites,
    genereLe: new Date().toLocaleString('fr-FR'),
  });
});

// ---- Notification d'incident au format IFC (8.2, EF-REP-03)
router.get('/reporting/notification/:incidentId', (req, res) => {
  const i = db.prepare(`SELECT i.*, s.nom site_nom, s.ville, s.pays, e.nom entite_nom FROM incidents i
    JOIN sites s ON s.id=i.site_id JOIN entites e ON e.id=s.entite_id WHERE i.id=? AND i.actif=1`).get(req.params.incidentId);
  if (!i) return res.status(404).render('erreur', { titre: 'Introuvable', message: 'Incident inexistant.' });
  const plaintesLiees = db.prepare('SELECT code_suivi, nature, statut, date_depot FROM plaintes WHERE incident_id=? AND actif=1 AND sensible=0').all(i.id);
  const actions = db.prepare("SELECT * FROM actions WHERE origine='incident' AND origine_id=? AND actif=1").all(i.id);
  logAudit(req.session.user, 'export', 'notification_ifc', i.id, null);
  res.render('reporting/notification', { i, plaintesLiees, actions, pieces: piecesPour('incident', i.id), genereLe: new Date().toLocaleString('fr-FR') });
});

// ---- Exports CSV (EF-REP-06) · chaque export est journalisé (6.8)
const EXPORTS = {
  incidents: `SELECT i.id, s.nom AS site, i.type, i.gravite, i.date_evenement, i.description, i.jours_arret, i.deces, i.statut
    FROM incidents i JOIN sites s ON s.id=i.site_id WHERE i.actif=1`,
  plaintes: `SELECT p.code_suivi, p.mecanisme, p.canal, s.nom AS site, p.nature, p.gravite, p.statut, p.date_depot, p.cloture_le
    FROM plaintes p LEFT JOIN sites s ON s.id=p.site_id WHERE p.actif=1 AND p.sensible=0`,
  actions: `SELECT a.id, a.origine, a.ref_paes, a.description, a.responsable, a.echeance, a.priorite, a.statut, a.cloture_le
    FROM actions a WHERE a.actif=1`,
  permis: `SELECT p.id, s.nom AS site, p.type, p.reference, p.autorite, p.date_obtention, p.date_expiration, p.statut
    FROM permis p JOIN sites s ON s.id=p.site_id WHERE p.actif=1`,
  consommations: `SELECT s.nom AS site, c.periode, c.type, c.valeur FROM consommations c JOIN sites s ON s.id=c.site_id WHERE c.actif=1`,
};
router.get('/export/:objet.csv', (req, res) => {
  const sql = EXPORTS[req.params.objet];
  if (!sql) return res.status(404).render('erreur', { titre: 'Introuvable', message: 'Export inconnu.' });
  const rows = db.prepare(sql).all();
  const cols = rows.length ? Object.keys(rows[0]) : [];
  const esc = (v) => v === null || v === undefined ? '' : /[";\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v);
  const csv = '﻿' + [cols.join(';'), ...rows.map((r) => cols.map((c) => esc(r[c])).join(';'))].join('\n');
  logAudit(req.session.user, 'export', req.params.objet, null, `${rows.length} lignes`);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="sges_${req.params.objet}.csv"`);
  res.send(csv);
});

module.exports = router;
