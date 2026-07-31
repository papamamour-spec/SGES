/* Téléversement des pièces justificatives (photos d'incident, preuves de clôture,
   documents de permis, pièces de plainte). Stockage sur SGES_DATA_DIR/uploads —
   donc sur le volume persistant en déploiement cloud. */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const db = require('./db');

const DATA_DIR = process.env.SGES_DATA_DIR || path.join(__dirname, '..', 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.heic', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.txt']);
const TAILLE_MAX = 10 * 1024 * 1024; // 10 Mo par fichier
const MAX_FICHIERS = 5;

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: TAILLE_MAX, files: MAX_FICHIERS },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!EXTENSIONS.has(ext)) return cb(new Error(`Type de fichier non autorisé (${ext || 'sans extension'})`));
    cb(null, true);
  },
});

// multer décode les noms de fichiers en latin1 ; on restaure l'UTF-8 (accents)
function nomOriginal(file) {
  try { return Buffer.from(file.originalname, 'latin1').toString('utf8'); }
  catch { return file.originalname; }
}

const insPJ = db.prepare(`INSERT INTO pieces_jointes (objet, objet_id, fichier, nom_original, mime, taille, televerse_par)
  VALUES (?,?,?,?,?,?,?)`);

function enregistrerFichiers(files, objet, objetId, par) {
  (files || []).forEach((f) => insPJ.run(objet, objetId, f.filename, nomOriginal(f), f.mimetype || null, f.size || null, par || 'public'));
  return (files || []).length;
}

function piecesPour(objet, objetId) {
  return db.prepare('SELECT * FROM pieces_jointes WHERE objet=? AND objet_id=? AND actif=1 ORDER BY id').all(objet, objetId);
}

function nbPieces(objet, objetId) {
  return db.prepare('SELECT COUNT(*) n FROM pieces_jointes WHERE objet=? AND objet_id=? AND actif=1').get(objet, objetId).n;
}

module.exports = { upload, UPLOAD_DIR, enregistrerFichiers, piecesPour, nbPieces };
