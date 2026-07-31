/* Envoi d'e-mails transactionnels via l'API Brevo (https://api.brevo.com/v3/smtp/email).
   Sans clé API (BREVO_API_KEY absente), les envois sont « simulés » : rien ne part,
   mais chaque notification est journalisée en base — la traçabilité reste démontrable.

   Variables d'environnement :
   - BREVO_API_KEY : clé API Brevo (transactionnel)
   - EMAIL_FROM    : expéditeur, ex. « SGES Groupe EDK <sges@edk.sn> »
   - APP_URL       : URL publique de la plateforme (liens dans les e-mails), optionnelle */
const db = require('./db');
const { joursRestants, niveauAlerte } = require('./helpers');

const API_KEY = process.env.BREVO_API_KEY || '';
const FROM_RAW = process.env.EMAIL_FROM || 'SGES Groupe EDK <no-reply@sges.local>';
const APP_URL = (process.env.APP_URL || '').replace(/\/$/, '');

function parseFrom(raw) {
  const m = raw.match(/^(.*)<(.+@.+)>$/);
  return m ? { name: m[1].trim() || 'SGES Groupe EDK', email: m[2].trim() } : { name: 'SGES Groupe EDK', email: raw.trim() };
}

const insNotif = db.prepare('INSERT INTO notifications (destinataires, sujet, objet, objet_id, statut, erreur) VALUES (?,?,?,?,?,?)');

function lien(chemin) { return APP_URL ? `<p><a href="${APP_URL}${chemin}">Ouvrir dans la Plateforme SGES</a></p>` : ''; }

function gabarit(titre, corps) {
  return `<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;">
    <div style="background:#135c39;color:#fff;padding:12px 18px;border-radius:6px 6px 0 0;"><b>SGES Groupe EDK</b></div>
    <div style="border:1px solid #dde4e0;border-top:none;padding:18px;border-radius:0 0 6px 6px;">
      <h2 style="margin-top:0;font-size:17px;color:#1f2d27;">${titre}</h2>${corps}
      <p style="color:#6b7a73;font-size:12px;margin-bottom:0;">Message automatique de la Plateforme SGES — Groupe EDK SA (PAES IFC n°50059). Ne pas répondre.</p>
    </div></div>`;
}

// Envoi de base : n'interrompt jamais le flux métier appelant (échec journalisé).
async function envoyer({ to, sujet, titre, corps, objet, objetId }) {
  const dests = [...new Set((to || []).filter((e) => e && /@/.test(e)))];
  if (!dests.length) return;
  if (!API_KEY) {
    insNotif.run(dests.join(', '), sujet, objet || null, objetId || null, 'simule', 'BREVO_API_KEY non configurée');
    console.log(`[mail simulé] ${sujet} → ${dests.join(', ')}`);
    return;
  }
  try {
    const rep = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': API_KEY, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: parseFrom(FROM_RAW),
        to: dests.map((email) => ({ email })),
        subject: sujet,
        htmlContent: gabarit(titre || sujet, corps || ''),
      }),
    });
    if (!rep.ok) throw new Error(`Brevo HTTP ${rep.status} : ${(await rep.text()).slice(0, 300)}`);
    insNotif.run(dests.join(', '), sujet, objet || null, objetId || null, 'envoye', null);
  } catch (err) {
    insNotif.run(dests.join(', '), sujet, objet || null, objetId || null, 'echec', String(err.message || err).slice(0, 500));
    console.error(`[mail échec] ${sujet} :`, err.message);
  }
}

function emailsParRoles(roles) {
  const q = roles.map(() => '?').join(',');
  return db.prepare(`SELECT email FROM users WHERE actif=1 AND role IN (${q})`).all(...roles).map((u) => u.email);
}

/* ---- Notification holding/DG pour événement significatif (EF-SST-04) ---- */
function notifierIncidentSignificatif(incident, siteNom) {
  return envoyer({
    to: emailsParRoles(['dg', 'es_groupe']),
    sujet: `[SGES] Incident significatif gravité ${incident.gravite}/5 — ${siteNom}`,
    titre: 'Incident significatif déclaré',
    corps: `<p><b>Site :</b> ${siteNom}<br><b>Type :</b> ${incident.type}<br><b>Gravité :</b> ${incident.gravite}/5<br>
      <b>Date de l'événement :</b> ${incident.date_evenement}<br><b>Déclarant :</b> ${incident.declarant || '—'}</p>
      <p>${incident.description}</p>${lien(`/incidents/${incident.id}`)}`,
    objet: 'incident', objetId: incident.id,
  });
}

/* ---- Plaintes : accusé de réception au plaignant + alerte interne (EF-PLA-03/05) ---- */
function accuserReceptionPlainte(plainte) {
  if (plainte.anonyme || !plainte.plaignant_contact || !/@/.test(plainte.plaignant_contact)) return Promise.resolve();
  return envoyer({
    to: [plainte.plaignant_contact],
    sujet: `[Groupe EDK] Votre plainte ${plainte.code_suivi} a bien été reçue`,
    titre: 'Accusé de réception de votre plainte',
    corps: `<p>Votre plainte a été enregistrée le ${plainte.date_depot || 'ce jour'} sous le code de suivi
      <b style="font-size:16px;">${plainte.code_suivi}</b>.</p>
      <p>Conservez ce code : il vous permet de suivre le traitement à tout moment${APP_URL ? ` sur <a href="${APP_URL}/suivi?code=${plainte.code_suivi}">notre page de suivi</a>` : ' sur notre page de suivi'}.</p>
      <p>Conformément à notre procédure, aucune représaille ne sera tolérée à l'encontre d'un plaignant.</p>`,
    objet: 'plainte', objetId: plainte.id,
  });
}

