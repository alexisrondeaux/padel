// Tests des règles : node padel/tests.mjs
import assert from 'node:assert/strict';
import { scoreError, betPoints, matchBadges, computeStats, matchWinner, winProbability } from './scoring.js';

const S = (...p) => p.map(([a, b]) => ({ a, b }));

// Scores valides / invalides
assert.equal(scoreError(S([6, 4], [6, 3])), null);
assert.equal(scoreError(S([6, 4], [3, 6], [7, 5])), null);
assert.equal(scoreError(S([7, 6], [6, 7], [6, 2])), null);
assert.equal(scoreError(S([6, 4], [6, 7], [10, 8])), null);
assert.ok(scoreError(S([6, 5], [6, 3])));
assert.ok(scoreError(S([6, 4], [3, 6])));
assert.ok(scoreError(S([6, 4], [6, 3], [6, 1])));
assert.ok(scoreError(S([8, 6], [6, 3])));

// Exemple donné : réel 6-4 6-3, pari 6-3 6-3 => 5 + 2 + 2 + 3 = 12
assert.equal(betPoints(S([6, 3], [6, 3]), S([6, 4], [6, 3])).total, 12);
// Score exact 2 sets : 5 + 2 + 3 + 3 + 5 = 18
assert.equal(betPoints(S([6, 4], [6, 3]), S([6, 4], [6, 3])).total, 18);
// Mauvais vainqueur, mauvais nombre de sets
assert.equal(betPoints(S([0, 6], [0, 6]), S([6, 4], [3, 6], [6, 0])).total, 0);
assert.equal(matchWinner(S([6, 4], [3, 6], [7, 5])), 'a');

// Badges
const m = {
  status: 'done', date: '2026-11-01', teamA: ['dimitri', 'alexis'], teamB: ['papa', 'maman'],
  sets: S([4, 6], [6, 0], [7, 6]),
  bets: { alexis: { sets: S([4, 6], [6, 0], [7, 6]) }, papa: { sets: S([6, 2], [6, 2]) }, maman: { sets: S([2, 6], [2, 6]) } },
  mvp: { papa: 'alexis', maman: 'alexis', dimitri: 'alexis', alexis: 'dimitri' },
};
const ids = ['alexis', 'dimitri', 'papa', 'maman'];
const b = matchBadges(m, ids);
assert.deepEqual(b.alexis.sort(), ['bagel', 'mvp', 'nostradamus', 'remontada', 'tiebreak']);
assert.deepEqual(b.papa.sort(), ['bagelRecu', 'lucide']);
assert.deepEqual(b.maman, ['bagelRecu']);

// Stats et séries
const mk = (date, sets, teamA = ['dimitri', 'alexis'], teamB = ['papa', 'maman']) => ({ status: 'done', date, teamA, teamB, sets: S(...sets) });
const list = [
  mk('2026-10-01', [[6, 1], [6, 2]]),
  mk('2026-10-08', [[6, 1], [6, 2]]),
  mk('2026-10-15', [[6, 1], [6, 2]], ['alexis', 'papa'], ['dimitri', 'maman']),
  mk('2026-10-22', [[1, 6], [2, 6]]),
  { status: 'open', date: '2026-10-29', teamA: ['dimitri', 'alexis'], teamB: ['papa', 'maman'] },
];
const st = computeStats(list, ids);
assert.equal(st.done.length, 4);
assert.equal(st.players.alexis.wins, 3);
assert.equal(st.players.alexis.bestStreak, 3);
assert.equal(st.players.alexis.streak, 0);
assert.equal(st.players.alexis.badges.enFeu, 1);
assert.equal(st.players.maman.worstStreak, 3);
assert.equal(st.series.wins.alexis.join(','), '0,1,2,3,3');
const duo = st.duos.find((d) => d.players.join() === 'alexis,dimitri');
assert.deepEqual([duo.played, duo.wins], [3, 2]);

// Niveau Elo : à niveau égal, le gagnant prend 16 points, la somme reste à 4000
assert.equal(st.series.elo.alexis[1], 1016);
assert.equal(st.series.elo.papa[1], 984);
assert.equal(ids.reduce((t, p) => t + st.players[p].elo, 0), 4000);
assert.equal(winProbability(['a', 'b'], ['c', 'd'], { a: 1000, b: 1000, c: 1000, d: 1000 }), 0.5);
assert.ok(winProbability(['a', 'b'], ['c', 'd'], { a: 1100, b: 1100, c: 1000, d: 1000 }) > 0.6);
// Battre plus fort que soi rapporte plus : la 4e victoire (Papa & Maman, plus faibles) vaut plus de 16
assert.ok(st.players.papa.eloDelta > 16);
assert.equal(st.players.alexis.peakElo, Math.max(...st.series.elo.alexis));

// Forme : les 5 derniers résultats
assert.deepEqual(st.players.alexis.form, ['V', 'V', 'V', 'D']);
assert.deepEqual(st.players.maman.form, ['D', 'D', 'D', 'V']);

// Records
assert.equal(st.records.bigWin.value, 9);
assert.equal(st.records.bigWin.match.date, '2026-10-01');
assert.equal(st.records.longest.value, 15);
assert.equal(st.records.remontada, null);
assert.deepEqual(st.records.streak, { value: 3, players: ['alexis'] });
const st2 = computeStats([m], ids);
assert.equal(st2.records.remontada.value, 2);
assert.equal(st2.records.bestBet.player, 'alexis');
assert.equal(st2.records.bestBet.points, 5 + 2 + 9 + 5);

console.log('Tous les tests passent.');
