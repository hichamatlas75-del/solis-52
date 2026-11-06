const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../rules.js');

test('la donne contient 52 cartes uniques correctement réparties', () => {
  const { state } = R.generateDeal(12345, 1, false);
  const all = [...state.stock, ...state.waste, ...state.tableau.flat()];
  assert.equal(all.length, 52);
  assert.equal(new Set(all.map(c => c.id)).size, 52);
  assert.equal(state.stock.length, 24);
  state.tableau.forEach((col, i) => {
    assert.equal(col.length, i + 1);
    assert.equal(col.filter(c => c.faceUp).length, 1);
    assert.ok(col[col.length - 1].faceUp);
  });
});

test('une même graine produit la même donne', () => {
  const a = R.generateDeal(777, 1, true);
  const b = R.generateDeal(777, 1, true);
  assert.deepEqual(a.order, b.order);
  assert.notDeepEqual(a.order, R.generateDeal(778, 1, true).order);
});

test('règles du tableau : alternance de couleurs et Roi sur colonne vide', () => {
  const { state } = R.generateDeal(1, 1, false);
  state.tableau = [[], [], [], [], [], [], []];
  const six = { ...R.makeCard(5), faceUp: true };          // 6♠
  const sevenRed = { ...R.makeCard(13 + 6), faceUp: true }; // 7♥
  const sevenBlack = { ...R.makeCard(6), faceUp: true };    // 7♠
  const king = { ...R.makeCard(12), faceUp: true };         // K♠
  state.tableau[0] = [sevenRed];
  assert.ok(R.canMoveToTableau(state, six, 0));
  state.tableau[0] = [sevenBlack];
  assert.ok(!R.canMoveToTableau(state, six, 0));
  assert.ok(R.canMoveToTableau(state, king, 1));
  assert.ok(!R.canMoveToTableau(state, six, 1));
});

test('fondations : As de la bonne enseigne puis suite croissante', () => {
  const { state } = R.generateDeal(1, 1, false);
  const aceSpades = { ...R.makeCard(0), faceUp: true };
  const aceHearts = { ...R.makeCard(13), faceUp: true };
  const twoSpades = { ...R.makeCard(1), faceUp: true };
  assert.ok(R.canMoveToFoundation(state, aceSpades, 0));
  assert.ok(!R.canMoveToFoundation(state, aceSpades, 1), 'mauvaise enseigne');
  assert.ok(R.canMoveToFoundation(state, aceHearts, 1));
  assert.ok(!R.canMoveToFoundation(state, twoSpades, 0), 'pas d\'As dessous');
  state.foundations[0].push(aceSpades);
  assert.ok(R.canMoveToFoundation(state, twoSpades, 0));
});

test('applyMove : retourne la carte exposée et met à jour le score', () => {
  const { state } = R.generateDeal(1, 1, false);
  state.tableau = [[], [], [], [], [], [], []];
  const hidden = { ...R.makeCard(20), faceUp: false };
  const ace = { ...R.makeCard(0), faceUp: true };
  state.tableau[0] = [hidden, ace];
  const res = R.applyMove(state, { zone: 'tableau', col: 0, index: 1 }, { zone: 'foundation', col: 0 });
  assert.ok(res && res.flipped);
  assert.equal(state.score, 15);
  assert.ok(state.tableau[0][0].faceUp);
  assert.equal(state.foundations[0].length, 1);
});

test('applyMove : refuse de déplacer une colonne commençant par un Roi vers une colonne vide', () => {
  const { state } = R.generateDeal(1, 1, false);
  state.tableau = [[], [], [], [], [], [], []];
  state.tableau[0] = [{ ...R.makeCard(12), faceUp: true }];
  assert.equal(R.applyMove(state, { zone: 'tableau', col: 0, index: 0 }, { zone: 'tableau', col: 1 }), null);
});

test('pioche : tirage 1 et 3, puis recyclage', () => {
  const d1 = R.generateDeal(5, 1, false).state;
  R.drawFromStock(d1);
  assert.equal(d1.waste.length, 1);
  const d3 = R.generateDeal(5, 3, false).state;
  R.drawFromStock(d3);
  assert.equal(d3.waste.length, 3);
  while (d3.stock.length) R.drawFromStock(d3);
  assert.equal(d3.waste.length, 24);
  const r = R.drawFromStock(d3);
  assert.equal(r.type, 'recycle');
  assert.equal(d3.stock.length, 24);
  assert.equal(d3.waste.length, 0);
});

test('solveur : une donne vérifiée est réellement gagnable (chemin rejoué)', () => {
  for (const seed of [11, 42, 2024]) {
    const deal = R.generateDeal(seed, 1, true);
    if (!deal.verified) continue;
    const s0 = R.toSolverState(deal.state);
    const r = R.solve(s0, { nodeLimit: 4000 });
    assert.ok(r.solved);
    const end = R.simulate(s0, r.path);
    assert.deepEqual(end.found, [13, 13, 13, 13]);
  }
});

test('la majorité des donnes « gagnables » sont vérifiées rapidement', () => {
  let verified = 0;
  const t0 = Date.now();
  for (let seed = 1; seed <= 12; seed++) {
    if (R.generateDeal(seed * 101, 1, true).verified) verified++;
  }
  assert.ok(verified >= 9, `seulement ${verified}/12 donnes vérifiées`);
  assert.ok(Date.now() - t0 < 20000, 'génération trop lente');
});

test('indice : renvoie un coup applicable', () => {
  const deal = R.generateDeal(11, 1, true);
  const hint = R.findHint(deal.state, 8000);
  if (!hint) return;
  if (hint.draw) {
    assert.ok(deal.state.stock.length > 0 || deal.state.waste.length > 0);
  } else {
    const copy = JSON.parse(JSON.stringify(deal.state));
    assert.ok(R.applyMove(copy, hint.source, hint.target));
  }
});

test('hasAnyMove : détecte une position bloquée', () => {
  const { state } = R.generateDeal(1, 1, false);
  state.stock = [];
  state.waste = [];
  state.foundations = [[], [], [], []];
  // Sept colonnes d'une seule carte (rois et reines noires/rouges impossibles à poser)
  state.tableau = [[], [], [], [], [], [], []];
  [3, 4, 5, 6, 7, 8, 9].forEach((r, i) => {
    state.tableau[i] = [{ ...R.makeCard(r), faceUp: true }]; // 4♠ ... 10♠ : même couleur, pas de As
  });
  assert.equal(R.hasAnyMove(state), false);
});
