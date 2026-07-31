# Plateforme SGES — Groupe EDK

Plateforme numérique de **Système de Gestion Environnementale et Sociale (SGES/ESMS)** du Groupe EDK SA, développée en réponse au cahier des charges CDC-SGES-EDK-2026-01 (action n°2 du PAES, Investment IFC n°50059), en conformité avec la Norme de Performance n°1 de l'IFC.

## Démarrage

```bash
npm install
npm start        # http://localhost:3000
```

Prérequis : Node.js ≥ 18. La base SQLite est créée dans `data/` (configurable via `SGES_DATA_DIR`).

## Démarrage en production : accès administrateur seul

La base démarre **vide** : au premier lancement, seul le **compte administrateur** est créé (plus aucune donnée de démonstration). L'administrateur construit ensuite tout le reste depuis `/admin` : les entités, les sites, puis les comptes des autres utilisateurs (rôles du §6.3 du CDC).

Compte administrateur initial, configurable par variables d'environnement :

| Variable | Rôle | Défaut |
|---|---|---|
| `ADMIN_EMAIL` | Adresse du compte administrateur | `admin@edk.sn` |
| `ADMIN_PASSWORD` | Mot de passe initial (8 caractères min) | S'il est absent, un mot de passe aléatoire est généré et affiché **une seule fois** dans le journal de démarrage (logs Railway : onglet *Deploy Logs*) |

Dans tous les cas, changez le mot de passe à la première connexion (`/admin`, modifier votre compte).

**Instance déjà déployée avec les données de démonstration** : connectez-vous en administrateur puis utilisez `/admin` → « Zone de réinitialisation » (confirmation `REINITIALISER`). Toutes les données métier et tous les comptes sauf le vôtre sont supprimés ; la piste d'audit et les facteurs d'émission GES sont conservés.

**Jeu de démonstration (optionnel)** : `npm run seed:demo` sur une base vide charge le périmètre EDK simulé et les comptes de démonstration (mot de passe `edk2026`) pour les démos IFC. Jamais chargé automatiquement.

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

**Notifications e-mail (Brevo)** : incident significatif (gravité ≥ 4) notifié à la DG et au Responsable E&S Groupe, accusé de réception envoyé au plaignant (si e-mail fourni), alerte de nouvelle plainte (routée vers le seul circuit confidentiel si sensible, sans contenu dans l'e-mail), alertes quotidiennes d'échéance de permis (J-180/90/60/30/7, sans doublon) et synthèse des actions en retard. Chaque envoi — réel, simulé ou en échec — est journalisé en base et visible dans `/admin`. Un bouton d'e-mail de test permet de valider la configuration.

**Administration** : gestion complète des utilisateurs (création, modification de rôle et de rattachement, réinitialisation de mot de passe, désactivation logique avec garde-fous : ni son propre compte, ni le dernier administrateur), journal des notifications, piste d'audit.

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
   - `ADMIN_EMAIL` et `ADMIN_PASSWORD` = compte administrateur initial (voir section précédente)
   - `BREVO_API_KEY` = clé API Brevo (transactionnel) pour l'envoi réel des e-mails — sans elle, les envois sont simulés et journalisés
   - `EMAIL_FROM` = expéditeur, ex. `SGES Groupe EDK <sges@votredomaine.sn>` (adresse d'un expéditeur validé dans Brevo)
   - `APP_URL` = URL publique du service (ex. `https://sges-production.up.railway.app`) pour les liens dans les e-mails
4. **Settings → Networking → Generate Domain** pour obtenir l'URL publique (HTTPS fourni par Railway).

Chaque push sur `main` redéploie automatiquement ; les données du volume sont conservées.

## Correspondance avec le lotissement du CDC

Ce dépôt couvre le périmètre des **lots 1 et 2** (socle de conformité + terrain et incidents) et une partie des lots 3 et 4 (parties prenantes, tiers, formations, reporting IFC). Restent à réaliser dans les lots suivants : application mobile hors connexion avec synchronisation, intégrations SIRH/ERP/SharePoint/Power BI, SSO/2FA, notifications par e-mail/SMS, modules PS5 à PS8 approfondis, moteur de grilles d'audit paramétrables.
