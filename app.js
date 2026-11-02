// Interface de l'app : écrans Match, Historique, Classement, Stats.
import { PLAYERS, DEFAULT_TEAMS } from './config.js';
import { createStore } from './store.js';
import {
  scoreError, matchWinner, formatScore, betPoints, computeStats, matchBadges,
  mvpOf, setWinner, BADGES,
} from './scoring.js';

const IDS = PLAYERS.map((p) => p.id);
const P = Object.fromEntries(PLAYERS.map((p) => [p.id, p]));
const BADGE = Object.fromEntries(BADGES.map((b) => [b.id, b]));

const state = {
  store: null,
  matches: [],
  loaded: false,
  me: safeGet('padel-me'),
  tab: safeGet('padel-tab') || 'match',
  chart: 'wins',
  modal: null, // { type: 'who' } | { type: 'match', id, editing }
  drafts: {},
};

// ---------- Utilitaires ----------
function safeGet(k) {
  try { return localStorage.getItem(k); } catch (e) { return null; }
}
function safeSet(k, v) {
  try { localStorage.setItem(k, v); } catch (e) { /* ignore */ }
}
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const name = (id) => esc(P[id] ? P[id].name : id);
const team = (ids) => ids.map(name).join(' & ');
const dot = (id) => `<span class="dot" style="background:${P[id] ? P[id].color : '#888'}"></span>`;
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
function fmtDate(iso, long) {
  const [y, m, d] = iso.split('-').map(Number);
  const opts = long ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' } : { weekday: 'short', day: 'numeric', month: 'short' };
  return new Date(y, m - 1, d).toLocaleDateString('fr-FR', opts);
}
const pct = (x) => `${Math.round(x * 100)} %`;

