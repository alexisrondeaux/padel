// Tests des règles : node padel/tests.mjs
import assert from 'node:assert/strict';
import { scoreError, betPoints, matchBadges, computeStats, matchWinner } from './scoring.js';

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

console.log('Tous les tests passent.');
