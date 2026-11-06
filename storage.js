/*
 * Solis 52 — persistance locale (statistiques, réglages, sauvegarde de partie).
 * Tolérant aux navigateurs où localStorage est indisponible (navigation privée, etc.).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else {
    let ls = null;
    try { ls = root.localStorage; } catch (e) { ls = null; }
    root.SolisStorage = factory(ls);
  }
})(typeof self !== 'undefined' ? self : this, function (store) {
  'use strict';

  const KEY_STATS = 'solis52.stats.v1';
  const KEY_SETTINGS = 'solis52.settings.v1';
  const KEY_SAVE = 'solis52.save.v1';

  const DEFAULT_STATS = {
    played: 0, won: 0, bestScore: 0, bestTime: null, bestMoves: null,
    streak: 0, bestStreak: 0, totalTime: 0
  };

  const DEFAULT_SETTINGS = {
    drawMode: 1, felt: 'classic', cardback: 'blue',
    fourColor: false, sound: false, winnable: true
  };

  function read(key, fallback) {
    try {
      const raw = store && store.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      if (store) store.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }

  return {
    getStats() { return Object.assign({}, DEFAULT_STATS, read(KEY_STATS, {})); },
    recordPlayed() {
      const s = this.getStats();
      s.played++;
      write(KEY_STATS, s);
      return s;
    },
    /* Une partie commencée mais abandonnée interrompt la série de victoires. */
    recordAbandoned() {
      const s = this.getStats();
      s.streak = 0;
      write(KEY_STATS, s);
      return s;
    },
    recordWin({ score, time, moves }) {
      const s = this.getStats();
      s.won++;
      s.streak++;
      s.bestStreak = Math.max(s.bestStreak, s.streak);
      s.bestScore = Math.max(s.bestScore, score);
      s.bestTime = s.bestTime === null ? time : Math.min(s.bestTime, time);
      s.bestMoves = s.bestMoves === null ? moves : Math.min(s.bestMoves, moves);
      s.totalTime += time;
      write(KEY_STATS, s);
      return s;
    },
    resetStats() { write(KEY_STATS, DEFAULT_STATS); },

    getSettings() { return Object.assign({}, DEFAULT_SETTINGS, read(KEY_SETTINGS, {})); },
    saveSettings(settings) { return write(KEY_SETTINGS, settings); },

    getSave() { return read(KEY_SAVE, null); },
    saveGame(data) { return write(KEY_SAVE, data); },
    clearSave() { try { store && store.removeItem(KEY_SAVE); } catch (e) { /* ignore */ } },

    DEFAULT_STATS, DEFAULT_SETTINGS
  };
});
