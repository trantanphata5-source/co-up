/**
 * Cờ Úp - Board Renderer
 * 
 * Renders an authentic 9×10 Xiangqi (Cờ Tướng) board matching
 * pngtree-chess-paper-png-image_2845610.jpg:
 * - 9 vertical lines × 10 horizontal lines (90 intersections)
 * - Pure white / light paper background with crimson red (#b32424) grid lines
 * - Double outer frame (thick outer border, thin inner border)
 * - River band with "楚 河" (Sở Hà) and "漢 界" (Hán Giới)
 * - Dashed palace diagonals (X) for top (rows 0-2, cols 3-5) and bottom (rows 7-9, cols 3-5)
 * - Traditional 4-corner tick marks (╬) at cannon and soldier positions
 * - Pieces sit directly on INTERSECTIONS, not inside cells
 */
window.CoUp = window.CoUp || {};

window.CoUp.Board = (function () {
    'use strict';

    var ROWS = 10;
    var COLS = 9;

    var boardElement = null;
    var intersectionElements = []; // [row][col]
    var onCellClick = null;
    var boardSvg = null;

    // Grid coordinate metrics (viewBox: 0 0 720 810)
    var VB_W = 720;
    var VB_H = 810;
    var PAD_X = 40;
    var PAD_Y = 45;
    var GRID_W = VB_W - 2 * PAD_X; // 640
    var GRID_H = VB_H - 2 * PAD_Y; // 720
    var STEP_X = GRID_W / 8;        // 80
    var STEP_Y = GRID_H / 9;        // 80

    function getX(col) {
        return PAD_X + col * STEP_X;
    }

    function getY(row) {
        return PAD_Y + row * STEP_Y;
    }

    function getPercentX(col) {
        return (getX(col) / VB_W) * 100;
    }

    function getPercentY(row) {
        return (getY(row) / VB_H) * 100;
    }

    /**
     * Initialize board
     */
    function init(containerId, clickHandler) {
        boardElement = document.getElementById(containerId);
        onCellClick = clickHandler;
        createBoard();
    }

    /**
     * Generate the complete SVG markup for the Xiangqi board
     */
    function generateBoardSvg() {
        var red = '#b32424';
        var bg = '#ffffff';

        var svg = [];
        svg.push('<svg class="board-bg-svg" viewBox="0 0 ' + VB_W + ' ' + VB_H + '" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">');
        
        // Background
        svg.push('<rect width="' + VB_W + '" height="' + VB_H + '" fill="' + bg + '"/>');

        // 1. Outer Double Frame
        // Outer thick border
        svg.push('<rect x="12" y="12" width="' + (VB_W - 24) + '" height="' + (VB_H - 24) + '" fill="none" stroke="' + red + '" stroke-width="4.5"/>');
        // Inner thin border
        svg.push('<rect x="22" y="22" width="' + (VB_W - 44) + '" height="' + (VB_H - 44) + '" fill="none" stroke="' + red + '" stroke-width="1.8"/>');

        // 2. Horizontal Lines (10 lines from col 0 to col 8)
        for (var r = 0; r < ROWS; r++) {
            var y = getY(r);
            svg.push('<line x1="' + getX(0) + '" y1="' + y + '" x2="' + getX(8) + '" y2="' + y + '" stroke="' + red + '" stroke-width="1.8"/>');
        }

        // 3. Vertical Lines
        // Left & right borders cross the river completely
        svg.push('<line x1="' + getX(0) + '" y1="' + getY(0) + '" x2="' + getX(0) + '" y2="' + getY(9) + '" stroke="' + red + '" stroke-width="1.8"/>');
        svg.push('<line x1="' + getX(8) + '" y1="' + getY(0) + '" x2="' + getX(8) + '" y2="' + getY(9) + '" stroke="' + red + '" stroke-width="1.8"/>');

        // Inner vertical lines DO NOT cross the river (row 0-4 and row 5-9)
        for (var c = 1; c < 8; c++) {
            var x = getX(c);
            // Top half: row 0 to row 4
            svg.push('<line x1="' + x + '" y1="' + getY(0) + '" x2="' + x + '" y2="' + getY(4) + '" stroke="' + red + '" stroke-width="1.8"/>');
            // Bottom half: row 5 to row 9
            svg.push('<line x1="' + x + '" y1="' + getY(5) + '" x2="' + x + '" y2="' + getY(9) + '" stroke="' + red + '" stroke-width="1.8"/>');
        }

        // 4. Palace Diagonal Lines (X) - dashed
        var dash = 'stroke-dasharray="7,5"';
        // Top palace: cols 3 to 5, rows 0 to 2
        svg.push('<line x1="' + getX(3) + '" y1="' + getY(0) + '" x2="' + getX(5) + '" y2="' + getY(2) + '" stroke="' + red + '" stroke-width="1.6" ' + dash + '/>');
        svg.push('<line x1="' + getX(5) + '" y1="' + getY(0) + '" x2="' + getX(3) + '" y2="' + getY(2) + '" stroke="' + red + '" stroke-width="1.6" ' + dash + '/>');

        // Bottom palace: cols 3 to 5, rows 7 to 9
        svg.push('<line x1="' + getX(3) + '" y1="' + getY(7) + '" x2="' + getX(5) + '" y2="' + getY(9) + '" stroke="' + red + '" stroke-width="1.6" ' + dash + '/>');
        svg.push('<line x1="' + getX(5) + '" y1="' + getY(7) + '" x2="' + getX(3) + '" y2="' + getY(9) + '" stroke="' + red + '" stroke-width="1.6" ' + dash + '/>');

        // 5. River Text (楚河 - 漢界)
        var riverY = (getY(4) + getY(5)) / 2 + 10;
        svg.push('<text x="' + (getX(1) + getX(2)) / 2 + '" y="' + riverY + '" font-family="\'Noto Serif TC\', \'SimSun\', serif" font-size="34" font-weight="900" fill="' + red + '" text-anchor="middle" letter-spacing="16">楚河</text>');
        svg.push('<text x="' + (getX(6) + getX(7)) / 2 + '" y="' + riverY + '" font-family="\'Noto Serif TC\', \'SimSun\', serif" font-size="34" font-weight="900" fill="' + red + '" text-anchor="middle" letter-spacing="16">漢界</text>');

        // 6. Position Markers (Star tick marks ╬)
        var markPositions = [
            // Top Cannons
            { r: 2, c: 1 }, { r: 2, c: 7 },
            // Top Soldiers
            { r: 3, c: 0 }, { r: 3, c: 2 }, { r: 3, c: 4 }, { r: 3, c: 6 }, { r: 3, c: 8 },
            // Bottom Soldiers
            { r: 6, c: 0 }, { r: 6, c: 2 }, { r: 6, c: 4 }, { r: 6, c: 6 }, { r: 6, c: 8 },
            // Bottom Cannons
            { r: 7, c: 1 }, { r: 7, c: 7 }
        ];

        markPositions.forEach(function (pos) {
            svg.push(generateTickMarkSvg(pos.r, pos.c, red));
        });

        svg.push('</svg>');
        return svg.join('\n');
    }

    /**
     * Generate SVG path for a 4-bracket corner mark around an intersection
     */
    function generateTickMarkSvg(row, col, color) {
        var cx = getX(col);
        var cy = getY(row);
        var g = 6;  // gap from intersection center
        var s = 10; // length of mark
        var paths = [];

        // Top-left
        if (col > 0) {
            paths.push('M ' + (cx - g - s) + ' ' + (cy - g) + ' L ' + (cx - g) + ' ' + (cy - g) + ' L ' + (cx - g) + ' ' + (cy - g - s));
        }
        // Top-right
        if (col < 8) {
            paths.push('M ' + (cx + g + s) + ' ' + (cy - g) + ' L ' + (cx + g) + ' ' + (cy - g) + ' L ' + (cx + g) + ' ' + (cy - g - s));
        }
        // Bottom-left
        if (col > 0) {
            paths.push('M ' + (cx - g - s) + ' ' + (cy + g) + ' L ' + (cx - g) + ' ' + (cy + g) + ' L ' + (cx - g) + ' ' + (cy + g + s));
        }
        // Bottom-right
        if (col < 8) {
            paths.push('M ' + (cx + g + s) + ' ' + (cy + g) + ' L ' + (cx + g) + ' ' + (cy + g) + ' L ' + (cx + g) + ' ' + (cy + g + s));
        }

        return '<path d="' + paths.join(' ') + '" fill="none" stroke="' + color + '" stroke-width="1.6"/>';
    }

    /**
     * Create DOM structure for the board:
     * - Background SVG (lines, river, frame, markers)
     * - 90 Intersection nodes placed precisely at (col, row)
     */
    function createBoard() {
        boardElement.innerHTML = '';
        intersectionElements = [];

        // 1. Insert vector SVG board background
        var svgContainer = document.createElement('div');
        svgContainer.className = 'board-svg-container';
        svgContainer.innerHTML = generateBoardSvg();
        boardElement.appendChild(svgContainer);

        // 2. Overlay container for 90 intersection interaction points
        var pointsOverlay = document.createElement('div');
        pointsOverlay.className = 'board-intersections-overlay';
        boardElement.appendChild(pointsOverlay);

        for (var r = 0; r < ROWS; r++) {
            intersectionElements[r] = [];
            for (var c = 0; c < COLS; c++) {
                var node = document.createElement('div');
                node.className = 'intersection-node';
                node.dataset.row = r;
                node.dataset.col = c;
                node.style.left = getPercentX(c) + '%';
                node.style.top = getPercentY(r) + '%';

                // Piece container
                var pieceEl = document.createElement('div');
                pieceEl.className = 'piece';
                pieceEl.style.visibility = 'hidden';
                pieceEl.dataset.state = 'empty';

                var inner = document.createElement('div');
                inner.className = 'piece-inner';

                var front = document.createElement('div');
                front.className = 'piece-face piece-front';

                var back = document.createElement('div');
                back.className = 'piece-face piece-back';
                var backIcon = document.createElement('span');
                backIcon.className = 'back-icon';
                backIcon.textContent = '棋';
                back.appendChild(backIcon);

                inner.appendChild(front);
                inner.appendChild(back);
                pieceEl.appendChild(inner);
                node.appendChild(pieceEl);

                // Move indicator dot
                var dot = document.createElement('div');
                dot.className = 'move-dot';
                node.appendChild(dot);

                // Click listener
                (function (row, col) {
                    node.addEventListener('click', function (e) {
                        e.stopPropagation();
                        if (onCellClick) onCellClick(row, col);
                    });
                })(r, c);

                intersectionElements[r][c] = node;
                pointsOverlay.appendChild(node);
            }
        }
    }

    /**
     * Render the whole board state
     */
    function renderBoard(board, selectedCell, validMoves) {
        for (var r = 0; r < ROWS; r++) {
            for (var c = 0; c < COLS; c++) {
                updateIntersection(r, c, board[r][c], selectedCell, validMoves);
            }
        }
    }

    /**
     * Update a single intersection appearance
     */
    function updateIntersection(row, col, piece, selectedCell, validMoves) {
        var node = intersectionElements[row][col];
        var pieceEl = node.querySelector('.piece');
        var front = node.querySelector('.piece-front');

        node.classList.remove('selected', 'valid-move', 'valid-capture');

        // Selection highlight
        if (selectedCell && selectedCell.row === row && selectedCell.col === col) {
            node.classList.add('selected');
        }

        // Valid move / capture highlight
        if (validMoves) {
            for (var i = 0; i < validMoves.length; i++) {
                if (validMoves[i].row === row && validMoves[i].col === col) {
                    node.classList.add(validMoves[i].type === 'capture' ? 'valid-capture' : 'valid-move');
                    break;
                }
            }
        }

        var prevState = pieceEl.dataset.state;

        if (!piece) {
            if (prevState === 'up' || prevState === 'down') {
                pieceEl.classList.add('fade-out');
                setTimeout(function () {
                    pieceEl.style.visibility = 'hidden';
                    pieceEl.classList.remove('fade-out');
                    pieceEl.className = 'piece';
                }, 200);
            } else {
                pieceEl.style.visibility = 'hidden';
                pieceEl.className = 'piece';
            }
            pieceEl.dataset.state = 'empty';
            return;
        }

        pieceEl.style.visibility = 'visible';
        front.textContent = piece.char;

        if (piece.faceUp) {
            if (prevState === 'down') {
                // Flip animation
                pieceEl.className = 'piece ' + piece.color + ' flip-anim';
                pieceEl.offsetHeight; // force reflow
                setTimeout(function () {
                    pieceEl.className = 'piece ' + piece.color + ' face-up';
                }, 650);
            } else if (prevState === 'empty') {
                // Arrive animation
                pieceEl.className = 'piece ' + piece.color + ' face-up arrive-anim';
                setTimeout(function () {
                    pieceEl.classList.remove('arrive-anim');
                }, 350);
            } else {
                pieceEl.className = 'piece ' + piece.color + ' face-up';
            }
            pieceEl.dataset.state = 'up';
        } else {
            pieceEl.className = 'piece face-down';
            pieceEl.dataset.state = 'down';
        }
    }

    function getCellElement(row, col) {
        return intersectionElements[row] ? intersectionElements[row][col] : null;
    }

    function getPieceElement(row, col) {
        var cell = getCellElement(row, col);
        return cell ? cell.querySelector('.piece') : null;
    }

    return {
        init: init,
        renderBoard: renderBoard,
        getCellElement: getCellElement,
        getPieceElement: getPieceElement,
        ROWS: ROWS,
        COLS: COLS
    };
})();
