const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = process.env.SGES_DATA_DIR || path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'sges.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS entites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  nom TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'filiale',        -- holding | filiale
  profil_risque TEXT,
  actif INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS sites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entite_id INTEGER NOT NULL REFERENCES entites(id),
  code TEXT NOT NULL UNIQUE,
  nom TEXT NOT NULL,
  type TEXT NOT NULL,                          -- station | depot | magasin | restaurant | usine | siege | entrepot
  pays TEXT NOT NULL DEFAULT 'Sénégal',
  ville TEXT,
  actif INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nom TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,                          -- admin | es_groupe | es_filiale | correspondant_site | dg | auditeur | ifc | plaintes_sensibles
  entite_id INTEGER REFERENCES entites(id),
  site_id INTEGER REFERENCES sites(id),
  actif INTEGER NOT NULL DEFAULT 1
);

-- Module 1 : politiques et gouvernance
CREATE TABLE IF NOT EXISTS politiques (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  titre TEXT NOT NULL,
  theme TEXT,                                  -- E&S | SST | droits humains | harcelement | achats | anticorruption...
  entite_id INTEGER REFERENCES entites(id),    -- NULL = Groupe
  version TEXT NOT NULL DEFAULT '1.0',
  statut TEXT NOT NULL DEFAULT 'redaction',    -- redaction | revue | approuvee | publiee | retiree
  approbateur TEXT,
  date_publication TEXT,
  date_revision TEXT,                          -- prochaine échéance de révision
  contenu TEXT,
  cree_le TEXT NOT NULL DEFAULT (datetime('now')),
  actif INTEGER NOT NULL DEFAULT 1
);

-- Module 2 : registre des risques
CREATE TABLE IF NOT EXISTS risques (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entite_id INTEGER REFERENCES entites(id),
  site_id INTEGER REFERENCES sites(id),
  ps TEXT NOT NULL DEFAULT 'PS1',              -- norme de performance IFC concernée
  categorie TEXT,
  description TEXT NOT NULL,
  gravite_brute INTEGER NOT NULL,              -- 1..5
  probabilite_brute INTEGER NOT NULL,          -- 1..5
  mesures TEXT,
  gravite_nette INTEGER,
  probabilite_nette INTEGER,
  responsable TEXT,
  statut TEXT NOT NULL DEFAULT 'ouvert',       -- ouvert | maitrise | clos
  justification_revision TEXT,
  maj_le TEXT NOT NULL DEFAULT (datetime('now')),
  actif INTEGER NOT NULL DEFAULT 1
);

-- Module 3 : permis et autorisations
CREATE TABLE IF NOT EXISTS permis (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER NOT NULL REFERENCES sites(id),
  type TEXT NOT NULL,                          -- ICPE, autorisation d'exploitation, quitus environnemental...
  reference TEXT,
  autorite TEXT,
  date_obtention TEXT,
  date_expiration TEXT,
  statut TEXT NOT NULL DEFAULT 'valide',       -- valide | expire | en_renouvellement
  commentaire TEXT,
  actif INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS exigences_legales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pays TEXT NOT NULL,
  thematique TEXT NOT NULL,
  texte TEXT NOT NULL,
  applicabilite TEXT,
  covenant_ifc INTEGER NOT NULL DEFAULT 0,     -- EF-CONF-07 : covenant E&S du prêt IFC
  statut_conformite TEXT NOT NULL DEFAULT 'a_evaluer', -- conforme | non_conforme | partiel | a_evaluer
  actif INTEGER NOT NULL DEFAULT 1
);

-- Module 4 : plans d'action (dont PAES)
CREATE TABLE IF NOT EXISTS actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  origine TEXT NOT NULL,                       -- PAES | audit | incident | plainte | inspection | revue_direction | conformite
  ref_paes TEXT,                               -- numérotation contractuelle IFC si origine PAES
  origine_id INTEGER,                          -- id de l'objet source (incident, plainte, audit...)
  description TEXT NOT NULL,
  entite_id INTEGER REFERENCES entites(id),
  site_id INTEGER REFERENCES sites(id),
  responsable TEXT,
  echeance TEXT,
  priorite TEXT NOT NULL DEFAULT 'moyenne',    -- haute | moyenne | basse
  budget_fcfa INTEGER,
  statut TEXT NOT NULL DEFAULT 'ouverte',      -- ouverte | en_cours | cloturee | en_retard
  preuve TEXT,                                 -- pièce justificative exigée à la clôture (EF-PGM-06)
  validateur TEXT,
  cloture_le TEXT,
  cree_le TEXT NOT NULL DEFAULT (datetime('now')),
  actif INTEGER NOT NULL DEFAULT 1
);

