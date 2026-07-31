# Plateforme SGES — Groupe EDK

Plateforme numérique de **Système de Gestion Environnementale et Sociale (SGES/ESMS)** du Groupe EDK SA, développée en réponse au cahier des charges CDC-SGES-EDK-2026-01 (action n°2 du PAES, Investment IFC n°50059), en conformité avec la Norme de Performance n°1 de l'IFC.

## Démarrage

```bash
npm install
npm run seed     # initialise la base avec le périmètre EDK et des données de démonstration
npm start        # http://localhost:3000
```

Prérequis : Node.js ≥ 18. La base SQLite est créée dans `data/` (configurable via `SGES_DATA_DIR`).

## Comptes de démonstration

Mot de passe commun : `edk2026`

| Compte | Rôle (§6.3 du CDC) |
|---|---|
| admin@edk.sn | Administrateur fonctionnel |
| es.groupe@edk.sn | Responsable E&S Groupe |
| es.oil@edk.sn | Responsable E&S filiale (EDK OIL) |
| site.yoff@edk.sn | Correspondant site |
| dg@edk.sn | Direction Générale (lecture) |
| audit@edk.sn | Auditeur interne |
| ifc@edk.sn | Consultation externe IFC (lecture seule) |
| plaintes.sensibles@edk.sn | Gestionnaire plaintes sensibles (circuit confidentiel) |

## Fonctionnalités livrées

**Espace public (sans authentification)** — information E&S non confidentielle (EF-PAR-05), dépôt de plainte anonyme ou confidentiel avec code de suivi et accusé de réception horodaté (EF-PLA-01/02/03), suivi de plainte par code.

**Modules internes** :

| Module CDC | Écran | Points clés |
|---|---|---|
| 1 — Gouvernance | `/politiques` | Versionnage et cycle de validation des politiques (EF-GOV-01/02) |
| 2 — Risques | `/risques` | Registre par PS1–PS8, cotation brut/net, matrice 5×5, révision avec justification obligatoire (EF-RIS-01/03/08) |
| 3 — Conformité | `/conformite` | Permis avec alertes J-180/90/60/30/7, registre des exigences et covenants IFC, taux de conformité (EF-CONF-02/03/04/07) |
| 4 — Plans d'action | `/actions` | Référentiel unique multi-origines, vue PAES avec numérotation contractuelle, clôture impossible sans preuve (EF-PGM-01/03/06) |
| 5 — Formations | `/formations` | Sessions, habilitations avec alertes d'expiration (EF-FOR-02/03) |
| 6 — Urgences | `/urgences` | Équipements de sécurité et contrôles, exercices tracés (EF-URG-03/04) |
| 7 — Parties prenantes | `/parties-prenantes` | Cartographie, journal des interactions et engagements (EF-PAR-01/03/04) |
| 8 — Plaintes | `/plaintes` | Mécanismes externe/interne distincts, routage automatique des plaintes sensibles vers un circuit restreint étanche, statistiques IFC, suivi anti-représailles (EF-PLA-04→09) |
| 10 — SST | `/incidents` | Déclaration typée avec GPS, notification automatique DG si gravité ≥ 4, analyse des causes racines, TF/TG/LTIFR/TRIR calculés (EF-SST-01→06) |
| 11 — Environnement | `/environnement` | Consommations par site/période, inventaire GES scopes 1-2 (GHG Protocol, facteurs versionnés), registre des déchets avec bordereaux (EF-ENV-01/02/03) |
| 17 — Tiers | `/tiers` | Cotation E&S, criticité, code de conduite, clauses contractuelles (EF-TIE-01/03) |
| 18 — Audits & NC | `/audits` | Programme d'audits, non-conformités jusqu'à vérification d'efficacité (EF-AUD-01/04) |
| 19 — Reporting | `/reporting`, `/tableau-de-bord` | Tableau de bord Groupe/filiale à code couleur, rapport annuel IFC (AMR) généré depuis les données, notification d'incident au format IFC, exports CSV (EF-REP-01/02/03/06) |
| 20 — GED | `/documents` | Typologie, versions, cycle de vie documentaire, recherche (EF-DOC-01/02/03) |

**Pièces justificatives** : téléversement de fichiers (photos, PDF, documents — 10 Mo max, extensions contrôlées) sur les incidents (photos à la déclaration), les actions (clôture impossible sans pièce téléversée), les permis (scan du document) et les plaintes (y compris par le plaignant depuis le formulaire public). Les fichiers sont stockés dans `SGES_DATA_DIR/uploads` (donc sur le volume persistant en déploiement), servis uniquement aux utilisateurs authentifiés, et les pièces des plaintes sensibles restent dans le circuit confidentiel restreint.

**Exigences transverses** : rôles fins par module avec profils lecture seule (DG, IFC), circuit confidentiel des plaintes sensibles inaccessible aux autres rôles et à l'administrateur, piste d'audit inaltérable de toutes les opérations sensibles (`/admin/journal`), désactivation logique sans suppression physique, interface responsive en français.

Voir `docs/COUVERTURE_EXIGENCES.md` pour la traçabilité détaillée exigence par exigence et les limites du présent lot.

## Architecture

- **Serveur** : Node.js / Express 5, rendu serveur EJS (fonctionne sur téléphone d'entrée de gamme, pas de dépendance front lourde).
- **Base** : SQLite (better-sqlite3, mode WAL) — mono-instance, migrable vers PostgreSQL pour la production multi-tenant.
- **Sécurité** : sessions httpOnly, mots de passe bcrypt, contrôle d'accès par rôle sur chaque route, journalisation des consultations sensibles et exports.

## Déploiement sur Railway

Le dépôt est prêt pour Railway : la base est initialisée automatiquement au premier démarrage et le port est lu depuis `PORT`.

1. Sur [railway.com](https://railway.com) : **New Project → Deploy from GitHub repo** → sélectionner `papamamour-spec/SGES` (branche `main`). Le build Node.js est détecté automatiquement (`npm start`).
2. **Stockage persistant (indispensable)** : sur le service, clic droit → **Attach Volume**, point de montage `/data`. Sans volume, la base SQLite serait réinitialisée à chaque redéploiement.
3. **Variables d'environnement** (onglet *Variables* du service) :
   - `SGES_DATA_DIR` = `/data`
   - `SESSION_SECRET` = une valeur aléatoire longue (ex. `openssl rand -hex 32`)
4. **Settings → Networking → Generate Domain** pour obtenir l'URL publique (HTTPS fourni par Railway).

Chaque push sur `main` redéploie automatiquement ; les données du volume sont conservées.

## Correspondance avec le lotissement du CDC

Ce dépôt couvre le périmètre des **lots 1 et 2** (socle de conformité + terrain et incidents) et une partie des lots 3 et 4 (parties prenantes, tiers, formations, reporting IFC). Restent à réaliser dans les lots suivants : application mobile hors connexion avec synchronisation, intégrations SIRH/ERP/SharePoint/Power BI, SSO/2FA, notifications par e-mail/SMS, modules PS5 à PS8 approfondis, moteur de grilles d'audit paramétrables.