function alerterNouvellePlainte(plainte, siteNom) {
  // Une plainte sensible n'est signalée qu'au circuit restreint, sans détail du contenu.
  const roles = plainte.sensible ? ['plaintes_sensibles'] : ['es_groupe'];
  return envoyer({
    to: emailsParRoles(roles),
    sujet: `[SGES] Nouvelle plainte ${plainte.code_suivi}${plainte.sensible ? ' — circuit confidentiel' : ''}`,
    titre: plainte.sensible ? 'Nouvelle plainte sensible (circuit confidentiel)' : 'Nouvelle plainte reçue',
    corps: plainte.sensible
      ? `<p>Une plainte sensible a été déposée (code ${plainte.code_suivi}). Le contenu n'est pas transmis par e-mail : consultez le circuit confidentiel de la Plateforme.</p>${lien(`/plaintes/${plainte.id}`)}`
      : `<p><b>Code :</b> ${plainte.code_suivi}<br><b>Mécanisme :</b> ${plainte.mecanisme}<br><b>Site :</b> ${siteNom || 'non précisé'}<br><b>Nature :</b> ${plainte.nature || '—'}</p>${lien(`/plaintes/${plainte.id}`)}`,
    objet: 'plainte', objetId: plainte.id,
  });
}

/* ---- Planificateur quotidien : alertes permis J-180…J-7 (EF-CONF-03) et retards d'actions (EF-PGM-05) ---- */
async function alertesQuotidiennes() {
  // 1. Actions en retard : passage automatique de statut + rappel groupé
  db.prepare(`UPDATE actions SET statut='en_retard'
    WHERE actif=1 AND statut IN ('ouverte','en_cours') AND echeance IS NOT NULL AND echeance < date('now')`).run();

  // 2. Permis franchissant un nouveau seuil d'alerte
  const permis = db.prepare(`SELECT p.*, s.nom site_nom FROM permis p JOIN sites s ON s.id=p.site_id
    WHERE p.actif=1 AND p.date_expiration IS NOT NULL`).all();
  const aAlerter = permis.filter((p) => {
    const seuil = niveauAlerte(joursRestants(p.date_expiration));
    return seuil && seuil.seuil !== p.alerte_envoyee;
  });
  for (const p of aAlerter) {
    const jours = joursRestants(p.date_expiration);
    const seuil = niveauAlerte(jours);
    await envoyer({
      to: emailsParRoles(['es_groupe', 'es_filiale']),
      sujet: `[SGES] ${seuil.seuil} — ${p.type} (${p.site_nom})`,
      titre: `Alerte échéance de permis : ${seuil.seuil}`,
      corps: `<p><b>${p.type}</b> — ${p.site_nom}<br><b>Référence :</b> ${p.reference || '—'}<br>
        <b>Expiration :</b> ${p.date_expiration} (${jours < 0 ? `expiré depuis ${-jours} jour(s)` : `dans ${jours} jour(s)`})</p>
        <p>Engager sans délai la procédure de renouvellement auprès de : ${p.autorite || 'l’autorité émettrice'}.</p>${lien('/conformite')}`,
      objet: 'permis', objetId: p.id,
    });
    db.prepare('UPDATE permis SET alerte_envoyee=? WHERE id=?').run(seuil.seuil, p.id);
  }

  // 3. Synthèse des actions en retard (une seule fois par jour, seulement s'il y en a)
  const retards = db.prepare(`SELECT a.*, s.nom site_nom FROM actions a LEFT JOIN sites s ON s.id=a.site_id
    WHERE a.actif=1 AND a.statut='en_retard'`).all();
  const dejaEnvoyee = db.prepare(`SELECT 1 FROM notifications
    WHERE objet='actions' AND date(horodatage)=date('now') LIMIT 1`).get();
  if (retards.length && !dejaEnvoyee) {
    await envoyer({
      to: emailsParRoles(['es_groupe']),
      sujet: `[SGES] ${retards.length} action(s) en retard`,
      titre: 'Synthèse quotidienne des actions en retard',
      corps: `<ul>${retards.slice(0, 20).map((a) =>
        `<li><b>${a.ref_paes || a.origine}</b> — ${a.description} (échéance ${a.echeance}, resp. ${a.responsable || '—'})</li>`).join('')}</ul>
        ${retards.length > 20 ? `<p>… et ${retards.length - 20} autre(s).</p>` : ''}${lien('/actions')}`,
      objet: 'actions', objetId: null,
    });
  }
}

function lancerPlanificateur() {
  setTimeout(() => alertesQuotidiennes().catch((e) => console.error('Planificateur :', e)), 5000);
  setInterval(() => alertesQuotidiennes().catch((e) => console.error('Planificateur :', e)), 6 * 3600 * 1000).unref();
}

module.exports = { envoyer, notifierIncidentSignificatif, accuserReceptionPlainte, alerterNouvellePlainte, alertesQuotidiennes, lancerPlanificateur, apiConfiguree: () => !!API_KEY };
