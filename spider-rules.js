/*
 * Solis 52 — moteur de règles Spider Solitaire (pur, sans DOM).
 * Utilisable dans le navigateur (window.SpiderRules) et dans Node (require).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./rules.js'));
  } else {
    root.SpiderRules = factory(root.SolisRules);
  }
})(typeof self !== 'undefined' ? self : this, function (Base) {
  'use strict';

  const SUITS = Base.SUITS; // 0: ♠, 1: ♥, 2: ♣, 3: ♦
  const LABELS = Base.LABELS;
  const mulberry32 = Base.mulberry32;

  /* Retourne les enseignes utilisées selon le mode (1, 2 ou 4 couleurs) pour 8 suites = 104 cartes. */
  function suitsForMode(suitCount) {
    if (suitCount === 4) return [0, 1, 2, 3, 0, 1, 2, 3];
    if (suitCount === 2) return [0, 1, 0, 1, 0, 1, 0, 1];
    return [0, 0, 0, 0, 0, 0, 0, 0]; // 1 couleur (♠) par défaut
  }

  /* Construit un jeu mélangé de 104 cartes avec identifiants uniques. */
  function buildDeck(seed, suitCount) {
    const rand = mulberry32(seed >>> 0);
    const suiteSuits = suitsForMode(suitCount);
    const cards = [];
    let uid = 0;
    for (let sIdx = 0; sIdx < suiteSuits.length; sIdx++) {
      const suitObj = SUITS[suiteSuits[sIdx]];
      for (let r = 1; r <= 13; r++) {
        cards.push({
          id: `s${uid++}_${LABELS[r - 1]}${suitObj.symbol}`,
          suit: suitObj.symbol,
          suitName: suitObj.name,
          color: suitObj.color,
          rank: r,
          label: LABELS[r - 1],
          faceUp: false
        });
      }
    }
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    return cards;
  }

  /*
   * Distribue une partie Spider :
   * - Colonnes 0..3 : 6 cartes (5 cachées + 1 visible) = 24
   * - Colonnes 4..9 : 5 cartes (4 cachées + 1 visible) = 30
   * - Talon (stock) : 50 cartes restantes (5 distributions de 10 cartes)
   */
  function dealSpider(seed, suitCount) {
    const validSuits = (suitCount === 2 || suitCount === 4) ? suitCount : 1;
    const deck = buildDeck(seed, validSuits);
    const tableau = Array.from({ length: 10 }, () => []);

    for (let col = 0; col < 10; col++) {
      const count = col < 4 ? 6 : 5;
      for (let row = 0; row < count; row++) {
        const card = deck.pop();
        card.faceUp = row === count - 1;
        tableau[col].push(card);
      }
    }

    return {
      stock: deck,          // 50 cartes (5 distributions de 10)
      completed: [],        // jusqu'à 8 enseignes complètes (chaque entrée = { suit, color })
      tableau,              // 10 colonnes
      suitCount: validSuits,
      score: 500,
      moves: 0,
      won: false
    };
  }

  /* Vérifie si la sous-pile col[index..fin] forme une suite décroissante de MÊME enseigne. */
  function isMovableRun(col, index) {
    if (!col || index < 0 || index >= col.length) return false;
    if (!col[index].faceUp) return false;
    for (let i = index; i < col.length - 1; i++) {
      const cur = col[i];
      const next = col[i + 1];
      if (!next.faceUp || cur.suit !== next.suit || cur.rank !== next.rank + 1) {
        return false;
      }
    }
    return true;
  }

  /* Premier indice déplaçable au bas d'une colonne (-1 si vide). */
  function firstMovableIndex(col) {
    if (!col || !col.length) return -1;
    let idx = col.length - 1;
    while (idx > 0) {
      const prev = col[idx - 1];
      const cur = col[idx];
      if (prev.faceUp && prev.suit === cur.suit && prev.rank === cur.rank + 1) {
        idx--;
      } else {
        break;
      }
    }
    return idx;
  }

  function getMovingCards(state, source) {
    if (!source || source.zone !== 'tableau') return [];
    const col = state.tableau[source.col];
    if (!isMovableRun(col, source.index)) return [];
    return col.slice(source.index);
  }

  /* Peut-on poser `leadCard` sur la colonne `targetCol` ? */
  function canMoveToColumn(state, leadCard, targetCol) {
    const dst = state.tableau[targetCol];
    if (!dst) return false;
    if (dst.length === 0) return true; // Toute carte ou suite valide peut aller sur une colonne vide
    const top = dst[dst.length - 1];
    return top.faceUp && top.rank === leadCard.rank + 1;
  }

  /* Retourne la carte cachée exposée en haut d'une colonne si nécessaire. */
  function flipTopIfNeeded(col) {
    if (col.length > 0 && !col[col.length - 1].faceUp) {
      col[col.length - 1].faceUp = true;
      return col[col.length - 1].id;
    }
    return null;
  }

  /*
   * Vérifie si le bas de `col` contient une suite complète K (13) -> A (1) de la même enseigne.
   * Si oui, la retire, l'ajoute à `state.completed`, crédite +100 pts et retourne la carte exposée.
   */
  function extractCompletedRun(state, colIdx) {
    const col = state.tableau[colIdx];
    if (col.length < 13) return null;
    const start = col.length - 13;
    const suit = col[start].suit;
    if (col[start].rank !== 13 || !col[start].faceUp) return null;
    for (let i = 0; i < 13; i++) {
      const c = col[start + i];
      if (!c.faceUp || c.suit !== suit || c.rank !== 13 - i) return null;
    }
    const removed = col.splice(start, 13);
    state.completed.push({ suit, color: removed[0].color, card: removed[0] });
    state.score += 100;
    const flippedId = flipTopIfNeeded(col);
    if (state.completed.length === 8) state.won = true;
    return { suit, removed, flippedId, col: colIdx };
  }

  /* Applique un déplacement de `source` ({ zone:'tableau', col, index }) vers `target` ({ zone:'tableau', col }). */
  function applyMove(state, source, target) {
    if (!source || !target || source.zone !== 'tableau' || target.zone !== 'tableau') return null;
    if (source.col === target.col) return null;
    const moving = getMovingCards(state, source);
    if (!moving.length) return null;

    const dst = state.tableau[target.col];
    if (!canMoveToColumn(state, moving[0], target.col)) return null;

    // Éviter le coup inutile déplaçant toute une colonne vers une autre colonne vide
    if (source.index === 0 && dst.length === 0) return null;

    const src = state.tableau[source.col];
    src.splice(source.index, moving.length);
    dst.push(...moving);

    state.moves++;
    state.score = Math.max(0, state.score - 1);

    const flippedIds = [];
    const f1 = flipTopIfNeeded(src);
    if (f1) flippedIds.push(f1);

    const completedRuns = [];
    let comp = extractCompletedRun(state, target.col);
    while (comp) {
      completedRuns.push(comp);
      if (comp.flippedId) flippedIds.push(comp.flippedId);
      comp = extractCompletedRun(state, target.col);
    }

    return { cards: moving, flippedIds, completedRuns };
  }

  /* Peut-on distribuer une nouvelle rangée de 10 cartes depuis le talon ? */
  function canDealRow(state) {
    if (state.stock.length === 0) return { ok: false, reason: 'empty-stock' };
    const totalTableauCards = state.tableau.reduce((sum, c) => sum + c.length, 0);
    const hasEmptyCol = state.tableau.some(c => c.length === 0);
    if (hasEmptyCol && totalTableauCards >= 10) {
      return { ok: false, reason: 'empty-column' };
    }
    return { ok: true, reason: null };
  }

  /* Distribue 1 carte face visible sur chacune des 10 colonnes. */
  function dealRow(state) {
    const check = canDealRow(state);
    if (!check.ok) return { ok: false, reason: check.reason };

    const dealt = [];
    const count = Math.min(10, state.stock.length);
    for (let col = 0; col < count; col++) {
      const card = state.stock.pop();
      card.faceUp = true;
      state.tableau[col].push(card);
      dealt.push({ col, card });
    }
    state.moves++;

    const completedRuns = [];
    const flippedIds = [];
    for (let col = 0; col < 10; col++) {
      const comp = extractCompletedRun(state, col);
      if (comp) {
        completedRuns.push(comp);
        if (comp.flippedId) flippedIds.push(comp.flippedId);
      }
    }

    return { ok: true, dealt, completedRuns, flippedIds };
  }

  /* Longueur de la suite de même enseigne déjà en place au bas de `col`. */
  function tailRunLength(col) {
    const idx = firstMovableIndex(col);
    return idx === -1 ? 0 : col.length - idx;
  }

  /*
   * Recherche intelligente d'indice pour Spider :
   * Évalue tous les coups utiles (sans proposer d'aller-retour stérile).
   */
  function findHint(state) {
    if (state.won) return null;
    const candidates = [];

    for (let from = 0; from < 10; from++) {
      const src = state.tableau[from];
      if (!src.length) continue;
      const startIdx = firstMovableIndex(src);
      const runLen = src.length - startIdx;
      const lead = src[startIdx];
      const below = startIdx > 0 ? src[startIdx - 1] : null;
      const revealsHidden = !!below && !below.faceUp;
      const alreadyOnSameSuit = !!below && below.faceUp && below.suit === lead.suit && below.rank === lead.rank + 1;
      const alreadyOnValidRank = !!below && below.faceUp && below.rank === lead.rank + 1;
      const freesColumn = startIdx === 0;

      for (let to = 0; to < 10; to++) {
        if (to === from) continue;
        const dst = state.tableau[to];

        if (dst.length === 0) {
          if (freesColumn) continue; // Déplacer une colonne entière vers du vide ne sert à rien
          // Pertinent si cela retourne une carte cachée ou débloque une suite de même enseigne dessous
          const unblocksSameSuit = !!below && below.faceUp && !alreadyOnSameSuit;
          if (revealsHidden || unblocksSameSuit) {
            const score = (revealsHidden ? 45 : 22) + (lead.rank === 13 ? 12 : 0) + runLen;
            candidates.push({
              score,
              source: { zone: 'tableau', col: from, index: startIdx },
              target: { zone: 'tableau', col: to }
            });
          }
          continue;
        }

        const top = dst[dst.length - 1];
        if (!top.faceUp || top.rank !== lead.rank + 1) continue;

        const sameSuit = top.suit === lead.suit;
        const dstRun = tailRunLength(dst);
        const completes13 = sameSuit && (dstRun + runLen === 13) && dst[dst.length - dstRun].rank === 13;

        // Ne jamais casser une suite déjà ordonnée dans la même enseigne sauf pour compléter immédiatement K..A
        if (alreadyOnSameSuit && !completes13) continue;

        // Éviter d'échanger deux cartes de couleur différente sans rien révéler ni libérer
        if (!sameSuit && alreadyOnValidRank && !revealsHidden && !freesColumn) continue;

        let score = 0;
        if (completes13) score += 200;
        if (sameSuit) score += 80 + dstRun * 3 + runLen * 2;
        else score += 30;
        if (revealsHidden) score += 40;
        if (freesColumn) score += 25;

        candidates.push({
          score,
          source: { zone: 'tableau', col: from, index: startIdx },
          target: { zone: 'tableau', col: to }
        });
      }
    }

    // Possibilité de couper une suite partielle uniquement si cela complète directement les 13 cartes K->A
    for (let from = 0; from < 10; from++) {
      const src = state.tableau[from];
      const startIdx = firstMovableIndex(src);
      if (startIdx === -1) continue;
      for (let idx = startIdx + 1; idx < src.length; idx++) {
        const lead = src[idx];
        const partLen = src.length - idx;
        for (let to = 0; to < 10; to++) {
          if (to === from) continue;
          const dst = state.tableau[to];
          if (!dst.length) continue;
          const top = dst[dst.length - 1];
          const dstRun = tailRunLength(dst);
          if (top.suit === lead.suit && top.rank === lead.rank + 1 && dstRun + partLen === 13 && dst[dst.length - dstRun].rank === 13) {
            candidates.push({
              score: 195,
              source: { zone: 'tableau', col: from, index: idx },
              target: { zone: 'tableau', col: to }
            });
          }
        }
      }
    }

    if (candidates.length) {
      candidates.sort((a, b) => b.score - a.score);
      return candidates[0];
    }

    if (state.stock.length > 0) {
      const dealCheck = canDealRow(state);
      if (dealCheck.ok) return { deal: true };
      // S'il y a une colonne vide qui bloque la distribution, proposer de la remplir avec une carte libre
      const emptyCol = state.tableau.findIndex(c => c.length === 0);
      for (let c = 0; c < 10; c++) {
        const col = state.tableau[c];
        if (col.length <= 1) continue;
        const idx = firstMovableIndex(col);
        if (idx > 0) {
          return {
            score: 10,
            source: { zone: 'tableau', col: c, index: idx },
            target: { zone: 'tableau', col: emptyCol }
          };
        }
      }
    }

    return null;
  }

  /* Meilleure destination pour un double-clic / double-tap sur une carte ou sous-pile. */
  function findBestAutoTarget(state, source) {
    const moving = getMovingCards(state, source);
    if (!moving.length) return null;
    const lead = moving[0];

    let bestCol = -1;
    let bestScore = -1;

    for (let to = 0; to < 10; to++) {
      if (to === source.col) continue;
      const dst = state.tableau[to];
      if (!canMoveToColumn(state, lead, to)) continue;
      if (source.index === 0 && dst.length === 0) continue;

      let score = 0;
      if (dst.length === 0) {
        score = lead.rank === 13 ? 25 : 10;
      } else {
        const top = dst[dst.length - 1];
        const sameSuit = top.suit === lead.suit;
        score = (sameSuit ? 100 : 40) + tailRunLength(dst);
      }
      if (score > bestScore) {
        bestScore = score;
        bestCol = to;
      }
    }

    return bestCol >= 0 ? { zone: 'tableau', col: bestCol } : null;
  }

  function hasAnyMove(state) {
    if (state.stock.length > 0 && canDealRow(state).ok) return true;
    for (let from = 0; from < 10; from++) {
      const src = state.tableau[from];
      if (!src.length) continue;
      const idx = firstMovableIndex(src);
      const lead = src[idx];
      for (let to = 0; to < 10; to++) {
        if (to === from) continue;
        const dst = state.tableau[to];
        if (dst.length === 0) {
          if (idx > 0) return true;
        } else if (dst[dst.length - 1].rank === lead.rank + 1) {
          return true;
        }
      }
    }
    return false;
  }

  return {
    SUITS, LABELS,
    suitsForMode, buildDeck, dealSpider,
    isMovableRun, firstMovableIndex, getMovingCards,
    canMoveToColumn, applyMove,
    canDealRow, dealRow, extractCompletedRun,
    findHint, findBestAutoTarget, hasAnyMove
  };
});
