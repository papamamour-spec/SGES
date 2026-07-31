# Note de couverture des exigences — Plateforme SGES Groupe EDK

Traçabilité entre le cahier des charges CDC-SGES-EDK-2026-01 et la présente version de la Plateforme (livrable 12.1-14). Statuts : **Livré** (fonctionnel dans cette version), **Partiel** (socle livré, compléments prévus), **À venir** (lots ultérieurs).

## Exigences fonctionnelles

| Réf | Exigence (résumé) | Statut | Implémentation |
|---|---|---|---|
| EF-GOV-01 | Héberger et versionner les politiques | Livré | `/politiques` — versions, périmètre Groupe/filiale |
| EF-GOV-02 | Cycle de validation des politiques | Livré | Statuts rédaction → revue → approuvée → publiée → retirée |
| EF-GOV-03/05/06 | Preuves de diffusion, instances, suivi des décisions | Partiel | Décisions suivies via le référentiel d'actions (origine « revue_direction ») |
| EF-RIS-01 | Registre consolidé des risques par entité/site/PS | Livré | `/risques` |
| EF-RIS-03 | Matrice gravité × probabilité, brut et net | Livré | Matrice 5×5 paramétrée, scores colorés |
| EF-RIS-04 | Mesures de maîtrise et responsables rattachés | Livré | Champs dédiés au registre |
| EF-RIS-08 | Historisation des révisions avec justification obligatoire | Livré | Justification requise (HTTP 400 sinon), tracée en piste d'audit |
| EF-RIS-02/05/06/07 | Screening projets, EIES hébergées, liste d'exclusion, cartographie | Partiel | EIES gérées en GED ; screening et contrôle liste d'exclusion à venir |
| EF-CONF-01 | Registre des exigences légales par pays/thématique | Livré | `/conformite` |
| EF-CONF-02 | Référentiel des permis avec dates et autorité | Livré | `/conformite` |
| EF-CONF-03 | Alertes J-180/90/60/30/7 avec escalade | Livré | Alertes au tableau de bord + e-mails quotidiens automatiques (Brevo) aux responsables E&S Groupe et filiales, sans doublon par seuil |
| EF-CONF-04 | Évaluations de conformité avec taux | Livré | Taux calculé sur les exigences évaluées |
| EF-CONF-07 | Suivi des covenants IFC en catégorie spécifique | Livré | Marqueur « Covenant IFC » dans le registre |
| EF-CONF-05/06 | Visites d'inspection, veille réglementaire | À venir | |
| EF-PGM-01/02 | Référentiel unique d'actions, structuration complète | Livré | `/actions` — origines PAES, audit, incident, plainte, inspection… |
| EF-PGM-03 | Vue PAES avec numérotation contractuelle | Livré | Filtre PAES + bloc dédié au tableau de bord |
| EF-PGM-05 | Notification et escalade des retards | Livré | Passage automatique en « en retard » à l'échéance + synthèse e-mail quotidienne au Responsable E&S Groupe |
| EF-PGM-06 | Clôture interdite sans pièce justificative | Livré | Contrôle serveur bloquant : un fichier téléversé (document, photo, PV) est exigé pour clôturer |
| EF-FOR-02/03 | Plan de formation, alertes habilitations | Livré | `/formations` |
| EF-FOR-01/04/05 | Matrice de compétences, accueil sécurité, e-learning | À venir | |
| EF-URG-03/04 | Exercices tracés, équipements et contrôles | Livré | `/urgences` |
| EF-URG-01/02/05 | Plans d'urgence, annuaire de crise, journal de crise | Partiel | Plans d'urgence hébergés en GED |
| EF-PAR-01/03/04 | Cartographie, journal des interactions, engagements | Livré | `/parties-prenantes` |
| EF-PAR-05 | Espace public sans authentification | Livré | `/` (politiques publiées + accès au mécanisme de plainte) |
| EF-PLA-01 | Canaux multiples | Livré | Web public + saisie a posteriori (registre, numéro vert, courriel, boîte) |
| EF-PLA-02 | Dépôt anonyme et confidentiel avec code de suivi | Livré | Code PL-AAAA-NNNN, suivi public sans compte |
| EF-PLA-03 | Accusé de réception automatique horodaté | Livré | Horodatage à l'enregistrement + e-mail d'accusé de réception au plaignant si une adresse est fournie |
| EF-PLA-04 | Qualification (nature, gravité, PS, recevabilité, sensibilité) | Livré | Fiche plainte complète |
| EF-PLA-05 | Routage automatique des plaintes sensibles en circuit restreint | Livré | Natures sensibles → circuit réservé (gestionnaire dédié + Resp. E&S Groupe) ; accès refusés journalisés |
| EF-PLA-06/07 | Délais avec échéance, instruction jusqu'à clôture | Livré | Échéances, résolution, position du plaignant, recours |
| EF-PLA-08 | Statistiques IFC | Livré | Volume, taux de résolution, délai moyen, répartition |
| EF-PLA-09 | Suivi anti-représailles | Livré | Champ dédié aux plaintes internes |
| EF-SST-01 | Déclaration rapide terrain avec photos et géolocalisation | Partiel | Formulaire < 3 min avec GPS et téléversement de photos (capture caméra sur mobile) ; mode hors connexion à venir |
| EF-SST-02/03 | Typologie complète, gravité paramétrable et circuits | Livré | 9 types du CDC ; gravité ≥ 4 = significatif |
| EF-SST-04 | Notification automatique holding/DG < 4 h | Livré | E-mail automatique immédiat (Brevo) à la DG et au Responsable E&S Groupe dès la déclaration, horodaté et journalisé |
| EF-SST-05 | Analyse des causes racines et actions correctives | Livré | Arbre des causes / 5P / Ishikawa + création d'action liée |
| EF-SST-06 | TF, TG, LTIFR, TRIR, heures travaillées | Livré | Calcul automatique depuis incidents + effectifs |
| EF-SST-07→11 | DUERP, permis de travail, EPI, suivi médical, inspections mobiles | À venir | |
| EF-ENV-01 | Consommations par site et période | Livré | `/environnement` |
| EF-ENV-02 | Inventaire GES scopes 1-2, facteurs versionnés | Livré | GHG Protocol, table de facteurs avec version et source |
| EF-ENV-03 | Déchets par flux, filières, bordereaux | Livré | Registre complet |
| EF-ENV-04→09 | Effluents, substances, campagnes de mesures, seuils | Partiel | Dépassements gérés comme non-conformités (origine « dépassement de seuil ») |
| EF-TIE-01/03 | Référentiel tiers, cotation, code de conduite, clauses | Livré | `/tiers` |
| EF-TIE-02/04/05/06 | Questionnaires de diligence, audits fournisseurs planifiés | Partiel | Audits type « fournisseur » disponibles |
| EF-AUD-01 | Programme d'audits annuel | Livré | `/audits` |
| EF-AUD-03/04 | Constats, NC et cycle de vie jusqu'à vérification d'efficacité | Livré | ouverte → action définie → corrigée → vérifiée |
| EF-AUD-02/05/06 | Grilles paramétrables mobiles, revue de direction, espace IFC | Partiel | Rôle IFC lecture seule livré ; grilles mobiles à venir |
| EF-REP-01 | Tableaux de bord par niveau à code couleur | Livré | `/tableau-de-bord` avec filtre par entité |
| EF-REP-02 | Rapport annuel IFC généré | Livré | `/reporting/rapport-annuel` — 9 sections du §8.1, imprimable PDF |
| EF-REP-03 | Notification d'incident au format IFC | Livré | Générée par incident significatif |
| EF-REP-06 | Exports CSV/Excel | Livré | 5 exports CSV journalisés ; connecteur Power BI à venir |
| EF-REP-04/05/07 | Rapports réglementaires nationaux, KPI hebdo, comparaisons | À venir | |
| EF-DOC-01/02/03/04 | Bibliothèque, cycle de vie, versions, alertes de révision | Livré | `/documents` |
| EF-DOC-05 | Dossiers de preuve exportables | Partiel | Pièces justificatives (fichiers) rattachées aux actions, incidents, permis et plaintes, téléchargeables individuellement ; export groupé par action PAES/audit/site à venir |
| Modules 9, 13–16 (PS2 détaillé, PS5–PS8) | | Partiel | Effectifs/genre/CDI/sous-traitance suivis ; risques PS1–PS8 qualifiables au registre ; écrans dédiés prévus au lot 3 |