-- Module 5 : formations et habilitations
CREATE TABLE IF NOT EXISTS formations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER REFERENCES sites(id),
  theme TEXT NOT NULL,
  date_session TEXT NOT NULL,
  duree_heures REAL NOT NULL DEFAULT 0,
  participants INTEGER NOT NULL DEFAULT 0,
  formateur TEXT,
  evaluation TEXT,
  actif INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS habilitations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER REFERENCES sites(id),
  titulaire TEXT NOT NULL,
  type TEXT NOT NULL,                          -- électrique, incendie, secourisme, engins, produits dangereux, HACCP
  date_obtention TEXT,
  date_expiration TEXT NOT NULL,
  actif INTEGER NOT NULL DEFAULT 1
);

-- Module 6 : urgences — équipements de sécurité et exercices
CREATE TABLE IF NOT EXISTS equipements_securite (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER NOT NULL REFERENCES sites(id),
  type TEXT NOT NULL,                          -- extincteur, RIA, détection, bac de rétention, kit antipollution...
  identifiant TEXT,
  dernier_controle TEXT,
  prochain_controle TEXT,
  etat TEXT NOT NULL DEFAULT 'conforme',       -- conforme | non_conforme | hors_service
  actif INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS exercices_urgence (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER NOT NULL REFERENCES sites(id),
  type TEXT NOT NULL,                          -- évacuation incendie, déversement, intoxication...
  date_exercice TEXT NOT NULL,
  participants INTEGER,
  compte_rendu TEXT,
  actif INTEGER NOT NULL DEFAULT 1
);

-- Module 7 : parties prenantes
CREATE TABLE IF NOT EXISTS parties_prenantes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER REFERENCES sites(id),
  nom TEXT NOT NULL,
  categorie TEXT NOT NULL,                     -- communauté, autorité, ONG, syndicat, média, groupe vulnérable
  contact TEXT,
  actif INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS interactions_pp (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  partie_prenante_id INTEGER REFERENCES parties_prenantes(id),
  site_id INTEGER REFERENCES sites(id),
  type TEXT NOT NULL,                          -- consultation, courrier, visite, campagne
  date_interaction TEXT NOT NULL,
  resume TEXT,
  engagements TEXT,
  actif INTEGER NOT NULL DEFAULT 1
);

-- Module 8 : plaintes (mécanisme externe communautés + mécanisme interne travailleurs)
CREATE TABLE IF NOT EXISTS plaintes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code_suivi TEXT NOT NULL UNIQUE,
  mecanisme TEXT NOT NULL,                     -- externe | interne  (deux dispositifs distincts, PS1/PS2)
  canal TEXT NOT NULL,                         -- web | mobile | numero_vert | registre_papier | courriel | boite
  site_id INTEGER REFERENCES sites(id),
  nature TEXT,
  ps_concernee TEXT,
  description TEXT NOT NULL,
  plaignant_nom TEXT,                          -- NULL = anonyme
  plaignant_contact TEXT,
  anonyme INTEGER NOT NULL DEFAULT 0,
  sensible INTEGER NOT NULL DEFAULT 0,         -- harcèlement, VBG, travail des enfants, discrimination → circuit restreint
  gravite INTEGER NOT NULL DEFAULT 2,          -- 1..5
  recevable INTEGER,
  statut TEXT NOT NULL DEFAULT 'recue',        -- recue | en_instruction | resolue | close | rejetee
  date_depot TEXT NOT NULL DEFAULT (datetime('now')),
  date_accuse TEXT,
  date_echeance TEXT,
  resolution TEXT,
  satisfaction TEXT,                           -- accepte | refuse | recours
  incident_id INTEGER,                         -- lien plainte ↔ incident (cas d'usage IFC)
  suivi_represailles TEXT,                     -- EF-PLA-09, plaintes internes
  cloture_le TEXT,
  actif INTEGER NOT NULL DEFAULT 1
);

-- Module 10 : incidents / SST
CREATE TABLE IF NOT EXISTS incidents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER NOT NULL REFERENCES sites(id),
  type TEXT NOT NULL,                          -- AT_arret | AT_sans_arret | trajet | presque_accident | situation_dangereuse | environnement | surete | sanitaire | tiers
  gravite INTEGER NOT NULL DEFAULT 2,          -- 1..5 (>=4 = significatif → notification DG/holding)
  date_evenement TEXT NOT NULL,
  description TEXT NOT NULL,
  declarant TEXT,
  lat REAL, lng REAL,
  photos TEXT,
  jours_arret INTEGER NOT NULL DEFAULT 0,
  deces INTEGER NOT NULL DEFAULT 0,
  cause_racine TEXT,
  methode_analyse TEXT,                        -- arbre des causes | 5P | Ishikawa
  mesures_immediates TEXT,
  autorites_notifiees TEXT,
  notifie_dg_le TEXT,                          -- horodatage notification holding (délai < 4 h)
  statut TEXT NOT NULL DEFAULT 'declare',      -- declare | en_analyse | clos
  cree_le TEXT NOT NULL DEFAULT (datetime('now')),
  actif INTEGER NOT NULL DEFAULT 1
);

