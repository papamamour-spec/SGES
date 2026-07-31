const path = require('path');
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireAuth, requireRole, requireWrite } = require('../auth');
const { logAudit, joursRestants, niveauAlerte, genCodeSuivi, ROLES } = require('../helpers');
const { upload, UPLOAD_DIR, enregistrerFichiers, piecesPour, nbPieces } = require('../upload');
const mailer = require('../mailer');

const router = express.Router();
router.use(requireAuth);

const entites = () => db.prepare("SELECT * FROM entites WHERE actif=1 ORDER BY nom").all();
const sites = () => db.prepare("SELECT s.*, e.nom entite_nom FROM sites s JOIN entites e ON e.id=s.entite_id WHERE s.actif=1 ORDER BY e.nom, s.nom").all();

/* ============ Module 1 · Politiques et gouvernance ============ */
router.get('/politiques', (req, res) => {
  const rows = db.prepare(`SELECT p.*, e.nom entite_nom FROM politiques p LEFT JOIN entites e ON e.id=p.entite_id WHERE p.actif=1 ORDER BY p.titre`).all();
  res.render('politiques', { rows, entites: entites() });
});
router.post('/politiques', requireWrite, (req, res) => {
  const b = req.body;
  const r = db.prepare(`INSERT INTO politiques (titre, theme, entite_id, version, statut, approbateur, date_publication, date_revision, contenu)
    VALUES (?,?,?,?,?,?,?,?,?)`).run(b.titre, b.theme || null, b.entite_id || null, b.version || '1.0', b.statut || 'redaction',
    b.approbateur || null, b.date_publication || null, b.date_revision || null, b.contenu || null);
  logAudit(req.session.user, 'creation', 'politique', r.lastInsertRowid, b.titre);
  res.redirect('/politiques');
});
// Cycle de validation (EF-GOV-02)
router.post('/politiques/:id/statut', requireWrite, (req, res) => {
  db.prepare('UPDATE politiques SET statut=? WHERE id=?').run(req.body.statut, req.params.id);
  logAudit(req.session.user, 'modification', 'politique', req.params.id, `statut → ${req.body.statut}`);
  res.redirect('/politiques');
});

