(() => {
  const SUITS = [
    { symbol: '♠', name: 'spades', color: 'black' },
    { symbol: '♥', name: 'hearts', color: 'red' },
    { symbol: '♣', name: 'clubs', color: 'black' },
    { symbol: '♦', name: 'diamonds', color: 'red' }
  ];

  const RANKS = [
    { value: 1, label: 'A' },
    { value: 2, label: '2' },
    { value: 3, label: '3' },
    { value: 4, label: '4' },
    { value: 5, label: '5' },
    { value: 6, label: '6' },
    { value: 7, label: '7' },
    { value: 8, label: '8' },
    { value: 9, label: '9' },
    { value: 10, label: '10' },
    { value: 11, label: 'J' },
    { value: 12, label: 'Q' },
    { value: 13, label: 'K' }
  ];

  // Authentic 3x5 Grid coordinates for pips (2 to 10)
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

  let state = {
    stock: [],
    waste: [],
    foundations: [[], [], [], []],
    tableau: [[], [], [], [], [], [], []],
    drawCount: 1,
    score: 0,
    moves: 0,
    recycles: 0,
    won: false
  };

  let history = [];
  let timerSeconds = 0;
  let timerInterval = null;
  let timerStarted = false;
  let selectedSource = null;
  let isAutoCompleting = false;
  let cascadeAnimId = null;

  const stockSlot = document.getElementById('stock-slot');
  const wasteSlot = document.getElementById('waste-slot');
  const foundationSlots = Array.from(document.querySelectorAll('.foundation-slot'));
  const tableauCols = Array.from(document.querySelectorAll('.tableau-col'));
  const scoreEl = document.getElementById('score-val');
  const timeEl = document.getElementById('time-val');
  const movesEl = document.getElementById('moves-val');
  const btnUndo = document.getElementById('btn-undo');
  const btnHint = document.getElementById('btn-hint');
  const btnNew = document.getElementById('btn-new');
  const btnAutoComplete = document.getElementById('btn-autocomplete');
  const drawModeSelect = document.getElementById('draw-mode');
  const feltThemeSelect = document.getElementById('felt-theme');
  const statusMsg = document.getElementById('status-msg');
  const dragLayer = document.getElementById('drag-layer');
  const victoryCanvas = document.getElementById('victory-canvas');
  const victoryBanner = document.getElementById('victory-banner');
  const victoryStats = document.getElementById('victory-stats');
  const btnVictoryNew = document.getElementById('btn-victory-new');

  function cloneState(s) {
    return JSON.parse(JSON.stringify(s));
  }

  function saveHistory() {
    history.push(cloneState(state));
    if (history.length > 120) history.shift();
    btnUndo.disabled = history.length === 0;
  }

  function startTimerIfNeeded() {
    if (timerStarted || state.won) return;
    timerStarted = true;
    timerInterval = setInterval(() => {
      timerSeconds++;
      updateHUD();
    }, 1000);
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    timerStarted = false;
  }

  function formatTime(sec) {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  function setStatus(text) {
    statusMsg.textContent = text;
  }

  function createShuffledDeck() {
    const deck = [];
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        deck.push({
          id: `${rank.label}${suit.symbol}`,
          suit: suit.symbol,
          suitName: suit.name,
          color: suit.color,
          rank: rank.value,
          label: rank.label,
          faceUp: false
        });
      }
    }
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  function initGame() {
    stopCascadeAnimation();
    victoryBanner.classList.remove('active');
    isAutoCompleting = false;
    selectedSource = null;
    history = [];
    btnUndo.disabled = true;

    stopTimer();
    timerSeconds = 0;

    const deck = createShuffledDeck();
    const tableau = [[], [], [], [], [], [], []];

    for (let col = 0; col < 7; col++) {
      for (let row = 0; row <= col; row++) {
        const card = deck.pop();
        card.faceUp = (row === col);
        tableau[col].push(card);
      }
    }

    const stock = deck.map(c => ({ ...c, faceUp: false }));

    state = {
      stock,
      waste: [],
      foundations: [[], [], [], []],
      tableau,
      drawCount: parseInt(drawModeSelect.value, 10) || 1,
      score: 0,
      moves: 0,
      recycles: 0,
      won: false
    };

    render();
    setStatus(`Nouvelle partie distribuée (Tirage ${state.drawCount} carte${state.drawCount > 1 ? 's' : ''}). Bonne chance !`);
  }

  function createCardElement(card) {
    const el = document.createElement('div');
    el.className = `card ${card.color} ${card.faceUp ? 'face-up playable' : 'face-down'}`;
    if (card.faceUp) el.dataset.cardId = card.id;

    if (!card.faceUp) {
      el.innerHTML = `<div class="card-back-pattern"></div>`;
      return el;
    }

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
        </div>
      `;
    } else {
      const coords = PIP_LAYOUTS[card.rank] || [];
      const pips = coords.map(([r, c, flip]) =>
        `<span class="pip ${flip ? 'flip' : ''}" style="grid-row:${r};grid-column:${c};">${card.suit}</span>`
      ).join('');
      centerHTML = `<div class="pips-grid">${pips}</div>`;
    }

    el.innerHTML = `
      <div class="card-corner top-left">
        <span class="corner-rank">${card.label}</span>
        <span class="corner-suit">${card.suit}</span>
      </div>
      <div class="card-center">${centerHTML}</div>
      <div class="card-corner bottom-right">
        <span class="corner-rank">${card.label}</span>
        <span class="corner-suit">${card.suit}</span>
      </div>
    `;
    return el;
  }

  function canMoveToFoundation(card, foundIdx) {
    const pile = state.foundations[foundIdx];
    if (pile.length === 0) {
      // Chaque fondation est dédiée à l'enseigne indiquée par son filigrane
      return card.rank === 1 && SUITS[foundIdx].symbol === card.suit;
    }
    const top = pile[pile.length - 1];
    return top.suit === card.suit && card.rank === top.rank + 1;
  }

  // Mesure réelle en pixels d'une variable CSS (gère clamp(), vw, etc.)
  function cssPx(varName, fallback) {
    const probe = document.createElement('div');
    probe.style.cssText = `position:absolute;visibility:hidden;pointer-events:none;width:0;height:var(${varName});`;
    document.body.appendChild(probe);
    const px = probe.offsetHeight;
    probe.remove();
    return px || fallback;
  }

  let lastTap = { key: null, time: 0 };

  function canMoveToTableau(leadingCard, colIdx) {
    const col = state.tableau[colIdx];
    if (col.length === 0) {
      return leadingCard.rank === 13;
    }
    const top = col[col.length - 1];
    return top.faceUp && top.color !== leadingCard.color && top.rank === leadingCard.rank + 1;
  }

  function getMovingCards(source) {
    if (!source) return [];
    if (source.zone === 'waste') {
      if (state.waste.length === 0) return [];
      return [state.waste[state.waste.length - 1]];
    }
    if (source.zone === 'foundation') {
      const pile = state.foundations[source.col];
      if (pile.length === 0) return [];
      return [pile[pile.length - 1]];
    }
    if (source.zone === 'tableau') {
      const col = state.tableau[source.col];
      if (source.index < 0 || source.index >= col.length) return [];
      const slice = col.slice(source.index);
      if (!slice[0].faceUp) return [];
      return slice;
    }
    return [];
  }

  function executeMove(source, target) {
    const moving = getMovingCards(source);
    if (moving.length === 0) return false;
    const leadCard = moving[0];

    if (target.zone === 'foundation') {
      if (moving.length !== 1) return false;
      if (!canMoveToFoundation(leadCard, target.col)) return false;
      if (source.zone === 'foundation' && source.col === target.col) return false;

      saveHistory();
      startTimerIfNeeded();

      removeCardsFromSource(source, 1);
      state.foundations[target.col].push(leadCard);

      if (source.zone === 'waste') state.score += 10;
      else if (source.zone === 'tableau') state.score += 10;

      flipExposedTableauCard(source);
      state.moves++;
      selectedSource = null;
      render();
      setStatus(`${leadCard.label}${leadCard.suit} placé sur la fondation.`);
      checkWinOrAutoComplete();
      return true;
    }

    if (target.zone === 'tableau') {
      if (source.zone === 'tableau' && source.col === target.col) return false;
      if (!canMoveToTableau(leadCard, target.col)) return false;

      saveHistory();
      startTimerIfNeeded();

      removeCardsFromSource(source, moving.length);
      state.tableau[target.col].push(...moving);

      if (source.zone === 'waste') state.score += 5;
      else if (source.zone === 'foundation') state.score = Math.max(0, state.score - 15);

      flipExposedTableauCard(source);
      state.moves++;
      selectedSource = null;
      render();
      setStatus(`${leadCard.label}${leadCard.suit}${moving.length > 1 ? ` (+${moving.length - 1})` : ''} déplacé vers la colonne ${target.col + 1}.`);
      checkWinOrAutoComplete();
      return true;
    }

    return false;
  }

  function removeCardsFromSource(source, count) {
    if (source.zone === 'waste') {
      state.waste.pop();
    } else if (source.zone === 'foundation') {
      state.foundations[source.col].pop();
    } else if (source.zone === 'tableau') {
      state.tableau[source.col].splice(source.index, count);
    }
  }

  function flipExposedTableauCard(source) {
    if (source.zone === 'tableau') {
      const col = state.tableau[source.col];
      if (col.length > 0 && !col[col.length - 1].faceUp) {
        col[col.length - 1].faceUp = true;
        state.score += 5;
      }
    }
  }

  function handleStockClick() {
    if (state.won || isAutoCompleting) return;
    drawFromStock();
  }

  function drawFromStock() {
    selectedSource = null;

    if (state.stock.length > 0) {
      saveHistory();
      startTimerIfNeeded();
      const count = Math.min(state.drawCount, state.stock.length);
      for (let i = 0; i < count; i++) {
        const card = state.stock.pop();
        card.faceUp = true;
        state.waste.push(card);
      }
      state.moves++;
      render();
      setStatus(`Tirage de ${count} carte${count > 1 ? 's' : ''} depuis la pioche.`);
      checkWinOrAutoComplete();
    } else if (state.waste.length > 0) {
      saveHistory();
      startTimerIfNeeded();
      while (state.waste.length > 0) {
        const card = state.waste.pop();
        card.faceUp = false;
        state.stock.push(card);
      }
      state.recycles++;
      if (state.drawCount === 1 && state.recycles > 1) {
        state.score = Math.max(0, state.score - 100);
      } else if (state.drawCount === 3 && state.recycles > 3) {
        state.score = Math.max(0, state.score - 20);
      }
      state.moves++;
      render();
      setStatus('Défausse recyclée dans la pioche.');
    } else {
      setStatus('La pioche et la défausse sont vides.');
    }
  }

  function tryAutoMoveFrom(source) {
    const moving = getMovingCards(source);
    if (moving.length === 0) return false;
    const leadCard = moving[0];

    if (moving.length === 1 && source.zone !== 'foundation') {
      for (let f = 0; f < 4; f++) {
        const slotSuit = foundationSlots[f].dataset.suit;
        if (state.foundations[f].length === 0 && leadCard.rank === 1 && slotSuit === leadCard.suit) {
          return executeMove(source, { zone: 'foundation', col: f });
        }
      }
      for (let f = 0; f < 4; f++) {
        if (canMoveToFoundation(leadCard, f)) {
          return executeMove(source, { zone: 'foundation', col: f });
        }
      }
    }

    for (let c = 0; c < 7; c++) {
      if (source.zone === 'tableau' && source.col === c) continue;
      if (canMoveToTableau(leadCard, c)) {
        return executeMove(source, { zone: 'tableau', col: c });
      }
    }
    return false;
  }

  function canAutoComplete() {
    if (state.won) return false;
    const totalInFoundations = state.foundations.reduce((acc, f) => acc + f.length, 0);
    if (totalInFoundations === 52) return false;

    const allTableauFaceUp = state.tableau.every(col => col.every(c => c.faceUp));
    if (!allTableauFaceUp) return false;

    if (state.stock.length === 0 && state.waste.length === 0) return true;
    if (state.drawCount === 1 && allTableauFaceUp) return true;
    return false;
  }

  function checkWinOrAutoComplete() {
    const totalInFoundations = state.foundations.reduce((acc, f) => acc + f.length, 0);
    btnAutoComplete.style.display = canAutoComplete() ? 'inline-flex' : 'none';

    if (totalInFoundations === 52 && !state.won) {
      state.won = true;
      isAutoCompleting = false;
      btnAutoComplete.style.display = 'none';
      stopTimer();
      if (timerSeconds > 30) {
        state.score += Math.floor(700000 / timerSeconds);
      }
      updateHUD();
      setStatus('🎉 Victoire ! Toutes les cartes sont réunies sur les fondations !');
      victoryStats.innerHTML = `
        Score final : <strong>${state.score}</strong> pts<br/>
        Temps : <strong>${formatTime(timerSeconds)}</strong> &bull; Coups : <strong>${state.moves}</strong>
      `;
      victoryBanner.classList.add('active');
      startCascadeAnimation();
    }
  }

  function runAutoComplete() {
    if (isAutoCompleting || state.won) return;
    isAutoCompleting = true;
    btnAutoComplete.style.display = 'none';
    setStatus('⚡ Auto-complétion en cours...');
    let idleDraws = 0;
    let lastTotal = state.foundations.reduce((a, f) => a + f.length, 0);

    function step() {
      if (state.won || !isAutoCompleting) return;

      if (state.waste.length > 0) {
        const topW = state.waste[state.waste.length - 1];
        for (let f = 0; f < 4; f++) {
          if (canMoveToFoundation(topW, f)) {
            executeMove({ zone: 'waste' }, { zone: 'foundation', col: f });
            setTimeout(step, 65);
            return;
          }
        }
      }

      let bestMove = null;
      for (let c = 0; c < 7; c++) {
        const col = state.tableau[c];
        if (col.length === 0) continue;
        const topC = col[col.length - 1];
        for (let f = 0; f < 4; f++) {
          if (canMoveToFoundation(topC, f)) {
            if (!bestMove || topC.rank < bestMove.rank) {
              bestMove = {
                rank: topC.rank,
                source: { zone: 'tableau', col: c, index: col.length - 1 },
                target: { zone: 'foundation', col: f }
              };
            }
          }
        }
      }

      if (bestMove) {
        executeMove(bestMove.source, bestMove.target);
        setTimeout(step, 65);
        return;
      }

      if (state.stock.length > 0 || state.waste.length > 0) {
        const total = state.foundations.reduce((a, f) => a + f.length, 0);
        if (total !== lastTotal) {
          lastTotal = total;
          idleDraws = 0;
        }
        idleDraws++;
        if (idleDraws > state.stock.length + state.waste.length + 2) {
          isAutoCompleting = false;
          render();
          setStatus('Auto-complétion arrêtée : aucun coup possible automatiquement.');
          return;
        }
        drawFromStock();
        setTimeout(step, 65);
        return;
      }

      isAutoCompleting = false;
    }

    step();
  }

  function showHint() {
    clearHints();
    if (state.won) return;

    for (let c = 0; c < 7; c++) {
      const col = state.tableau[c];
      if (col.length === 0) continue;
      const card = col[col.length - 1];
      for (let f = 0; f < 4; f++) {
        if (canMoveToFoundation(card, f)) {
          highlightHint(card.id, foundationSlots[f]);
          setStatus(`💡 Indice : Placez ${card.label}${card.suit} sur la fondation.`);
          return;
        }
      }
    }

    if (state.waste.length > 0) {
      const wCard = state.waste[state.waste.length - 1];
      for (let f = 0; f < 4; f++) {
        if (canMoveToFoundation(wCard, f)) {
          highlightHint(wCard.id, foundationSlots[f]);
          setStatus(`💡 Indice : Placez ${wCard.label}${wCard.suit} de la défausse sur la fondation.`);
          return;
        }
      }
    }

    for (let c = 0; c < 7; c++) {
      const col = state.tableau[c];
      const firstUpIdx = col.findIndex(card => card.faceUp);
      if (firstUpIdx === -1) continue;
      const leadCard = col[firstUpIdx];

      const hasKingWaiting = state.waste.some((w, idx) => idx === state.waste.length - 1 && w.rank === 13) ||
        state.tableau.some(tc => {
          const idx = tc.findIndex(x => x.faceUp);
          return idx > 0 && tc[idx].rank === 13;
        });
      if (firstUpIdx === 0 && leadCard.rank === 13) continue;
      if (firstUpIdx === 0 && !hasKingWaiting) continue;

      for (let targetCol = 0; targetCol < 7; targetCol++) {
        if (targetCol === c) continue;
        if (canMoveToTableau(leadCard, targetCol)) {
          highlightHint(leadCard.id, tableauCols[targetCol]);
          setStatus(`💡 Indice : Déplacez ${leadCard.label}${leadCard.suit} vers la colonne ${targetCol + 1}.`);
          return;
        }
      }
    }

    if (state.waste.length > 0) {
      const wCard = state.waste[state.waste.length - 1];
      for (let targetCol = 0; targetCol < 7; targetCol++) {
        if (canMoveToTableau(wCard, targetCol)) {
          highlightHint(wCard.id, tableauCols[targetCol]);
          setStatus(`💡 Indice : Jouez ${wCard.label}${wCard.suit} de la défausse vers la colonne ${targetCol + 1}.`);
          return;
        }
      }
    }

    if (state.stock.length > 0 || state.waste.length > 0) {
      stockSlot.classList.add('hint-glow');
      setTimeout(clearHints, 2200);
      setStatus('💡 Indice : Piochez une nouvelle carte dans le talon.');
      return;
    }

    setStatus('Aucun coup évident trouvé. Essayez d’annuler ou de piocher.');
  }

  function highlightHint(cardId, targetContainer) {
    const cardEl = document.querySelector(`.card[data-card-id="${cardId}"]`);
    if (cardEl) cardEl.classList.add('hint-glow');
    if (targetContainer) {
      const lastCard = targetContainer.querySelector('.card:last-child') || targetContainer.querySelector('.slot') || targetContainer;
      lastCard.classList.add('hint-glow');
    }
    setTimeout(clearHints, 2200);
  }

  function clearHints() {
    document.querySelectorAll('.hint-glow').forEach(el => el.classList.remove('hint-glow'));
  }

  function updateHUD() {
    scoreEl.textContent = state.score;
    timeEl.textContent = formatTime(timerSeconds);
    movesEl.textContent = state.moves;
    btnUndo.disabled = history.length === 0;
  }

  function render() {
    updateHUD();

    // 1. Stock
    stockSlot.querySelectorAll('.card').forEach(el => el.remove());
    if (state.stock.length > 0) {
      const depth = Math.min(3, Math.ceil(state.stock.length / 8));
      for (let i = 0; i < depth; i++) {
        const topCard = state.stock[state.stock.length - 1];
        const el = createCardElement({ ...topCard, faceUp: false });
        el.style.top = `${-i * 2}px`;
        el.style.left = `${-i * 2}px`;
        stockSlot.appendChild(el);
      }
    }

    // 2. Waste
    wasteSlot.innerHTML = '';
    if (state.waste.length > 0) {
      const visibleCount = state.drawCount === 3 ? Math.min(3, state.waste.length) : 1;
      const startIdx = state.waste.length - visibleCount;
      for (let i = 0; i < visibleCount; i++) {
        const card = state.waste[startIdx + i];
        const isTop = (i === visibleCount - 1);
        const el = createCardElement(card);
        el.style.left = `${i * 18}px`;
        el.style.zIndex = i + 1;
        if (!isTop) {
          el.classList.remove('playable');
          el.style.cursor = 'default';
        } else {
          const src = { zone: 'waste', index: state.waste.length - 1 };
          if (isSourceSelected(src)) el.classList.add('selected');
          attachCardInteractions(el, src);
        }
        wasteSlot.appendChild(el);
      }
    }

    // 3. Foundations
    foundationSlots.forEach((slot, fIdx) => {
      slot.querySelectorAll('.card').forEach(el => el.remove());
      const pile = state.foundations[fIdx];
      if (pile.length > 0) {
        const topCard = pile[pile.length - 1];
        const el = createCardElement(topCard);
        const src = { zone: 'foundation', col: fIdx, index: pile.length - 1 };
        if (isSourceSelected(src)) el.classList.add('selected');
        attachCardInteractions(el, src);
        slot.appendChild(el);
      }
    });

    // 4. Tableau
    const downOffset = cssPx('--stack-offset-down', 13);
    const upOffset = cssPx('--stack-offset-up', 26);

    tableauCols.forEach((colEl, colIdx) => {
      colEl.querySelectorAll('.card').forEach(el => el.remove());
      const colCards = state.tableau[colIdx];
      let currentTop = 0;

      colCards.forEach((card, idx) => {
        const el = createCardElement(card);
        el.style.top = `${currentTop}px`;
        el.style.zIndex = idx + 1;

        if (card.faceUp) {
          const src = { zone: 'tableau', col: colIdx, index: idx };
          if (isSourceSelected(src)) el.classList.add('selected');
          attachCardInteractions(el, src);
          currentTop += upOffset;
        } else {
          currentTop += downOffset;
        }
        colEl.appendChild(el);
      });

      colEl.style.height = `${Math.max(150, currentTop + 130)}px`;
    });

    btnAutoComplete.style.display = canAutoComplete() ? 'inline-flex' : 'none';
  }

  function isSourceSelected(src) {
    if (!selectedSource) return false;
    return selectedSource.zone === src.zone &&
           selectedSource.col === src.col &&
           selectedSource.index === src.index;
  }

  let dragSession = null;

  function attachCardInteractions(cardEl, source) {
    cardEl.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      tryAutoMoveFrom(source);
    });

    cardEl.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || state.won || isAutoCompleting) return;
      e.stopPropagation();
      clearHints();

      const movingCards = getMovingCards(source);
      if (movingCards.length === 0) return;

      const rect = cardEl.getBoundingClientRect();

      let domElements = [cardEl];
      if (source.zone === 'tableau') {
        const colEl = tableauCols[source.col];
        const allCards = Array.from(colEl.querySelectorAll('.card'));
        domElements = allCards.slice(source.index);
      }

      dragSession = {
        source,
        movingCards,
        domElements,
        startX: e.clientX,
        startY: e.clientY,
        offsetX: e.clientX - rect.left,
        offsetY: e.clientY - rect.top,
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
        const cloneEl = createCardElement(c);
        cloneEl.style.top = `${idx * upOffset}px`;
        cloneEl.style.left = '0px';
        dragLayer.appendChild(cloneEl);
      });

      dragSession.domElements.forEach(el => {
        el.style.opacity = '0';
      });
    }

    if (dragSession.isDragging) {
      const x = e.clientX - dragSession.offsetX;
      const y = e.clientY - dragSession.offsetY;
      dragLayer.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      highlightValidDropTarget(e.clientX, e.clientY);
    }
  }

  function highlightValidDropTarget(clientX, clientY) {
    document.querySelectorAll('.slot.drop-valid').forEach(el => el.classList.remove('drop-valid'));
    const target = findBestDropTarget(clientX, clientY, dragSession.source, dragSession.movingCards);
    if (!target) return;

    if (target.zone === 'foundation') {
      foundationSlots[target.col].classList.add('drop-valid');
    } else if (target.zone === 'tableau') {
      tableauCols[target.col].querySelector('.slot').classList.add('drop-valid');
    }
  }

  function findBestDropTarget(clientX, clientY, source, movingCards) {
    const leadCard = movingCards[0];
    const cardW = stockSlot.offsetWidth || 85;
    const cardH = stockSlot.offsetHeight || 120;

    const dragLeft = clientX - (dragSession ? dragSession.offsetX : cardW / 2);
    const dragTop = clientY - (dragSession ? dragSession.offsetY : cardH / 2);
    const dragRect = {
      left: dragLeft,
      right: dragLeft + cardW,
      top: dragTop,
      bottom: dragTop + cardH
    };

    let bestTarget = null;
    let bestOverlap = 0;

    function getOverlapArea(r1, r2) {
      const xOverlap = Math.max(0, Math.min(r1.right, r2.right) - Math.max(r1.left, r2.left));
      const yOverlap = Math.max(0, Math.min(r1.bottom, r2.bottom) - Math.max(r1.top, r2.top));
      return xOverlap * yOverlap;
    }

    if (movingCards.length === 1) {
      foundationSlots.forEach((slot, fIdx) => {
        if (source.zone === 'foundation' && source.col === fIdx) return;
        if (!canMoveToFoundation(leadCard, fIdx)) return;
        const rect = slot.getBoundingClientRect();
        const area = getOverlapArea(dragRect, rect);
        if (area > bestOverlap) {
          bestOverlap = area;
          bestTarget = { zone: 'foundation', col: fIdx };
        }
      });
    }

    tableauCols.forEach((colEl, cIdx) => {
      if (source.zone === 'tableau' && source.col === cIdx) return;
      if (!canMoveToTableau(leadCard, cIdx)) return;
      const lastCard = colEl.querySelector('.card:last-child') || colEl.querySelector('.slot');
      const rect = lastCard.getBoundingClientRect();
      const expandedRect = {
        left: rect.left - 8,
        right: rect.right + 8,
        top: rect.top - 10,
        bottom: rect.bottom + 45
      };
      const area = getOverlapArea(dragRect, expandedRect);
      if (area > bestOverlap) {
        bestOverlap = area;
        bestTarget = { zone: 'tableau', col: cIdx };
      }
    });

    return bestTarget;
  }

  function onPointerUp(e) {
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerCancel);
    document.querySelectorAll('.slot.drop-valid').forEach(el => el.classList.remove('drop-valid'));

    if (!dragSession) return;
    const session = dragSession;
    dragSession = null;
    dragLayer.innerHTML = '';

    if (session.isDragging) {
      const target = findBestDropTarget(e.clientX, e.clientY, session.source, session.movingCards);
      if (target && executeMove(session.source, target)) {
        return;
      }
      session.domElements.forEach(el => {
        el.style.opacity = '1';
      });
    } else {
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
        if (session.source.zone === 'foundation') {
          if (executeMove(selectedSource, { zone: 'foundation', col: session.source.col })) return;
        } else if (session.source.zone === 'tableau') {
          if (executeMove(selectedSource, { zone: 'tableau', col: session.source.col })) return;
        }
      }
      if (isSourceSelected(session.source)) {
        selectedSource = null;
      } else {
        selectedSource = session.source;
      }
      render();
    }
  }

  function onPointerCancel() {
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerCancel);
    document.querySelectorAll('.slot.drop-valid').forEach(el => el.classList.remove('drop-valid'));
    dragLayer.innerHTML = '';
    dragSession = null;
    render();
  }

  foundationSlots.forEach((slot, fIdx) => {
    slot.addEventListener('click', () => {
      if (selectedSource) {
        executeMove(selectedSource, { zone: 'foundation', col: fIdx });
      }
    });
  });

  tableauCols.forEach((colEl, cIdx) => {
    colEl.addEventListener('click', () => {
      if (selectedSource) {
        executeMove(selectedSource, { zone: 'tableau', col: cIdx });
      }
    });
  });

  document.body.addEventListener('click', (e) => {
    if (e.target === document.body || e.target.classList.contains('table-wrap') || e.target.classList.contains('tableau-zone')) {
      if (selectedSource) {
        selectedSource = null;
        render();
      }
    }
  });

  function startCascadeAnimation() {
    stopCascadeAnimation();
    const ctx = victoryCanvas.getContext('2d');
    victoryCanvas.width = window.innerWidth;
    victoryCanvas.height = window.innerHeight;
    ctx.clearRect(0, 0, victoryCanvas.width, victoryCanvas.height);

    const cardW = stockSlot.offsetWidth || 90;
    const cardH = stockSlot.offsetHeight || 126;

    const queue = [];
    for (let r = 13; r >= 1; r--) {
      for (let f = 0; f < 4; f++) {
        const rect = foundationSlots[f].getBoundingClientRect();
        const suitObj = SUITS[f];
        const rankObj = RANKS[r - 1];
        queue.push({
          x: rect.left,
          y: rect.top,
          vx: (Math.random() * 6 + 2.5) * (Math.random() < 0.5 ? -1 : 1),
          vy: -(Math.random() * 4 + 1),
          suit: suitObj.symbol,
          color: suitObj.color === 'red' ? '#d31920' : '#14171a',
          label: rankObj.label
        });
      }
    }

    let activeCard = queue.shift();
    const gravity = 0.48;
    const bounce = 0.82;

    function drawMiniCard(c) {
      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#222222';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(c.x, c.y, cardW, cardH, 6);
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
      if (!activeCard) return;

      activeCard.x += activeCard.vx;
      activeCard.vy += gravity;
      activeCard.y += activeCard.vy;

      if (activeCard.y + cardH >= victoryCanvas.height) {
        activeCard.y = victoryCanvas.height - cardH;
        activeCard.vy = -activeCard.vy * bounce;
      }

      drawMiniCard(activeCard);

      if (activeCard.x < -cardW || activeCard.x > victoryCanvas.width + cardW) {
        activeCard = queue.shift() || null;
      }

      if (activeCard) {
        cascadeAnimId = requestAnimationFrame(tick);
      }
    }

    cascadeAnimId = requestAnimationFrame(tick);
  }

  function stopCascadeAnimation() {
    if (cascadeAnimId) {
      cancelAnimationFrame(cascadeAnimId);
      cascadeAnimId = null;
    }
    const ctx = victoryCanvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, victoryCanvas.width, victoryCanvas.height);
  }

  stockSlot.addEventListener('click', handleStockClick);

  btnUndo.addEventListener('click', () => {
    if (history.length === 0 || isAutoCompleting) return;
    const wasWon = state.won;
    state = history.pop();
    selectedSource = null;
    if (wasWon) {
      stopCascadeAnimation();
      victoryBanner.classList.remove('active');
      if (!state.won && state.moves > 0) startTimerIfNeeded();
    }
    render();
    setStatus('Dernier coup annulé.');
  });

  function confirmNewGame() {
    const inProgress = state.moves > 0 && !state.won;
    if (inProgress && !window.confirm('Abandonner la partie en cours et en démarrer une nouvelle ?')) {
      return false;
    }
    initGame();
    return true;
  }

  btnHint.addEventListener('click', showHint);
  btnNew.addEventListener('click', confirmNewGame);
  btnVictoryNew.addEventListener('click', initGame);
  btnAutoComplete.addEventListener('click', runAutoComplete);

  let lastDrawMode = drawModeSelect.value;
  drawModeSelect.addEventListener('change', () => {
    if (!confirmNewGame()) {
      drawModeSelect.value = lastDrawMode;
      return;
    }
    lastDrawMode = drawModeSelect.value;
  });

  feltThemeSelect.addEventListener('change', (e) => {
    document.body.dataset.felt = e.target.value;
  });

  window.addEventListener('keydown', (e) => {
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'SELECT' || tag === 'INPUT' || tag === 'TEXTAREA') return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      btnUndo.click();
    } else if (e.ctrlKey || e.metaKey || e.altKey) {
      return;
    } else if (e.key.toLowerCase() === 'h') {
      showHint();
    } else if (e.key.toLowerCase() === 'n') {
      confirmNewGame();
    }
  });

  window.addEventListener('resize', () => {
    render();
  });

  initGame();
})();
