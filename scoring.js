// Règles du padel, barème des paris, statistiques et badges.
// Fonctions pures (aucun accès à la page), testées dans tests.mjs.
//
// Un score = liste de sets [{ a: 6, b: 4 }, ...] où "a" = jeux de l'équipe A.

// Set valide : 6-0 à 6-4, 7-5, 7-6 (tie-break à 6-6).
// Le 3e set est un set normal : on tolère aussi 8-6, 9-7... au cas où.
export function isValidSet(set, index) {
  const hi = Math.max(set.a, set.b);
  const lo = Math.min(set.a, set.b);
  if (hi === 6 && lo <= 4) return true;
  if (hi === 7 && (lo === 5 || lo === 6)) return true;
  if (index === 2 && hi > 7 && hi - lo === 2) return true;
  return false;
}

export function setWinner(set) {
  return set.a > set.b ? 'a' : 'b';
}

// Vérifie un score complet (2 sets gagnants). Renvoie un message d'erreur ou null.
export function scoreError(sets) {
  if (!Array.isArray(sets) || sets.length < 2 || sets.length > 3) {
    return 'Un match se joue en 2 ou 3 sets.';
  }
  for (let i = 0; i < sets.length; i++) {
    if (!isValidSet(sets[i], i)) {
      return `Le set ${i + 1} (${sets[i].a}-${sets[i].b}) n'est pas un score de set possible.`;
    }
  }
  const w1 = setWinner(sets[0]);
  const w2 = setWinner(sets[1]);
  if (sets.length === 2 && w1 !== w2) {
    return 'Une set partout : il faut un 3e set.';
  }
  if (sets.length === 3 && w1 === w2) {
    return 'Le match est fini après 2 sets gagnés : pas de 3e set.';
  }
  return null;
}

export function matchWinner(sets) {
  let a = 0;
  let b = 0;
  for (const s of sets) (setWinner(s) === 'a' ? a++ : b++);
  return a > b ? 'a' : 'b';
}

export function formatScore(sets) {
  return (sets || []).map((s) => `${s.a}-${s.b}`).join('  ');
}

// Barème des paris :
//  +5 bon vainqueur, +2 bon nombre de sets,
//  +3 par set moins 1 par jeu d'écart (minimum 0), +5 bonus score exact.
export function betPoints(bet, actual) {
  const detail = { winner: 0, setCount: 0, sets: [], exact: 0 };
  if (!bet || !actual) return { total: 0, detail };
  if (matchWinner(bet) === matchWinner(actual)) detail.winner = 5;
  if (bet.length === actual.length) detail.setCount = 2;
  const n = Math.min(bet.length, actual.length);
  for (let i = 0; i < n; i++) {
    const gap = Math.abs(bet[i].a - actual[i].a) + Math.abs(bet[i].b - actual[i].b);
    detail.sets.push(Math.max(0, 3 - gap));
  }
  const exact = bet.length === actual.length
    && bet.every((s, i) => s.a === actual[i].a && s.b === actual[i].b);
  if (exact) detail.exact = 5;
  const total = detail.winner + detail.setCount + detail.exact
    + detail.sets.reduce((x, y) => x + y, 0);
  return { total, detail };
}

// Matchs terminés, du plus ancien au plus récent.
export function doneMatches(matches) {
  return matches
    .filter((m) => m.status === 'done' && Array.isArray(m.sets) && m.sets.length)
    .sort((x, y) => (x.date === y.date ? (x.createdAt || 0) - (y.createdAt || 0) : x.date < y.date ? -1 : 1));
}

export function teamOf(match, playerId) {
  if (match.teamA.includes(playerId)) return 'a';
  if (match.teamB.includes(playerId)) return 'b';
  return null;
}

// Élu(s) MVP d'un match : le ou les joueurs avec le plus de votes.
export function mvpOf(match) {
  const votes = Object.values(match.mvp || {});
  if (!votes.length) return [];
  const count = {};
  for (const v of votes) count[v] = (count[v] || 0) + 1;
  const max = Math.max(...Object.values(count));
  return Object.keys(count).filter((p) => count[p] === max);
}

export const BADGES = [
  { id: 'remontada', icon: '🔄', name: 'Remontada', desc: 'Gagner après avoir perdu le 1er set' },
  { id: 'bagel', icon: '🥯', name: 'Bagel', desc: 'Gagner un set 6-0' },
  { id: 'bagelRecu', icon: '🍩', name: 'Bagel encaissé', desc: 'Perdre un set 6-0' },
  { id: 'tiebreak', icon: '🧊', name: 'Nerfs d\'acier', desc: 'Gagner un set au tie-break (7-6)' },
  { id: 'demolition', icon: '💥', name: 'Démolition', desc: 'Gagner 2-0 en laissant 4 jeux ou moins' },
  { id: 'enFeu', icon: '🔥', name: 'En feu', desc: '3 victoires de suite' },
  { id: 'inarretable', icon: '⚡', name: 'Inarrêtable', desc: '5 victoires de suite' },
  { id: 'mvp', icon: '⭐', name: 'MVP', desc: 'Élu MVP d\'un match' },
  { id: 'nostradamus', icon: '🔮', name: 'Nostradamus', desc: 'Pronostiquer le score exact' },
  { id: 'lucide', icon: '🙃', name: 'Lucide', desc: 'Parier sur sa propre défaite... et avoir raison' },
];