let toastTimer;
function toast(msg, isError) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast${isError ? ' error' : ''}`;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
}

async function save(promise, okMsg) {
  try {
    await promise;
    if (okMsg) toast(okMsg);
    return true;
  } catch (e) {
    console.error(e);
    toast('Erreur : pas enregistré. Vérifie la connexion.', true);
    return false;
  }
}

// ---------- Saisie des scores (brouillons) ----------
function emptySets() {
  return [{ a: null, b: null }, { a: null, b: null }, { a: null, b: null }];
}
function draft(key, init) {
  if (!state.drafts[key]) state.drafts[key] = init();
  return state.drafts[key];
}
function needsThird(sets) {
  const [s0, s1] = sets;
  if ([s0.a, s0.b, s1.a, s1.b].some((v) => v === null) || s0.a === s0.b || s1.a === s1.b) return false;
  return setWinner(s0) !== setWinner(s1);
}
function draftToSets(sets) {
  const n = needsThird(sets) ? 3 : 2;
  const out = sets.slice(0, n);
  if (out.some((s) => s.a === null || s.b === null)) return { error: 'Choisis le score de chaque set.' };
  const clean = out.map((s) => ({ a: s.a, b: s.b }));
  const error = scoreError(clean);
  return error ? { error } : { sets: clean };
}
function setsToDraft(sets) {
  const d = emptySets();
  (sets || []).forEach((s, i) => { d[i] = { a: s.a, b: s.b }; });
  return d;
}

function scoreEditor(key, sets, teamA, teamB) {
  const rows = needsThird(sets) ? 3 : 2;
  const select = (i, side) => {
    const max = i === 2 ? 12 : 7;
    const v = sets[i][side];
    let opts = `<option value=""${v === null ? ' selected' : ''}>-</option>`;
    for (let n = 0; n <= max; n++) opts += `<option value="${n}"${v === n ? ' selected' : ''}>${n}</option>`;
    return `<select class="games" data-draft="${key}" data-set="${i}" data-side="${side}" aria-label="Set ${i + 1}, jeux ${side === 'a' ? team(teamA) : team(teamB)}">${opts}</select>`;
  };
  let html = `<div class="score-editor">
    <div class="se-row se-head"><span></span><span>${team(teamA)}</span><span>${team(teamB)}</span></div>`;
  for (let i = 0; i < rows; i++) {
    html += `<div class="se-row"><span class="se-label">Set ${i + 1}</span>${select(i, 'a')}${select(i, 'b')}</div>`;
  }
  html += '</div>';
  if (rows === 2) html += '<p class="hint">Le 3e set apparaît si les équipes gagnent un set chacune. Tie-break à 6-6 = 7-6.</p>';
  return html;
}

function scoreLine(sets, teamA, teamB) {
  const w = matchWinner(sets);
  return `<div class="scoreline">
    <div class="sl-team${w === 'a' ? ' win' : ''}"><span>${team(teamA)}</span>${sets.map((s) => `<b class="${s.a > s.b ? 'w' : ''}">${s.a}</b>`).join('')}</div>
    <div class="sl-team${w === 'b' ? ' win' : ''}"><span>${team(teamB)}</span>${sets.map((s) => `<b class="${s.b > s.a ? 'w' : ''}">${s.b}</b>`).join('')}</div>
  </div>`;
}

function betSummary(m, sets) {
  const w = matchWinner(sets) === 'a' ? m.teamA : m.teamB;
  return `<span class="bet-score">${formatScore(sets)}</span> <span class="muted">→ ${team(w)}</span>`;
}

// ---------- Écran Match ----------
function currentMatch() {
  return state.matches
    .filter((m) => m.status !== 'done')
    .sort((x, y) => (y.createdAt || 0) - (x.createdAt || 0))[0];
}

function viewMatch() {
  const cur = currentMatch();
  if (cur) return viewCurrent(cur);
  const last = computeStats(state.matches, IDS).done.slice(-1)[0];
  return (last ? viewLastResult(last) : '') + viewNewMatch();
}

function matchHeader(m, pill) {
  return `<div class="match-head">
    <div><div class="kicker">${fmtDate(m.date, true)}</div>
    <h2>${team(m.teamA)} <span class="vs">vs</span> ${team(m.teamB)}</h2></div>
    ${pill ? `<span class="pill">${pill}</span>` : ''}
  </div>`;
}

function viewCurrent(m) {
  const bets = m.bets || {};
  let html = `<section class="card">${matchHeader(m, m.status === 'open' ? 'Paris ouverts' : 'Match en cours')}`;
  if (m.status === 'open') {
    const mine = bets[state.me];
    const d = draft(`bet-${m.id}`, () => ({ sets: setsToDraft(mine && mine.sets), editing: !mine }));
    html += '<h3>Ton pronostic</h3>';
    if (mine && !d.editing) {
      html += `<p class="my-bet">${betSummary(m, mine.sets)}</p>
        <button class="btn ghost" data-action="edit-bet" data-id="${m.id}">Modifier mon pari</button>`;
    } else {
      html += `${scoreEditor(`bet-${m.id}`, d.sets, m.teamA, m.teamB)}
        <button class="btn primary" data-action="save-bet" data-id="${m.id}">Valider mon pari</button>`;
    }
    html += `<h3>Qui a parié ?</h3><ul class="who-bet">${IDS.map((p) => `<li>${dot(p)}${name(p)}<span>${bets[p] ? '✅ a parié' : '⏳ pas encore'}</span></li>`).join('')}</ul>
      <p class="hint">Les paris des autres restent cachés jusqu'au début du match.</p>
      <button class="btn primary" data-action="lock" data-id="${m.id}">Fermer les paris et lancer le match</button>`;
  } else {
    const d = draft(`score-${m.id}`, () => ({ sets: emptySets() }));
    html += `<h3>Les pronostics</h3>${betsList(m)}
      <h3>Score final</h3>${scoreEditor(`score-${m.id}`, d.sets, m.teamA, m.teamB)}
      <button class="btn primary" data-action="save-score" data-id="${m.id}">Enregistrer le score</button>`;
  }
  html += `<button class="btn link danger" data-action="delete" data-id="${m.id}">Annuler ce match</button></section>`;
  return html;
}

function betsList(m) {
  const bets = m.bets || {};
  const ids = IDS.filter((p) => bets[p]);
  if (!ids.length) return '<p class="muted">Personne n\'a parié.</p>';
  const rows = ids.map((p) => {
    const r = m.sets ? betPoints(bets[p].sets, m.sets) : null;
    const detail = r ? `vainqueur ${r.detail.winner}, nb de sets ${r.detail.setCount}, sets ${r.detail.sets.join(' + ') || 0}${r.detail.exact ? ', exact +5' : ''}` : '';
    return { p, r, html: `<li>${dot(p)}<div class="grow"><b>${name(p)}</b><div>${betSummary(m, bets[p].sets)}</div>${r ? `<div class="tiny muted">${detail}</div>` : ''}</div>${r ? `<span class="pts">${r.total} pts</span>` : ''}</li>` };
  });
  if (m.sets) rows.sort((x, y) => y.r.total - x.r.total);
  return `<ul class="bets">${rows.map((r) => r.html).join('')}</ul>`;
}

function mvpBlock(m) {
  const votes = m.mvp || {};
  const players = [...m.teamA, ...m.teamB];
  const winners = mvpOf(m);
  let html = '<h3>MVP du match</h3>';
  if (winners.length) html += `<p class="mvp-win">⭐ ${winners.map(name).join(' et ')}</p>`;
  if (state.me && IDS.includes(state.me)) {
    const my = votes[state.me];
    html += `<p class="tiny muted">${my ? 'Ton vote (tu peux le changer) :' : 'Vote pour le meilleur joueur (pas toi-même) :'}</p>
      <div class="chips">${players.filter((p) => p !== state.me).map((p) => `<button class="chip${my === p ? ' on' : ''}" data-action="mvp" data-id="${m.id}" data-player="${p}">${dot(p)}${name(p)}</button>`).join('')}</div>`;
  }
  const voters = IDS.filter((p) => votes[p]);
  if (voters.length) html += `<p class="tiny muted">Votes : ${voters.map((v) => `${name(v)} → ${name(votes[v])}`).join(', ')}</p>`;
  return html;
}

function badgesOfMatch(m) {
  const b = matchBadges(m, IDS);
  const items = Object.entries(b).flatMap(([p, list]) => list.map((id) => `<li>${BADGE[id].icon} <b>${BADGE[id].name}</b> ${name(p)}</li>`));
  return items.length ? `<h3>Badges gagnés</h3><ul class="badge-list">${items.join('')}</ul>` : '';
}

function viewLastResult(m) {
  return `<section class="card">${matchHeader(m, 'Dernier match')}
    ${scoreLine(m.sets, m.teamA, m.teamB)}
    <h3>Pronostics</h3>${betsList(m)}
    ${mvpBlock(m)}
    <button class="btn ghost" data-action="open" data-id="${m.id}">Voir le détail</button>
  </section>`;
}

function viewNewMatch() {
  const d = draft('new', () => ({ date: today(), a: [...DEFAULT_TEAMS.a], played: false, sets: emptySets() }));
  const b = IDS.filter((p) => !d.a.includes(p));
  const rows = IDS.map((p) => {
    const inA = d.a.includes(p);
    return `<div class="team-row">${dot(p)}<span class="grow">${name(p)}</span>
      <div class="seg" role="group" aria-label="Équipe de ${name(p)}">
        <button class="${inA ? 'on' : ''}" data-action="team" data-player="${p}" data-team="a" aria-pressed="${inA}">Équipe 1</button>
        <button class="${!inA ? 'on' : ''}" data-action="team" data-player="${p}" data-team="b" aria-pressed="${!inA}">Équipe 2</button>
      </div></div>`;
  }).join('');
  const ok = d.a.length === 2;
  return `<section class="card">
    <h2>Nouveau match</h2>
    <label class="field">Date <input type="date" value="${d.date}" data-field="new-date"></label>
    <h3>Équipes</h3>${rows}
    <div class="row-btns">
      <button class="btn ghost small" data-action="shuffle">🎲 Mélanger</button>
      <button class="btn ghost small" data-action="default-teams">Équipes habituelles</button>
    </div>
    ${ok ? `<p class="teams-preview">${team(d.a)} <span class="vs">vs</span> ${team(b)}</p>` : '<p class="error-text">Il faut 2 joueurs dans chaque équipe.</p>'}
    <label class="check"><input type="checkbox" data-field="new-played" ${d.played ? 'checked' : ''}> Match déjà joué (saisir le score directement, sans paris)</label>
    ${d.played && ok ? scoreEditor('new', d.sets, d.a, b) : ''}
    <button class="btn primary" data-action="create" ${ok ? '' : 'disabled'}>${d.played ? 'Enregistrer le match' : 'Créer le match et ouvrir les paris'}</button>
  </section>`;
}

// ---------- Historique ----------
function viewHistory() {
  const done = computeStats(state.matches, IDS).done.slice().reverse();
  if (!done.length) return '<section class="card empty"><p>Aucun match pour l\'instant.</p></section>';
  return `<h2 class="page-title">Historique <span class="muted">(${done.length} matchs)</span></h2>${done.map((m) => {
    const mvp = mvpOf(m);
    return `<button class="card match-item" data-action="open" data-id="${m.id}">
      <div class="kicker">${fmtDate(m.date)}${mvp.length ? ` · ⭐ ${mvp.map(name).join(', ')}` : ''}</div>
      ${scoreLine(m.sets, m.teamA, m.teamB)}
    </button>`;
  }).join('')}`;
}

function viewMatchModal(m) {
  const editing = state.modal.editing;
  let html = `<div class="sheet" role="dialog" aria-modal="true" aria-label="Détail du match">
    <button class="close" data-action="close" aria-label="Fermer">✕</button>
    ${matchHeader(m)}`;
  if (editing) {
    const d = draft(`edit-${m.id}`, () => ({ sets: setsToDraft(m.sets) }));
    html += `<h3>Corriger le score</h3>${scoreEditor(`edit-${m.id}`, d.sets, m.teamA, m.teamB)}
      <button class="btn primary" data-action="save-edit" data-id="${m.id}">Enregistrer</button>
      <button class="btn ghost" data-action="cancel-edit">Annuler</button>`;
  } else {
    html += `${scoreLine(m.sets, m.teamA, m.teamB)}
      <h3>Pronostics</h3>${betsList(m)}
      ${mvpBlock(m)}
      ${badgesOfMatch(m)}
      <div class="row-btns">
        <button class="btn ghost small" data-action="edit-score">Corriger le score</button>
        <button class="btn link danger" data-action="delete" data-id="${m.id}">Supprimer le match</button>
      </div>`;
  }
  return `${html}</div>`;
}

// ---------- Classement ----------
function viewRanking() {
  const st = computeStats(state.matches, IDS);
  const pl = st.players;
  const byWins = [...IDS].sort((x, y) => pl[y].wins - pl[x].wins || (pl[y].wins / (pl[y].played || 1)) - (pl[x].wins / (pl[x].played || 1)));
  const byBets = [...IDS].sort((x, y) => pl[y].betPoints - pl[x].betPoints || pl[y].exactBets - pl[x].exactBets);
  const medal = (i) => ['🥇', '🥈', '🥉'][i] || `${i + 1}.`;
  const streak = (s) => (s.streak ? `🔥 ${s.streak} V` : s.lossStreak ? `❄️ ${s.lossStreak} D` : '-');
  return `<h2 class="page-title">Classement</h2>
  <section class="card">
    <h3>Matchs</h3>
    <table class="table"><thead><tr><th></th><th>Joueur</th><th>V</th><th>D</th><th>%</th><th>⭐</th><th>Série</th></tr></thead><tbody>
    ${byWins.map((p, i) => `<tr><td>${medal(i)}</td><td>${dot(p)}${name(p)}</td><td><b>${pl[p].wins}</b></td><td>${pl[p].losses}</td><td>${pl[p].played ? pct(pl[p].wins / pl[p].played) : '-'}</td><td>${pl[p].mvp}</td><td class="nowrap">${streak(pl[p])}</td></tr>`).join('')}
    </tbody></table>
    <p class="tiny muted">V victoires, D défaites, ⭐ titres de MVP.</p>
  </section>
  <section class="card">
    <h3>Pronostics</h3>
    <table class="table"><thead><tr><th></th><th>Joueur</th><th>Pts</th><th>Paris</th><th>Moy.</th><th>🔮</th></tr></thead><tbody>
    ${byBets.map((p, i) => `<tr><td>${medal(i)}</td><td>${dot(p)}${name(p)}</td><td><b>${pl[p].betPoints}</b></td><td>${pl[p].bets}</td><td>${pl[p].bets ? (pl[p].betPoints / pl[p].bets).toFixed(1) : '-'}</td><td>${pl[p].exactBets}</td></tr>`).join('')}
    </tbody></table>
    <p class="tiny muted">🔮 scores exacts trouvés.</p>
    <details class="rules"><summary>Le barème des paris</summary>
      <ul>
        <li>Bon vainqueur : <b>+5</b></li>
        <li>Bon nombre de sets (2-0 ou 2-1) : <b>+2</b></li>
        <li>Chaque set : <b>+3</b>, moins 1 par jeu d'écart (minimum 0)</li>
        <li>Score exact : bonus <b>+5</b></li>
      </ul>
      <p class="tiny">Exemple : score 6-4 6-3, pari 6-3 6-3 = 5 + 2 + 2 + 3 = 12 points.</p>
    </details>
  </section>`;
}

// ---------- Stats ----------
function chart(st) {
  const data = state.chart === 'wins' ? st.series.wins : st.series.bets;
  const n = st.labels.length - 1;
  if (n < 1) return '<p class="muted">Le graphique apparaîtra après le premier match.</p>';
  const W = 340; const H = 190; const L = 30; const R = 10; const T = 10; const B = 26;
  const max = Math.max(1, ...IDS.map((p) => data[p][n]));
  const x = (i) => L + (i / n) * (W - L - R);
  const y = (v) => T + (1 - v / max) * (H - T - B);
  const step = Math.max(1, Math.ceil(max / 4));
  let grid = '';
  for (let v = 0; v <= max; v += step) {
    grid += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${L - 6}" y="${y(v) + 4}" class="axis" text-anchor="end">${v}</text>`;
  }
  const first = st.labels[1]; const last = st.labels[n];
  grid += `<text x="${x(0)}" y="${H - 6}" class="axis">Début</text><text x="${W - R}" y="${H - 6}" class="axis" text-anchor="end">${fmtDate(last)}</text>`;
  const lines = IDS.map((p) => {
    const pts = data[p].map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    return `<polyline points="${pts}" fill="none" stroke="${P[p].color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
      <circle cx="${x(n)}" cy="${y(data[p][n])}" r="4" fill="${P[p].color}"/>`;
  }).join('');
  const legend = [...IDS].sort((a, b) => data[b][n] - data[a][n])
    .map((p) => `<li>${dot(p)}${name(p)} <b>${data[p][n]}</b></li>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Évolution depuis le ${first ? fmtDate(first) : 'début'}">${grid}${lines}</svg>
    <ul class="legend">${legend}</ul>`;
}

