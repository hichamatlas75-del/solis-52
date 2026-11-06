/*
 * Solis 52 — moteur de règles (pur, sans DOM).
 * Utilisable dans le navigateur (window.SolisRules) et dans Node (require).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SolisRules = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SUITS = [
    { symbol: '♠', name: 'spades', color: 'black' },
    { symbol: '♥', name: 'hearts', color: 'red' },
    { symbol: '♣', name: 'clubs', color: 'black' },
    { symbol: '♦', name: 'diamonds', color: 'red' }
  ];
  const LABELS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const SUIT_INDEX = { '♠': 0, '♥': 1, '♣': 2, '♦': 3 };

  /* ---------- Aléatoire reproductible ---------- */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- Cartes ---------- */
  function makeCard(i) {
    const s = Math.floor(i / 13);
    const r = (i % 13) + 1;
    return {
      id: LABELS[r - 1] + SUITS[s].symbol,
      suit: SUITS[s].symbol,
      suitName: SUITS[s].name,
      color: SUITS[s].color,
      rank: r,
      label: LABELS[r - 1],
      faceUp: false
    };
  }

  function cardIndex(card) {
    return SUIT_INDEX[card.suit] * 13 + card.rank - 1;
  }

  function shuffledOrder(rand) {
    const order = Array.from({ length: 52 }, (_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    return order;
  }

  /* Distribue une donne à partir d'un ordre de 52 entiers (0..51). */
  function dealState(order, drawCount) {
    const deck = order.map(makeCard);
    const tableau = [[], [], [], [], [], [], []];
    for (let col = 0; col < 7; col++) {
      for (let row = 0; row <= col; row++) {
        const card = deck.pop();
        card.faceUp = row === col;
        tableau[col].push(card);
      }
    }
    return {
      stock: deck,
      waste: [],
      foundations: [[], [], [], []],
      tableau,
      drawCount: drawCount === 3 ? 3 : 1,
      score: 0,
      moves: 0,
      recycles: 0,
      won: false
    };
  }

  /* ---------- Règles ---------- */
  function canMoveToFoundation(state, card, idx) {
    const pile = state.foundations[idx];
    if (pile.length === 0) return card.rank === 1 && SUITS[idx].symbol === card.suit;
    const top = pile[pile.length - 1];
    return top.suit === card.suit && card.rank === top.rank + 1;
  }

  function canMoveToTableau(state, card, col) {
    const pile = state.tableau[col];
    if (pile.length === 0) return card.rank === 13;
    const top = pile[pile.length - 1];
    return top.faceUp && top.color !== card.color && top.rank === card.rank + 1;
  }

  function getMovingCards(state, source) {
    if (!source) return [];
    if (source.zone === 'waste') {
      return state.waste.length ? [state.waste[state.waste.length - 1]] : [];
    }
    if (source.zone === 'foundation') {
      const pile = state.foundations[source.col];
      return pile.length ? [pile[pile.length - 1]] : [];
    }
    if (source.zone === 'tableau') {
      const col = state.tableau[source.col];
      if (source.index < 0 || source.index >= col.length) return [];
      const slice = col.slice(source.index);
      return slice[0].faceUp ? slice : [];
    }
    return [];
  }

  function removeFromSource(state, source, count) {
    if (source.zone === 'waste') state.waste.pop();
    else if (source.zone === 'foundation') state.foundations[source.col].pop();
    else if (source.zone === 'tableau') state.tableau[source.col].splice(source.index, count);
  }

  function flipExposed(state, source) {
    if (source.zone !== 'tableau') return false;
    const col = state.tableau[source.col];
    if (col.length && !col[col.length - 1].faceUp) {
      col[col.length - 1].faceUp = true;
      state.score += 5;
      return true;
    }
    return false;
  }

  /* Applique un coup. Retourne null si illégal, sinon { cards, flipped }. */
  function applyMove(state, source, target) {
    const moving = getMovingCards(state, source);
    if (!moving.length) return null;
    const lead = moving[0];

    if (target.zone === 'foundation') {
      if (moving.length !== 1 || source.zone === 'foundation') return null;
      if (!canMoveToFoundation(state, lead, target.col)) return null;
      removeFromSource(state, source, 1);
      state.foundations[target.col].push(lead);
      state.score += 10;
      const flipped = flipExposed(state, source);
      state.moves++;
      return { cards: moving, flipped };
    }

    if (target.zone === 'tableau') {
      if (source.zone === 'tableau' && source.col === target.col) return null;
      if (!canMoveToTableau(state, lead, target.col)) return null;
      // Déplacer une colonne entière commençant par un Roi vers une colonne vide est inutile.
      if (source.zone === 'tableau' && source.index === 0 && state.tableau[target.col].length === 0) return null;
      removeFromSource(state, source, moving.length);
      state.tableau[target.col].push(...moving);
      if (source.zone === 'waste') state.score += 5;
      else if (source.zone === 'foundation') state.score = Math.max(0, state.score - 15);
      const flipped = flipExposed(state, source);
      state.moves++;
      return { cards: moving, flipped };
    }
    return null;
  }

  /* Pioche (ou recyclage). Retourne { type, count } ou null si rien à faire. */
  function drawFromStock(state) {
    if (state.stock.length) {
      const count = Math.min(state.drawCount, state.stock.length);
      for (let i = 0; i < count; i++) {
        const card = state.stock.pop();
        card.faceUp = true;
        state.waste.push(card);
      }
      state.moves++;
      return { type: 'draw', count };
    }
    if (state.waste.length) {
      while (state.waste.length) {
        const card = state.waste.pop();
        card.faceUp = false;
        state.stock.push(card);
      }
      state.recycles++;
      if (state.drawCount === 1 && state.recycles > 1) state.score = Math.max(0, state.score - 100);
      else if (state.drawCount === 3 && state.recycles > 3) state.score = Math.max(0, state.score - 20);
      state.moves++;
      return { type: 'recycle', count: 0 };
    }
    return null;
  }

  function isWon(state) {
    return state.foundations.every(f => f.length === 13);
  }

  /* ---------- Représentation compacte pour le solveur ---------- */
  const rk = c => (c % 13) + 1;
  const su = c => (c / 13) | 0;
  const isRed = c => (su(c) & 1) === 1;

  function toSolverState(state) {
    return {
      tab: state.tableau.map(col => col.map(cardIndex)),
      down: state.tableau.map(col => col.filter(c => !c.faceUp).length),
      stock: state.stock.map(cardIndex),
      waste: state.waste.map(cardIndex),
      found: state.foundations.map(p => p.length),
      draw: state.drawCount
    };
  }

  function cloneSolver(s) {
    return {
      tab: s.tab.map(a => a.slice()),
      down: s.down.slice(),
      stock: s.stock.slice(),
      waste: s.waste.slice(),
      found: s.found.slice(),
      draw: s.draw
    };
  }

  function solverKey(s) {
    return s.tab.map(c => c.join(',')).join('|') + '#' + s.down.join('') + '#' +
      s.found.join(',') + '#' + s.stock.join(',') + '#' + s.waste.join(',');
  }

  function solverWon(s) {
    return s.found[0] === 13 && s.found[1] === 13 && s.found[2] === 13 && s.found[3] === 13;
  }

  /* Génère les coups « utiles » (hors coups manifestement inutiles), classés par priorité. */
  function genMoves(s, includeDraw) {
    const moves = [];
    if (s.waste.length) {
      const c = s.waste[s.waste.length - 1];
      if (s.found[su(c)] === rk(c) - 1) moves.push({ k: 'wf', p: 0 });
    }
    for (let col = 0; col < 7; col++) {
      const t = s.tab[col];
      if (!t.length) continue;
      const c = t[t.length - 1];
      if (s.found[su(c)] === rk(c) - 1) moves.push({ k: 'tf', from: col, p: 0 });
    }
    for (let from = 0; from < 7; from++) {
      const src = s.tab[from];
      for (let idx = s.down[from]; idx < src.length; idx++) {
        const c = src[idx];
        const reveals = idx === s.down[from] && s.down[from] > 0;
        const below = idx > 0 ? src[idx - 1] : -1;
        const exposesFoundation = idx > s.down[from] && below >= 0 && s.found[su(below)] === rk(below) - 1;
        for (let to = 0; to < 7; to++) {
          if (to === from) continue;
          const dst = s.tab[to];
          if (dst.length === 0) {
            if (rk(c) === 13 && idx > 0) moves.push({ k: 'tt', from, idx, to, p: reveals ? 1 : 3 });
          } else {
            const t = dst[dst.length - 1];
            if (rk(t) === rk(c) + 1 && isRed(t) !== isRed(c)) {
              if (reveals) moves.push({ k: 'tt', from, idx, to, p: 1 });
              else if (idx === 0) moves.push({ k: 'tt', from, idx, to, p: 4 });
              else if (exposesFoundation) moves.push({ k: 'tt', from, idx, to, p: 2 });
            }
          }
        }
      }
    }
    if (s.waste.length) {
      const c = s.waste[s.waste.length - 1];
      for (let to = 0; to < 7; to++) {
        const dst = s.tab[to];
        if (dst.length === 0) {
          if (rk(c) === 13) moves.push({ k: 'wt', to, p: 2 });
        } else {
          const t = dst[dst.length - 1];
          if (rk(t) === rk(c) + 1 && isRed(t) !== isRed(c)) moves.push({ k: 'wt', to, p: 2 });
        }
      }
    }
    moves.sort((a, b) => a.p - b.p);
    if (includeDraw && (s.stock.length || s.waste.length)) moves.push({ k: 'd', p: 9 });
    return moves;
  }

  function flipSolver(s, col) {
    const t = s.tab[col];
    if (t.length > 0 && t.length === s.down[col]) s.down[col]--;
  }

  function applySolverMove(s, m) {
    switch (m.k) {
      case 'wf': {
        const c = s.waste.pop();
        s.found[su(c)]++;
        break;
      }
      case 'tf': {
        const c = s.tab[m.from].pop();
        s.found[su(c)]++;
        flipSolver(s, m.from);
        break;
      }
      case 'tt': {
        const moved = s.tab[m.from].splice(m.idx);
        for (const c of moved) s.tab[m.to].push(c);
        flipSolver(s, m.from);
        break;
      }
      case 'wt':
        s.tab[m.to].push(s.waste.pop());
        break;
      case 'd':
        if (s.stock.length) {
          const n = Math.min(s.draw, s.stock.length);
          for (let i = 0; i < n; i++) s.waste.push(s.stock.pop());
        } else {
          s.stock = s.waste.reverse();
          s.waste = [];
        }
        break;
    }
    return s;
  }

  function safeFoundationMove(s) {
    const check = c => {
      const r = rk(c);
      if (s.found[su(c)] !== r - 1) return false;
      if (r <= 2) return true;
      const o1 = isRed(c) ? 0 : 1;
      const o2 = isRed(c) ? 2 : 3;
      return s.found[o1] >= r - 1 && s.found[o2] >= r - 1;
    };
    if (s.waste.length && check(s.waste[s.waste.length - 1])) return { k: 'wf' };
    for (let col = 0; col < 7; col++) {
      const t = s.tab[col];
      if (t.length && check(t[t.length - 1])) return { k: 'tf', from: col };
    }
    return null;
  }

  /* Résout la position par recherche en profondeur bornée. */
  function solve(s0, opts) {
    const nodeLimit = (opts && opts.nodeLimit) || 4000;
    const visited = new Set();
    const path = [];
    let nodes = 0;

    function dfs(s) {
      if (solverWon(s)) return true;
      if (++nodes > nodeLimit) return false;
      const key = solverKey(s);
      if (visited.has(key)) return false;
      visited.add(key);
      const moves = genMoves(s, true);
      for (const m of moves) {
        const n = applySolverMove(cloneSolver(s), m);
        const steps = [m];
        for (let safe = safeFoundationMove(n); safe; safe = safeFoundationMove(n)) {
          applySolverMove(n, safe);
          steps.push(safe);
        }
        path.push(...steps);
        if (dfs(n)) return true;
        path.length -= steps.length;
        if (nodes > nodeLimit) return false;
      }
      return false;
    }

    let solved = false;
    try {
      solved = dfs(cloneSolver(s0));
    } catch (e) {
      solved = false; // dépassement de pile : on abandonne proprement
    }
    return { solved, path: solved ? path.slice() : [], nodes };
  }

  /* Rejoue un chemin sur un état solveur (pour les tests). */
  function simulate(s0, path) {
    const s = cloneSolver(s0);
    for (const m of path) applySolverMove(s, m);
    return s;
  }

  /* Convertit une étape du solveur en coup d'interface. */
  function stepToUiMove(state, step) {
    switch (step.k) {
      case 'd':
        return { draw: true };
      case 'wf': {
        const c = state.waste[state.waste.length - 1];
        return { source: { zone: 'waste', index: state.waste.length - 1 }, target: { zone: 'foundation', col: SUIT_INDEX[c.suit] } };
      }
      case 'tf': {
        const col = state.tableau[step.from];
        const c = col[col.length - 1];
        return { source: { zone: 'tableau', col: step.from, index: col.length - 1 }, target: { zone: 'foundation', col: SUIT_INDEX[c.suit] } };
      }
      case 'tt':
        return { source: { zone: 'tableau', col: step.from, index: step.idx }, target: { zone: 'tableau', col: step.to } };
      case 'wt':
        return { source: { zone: 'waste', index: state.waste.length - 1 }, target: { zone: 'tableau', col: step.to } };
    }
    return null;
  }

  /* Indice : premier coup d'une solution si trouvée, sinon null. */
  function findHint(state, nodeLimit) {
    const r = solve(toSolverState(state), { nodeLimit: nodeLimit || 15000 });
    if (!r.solved || !r.path.length) return null;
    return stepToUiMove(state, r.path[0]);
  }

  /* Reste-t-il au moins un coup raisonnable ? */
  function hasAnyMove(state) {
    const s = toSolverState(state);
    if (genMoves(s, false).length) return true;
    const reachable = s.stock.concat(s.waste);
    return reachable.some(c => {
      if (s.found[su(c)] === rk(c) - 1) return true;
      return s.tab.some(col => {
        if (!col.length) return rk(c) === 13;
        const t = col[col.length - 1];
        return rk(t) === rk(c) + 1 && isRed(t) !== isRed(c);
      });
    });
  }

  /* Génère une donne (reproductible depuis `seed`). Si `winnable`, vérifie qu'elle est résoluble. */
  function generateDeal(seed, drawCount, winnable, opts) {
    const maxAttempts = winnable ? ((opts && opts.maxAttempts) || 14) : 1;
    const nodeLimit = (opts && opts.nodeLimit) || 4000;
    let first = null;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const rand = mulberry32((seed + Math.imul(attempt, 0x9E3779B1)) >>> 0);
      const order = shuffledOrder(rand);
      const state = dealState(order, drawCount);
      const deal = { state, order, seed, verified: false };
      if (!first) first = deal;
      if (!winnable) return deal;
      if (solve(toSolverState(state), { nodeLimit }).solved) {
        deal.verified = true;
        return deal;
      }
    }
    return first;
  }

  return {
    SUITS, LABELS, SUIT_INDEX,
    mulberry32, makeCard, cardIndex, shuffledOrder, dealState,
    canMoveToFoundation, canMoveToTableau, getMovingCards,
    applyMove, drawFromStock, isWon,
    toSolverState, genMoves, applySolverMove, solve, simulate,
    stepToUiMove, findHint, hasAnyMove, generateDeal
  };
});
