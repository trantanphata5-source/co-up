/**
 * Cờ Úp - Main Game Controller with Online Multiplayer Support
 * 
 * Manages game state, handles user input, enforces rules,
 * integrates AI opponent with 3 difficulty levels,
 * supports Real-time 2-Device Online Multiplayer via WebRTC P2P (PeerJS),
 * coordinates Board/Sound/Effects/Storage modules on the 9×10 Xiangqi board.
 */
window.CoUp = window.CoUp || {};

window.CoUp.Game = (function () {
    'use strict';

    var Pieces      = window.CoUp.Pieces;
    var Board       = window.CoUp.Board;
    var AI          = window.CoUp.AI;
    var Multiplayer = window.CoUp.Multiplayer;
    var Sound       = window.CoUp.Sound;
    var Effects     = window.CoUp.Effects;
    var Storage     = window.CoUp.Storage;

    var ROWS = 10, COLS = 9;

    var state = null;
    var timerInterval = null;
    var isAnimating = false;

    // =============================================
    //  STATE CREATION
    // =============================================

    function createNewState(gameMode, aiDifficulty) {
        var board = Pieces.generateCoUpSetup();
        var settings = Storage.loadSettings();

        return {
            board: board,
            currentPlayer: 1, // 1 = Red (Bottom), 2 = Black (Top)
            player1Color: 'red',
            player2Color: 'black',
            selectedCell: null,
            moveHistory: [],
            capturedPieces: { red: [], black: [] },
            gamePhase: 'playing', // 'playing' | 'ended'
            winner: null,
            moveCount: 0,
            timer: { player1: 0, player2: 0 },
            lastMoveTime: Date.now(),
            gameMode: gameMode || settings.gameMode || 'pve',           // 'pve' | 'pvp' | 'online'
            aiDifficulty: aiDifficulty || settings.aiDifficulty || 'medium', // 'easy' | 'medium' | 'hard'
            isAiThinking: false,
            inCheck: null, // 'red' | 'black' | null
            myOnlineColor: 'red' // In online mode: 'red' (Host) | 'black' (Guest)
        };
    }

    function getCurrentPlayerColor() {
        return state.currentPlayer === 1 ? 'red' : 'black';
    }

    function getOpponentColor(color) {
        return color === 'red' ? 'black' : 'red';
    }

    function switchTurn() {
        state.currentPlayer = state.currentPlayer === 1 ? 2 : 1;
        state.selectedCell = null;
        state.lastMoveTime = Date.now();

        // Check if new player's King is in check
        var currentColor = getCurrentPlayerColor();
        if (isKingInCheck(state.board, currentColor)) {
            state.inCheck = currentColor;
            Sound.playCheck ? Sound.playCheck() : Sound.playSelect();
            showToast('⚠️ CHIẾU TƯỚNG! (' + (currentColor === 'red' ? 'Đỏ' : 'Đen') + ')', 2500);
        } else {
            state.inCheck = null;
        }

        // Check if current player has any legal moves left (Checkmate / Stalemate)
        if (!hasAnyLegalMoves(state.board, currentColor)) {
            endGame(getOpponentColor(currentColor));
            return;
        }

        // Trigger AI turn if in PvE mode
        if (state.gameMode === 'pve') {
            triggerAiTurnIfNeeded();
        }
    }

    function isCurrentPlayerPiece(piece) {
        if (!piece) return false;
        var color = getCurrentPlayerColor();
        return piece.color === color;
    }

    // =============================================
    //  AI TURN CONTROLLER
    // =============================================

    function triggerAiTurnIfNeeded() {
        if (state.gameMode !== 'pve' || state.currentPlayer !== 2 || state.gamePhase === 'ended') {
            return;
        }

        state.isAiThinking = true;
        updateTurnDisplay();

        var thinkDelay = state.aiDifficulty === 'hard' ? 700 : (state.aiDifficulty === 'medium' ? 550 : 400);

        setTimeout(function () {
            if (state.gamePhase === 'ended' || state.currentPlayer !== 2) {
                state.isAiThinking = false;
                return;
            }

            var aiMove = AI.getBestMove(state, state.aiDifficulty);
            state.isAiThinking = false;

            if (!aiMove) {
                endGame('red');
                return;
            }

            executeMove(aiMove.fromRow, aiMove.fromCol, aiMove.toRow, aiMove.toCol, aiMove.type, false);
        }, thinkDelay);
    }

    // =============================================
    //  AUTHENTIC CỜ ÚP MOVE VALIDATION
    // =============================================

    function getValidMoves(row, col) {
        var piece = state.board[row][col];
        if (!piece) return [];
        if (piece.color !== getCurrentPlayerColor()) return [];

        var rawMoves = getRawPieceMoves(state.board, row, col);
        var legalMoves = [];

        for (var i = 0; i < rawMoves.length; i++) {
            var m = rawMoves[i];
            var simBoard = simulateMove(state.board, row, col, m.row, m.col);
            
            // Check flying general rule (2 kings facing each other with open line)
            if (isFlyingGeneral(simBoard)) continue;

            // Check if own king is in check after this move
            if (isKingInCheck(simBoard, piece.color)) continue;

            legalMoves.push(m);
        }

        return legalMoves;
    }

    function getRawPieceMoves(board, row, col) {
        var piece = board[row][col];
        if (!piece) return [];

        if (!piece.faceUp) {
            return getSpotRuleMoves(board, row, col, piece.originalSpotType, piece.color);
        }

        return getFaceUpPieceMoves(board, row, col, piece.type, piece.color);
    }

    function getSpotRuleMoves(board, row, col, spotType, color) {
        switch (spotType) {
            case Pieces.Types.CHARIOT:  return getChariotMoves(board, row, col, color);
            case Pieces.Types.HORSE:    return getHorseMoves(board, row, col, color);
            case Pieces.Types.ELEPHANT: return getElephantMoves(board, row, col, color);
            case Pieces.Types.ADVISOR:  return getAdvisorSpotMoves(board, row, col, color);
            case Pieces.Types.CANNON:   return getCannonMoves(board, row, col, color);
            case Pieces.Types.SOLDIER:  return getSoldierMoves(board, row, col, color);
            default: return [];
        }
    }

    function getFaceUpPieceMoves(board, row, col, pieceType, color) {
        switch (pieceType) {
            case Pieces.Types.GENERAL:  return getGeneralMoves(board, row, col, color);
            case Pieces.Types.ADVISOR:  return getAdvisorSpotMoves(board, row, col, color); // Full board Sĩ
            case Pieces.Types.ELEPHANT: return getElephantMoves(board, row, col, color);    // River crossing Tượng
            case Pieces.Types.CHARIOT:  return getChariotMoves(board, row, col, color);
            case Pieces.Types.CANNON:   return getCannonMoves(board, row, col, color);
            case Pieces.Types.HORSE:    return getHorseMoves(board, row, col, color);
            case Pieces.Types.SOLDIER:  return getSoldierMoves(board, row, col, color);
            default: return [];
        }
    }

    // ─── 1. XE (CHARIOT) ───
    function getChariotMoves(board, row, col, color) {
        var moves = [];
        var dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        dirs.forEach(function (d) {
            var r = row + d[0], c = col + d[1];
            while (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
                var target = board[r][c];
                if (!target) {
                    moves.push({ row: r, col: c, type: 'move' });
                } else {
                    if (target.color !== color) {
                        moves.push({ row: r, col: c, type: 'capture' });
                    }
                    break;
                }
                r += d[0];
                c += d[1];
            }
        });
        return moves;
    }

    // ─── 2. PHÁO (CANNON) ───
    function getCannonMoves(board, row, col, color) {
        var moves = [];
        var dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        dirs.forEach(function (d) {
            var r = row + d[0], c = col + d[1];
            var jumped = false;
            while (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
                var target = board[r][c];
                if (!jumped) {
                    if (!target) {
                        moves.push({ row: r, col: c, type: 'move' });
                    } else {
                        jumped = true;
                    }
                } else {
                    if (target) {
                        if (target.color !== color) {
                            moves.push({ row: r, col: c, type: 'capture' });
                        }
                        break;
                    }
                }
                r += d[0];
                c += d[1];
            }
        });
        return moves;
    }

    // ─── 3. MÃ (HORSE) ───
    function getHorseMoves(board, row, col, color) {
        var moves = [];
        var jumps = [
            [-2, -1, -1, 0], [-2, 1, -1, 0], // Up
            [2, -1, 1, 0],   [2, 1, 1, 0],   // Down
            [-1, -2, 0, -1], [1, -2, 0, -1], // Left
            [-1, 2, 0, 1],   [1, 2, 0, 1]    // Right
        ];
        jumps.forEach(function (j) {
            var nr = row + j[0], nc = col + j[1];
            var lr = row + j[2], lc = col + j[3];
            if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
                if (!board[lr][lc]) {
                    var target = board[nr][nc];
                    if (!target) {
                        moves.push({ row: nr, col: nc, type: 'move' });
                    } else if (target.color !== color) {
                        moves.push({ row: nr, col: nc, type: 'capture' });
                    }
                }
            }
        });
        return moves;
    }

    // ─── 4. TƯỢNG (ELEPHANT) ───
    function getElephantMoves(board, row, col, color) {
        var moves = [];
        var steps = [
            [-2, -2, -1, -1], [-2, 2, -1, 1],
            [2, -2, 1, -1],   [2, 2, 1, 1]
        ];
        steps.forEach(function (s) {
            var nr = row + s[0], nc = col + s[1];
            var er = row + s[2], ec = col + s[3];
            if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
                if (!board[er][ec]) {
                    var target = board[nr][nc];
                    if (!target) {
                        moves.push({ row: nr, col: nc, type: 'move' });
                    } else if (target.color !== color) {
                        moves.push({ row: nr, col: nc, type: 'capture' });
                    }
                }
            }
        });
        return moves;
    }

    // ─── 5. SĨ (ADVISOR) ───
    function getAdvisorSpotMoves(board, row, col, color) {
        var moves = [];
        var diagonals = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
        diagonals.forEach(function (d) {
            var nr = row + d[0], nc = col + d[1];
            if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
                var target = board[nr][nc];
                if (!target) {
                    moves.push({ row: nr, col: nc, type: 'move' });
                } else if (target.color !== color) {
                    moves.push({ row: nr, col: nc, type: 'capture' });
                }
            }
        });
        return moves;
    }

    // ─── 6. TƯỚNG (GENERAL / KING) in Palace ───
    function getGeneralMoves(board, row, col, color) {
        var moves = [];
        var dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        var minR = color === 'red' ? 7 : 0;
        var maxR = color === 'red' ? 9 : 2;
        var minC = 3, maxC = 5;

        dirs.forEach(function (d) {
            var nr = row + d[0], nc = col + d[1];
            if (nr >= minR && nr <= maxR && nc >= minC && nc <= maxC) {
                var target = board[nr][nc];
                if (!target) {
                    moves.push({ row: nr, col: nc, type: 'move' });
                } else if (target.color !== color) {
                    moves.push({ row: nr, col: nc, type: 'capture' });
                }
            }
        });
        return moves;
    }

    // ─── 7. TỐT (SOLDIER) ───
    function getSoldierMoves(board, row, col, color) {
        var moves = [];
        var forwardDir = color === 'red' ? -1 : 1;
        var hasCrossedRiver = color === 'red' ? (row <= 4) : (row >= 5);

        // Forward
        var fr = row + forwardDir, fc = col;
        if (fr >= 0 && fr < ROWS) {
            var tFwd = board[fr][fc];
            if (!tFwd) {
                moves.push({ row: fr, col: fc, type: 'move' });
            } else if (tFwd.color !== color) {
                moves.push({ row: fr, col: fc, type: 'capture' });
            }
        }

        // Sideways after river
        if (hasCrossedRiver) {
            [-1, 1].forEach(function (dc) {
                var sc = col + dc;
                if (sc >= 0 && sc < COLS) {
                    var tSide = board[row][sc];
                    if (!tSide) {
                        moves.push({ row: row, col: sc, type: 'move' });
                    } else if (tSide.color !== color) {
                        moves.push({ row: row, col: sc, type: 'capture' });
                    }
                }
            });
        }

        return moves;
    }

    // =============================================
    //  CHECK & FLYING GENERAL RULES
    // =============================================

    function isFlyingGeneral(board) {
        var redKing = null, blackKing = null;
        for (var r = 0; r < ROWS; r++) {
            for (var c = 0; c < COLS; c++) {
                var p = board[r][c];
                if (p && p.type === Pieces.Types.GENERAL && p.faceUp) {
                    if (p.color === 'red') redKing = { r: r, c: c };
                    else blackKing = { r: r, c: c };
                }
            }
        }

        if (!redKing || !blackKing) return false;
        if (redKing.c !== blackKing.c) return false;

        var col = redKing.c;
        var startR = Math.min(redKing.r, blackKing.r) + 1;
        var endR = Math.max(redKing.r, blackKing.r);

        for (var r2 = startR; r2 < endR; r2++) {
            if (board[r2][col]) return false;
        }

        return true;
    }

    function isKingInCheck(board, kingColor) {
        var kingPos = null;
        for (var r = 0; r < ROWS; r++) {
            for (var c = 0; c < COLS; c++) {
                var p = board[r][c];
                if (p && p.type === Pieces.Types.GENERAL && p.color === kingColor && p.faceUp) {
                    kingPos = { r: r, c: c };
                    break;
                }
            }
            if (kingPos) break;
        }

        if (!kingPos) return true;

        var attackerColor = getOpponentColor(kingColor);

        for (var r2 = 0; r2 < ROWS; r2++) {
            for (var c2 = 0; c2 < COLS; c2++) {
                var attacker = board[r2][c2];
                if (attacker && attacker.color === attackerColor) {
                    var moves = getRawPieceMoves(board, r2, c2);
                    for (var m = 0; m < moves.length; m++) {
                        if (moves[m].row === kingPos.r && moves[m].col === kingPos.c) {
                            return true;
                        }
                    }
                }
            }
        }

        return false;
    }

    function hasAnyLegalMoves(board, color) {
        for (var r = 0; r < ROWS; r++) {
            for (var c = 0; c < COLS; c++) {
                var p = board[r][c];
                if (p && p.color === color) {
                    var rawMoves = getRawPieceMoves(board, r, c);
                    for (var i = 0; i < rawMoves.length; i++) {
                        var m = rawMoves[i];
                        var sim = simulateMove(board, r, c, m.row, m.col);
                        if (!isFlyingGeneral(sim) && !isKingInCheck(sim, color)) {
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    }

    function simulateMove(board, fromR, fromC, toR, toC) {
        var newB = [];
        for (var r = 0; r < ROWS; r++) {
            newB[r] = [];
            for (var c = 0; c < COLS; c++) {
                var p = board[r][c];
                newB[r][c] = p ? clonePiece(p) : null;
            }
        }
        var moving = newB[fromR][fromC];
        if (moving) {
            moving.faceUp = true;
            newB[toR][toC] = moving;
            newB[fromR][fromC] = null;
        }
        return newB;
    }

    // =============================================
    //  CELL / INTERSECTION CLICK HANDLER
    // =============================================

    function handleCellClick(row, col) {
        if (state.gamePhase === 'ended' || isAnimating || state.isAiThinking) return;

        // In PvE mode, human cannot control AI (Player 2)
        if (state.gameMode === 'pve' && state.currentPlayer === 2) return;

        // In Online mode, player can only control their assigned color
        if (state.gameMode === 'online') {
            if (getCurrentPlayerColor() !== state.myOnlineColor) return;
        }

        var cell = state.board[row][col];

        // --- If a piece is already selected ---
        if (state.selectedCell) {
            var sr = state.selectedCell.row;
            var sc = state.selectedCell.col;

            // Click same intersection → Deselect
            if (sr === row && sc === col) {
                state.selectedCell = null;
                render();
                return;
            }

            // Check if valid destination
            var validMoves = getValidMoves(sr, sc);
            var move = null;
            for (var i = 0; i < validMoves.length; i++) {
                if (validMoves[i].row === row && validMoves[i].col === col) {
                    move = validMoves[i];
                    break;
                }
            }

            if (move) {
                executeMove(sr, sc, row, col, move.type, true);
                return;
            }

            // Invalid destination → maybe select another own piece
            state.selectedCell = null;

            if (cell && cell.color === getCurrentPlayerColor()) {
                state.selectedCell = { row: row, col: col };
                Sound.playSelect();
                render();
                return;
            }

            render();
            return;
        }

        // --- No piece currently selected ---
        if (!cell) return;

        if (isCurrentPlayerPiece(cell)) {
            state.selectedCell = { row: row, col: col };
            Sound.playSelect();
            render();
            return;
        }
    }

    // =============================================
    //  EXECUTE MOVE / CAPTURE / FLIP
    // =============================================

    function executeMove(fromRow, fromCol, toRow, toCol, moveType, broadcast) {
        var piece = state.board[fromRow][fromCol];
        var target = state.board[toRow][toCol];
        var wasFaceDown = !piece.faceUp;

        // Broadcast to peer if in Online mode and this is a local move
        if (state.gameMode === 'online' && broadcast && Multiplayer.isConnected()) {
            Multiplayer.send('move', {
                fromRow: fromRow, fromCol: fromCol,
                toRow: toRow, toCol: toCol,
                moveType: moveType
            });
        }

        // Save undo info
        state.moveHistory.push({
            type: moveType,
            fromRow: fromRow, fromCol: fromCol,
            toRow: toRow, toCol: toCol,
            piece: clonePiece(piece),
            wasFaceDown: wasFaceDown,
            capturedPiece: target ? clonePiece(target) : null,
            player: state.currentPlayer,
            gamePhase: state.gamePhase,
            inCheck: state.inCheck
        });

        // Capture effects
        if (moveType === 'capture' && target) {
            state.capturedPieces[target.color].push(clonePiece(target));

            var cellEl = Board.getCellElement(toRow, toCol);
            var boardContainer = document.getElementById('board-container');

            if (piece.type === Pieces.Types.CANNON || piece.originalSpotType === Pieces.Types.CANNON) {
                Sound.playCannon();
                if (cellEl) Effects.cannonExplosion(cellEl);
                if (boardContainer) Effects.screenShake(boardContainer, 10, 450);
            } else {
                Sound.playCapture();
                if (cellEl) Effects.explodeAt(cellEl, target.color);
                if (boardContainer) Effects.screenShake(boardContainer, 4, 200);
            }

            // Capture King -> instant victory
            if (target.type === Pieces.Types.GENERAL && target.faceUp) {
                endGame(piece.color);
                state.board[toRow][toCol] = piece;
                state.board[fromRow][fromCol] = null;
                piece.faceUp = true;
                state.selectedCell = null;
                autoSave();
                render();
                updateInfo();
                return;
            }
        } else {
            Sound.playMove();
        }

        // Move piece to destination
        state.board[toRow][toCol] = piece;
        state.board[fromRow][fromCol] = null;
        state.selectedCell = null;
        state.moveCount++;

        // FLIP PIECE IF IT WAS FACE-DOWN
        if (wasFaceDown) {
            piece.faceUp = true;
            Sound.playFlip();
            var landedCell = Board.getCellElement(toRow, toCol);
            if (landedCell) Effects.flipSparkle(landedCell);
        }

        // Switch turn
        switchTurn();

        autoSave();
        render();
        updateInfo();
    }

    // =============================================
    //  WIN / END GAME
    // =============================================

    function endGame(winner) {
        state.gamePhase = 'ended';
        state.winner = winner;

        setTimeout(function () {
            Sound.playVictory();
            Effects.confetti();
        }, 300);

        Storage.addMatchResult({
            winner: winner,
            moves: state.moveCount,
            player1Color: state.player1Color,
            player2Color: state.player2Color,
            duration: state.timer.player1 + state.timer.player2,
            gameMode: state.gameMode,
            aiDifficulty: state.aiDifficulty
        });

        setTimeout(function () { showWinnerModal(winner); }, 1200);
    }

    function showWinnerModal(winner) {
        var modal = document.getElementById('modal-winner');
        var text = document.getElementById('winner-text');
        var colorName = winner === 'red' ? 'ĐỎ' : 'ĐEN';
        
        var winnerName = '';
        if (state.gameMode === 'pve') {
            winnerName = winner === 'red' ? '👤 Bạn (Bên Đỏ)' : '🤖 Máy tính (Bên Đen)';
        } else if (state.gameMode === 'online') {
            winnerName = winner === state.myOnlineColor ? '🎉 BẠN ĐÃ CHIẾN THẮNG!' : '😢 ĐỐI THỦ ĐÃ THẮNG';
        } else {
            winnerName = winner === 'red' ? 'Người chơi 1 (Đỏ)' : 'Người chơi 2 (Đen)';
        }

        if (text) text.innerHTML = winnerName + ' (<span class="' + winner + '-text">' + colorName + '</span>)';
        if (modal) modal.classList.add('active');
    }

    // =============================================
    //  UNDO
    // =============================================

    function undo() {
        if (state.moveHistory.length === 0 || state.isAiThinking || state.gameMode === 'online') return;

        if (state.gamePhase === 'ended') {
            state.gamePhase = 'playing';
            state.winner = null;
            var winModal = document.getElementById('modal-winner');
            if (winModal) winModal.classList.remove('active');
        }

        var stepsToUndo = (state.gameMode === 'pve' && state.moveHistory.length >= 2 && state.currentPlayer === 1) ? 2 : 1;

        for (var s = 0; s < stepsToUndo; s++) {
            if (state.moveHistory.length === 0) break;
            var last = state.moveHistory.pop();

            var piece = state.board[last.toRow][last.toCol];
            if (piece) {
                piece.faceUp = !last.wasFaceDown;
                state.board[last.fromRow][last.fromCol] = piece;
            }

            if (last.capturedPiece) {
                state.board[last.toRow][last.toCol] = last.capturedPiece;
                var capList = state.capturedPieces[last.capturedPiece.color];
                for (var i = capList.length - 1; i >= 0; i--) {
                    if (capList[i].id === last.capturedPiece.id) {
                        capList.splice(i, 1);
                        break;
                    }
                }
            } else {
                state.board[last.toRow][last.toCol] = null;
            }

            state.currentPlayer = last.player;
            state.inCheck = last.inCheck;
            state.moveCount = Math.max(0, state.moveCount - 1);
        }

        state.selectedCell = null;
        state.isAiThinking = false;

        Sound.playFlip();
        autoSave();
        render();
        updateInfo();
    }

    // =============================================
    //  NEW GAME & ONLINE SYNC
    // =============================================

    function newGame() {
        if (timerInterval) clearInterval(timerInterval);
        state = createNewState(state ? state.gameMode : null, state ? state.aiDifficulty : null);
        
        // If Host in online mode: broadcast new board to Guest
        if (state.gameMode === 'online' && Multiplayer.isHost() && Multiplayer.isConnected()) {
            Multiplayer.send('sync_board', { board: state.board });
        }

        startTimer();
        Sound.playGameStart();
        autoSave();
        render();
        updateInfo();
        syncControlsUI();
    }

    function startTimer() {
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = setInterval(function () {
            if (state.gamePhase === 'ended') return;
            var key = 'player' + state.currentPlayer;
            state.timer[key]++;
            updateTimerDisplay();
        }, 1000);
    }

    function updateTimerDisplay() {
        function fmt(s) {
            var m = Math.floor(s / 60);
            var sec = s % 60;
            return (m < 10 ? '0' : '') + m + ':' + (sec < 10 ? '0' : '') + sec;
        }
        var el1 = document.getElementById('timer-p1');
        var el2 = document.getElementById('timer-p2');
        if (el1) el1.textContent = fmt(state.timer.player1);
        if (el2) el2.textContent = fmt(state.timer.player2);
    }

    function render() {
        var validMoves = state.selectedCell
            ? getValidMoves(state.selectedCell.row, state.selectedCell.col)
            : null;
        Board.renderBoard(state.board, state.selectedCell, validMoves);
    }

    function updateInfo() {
        updateTurnDisplay();
        updatePlayerCards();
        renderCapturedPieces();
        renderMoveHistory();
        updateMoveCount();
        updateTimerDisplay();
    }

    function updateTurnDisplay() {
        var el = document.getElementById('current-turn');
        if (!el) return;

        if (state.isAiThinking) {
            el.innerHTML = '🤖 <em>Máy đang suy nghĩ nước đi...</em>';
            el.className = 'turn-info thinking';
            return;
        }

        if (state.gamePhase === 'ended') {
            var cName = state.winner === 'red' ? 'ĐỎ' : 'ĐEN';
            el.textContent = '🏆 ' + cName + ' CHIẾN THẮNG!';
            el.className = 'turn-info ' + state.winner;
            return;
        }

        var color = getCurrentPlayerColor();
        var colorName = color === 'red' ? 'Đỏ (Đi trước)' : 'Đen';
        var pLabel = '';

        if (state.gameMode === 'pve') {
            pLabel = state.currentPlayer === 1 ? '👤 Bạn (Đỏ)' : '🤖 Máy tính (Đen)';
        } else if (state.gameMode === 'online') {
            var isMyTurn = (color === state.myOnlineColor);
            pLabel = isMyTurn ? '👉 Lượt của BẠN' : '⏳ Lượt của ĐỐI THỦ';
        } else {
            pLabel = 'Người chơi ' + state.currentPlayer + ' (' + (color === 'red' ? 'Đỏ' : 'Đen') + ')';
        }

        var checkNotice = state.inCheck ? ' ⚡ ĐANG BỊ CHIẾU!' : '';
        el.textContent = '🎯 ' + pLabel + ' [' + colorName + ']' + checkNotice;
        el.className = 'turn-info ' + color + (state.inCheck ? ' check-alert' : '');
    }

    function updatePlayerCards() {
        var p1ColorEl = document.getElementById('p1-color');
        var p2ColorEl = document.getElementById('p2-color');
        var p1Card = document.getElementById('player1-card');
        var p2Card = document.getElementById('player2-card');
        var p1Title = document.getElementById('player1-title');
        var p2Title = document.getElementById('player2-title');

        if (p1Title) {
            if (state.gameMode === 'online') {
                p1Title.innerHTML = state.myOnlineColor === 'red' ? '👤 Bạn (Chủ phòng)' : '👤 Chủ phòng (Đỏ)';
            } else {
                p1Title.innerHTML = '👤 Người chơi 1';
            }
        }

        if (p2Title) {
            if (state.gameMode === 'pve') {
                var diffNames = { easy: 'Dễ', medium: 'Vừa', hard: 'Khó' };
                p2Title.innerHTML = '🤖 Máy (' + (diffNames[state.aiDifficulty] || 'Vừa') + ')';
            } else if (state.gameMode === 'online') {
                p2Title.innerHTML = state.myOnlineColor === 'black' ? '👤 Bạn (Khách)' : '👤 Đối thủ Online';
            } else {
                p2Title.innerHTML = '👤 Người chơi 2';
            }
        }

        if (p1ColorEl) p1ColorEl.innerHTML = '<span class="color-dot red-dot"></span> Đỏ (Đi trước)';
        if (p2ColorEl) p2ColorEl.innerHTML = '<span class="color-dot black-dot"></span> Đen';

        if (p1Card) p1Card.classList.toggle('active', state.currentPlayer === 1 && state.gamePhase !== 'ended');
        if (p2Card) p2Card.classList.toggle('active', state.currentPlayer === 2 && state.gamePhase !== 'ended');
    }

    function renderCapturedPieces() {
        ['red', 'black'].forEach(function (color) {
            var el = document.getElementById('captured-' + color);
            if (!el) return;
            el.innerHTML = '';
            if (state.capturedPieces[color].length === 0) {
                el.innerHTML = '<span class="no-captured">—</span>';
                return;
            }
            state.capturedPieces[color].forEach(function (p) {
                var span = document.createElement('span');
                span.className = 'captured-piece ' + color;
                span.textContent = p.char;
                span.title = p.name;
                el.appendChild(span);
            });
        });
    }

    function renderMoveHistory() {
        var el = document.getElementById('move-list');
        if (!el) return;
        el.innerHTML = '';

        if (state.moveHistory.length === 0) {
            el.innerHTML = '<div class="no-moves">Chưa có nước đi nào</div>';
            return;
        }

        var start = Math.max(0, state.moveHistory.length - 30);
        for (var i = start; i < state.moveHistory.length; i++) {
            var move = state.moveHistory[i];
            var div = document.createElement('div');
            div.className = 'move-entry';

            var num = i + 1;
            var playerLabel = (state.gameMode === 'pve' && move.player === 2) ? '🤖' : ('P' + move.player);
            var html = '<span class="move-num">' + num + '. [' + playerLabel + ']</span> ';

            if (move.type === 'capture') {
                html += '<span class="move-text ' + move.piece.color + '-text">'
                    + move.piece.char + ' ⚔ ' + (move.capturedPiece ? move.capturedPiece.char : '?') + '</span>';
            } else {
                html += '<span class="move-text ' + move.piece.color + '-text">'
                    + move.piece.char + ' → (' + (move.toRow + 1) + ',' + (move.toCol + 1) + ')</span>';
            }

            if (move.wasFaceDown) {
                html += ' <em style="font-size:0.75rem; color:var(--gold)">✨ Mở ' + move.piece.name + '</em>';
            }

            div.innerHTML = html;
            el.appendChild(div);
        }

        el.scrollTop = el.scrollHeight;
    }

    function updateMoveCount() {
        var el = document.getElementById('move-count');
        if (el) el.textContent = state.moveCount;
    }

    function autoSave() {
        if (state.gameMode !== 'online') {
            Storage.saveGame(state);
        }
    }

    function clonePiece(piece) {
        if (!piece) return null;
        return {
            id: piece.id,
            type: piece.type,
            color: piece.color,
            char: piece.char,
            name: piece.name,
            faceUp: piece.faceUp,
            originalSpotType: piece.originalSpotType
        };
    }

    function syncControlsUI() {
        var modeBtns = document.querySelectorAll('.mode-btn');
        modeBtns.forEach(function (b) {
            b.classList.toggle('active', b.dataset.mode === state.gameMode);
        });

        var diffGroup = document.getElementById('ai-difficulty-group');
        if (diffGroup) {
            diffGroup.style.display = state.gameMode === 'pve' ? 'flex' : 'none';
        }

        var roomBadge = document.getElementById('online-room-badge');
        if (roomBadge) {
            roomBadge.style.display = (state.gameMode === 'online' && Multiplayer.getRoomCode()) ? 'flex' : 'none';
        }

        var undoBtn = document.getElementById('btn-undo');
        if (undoBtn) {
            undoBtn.style.display = state.gameMode === 'online' ? 'none' : 'inline-block';
        }

        var diffBtns = document.querySelectorAll('.diff-btn');
        diffBtns.forEach(function (b) {
            b.classList.toggle('active', b.dataset.diff === state.aiDifficulty);
        });
    }

    // =============================================
    //  MULTIPLAYER EVENTS DISPATCHER
    // =============================================

    function handleMultiplayerEvent(type, payload) {
        switch (type) {
            case 'url_room_detected':
                // Auto open room modal and fill join code
                var modal = document.getElementById('modal-online-room');
                if (modal) modal.classList.add('active');
                switchRoomTab('join');
                var inp = document.getElementById('input-join-code');
                if (inp) inp.value = payload.roomCode;
                break;

            case 'room_created':
                var readyBox = document.getElementById('host-ready-box');
                var loadingBox = document.getElementById('host-loading-box');
                var initBox = document.getElementById('host-init-box');
                var codeText = document.getElementById('display-room-code');
                var linkInp = document.getElementById('display-share-link');
                var roomBadgeCode = document.getElementById('current-room-code');

                if (loadingBox) loadingBox.style.display = 'none';
                if (initBox) initBox.style.display = 'none';
                if (readyBox) readyBox.style.display = 'block';
                if (codeText) codeText.textContent = payload.roomCode;
                if (roomBadgeCode) roomBadgeCode.textContent = payload.roomCode;
                if (linkInp) linkInp.value = Multiplayer.getShareableUrl(payload.roomCode);

                state.gameMode = 'online';
                state.myOnlineColor = 'red'; // Host is Red
                syncControlsUI();
                break;

            case 'connected':
                var roomModal = document.getElementById('modal-online-room');
                if (roomModal) roomModal.classList.remove('active');
                
                Sound.playGameStart();
                showToast('🎉 Đã kết nối với đối thủ! Trận đấu bắt đầu.');

                state.gameMode = 'online';
                state.myOnlineColor = payload.isHost ? 'red' : 'black';

                if (payload.isHost) {
                    // Host sends board setup to Guest
                    Multiplayer.send('sync_board', { board: state.board });
                }

                syncControlsUI();
                updatePlayerCards();
                updateTurnDisplay();
                break;

            case 'sync_board':
                // Guest receives board setup from Host
                if (payload && payload.board) {
                    state.board = payload.board;
                    render();
                }
                break;

            case 'move':
                // Remote move received from peer
                executeMove(payload.fromRow, payload.fromCol, payload.toRow, payload.toCol, payload.moveType, false);
                break;

            case 'disconnected':
                showToast('⚠️ ' + (payload.message || 'Đối thủ đã ngắt kết nối'), 4000);
                break;

            case 'error':
                showToast('❌ ' + payload.message, 3000);
                break;
        }
    }

    function switchRoomTab(tab) {
        var tabCreate = document.getElementById('tab-create-room');
        var tabJoin = document.getElementById('tab-join-room');
        var panelCreate = document.getElementById('panel-create-room');
        var panelJoin = document.getElementById('panel-join-room');

        if (tab === 'create') {
            if (tabCreate) tabCreate.classList.add('active');
            if (tabJoin) tabJoin.classList.remove('active');
            if (panelCreate) panelCreate.classList.add('active');
            if (panelJoin) panelJoin.classList.remove('active');
        } else {
            if (tabCreate) tabCreate.classList.remove('active');
            if (tabJoin) tabJoin.classList.add('active');
            if (panelCreate) panelCreate.classList.remove('active');
            if (panelJoin) panelJoin.classList.add('active');
        }
    }

    function setupControls() {
        // Mode buttons
        var modeBtns = document.querySelectorAll('.mode-btn');
        modeBtns.forEach(function (btn) {
            btn.addEventListener('click', function () {
                var newMode = this.dataset.mode;
                if (newMode === 'online') {
                    var modal = document.getElementById('modal-online-room');
                    if (modal) modal.classList.add('active');
                    return;
                }

                if (state.gameMode === newMode) return;
                state.gameMode = newMode;
                Multiplayer.cleanup();
                syncControlsUI();
                updatePlayerCards();
                updateTurnDisplay();
                Storage.saveSettings({
                    soundEnabled: Sound.isEnabled(),
                    volume: Sound.getVolume(),
                    gameMode: state.gameMode,
                    aiDifficulty: state.aiDifficulty
                });
                showToast(newMode === 'pve' ? '🤖 Chế độ: Chơi với Máy' : '👥 Chế độ: Cùng máy');
                autoSave();

                if (state.gameMode === 'pve' && state.currentPlayer === 2) {
                    triggerAiTurnIfNeeded();
                }
            });
        });

        // Difficulty buttons
        var diffBtns = document.querySelectorAll('.diff-btn');
        diffBtns.forEach(function (btn) {
            btn.addEventListener('click', function () {
                var newDiff = this.dataset.diff;
                state.aiDifficulty = newDiff;
                syncControlsUI();
                updatePlayerCards();
                Storage.saveSettings({
                    soundEnabled: Sound.isEnabled(),
                    volume: Sound.getVolume(),
                    gameMode: state.gameMode,
                    aiDifficulty: state.aiDifficulty
                });
                var diffNames = { easy: 'Dễ 🟢', medium: 'Vừa 🟡', hard: 'Khó 🔴' };
                showToast('Độ khó: ' + (diffNames[newDiff] || newDiff));
                autoSave();
            });
        });

        // Online Room Tabs
        var tabCreate = document.getElementById('tab-create-room');
        if (tabCreate) tabCreate.addEventListener('click', function () { switchRoomTab('create'); });

        var tabJoin = document.getElementById('tab-join-room');
        if (tabJoin) tabJoin.addEventListener('click', function () { switchRoomTab('join'); });

        // Start Create Room button
        var btnStartCreate = document.getElementById('btn-start-create-room');
        if (btnStartCreate) {
            btnStartCreate.addEventListener('click', function () {
                var initBox = document.getElementById('host-init-box');
                var loadingBox = document.getElementById('host-loading-box');
                if (initBox) initBox.style.display = 'none';
                if (loadingBox) loadingBox.style.display = 'block';

                Multiplayer.createRoom(function (success, res) {
                    if (!success) {
                        showToast('❌ ' + res);
                        if (initBox) initBox.style.display = 'block';
                        if (loadingBox) loadingBox.style.display = 'none';
                    }
                });
            });
        }

        // Start Join Room button
        var btnStartJoin = document.getElementById('btn-start-join-room');
        if (btnStartJoin) {
            btnStartJoin.addEventListener('click', function () {
                var inp = document.getElementById('input-join-code');
                var code = inp ? inp.value : '';
                if (!code) {
                    showToast('⚠️ Vui lòng nhập mã phòng 4 chữ số');
                    return;
                }

                btnStartJoin.textContent = '⏳ Đang kết nối...';
                btnStartJoin.disabled = true;

                Multiplayer.joinRoom(code, function (success, err) {
                    btnStartJoin.textContent = 'Tham Gia Ngay';
                    btnStartJoin.disabled = false;
                    if (!success) {
                        showToast('❌ ' + err);
                    }
                });
            });
        }

        // Copy Code button
        var btnCopyCode = document.getElementById('btn-copy-code');
        if (btnCopyCode) {
            btnCopyCode.addEventListener('click', function () {
                var code = Multiplayer.getRoomCode();
                if (code && navigator.clipboard) {
                    navigator.clipboard.writeText(code);
                    showToast('📋 Đã sao chép mã phòng: ' + code);
                }
            });
        }

        // Copy Link button
        var btnCopyLink = document.getElementById('btn-copy-link');
        if (btnCopyLink) {
            btnCopyLink.addEventListener('click', function () {
                var code = Multiplayer.getRoomCode();
                if (code && navigator.clipboard) {
                    var url = Multiplayer.getShareableUrl(code);
                    navigator.clipboard.writeText(url);
                    showToast('🔗 Đã sao chép link mời bạn bè!');
                }
            });
        }

        // Room Info Button on Config Bar
        var btnRoomInfo = document.getElementById('btn-room-info');
        if (btnRoomInfo) {
            btnRoomInfo.addEventListener('click', function () {
                var modal = document.getElementById('modal-online-room');
                if (modal) modal.classList.add('active');
                switchRoomTab('create');
            });
        }

        // Leave Room Button
        var btnLeaveRoom = document.getElementById('btn-leave-room');
        if (btnLeaveRoom) {
            btnLeaveRoom.addEventListener('click', function () {
                Multiplayer.cleanup();
                state.gameMode = 'pve';
                syncControlsUI();
                updatePlayerCards();
                updateTurnDisplay();
                showToast('Đã rời phòng đấu online');
            });
        }

        // New game
        var btnNew = document.getElementById('btn-new-game');
        if (btnNew) btnNew.addEventListener('click', function () {
            var modal = document.getElementById('modal-confirm');
            if (modal) modal.classList.add('active');
        });

        var btnConfirmNew = document.getElementById('btn-confirm-new');
        if (btnConfirmNew) btnConfirmNew.addEventListener('click', function () {
            var modal = document.getElementById('modal-confirm');
            if (modal) modal.classList.remove('active');
            newGame();
        });

        var btnCancelNew = document.getElementById('btn-cancel-new');
        if (btnCancelNew) btnCancelNew.addEventListener('click', function () {
            var modal = document.getElementById('modal-confirm');
            if (modal) modal.classList.remove('active');
        });

        // Undo
        var btnUndo = document.getElementById('btn-undo');
        if (btnUndo) btnUndo.addEventListener('click', undo);

        // Sound
        var btnSound = document.getElementById('btn-sound');
        if (btnSound) btnSound.addEventListener('click', function () {
            var en = !Sound.isEnabled();
            Sound.setEnabled(en);
            btnSound.textContent = en ? '🔊' : '🔇';
            btnSound.title = en ? 'Tắt âm thanh' : 'Bật âm thanh';
            Storage.saveSettings({
                soundEnabled: en,
                volume: Sound.getVolume(),
                gameMode: state.gameMode,
                aiDifficulty: state.aiDifficulty
            });
        });

        // Help
        var btnHelp = document.getElementById('btn-help');
        if (btnHelp) btnHelp.addEventListener('click', function () {
            var modal = document.getElementById('modal-help');
            if (modal) modal.classList.add('active');
        });

        // Match history
        var btnHistory = document.getElementById('btn-history');
        if (btnHistory) btnHistory.addEventListener('click', function () {
            renderMatchHistory();
            var modal = document.getElementById('modal-match-history');
            if (modal) modal.classList.add('active');
        });

        // Close modal buttons
        var closeButtons = document.querySelectorAll('.modal-close');
        for (var i = 0; i < closeButtons.length; i++) {
            closeButtons[i].addEventListener('click', function () {
                var overlay = this.closest('.modal-overlay');
                if (overlay) overlay.classList.remove('active');
            });
        }

        var overlays = document.querySelectorAll('.modal-overlay');
        for (var j = 0; j < overlays.length; j++) {
            overlays[j].addEventListener('click', function (e) {
                if (e.target === this) this.classList.remove('active');
            });
        }

        var btnPlayAgain = document.getElementById('btn-play-again');
        if (btnPlayAgain) btnPlayAgain.addEventListener('click', function () {
            var modal = document.getElementById('modal-winner');
            if (modal) modal.classList.remove('active');
            newGame();
        });

        var btnClearHistory = document.getElementById('btn-clear-history');
        if (btnClearHistory) btnClearHistory.addEventListener('click', function () {
            Storage.clearMatchHistory();
            renderMatchHistory();
        });
    }

    function renderMatchHistory() {
        var el = document.getElementById('match-history-list');
        if (!el) return;
        var history = Storage.getMatchHistory();
        el.innerHTML = '';

        if (history.length === 0) {
            el.innerHTML = '<p class="no-history">Chưa có ván đấu nào được ghi lại.</p>';
            return;
        }

        history.forEach(function (match, i) {
            var div = document.createElement('div');
            div.className = 'match-entry';
            var colorName = match.winner === 'red' ? 'Đỏ' : 'Đen';
            var date = '';
            try {
                date = new Date(match.date).toLocaleString('vi-VN');
            } catch (e) { date = match.date; }

            var durationStr = '';
            if (match.duration) {
                var m = Math.floor(match.duration / 60);
                var s = match.duration % 60;
                durationStr = m + ' phút ' + s + 's';
            }

            var modeBadge = match.gameMode === 'pve' ? '🤖 vs Máy' : (match.gameMode === 'online' ? '🌐 Đấu Online' : '👥 2 Người');

            div.innerHTML = ''
                + '<div class="match-header">'
                + '<span class="match-num">#' + (i + 1) + '</span>'
                + '<span class="match-winner ' + match.winner + '-text">' + colorName + ' thắng</span>'
                + '<span class="match-mode-badge">' + modeBadge + '</span>'
                + '</div>'
                + '<div class="match-details">'
                + '<span>📊 ' + (match.moves || '?') + ' nước</span>'
                + (durationStr ? '<span>⏱ ' + durationStr + '</span>' : '')
                + '<span>📅 ' + date + '</span>'
                + '</div>';

            el.appendChild(div);
        });
    }

    function init() {
        Board.init('board', handleCellClick);
        Effects.init();
        Multiplayer.init(handleMultiplayerEvent);

        var settings = Storage.loadSettings();
        Sound.setEnabled(settings.soundEnabled);
        Sound.setVolume(settings.volume);

        var btnSound = document.getElementById('btn-sound');
        if (btnSound) {
            btnSound.textContent = settings.soundEnabled ? '🔊' : '🔇';
        }

        Storage.clearGame();
        state = createNewState(settings.gameMode, settings.aiDifficulty);

        startTimer();
        render();
        updateInfo();
        setupControls();
        syncControlsUI();
    }

    function showToast(message, duration) {
        duration = duration || 3000;
        var toast = document.getElementById('toast');
        if (!toast) return;
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(function () {
            toast.classList.remove('show');
        }, duration);
    }

    return {
        init: init,
        newGame: newGame,
        undo: undo,
        getValidMoves: getValidMoves,
        getRawPieceMoves: getRawPieceMoves,
        isKingInCheck: isKingInCheck,
        hasAnyLegalMoves: hasAnyLegalMoves,
        isFlyingGeneral: isFlyingGeneral
    };
})();

document.addEventListener('DOMContentLoaded', function () {
    window.CoUp.Game.init();
});