-- Module 11 : environnement
CREATE TABLE IF NOT EXISTS consommations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER NOT NULL REFERENCES sites(id),
  periode TEXT NOT NULL,                       -- YYYY-MM
  type TEXT NOT NULL,                          -- electricite_kwh | diesel_l | essence_l | gaz_kg | eau_m3
  valeur REAL NOT NULL,
  actif INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS facteurs_emission (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL UNIQUE,                   -- aligné sur consommations.type
  scope INTEGER NOT NULL,                      -- 1 | 2
  facteur_kgco2e REAL NOT NULL,                -- kgCO2e par unité
  version TEXT NOT NULL DEFAULT '2026.1',
  source TEXT
);

CREATE TABLE IF NOT EXISTS dechets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER NOT NULL REFERENCES sites(id),
  periode TEXT NOT NULL,
  flux TEXT NOT NULL,                          -- banals, alimentaires, huiles usagées, boues hydrocarbures, DEEE, dangereux
  quantite_kg REAL NOT NULL,
  filiere TEXT,                                -- enfouissement | recyclage | valorisation | traitement agréé
  prestataire TEXT,
  bordereau TEXT,
  actif INTEGER NOT NULL DEFAULT 1
);

-- Module 17 : tiers et fournisseurs
CREATE TABLE IF NOT EXISTS tiers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nom TEXT NOT NULL,
  type TEXT NOT NULL,                          -- fournisseur | sous-traitant | transporteur | gardiennage | franchisé
  entite_id INTEGER REFERENCES entites(id),
  critique INTEGER NOT NULL DEFAULT 0,
  score_es INTEGER,                            -- 0..100
  code_conduite_accepte INTEGER NOT NULL DEFAULT 0,
  clauses_es_contrat INTEGER NOT NULL DEFAULT 0,
  dernier_audit TEXT,
  actif INTEGER NOT NULL DEFAULT 1
);

-- Module 18 : audits et non-conformités
CREATE TABLE IF NOT EXISTS audits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER REFERENCES sites(id),
  entite_id INTEGER REFERENCES entites(id),
  type TEXT NOT NULL,                          -- interne | externe | inspection_securite | fournisseur
  intitule TEXT NOT NULL,
  date_audit TEXT NOT NULL,
  auditeur TEXT,
  score REAL,
  statut TEXT NOT NULL DEFAULT 'planifie',     -- planifie | realise | clos
  conclusions TEXT,
  actif INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS non_conformites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  origine TEXT NOT NULL,                       -- audit | inspection | depassement_seuil | conformite
  origine_id INTEGER,
  site_id INTEGER REFERENCES sites(id),
  description TEXT NOT NULL,
  gravite TEXT NOT NULL DEFAULT 'mineure',     -- majeure | mineure | observation
  statut TEXT NOT NULL DEFAULT 'ouverte',      -- ouverte | action_definie | corrigee | verifiee
  echeance TEXT,
  responsable TEXT,
  verification_efficacite TEXT,
  cree_le TEXT NOT NULL DEFAULT (datetime('now')),
  cloture_le TEXT,
  actif INTEGER NOT NULL DEFAULT 1
);