function viewStats() {
  const st = computeStats(state.matches, IDS);
  const pl = st.players;
  if (!st.done.length) return '<section class="card empty"><p>Les stats apparaîtront après le premier match.</p></section>';
  const duos = st.duos.map((d, i) => `<li>
      <div class="grow"><b>${i === 0 ? '👑 ' : ''}${d.players.map(name).join(' & ')}</b>
      <div class="bar"><span style="width:${Math.round(d.rate * 100)}%"></span></div></div>
      <span class="nowrap">${d.wins}/${d.played} · ${pct(d.rate)}</span></li>`).join('');
  const h2h = st.h2h.sort((x, y) => y.played - x.played).map((h) => {
    const [x, y] = h.players;
    const wx = h.wins[x] || 0; const wy = h.wins[y] || 0;
    return `<li><span class="${wx > wy ? 'lead' : ''}">${dot(x)}${name(x)}</span><b class="h2h-score">${wx} - ${wy}</b><span class="${wy > wx ? 'lead' : ''}">${name(y)}${dot(y)}</span></li>`;
  }).join('');
  const streaks = IDS.map((p) => `<li>${dot(p)}<span class="grow">${name(p)}</span>
      <span>${pl[p].streak ? `🔥 ${pl[p].streak} victoire${pl[p].streak > 1 ? 's' : ''}` : pl[p].lossStreak ? `❄️ ${pl[p].lossStreak} défaite${pl[p].lossStreak > 1 ? 's' : ''}` : '-'}</span>
      <span class="muted nowrap">record ${pl[p].bestStreak}</span></li>`).join('');
  const games = IDS.map((p) => `<li>${dot(p)}<span class="grow">${name(p)}</span><span class="nowrap">sets ${pl[p].setsWon}-${pl[p].setsLost}</span><span class="muted nowrap">jeux ${pl[p].gamesWon}-${pl[p].gamesLost}</span></li>`).join('');
  const badges = IDS.map((p) => {
    const own = BADGES.filter((b) => pl[p].badges[b.id]);
    return `<li><div>${dot(p)}<b>${name(p)}</b></div><div class="badges">${own.length ? own.map((b) => `<span class="badge" title="${esc(b.desc)}">${b.icon} ${b.name}${pl[p].badges[b.id] > 1 ? ` <b>×${pl[p].badges[b.id]}</b>` : ''}</span>`).join('') : '<span class="muted tiny">Pas encore de badge</span>'}</div></li>`;
  }).join('');
  return `<h2 class="page-title">Stats</h2>
  <section class="card">
    <div class="seg wide" role="group" aria-label="Choix du graphique">
      <button class="${state.chart === 'wins' ? 'on' : ''}" data-action="chart" data-chart="wins">Victoires</button>
      <button class="${state.chart === 'bets' ? 'on' : ''}" data-action="chart" data-chart="bets">Points de paris</button>
    </div>
    ${chart(st)}
  </section>
  <section class="card"><h3>Meilleur duo</h3><ul class="list">${duos}</ul></section>
  <section class="card"><h3>Face-à-face</h3><p class="tiny muted">Victoires quand ils jouent l'un contre l'autre.</p><ul class="list h2h">${h2h}</ul></section>
  <section class="card"><h3>Séries en cours</h3><ul class="list">${streaks}</ul></section>
  <section class="card"><h3>Sets et jeux</h3><ul class="list">${games}</ul></section>
  <section class="card"><h3>Badges</h3><ul class="list badge-players">${badges}</ul>
    <details class="rules"><summary>Comment gagner les badges</summary>
      <ul>${BADGES.map((b) => `<li>${b.icon} <b>${b.name}</b> : ${b.desc}</li>`).join('')}</ul>
    </details>
  </section>`;
}

