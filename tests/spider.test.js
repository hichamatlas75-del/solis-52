const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../spider-rules.js');

test('donne Spider : 104 cartes uniques (54 au tableau, 50 au talon) pour 1, 2 et 4 couleurs', () => {
  for (const suits of [1, 2, 4]) {
    const st = S.dealSpider(12345, suits);
    const all = [...st.stock, ...st.tableau.flat()];
    assert.equal(all.length, 104);
    assert.equal(new Set(all.map(c => c.id)).size, 104);
    assert.equal(st.stock.length, 50);
    assert.equal(st.score, 500);
    st.tableau.forEach((col, i) => {
      assert.equal(col.length, i < 4 ? 6 : 5);
      assert.equal(col.filter(c => c.faceUp).length, 1);
      assert.ok(col[col.length - 1].faceUp);
    });
    const distinctSuits = new Set(all.map(c => c.suit));
    assert.equal(distinctSuits.size, suits);
  }
});

test('déplacement de pile : autorisé uniquement si même enseigne décroissante, pose sur toute enseigne de rang +1', () => {
  const st = S.dealSpider(42, 2);
  st.tableau = Array.from({ length: 10 }, () => []);

  // Colonne 0 : 9♥ suivi de 8♠ -> 7♠
  st.tableau[0] = [
    { id: 'a', suit: '♥', color: 'red', rank: 9, label: '9', faceUp: true },
    { id: 'b', suit: '♠', color: 'black', rank: 8, label: '8', faceUp: true },
    { id: 'c', suit: '♠', color: 'black', rank: 7, label: '7', faceUp: true }
  ];
  // Colonne 1 : 9♥ en sommet (peut recevoir 8♠-7♠)
  st.tableau[1] = [
    { id: 'd', suit: '♥', color: 'red', rank: 9, label: '9', faceUp: true }
  ];

  // Impossible de déplacer depuis 9♥ (enseignes mixtes 9♥ -> 8♠)
  assert.equal(S.isMovableRun(st.tableau[0], 0), false);
  // Possible de déplacer la suite 8♠ -> 7♠ ensemble
  assert.equal(S.isMovableRun(st.tableau[0], 1), true);
  assert.equal(S.firstMovableIndex(st.tableau[0]), 1);

  const res = S.applyMove(st, { zone: 'tableau', col: 0, index: 1 }, { zone: 'tableau', col: 1 });
  assert.ok(res);
  assert.equal(st.tableau[0].length, 1);
  assert.equal(st.tableau[1].length, 3);
  assert.equal(st.score, 499);
});

test('suite complète K -> A de même enseigne : retrait automatique, +100 pts et retournement', () => {
  const st = S.dealSpider(7, 1);
  st.tableau = Array.from({ length: 10 }, () => []);
  const hidden = { id: 'hid', suit: '♠', color: 'black', rank: 5, label: '5', faceUp: false };
  // Colonne 0 : carte cachée + K♠..2♠
  const kTo2 = [];
  for (let r = 13; r >= 2; r--) {
    kTo2.push({ id: `r${r}`, suit: '♠', color: 'black', rank: r, label: String(r), faceUp: true });
  }
  st.tableau[0] = [hidden, ...kTo2];
  st.tableau[1] = [{ id: 'ace', suit: '♠', color: 'black', rank: 1, label: 'A', faceUp: true }];

  const res = S.applyMove(st, { zone: 'tableau', col: 1, index: 0 }, { zone: 'tableau', col: 0 });
  assert.ok(res);
  assert.equal(res.completedRuns.length, 1);
  assert.equal(st.completed.length, 1);
  assert.equal(st.tableau[0].length, 1);
  assert.equal(st.tableau[0][0].faceUp, true, 'la carte cachée sous le Roi doit être retournée');
  assert.equal(st.score, 599); // 500 - 1 + 100
});

test('distribution de rangée : bloquée si une colonne est vide, autorisée quand toutes sont occupées', () => {
  const st = S.dealSpider(99, 1);
  const saved = st.tableau[9];
  st.tableau[9] = [];
  assert.equal(S.canDealRow(st).ok, false);
  assert.equal(S.dealRow(st).ok, false);

  st.tableau[9] = saved;
  const deal = S.dealRow(st);
  assert.equal(deal.ok, true);
  assert.equal(st.stock.length, 40);
  assert.equal(st.tableau[0].length, 7);
  assert.equal(st.tableau[9].length, 6);
});

test('indice Spider : propose un coup valide ou une distribution', () => {
  const st = S.dealSpider(2026, 1);
  const hint = S.findHint(st);
  assert.ok(hint);
  if (hint.deal) {
    assert.ok(S.canDealRow(st).ok);
  } else {
    const copy = JSON.parse(JSON.stringify(st));
    assert.ok(S.applyMove(copy, hint.source, hint.target));
  }
});