/* ============ Module 2 · Registre des risques ============ */
router.get('/risques', (req, res) => {
  const rows = db.prepare(`SELECT r.*, e.nom entite_nom, s.nom site_nom FROM risques r
    LEFT JOIN entites e ON e.id=r.entite_id LEFT JOIN sites s ON s.id=r.site_id
    WHERE r.actif=1 ORDER BY (r.gravite_brute*r.probabilite_brute) DESC`).all();
  res.render('risques', { rows, entites: entites(), sites: sites() });
});
router.post('/risques', requireWrite, (req, res) => {
  const b = req.body;
  const r = db.prepare(`INSERT INTO risques (entite_id, site_id, ps, categorie, description, gravite_brute, probabilite_brute, mesures, gravite_nette, probabilite_nette, responsable)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(b.entite_id || null, b.site_id || null, b.ps, b.categorie || null, b.description,
    Number(b.gravite_brute), Number(b.probabilite_brute), b.mesures || null,
    b.gravite_nette ? Number(b.gravite_nette) : null, b.probabilite_nette ? Number(b.probabilite_nette) : null, b.responsable || null);
  logAudit(req.session.user, 'creation', 'risque', r.lastInsertRowid, b.description);
  res.redirect('/risques');
});
// Révision de cotation avec justification obligatoire (EF-RIS-08)
router.post('/risques/:id/revision', requireWrite, (req, res) => {
  const b = req.body;
  if (!b.justification || !b.justification.trim()) return res.status(400).render('erreur', { titre: 'Justification requise', message: 'Toute révision de cotation exige une justification (EF-RIS-08).' });
  db.prepare(`UPDATE risques SET gravite_nette=?, probabilite_nette=?, statut=?, justification_revision=?, maj_le=datetime('now') WHERE id=?`)
    .run(Number(b.gravite_nette), Number(b.probabilite_nette), b.statut, b.justification, req.params.id);
  logAudit(req.session.user, 'modification', 'risque', req.params.id, `révision cotation : ${b.justification}`);
  res.redirect('/risques');
});

/* ============ Module 3 · Conformité, permis, exigences ============ */
router.get('/conformite', (req, res) => {
  const permis = db.prepare(`SELECT p.*, s.nom site_nom, s.pays FROM permis p JOIN sites s ON s.id=p.site_id WHERE p.actif=1 ORDER BY p.date_expiration`).all()
    .map((p) => ({ ...p, jours: joursRestants(p.date_expiration), alerte: niveauAlerte(joursRestants(p.date_expiration)), pieces: piecesPour('permis', p.id) }));
  const exigences = db.prepare('SELECT * FROM exigences_legales WHERE actif=1 ORDER BY covenant_ifc DESC, pays, thematique').all();
  const taux = exigences.length
    ? Math.round((exigences.filter((e) => e.statut_conformite === 'conforme').length / exigences.length) * 100) : null;
  res.render('conformite', { permis, exigences, taux, sites: sites() });
});
router.post('/permis', requireWrite, upload.array('fichiers', 3), (req, res) => {
  const b = req.body;
  const r = db.prepare(`INSERT INTO permis (site_id, type, reference, autorite, date_obtention, date_expiration, statut, commentaire) VALUES (?,?,?,?,?,?,?,?)`)
    .run(b.site_id, b.type, b.reference || null, b.autorite || null, b.date_obtention || null, b.date_expiration || null, b.statut || 'valide', b.commentaire || null);
  enregistrerFichiers(req.files, 'permis', r.lastInsertRowid, req.session.user.email);
  logAudit(req.session.user, 'creation', 'permis', r.lastInsertRowid, b.type);
  res.redirect('/conformite');
});
router.post('/permis/:id/pieces', requireWrite, upload.array('fichiers', 3), (req, res) => {
  const n = enregistrerFichiers(req.files, 'permis', Number(req.params.id), req.session.user.email);
  logAudit(req.session.user, 'creation', 'piece_jointe', Number(req.params.id), `permis : ${n} fichier(s)`);
  res.redirect('/conformite');
});
router.post('/exigences', requireWrite, (req, res) => {
  const b = req.body;
  const r = db.prepare(`INSERT INTO exigences_legales (pays, thematique, texte, applicabilite, covenant_ifc, statut_conformite) VALUES (?,?,?,?,?,?)`)
    .run(b.pays, b.thematique, b.texte, b.applicabilite || null, b.covenant_ifc ? 1 : 0, b.statut_conformite || 'a_evaluer');
  logAudit(req.session.user, 'creation', 'exigence_legale', r.lastInsertRowid, b.texte);
  res.redirect('/conformite');
});
router.post('/exigences/:id/statut', requireWrite, (req, res) => {
  db.prepare('UPDATE exigences_legales SET statut_conformite=? WHERE id=?').run(req.body.statut_conformite, req.params.id);
  logAudit(req.session.user, 'modification', 'exigence_legale', req.params.id, `conformité → ${req.body.statut_conformite}`);
  res.redirect('/conformite');
});

/* ============ Module 4 · Plans d'action et PAES ============ */
router.get('/actions', (req, res) => {
  const filtre = req.query.origine ? 'AND a.origine = ?' : '';
  const params = req.query.origine ? [req.query.origine] : [];
  const rows = db.prepare(`SELECT a.*, e.nom entite_nom, s.nom site_nom,
    (SELECT COUNT(*) FROM pieces_jointes pj WHERE pj.objet='action' AND pj.objet_id=a.id AND pj.actif=1) nb_pieces
    FROM actions a
    LEFT JOIN entites e ON e.id=a.entite_id LEFT JOIN sites s ON s.id=a.site_id
    WHERE a.actif=1 ${filtre} ORDER BY CASE a.statut WHEN 'en_retard' THEN 0 WHEN 'ouverte' THEN 1 WHEN 'en_cours' THEN 2 ELSE 3 END, a.echeance`).all(...params);
  res.render('actions', { rows, origine: req.query.origine || '', entites: entites(), sites: sites() });
});
router.post('/actions', requireWrite, (req, res) => {
  const b = req.body;
  const r = db.prepare(`INSERT INTO actions (origine, ref_paes, description, entite_id, site_id, responsable, echeance, priorite, budget_fcfa)
    VALUES (?,?,?,?,?,?,?,?,?)`).run(b.origine, b.ref_paes || null, b.description, b.entite_id || null, b.site_id || null,
    b.responsable || null, b.echeance || null, b.priorite || 'moyenne', b.budget_fcfa ? Number(b.budget_fcfa) : null);
  logAudit(req.session.user, 'creation', 'action', r.lastInsertRowid, b.description);
  res.redirect('/actions');
});
// Clôture interdite sans pièce justificative documentaire téléversée (EF-PGM-06)
router.post('/actions/:id/statut', requireWrite, upload.array('fichiers', 5), (req, res) => {
  const b = req.body;
  const nouveaux = enregistrerFichiers(req.files, 'action', Number(req.params.id), req.session.user.email);
  if (b.statut === 'cloturee' && nouveaux === 0 && nbPieces('action', Number(req.params.id)) === 0) {
    return res.status(400).render('erreur', { titre: 'Preuve documentaire requise', message: 'La clôture d’une action exige une pièce justificative téléversée · document, photo ou PV (EF-PGM-06).' });
  }
  db.prepare(`UPDATE actions SET statut=?, preuve=COALESCE(?, preuve), validateur=?, cloture_le=CASE WHEN ?='cloturee' THEN datetime('now') ELSE cloture_le END WHERE id=?`)
    .run(b.statut, b.preuve || null, b.statut === 'cloturee' ? req.session.user.nom : null, b.statut, req.params.id);
  logAudit(req.session.user, 'modification', 'action', req.params.id, `statut → ${b.statut}${nouveaux ? ` (+${nouveaux} pièce(s))` : ''}`);
  res.redirect(req.get('referer') || '/actions');
});

/* ============ Module 5 · Formations et habilitations ============ */
router.get('/formations', (req, res) => {
  const rows = db.prepare(`SELECT f.*, s.nom site_nom FROM formations f LEFT JOIN sites s ON s.id=f.site_id WHERE f.actif=1 ORDER BY f.date_session DESC`).all();
  const habs = db.prepare(`SELECT h.*, s.nom site_nom FROM habilitations h LEFT JOIN sites s ON s.id=h.site_id WHERE h.actif=1 ORDER BY h.date_expiration`).all()
    .map((h) => ({ ...h, jours: joursRestants(h.date_expiration) }));
  res.render('formations', { rows, habs, sites: sites() });
});
router.post('/formations', requireWrite, (req, res) => {
  const b = req.body;
  const r = db.prepare('INSERT INTO formations (site_id, theme, date_session, duree_heures, participants, formateur) VALUES (?,?,?,?,?,?)')
    .run(b.site_id || null, b.theme, b.date_session, Number(b.duree_heures || 0), Number(b.participants || 0), b.formateur || null);
  logAudit(req.session.user, 'creation', 'formation', r.lastInsertRowid, b.theme);
  res.redirect('/formations');
});
router.post('/habilitations', requireWrite, (req, res) => {
  const b = req.body;
  const r = db.prepare('INSERT INTO habilitations (site_id, titulaire, type, date_obtention, date_expiration) VALUES (?,?,?,?,?)')
    .run(b.site_id || null, b.titulaire, b.type, b.date_obtention || null, b.date_expiration);
  logAudit(req.session.user, 'creation', 'habilitation', r.lastInsertRowid, `${b.titulaire} · ${b.type}`);
  res.redirect('/formations');
});

/* ============ Module 6 · Urgences ============ */
router.get('/urgences', (req, res) => {
  const equipements = db.prepare(`SELECT q.*, s.nom site_nom FROM equipements_securite q JOIN sites s ON s.id=q.site_id WHERE q.actif=1 ORDER BY q.prochain_controle`).all()
    .map((e) => ({ ...e, jours: joursRestants(e.prochain_controle) }));
  const exercices = db.prepare(`SELECT x.*, s.nom site_nom FROM exercices_urgence x JOIN sites s ON s.id=x.site_id WHERE x.actif=1 ORDER BY x.date_exercice DESC`).all();
  res.render('urgences', { equipements, exercices, sites: sites() });
});
router.post('/equipements', requireWrite, (req, res) => {
  const b = req.body;
  const r = db.prepare('INSERT INTO equipements_securite (site_id, type, identifiant, dernier_controle, prochain_controle, etat) VALUES (?,?,?,?,?,?)')
    .run(b.site_id, b.type, b.identifiant || null, b.dernier_controle || null, b.prochain_controle || null, b.etat || 'conforme');
  logAudit(req.session.user, 'creation', 'equipement_securite', r.lastInsertRowid, b.type);
  res.redirect('/urgences');
});
router.post('/exercices', requireWrite, (req, res) => {
  const b = req.body;
  const r = db.prepare('INSERT INTO exercices_urgence (site_id, type, date_exercice, participants, compte_rendu) VALUES (?,?,?,?,?)')
    .run(b.site_id, b.type, b.date_exercice, Number(b.participants || 0), b.compte_rendu || null);
  logAudit(req.session.user, 'creation', 'exercice_urgence', r.lastInsertRowid, b.type);
  res.redirect('/urgences');
});

/* ============ Module 7 · Parties prenantes ============ */
router.get('/parties-prenantes', (req, res) => {
  const pps = db.prepare(`SELECT p.*, s.nom site_nom FROM parties_prenantes p LEFT JOIN sites s ON s.id=p.site_id WHERE p.actif=1 ORDER BY p.nom`).all();
  const interactions = db.prepare(`SELECT i.*, p.nom pp_nom, s.nom site_nom FROM interactions_pp i
    LEFT JOIN parties_prenantes p ON p.id=i.partie_prenante_id LEFT JOIN sites s ON s.id=i.site_id
    WHERE i.actif=1 ORDER BY i.date_interaction DESC`).all();
  res.render('parties', { pps, interactions, sites: sites() });
});
router.post('/parties-prenantes', requireWrite, (req, res) => {
  const b = req.body;
  const r = db.prepare('INSERT INTO parties_prenantes (site_id, nom, categorie, contact) VALUES (?,?,?,?)')
    .run(b.site_id || null, b.nom, b.categorie, b.contact || null);
  logAudit(req.session.user, 'creation', 'partie_prenante', r.lastInsertRowid, b.nom);
  res.redirect('/parties-prenantes');
});
router.post('/interactions', requireWrite, (req, res) => {
  const b = req.body;
  const r = db.prepare('INSERT INTO interactions_pp (partie_prenante_id, site_id, type, date_interaction, resume, engagements) VALUES (?,?,?,?,?,?)')
    .run(b.partie_prenante_id || null, b.site_id || null, b.type, b.date_interaction, b.resume || null, b.engagements || null);
  logAudit(req.session.user, 'creation', 'interaction_pp', r.lastInsertRowid, b.type);
  res.redirect('/parties-prenantes');
});

/* ============ Module 8 · Plaintes ============ */
const ROLES_SENSIBLES = ['plaintes_sensibles', 'es_groupe']; // circuit restreint (EF-PLA-05)
router.get('/plaintes', (req, res) => {
  const peutVoirSensibles = ROLES_SENSIBLES.includes(req.session.user.role);
  const rows = db.prepare(`SELECT p.*, s.nom site_nom FROM plaintes p LEFT JOIN sites s ON s.id=p.site_id
    WHERE p.actif=1 ${peutVoirSensibles ? '' : 'AND p.sensible=0'} ORDER BY p.date_depot DESC`).all();
  const nbSensiblesMasquees = peutVoirSensibles ? 0 : db.prepare('SELECT COUNT(*) n FROM plaintes WHERE actif=1 AND sensible=1').get().n;
  const stats = db.prepare(`SELECT COUNT(*) total,
    SUM(CASE WHEN statut IN ('resolue','close') THEN 1 ELSE 0 END) resolues,
    SUM(CASE WHEN mecanisme='externe' THEN 1 ELSE 0 END) externes,
    ROUND(AVG(julianday(COALESCE(cloture_le, datetime('now'))) - julianday(date_depot)),1) delai_moyen
    FROM plaintes WHERE actif=1`).get();
  res.render('plaintes', { rows, stats, nbSensiblesMasquees, peutVoirSensibles, sites: sites() });
});
router.get('/plaintes/:id', (req, res) => {
  const p = db.prepare(`SELECT p.*, s.nom site_nom FROM plaintes p LEFT JOIN sites s ON s.id=p.site_id WHERE p.id=? AND p.actif=1`).get(req.params.id);
  if (!p) return res.status(404).render('erreur', { titre: 'Introuvable', message: 'Plainte inexistante.' });
  if (p.sensible && !ROLES_SENSIBLES.includes(req.session.user.role)) {
    logAudit(req.session.user, 'consultation_sensible', 'plainte_refusee', p.id, 'tentative d’accès à une plainte sensible');
    return res.status(403).render('erreur', { titre: 'Circuit restreint', message: 'Cette plainte relève du circuit confidentiel (EF-PLA-05). Accès réservé au gestionnaire des plaintes sensibles.' });
  }
  if (p.sensible) logAudit(req.session.user, 'consultation_sensible', 'plainte', p.id, null);
  const incident = p.incident_id ? db.prepare('SELECT i.*, s.nom site_nom FROM incidents i JOIN sites s ON s.id=i.site_id WHERE i.id=?').get(p.incident_id) : null;
  const actions = db.prepare("SELECT * FROM actions WHERE origine='plainte' AND origine_id=? AND actif=1").all(p.id);
  res.render('plainte_detail', { p, incident, actions, pieces: piecesPour('plainte', p.id) });
});
router.post('/plaintes/:id/pieces', requireWrite, upload.array('fichiers', 5), (req, res) => {
  const p = db.prepare('SELECT * FROM plaintes WHERE id=? AND actif=1').get(req.params.id);
  if (!p) return res.status(404).render('erreur', { titre: 'Introuvable', message: 'Plainte inexistante.' });
  if (p.sensible && !ROLES_SENSIBLES.includes(req.session.user.role)) return res.status(403).render('erreur', { titre: 'Circuit restreint', message: 'Accès réservé.' });
  const n = enregistrerFichiers(req.files, 'plainte', p.id, req.session.user.email);
  logAudit(req.session.user, 'creation', 'piece_jointe', p.id, `plainte ${p.code_suivi} : ${n} fichier(s)`);
  res.redirect(`/plaintes/${p.id}`);
});
router.post('/plaintes', requireWrite, (req, res) => {
  const b = req.body;
  const code = genCodeSuivi();
  const r = db.prepare(`INSERT INTO plaintes (code_suivi, mecanisme, canal, site_id, nature, ps_concernee, description, plaignant_nom, plaignant_contact, anonyme, sensible, gravite, date_accuse, date_echeance)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'),?)`)
    .run(code, b.mecanisme, b.canal, b.site_id || null, b.nature || null, b.ps_concernee || null, b.description,
      b.anonyme ? null : (b.plaignant_nom || null), b.anonyme ? null : (b.plaignant_contact || null),
      b.anonyme ? 1 : 0, b.sensible ? 1 : 0, Number(b.gravite || 2), b.date_echeance || null);
  logAudit(req.session.user, 'creation', 'plainte', r.lastInsertRowid, `${code} (saisie a posteriori, canal ${b.canal})`);
  const pl = db.prepare('SELECT p.*, s.nom site_nom FROM plaintes p LEFT JOIN sites s ON s.id=p.site_id WHERE p.id=?').get(r.lastInsertRowid);
  mailer.accuserReceptionPlainte(pl);
  mailer.alerterNouvellePlainte(pl, pl.site_nom);
  res.redirect('/plaintes');
});
router.post('/plaintes/:id/traiter', requireWrite, (req, res) => {
  const p = db.prepare('SELECT * FROM plaintes WHERE id=?').get(req.params.id);
  if (p.sensible && !ROLES_SENSIBLES.includes(req.session.user.role)) return res.status(403).render('erreur', { titre: 'Circuit restreint', message: 'Accès réservé.' });
  const b = req.body;
  db.prepare(`UPDATE plaintes SET statut=?, recevable=COALESCE(?,recevable), resolution=COALESCE(?,resolution), satisfaction=COALESCE(?,satisfaction),
    suivi_represailles=COALESCE(?,suivi_represailles), incident_id=COALESCE(?,incident_id),
    cloture_le=CASE WHEN ? IN ('resolue','close','rejetee') THEN datetime('now') ELSE cloture_le END WHERE id=?`)
    .run(b.statut, b.recevable !== undefined && b.recevable !== '' ? Number(b.recevable) : null, b.resolution || null, b.satisfaction || null,
      b.suivi_represailles || null, b.incident_id || null, b.statut, req.params.id);
  logAudit(req.session.user, 'modification', 'plainte', req.params.id, `statut → ${b.statut}`);
  res.redirect(`/plaintes/${req.params.id}`);
});

/* ============ Module 10 · Incidents SST ============ */
router.get('/incidents', (req, res) => {
  const rows = db.prepare(`SELECT i.*, s.nom site_nom, e.nom entite_nom FROM incidents i
    JOIN sites s ON s.id=i.site_id JOIN entites e ON e.id=s.entite_id WHERE i.actif=1 ORDER BY i.date_evenement DESC`).all();
  res.render('incidents', { rows, sites: sites() });
});
router.get('/incidents/:id', (req, res) => {
  const i = db.prepare(`SELECT i.*, s.nom site_nom, e.nom entite_nom FROM incidents i
    JOIN sites s ON s.id=i.site_id JOIN entites e ON e.id=s.entite_id WHERE i.id=? AND i.actif=1`).get(req.params.id);
  if (!i) return res.status(404).render('erreur', { titre: 'Introuvable', message: 'Incident inexistant.' });
  const actions = db.prepare("SELECT * FROM actions WHERE origine='incident' AND (origine_id=? OR site_id=?) AND actif=1").all(i.id, i.site_id);
  const plaintesLiees = db.prepare('SELECT * FROM plaintes WHERE incident_id=? AND actif=1 AND sensible=0').all(i.id);
  res.render('incident_detail', { i, actions, plaintesLiees, pieces: piecesPour('incident', i.id) });
});
router.post('/incidents/:id/pieces', requireWrite, upload.array('fichiers', 5), (req, res) => {
  const n = enregistrerFichiers(req.files, 'incident', Number(req.params.id), req.session.user.email);
  logAudit(req.session.user, 'creation', 'piece_jointe', Number(req.params.id), `incident : ${n} fichier(s)`);
  res.redirect(`/incidents/${req.params.id}`);
});
router.post('/incidents', requireWrite, upload.array('photos', 5), (req, res) => {
  const b = req.body;
  const gravite = Number(b.gravite || 2);
  // Notification automatique DG/holding pour tout événement significatif (EF-SST-04)
  const notifie = gravite >= 4 ? new Date().toISOString().slice(0, 16).replace('T', ' ') : null;
  const r = db.prepare(`INSERT INTO incidents (site_id, type, gravite, date_evenement, description, declarant, lat, lng, jours_arret, deces, mesures_immediates, autorites_notifiees, notifie_dg_le)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(b.site_id, b.type, gravite, b.date_evenement, b.description, b.declarant || req.session.user.nom,
      b.lat ? Number(b.lat) : null, b.lng ? Number(b.lng) : null, Number(b.jours_arret || 0), Number(b.deces || 0),
      b.mesures_immediates || null, b.autorites_notifiees || null, notifie);
  const nPhotos = enregistrerFichiers(req.files, 'incident', r.lastInsertRowid, req.session.user.email);
  logAudit(req.session.user, 'creation', 'incident', r.lastInsertRowid, `${b.type} gravité ${gravite}${notifie ? ' · DG notifiée' : ''}${nPhotos ? ` · ${nPhotos} photo(s)` : ''}`);
  if (gravite >= 4) {
    const siteNom = db.prepare('SELECT nom FROM sites WHERE id=?').get(b.site_id)?.nom || '';
    mailer.notifierIncidentSignificatif({ id: r.lastInsertRowid, type: b.type, gravite, date_evenement: b.date_evenement, declarant: b.declarant || req.session.user.nom, description: b.description }, siteNom);
  }
  res.redirect(`/incidents/${r.lastInsertRowid}`);
});
router.post('/incidents/:id/analyse', requireWrite, (req, res) => {
  const b = req.body;
  db.prepare(`UPDATE incidents SET cause_racine=?, methode_analyse=?, statut=? WHERE id=?`)
    .run(b.cause_racine || null, b.methode_analyse || null, b.statut || 'en_analyse', req.params.id);
  if (b.action_corrective && b.action_corrective.trim()) {
    const inc = db.prepare('SELECT site_id FROM incidents WHERE id=?').get(req.params.id);
    db.prepare(`INSERT INTO actions (origine, origine_id, description, site_id, responsable, echeance, priorite) VALUES ('incident',?,?,?,?,?,'haute')`)
      .run(req.params.id, b.action_corrective, inc.site_id, b.action_responsable || null, b.action_echeance || null);
  }
  logAudit(req.session.user, 'modification', 'incident', req.params.id, 'analyse causes racines');
  res.redirect(`/incidents/${req.params.id}`);
});

/* ============ Module 11 · Environnement ============ */
router.get('/environnement', (req, res) => {
  const annee = String(new Date().getFullYear());
  const conso = db.prepare(`SELECT c.periode, c.type, SUM(c.valeur) total FROM consommations c
    WHERE c.actif=1 AND c.periode LIKE ? GROUP BY c.periode, c.type ORDER BY c.periode`).all(`${annee}-%`);
  const { inventaireGES } = require('../helpers');
  const ges = inventaireGES(annee);
  const dechets = db.prepare(`SELECT d.*, s.nom site_nom FROM dechets d JOIN sites s ON s.id=d.site_id WHERE d.actif=1 ORDER BY d.periode DESC`).all();
  const fe = db.prepare('SELECT * FROM facteurs_emission ORDER BY scope, type').all();
  res.render('environnement', { annee, conso, ges, dechets, fe, sites: sites() });
});
router.post('/consommations', requireWrite, (req, res) => {
  const b = req.body;
  const r = db.prepare('INSERT INTO consommations (site_id, periode, type, valeur) VALUES (?,?,?,?)')
    .run(b.site_id, b.periode, b.type, Number(b.valeur));
  logAudit(req.session.user, 'creation', 'consommation', r.lastInsertRowid, `${b.type} ${b.valeur} (${b.periode})`);
  res.redirect('/environnement');
});
router.post('/dechets', requireWrite, (req, res) => {
  const b = req.body;
  const r = db.prepare('INSERT INTO dechets (site_id, periode, flux, quantite_kg, filiere, prestataire, bordereau) VALUES (?,?,?,?,?,?,?)')
    .run(b.site_id, b.periode, b.flux, Number(b.quantite_kg), b.filiere || null, b.prestataire || null, b.bordereau || null);
  logAudit(req.session.user, 'creation', 'dechet', r.lastInsertRowid, b.flux);
  res.redirect('/environnement');
});

/* ============ Module 17 · Tiers ============ */
router.get('/tiers', (req, res) => {
  const rows = db.prepare(`SELECT t.*, e.nom entite_nom FROM tiers t LEFT JOIN entites e ON e.id=t.entite_id WHERE t.actif=1 ORDER BY t.critique DESC, t.nom`).all();
  res.render('tiers', { rows, entites: entites() });
});
router.post('/tiers', requireWrite, (req, res) => {
  const b = req.body;
  const r = db.prepare(`INSERT INTO tiers (nom, type, entite_id, critique, score_es, code_conduite_accepte, clauses_es_contrat, dernier_audit) VALUES (?,?,?,?,?,?,?,?)`)
    .run(b.nom, b.type, b.entite_id || null, b.critique ? 1 : 0, b.score_es ? Number(b.score_es) : null,
      b.code_conduite_accepte ? 1 : 0, b.clauses_es_contrat ? 1 : 0, b.dernier_audit || null);
  logAudit(req.session.user, 'creation', 'tiers', r.lastInsertRowid, b.nom);
  res.redirect('/tiers');
});

/* ============ Module 18 · Audits et non-conformités ============ */
router.get('/audits', (req, res) => {
  const rows = db.prepare(`SELECT a.*, s.nom site_nom, e.nom entite_nom FROM audits a
    LEFT JOIN sites s ON s.id=a.site_id LEFT JOIN entites e ON e.id=a.entite_id WHERE a.actif=1 ORDER BY a.date_audit DESC`).all();
  const ncs = db.prepare(`SELECT n.*, s.nom site_nom FROM non_conformites n LEFT JOIN sites s ON s.id=n.site_id WHERE n.actif=1
    ORDER BY CASE n.statut WHEN 'ouverte' THEN 0 WHEN 'action_definie' THEN 1 WHEN 'corrigee' THEN 2 ELSE 3 END`).all();
  res.render('audits', { rows, ncs, sites: sites(), entites: entites() });
});
router.post('/audits', requireWrite, (req, res) => {
  const b = req.body;
  const r = db.prepare('INSERT INTO audits (site_id, entite_id, type, intitule, date_audit, auditeur, score, statut, conclusions) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(b.site_id || null, b.entite_id || null, b.type, b.intitule, b.date_audit, b.auditeur || null,
      b.score ? Number(b.score) : null, b.statut || 'planifie', b.conclusions || null);
  logAudit(req.session.user, 'creation', 'audit', r.lastInsertRowid, b.intitule);
  res.redirect('/audits');
});
router.post('/nc', requireWrite, (req, res) => {
  const b = req.body;
  const r = db.prepare('INSERT INTO non_conformites (origine, origine_id, site_id, description, gravite, echeance, responsable) VALUES (?,?,?,?,?,?,?)')
    .run(b.origine, b.origine_id || null, b.site_id || null, b.description, b.gravite || 'mineure', b.echeance || null, b.responsable || null);
  logAudit(req.session.user, 'creation', 'non_conformite', r.lastInsertRowid, b.description);
  res.redirect('/audits');
});
router.post('/nc/:id/statut', requireWrite, (req, res) => {
  const b = req.body;
  db.prepare(`UPDATE non_conformites SET statut=?, verification_efficacite=COALESCE(?,verification_efficacite),
    cloture_le=CASE WHEN ?='verifiee' THEN datetime('now') ELSE cloture_le END WHERE id=?`)
    .run(b.statut, b.verification_efficacite || null, b.statut, req.params.id);
  logAudit(req.session.user, 'modification', 'non_conformite', req.params.id, `statut → ${b.statut}`);
  res.redirect('/audits');
});

/* ============ Module 20 · GED ============ */
router.get('/documents', (req, res) => {
  const q = (req.query.q || '').trim();
  const rows = q
    ? db.prepare(`SELECT d.*, e.nom entite_nom, s.nom site_nom FROM documents d LEFT JOIN entites e ON e.id=d.entite_id LEFT JOIN sites s ON s.id=d.site_id
        WHERE d.actif=1 AND (d.titre LIKE ? OR d.mots_cles LIKE ? OR d.typologie LIKE ?) ORDER BY d.titre`).all(`%${q}%`, `%${q}%`, `%${q}%`)
    : db.prepare(`SELECT d.*, e.nom entite_nom, s.nom site_nom FROM documents d LEFT JOIN entites e ON e.id=d.entite_id LEFT JOIN sites s ON s.id=d.site_id
        WHERE d.actif=1 ORDER BY d.titre`).all();
  res.render('documents', { rows, q, entites: entites(), sites: sites() });
});
router.post('/documents', requireWrite, (req, res) => {
  const b = req.body;
  const r = db.prepare('INSERT INTO documents (titre, typologie, entite_id, site_id, version, statut, date_revision, mots_cles) VALUES (?,?,?,?,?,?,?,?)')
    .run(b.titre, b.typologie, b.entite_id || null, b.site_id || null, b.version || '1.0', b.statut || 'redaction', b.date_revision || null, b.mots_cles || null);
  logAudit(req.session.user, 'creation', 'document', r.lastInsertRowid, b.titre);
  res.redirect('/documents');
});
router.post('/documents/:id/statut', requireWrite, (req, res) => {
  db.prepare("UPDATE documents SET statut=?, maj_le=datetime('now') WHERE id=?").run(req.body.statut, req.params.id);
  logAudit(req.session.user, 'modification', 'document', req.params.id, `statut → ${req.body.statut}`);
  res.redirect('/documents');
});

/* ============ Téléchargement des pièces justificatives ============ */
router.get('/fichiers/:id', (req, res) => {
  const pj = db.prepare('SELECT * FROM pieces_jointes WHERE id=? AND actif=1').get(req.params.id);
  if (!pj) return res.status(404).render('erreur', { titre: 'Introuvable', message: 'Pièce jointe inexistante.' });
  // Les pièces d'une plainte sensible restent dans le circuit restreint (EF-PLA-05)
  if (pj.objet === 'plainte') {
    const p = db.prepare('SELECT sensible, code_suivi FROM plaintes WHERE id=?').get(pj.objet_id);
    if (p && p.sensible && !ROLES_SENSIBLES.includes(req.session.user.role)) {
      logAudit(req.session.user, 'consultation_sensible', 'piece_refusee', pj.id, `pièce de la plainte ${p.code_suivi}`);
      return res.status(403).render('erreur', { titre: 'Circuit restreint', message: 'Cette pièce relève du circuit confidentiel des plaintes sensibles.' });
    }
    if (p && p.sensible) logAudit(req.session.user, 'consultation_sensible', 'piece_jointe', pj.id, null);
  }
  res.download(path.join(UPLOAD_DIR, pj.fichier), pj.nom_original);
});

/* ============ Administration ============ */
router.get('/admin', requireRole('admin', 'es_groupe'), (req, res) => {
  const users = db.prepare(`SELECT u.*, e.nom entite_nom, s.nom site_nom FROM users u
    LEFT JOIN entites e ON e.id=u.entite_id LEFT JOIN sites s ON s.id=u.site_id ORDER BY u.actif DESC, u.nom`).all();
  const notifications = db.prepare('SELECT * FROM notifications ORDER BY id DESC LIMIT 100').all();
  res.render('admin', {
    users, entites: entites(), sites: sites(), notifications,
    roles: ROLES, mailConfigure: mailer.apiConfiguree(),
    message: req.query.msg || null, erreur: req.query.err || null,
  });
});

// Création d'un utilisateur (admin uniquement)
router.post('/admin/utilisateurs', requireRole('admin'), (req, res) => {
  const b = req.body;
  const email = (b.email || '').trim().toLowerCase();
  if (!b.nom || !email || !/@/.test(email)) return res.redirect('/admin?err=' + encodeURIComponent('Nom et adresse e-mail valide obligatoires.'));
  if (!ROLES[b.role]) return res.redirect('/admin?err=' + encodeURIComponent('Rôle inconnu.'));
  if (!b.password || b.password.length < 8) return res.redirect('/admin?err=' + encodeURIComponent('Mot de passe de 8 caractères minimum.'));
  if (db.prepare('SELECT 1 FROM users WHERE email=?').get(email)) return res.redirect('/admin?err=' + encodeURIComponent('Cette adresse e-mail existe déjà.'));
  const r = db.prepare('INSERT INTO users (nom, email, password_hash, role, entite_id, site_id) VALUES (?,?,?,?,?,?)')
    .run(b.nom.trim(), email, bcrypt.hashSync(b.password, 10), b.role, b.entite_id || null, b.site_id || null);
  logAudit(req.session.user, 'creation', 'utilisateur', r.lastInsertRowid, `${email} (${b.role})`);
  res.redirect('/admin?msg=' + encodeURIComponent(`Utilisateur ${email} créé.`));
});

// Modification : rôle, rattachement, mot de passe, activation/désactivation
router.post('/admin/utilisateurs/:id', requireRole('admin'), (req, res) => {
  const cible = db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id);
  if (!cible) return res.redirect('/admin?err=' + encodeURIComponent('Utilisateur introuvable.'));
  const b = req.body;
  const details = [];

  if (b.action === 'desactiver') {
    if (cible.id === req.session.user.id) return res.redirect('/admin?err=' + encodeURIComponent('Impossible de désactiver votre propre compte.'));
    const admins = db.prepare("SELECT COUNT(*) n FROM users WHERE role='admin' AND actif=1").get().n;
    if (cible.role === 'admin' && cible.actif && admins <= 1) return res.redirect('/admin?err=' + encodeURIComponent('Impossible de désactiver le dernier administrateur.'));
    db.prepare('UPDATE users SET actif=0 WHERE id=?').run(cible.id);
    logAudit(req.session.user, 'desactivation', 'utilisateur', cible.id, cible.email);
    return res.redirect('/admin?msg=' + encodeURIComponent(`Compte ${cible.email} désactivé.`));
  }
  if (b.action === 'reactiver') {
    db.prepare('UPDATE users SET actif=1 WHERE id=?').run(cible.id);
    logAudit(req.session.user, 'modification', 'utilisateur', cible.id, `réactivation ${cible.email}`);
    return res.redirect('/admin?msg=' + encodeURIComponent(`Compte ${cible.email} réactivé.`));
  }

  if (b.role && b.role !== cible.role) {
    if (!ROLES[b.role]) return res.redirect('/admin?err=' + encodeURIComponent('Rôle inconnu.'));
    const admins = db.prepare("SELECT COUNT(*) n FROM users WHERE role='admin' AND actif=1").get().n;
    if (cible.role === 'admin' && admins <= 1) return res.redirect('/admin?err=' + encodeURIComponent('Impossible de retirer le rôle du dernier administrateur.'));
    details.push(`rôle ${cible.role} → ${b.role}`);
  }
  if (b.password) {
    if (b.password.length < 8) return res.redirect('/admin?err=' + encodeURIComponent('Mot de passe de 8 caractères minimum.'));
    details.push('mot de passe réinitialisé');
  }
  db.prepare(`UPDATE users SET nom=COALESCE(?,nom), role=COALESCE(?,role), entite_id=?, site_id=?,
    password_hash=COALESCE(?,password_hash) WHERE id=?`)
    .run(b.nom || null, b.role || null, b.entite_id || null, b.site_id || null,
      b.password ? bcrypt.hashSync(b.password, 10) : null, cible.id);
  logAudit(req.session.user, 'modification', 'utilisateur', cible.id, `${cible.email}${details.length ? ' : ' + details.join(', ') : ''}`);
  res.redirect('/admin?msg=' + encodeURIComponent(`Compte ${cible.email} mis à jour.`));
});

// E-mail de test de la configuration Brevo
router.post('/admin/test-email', requireRole('admin', 'es_groupe'), async (req, res) => {
  await mailer.envoyer({
    to: [req.session.user.email],
    sujet: '[SGES] E-mail de test de la configuration Brevo',
    titre: 'Test de configuration',
    corps: `<p>Cet e-mail confirme que l'envoi transactionnel de la Plateforme SGES fonctionne.</p>
      <p>Demandé par ${req.session.user.nom} (${req.session.user.email}).</p>`,
    objet: 'test', objetId: null,
  });
  logAudit(req.session.user, 'creation', 'email_test', null, req.session.user.email);
  res.redirect('/admin?msg=' + encodeURIComponent(mailer.apiConfiguree()
    ? 'E-mail de test envoyé · vérifiez votre boîte de réception et le journal ci-dessous.'
    : 'BREVO_API_KEY non configurée : envoi simulé, visible dans le journal des notifications.'));
});
router.get('/admin/journal', requireRole('admin', 'auditeur', 'es_groupe'), (req, res) => {
  const rows = db.prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT 300').all();
  res.render('journal', { rows });
});

module.exports = router;
