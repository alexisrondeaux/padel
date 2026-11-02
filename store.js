// Stockage des matchs : Firebase (partagé entre les téléphones) si configuré,
// sinon "mode test" dans le navigateur (localStorage).
import { FIREBASE_CONFIG } from './config.js';

const FB = 'https://www.gstatic.com/firebasejs/10.12.2/';

export async function createStore() {
  if (FIREBASE_CONFIG.apiKey) {
    try {
      return await firebaseStore();
    } catch (e) {
      console.error('Firebase indisponible, passage en mode test', e);
    }
  }
  return localStore();
}

async function firebaseStore() {
  const { initializeApp } = await import(`${FB}firebase-app.js`);
  const fs = await import(`${FB}firebase-firestore.js`);
  const app = initializeApp(FIREBASE_CONFIG);
  let db;
  try {
    // Cache local : l'app marche même avec une mauvaise connexion au club.
    db = fs.initializeFirestore(app, {
      localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }),
    });
  } catch (e) {
    db = fs.getFirestore(app);
  }
  const col = fs.collection(db, 'matches');
  return {
    mode: 'firebase',
    subscribe(cb, onError) {
      return fs.onSnapshot(col, (snap) => {
        cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      }, onError);
    },
    async add(data) {
      const ref = await fs.addDoc(col, data);
      return ref.id;
    },
    // patch : { 'bets.alexis': {...}, status: 'done' } (chemins avec des points)
    update(id, patch) {
      return fs.updateDoc(fs.doc(db, 'matches', id), patch);
    },
    remove(id) {
      return fs.deleteDoc(fs.doc(db, 'matches', id));
    },
  };
}

function localStore() {
  const KEY = 'padel-matches';
  const listeners = new Set();
  const read = () => {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || {};
    } catch (e) {
      return {};
    }
  };
  const write = (all) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(all));
    } catch (e) { /* stockage indisponible */ }
    emit(all);
  };
  const list = (all) => Object.entries(all).map(([id, m]) => ({ id, ...m }));
  const emit = (all) => listeners.forEach((cb) => cb(list(all)));
  window.addEventListener('storage', (e) => { if (e.key === KEY) emit(read()); });

  return {
    mode: 'local',
    subscribe(cb) {
      listeners.add(cb);
      cb(list(read()));
      return () => listeners.delete(cb);
    },
    async add(data) {
      const all = read();
      const id = `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      all[id] = data;
      write(all);
      return id;
    },
    async update(id, patch) {
      const all = read();
      if (!all[id]) return;
      for (const [path, value] of Object.entries(patch)) {
        const keys = path.split('.');
        let obj = all[id];
        for (const k of keys.slice(0, -1)) {
          obj[k] = obj[k] && typeof obj[k] === 'object' ? obj[k] : {};
          obj = obj[k];
        }
        obj[keys[keys.length - 1]] = value;
      }
      write(all);
    },
    async remove(id) {
      const all = read();
      delete all[id];
      write(all);
    },
  };
}
