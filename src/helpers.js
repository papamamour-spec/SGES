const db = require('./db');

const ROLES = {
  admin: 'Administrateur fonctionnel',
  es_groupe: 'Responsable E&S Groupe',
  es_filiale: 'Responsable E&S filiale',
  correspondant_site: 'Correspondant site',
  dg: 'Direction Générale',
  auditeur: 'Auditeur interne',
  ifc: 'Consultation externe IFC',
  plaintes_sensibles: 'Gestionnaire plaintes sensibles',
};

// Rôles autorisés en écriture (l'IFC et la DG sont en consultation)
const WRITE_ROLES = ['admin', 'es_groupe', 'es_filiale', 'correspondant_site', 'auditeur', 'plaintes_sensibles'];

function logAudit(user, action, objet, objetId, details) {
  db.prepare('INSERT INTO audit_log (user_email, action, objet, objet_id, details) VALUES (?,?,?,?,?)')
    .run(user ? user.email : 'public', action, objet, objetId || null, details || null);
}

function joursRestants(dateStr) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr) - new Date()) / 86400000);
}

// Niveaux d'alerte permis : J-180, J-90, J-60, J-30, J-7 (EF-CONF-03)
function niveauAlerte(jours) {
  if (jours === null) return null;
  if (jours < 0) return { seuil: 'expiré', classe: 'rouge' };
  if (jours <= 7) return { seuil: 'J-7', classe: 'rouge' };
  if (jours <= 30) return { seuil: 'J-30', classe: 'rouge' };
  if (jours <= 60) return { seuil: 'J-60', classe: 'orange' };
  if (jours <= 90) return { seuil: 'J-90', classe: 'orange' };
  if (jours <= 180) return { seuil: 'J-180', classe: 'jaune' };
  return null;
}

function genCodeSuivi() {
  const annee = new Date().getFullYear();
  const n = db.prepare("SELECT COUNT(*) c FROM plaintes WHERE code_suivi LIKE ?").get(`PL-${annee}-%`).c + 1;
  let code, i = n;
  do { code = `PL-${annee}-${String(i).padStart(4, '0')}`; i++; }
  while (db.prepare('SELECT 1 FROM plaintes WHERE code_suivi = ?').get(code));
  return code;
}

// Indicateurs SST (EF-SST-06) : base 1 000 000 h (TF/LTIFR/TRIR), 1 000 h (TG)
function indicateursSST(annee) {
  const like = `${annee}-%`;
  const heures = db.prepare("SELECT COALESCE(SUM(heures_travaillees),0) h FROM effectifs WHERE periode LIKE ? AND actif=1").get(like).h;
  const inc = db.prepare(`SELECT
      SUM(CASE WHEN type='AT_arret' THEN 1 ELSE 0 END) at_arret,
      SUM(CASE WHEN type='AT_sans_arret' THEN 1 ELSE 0 END) at_sans_arret,
      SUM(CASE WHEN type='presque_accident' THEN 1 ELSE 0 END) presque,
      COALESCE(SUM(jours_arret),0) jours_arret,
      COALESCE(SUM(deces),0) deces
    FROM incidents WHERE date_evenement LIKE ? AND actif=1`).get(like);
  const atArret = inc.at_arret || 0, atSans = inc.at_sans_arret || 0;
  return {
    heures,
    at_arret: atArret,
    at_sans_arret: atSans,
    presque_accidents: inc.presque || 0,
    jours_arret: inc.jours_arret,
    deces: inc.deces,
    tf: heures ? +((atArret * 1e6) / heures).toFixed(2) : null,       // taux de fréquence / LTIFR
    tg: heures ? +((inc.jours_arret * 1e3) / heures).toFixed(2) : null, // taux de gravité
    trir: heures ? +(((atArret + atSans) * 1e6) / heures).toFixed(2) : null,
  };
}

// Inventaire GES (EF-ENV-02) : scopes 1 et 2 depuis les consommations et facteurs versionnés
function inventaireGES(annee) {
  const rows = db.prepare(`SELECT c.type, fe.scope, SUM(c.valeur) total, fe.facteur_kgco2e, fe.version, fe.source
    FROM consommations c JOIN facteurs_emission fe ON fe.type = c.type
    WHERE c.periode LIKE ? AND c.actif=1 GROUP BY c.type`).all(`${annee}-%`);
  let scope1 = 0, scope2 = 0;
  const detail = rows.map((r) => {
    const tco2e = (r.total * r.facteur_kgco2e) / 1000;
    if (r.scope === 1) scope1 += tco2e; else scope2 += tco2e;
    return { ...r, tco2e: +tco2e.toFixed(2) };
  });
  return { scope1: +scope1.toFixed(2), scope2: +scope2.toFixed(2), total: +(scope1 + scope2).toFixed(2), detail };
}

module.exports = { ROLES, WRITE_ROLES, logAudit, joursRestants, niveauAlerte, genCodeSuivi, indicateursSST, inventaireGES };