-- Module 20 : GED
CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  titre TEXT NOT NULL,
  typologie TEXT NOT NULL,                     -- politique | procédure | EIES | plan d'urgence | rapport | permis | preuve
  entite_id INTEGER REFERENCES entites(id),
  site_id INTEGER REFERENCES sites(id),
  version TEXT NOT NULL DEFAULT '1.0',
  statut TEXT NOT NULL DEFAULT 'redaction',    -- redaction | verification | approuve | diffuse | archive | retire
  date_revision TEXT,
  mots_cles TEXT,
  contenu TEXT,
  maj_le TEXT NOT NULL DEFAULT (datetime('now')),
  actif INTEGER NOT NULL DEFAULT 1
);

-- Effectifs et heures travaillées (PS2, calcul TF/TG/LTIFR/TRIR)
CREATE TABLE IF NOT EXISTS effectifs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER NOT NULL REFERENCES sites(id),
  periode TEXT NOT NULL,                       -- YYYY-MM
  effectif INTEGER NOT NULL,
  femmes INTEGER NOT NULL DEFAULT 0,
  hommes INTEGER NOT NULL DEFAULT 0,
  cdi INTEGER NOT NULL DEFAULT 0,
  sous_traitants INTEGER NOT NULL DEFAULT 0,
  heures_travaillees REAL NOT NULL DEFAULT 0,
  actif INTEGER NOT NULL DEFAULT 1,
  UNIQUE(site_id, periode)
);

-- Pièces justificatives : fichiers rattachés aux objets métier (EF-PGM-06, EF-SST-01, EF-DOC-05)
CREATE TABLE IF NOT EXISTS pieces_jointes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  objet TEXT NOT NULL,                         -- action | incident | plainte | permis | audit | document
  objet_id INTEGER NOT NULL,
  fichier TEXT NOT NULL,                       -- nom de stockage sur disque (aléatoire)
  nom_original TEXT NOT NULL,
  mime TEXT,
  taille INTEGER,
  televerse_par TEXT,                          -- e-mail interne ou 'public' (dépôt de plainte)
  horodatage TEXT NOT NULL DEFAULT (datetime('now')),
  actif INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_pj_objet ON pieces_jointes (objet, objet_id);

-- Journal des notifications e-mail (EF-SST-04, EF-CONF-03, EF-PLA-03) :
-- chaque envoi (réel, simulé ou en échec) est tracé à des fins d'auditabilité.
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  horodatage TEXT NOT NULL DEFAULT (datetime('now')),
  destinataires TEXT NOT NULL,
  sujet TEXT NOT NULL,
  objet TEXT,                                  -- incident | plainte | permis | actions | test
  objet_id INTEGER,
  statut TEXT NOT NULL,                        -- envoye | simule (pas de clé API) | echec
  erreur TEXT
);

-- Piste d'audit inaltérable (6.3 / 6.8) : aucune suppression physique dans l'application
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  horodatage TEXT NOT NULL DEFAULT (datetime('now')),
  user_email TEXT,
  action TEXT NOT NULL,                        -- creation | modification | desactivation | consultation_sensible | export | connexion
  objet TEXT NOT NULL,
  objet_id INTEGER,
  details TEXT
);
`);

// Migration légère : colonne de suivi du dernier seuil d'alerte envoyé par permis
// (évite les envois en double du planificateur quotidien).
try { db.exec('ALTER TABLE permis ADD COLUMN alerte_envoyee TEXT'); } catch (e) { /* colonne déjà présente */ }

module.exports = db;
