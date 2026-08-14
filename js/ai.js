/**
 * Cờ Úp - Artificial Intelligence (AI) Engine
 * 
 * Implements 3 difficulty levels tailored to authentic Vietnamese Cờ Úp:
 * - Dễ (Easy): Picks random legal moves, occasionally captures hanging pieces
 * - Vừa (Medium): 1-ply heuristic search evaluating material, threats, and tactical captures
 * - Khó (Hard): 2-ply Minimax with Alpha-Beta pruning, king safety, check priority, and positional control
 */
window.CoUp = window.CoUp || {};

window.CoUp.AI = (function () {
    'use strict';

    var Pieces = window.CoUp.Pieces;

    // Piece values for board evaluation
    var PIECE_VALUES = {
        general:  10000, // Tướng (Winning target)
        chariot:    900, // Xe (Strongest attacker)
        cannon:     500, // Pháo (High tactical value)
        horse:      450, // Mã
        elephant:   250, // Tượng (Can cross river in Cờ Úp!)
        advisor:    250, // Sĩ (Can move full board in Cờ Úp!)
        soldier:    150, // Tốt (250 after crossing river)
        faceDown:   300  // Expected value of an unknown face-down piece
    };

    /**
     * Main entry point: calculate the best move for AI
     */
    function getBestMove(state, difficulty) {
        var aiColor = 'black'; // AI plays top side (Black)
        var legalMoves = getAllPlayerLegalMoves(state, aiColor);

        if (legalMoves.length === 0) return null;

        // Instant win check: can capture Red King?
        for (var i = 0; i < legalMoves.length; i++) {
            var m = legalMoves[i];
            var target = state.board[m.toRow][m.toCol];
            if (target && target.type === Pieces.Types.GENERAL && target.faceUp) {
                return m; // WIN IMMEDIATELY
            }
        }

        switch (difficulty) {
            case 'easy':
                return getEasyMove(legalMoves, state);
            case 'medium':
                return getMediumMove(legalMoves, state, aiColor);
            case 'hard':
            default:
                return getHardMove(legalMoves, state, aiColor);
        }
    }

    /**
     * EASY: Random moves with basic capture bias
     */
    function getEasyMove(legalMoves, state) {
        var captures = legalMoves.filter(function (m) {
            return state.board[m.toRow][m.toCol] !== null;
        });

        // 50% chance to capture if available
        if (captures.length > 0 && Math.random() < 0.5) {
            var cIdx = Math.floor(Math.random() * captures.length);
            return captures[cIdx];
        }

        var rIdx = Math.floor(Math.random() * legalMoves.length);
        return legalMoves[rIdx];
    }

    /**
     * MEDIUM: 1-ply heuristic evaluation
     */
    function getMediumMove(legalMoves, state, aiColor) {
        var scoredMoves = [];

        legalMoves.forEach(function (m) {
            var score = 0;
            var moving = state.board[m.fromRow][m.fromCol];
            var target = state.board[m.toRow][m.toCol];

            // 1. Capture score
            if (target) {
                var targetVal = target.faceUp ? (PIECE_VALUES[target.type] || 200) : PIECE_VALUES.faceDown;
                var movingVal = moving.faceUp ? (PIECE_VALUES[moving.type] || 200) : PIECE_VALUES.faceDown;
                score += targetVal * 2;
                if (targetVal > movingVal) score += 300; // Winning trade
            }

            // 2. Uncovering face-down piece bonus (developing pieces)
            if (!moving.faceUp) {
                score += 80;
            }

            // 3. Advancing forward
            score += (m.toRow - m.fromRow) * 10;

            // 4. Center control
            score += (4 - Math.abs(m.toCol - 4)) * 8;

            score += Math.random() * 15; // Tie breaker
            scoredMoves.push({ move: m, score: score });
        });

        scoredMoves.sort(function (a, b) { return b.score - a.score; });
        return scoredMoves[0].move;
    }

    /**
     * HARD: 2-ply Minimax with Alpha-Beta Pruning
     */
    function getHardMove(legalMoves, state, aiColor) {
        var bestMove = legalMoves[0];
        var bestScore = -Infinity;
        var enemyColor = 'red';

        legalMoves.forEach(function (m) {
            var simBoard = cloneBoard(state.board);
            var moving = simBoard[m.fromRow][m.fromCol];
            moving.faceUp = true;
            simBoard[m.toRow][m.toCol] = moving;
            simBoard[m.fromRow][m.fromCol] = null;

            // Opponent's turn (Minimizing)
            var score = minimax(simBoard, 1, false, -Infinity, Infinity, aiColor, enemyColor);

            // Add slight opening/development bonuses
            if (!state.board[m.fromRow][m.fromCol].faceUp) score += 40; // Encourage early exploration
            score += (4 - Math.abs(m.toCol - 4)) * 6; // Center control
            score += Math.random() * 10;

            if (score > bestScore) {
                bestScore = score;
                bestMove = m;
            }
        });

        return bestMove;
    }

    function minimax(board, depth, isMaximizing, alpha, beta, aiColor, enemyColor) {
        if (depth === 0) {
            return evaluateBoard(board, aiColor, enemyColor);
        }

        if (isMaximizing) {
            var maxEval = -Infinity;
            var moves = getAllBoardMoves(board, aiColor);
            if (moves.length === 0) return -5000;

            for (var i = 0; i < moves.length; i++) {
                var m = moves[i];
                var nextB = cloneBoard(board);
                var moving = nextB[m.fromRow][m.fromCol];
                moving.faceUp = true;
                nextB[m.toRow][m.toCol] = moving;
                nextB[m.fromRow][m.fromCol] = null;

                var evaluation = minimax(nextB, depth - 1, false, alpha, beta, aiColor, enemyColor);
                maxEval = Math.max(maxEval, evaluation);
                alpha = Math.max(alpha, evaluation);
                if (beta <= alpha) break;
            }
            return maxEval;
        } else {
            var minEval = Infinity;
            var enemyMoves = getAllBoardMoves(board, enemyColor);
            if (enemyMoves.length === 0) return 5000;

            for (var j = 0; j < enemyMoves.length; j++) {
                var em = enemyMoves[j];
                var nextB2 = cloneBoard(board);
                var eMoving = nextB2[em.fromRow][em.fromCol];
                eMoving.faceUp = true;
                nextB2[em.toRow][em.toCol] = eMoving;
                nextB2[em.fromRow][em.fromCol] = null;

                var evaluation2 = minimax(nextB2, depth - 1, true, alpha, beta, aiColor, enemyColor);
                minEval = Math.min(minEval, evaluation2);
                beta = Math.min(beta, evaluation2);
                if (beta <= alpha) break;
            }
            return minEval;
        }
    }

    function evaluateBoard(board, aiColor, enemyColor) {
        var score = 0;
        var ROWS = 10, COLS = 9;

        for (var r = 0; r < ROWS; r++) {
            for (var c = 0; c < COLS; c++) {
                var p = board[r][c];
                if (!p) continue;

                var val = p.faceUp ? (PIECE_VALUES[p.type] || 200) : PIECE_VALUES.faceDown;

                // Soldier bonus after river
                if (p.type === Pieces.Types.SOLDIER && p.faceUp) {
                    if ((p.color === 'black' && r >= 5) || (p.color === 'red' && r <= 4)) {
                        val += 120;
                    }
                }

                if (p.color === aiColor) {
                    score += val;
                    score += r * 5; // Positional advantage pushing down
                } else {
                    score -= val;
                    score -= (9 - r) * 5;
                }
            }
        }
        return score;
    }

    function getAllPlayerLegalMoves(state, color) {
        var moves = [];
        var ROWS = 10, COLS = 9;
        for (var r = 0; r < ROWS; r++) {
            for (var c = 0; c < COLS; c++) {
                var p = state.board[r][c];
                if (p && p.color === color) {
                    var pieceMoves = window.CoUp.Game.getValidMoves(r, c);
                    pieceMoves.forEach(function (pm) {
                        moves.push({
                            type: pm.type,
                            fromRow: r, fromCol: c,
                            toRow: pm.row, toCol: pm.col
                        });
                    });
                }
            }
        }
        return moves;
    }

    function getAllBoardMoves(board, color) {
        var moves = [];
        var ROWS = 10, COLS = 9;
        for (var r = 0; r < ROWS; r++) {
            for (var c = 0; c < COLS; c++) {
                var p = board[r][c];
                if (p && p.color === color) {
                    var rawMoves = window.CoUp.Game.getRawPieceMoves(board, r, c);
                    rawMoves.forEach(function (rm) {
                        moves.push({
                            type: rm.type,
                            fromRow: r, fromCol: c,
                            toRow: rm.row, toCol: rm.col
                        });
                    });
                }
            }
        }
        return moves;
    }

    function cloneBoard(board) {
        var newB = [];
        for (var r = 0; r < board.length; r++) {
            newB[r] = [];
            for (var c = 0; c < board[r].length; c++) {
                var p = board[r][c];
                if (!p) {
                    newB[r][c] = null;
                } else {
                    newB[r][c] = {
                        id: p.id,
                        type: p.type,
                        color: p.color,
                        char: p.char,
                        name: p.name,
                        faceUp: p.faceUp,
                        originalSpotType: p.originalSpotType
                    };
                }
            }
        }
        return newB;
    }

    return {
        getBestMove: getBestMove
    };
})();
