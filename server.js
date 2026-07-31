const path = require('path');
const express = require('express');
const session = require('express-session');

const { seedIfEmpty } = require('./src/seed');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialisation automatique de la base au premier démarrage (déploiement cloud)
if (seedIfEmpty()) console.log('Base initialisée avec le périmètre EDK et les données de démonstration.');

// Derrière le proxy TLS de l'hébergeur (Railway…) : cookie secure automatique
app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'sges-edk-dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: 'auto', maxAge: 8 * 3600 * 1000 },
}));

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.path = req.path;
  next();
});

app.use('/', require('./src/routes/public'));
app.use('/', require('./src/routes/main'));
app.use('/', require('./src/routes/modules'));
app.use('/', require('./src/routes/reporting'));

app.use((req, res) => res.status(404).render('erreur', { titre: 'Page introuvable', message: 'La page demandée n’existe pas.' }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('erreur', { titre: 'Erreur interne', message: 'Une erreur est survenue. L’incident a été journalisé.' });
});

app.listen(PORT, () => console.log(`Plateforme SGES Groupe EDK — http://localhost:${PORT}`));
