/* Initialisation de PRODUCTION : la base démarre vide, à l'exception :
   - du compte administrateur initial (l'administrateur crée ensuite les autres
     comptes, les entités et les sites depuis /admin) ;
   - des facteurs d'émission GES (données de configuration, pas de démonstration).

   Compte administrateur :
   - ADMIN_EMAIL    : adresse du compte (défaut : admin@edk.sn)
   - ADMIN_PASSWORD : mot de passe initial ; s'il n'est pas fourni, un mot de
     passe aléatoire est généré et affiché UNE SEULE FOIS dans le journal de
     démarrage. À changer à la première connexion dans tous les cas.

   Jeu de démonstration : `npm run seed:demo` (jamais chargé automatiquement). */
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('./db');

function seedIfEmpty() {
  // Facteurs d'émission : configuration requise pour l'inventaire GES (EF-ENV-02)
  if (db.prepare('SELECT COUNT(*) n FROM facteurs_emission').get().n === 0) {
    const insFE = db.prepare('INSERT INTO facteurs_emission (type, scope, facteur_kgco2e, version, source) VALUES (?,?,?,?,?)');
    insFE.run('electricite_kwh', 2, 0.53, '2026.1', 'Facteur réseau Senelec (mix thermique)');
    insFE.run('diesel_l', 1, 2.68, '2026.1', 'GHG Protocol - combustion diesel');
    insFE.run('essence_l', 1, 2.31, '2026.1', 'GHG Protocol - combustion essence');
    insFE.run('gaz_kg', 1, 2.98, '2026.1', 'GHG Protocol - GPL');
  }

  if (db.prepare('SELECT COUNT(*) n FROM users').get().n > 0) return false;

  const email = (process.env.ADMIN_EMAIL || 'admin@edk.sn').trim().toLowerCase();
  let password = process.env.ADMIN_PASSWORD || '';
  let genere = false;
  if (!password || password.length < 8) {
    password = crypto.randomBytes(9).toString('base64url');
    genere = true;
  }
  db.prepare('INSERT INTO users (nom, email, password_hash, role) VALUES (?,?,?,?)')
    .run('Administrateur fonctionnel', email, bcrypt.hashSync(password, 10), 'admin');
  db.prepare("INSERT INTO audit_log (user_email, action, objet, details) VALUES ('systeme','creation','utilisateur','compte administrateur initial')").run();

  console.log('================================================================');
  console.log('Compte administrateur initial créé :');
  console.log(`  Adresse      : ${email}`);
  console.log(genere
    ? `  Mot de passe : ${password}   (généré, affiché une seule fois : notez-le et changez-le à la première connexion)`
    : '  Mot de passe : défini par la variable ADMIN_PASSWORD (à changer à la première connexion)');
  console.log('================================================================');
  return true;
}

module.exports = { seedIfEmpty };

if (require.main === module) {
  if (!seedIfEmpty()) console.log('Des comptes existent déjà : initialisation ignorée.');
}