## Exigences transverses (§6)

| Exigence | Statut | Implémentation |
|---|---|---|
| Multi-entités / multi-sites avec consolidation Groupe | Livré | Modèle entités → sites sur toutes les tables |
| Rôles fins, 8 rôles minimaux du CDC | Livré | Contrôle par route ; DG et IFC en lecture seule |
| Circuit confidentiel étanche des plaintes sensibles | Livré | Inaccessible à l'administrateur fonctionnel ; tentatives d'accès journalisées |
| Piste d'audit inaltérable | Livré | Table `audit_log` en insertion seule applicative (créations, modifications, consultations sensibles, exports, connexions) |
| Aucune suppression physique | Livré | Désactivation logique (`actif=0`) sur toutes les entités |
| Interface français, responsive, simple | Livré | Rendu serveur léger, utilisable sur mobile d'entrée de gamme |
| Mobilité hors connexion, photos, signature, QR codes | À venir | Lot 2 mobile |
| SSO, 2FA, chiffrement au repos | À venir | Sessions sécurisées et bcrypt livrés ; SSO d'entreprise à intégrer |
| API REST documentée, interopérabilité SIRH/ERP/Power BI | À venir | Exports CSV comme format pivot en attendant |

## Cas d'usage imposé (§16.2)

Le scénario de démonstration est pré-chargé par le seed : incident de déversement à la station de Kaolack (déclaré terrain, DG notifiée à H+1h28), analyse par arbre des causes, deux actions correctives, plainte riveraine PL-2026-0001 déposée via le formulaire public et reliée à l'incident, notification IFC générable depuis la fiche incident, et remontée au tableau de bord Groupe et au rapport annuel.
