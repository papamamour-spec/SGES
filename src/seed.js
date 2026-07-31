/* Jeu de données de démarrage : périmètre Groupe EDK (Annexe D simulée), comptes par rôle,
   référentiels et données d'exemple permettant de dérouler le cas d'usage imposé du CDC (§16.2). */
const bcrypt = require('bcryptjs');
const db = require('./db');

const seedTx = db.transaction(() => {
  const insEnt = db.prepare('INSERT INTO entites (code, nom, type, profil_risque) VALUES (?,?,?,?)');
  const holding = insEnt.run('EDK', 'Groupe EDK SA (holding)', 'holding', 'Gouvernance, conformité, chaîne d’approvisionnement').lastInsertRowid;
  const oil = insEnt.run('OIL', 'EDK OIL', 'filiale', 'Pollution sols/eaux, ICPE, incendie, transport matières dangereuses').lastInsertRowid;
  const lp = insEnt.run('LP', 'LOW PRICE (Carrefour by EDK / Supeco)', 'filiale', 'Conditions de travail, chaîne du froid, déchets, sécurité consommateurs').lastInsertRowid;
  const djc = insEnt.run('DJC', 'DJOLOF CHICKEN', 'filiale', 'Hygiène sanitaire, effluents et graisses, déchets, travail des jeunes').lastInsertRowid;
  const tef = insEnt.run('TEF', 'TEFESS INDUSTRIE', 'filiale', 'ICPE, émissions, bruit, sécurité machine, chantier').lastInsertRowid;
  const qp = insEnt.run('QP', 'QUICKPAY / KPAY', 'filiale', 'Protection des données, inclusion financière, conduite de marché').lastInsertRowid;

  const insSite = db.prepare('INSERT INTO sites (entite_id, code, nom, type, pays, ville) VALUES (?,?,?,?,?,?)');
  const sites = {};
  const addSite = (ent, code, nom, type, pays, ville) => { sites[code] = insSite.run(ent, code, nom, type, pays, ville).lastInsertRowid; };

  addSite(holding, 'SIEGE', 'Siège Groupe EDK - Ngor Almadies', 'siege', 'Sénégal', 'Dakar');
  // EDK OIL - stations et dépôt
  ['Yoff', 'Pikine', 'Rufisque', 'Thiès', 'Mbour', 'Kaolack', 'Touba', 'Saint-Louis', 'Ziguinchor', 'Tambacounda'].forEach((v, i) =>
    addSite(oil, `ST-${String(i + 1).padStart(2, '0')}`, `Station EDK OIL ${v}`, 'station', 'Sénégal', v));
  addSite(oil, 'DEP-01', 'Dépôt hydrocarbures Bargny', 'depot', 'Sénégal', 'Bargny');
  // LOW PRICE
  ['Almadies', 'Plateau', 'Sacré-Cœur', 'Guédiawaye', 'Thiès'].forEach((v, i) =>
    addSite(lp, `MAG-${String(i + 1).padStart(2, '0')}`, `Magasin LOW PRICE ${v}`, 'magasin', 'Sénégal', v));
  addSite(lp, 'ENT-01', 'Entrepôt central LOW PRICE Diamniadio', 'entrepot', 'Sénégal', 'Diamniadio');
  // DJOLOF CHICKEN - multi-pays
  ['Dakar Point E', 'Dakar Ouakam', 'Thiès'].forEach((v, i) =>
    addSite(djc, `RES-SN-${i + 1}`, `Djolof Chicken ${v}`, 'restaurant', 'Sénégal', v.split(' ')[0]));
  addSite(djc, 'RES-GN-1', 'Djolof Chicken Conakry Kaloum', 'restaurant', 'Guinée', 'Conakry');
  addSite(djc, 'RES-GM-1', 'Djolof Chicken Banjul Senegambia', 'restaurant', 'Gambie', 'Banjul');
  // TEFESS / QUICKPAY
  addSite(tef, 'USI-01', 'Usine TEFESS Sandiara (démarrage 2027)', 'usine', 'Sénégal', 'Sandiara');
  addSite(qp, 'QP-01', 'Siège QuickPay Dakar', 'siege', 'Sénégal', 'Dakar');

  // ---- Comptes utilisateurs (un par rôle livré, §6.3) - mot de passe : edk2026
  const hash = bcrypt.hashSync('edk2026', 10);
  const insUser = db.prepare('INSERT INTO users (nom, email, password_hash, role, entite_id, site_id) VALUES (?,?,?,?,?,?)');
  insUser.run('Administrateur fonctionnel', 'admin@edk.sn', hash, 'admin', holding, null);
  insUser.run('Responsable E&S Groupe', 'es.groupe@edk.sn', hash, 'es_groupe', holding, null);
  insUser.run('Correspondant E&S EDK OIL', 'es.oil@edk.sn', hash, 'es_filiale', oil, null);
  insUser.run('Correspondant station Yoff', 'site.yoff@edk.sn', hash, 'correspondant_site', oil, sites['ST-01']);
  insUser.run('Direction Générale', 'dg@edk.sn', hash, 'dg', holding, null);
  insUser.run('Audit Interne', 'audit@edk.sn', hash, 'auditeur', holding, null);
  insUser.run('Superviseur IFC (lecture seule)', 'ifc@edk.sn', hash, 'ifc', holding, null);
  insUser.run('Gestionnaire plaintes sensibles', 'plaintes.sensibles@edk.sn', hash, 'plaintes_sensibles', holding, null);

  // ---- Politiques (Module 1)
  const insPol = db.prepare(`INSERT INTO politiques (titre, theme, entite_id, version, statut, approbateur, date_publication, date_revision, contenu)
    VALUES (?,?,?,?,?,?,?,?,?)`);
  insPol.run('Politique environnementale et sociale du Groupe EDK', 'E&S', null, '2.0', 'publiee', 'Comité Exécutif Restreint', '2026-01-15', '2027-01-15',
    'Engagement du Groupe EDK à gérer ses risques et impacts E&S conformément aux Normes de Performance IFC PS1 à PS8.');
  insPol.run('Politique santé et sécurité au travail', 'SST', null, '1.2', 'publiee', 'Direction Générale', '2026-02-01', '2027-02-01', null);
  insPol.run('Politique de lutte contre le harcèlement et les VBG', 'Droits humains', null, '1.0', 'publiee', 'Direction Générale', '2026-03-01', '2027-03-01', null);
  insPol.run('Politique achats responsables et code de conduite fournisseurs', 'Achats', null, '1.0', 'approuvee', 'DGA', null, '2026-12-31', null);
  insPol.run('Politique anticorruption', 'Conformité', null, '1.1', 'revue', null, null, null, null);

  // ---- Risques (Module 2)
  const insRis = db.prepare(`INSERT INTO risques (entite_id, site_id, ps, categorie, description, gravite_brute, probabilite_brute, mesures, gravite_nette, probabilite_nette, responsable, statut)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
  insRis.run(oil, sites['DEP-01'], 'PS3', 'Pollution', 'Déversement majeur d’hydrocarbures au dépôt de Bargny avec atteinte du milieu marin', 5, 3,
    'Bacs de rétention conformes, contrôles d’étanchéité semestriels, kit antipollution, plan POI', 5, 1, 'Correspondant E&S EDK OIL', 'maitrise');
  insRis.run(oil, null, 'PS4', 'Transport', 'Accident de camion-citerne en zone urbaine (transport de matières dangereuses)', 5, 3,
    'Formation conducteurs, itinéraires validés, contrôles techniques, télématique', 4, 2, 'Correspondant E&S EDK OIL', 'ouvert');
  insRis.run(lp, null, 'PS2', 'Conditions de travail', 'Heures supplémentaires non conformes au Code du travail en période de forte activité', 3, 4,
    'Pointage automatisé, contrôle mensuel RH, alerte dépassement', 2, 2, 'RH LOW PRICE', 'maitrise');
  insRis.run(djc, null, 'PS4', 'Sécurité sanitaire', 'Intoxication alimentaire collective clients', 5, 2,
    'HACCP, chaîne du froid contrôlée, prélèvements laboratoire mensuels', 4, 1, 'Qualité DJC', 'maitrise');
  insRis.run(tef, sites['USI-01'], 'PS3', 'Émissions', 'Émissions de poussières de l’usine en phase d’exploitation (2027)', 4, 4,
    'Filtres à manches prévus au design, mesures de qualité de l’air en limite de site', 3, 2, 'Chef de projet TEFESS', 'ouvert');
  insRis.run(qp, null, 'PS1', 'Données personnelles', 'Violation de données clients monnaie électronique', 4, 2,
    'Chiffrement, conformité CDP Sénégal, tests d’intrusion annuels', 3, 1, 'DSI', 'maitrise');

  // ---- Permis (Module 3) - échéances variées pour illustrer les alertes J-180…J-7
  const insPer = db.prepare(`INSERT INTO permis (site_id, type, reference, autorite, date_obtention, date_expiration, statut, commentaire) VALUES (?,?,?,?,?,?,?,?)`);
  const today = new Date();
  const plusJours = (j) => { const d = new Date(today); d.setDate(d.getDate() + j); return d.toISOString().slice(0, 10); };
  insPer.run(sites['DEP-01'], 'Récépissé ICPE - dépôt d’hydrocarbures', 'ICPE-2023-114', 'DEEC / Ministère de l’Environnement', '2023-06-01', plusJours(25), 'valide', 'Renouvellement à engager');
  insPer.run(sites['ST-01'], 'Autorisation d’exploitation station-service', 'AE-YOFF-2024-08', 'Ministère du Pétrole et des Énergies', '2024-03-15', plusJours(160), 'valide', null);
  insPer.run(sites['ST-02'], 'Autorisation d’exploitation station-service', 'AE-PIK-2022-31', 'Ministère du Pétrole et des Énergies', '2022-01-10', plusJours(-12), 'expire', 'Dossier de renouvellement déposé');
  insPer.run(sites['ENT-01'], 'Quitus environnemental entrepôt', 'QE-DIAM-2025-02', 'DEEC', '2025-04-01', plusJours(300), 'valide', null);
  insPer.run(sites['RES-GN-1'], 'Agrément sanitaire restauration', 'AS-CKY-2025-77', 'Ministère de la Santé (Guinée)', '2025-07-01', plusJours(55), 'valide', null);
  insPer.run(sites['USI-01'], 'Autorisation ICPE construction usine', 'ICPE-SAND-2026-01', 'DEEC', '2026-02-20', plusJours(700), 'valide', 'EIES validée, PGES chantier actif');

  // ---- Exigences légales / covenants (Module 3)
  const insEx = db.prepare(`INSERT INTO exigences_legales (pays, thematique, texte, applicabilite, covenant_ifc, statut_conformite) VALUES (?,?,?,?,?,?)`);
  insEx.run('Sénégal', 'Environnement', 'Code de l’environnement - régime ICPE et EIES', 'EDK OIL, TEFESS, LOW PRICE (entrepôt)', 0, 'conforme');
  insEx.run('Sénégal', 'Travail', 'Code du travail - déclaration des accidents du travail, CHS, médecine du travail', 'Toutes entités', 0, 'partiel');
  insEx.run('Sénégal', 'Données personnelles', 'Loi 2008-12 sur la protection des données - déclaration CDP', 'QuickPay, SIRH Groupe, Plateforme SGES', 0, 'conforme');
  insEx.run('Guinée', 'Hygiène', 'Réglementation sanitaire applicable à la restauration', 'Djolof Chicken Conakry', 0, 'a_evaluer');
  insEx.run('Gambie', 'Hygiène', 'Food Safety and Quality Act', 'Djolof Chicken Banjul', 0, 'a_evaluer');
  insEx.run('Tous pays', 'Covenant IFC', 'Convention de prêt IFC n°50059 - mise en œuvre du PAES, reporting annuel AMR, notification d’incident significatif', 'Groupe (co-emprunteurs)', 1, 'partiel');
  insEx.run('Tous pays', 'Covenant IFC', 'Respect de la Liste d’exclusion IFC pour toute nouvelle activité', 'Groupe', 1, 'conforme');

  // ---- Actions PAES et autres (Module 4)
  const insAct = db.prepare(`INSERT INTO actions (origine, ref_paes, description, entite_id, site_id, responsable, echeance, priorite, statut, preuve, validateur, cloture_le)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
  insAct.run('PAES', 'PAES-1', 'Désigner le Responsable E&S Groupe et le réseau de correspondants filiales et sites', null, null, 'DGA', '2026-03-31', 'haute', 'cloturee', 'Note de nomination signée du 12/03/2026', 'DGA', '2026-03-12');
  insAct.run('PAES', 'PAES-2', 'Mettre en place le Système de Gestion Environnementale et Sociale (SGES) conforme PS1, avec plateforme centralisée', null, null, 'Responsable E&S Groupe', '2026-12-31', 'haute', 'en_cours', null, null, null);
  insAct.run('PAES', 'PAES-3', 'Formaliser et déployer le mécanisme de gestion des plaintes externe et interne sur tous les sites', null, null, 'Responsable E&S Groupe', '2026-09-30', 'haute', 'en_cours', null, null, null);
  insAct.run('PAES', 'PAES-4', 'Réaliser les audits de conformité E&S des dépôts et stations EDK OIL', oil, null, 'Audit Interne', '2027-03-31', 'moyenne', 'ouverte', null, null, null);
  insAct.run('audit', null, 'Mettre à niveau les bacs de rétention de la station Pikine', oil, sites['ST-02'], 'Chef de station Pikine', plusJours(20), 'haute', 'en_cours', null, null, null);
  insAct.run('conformite', null, 'Renouveler l’autorisation d’exploitation de la station Pikine', oil, sites['ST-02'], 'Correspondant E&S EDK OIL', plusJours(-5), 'haute', 'en_retard', null, null, null);

  // ---- Formations / habilitations (Module 5)
  const insFor = db.prepare('INSERT INTO formations (site_id, theme, date_session, duree_heures, participants, formateur) VALUES (?,?,?,?,?,?)');
  insFor.run(sites['DEP-01'], 'Manipulation de produits dangereux et lutte antipollution', '2026-05-12', 8, 14, 'Prestataire agréé SSTP');
  insFor.run(sites['MAG-01'], 'Accueil sécurité nouveaux entrants', '2026-06-02', 2, 9, 'Correspondant site');
  insFor.run(sites['RES-SN-1'], 'HACCP niveau 1', '2026-04-22', 6, 12, 'Bureau Veritas');
  const insHab = db.prepare('INSERT INTO habilitations (site_id, titulaire, type, date_obtention, date_expiration) VALUES (?,?,?,?,?)');
  insHab.run(sites['DEP-01'], 'M. Diallo', 'Habilitation électrique BT', '2024-07-01', plusJours(40));
  insHab.run(sites['ST-01'], 'Mme Ndiaye', 'Sauveteur secouriste du travail', '2023-05-01', plusJours(-30));
  insHab.run(sites['ENT-01'], 'M. Sarr', 'Conduite d’engins (CACES 3)', '2025-01-15', plusJours(400));

  // ---- Équipements & exercices (Module 6)
  const insEq = db.prepare('INSERT INTO equipements_securite (site_id, type, identifiant, dernier_controle, prochain_controle, etat) VALUES (?,?,?,?,?,?)');
  insEq.run(sites['ST-01'], 'Extincteur poudre 9 kg', 'EXT-YOFF-01', '2026-01-10', plusJours(150), 'conforme');
  insEq.run(sites['DEP-01'], 'Kit antipollution 200 L', 'KAP-BAR-01', '2026-03-05', plusJours(60), 'conforme');
  insEq.run(sites['ST-02'], 'Bac de rétention cuve n°2', 'BR-PIK-02', '2025-09-01', plusJours(-15), 'non_conforme');
  const insExo = db.prepare('INSERT INTO exercices_urgence (site_id, type, date_exercice, participants, compte_rendu) VALUES (?,?,?,?,?)');
  insExo.run(sites['DEP-01'], 'Simulation déversement hydrocarbures', '2026-05-20', 18, 'Délai de déploiement du kit : 6 min. Action : renforcer la signalétique.');
  insExo.run(sites['MAG-01'], 'Exercice d’évacuation incendie', '2026-06-15', 42, 'Évacuation complète en 4 min 30.');

  // ---- Parties prenantes (Module 7)
  const insPP = db.prepare('INSERT INTO parties_prenantes (site_id, nom, categorie, contact) VALUES (?,?,?,?)');
  const ppBargny = insPP.run(sites['DEP-01'], 'Collectif des riverains de Bargny', 'communauté', 'Président : M. Faye').lastInsertRowid;
  insPP.run(sites['DEP-01'], 'Commune de Bargny', 'autorité', 'Secrétariat municipal');
  insPP.run(null, 'DEEC - Direction de l’Environnement', 'autorité', null);
  const insInt = db.prepare('INSERT INTO interactions_pp (partie_prenante_id, site_id, type, date_interaction, resume, engagements) VALUES (?,?,?,?,?,?)');
  insInt.run(ppBargny, sites['DEP-01'], 'consultation', '2026-04-18', 'Réunion publique sur le plan d’urgence du dépôt - 35 participants, liste de présence archivée.', 'Diffuser les consignes d’alerte aux riverains avant fin juin.');

  // ---- Effectifs (PS2 / indicateurs)
  const insEff = db.prepare('INSERT INTO effectifs (site_id, periode, effectif, femmes, hommes, cdi, sous_traitants, heures_travaillees) VALUES (?,?,?,?,?,?,?,?)');
  const periodes = ['2026-04', '2026-05', '2026-06'];
  const baseEff = { 'SIEGE': 60, 'DEP-01': 25, 'ENT-01': 45, 'USI-01': 12, 'QP-01': 35 };
  Object.entries(sites).forEach(([code, id]) => {
    const eff = baseEff[code] || (code.startsWith('ST-') ? 12 : code.startsWith('MAG-') ? 30 : code.startsWith('RES-') ? 15 : 20);
    periodes.forEach((p) => {
      const femmes = Math.round(eff * 0.4);
      insEff.run(id, p, eff, femmes, eff - femmes, Math.round(eff * 0.7), Math.round(eff * 0.15), eff * 173);
    });
  });

  // ---- Incidents (Module 10) - dont le scénario du cas d'usage §16.2
  const insInc = db.prepare(`INSERT INTO incidents (site_id, type, gravite, date_evenement, description, declarant, lat, lng, jours_arret, mesures_immediates, autorites_notifiees, notifie_dg_le, cause_racine, methode_analyse, statut)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const incDeversement = insInc.run(sites['ST-06'], 'environnement', 4, '2026-07-08 10:42',
    'Déversement d’environ 180 L de gazole lors du dépotage - zone à faible couverture réseau, déclaré en mode déconnecté puis synchronisé.',
    'Agent de station Kaolack', 14.152, -16.072, 0,
    'Épandage absorbant, fermeture de la fosse, périmètre de sécurité', 'DEEC (notification sous 48 h)',
    '2026-07-08 12:10', 'Flexible de dépotage usé non détecté lors du contrôle mensuel', 'arbre des causes', 'en_analyse').lastInsertRowid;
  insInc.run(sites['MAG-02'], 'AT_arret', 3, '2026-06-19 09:15', 'Chute d’un employé en réserve - entorse, 8 jours d’arrêt.',
    'Responsable magasin Plateau', null, null, 8, 'Premiers secours, déclaration CSS sous 48 h', 'Caisse de Sécurité Sociale', null, 'Sol encombré en zone de réception', '5P', 'clos');
  insInc.run(sites['RES-SN-2'], 'presque_accident', 2, '2026-07-02 18:30', 'Départ de feu maîtrisé sur friteuse - extincteur utilisé.',
    'Manager restaurant', null, null, 0, 'Coupure gaz, ventilation', null, null, null, null, 'en_analyse');
  insInc.run(sites['DEP-01'], 'situation_dangereuse', 3, '2026-07-15 07:50', 'Camion-citerne stationné hors zone dédiée pendant le dépotage.',
    'Chef de dépôt', null, null, 0, 'Rappel des consignes au transporteur', null, null, null, null, 'declare');

  // Actions correctives liées à l'incident de déversement (cas d'usage)
  insAct.run('incident', null, 'Remplacer l’ensemble des flexibles de dépotage du réseau et tracer les contrôles', oil, sites['ST-06'],
    'Maintenance EDK OIL', plusJours(30), 'haute', 'en_cours', null, null, null);
  insAct.run('incident', null, 'Réviser la grille d’inspection mensuelle des stations (point flexibles)', oil, null,
    'Correspondant E&S EDK OIL', plusJours(15), 'moyenne', 'ouverte', null, null, null);

  // ---- Plaintes (Module 8) - dont la plainte riverain liée à l'incident
  const insPla = db.prepare(`INSERT INTO plaintes (code_suivi, mecanisme, canal, site_id, nature, ps_concernee, description, plaignant_nom, plaignant_contact, anonyme, sensible, gravite, recevable, statut, date_depot, date_accuse, date_echeance, incident_id)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  insPla.run('PL-2026-0001', 'externe', 'web', sites['ST-06'], 'Nuisance environnementale', 'PS3',
    'Odeurs de carburant et crainte de pollution du puits voisin après le déversement du 8 juillet.',
    'M. Ba (riverain)', '77 000 00 00', 0, 0, 3, 1, 'en_instruction', '2026-07-09 08:20', '2026-07-09 08:20', plusJours(10), incDeversement);
  insPla.run('PL-2026-0002', 'interne', 'boite', sites['MAG-03'], 'Harcèlement', 'PS2',
    'Signalement confidentiel de faits de harcèlement par un supérieur hiérarchique.',
    null, null, 1, 1, 4, 1, 'en_instruction', '2026-06-25 14:00', '2026-06-25 14:05', plusJours(5), null);
  insPla.run('PL-2026-0003', 'externe', 'numero_vert', sites['RES-GN-1'], 'Bruit', 'PS4',
    'Nuisances sonores du groupe électrogène en soirée.', 'Riverain Kaloum', null, 0, 0, 2, 1, 'resolue', '2026-05-30 19:00', '2026-05-31 09:00', null, null);

  // ---- Environnement (Module 11)
  const insCons = db.prepare('INSERT INTO consommations (site_id, periode, type, valeur) VALUES (?,?,?,?)');
  Object.entries(sites).forEach(([code, id]) => {
    periodes.forEach((p, pi) => {
      const f = 1 + pi * 0.05;
      if (code.startsWith('ST-')) { insCons.run(id, p, 'electricite_kwh', Math.round(3200 * f)); insCons.run(id, p, 'eau_m3', Math.round(45 * f)); }
      else if (code.startsWith('MAG-')) { insCons.run(id, p, 'electricite_kwh', Math.round(28000 * f)); insCons.run(id, p, 'eau_m3', Math.round(120 * f)); insCons.run(id, p, 'diesel_l', Math.round(400 * f)); }
      else if (code.startsWith('RES-')) { insCons.run(id, p, 'electricite_kwh', Math.round(6500 * f)); insCons.run(id, p, 'gaz_kg', Math.round(350 * f)); insCons.run(id, p, 'eau_m3', Math.round(80 * f)); }
      else if (code === 'DEP-01') { insCons.run(id, p, 'electricite_kwh', Math.round(9000 * f)); insCons.run(id, p, 'diesel_l', Math.round(1200 * f)); }
      else { insCons.run(id, p, 'electricite_kwh', Math.round(12000 * f)); insCons.run(id, p, 'eau_m3', Math.round(60 * f)); }
    });
  });

  const insFE = db.prepare('INSERT INTO facteurs_emission (type, scope, facteur_kgco2e, version, source) VALUES (?,?,?,?,?)');
  insFE.run('electricite_kwh', 2, 0.53, '2026.1', 'Facteur réseau Senelec (mix thermique)');
  insFE.run('diesel_l', 1, 2.68, '2026.1', 'GHG Protocol - combustion diesel');
  insFE.run('essence_l', 1, 2.31, '2026.1', 'GHG Protocol - combustion essence');
  insFE.run('gaz_kg', 1, 2.98, '2026.1', 'GHG Protocol - GPL');

  const insDec = db.prepare('INSERT INTO dechets (site_id, periode, flux, quantite_kg, filiere, prestataire, bordereau) VALUES (?,?,?,?,?,?,?)');
  insDec.run(sites['DEP-01'], '2026-06', 'Boues d’hydrocarbures', 850, 'traitement agréé', 'SRH SA', 'BSD-2026-0612');
  insDec.run(sites['MAG-01'], '2026-06', 'Déchets banals', 3200, 'enfouissement', 'UCG', null);
  insDec.run(sites['MAG-01'], '2026-06', 'Cartons / emballages', 1400, 'recyclage', 'Proplast', 'BSD-2026-0587');
  insDec.run(sites['RES-SN-1'], '2026-06', 'Huiles de friture usagées', 220, 'valorisation', 'Valorhuile', 'BSD-2026-0601');

  // ---- Tiers (Module 17)
  const insTiers = db.prepare('INSERT INTO tiers (nom, type, entite_id, critique, score_es, code_conduite_accepte, clauses_es_contrat, dernier_audit) VALUES (?,?,?,?,?,?,?,?)');
  insTiers.run('Transports Ndiaye & Frères (camions-citernes)', 'transporteur', oil, 1, 62, 1, 1, '2026-03-10');
  insTiers.run('SenGarde Sécurité', 'gardiennage', null, 1, 71, 1, 0, null);
  insTiers.run('Avipro Sénégal (volaille)', 'fournisseur', djc, 1, 78, 1, 1, '2026-02-20');
  insTiers.run('BTP Sahel (chantier usine)', 'sous-traitant', tef, 1, 55, 0, 1, null);
  insTiers.run('Papeterie du Plateau', 'fournisseur', null, 0, null, 0, 0, null);

  // ---- Audits & NC (Module 18)
  const insAud = db.prepare('INSERT INTO audits (site_id, entite_id, type, intitule, date_audit, auditeur, score, statut, conclusions) VALUES (?,?,?,?,?,?,?,?,?)');
  const audPik = insAud.run(sites['ST-02'], oil, 'interne', 'Audit E&S station Pikine', '2026-05-14', 'Audit Interne Groupe', 68, 'realise',
    'Autorisation expirée, bac de rétention non conforme, affichage consignes incomplet.').lastInsertRowid;
  insAud.run(sites['RES-SN-1'], djc, 'externe', 'Audit hygiène HACCP', '2026-04-25', 'Bureau Veritas', 88, 'clos', 'Bon niveau général, 2 observations mineures.');
  insAud.run(null, oil, 'interne', 'Audit conformité E&S dépôt Bargny', plusJours(45), 'Audit Interne Groupe', null, 'planifie', null);
  const insNC = db.prepare('INSERT INTO non_conformites (origine, origine_id, site_id, description, gravite, statut, echeance, responsable) VALUES (?,?,?,?,?,?,?,?)');
  insNC.run('audit', audPik, sites['ST-02'], 'Bac de rétention de la cuve n°2 fissuré', 'majeure', 'action_definie', plusJours(20), 'Chef de station Pikine');
  insNC.run('audit', audPik, sites['ST-02'], 'Affichage des consignes de sécurité incomplet', 'mineure', 'corrigee', null, 'Chef de station Pikine');
  insNC.run('depassement_seuil', null, sites['DEP-01'], 'Teneur en hydrocarbures des eaux de rejet supérieure à la valeur limite (12 mg/L pour 10 mg/L)', 'majeure', 'ouverte', plusJours(30), 'Correspondant E&S EDK OIL');

  // ---- Documents (Module 20)
  const insDoc = db.prepare('INSERT INTO documents (titre, typologie, entite_id, site_id, version, statut, date_revision, mots_cles) VALUES (?,?,?,?,?,?,?,?)');
  insDoc.run('Manuel du SGES Groupe EDK', 'procédure', null, null, '1.0', 'diffuse', '2027-06-30', 'SGES, PS1, manuel');
  insDoc.run('EIES usine TEFESS Sandiara', 'EIES', tef, sites['USI-01'], '2.1', 'approuve', null, 'EIES, ICPE, Sandiara');
  insDoc.run('Plan d’Opération Interne - dépôt Bargny', "plan d'urgence", oil, sites['DEP-01'], '3.0', 'diffuse', '2026-12-31', 'POI, déversement, incendie');
  insDoc.run('Procédure de gestion des plaintes communautaires', 'procédure', null, null, '1.2', 'diffuse', '2027-03-31', 'plaintes, parties prenantes');
  insDoc.run('Plan d’Engagement des Parties Prenantes (SEP)', 'procédure', null, null, '1.0', 'verification', null, 'SEP, consultation');
});

// Idempotent : ne fait rien si la base contient déjà des entités.
// Appelé au démarrage du serveur (déploiement cloud) ou via `npm run seed`.
function seedIfEmpty() {
  const count = db.prepare('SELECT COUNT(*) n FROM entites').get().n;
  if (count > 0) return false;
  seedTx();
  return true;
}

module.exports = { seedIfEmpty };

if (require.main === module) {
  console.log(seedIfEmpty()
    ? 'Seed terminé : périmètre EDK, comptes de démonstration (mot de passe : edk2026) et données d’exemple créés.'
    : 'Base déjà initialisée - seed ignoré.');
}
