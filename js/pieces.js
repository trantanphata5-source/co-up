/**
 * Cờ Úp - Piece Definitions & Xiangqi Rules
 * 
 * Standard Vietnamese Cờ Úp (Cờ Tướng Úp):
 * - 32 pieces: 16 Red + 16 Black
 * - Red King (帥) starts face-up at (9, 4)
 * - Black King (將) starts face-up at (0, 4)
 * - 15 Red pieces shuffled face-down on Red's 15 starting spots
 * - 15 Black pieces shuffled face-down on Black's 15 starting spots
 * - Face-down pieces move according to the spot's Xiangqi rule and flip face-up upon landing
 * - Face-up Sĩ can leave the palace; Face-up Tượng can cross the river
 */
window.CoUp = window.CoUp || {};

window.CoUp.Pieces = (function () {
    'use strict';

    var Types = {
        GENERAL:  'general',  // Tướng (帥 / 將)
        ADVISOR:  'advisor',  // Sĩ (仕 / 士)
        ELEPHANT: 'elephant', // Tượng (相 / 象)
        CHARIOT:  'chariot',  // Xe (車)
        CANNON:   'cannon',   // Pháo (炮 / 砲)
        HORSE:    'horse',    // Mã (馬)
        SOLDIER:  'soldier'   // Tốt (兵 / 卒)
    };

    var PieceNames = {
        general:  { red: { char: '帥', name: 'Tướng' }, black: { char: '將', name: 'Tướng' } },
        advisor:  { red: { char: '仕', name: 'Sĩ' },    black: { char: '士', name: 'Sĩ' } },
        elephant: { red: { char: '相', name: 'Tượng' }, black: { char: '象', name: 'Tượng' } },
        chariot:  { red: { char: '車', name: 'Xe' },    black: { char: '車', name: 'Xe' } },
        cannon:   { red: { char: '炮', name: 'Pháo' }, black: { char: '砲', name: 'Pháo' } },
        horse:    { red: { char: '馬', name: 'Mã' },   black: { char: '馬', name: 'Mã' } },
        soldier:  { red: { char: '兵', name: 'Tốt' },  black: { char: '卒', name: 'Tốt' } }
    };

    // Standard piece counts per side (excluding king = 15 pieces)
    var PIECE_CONFIG = [
        { type: Types.ADVISOR,  count: 2 },
        { type: Types.ELEPHANT, count: 2 },
        { type: Types.CHARIOT,  count: 2 },
        { type: Types.CANNON,   count: 2 },
        { type: Types.HORSE,    count: 2 },
        { type: Types.SOLDIER,  count: 5 }
    ];

    // Standard starting spots for Red (Bottom, rows 6, 7, 9)
    var RED_STARTING_SPOTS = [
        { r: 9, c: 0, spotType: Types.CHARIOT },
        { r: 9, c: 1, spotType: Types.HORSE },
        { r: 9, c: 2, spotType: Types.ELEPHANT },
        { r: 9, c: 3, spotType: Types.ADVISOR },
        { r: 9, c: 5, spotType: Types.ADVISOR },
        { r: 9, c: 6, spotType: Types.ELEPHANT },
        { r: 9, c: 7, spotType: Types.HORSE },
        { r: 9, c: 8, spotType: Types.CHARIOT },
        { r: 7, c: 1, spotType: Types.CANNON },
        { r: 7, c: 7, spotType: Types.CANNON },
        { r: 6, c: 0, spotType: Types.SOLDIER },
        { r: 6, c: 2, spotType: Types.SOLDIER },
        { r: 6, c: 4, spotType: Types.SOLDIER },
        { r: 6, c: 6, spotType: Types.SOLDIER },
        { r: 6, c: 8, spotType: Types.SOLDIER }
    ];

    // Standard starting spots for Black (Top, rows 0, 2, 3)
    var BLACK_STARTING_SPOTS = [
        { r: 0, c: 0, spotType: Types.CHARIOT },
        { r: 0, c: 1, spotType: Types.HORSE },
        { r: 0, c: 2, spotType: Types.ELEPHANT },
        { r: 0, c: 3, spotType: Types.ADVISOR },
        { r: 0, c: 5, spotType: Types.ADVISOR },
        { r: 0, c: 6, spotType: Types.ELEPHANT },
        { r: 0, c: 7, spotType: Types.HORSE },
        { r: 0, c: 8, spotType: Types.CHARIOT },
        { r: 2, c: 1, spotType: Types.CANNON },
        { r: 2, c: 7, spotType: Types.CANNON },
        { r: 3, c: 0, spotType: Types.SOLDIER },
        { r: 3, c: 2, spotType: Types.SOLDIER },
        { r: 3, c: 4, spotType: Types.SOLDIER },
        { r: 3, c: 6, spotType: Types.SOLDIER },
        { r: 3, c: 8, spotType: Types.SOLDIER }
    ];

    /**
     * Generate standard Cờ Úp starting setup:
     * - Red King face-up at (9,4)
     * - Black King face-up at (0,4)
     * - 15 Red pieces shuffled face-down on Red starting spots
     * - 15 Black pieces shuffled face-down on Black starting spots
     */
    function generateCoUpSetup() {
        var board = [];
        for (var r = 0; r < 10; r++) {
            board[r] = [];
            for (var c = 0; c < 9; c++) {
                board[r][c] = null;
            }
        }

        var idCounter = 1;

        // 1. Place Kings (Face-up)
        board[9][4] = {
            id: idCounter++,
            type: Types.GENERAL,
            color: 'red',
            char: PieceNames.general.red.char,
            name: PieceNames.general.red.name,
            faceUp: true,
            originalSpotType: Types.GENERAL
        };

        board[0][4] = {
            id: idCounter++,
            type: Types.GENERAL,
            color: 'black',
            char: PieceNames.general.black.char,
            name: PieceNames.general.black.name,
            faceUp: true,
            originalSpotType: Types.GENERAL
        };

        // 2. Generate 15 Red non-king pieces and shuffle
        var redPieces = [];
        PIECE_CONFIG.forEach(function (cfg) {
            for (var i = 0; i < cfg.count; i++) {
                redPieces.push({
                    id: idCounter++,
                    type: cfg.type,
                    color: 'red',
                    char: PieceNames[cfg.type].red.char,
                    name: PieceNames[cfg.type].red.name,
                    faceUp: false
                });
            }
        });
        redPieces = shuffle(redPieces);

        // Place on Red starting spots
        RED_STARTING_SPOTS.forEach(function (spot, idx) {
            var piece = redPieces[idx];
            piece.originalSpotType = spot.spotType;
            board[spot.r][spot.c] = piece;
        });

        // 3. Generate 15 Black non-king pieces and shuffle
        var blackPieces = [];
        PIECE_CONFIG.forEach(function (cfg) {
            for (var i = 0; i < cfg.count; i++) {
                blackPieces.push({
                    id: idCounter++,
                    type: cfg.type,
                    color: 'black',
                    char: PieceNames[cfg.type].black.char,
                    name: PieceNames[cfg.type].black.name,
                    faceUp: false
                });
            }
        });
        blackPieces = shuffle(blackPieces);

        // Place on Black starting spots
        BLACK_STARTING_SPOTS.forEach(function (spot, idx) {
            var piece = blackPieces[idx];
            piece.originalSpotType = spot.spotType;
            board[spot.r][spot.c] = piece;
        });

        return board;
    }

    /**
     * Fisher-Yates shuffle
     */
    function shuffle(arr) {
        var a = arr.slice();
        for (var i = a.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var tmp = a[i];
            a[i] = a[j];
            a[j] = tmp;
        }
        return a;
    }

    return {
        Types: Types,
        PieceNames: PieceNames,
        generateCoUpSetup: generateCoUpSetup,
        RED_STARTING_SPOTS: RED_STARTING_SPOTS,
        BLACK_STARTING_SPOTS: BLACK_STARTING_SPOTS,
        shuffle: shuffle
    };
})();
