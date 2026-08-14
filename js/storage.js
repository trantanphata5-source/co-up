/**
 * Cờ Úp - Storage System
 * 
 * Persists game state, user settings, and match history via localStorage
 * Auto-saves after every move so the game survives page reloads
 */
window.CoUp = window.CoUp || {};

window.CoUp.Storage = (function () {
    'use strict';

    var GAME_KEY = 'coUp_gameState';
    var SETTINGS_KEY = 'coUp_settings';
    var HISTORY_KEY = 'coUp_matchHistory';

    // --- Game State ---
    function saveGame(state) {
        try {
            localStorage.setItem(GAME_KEY, JSON.stringify(state));
            return true;
        } catch (e) {
            console.warn('[CoUp Storage] Failed to save game:', e);
            return false;
        }
    }

    function loadGame() {
        try {
            var data = localStorage.getItem(GAME_KEY);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.warn('[CoUp Storage] Failed to load game:', e);
            return null;
        }
    }

    function clearGame() {
        try {
            localStorage.removeItem(GAME_KEY);
        } catch (e) { /* ignore */ }
    }

    function hasSavedGame() {
        return !!localStorage.getItem(GAME_KEY);
    }

    // --- Settings ---
    function saveSettings(settings) {
        try {
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
        } catch (e) {
            console.warn('[CoUp Storage] Failed to save settings:', e);
        }
    }

    function loadSettings() {
        try {
            var data = localStorage.getItem(SETTINGS_KEY);
            if (data) {
                var parsed = JSON.parse(data);
                return {
                    soundEnabled: parsed.soundEnabled !== false,
                    volume: typeof parsed.volume === 'number' ? parsed.volume : 0.5,
                    gameMode: parsed.gameMode || 'pve',
                    aiDifficulty: parsed.aiDifficulty || 'medium'
                };
            }
        } catch (e) { /* ignore */ }
        return { soundEnabled: true, volume: 0.5, gameMode: 'pve', aiDifficulty: 'medium' };
    }

    // --- Match History ---
    function addMatchResult(result) {
        try {
            var history = getMatchHistory();
            history.unshift({
                winner: result.winner,
                moves: result.moves,
                player1Color: result.player1Color,
                player2Color: result.player2Color,
                duration: result.duration,
                date: new Date().toISOString()
            });
            // Keep last 50 matches
            if (history.length > 50) history.length = 50;
            localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
        } catch (e) {
            console.warn('[CoUp Storage] Failed to save match history:', e);
        }
    }

    function getMatchHistory() {
        try {
            var data = localStorage.getItem(HISTORY_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            return [];
        }
    }

    function clearMatchHistory() {
        try {
            localStorage.removeItem(HISTORY_KEY);
        } catch (e) { /* ignore */ }
    }

    return {
        saveGame: saveGame,
        loadGame: loadGame,
        clearGame: clearGame,
        hasSavedGame: hasSavedGame,
        saveSettings: saveSettings,
        loadSettings: loadSettings,
        addMatchResult: addMatchResult,
        getMatchHistory: getMatchHistory,
        clearMatchHistory: clearMatchHistory
    };
})();
