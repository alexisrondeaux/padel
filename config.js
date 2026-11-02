// Réglages de l'app. C'est le seul fichier à modifier pour changer les joueurs
// ou brancher la base de données Firebase.

// Les 4 joueurs. "id" sert en interne (ne pas le changer une fois l'app utilisée),
// "name" est le nom affiché, "color" la couleur sur les graphiques.
export const PLAYERS = [
  { id: 'alexis', name: 'Alexis', color: '#2f7de1' },
  { id: 'dimitri', name: 'Dimitri', color: '#e0662f' },
  { id: 'papa', name: 'Papa', color: '#1f9d6b' },
  { id: 'maman', name: 'Maman', color: '#c2409a' },
];

// Équipes proposées par défaut quand on crée un match.
export const DEFAULT_TEAMS = {
  a: ['dimitri', 'alexis'],
  b: ['papa', 'maman'],
};

// Configuration Firebase (copiée depuis la console Firebase).
// Tant que "apiKey" est vide, l'app tourne en "mode test" :
// les données restent uniquement sur le téléphone utilisé.
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyAUwFfADIjdo72LT_4_hz4T1EMI_Phtw0w',
  authDomain: 'padel---famille.firebaseapp.com',
  projectId: 'padel---famille',
  storageBucket: 'padel---famille.firebasestorage.app',
  messagingSenderId: '1009069752938',
  appId: '1:1009069752938:web:ceed0c1e05595d92664013',
};