// ---------- Choix du joueur ----------
function viewWho() {
  return `<div class="sheet" role="dialog" aria-modal="true" aria-label="Qui es-tu ?">
    ${state.me ? '<button class="close" data-action="close" aria-label="Fermer">✕</button>' : ''}
    <h2>Qui es-tu ?</h2>
    <p class="muted">Pour savoir qui parie et qui vote. C'est retenu sur ce téléphone.</p>
    <div class="who-grid">${IDS.map((p) => `<button class="who-btn${state.me === p ? ' on' : ''}" data-action="set-me" data-player="${p}">${dot(p)}${name(p)}</button>`).join('')}</div>
    <div class="footer-tools">
      <p class="tiny muted">${state.store && state.store.mode === 'firebase' ? '☁️ Données partagées en ligne' : '⚠️ Mode test : les données restent sur ce téléphone'}</p>
      <button class="btn ghost small" data-action="export">Télécharger une sauvegarde</button>
    </div>
  </div>`;
}

// ---------- Rendu ----------
function render() {
  const app = document.getElementById('app');
  const chip = document.getElementById('me-chip');
  chip.innerHTML = state.me ? `${dot(state.me)}${name(state.me)}` : 'Qui es-tu ?';
  document.querySelectorAll('.tabbar button').forEach((b) => {
    b.classList.toggle('on', b.dataset.tab === state.tab);
    if (b.dataset.tab === state.tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  if (state.loaded) {
    const banner = state.store.mode === 'local'
      ? '<p class="banner">⚠️ Mode test : les données restent sur ce téléphone tant que Firebase n\'est pas branché.</p>' : '';
    const views = { match: viewMatch, history: viewHistory, ranking: viewRanking, stats: viewStats };
    app.innerHTML = banner + (views[state.tab] || viewMatch)();
  }
  renderModal();
}

function renderModal() {
  const el = document.getElementById('modal');
  let html = '';
  if (!state.me || (state.modal && state.modal.type === 'who')) html = viewWho();
  else if (state.modal && state.modal.type === 'match') {
    const m = state.matches.find((x) => x.id === state.modal.id);
    if (m && m.status === 'done') html = viewMatchModal(m);
    else state.modal = null;
  }
  el.hidden = !html;
  el.innerHTML = html;
  document.body.classList.toggle('no-scroll', !!html);
}

// ---------- Actions ----------
const actions = {
  who() { state.modal = { type: 'who' }; render(); },
  close() { state.modal = null; render(); },
  'set-me'(el) {
    state.me = el.dataset.player;
    safeSet('padel-me', state.me);
    state.modal = null;
    render();
  },
  chart(el) { state.chart = el.dataset.chart; render(); },
  open(el) { state.modal = { type: 'match', id: el.dataset.id }; render(); },
  'edit-score'() { state.modal.editing = true; delete state.drafts[`edit-${state.modal.id}`]; render(); },
  'cancel-edit'() { state.modal.editing = false; render(); },
  async 'save-edit'(el) {
    const r = draftToSets(state.drafts[`edit-${el.dataset.id}`].sets);
    if (r.error) return toast(r.error, true);
    if (await save(state.store.update(el.dataset.id, { sets: r.sets }), 'Score corrigé')) {
      state.modal.editing = false;
      render();
    }
  },
  'edit-bet'(el) { state.drafts[`bet-${el.dataset.id}`].editing = true; render(); },
  async 'save-bet'(el) {
    const id = el.dataset.id;
    const d = state.drafts[`bet-${id}`];
    const r = draftToSets(d.sets);
    if (r.error) return toast(r.error, true);
    const m = state.matches.find((x) => x.id === id);
    if (!m || m.status !== 'open') return toast('Les paris sont fermés.', true);
    if (await save(state.store.update(id, { [`bets.${state.me}`]: { sets: r.sets, at: Date.now() } }), 'Pari enregistré ✅')) {
      d.editing = false;
      render();
    }
  },
  async lock(el) {
    const m = state.matches.find((x) => x.id === el.dataset.id);
    const missing = IDS.filter((p) => !(m.bets && m.bets[p])).map((p) => P[p].name);
    const msg = missing.length ? `${missing.join(', ')} n'${missing.length > 1 ? 'ont' : 'a'} pas encore parié. Fermer les paris quand même ?` : 'Fermer les paris et lancer le match ?';
    if (!confirm(msg)) return;
    save(state.store.update(m.id, { status: 'locked' }), 'C\'est parti ! 🎾');
  },
  async 'save-score'(el) {
    const id = el.dataset.id;
    const r = draftToSets(state.drafts[`score-${id}`].sets);
    if (r.error) return toast(r.error, true);
    if (await save(state.store.update(id, { sets: r.sets, status: 'done' }), 'Score enregistré 🏆')) {
      delete state.drafts[`score-${id}`];
    }
  },
  async mvp(el) {
    save(state.store.update(el.dataset.id, { [`mvp.${state.me}`]: el.dataset.player }), 'Vote enregistré ⭐');
  },
  async delete(el) {
    const m = state.matches.find((x) => x.id === el.dataset.id);
    const txt = m.status === 'done' ? 'Supprimer définitivement ce match, ses paris et ses votes ?' : 'Annuler ce match ? Les paris seront perdus.';
    if (!confirm(txt)) return;
    state.modal = null;
    save(state.store.remove(m.id), 'Match supprimé');
  },
  team(el) {
    const d = state.drafts.new;
    const p = el.dataset.player;
    d.a = d.a.filter((x) => x !== p);
    if (el.dataset.team === 'a') {
      d.a.push(p);
      if (d.a.length > 2) d.a.shift();
    }
    render();
  },
  shuffle() {
    const ids = [...IDS];
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    state.drafts.new.a = ids.slice(0, 2);
    render();
  },
  'default-teams'() { state.drafts.new.a = [...DEFAULT_TEAMS.a]; render(); },
  async create() {
    const d = state.drafts.new;
    if (d.a.length !== 2) return;
    const teamA = [...d.a];
    const teamB = IDS.filter((p) => !teamA.includes(p));
    const data = { date: d.date || today(), createdAt: Date.now(), teamA, teamB, bets: {}, mvp: {} };
    if (d.played) {
      const r = draftToSets(d.sets);
      if (r.error) return toast(r.error, true);
      Object.assign(data, { status: 'done', sets: r.sets });
    } else {
      data.status = 'open';
    }
    if (await save(state.store.add(data), d.played ? 'Match enregistré' : 'Match créé : à vos paris ! 🎲')) {
      delete state.drafts.new;
      render();
    }
  },
  export() {
    const blob = new Blob([JSON.stringify(state.matches, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `padel-sauvegarde-${today()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },
};

document.addEventListener('click', (e) => {
  const tab = e.target.closest('[data-tab]');
  if (tab) {
    state.tab = tab.dataset.tab;
    safeSet('padel-tab', state.tab);
    render();
    window.scrollTo(0, 0);
    return;
  }
  const el = e.target.closest('[data-action]');
  if (el && actions[el.dataset.action]) actions[el.dataset.action](el);
  else if (e.target.id === 'modal' && state.me) actions.close();
});

document.addEventListener('change', (e) => {
  const el = e.target;
  if (el.matches('select.games')) {
    const d = state.drafts[el.dataset.draft];
    d.sets[Number(el.dataset.set)][el.dataset.side] = el.value === '' ? null : Number(el.value);
    render();
  } else if (el.dataset.field === 'new-date') {
    state.drafts.new.date = el.value;
  } else if (el.dataset.field === 'new-played') {
    state.drafts.new.played = el.checked;
    render();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && state.modal && state.me) actions.close();
});

// ---------- Démarrage ----------
(async function start() {
  render();
  state.store = await createStore();
  state.store.subscribe((list) => {
    state.matches = list;
    state.loaded = true;
    render();
  }, (err) => {
    console.error(err);
    toast('Impossible de lire les données (connexion ou règles Firebase).', true);
  });
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}());