// Badges gagnés dans un match précis : { playerId: [badgeId, ...] }.
// Les séries (En feu, Inarrêtable) sont calculées dans computeStats.
export function matchBadges(match, playerIds) {
  const out = {};
  const add = (p, b) => { (out[p] = out[p] || []).push(b); };
  const sets = match.sets;
  const win = matchWinner(sets);
  const lose = win === 'a' ? 'b' : 'a';
  const winners = win === 'a' ? match.teamA : match.teamB;
  const losers = win === 'a' ? match.teamB : match.teamA;

  if (setWinner(sets[0]) !== win) winners.forEach((p) => add(p, 'remontada'));
  if (sets.length === 2 && sets[0][lose] + sets[1][lose] <= 4) winners.forEach((p) => add(p, 'demolition'));
  for (const s of sets) {
    const sw = setWinner(s);
    const sl = sw === 'a' ? 'b' : 'a';
    const swTeam = sw === 'a' ? match.teamA : match.teamB;
    const slTeam = sw === 'a' ? match.teamB : match.teamA;
    if (s[sl] === 0) {
      swTeam.forEach((p) => add(p, 'bagel'));
      slTeam.forEach((p) => add(p, 'bagelRecu'));
    }
    if (s[sw] === 7 && s[sl] === 6) swTeam.forEach((p) => add(p, 'tiebreak'));
  }
  mvpOf(match).forEach((p) => add(p, 'mvp'));
  for (const p of playerIds) {
    const bet = match.bets && match.bets[p] && match.bets[p].sets;
    if (!bet) continue;
    if (betPoints(bet, sets).detail.exact) add(p, 'nostradamus');
    const myTeam = teamOf(match, p);
    if (myTeam && matchWinner(bet) !== myTeam && losers.includes(p)) add(p, 'lucide');
  }
  return out;
}

function pairKey(x, y) {
  return [x, y].sort().join('|');
}

// Toutes les statistiques à partir de la liste des matchs.
export function computeStats(matches, playerIds) {
  const done = doneMatches(matches);
  const players = {};
  for (const p of playerIds) {
    players[p] = {
      played: 0, wins: 0, losses: 0, setsWon: 0, setsLost: 0, gamesWon: 0, gamesLost: 0,
      streak: 0, bestStreak: 0, worstStreak: 0, lossStreak: 0,
      betPoints: 0, bets: 0, exactBets: 0, mvp: 0, badges: {},
    };
  }
  const duos = {};
  const h2h = {};
  const series = { wins: {}, bets: {} };
  for (const p of playerIds) {
    series.wins[p] = [0];
    series.bets[p] = [0];
  }
  const labels = [''];
  const addBadge = (p, b) => { players[p].badges[b] = (players[p].badges[b] || 0) + 1; };

  for (const m of done) {
    const win = matchWinner(m.sets);
    const winners = win === 'a' ? m.teamA : m.teamB;
    for (const p of playerIds) {
      const team = teamOf(m, p);
      const st = players[p];
      if (team) {
        st.played++;
        const won = team === win;
        const other = team === 'a' ? 'b' : 'a';
        for (const s of m.sets) {
          st.gamesWon += s[team];
          st.gamesLost += s[other];
          if (setWinner(s) === team) st.setsWon++; else st.setsLost++;
        }
        if (won) {
          st.wins++;
          st.streak++;
          st.lossStreak = 0;
          st.bestStreak = Math.max(st.bestStreak, st.streak);
          if (st.streak === 3) addBadge(p, 'enFeu');
          if (st.streak === 5) addBadge(p, 'inarretable');
        } else {
          st.losses++;
          st.lossStreak++;
          st.streak = 0;
          st.worstStreak = Math.max(st.worstStreak, st.lossStreak);
        }
      }
      const bet = m.bets && m.bets[p] && m.bets[p].sets;
      if (bet) {
        const r = betPoints(bet, m.sets);
        st.bets++;
        st.betPoints += r.total;
        if (r.detail.exact) st.exactBets++;
      }
      series.wins[p].push(st.wins);
      series.bets[p].push(st.betPoints);
    }
    labels.push(m.date);

    const mb = matchBadges(m, playerIds);
    for (const p of Object.keys(mb)) {
      for (const b of mb[p]) {
        addBadge(p, b);
        if (b === 'mvp') players[p].mvp++;
      }
    }

    for (const team of [m.teamA, m.teamB]) {
      const k = pairKey(team[0], team[1]);
      duos[k] = duos[k] || { players: [...team].sort(), played: 0, wins: 0 };
      duos[k].played++;
      if (team === winners) duos[k].wins++;
    }
    for (const x of m.teamA) {
      for (const y of m.teamB) {
        const k = pairKey(x, y);
        h2h[k] = h2h[k] || { players: [x, y].sort(), played: 0, wins: {} };
        h2h[k].played++;
        for (const w of winners) {
          if (w === x || w === y) h2h[k].wins[w] = (h2h[k].wins[w] || 0) + 1;
        }
      }
    }
  }

  const duoList = Object.values(duos)
    .map((d) => ({ ...d, rate: d.wins / d.played }))
    .sort((x, y) => y.rate - x.rate || y.played - x.played);

  return { done, players, duos: duoList, h2h: Object.values(h2h), series, labels };
}
