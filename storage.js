/*
 * Solis 52 — persistance locale (statistiques, réglages, sauvegardes par mode de jeu : Classique & Spider).
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

  const KEY_STATS_KLONDIKE = 'solis52.stats.v1';
  const KEY_STATS_SPIDER = 'solis52.spider.stats.v1';
  const KEY_SETTINGS = 'solis52.settings.v1';
  const KEY_SAVE_KLONDIKE = 'solis52.save.v1';
  const KEY_SAVE_SPIDER = 'solis52.spider.save.v1';

  const DEFAULT_STATS = {
    played: 0, won: 0, bestScore: 0, bestTime: null, bestMoves: null,
    streak: 0, bestStreak: 0, totalTime: 0
  };

  const DEFAULT_SETTINGS = {
    activeGame: 'klondike',
    drawMode: 1,
    spiderSuits: 1,
    felt: 'classic',
    cardback: 'blue',
    fourColor: false,
    sound: false,
    winnable: true
  };

  function statsKey(mode) {
    return mode === 'spider' ? KEY_STATS_SPIDER : KEY_STATS_KLONDIKE;
  }

  function saveKey(mode) {
    return mode === 'spider' ? KEY_SAVE_SPIDER : KEY_SAVE_KLONDIKE;
  }

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
    getStats(mode = 'klondike') {
      return Object.assign({}, DEFAULT_STATS, read(statsKey(mode), {}));
    },
    recordPlayed(mode = 'klondike') {
      const s = this.getStats(mode);
      s.played++;
      write(statsKey(mode), s);
      return s;
    },
    recordAbandoned(mode = 'klondike') {
      const s = this.getStats(mode);
      s.streak = 0;
      write(statsKey(mode), s);
      return s;
    },
    recordWin({ score, time, moves }, mode = 'klondike') {
      const s = this.getStats(mode);
      s.won++;
      s.streak++;
      s.bestStreak = Math.max(s.bestStreak, s.streak);
      s.bestScore = Math.max(s.bestScore, score);
      s.bestTime = s.bestTime === null ? time : Math.min(s.bestTime, time);
      s.bestMoves = s.bestMoves === null ? moves : Math.min(s.bestMoves, moves);
      s.totalTime += time;
      write(statsKey(mode), s);
      return s;
    },
    resetStats(mode = 'klondike') {
      write(statsKey(mode), DEFAULT_STATS);
    },

    getSettings() { return Object.assign({}, DEFAULT_SETTINGS, read(KEY_SETTINGS, {})); },
    saveSettings(settings) { return write(KEY_SETTINGS, settings); },

    getSave(mode = 'klondike') { return read(saveKey(mode), null); },
    saveGame(data, mode = 'klondike') { return write(saveKey(mode), data); },
    clearSave(mode = 'klondike') {
      try { store && store.removeItem(saveKey(mode)); } catch (e) { /* ignore */ }
    },

    DEFAULT_STATS, DEFAULT_SETTINGS
  };
});
