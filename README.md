# Padel en famille

Application web (installable sur le téléphone) pour suivre les matchs de padel
en famille : scores, pronostics avec points, classements, stats et badges.

## Ce que fait l'app

- **Match** : créer un match (équipes modifiables ou tirées au sort), chacun parie
  le score, on ferme les paris, on saisit le score, puis on vote pour le MVP.
  Un match déjà joué peut aussi être ajouté directement avec son score.
- **Historique** : tous les matchs, avec le détail des paris, des votes et des badges.
  On peut corriger un score ou supprimer un match.
- **Classement** : victoires par joueur, et classement des pronostiqueurs.
- **Stats** : graphique d'évolution, meilleur duo, face-à-face, séries, sets et jeux, badges.

Format des matchs : 2 sets gagnants, tie-break à 6-6, 3e set normal.

Barème des paris : +5 bon vainqueur, +2 bon nombre de sets, +3 par set moins 1
par jeu d'écart (minimum 0), +5 bonus si score exact.

## Mise en ligne (une seule fois)

### 1. Créer la base de données Firebase (gratuit)

1. Aller sur https://console.firebase.google.com et se connecter avec un compte Google.
2. "Créer un projet", nom `padel-famille`, Google Analytics : non.
3. Menu de gauche "Créer" puis **Firestore Database**, "Créer une base de données",
   emplacement `eur3 (europe-west)`, démarrer en **mode production**.
4. Onglet **Règles** : remplacer le contenu par celui du fichier `firestore.rules`, puis "Publier".
5. Roue dentée en haut à gauche, "Paramètres du projet", en bas "Vos applications",
   icône `</>` (Web), nom `padel`, ne pas cocher Hosting, "Enregistrer".
6. Copier le bloc `firebaseConfig` affiché (apiKey, authDomain, projectId...)
   et l'envoyer à Claude, ou le coller dans `config.js` à la place des valeurs vides.

Ces clés ne sont pas secrètes : elles servent juste à identifier la base.

### 2. Publier sur GitHub Pages

Le site est publié depuis la branche `main` du dépôt `padel` :
Settings, Pages, Source "Deploy from a branch", branche `main`, dossier `/ (root)`.
Adresse : https://alexisrondeaux.github.io/padel/

### 3. Installer l'app sur les téléphones

- **iPhone** : ouvrir l'adresse dans **Safari**, bouton Partager, "Sur l'écran d'accueil".
- **Android** : ouvrir l'adresse dans **Chrome**, menu ⋮, "Installer l'application".

Au premier lancement, chacun choisit son prénom (modifiable en haut à droite).

## Modifier les joueurs

Dans `config.js` : noms, couleurs et équipes par défaut.
Ne pas changer les `id` une fois l'app utilisée (les paris y sont rattachés).

## Pour les développeurs

- Site statique sans compilation : `index.html`, `styles.css`, `app.js` (écrans),
  `scoring.js` (règles, points, stats, badges), `store.js` (Firebase ou mode test local).
- Tests des règles : `node tests.mjs`
- Aperçu local : `python3 -m http.server 8080` puis http://localhost:8080
- Après une modification de `styles.css` ou `app.js`, changer `?v=...` dans `index.html`
  et `sw.js`, et le nom du cache dans `sw.js`, pour que les téléphones prennent la nouvelle version.
