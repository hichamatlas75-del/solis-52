/*
 * Solis 52 — interface (rendu, entrées, PWA).
 * Règles et solveur : rules.js — persistance : storage.js
 */
(() => {
  'use strict';

  const R = window.SolisRules;
  const Store = window.SolisStorage;
  const SUITS = R.SUITS;

  const PIP_LAYOUTS = {
    2: [[1,2,0], [5,2,1]],
    3: [[1,2,0], [3,2,0], [5,2,1]],
    4: [[1,1,0], [1,3,0], [5,1,1], [5,3,1]],
    5: [[1,1,0], [1,3,0], [3,2,0], [5,1,1], [5,3,1]],
    6: [[1,1,0], [1,3,0], [3,1,0], [3,3,0], [5,1,1], [5,3,1]],
    7: [[1,1,0], [1,3,0], [2,2,0], [3,1,0], [3,3,0], [5,1,1], [5,3,1]],
    8: [[1,1,0], [1,3,0], [2,2,0], [3,1,0], [3,3,0], [4,2,1], [5,1,1], [5,3,1]],
    9: [[1,1,0], [1,3,0], [2,1,0], [2,3,0], [3,2,0], [4,1,1], [4,3,1], [5,1,1], [5,3,1]],
    10: [[1,1,0], [1,3,0], [2,2,0], [2,1,0], [2,3,0], [4,1,1], [4,3,1], [4,2,1], [5,1,1], [5,3,1]]
  };

  const SUIT_NAMES = { '♠': 'pique', '♥': 'cœur', '♣': 'trèfle', '♦': 'carreau' };
  const RANK_NAMES = { 1: 'As', 11: 'Valet', 12: 'Dame', 13: 'Roi' };

  /* ---------- État ---------- */
  let settings = Store.getSettings();
  let state = null;
  let history = [];          // instantanés JSON (annuler)
  let redoStack = [];        // instantanés JSON (rétablir)
  let initialOrder = null;   // ordre de la donne (rejouer)
  let dealSeed = 0;
  let dealVerified = false;
  let dealDraw = 1;
  let timerSeconds = 0;
  let timerInterval = null;
  let clockStarted = false;
  let countedPlayed = false;
  let selectedSource = null;
  let isAutoCompleting = false;
  let cascadeAnimId = null;
  let stuckNotified = false;
  let noAnimateNext = false;
  let flipId = null;
  let dragSession = null;
  let lastTap = { key: null, time: 0 };
  let audioCtx = null;

  const reducedMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- DOM ---------- */
  const $ = (id) => document.getElementById(id);
  const stockSlot = $('stock-slot');
  const wasteSlot = $('waste-slot');
  const foundationSlots = Array.from(document.querySelectorAll('.foundation-slot'));
  const tableauCols = Array.from(document.querySelectorAll('.tableau-col'));
  const scoreEl = $('score-val');
  const timeEl = $('time-val');
  const movesEl = $('moves-val');
  const btnUndo = $('btn-undo');
  const btnRedo = $('btn-redo');
  const btnHint = $('btn-hint');
  const btnNew = $('btn-new');
  const btnMenu = $('btn-menu');
  const btnAutoComplete = $('btn-autocomplete');
  const drawModeSelect = $('draw-mode');
  const feltSelect = $('felt-theme');
  const cardbackSelect = $('cardback');
  const optWinnable = $('opt-winnable');
  const optFourColor = $('opt-fourcolor');
  const optSound = $('opt-sound');
  const statusMsg = $('status-msg');
  const dealBadge = $('deal-badge');
  const dealInfo = $('deal-info');
  const dragLayer = $('drag-layer');
  const victoryCanvas = $('victory-canvas');
  const victoryBanner = $('victory-banner');
  const victoryStats = $('victory-stats');
  const btnVictoryNew = $('btn-victory-new');
  const dlgMenu = $('dlg-menu');
  const statsGrid = $('stats-grid');
  const toast = $('toast');
  const toastMsg = $('toast-msg');
  const toastAction = $('toast-action');

  /* ---------- Utilitaires ---------- */
  const cloneState = () => JSON.stringify(state);

  function formatTime(sec) {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  function setStatus(text) { statusMsg.textContent = text; }

  function cardName(card) {
    return `${RANK_NAMES[card.rank] || card.rank} de ${SUIT_NAMES[card.suit]}`;
  }

  function cssPx(varName, fallback) {
    const probe = document.createElement('div');
    probe.style.cssText = `position:absolute;visibility:hidden;pointer-events:none;width:0;height:var(${varName});`;
    document.body.appendChild(probe);
    const px = probe.offsetHeight;
    probe.remove();
    return px || fallback;
  }

  function showToast(message, actionLabel, onAction, autoHideMs) {
    toastMsg.textContent = message;
    if (actionLabel) {
      toastAction.textContent = actionLabel;
      toastAction.hidden = false;
      toastAction.onclick = () => { toast.hidden = true; onAction(); };
    } else {
      toastAction.hidden = true;
      toastAction.onclick = null;
    }
    toast.hidden = false;
    clearTimeout(showToast.timer);
    if (autoHideMs) showToast.timer = setTimeout(() => { toast.hidden = true; }, autoHideMs);
  }
  $('toast-close').addEventListener('click', () => { toast.hidden = true; });

  /* ---------- Sons ---------- */
  function tone(freq, dur, type = 'sine', vol = 0.06, delay = 0) {
    if (!settings.sound) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const t0 = audioCtx.currentTime + delay;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    } catch (e) { /* audio indisponible */ }
  }
  const sound = {
    move: () => tone(420, 0.07, 'triangle'),
    foundation: () => { tone(660, 0.08, 'triangle'); tone(880, 0.1, 'triangle', 0.05, 0.07); },
    draw: () => tone(300, 0.05, 'square', 0.03),
    error: () => tone(140, 0.12, 'sawtooth', 0.04),
    win: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.25, 'triangle', 0.07, i * 0.14))
  };

  /* ---------- Chrono (pause automatique quand l'onglet est masqué) ---------- */
  function resumeClock() {
    if (timerInterval || !clockStarted || !state || state.won || document.hidden) return;
    timerInterval = setInterval(() => { timerSeconds++; updateHUD(); }, 1000);
  }
  function pauseClock() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  }
  function startClock() {
    if (!countedPlayed) { countedPlayed = true; Store.recordPlayed(); }
    if (!clockStarted) { clockStarted = true; }
    resumeClock();
  }
  function stopClock() { pauseClock(); clockStarted = false; }

  /* ---------- Sauvegarde ---------- */
  function persist() {
    if (!state || state.won) return;
    Store.saveGame({
      v: 1,
      state,
      history: history.slice(-15),
      timerSeconds,
      order: initialOrder,
      seed: dealSeed,
      verified: dealVerified,
      dealDraw,
      countedPlayed,
      clockStarted
    });
  }

  function gameInProgress() { return state && state.moves > 0 && !state.won; }

  /* ---------- Nouvelle partie ---------- */
  function randomSeed() { return Math.floor(Math.random() * 999999) + 1; }

  function newGame(opts = {}) {
    stopCascadeAnimation();
    victoryBanner.classList.remove('active');
    if (gameInProgress() && countedPlayed) Store.recordAbandoned();

    const drawCount = opts.drawCount || parseInt(drawModeSelect.value, 10) || 1;
    if (opts.order) {
      dealSeed = opts.seed || dealSeed;
      initialOrder = opts.order.slice();
      state = R.dealState(initialOrder, drawCount);
      dealVerified = !!opts.verified && opts.verifiedDraw === drawCount;
    } else {
      dealSeed = opts.seed || randomSeed();
      const deal = R.generateDeal(dealSeed, drawCount, settings.winnable);
      state = deal.state;
      initialOrder = deal.order;
      dealVerified = deal.verified;
    }
    dealDraw = drawCount;
    history = [];
    redoStack = [];
    selectedSource = null;
    isAutoCompleting = false;
    stuckNotified = false;
    countedPlayed = false;
    stopClock();
    timerSeconds = 0;
    flipId = null;
    noAnimateNext = true;
    drawModeSelect.value = String(drawCount);
    settings.drawMode = drawCount;
    Store.saveSettings(settings);
    Store.clearSave();
    render();
    persist();
    setStatus(`Nouvelle partie (tirage ${drawCount} carte${drawCount > 1 ? 's' : ''}). Bonne chance !`);
  }

  function confirmNewGame(opts) {
    if (gameInProgress() && !window.confirm('Abandonner la partie en cours et en démarrer une nouvelle ?')) return false;
    newGame(opts);
    return true;
  }

  function restoreGame(save) {
    state = save.state;
    history = Array.isArray(save.history) ? save.history : [];
    redoStack = [];
    initialOrder = save.order;
    dealSeed = save.seed;
    dealVerified = !!save.verified;
    dealDraw = save.dealDraw || state.drawCount;
    timerSeconds = save.timerSeconds || 0;
    countedPlayed = !!save.countedPlayed;
    clockStarted = !!save.clockStarted;
    drawModeSelect.value = String(state.drawCount);
    noAnimateNext = true;
    render();
    resumeClock();
    setStatus('Partie précédente restaurée.');
  }

  /* ---------- Création des cartes ---------- */
  function createCardElement(card) {
    const el = document.createElement('div');
    el.className = `card ${card.color} ${card.faceUp ? 'face-up playable' : 'face-down'}`;

    if (!card.faceUp) {
      el.setAttribute('aria-label', 'Carte cachée');
      el.innerHTML = '<div class="card-back-pattern"></div>';
      return el;
    }

    el.dataset.cardId = card.id;
    el.dataset.suit = card.suit;
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', cardName(card));
    if (card.id === flipId) el.classList.add('just-flipped');

    let centerHTML = '';
    if (card.rank === 1) {
      centerHTML = `<div class="center-ace">${card.suit}</div>`;
    } else if (card.rank >= 11) {
      const crowns = { 11: '⚔', 12: '♛', 13: '♚' };
      centerHTML = `
        <div class="court-frame">
          <span class="court-crown">${crowns[card.rank]}</span>
          <span class="court-suit-bg">${card.suit}</span>
          <span class="court-figure">${card.label}</span>
          <span class="court-crown" style="transform: rotate(180deg);">${crowns[card.rank]}</span>
        </div>`;
    } else {
      const pips = (PIP_LAYOUTS[card.rank] || []).map(([r, c, flip]) =>
        `<span class="pip ${flip ? 'flip' : ''}" style="grid-row:${r};grid-column:${c};">${card.suit}</span>`
      ).join('');
      centerHTML = `<div class="pips-grid">${pips}</div>`;
    }

    el.innerHTML = `
      <div class="card-corner top-left"><span class="corner-rank">${card.label}</span><span class="corner-suit">${card.suit}</span></div>
      <div class="card-center">${centerHTML}</div>
      <div class="card-corner bottom-right"><span class="corner-rank">${card.label}</span><span class="corner-suit">${card.suit}</span></div>`;
    return el;
  }

  /* ---------- Historique ---------- */
  function pushHistory(snapshot) {
    history.push(snapshot);
    if (history.length > 150) history.shift();
    redoStack.length = 0;
    stuckNotified = false;
  }

  function undo() {
    if (!history.length || isAutoCompleting || state.won) return;
    redoStack.push(cloneState());
    state = JSON.parse(history.pop());
    selectedSource = null;
    stuckNotified = false;
    noAnimateNext = false;
    render();
    persist();
    setStatus('Dernier coup annulé.');
  }

  function redo() {
    if (!redoStack.length || isAutoCompleting || state.won) return;
    history.push(cloneState());
    state = JSON.parse(redoStack.pop());
    selectedSource = null;
    render();
    persist();
    setStatus('Coup rétabli.');
  }

  /* ---------- Coups ---------- */
  function doMove(source, target) {
    const snapshot = cloneState();
    const res = R.applyMove(state, source, target);
    if (!res) { sound.error(); return false; }
    pushHistory(snapshot);
    startClock();
    selectedSource = null;
    flipId = null;
    if (res.flipped && source.zone === 'tableau') {
      const col = state.tableau[source.col];
      flipId = col[col.length - 1].id;
    }
    (target.zone === 'foundation' ? sound.foundation : sound.move)();
    const lead = res.cards[0];
    setStatus(target.zone === 'foundation'
      ? `${cardName(lead)} placé sur la fondation.`
      : `${cardName(lead)}${res.cards.length > 1 ? ` (+${res.cards.length - 1})` : ''} déplacé vers la colonne ${target.col + 1}.`);
    render();
    afterMove();
    return true;
  }

  function doDraw() {
    const snapshot = cloneState();
    const info = R.drawFromStock(state);
    if (!info) { setStatus('La pioche et la défausse sont vides.'); return false; }
    pushHistory(snapshot);
    startClock();
    selectedSource = null;
    flipId = null;
    sound.draw();
    setStatus(info.type === 'draw'
      ? `Tirage de ${info.count} carte${info.count > 1 ? 's' : ''} depuis la pioche.`
      : 'Défausse recyclée dans la pioche.');
    render();
    afterMove();
    return true;
  }

  function afterMove() {
    persist();
    if (R.isWon(state)) { handleWin(); return; }
    if (!isAutoCompleting && state.moves > 0 && !stuckNotified && !R.hasAnyMove(state)) {
      stuckNotified = true;
      setStatus('😕 Plus de coups évidents : annulez un coup ou démarrez une nouvelle partie.');
      showToast('Plus de coups possibles.', 'Nouvelle partie', () => confirmNewGame(), 9000);
    }
  }

  function handleWin() {
    state.won = true;
    stopClock();
    if (timerSeconds > 30) state.score += Math.floor(700000 / timerSeconds);
    Store.recordWin({ score: state.score, time: timerSeconds, moves: state.moves });
    Store.clearSave();
    isAutoCompleting = false;
    sound.win();
    render();
    setStatus('🎉 Victoire ! Toutes les cartes sont réunies sur les fondations !');
    victoryStats.innerHTML = `Score final : <strong>${state.score}</strong> pts<br/>
      Temps : <strong>${formatTime(timerSeconds)}</strong> &bull; Coups : <strong>${state.moves}</strong>`;
    victoryBanner.classList.add('active');
    startCascadeAnimation();
  }

  /* Envoi automatique d'une carte (double-clic / double-tap / clic droit / Entrée). */
  function tryAutoMoveFrom(source) {
    const moving = R.getMovingCards(state, source);
    if (!moving.length) return false;
    const lead = moving[0];

    if (moving.length === 1 && source.zone !== 'foundation') {
      const f = R.SUIT_INDEX[lead.suit];
      if (R.canMoveToFoundation(state, lead, f)) return doMove(source, { zone: 'foundation', col: f });
    }
    for (let c = 0; c < 7; c++) {
      if (source.zone === 'tableau' && source.col === c) continue;
      if (!R.canMoveToTableau(state, lead, c)) continue;
      if (source.zone === 'tableau' && source.index === 0 && state.tableau[c].length === 0) continue;
      return doMove(source, { zone: 'tableau', col: c });
    }
    sound.error();
    return false;
  }

  /* ---------- Fin automatique (suit la solution du solveur) ---------- */
  function canAutoComplete() {
    if (state.won) return false;
    return state.tableau.every(col => col.every(c => c.faceUp));
  }

  function runAutoComplete() {
    if (isAutoCompleting || state.won || !canAutoComplete()) return;
    isAutoCompleting = true;
    btnAutoComplete.style.display = 'none';
    setStatus('⚡ Auto-complétion en cours…');

    const plan = R.solve(R.toSolverState(state), { nodeLimit: 40000 });
    const steps = plan.solved ? plan.path.slice() : null;
    let idleDraws = 0;
    let lastTotal = state.foundations.reduce((a, f) => a + f.length, 0);

    function stop(msg) {
      isAutoCompleting = false;
      render();
      if (msg) setStatus(msg);
    }

    function next() {
      if (!isAutoCompleting || state.won) return;
      if (steps) {
        const step = steps.shift();
        if (!step) return stop();
        const ui = R.stepToUiMove(state, step);
        const ok = ui && (ui.draw ? doDraw() : doMove(ui.source, ui.target));
        if (!ok) return stop('Auto-complétion interrompue.');
        if (!state.won) setTimeout(next, 70);
        return;
      }
      // Repli : coups vers les fondations, puis pioche, avec garde anti-boucle.
      let best = null;
      const consider = (card, source) => {
        const f = R.SUIT_INDEX[card.suit];
        if (R.canMoveToFoundation(state, card, f) && (!best || card.rank < best.rank)) {
          best = { rank: card.rank, source, target: { zone: 'foundation', col: f } };
        }
      };
      if (state.waste.length) consider(state.waste[state.waste.length - 1], { zone: 'waste', index: state.waste.length - 1 });
      state.tableau.forEach((col, c) => {
        if (col.length) consider(col[col.length - 1], { zone: 'tableau', col: c, index: col.length - 1 });
      });
      if (best) { doMove(best.source, best.target); if (!state.won) setTimeout(next, 70); return; }
      if (state.stock.length || state.waste.length) {
        const total = state.foundations.reduce((a, f) => a + f.length, 0);
        if (total !== lastTotal) { lastTotal = total; idleDraws = 0; }
        if (++idleDraws > state.stock.length + state.waste.length + 2) {
          return stop('Auto-complétion arrêtée : aucun coup automatique possible.');
        }
        doDraw();
        setTimeout(next, 70);
        return;
      }
      stop();
    }
    next();
  }

  /* ---------- Indice (basé sur le solveur) ---------- */
  function clearHints() {
    document.querySelectorAll('.hint-glow').forEach(el => el.classList.remove('hint-glow'));
  }

  function glowCard(card) {
    const el = document.querySelector(`.card[data-card-id="${card.id}"]`);
    if (el) el.classList.add('hint-glow');
  }

  function glowTarget(container) {
    const el = container.querySelector('.card:last-child') || container.querySelector('.slot') || container;
    el.classList.add('hint-glow');
  }

  function showHint() {
    clearHints();
    if (state.won) return;
    setStatus('💡 Recherche du meilleur coup…');
    const hint = R.findHint(state, 15000);
    if (!hint) {
      setStatus(R.hasAnyMove(state)
        ? 'Aucune solution trouvée depuis cette position : essayez d’annuler un coup.'
        : 'Aucun coup possible : annulez un coup ou démarrez une nouvelle partie.');
      return;
    }
    if (hint.draw) {
      stockSlot.classList.add('hint-glow');
      setStatus('💡 Indice : piochez une nouvelle carte.');
    } else {
      const lead = R.getMovingCards(state, hint.source)[0];
      glowCard(lead);
      glowTarget(hint.target.zone === 'foundation' ? foundationSlots[hint.target.col] : tableauCols[hint.target.col]);
      setStatus(hint.target.zone === 'foundation'
        ? `💡 Indice : placez ${cardName(lead)} sur la fondation.`
        : `💡 Indice : déplacez ${cardName(lead)} vers la colonne ${hint.target.col + 1}.`);
    }
    setTimeout(clearHints, 2600);
  }

  /* ---------- Rendu ---------- */
  function updateHUD() {
    scoreEl.textContent = state.score;
    timeEl.textContent = formatTime(timerSeconds);
    movesEl.textContent = state.moves;
    btnUndo.disabled = !history.length || state.won;
    btnRedo.disabled = !redoStack.length || state.won;
    dealBadge.textContent = `Donne #${dealSeed}${dealVerified ? ' ✓' : ''}`;
  }

  function isSourceSelected(src) {
    return !!selectedSource && selectedSource.zone === src.zone &&
      selectedSource.col === src.col && selectedSource.index === src.index;
  }

  function render() {
    // 1. Positions précédentes pour l'animation de déplacement
    const animate = !noAnimateNext && !reducedMotion();
    const previous = new Map();
    let stockRect = null;
    if (animate) {
      document.querySelectorAll('.card[data-card-id]').forEach(el => previous.set(el.dataset.cardId, el.getBoundingClientRect()));
      stockRect = stockSlot.getBoundingClientRect();
    }

    updateHUD();

    // 2. Pioche
    stockSlot.querySelectorAll('.card').forEach(el => el.remove());
    if (state.stock.length) {
      const depth = Math.min(3, Math.ceil(state.stock.length / 8));
      for (let i = 0; i < depth; i++) {
        const el = createCardElement({ ...state.stock[state.stock.length - 1], faceUp: false });
        el.style.top = `${-i * 2}px`;
        el.style.left = `${-i * 2}px`;
        stockSlot.appendChild(el);
      }
    }

    // 3. Défausse
    wasteSlot.innerHTML = '';
    if (state.waste.length) {
      const visible = state.drawCount === 3 ? Math.min(3, state.waste.length) : 1;
      const start = state.waste.length - visible;
      for (let i = 0; i < visible; i++) {
        const card = state.waste[start + i];
        const isTop = i === visible - 1;
        const el = createCardElement(card);
        el.style.left = `${i * 18}px`;
        el.style.zIndex = i + 1;
        if (isTop) {
          const src = { zone: 'waste', index: state.waste.length - 1 };
          if (isSourceSelected(src)) el.classList.add('selected');
          attachCardInteractions(el, src, true);
        } else {
          el.classList.remove('playable');
          el.style.cursor = 'default';
        }
        wasteSlot.appendChild(el);
      }
    }

    // 4. Fondations
    foundationSlots.forEach((slot, f) => {
      slot.querySelectorAll('.card').forEach(el => el.remove());
      const pile = state.foundations[f];
      if (pile.length) {
        const el = createCardElement(pile[pile.length - 1]);
        const src = { zone: 'foundation', col: f, index: pile.length - 1 };
        if (isSourceSelected(src)) el.classList.add('selected');
        attachCardInteractions(el, src, true);
        slot.appendChild(el);
      }
    });

    // 5. Tableau
    const downOffset = cssPx('--stack-offset-down', 13);
    const upOffset = cssPx('--stack-offset-up', 26);
    tableauCols.forEach((colEl, colIdx) => {
      colEl.querySelectorAll('.card').forEach(el => el.remove());
      const cards = state.tableau[colIdx];
      let top = 0;
      cards.forEach((card, idx) => {
        const el = createCardElement(card);
        el.style.top = `${top}px`;
        el.style.zIndex = idx + 1;
        if (card.faceUp) {
          const src = { zone: 'tableau', col: colIdx, index: idx };
          if (isSourceSelected(src)) el.classList.add('selected');
          attachCardInteractions(el, src, idx === cards.length - 1);
          top += upOffset;
        } else {
          top += downOffset;
        }
        colEl.appendChild(el);
      });
      colEl.style.height = `${Math.max(150, top + 130)}px`;
    });

    btnAutoComplete.style.display = canAutoComplete() ? 'inline-flex' : 'none';

    // 6. Animation de déplacement (technique FLIP)
    if (animate && previous.size) {
      document.querySelectorAll('.card[data-card-id]').forEach(el => {
        let from = previous.get(el.dataset.cardId);
        if (!from && el.parentElement === wasteSlot) from = stockRect;
        if (!from) return;
        const to = el.getBoundingClientRect();
        const dx = from.left - to.left;
        const dy = from.top - to.top;
        if (Math.abs(dx) + Math.abs(dy) < 2) return;
        el.animate(
          [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }],
          { duration: 190, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' }
        );
      });
    }
    noAnimateNext = false;
    flipId = null;
  }

  /* ---------- Entrées : pointeur, tap, clavier ---------- */
  function attachCardInteractions(cardEl, source, focusable) {
    cardEl.tabIndex = focusable ? 0 : -1;

    cardEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        if (!state.won && !isAutoCompleting) tryAutoMoveFrom(source);
      }
    });

    cardEl.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!state.won && !isAutoCompleting) tryAutoMoveFrom(source);
    });

    cardEl.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || state.won || isAutoCompleting) return;
      e.stopPropagation();
      clearHints();

      const moving = R.getMovingCards(state, source);
      if (!moving.length) return;

      const rect = cardEl.getBoundingClientRect();
      let domElements = [cardEl];
      if (source.zone === 'tableau') {
        domElements = Array.from(tableauCols[source.col].querySelectorAll('.card')).slice(source.index);
      }

      dragSession = {
        source, movingCards: moving, domElements,
        startX: e.clientX, startY: e.clientY,
        offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top,
        isDragging: false
      };

      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerCancel);
    });
  }

  function onPointerMove(e) {
    if (!dragSession) return;
    const dx = e.clientX - dragSession.startX;
    const dy = e.clientY - dragSession.startY;

    if (!dragSession.isDragging && Math.hypot(dx, dy) > 5) {
      dragSession.isDragging = true;
      selectedSource = null;
      dragLayer.innerHTML = '';
      const upOffset = cssPx('--stack-offset-up', 26);
      dragSession.movingCards.forEach((c, idx) => {
        const clone = createCardElement(c);
        clone.removeAttribute('data-card-id');
        clone.style.top = `${idx * upOffset}px`;
        clone.style.left = '0px';
        dragLayer.appendChild(clone);
      });
      dragSession.domElements.forEach(el => { el.style.opacity = '0'; });
    }

    if (dragSession.isDragging) {
      dragLayer.style.transform = `translate3d(${e.clientX - dragSession.offsetX}px, ${e.clientY - dragSession.offsetY}px, 0)`;
      highlightValidDropTarget(e.clientX, e.clientY);
    }
  }

  function highlightValidDropTarget(x, y) {
    document.querySelectorAll('.slot.drop-valid').forEach(el => el.classList.remove('drop-valid'));
    const target = findBestDropTarget(x, y, dragSession.source, dragSession.movingCards);
    if (!target) return;
    if (target.zone === 'foundation') foundationSlots[target.col].classList.add('drop-valid');
    else tableauCols[target.col].querySelector('.slot').classList.add('drop-valid');
  }

  function overlapArea(a, b) {
    const w = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
    const h = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    return w * h;
  }

  function findBestDropTarget(clientX, clientY, source, movingCards) {
    const lead = movingCards[0];
    const cardW = stockSlot.offsetWidth || 85;
    const cardH = stockSlot.offsetHeight || 120;
    const left = clientX - (dragSession ? dragSession.offsetX : cardW / 2);
    const top = clientY - (dragSession ? dragSession.offsetY : cardH / 2);
    const dragRect = { left, right: left + cardW, top, bottom: top + cardH };

    let best = null;
    let bestArea = 0;

    if (movingCards.length === 1 && source.zone !== 'foundation') {
      foundationSlots.forEach((slot, f) => {
        if (!R.canMoveToFoundation(state, lead, f)) return;
        const area = overlapArea(dragRect, slot.getBoundingClientRect());
        if (area > bestArea) { bestArea = area; best = { zone: 'foundation', col: f }; }
      });
    }

    tableauCols.forEach((colEl, c) => {
      if (source.zone === 'tableau' && source.col === c) return;
      if (!R.canMoveToTableau(state, lead, c)) return;
      if (source.zone === 'tableau' && source.index === 0 && state.tableau[c].length === 0) return;
      const last = colEl.querySelector('.card:last-child') || colEl.querySelector('.slot');
      const r = last.getBoundingClientRect();
      const area = overlapArea(dragRect, { left: r.left - 8, right: r.right + 8, top: r.top - 10, bottom: r.bottom + 45 });
      if (area > bestArea) { bestArea = area; best = { zone: 'tableau', col: c }; }
    });
    return best;
  }

  function endDrag() {
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerCancel);
    document.querySelectorAll('.slot.drop-valid').forEach(el => el.classList.remove('drop-valid'));
    dragLayer.innerHTML = '';
  }

  function onPointerUp(e) {
    endDrag();
    if (!dragSession) return;
    const session = dragSession;
    dragSession = null;

    if (session.isDragging) {
      const target = findBestDropTarget(e.clientX, e.clientY, session.source, session.movingCards);
      noAnimateNext = true; // la carte arrive depuis la position du doigt/curseur
      if (target && doMove(session.source, target)) return;
      noAnimateNext = false;
      session.domElements.forEach(el => { el.style.opacity = '1'; });
      return;
    }

    // Double-clic / double-tap : envoi automatique (fiable malgré le re-rendu du DOM)
    const key = `${session.source.zone}:${session.source.col}:${session.source.index}`;
    const now = Date.now();
    if (lastTap.key === key && now - lastTap.time < 350) {
      lastTap = { key: null, time: 0 };
      selectedSource = null;
      if (!tryAutoMoveFrom(session.source)) render();
      return;
    }
    lastTap = { key, time: now };

    if (selectedSource && !isSourceSelected(session.source)) {
      if (session.source.zone === 'foundation' || session.source.zone === 'tableau') {
        if (doMove(selectedSource, { zone: session.source.zone, col: session.source.col })) return;
      }
    }
    selectedSource = isSourceSelected(session.source) ? null : session.source;
    render();
  }

  function onPointerCancel() {
    endDrag();
    dragSession = null;
    render();
  }

  foundationSlots.forEach((slot, f) => {
    slot.addEventListener('click', () => { if (selectedSource) doMove(selectedSource, { zone: 'foundation', col: f }); });
  });
  tableauCols.forEach((colEl, c) => {
    colEl.addEventListener('click', () => { if (selectedSource) doMove(selectedSource, { zone: 'tableau', col: c }); });
  });
  document.body.addEventListener('click', (e) => {
    const cl = e.target.classList;
    if ((e.target === document.body || cl.contains('table-wrap') || cl.contains('tableau-zone')) && selectedSource) {
      selectedSource = null;
      render();
    }
  });

  stockSlot.addEventListener('click', () => { if (!state.won && !isAutoCompleting) doDraw(); });
  stockSlot.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && !state.won && !isAutoCompleting) { e.preventDefault(); doDraw(); }
  });

  /* ---------- Cascade de victoire ---------- */
  function sizeVictoryCanvas() {
    victoryCanvas.width = window.innerWidth;
    victoryCanvas.height = window.innerHeight;
  }

  function startCascadeAnimation() {
    stopCascadeAnimation();
    if (reducedMotion()) return;
    const ctx = victoryCanvas.getContext('2d');
    sizeVictoryCanvas();
    const cardW = stockSlot.offsetWidth || 90;
    const cardH = stockSlot.offsetHeight || 126;
    const queue = [];
    for (let r = 13; r >= 1; r--) {
      for (let f = 0; f < 4; f++) {
        const rect = foundationSlots[f].getBoundingClientRect();
        queue.push({
          x: rect.left, y: rect.top,
          vx: (Math.random() * 6 + 2.5) * (Math.random() < 0.5 ? -1 : 1),
          vy: -(Math.random() * 4 + 1),
          suit: SUITS[f].symbol,
          color: SUITS[f].color === 'red' ? '#d31920' : '#14171a',
          label: R.LABELS[r - 1]
        });
      }
    }
    let active = queue.shift();

    function drawMini(c) {
      ctx.save();
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(c.x, c.y, cardW, cardH, 6); else ctx.rect(c.x, c.y, cardW, cardH);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = c.color;
      ctx.font = `bold ${Math.round(cardW * 0.2)}px Arial`;
      ctx.fillText(`${c.label}${c.suit}`, c.x + 6, c.y + Math.round(cardW * 0.24));
      ctx.font = `${Math.round(cardW * 0.42)}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(c.suit, c.x + cardW / 2, c.y + cardH / 2);
      ctx.restore();
    }

    function tick() {
      if (!active) return;
      active.x += active.vx;
      active.vy += 0.48;
      active.y += active.vy;
      if (active.y + cardH >= victoryCanvas.height) {
        active.y = victoryCanvas.height - cardH;
        active.vy = -active.vy * 0.82;
      }
      drawMini(active);
      if (active.x < -cardW || active.x > victoryCanvas.width + cardW) active = queue.shift() || null;
      if (active) cascadeAnimId = requestAnimationFrame(tick);
    }
    cascadeAnimId = requestAnimationFrame(tick);
  }

  function stopCascadeAnimation() {
    if (cascadeAnimId) { cancelAnimationFrame(cascadeAnimId); cascadeAnimId = null; }
    const ctx = victoryCanvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, victoryCanvas.width, victoryCanvas.height);
  }

  /* ---------- Réglages, statistiques, menu ---------- */
  function applySettings() {
    document.body.dataset.felt = settings.felt;
    document.body.dataset.cardback = settings.cardback;
    document.body.dataset.fourcolor = settings.fourColor ? 'on' : 'off';
    feltSelect.value = settings.felt;
    cardbackSelect.value = settings.cardback;
    optFourColor.checked = !!settings.fourColor;
    optSound.checked = !!settings.sound;
    optWinnable.checked = !!settings.winnable;
    drawModeSelect.value = String(settings.drawMode);
  }

  function renderStats() {
    const s = Store.getStats();
    const rate = s.played ? Math.round((s.won / s.played) * 100) : 0;
    const items = [
      ['Parties jouées', s.played],
      ['Victoires', s.won],
      ['Taux de victoire', `${rate} %`],
      ['Meilleur score', s.bestScore],
      ['Meilleur temps', s.bestTime === null ? '—' : formatTime(s.bestTime)],
      ['Moins de coups', s.bestMoves === null ? '—' : s.bestMoves],
      ['Série en cours', s.streak],
      ['Meilleure série', s.bestStreak]
    ];
    statsGrid.innerHTML = items.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
  }

  function renderDealInfo() {
    dealInfo.textContent = `Donne n° ${dealSeed} — tirage ${dealDraw} — ${dealVerified ? 'gagnable (vérifiée par le solveur)' : 'non vérifiée'}`;
  }

  function saveSettings() { Store.saveSettings(settings); }

  btnMenu.addEventListener('click', () => {
    renderStats();
    renderDealInfo();
    updateInstallUi();
    if (typeof dlgMenu.showModal === 'function') dlgMenu.showModal();
  });
  dlgMenu.addEventListener('click', (e) => { if (e.target === dlgMenu) dlgMenu.close(); });

  feltSelect.addEventListener('change', () => { settings.felt = feltSelect.value; applySettings(); saveSettings(); });
  cardbackSelect.addEventListener('change', () => { settings.cardback = cardbackSelect.value; applySettings(); saveSettings(); });
  optFourColor.addEventListener('change', () => { settings.fourColor = optFourColor.checked; applySettings(); saveSettings(); });
  optSound.addEventListener('change', () => { settings.sound = optSound.checked; saveSettings(); sound.move(); });
  optWinnable.addEventListener('change', () => { settings.winnable = optWinnable.checked; saveSettings(); });

  $('btn-reset-stats').addEventListener('click', () => {
    if (window.confirm('Réinitialiser toutes les statistiques ?')) { Store.resetStats(); renderStats(); }
  });

  $('btn-replay').addEventListener('click', () => {
    dlgMenu.close();
    confirmNewGame({ seed: dealSeed, order: initialOrder, verified: dealVerified, verifiedDraw: dealDraw });
  });

  $('btn-play-seed').addEventListener('click', () => {
    const n = parseInt($('seed-input').value, 10);
    if (!n || n < 1) { showToast('Entrez un numéro de donne valide.', null, null, 3000); return; }
    dlgMenu.close();
    confirmNewGame({ seed: n });
  });

  $('btn-share').addEventListener('click', async () => {
    const url = `${location.origin}${location.pathname}?seed=${dealSeed}&draw=${dealDraw}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast('Lien de la donne copié dans le presse-papiers.', null, null, 3500);
    } catch (e) {
      window.prompt('Copiez le lien de la donne :', url);
    }
  });

  /* ---------- PWA : installation, hors ligne, mises à jour ---------- */
  let deferredInstall = null;
  const installBtn = $('btn-install');
  const installInfo = $('install-info');
  const isStandalone = () =>
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  function updateInstallUi() {
    installBtn.hidden = !deferredInstall;
    if (isStandalone()) installInfo.textContent = 'Application installée ✓';
    else if (deferredInstall) installInfo.textContent = 'Installez le jeu pour y jouer hors ligne, en plein écran.';
    else if (isIOS()) installInfo.textContent = 'Sur iPhone/iPad : touchez Partager puis « Sur l’écran d’accueil ».';
    else installInfo.textContent = 'Installation disponible via le menu du navigateur (⋮ ▸ Installer l’application).';
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstall = e;
    updateInstallUi();
    if (!sessionStorage.getItem('solis52.installHint')) {
      try { sessionStorage.setItem('solis52.installHint', '1'); } catch (err) { /* ignore */ }
      showToast('Installez Solis 52 pour jouer hors ligne.', 'Installer', promptInstall, 12000);
    }
  });

  async function promptInstall() {
    if (!deferredInstall) return;
    deferredInstall.prompt();
    try { await deferredInstall.userChoice; } catch (e) { /* ignore */ }
    deferredInstall = null;
    updateInstallUi();
  }
  installBtn.addEventListener('click', promptInstall);

  window.addEventListener('appinstalled', () => {
    deferredInstall = null;
    updateInstallUi();
    showToast('Solis 52 est installé !', null, null, 4000);
  });

  window.addEventListener('offline', () => showToast('Mode hors ligne : le jeu continue de fonctionner.', null, null, 4000));
  window.addEventListener('online', () => showToast('Connexion rétablie.', null, null, 2500));

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return;
      reloading = true;
      persist();
      location.reload();
    });
    navigator.serviceWorker.register('sw.js').then((reg) => {
      const offerUpdate = (worker) => showToast('Une nouvelle version est disponible.', 'Mettre à jour', () => worker.postMessage({ type: 'SKIP_WAITING' }));
      if (reg.waiting && navigator.serviceWorker.controller) offerUpdate(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const worker = reg.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) offerUpdate(worker);
        });
      });
      document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
    }).catch(() => { /* enregistrement impossible (contexte non sécurisé) */ });
  }

  /* ---------- Contrôles et raccourcis ---------- */
  btnUndo.addEventListener('click', undo);
  btnRedo.addEventListener('click', redo);
  btnHint.addEventListener('click', showHint);
  btnNew.addEventListener('click', () => confirmNewGame());
  btnVictoryNew.addEventListener('click', () => newGame());
  btnAutoComplete.addEventListener('click', runAutoComplete);

  let lastDrawMode = drawModeSelect.value;
  drawModeSelect.addEventListener('change', () => {
    if (!confirmNewGame({ drawCount: parseInt(drawModeSelect.value, 10) })) {
      drawModeSelect.value = lastDrawMode;
      return;
    }
    lastDrawMode = drawModeSelect.value;
  });

  window.addEventListener('keydown', (e) => {
    if (dlgMenu.open) return;
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'SELECT' || tag === 'INPUT' || tag === 'TEXTAREA') return;
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    if (mod && key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
    else if (mod && (key === 'y' || (key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
    else if (mod || e.altKey) return;
    else if (key === 'h') showHint();
    else if (key === 'n') confirmNewGame();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { pauseClock(); persist(); } else { resumeClock(); }
  });
  window.addEventListener('pagehide', persist);

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      noAnimateNext = true;
      render();
      if (cascadeAnimId) sizeVictoryCanvas();
    }, 80);
  });

  /* ---------- Démarrage ---------- */
  function start() {
    applySettings();
    lastDrawMode = drawModeSelect.value;
    registerServiceWorker();
    updateInstallUi();

    const params = new URLSearchParams(location.search);
    const urlSeed = parseInt(params.get('seed'), 10);
    const urlDraw = parseInt(params.get('draw'), 10);
    const wantsNew = params.get('new') === '1';
    if (params.has('seed') || params.has('new') || params.has('draw') || params.has('source')) {
      try { history_replace(); } catch (e) { /* ignore */ }
    }

    if (urlSeed > 0) {
      newGame({ seed: urlSeed, drawCount: urlDraw === 3 ? 3 : (urlDraw === 1 ? 1 : undefined) });
      return;
    }
    const save = !wantsNew && Store.getSave();
    if (save && save.state && !save.state.won && save.order) {
      restoreGame(save);
    } else {
      newGame();
    }
  }

  function history_replace() {
    window.history.replaceState(null, '', location.pathname);
  }

  start();
})();
