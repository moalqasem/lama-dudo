// Ludo Board Coordinates & Geometry Engine - Lama Ludo Edition

const BOARD_SIZE = 15; // 15x15 grid

// 52 Main track coordinates: [x, y] in 0..14 grid
const MAIN_TRACK = [
    [1, 6],  // 0 - Red Start
    [2, 6],  // 1
    [3, 6],  // 2
    [4, 6],  // 3 - 🚀 Rocket
    [5, 6],  // 4
    [6, 5],  // 5 - 🛡️ Shield
    [6, 4],  // 6
    [6, 3],  // 7
    [6, 2],  // 8 - Safe Star
    [6, 1],  // 9 - 🎲 Magic Dice
    [6, 0],  // 10
    [7, 0],  // 11
    [8, 0],  // 12
    [8, 1],  // 13 - Green Start
    [8, 2],  // 14
    [8, 3],  // 15
    [8, 4],  // 16 - 🚀 Rocket
    [8, 5],  // 17
    [9, 6],  // 18 - 🛡️ Shield
    [10, 6], // 19
    [11, 6], // 20
    [12, 6], // 21 - Safe Star
    [13, 6], // 22 - 🎲 Magic Dice
    [14, 6], // 23
    [14, 7], // 24
    [14, 8], // 25
    [13, 8], // 26 - Yellow Start
    [12, 8], // 27
    [12, 8], // 28
    [10, 8], // 29 - 🚀 Rocket
    [9, 8],  // 30
    [8, 9],  // 31 - 🛡️ Shield
    [8, 10], // 32
    [8, 11], // 33
    [8, 12], // 34 - Safe Star
    [8, 13], // 35 - 🎲 Magic Dice
    [8, 14], // 36
    [7, 14], // 37
    [6, 14], // 38
    [6, 13], // 39 - Blue Start
    [6, 12], // 40
    [6, 11], // 41
    [6, 10], // 42 - 🚀 Rocket
    [6, 9],  // 43
    [5, 8],  // 44 - 🛡️ Shield
    [4, 8],  // 45
    [3, 8],  // 46
    [2, 8],  // 47 - Safe Star
    [1, 8],  // 48 - 🎲 Magic Dice
    [0, 8],  // 49
    [0, 7],  // 50
    [0, 6]   // 51
];

// Correct fixed 52 track coordinate mapping
const ACCURATE_MAIN_TRACK = [
    [1, 6],  // 0 - Red Start
    [2, 6],  // 1
    [3, 6],  // 2
    [4, 6],  // 3 - 🚀 Rocket
    [5, 6],  // 4
    [6, 5],  // 5 - 🛡️ Shield
    [6, 4],  // 6
    [6, 3],  // 7
    [6, 2],  // 8 - Safe Star (Top-Left)
    [6, 1],  // 9 - 🎲 Magic Dice
    [6, 0],  // 10
    [7, 0],  // 11
    [8, 0],  // 12
    [8, 1],  // 13 - Green Start
    [8, 2],  // 14
    [8, 3],  // 15
    [8, 4],  // 16 - 🚀 Rocket
    [8, 5],  // 17
    [9, 6],  // 18 - 🛡️ Shield
    [10, 6], // 19
    [11, 6], // 20
    [12, 6], // 21 - Safe Star (Top-Right)
    [13, 6], // 22 - 🎲 Magic Dice
    [14, 6], // 23
    [14, 7], // 24
    [14, 8], // 25
    [13, 8], // 26 - Yellow Start
    [12, 8], // 27
    [11, 8], // 28
    [10, 8], // 29 - 🚀 Rocket
    [9, 8],  // 30
    [8, 9],  // 31 - 🛡️ Shield
    [8, 10], // 32
    [8, 11], // 33
    [8, 12], // 34 - Safe Star (Bottom-Right)
    [8, 13], // 35 - 🎲 Magic Dice
    [8, 14], // 36
    [7, 14], // 37
    [6, 14], // 38
    [6, 13], // 39 - Blue Start
    [6, 12], // 40
    [6, 11], // 41
    [6, 10], // 42 - 🚀 Rocket
    [6, 9],  // 43
    [5, 8],  // 44 - 🛡️ Shield
    [4, 8],  // 45
    [3, 8],  // 46
    [2, 8],  // 47 - Safe Star (Bottom-Left)
    [1, 8],  // 48 - 🎲 Magic Dice
    [0, 8],  // 49
    [0, 7],  // 50
    [0, 6]   // 51
];

// Safe track indices
const SAFE_INDICES = [0, 8, 13, 21, 26, 34, 39, 47];

// Dedicated Lama Ludo Magic Tiles placed directly on the board
const MAGIC_TILES = {
    3: { type: 'rocket', icon: '🚀', name: 'صاروخ' },
    5: { type: 'shield', icon: '🛡️', name: 'درع حماية' },
    9: { type: 'magicDice', icon: '🎲', name: 'نرد سحري' },
    16: { type: 'rocket', icon: '🚀', name: 'صاروخ' },
    18: { type: 'shield', icon: '🛡️', name: 'درع حماية' },
    22: { type: 'magicDice', icon: '🎲', name: 'نرد سحري' },
    29: { type: 'rocket', icon: '🚀', name: 'صاروخ' },
    31: { type: 'shield', icon: '🛡️', name: 'درع حماية' },
    35: { type: 'magicDice', icon: '🎲', name: 'نرد سحري' },
    42: { type: 'rocket', icon: '🚀', name: 'صاروخ' },
    44: { type: 'shield', icon: '🛡️', name: 'درع حماية' },
    48: { type: 'magicDice', icon: '🎲', name: 'نرد سحري' }
};

// Player configuration:
const PLAYER_CONFIG = [
    {
        id: 0,
        colorKey: 'red',
        nameAr: 'الأحمر',
        primaryColor: '#e53935',
        lightColor: '#ffcdd2',
        darkColor: '#b71c1c',
        startTrackIndex: 0,
        homePath: [
            [1, 7], [2, 7], [3, 7], [4, 7], [5, 7]
        ],
        homeCenter: [6.4, 7],
        yardPositions: [
            [1.8, 1.8], [3.8, 1.8],
            [1.8, 3.8], [3.8, 3.8]
        ]
    },
    {
        id: 1,
        colorKey: 'green',
        nameAr: 'الأخضر',
        primaryColor: '#2e7d32',
        lightColor: '#c8e6c9',
        darkColor: '#1b5e20',
        startTrackIndex: 13,
        homePath: [
            [7, 1], [7, 2], [7, 3], [7, 4], [7, 5]
        ],
        homeCenter: [7, 6.4],
        yardPositions: [
            [10.8, 1.8], [12.8, 1.8],
            [10.8, 3.8], [12.8, 3.8]
        ]
    },
    {
        id: 2,
        colorKey: 'yellow',
        nameAr: 'الأصفر',
        primaryColor: '#f59e0b',
        lightColor: '#fef08a',
        darkColor: '#b45309',
        startTrackIndex: 26,
        homePath: [
            [13, 7], [12, 7], [11, 7], [10, 7], [9, 7]
        ],
        homeCenter: [7.6, 7],
        yardPositions: [
            [10.8, 10.8], [12.8, 10.8],
            [10.8, 12.8], [12.8, 12.8]
        ]
    },
    {
        id: 3,
        colorKey: 'blue',
        nameAr: 'الأزرق',
        primaryColor: '#1e88e5',
        lightColor: '#bbdefb',
        darkColor: '#0d47a1',
        startTrackIndex: 39,
        homePath: [
            [7, 13], [7, 12], [7, 11], [7, 10], [7, 9]
        ],
        homeCenter: [7, 7.6],
        yardPositions: [
            [1.8, 10.8], [3.8, 10.8],
            [1.8, 12.8], [3.8, 12.8]
        ]
    }
];

function getTokenGridPos(playerIndex, tokenIndex, step) {
    const p = PLAYER_CONFIG[playerIndex];
    if (step === -1) {
        return p.yardPositions[tokenIndex];
    }
    if (step >= 0 && step <= 50) {
        const trackIdx = (p.startTrackIndex + step) % 52;
        const cell = ACCURATE_MAIN_TRACK[trackIdx];
        return [cell[0] + 0.5, cell[1] + 0.5];
    }
    if (step >= 51 && step <= 55) {
        const pathCell = p.homePath[step - 51];
        return [pathCell[0] + 0.5, pathCell[1] + 0.5];
    }
    if (step === 56) {
        return p.homeCenter;
    }
    return [0, 0];
}

function getTrackIndex(playerIndex, step) {
    if (step >= 0 && step <= 50) {
        return (PLAYER_CONFIG[playerIndex].startTrackIndex + step) % 52;
    }
    return -1;
}

function isStepSafe(playerIndex, step) {
    if (step < 0) return true;
    if (step >= 51) return true;
    const trackIdx = getTrackIndex(playerIndex, step);
    return SAFE_INDICES.includes(trackIdx);
}

// Render Lama Ludo Luxury SVG Board
function createLudoBoardSVG() {
    const cellSize = 40;
    const boardPx = cellSize * 15; // 600px

    let svg = `<svg id="ludo-svg-board" viewBox="0 0 ${boardPx} ${boardPx}" width="100%" height="100%">
        <defs>
            <linearGradient id="frame-gold" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#b45309" />
                <stop offset="25%" stop-color="#fef08a" />
                <stop offset="50%" stop-color="#f59e0b" />
                <stop offset="75%" stop-color="#fef9c3" />
                <stop offset="100%" stop-color="#78350f" />
            </linearGradient>

            <linearGradient id="board-bg-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#faf7f2" />
                <stop offset="100%" stop-color="#ede6db" />
            </linearGradient>

            <!-- Yards Royal Gradients -->
            <radialGradient id="yard-red-grad" cx="40%" cy="40%" r="70%">
                <stop offset="0%" stop-color="#ff5252" />
                <stop offset="60%" stop-color="#d32f2f" />
                <stop offset="100%" stop-color="#8b0000" />
            </radialGradient>
            <radialGradient id="yard-green-grad" cx="40%" cy="40%" r="70%">
                <stop offset="0%" stop-color="#4caf50" />
                <stop offset="60%" stop-color="#2e7d32" />
                <stop offset="100%" stop-color="#14532d" />
            </radialGradient>
            <radialGradient id="yard-yellow-grad" cx="40%" cy="40%" r="70%">
                <stop offset="0%" stop-color="#fef08a" />
                <stop offset="50%" stop-color="#f59e0b" />
                <stop offset="100%" stop-color="#b45309" />
            </radialGradient>
            <radialGradient id="yard-blue-grad" cx="40%" cy="40%" r="70%">
                <stop offset="0%" stop-color="#42a5f5" />
                <stop offset="60%" stop-color="#1976d2" />
                <stop offset="100%" stop-color="#0d47a1" />
            </radialGradient>

            <!-- Home Paths Gradients -->
            <linearGradient id="path-red" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#ef5350" />
                <stop offset="100%" stop-color="#c62828" />
            </linearGradient>
            <linearGradient id="path-green" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#66bb6a" />
                <stop offset="100%" stop-color="#2e7d32" />
            </linearGradient>
            <linearGradient id="path-yellow" x1="100%" y1="0%" x2="0%" y2="0%">
                <stop offset="0%" stop-color="#fde047" />
                <stop offset="100%" stop-color="#d97706" />
            </linearGradient>
            <linearGradient id="path-blue" x1="0%" y1="100%" x2="0%" y2="0%">
                <stop offset="0%" stop-color="#42a5f5" />
                <stop offset="100%" stop-color="#1565c0" />
            </linearGradient>

            <radialGradient id="pocket-recess" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stop-color="#f1f5f9" />
                <stop offset="70%" stop-color="#cbd5e1" />
                <stop offset="100%" stop-color="#94a3b8" />
            </radialGradient>

            <linearGradient id="gold-star-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#fffbeb" />
                <stop offset="50%" stop-color="#f59e0b" />
                <stop offset="100%" stop-color="#92400e" />
            </linearGradient>

            <radialGradient id="crown-gold-grad" cx="50%" cy="40%" r="60%">
                <stop offset="0%" stop-color="#fffbeb" />
                <stop offset="35%" stop-color="#fef08a" />
                <stop offset="70%" stop-color="#f59e0b" />
                <stop offset="100%" stop-color="#78350f" />
            </radialGradient>

            <!-- Pawn 3D Sphere Gradients -->
            <radialGradient id="pawn-red-sphere" cx="35%" cy="30%" r="65%">
                <stop offset="0%" stop-color="#ffffff" />
                <stop offset="25%" stop-color="#ff5252" />
                <stop offset="70%" stop-color="#d32f2f" />
                <stop offset="100%" stop-color="#6b0000" />
            </radialGradient>
            <radialGradient id="pawn-green-sphere" cx="35%" cy="30%" r="65%">
                <stop offset="0%" stop-color="#ffffff" />
                <stop offset="25%" stop-color="#66bb6a" />
                <stop offset="70%" stop-color="#2e7d32" />
                <stop offset="100%" stop-color="#0e3d17" />
            </radialGradient>
            <radialGradient id="pawn-yellow-sphere" cx="35%" cy="30%" r="65%">
                <stop offset="0%" stop-color="#ffffff" />
                <stop offset="25%" stop-color="#fef08a" />
                <stop offset="70%" stop-color="#f59e0b" />
                <stop offset="100%" stop-color="#92400e" />
            </radialGradient>
            <radialGradient id="pawn-blue-sphere" cx="35%" cy="30%" r="65%">
                <stop offset="0%" stop-color="#ffffff" />
                <stop offset="25%" stop-color="#64b5f6" />
                <stop offset="70%" stop-color="#1976d2" />
                <stop offset="100%" stop-color="#0a2e6b" />
            </radialGradient>

            <filter id="soft-shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.35" />
            </filter>
            <filter id="tile-bevel" x="-10%" y="-10%" width="120%" height="120%">
                <feDropShadow dx="0" dy="1" stdDeviation="1" flood-opacity="0.25" />
            </filter>
            <filter id="crown-glow" x="-30%" y="-30%" width="160%" height="160%">
                <feDropShadow dx="0" dy="0" stdDeviation="4" flood-color="#f59e0b" flood-opacity="0.6" />
            </filter>
        </defs>

        <!-- Board Background Base -->
        <rect width="${boardPx}" height="${boardPx}" fill="url(#board-bg-grad)" rx="20" />

        <!-- 4 Royal Bases -->
        <!-- Red Yard -->
        <g class="yard-red">
            <rect x="8" y="8" width="${cellSize * 6 - 8}" height="${cellSize * 6 - 8}" rx="20" fill="url(#yard-red-grad)" stroke="url(#frame-gold)" stroke-width="3" filter="url(#soft-shadow)" />
            <rect x="${cellSize + 4}" y="${cellSize + 4}" width="${cellSize * 4 - 8}" height="${cellSize * 4 - 8}" rx="16" fill="#ffffff" opacity="0.95" stroke="#fca5a5" stroke-width="2" />
            <text x="${cellSize * 3}" y="${cellSize * 3.3}" font-size="34" text-anchor="middle" fill="#ef4444" opacity="0.18">👑</text>
            ${renderLamaYardPockets(1.8, 1.8, 3.8, 1.8, 1.8, 3.8, 3.8, 3.8, cellSize, '#ef4444')}
        </g>

        <!-- Green Yard -->
        <g class="yard-green">
            <rect x="${cellSize * 9}" y="8" width="${cellSize * 6 - 8}" height="${cellSize * 6 - 8}" rx="20" fill="url(#yard-green-grad)" stroke="url(#frame-gold)" stroke-width="3" filter="url(#soft-shadow)" />
            <rect x="${cellSize * 10 + 4}" y="${cellSize + 4}" width="${cellSize * 4 - 8}" height="${cellSize * 4 - 8}" rx="16" fill="#ffffff" opacity="0.95" stroke="#86efac" stroke-width="2" />
            <text x="${cellSize * 12}" y="${cellSize * 3.3}" font-size="34" text-anchor="middle" fill="#22c55e" opacity="0.18">👑</text>
            ${renderLamaYardPockets(10.8, 1.8, 12.8, 1.8, 10.8, 3.8, 12.8, 3.8, cellSize, '#22c55e')}
        </g>

        <!-- Yellow Yard -->
        <g class="yard-yellow">
            <rect x="${cellSize * 9}" y="${cellSize * 9}" width="${cellSize * 6 - 8}" height="${cellSize * 6 - 8}" rx="20" fill="url(#yard-yellow-grad)" stroke="url(#frame-gold)" stroke-width="3" filter="url(#soft-shadow)" />
            <rect x="${cellSize * 10 + 4}" y="${cellSize * 10 + 4}" width="${cellSize * 4 - 8}" height="${cellSize * 4 - 8}" rx="16" fill="#ffffff" opacity="0.95" stroke="#fde047" stroke-width="2" />
            <text x="${cellSize * 12}" y="${cellSize * 12.3}" font-size="34" text-anchor="middle" fill="#f59e0b" opacity="0.18">👑</text>
            ${renderLamaYardPockets(10.8, 10.8, 12.8, 10.8, 10.8, 12.8, 12.8, 12.8, cellSize, '#f59e0b')}
        </g>

        <!-- Blue Yard -->
        <g class="yard-blue">
            <rect x="8" y="${cellSize * 9}" width="${cellSize * 6 - 8}" height="${cellSize * 6 - 8}" rx="20" fill="url(#yard-blue-grad)" stroke="url(#frame-gold)" stroke-width="3" filter="url(#soft-shadow)" />
            <rect x="${cellSize + 4}" y="${cellSize * 10 + 4}" width="${cellSize * 4 - 8}" height="${cellSize * 4 - 8}" rx="16" fill="#ffffff" opacity="0.95" stroke="#93c5fd" stroke-width="2" />
            <text x="${cellSize * 3}" y="${cellSize * 12.3}" font-size="34" text-anchor="middle" fill="#3b82f6" opacity="0.18">👑</text>
            ${renderLamaYardPockets(1.8, 10.8, 3.8, 10.8, 1.8, 12.8, 3.8, 12.8, cellSize, '#3b82f6')}
        </g>

        <!-- Grid Tiles with Magic Power Badges & Stars -->
        <g class="track-tiles">
            ${renderLamaGridTiles(cellSize)}
        </g>

        <!-- Center Home Crown Palace -->
        <g class="center-triangles" filter="url(#soft-shadow)">
            <polygon points="${cellSize*6},${cellSize*6} ${cellSize*7.5},${cellSize*7.5} ${cellSize*6},${cellSize*9}" fill="url(#path-red)" stroke="#b91c1c" stroke-width="1" />
            <polygon points="${cellSize*6},${cellSize*6} ${cellSize*7.5},${cellSize*7.5} ${cellSize*9},${cellSize*6}" fill="url(#path-green)" stroke="#15803d" stroke-width="1" />
            <polygon points="${cellSize*9},${cellSize*6} ${cellSize*7.5},${cellSize*7.5} ${cellSize*9},${cellSize*9}" fill="url(#path-yellow)" stroke="#b45309" stroke-width="1" />
            <polygon points="${cellSize*6},${cellSize*9} ${cellSize*7.5},${cellSize*7.5} ${cellSize*9},${cellSize*9}" fill="url(#path-blue)" stroke="#1d4ed8" stroke-width="1" />

            <circle cx="${cellSize*7.5}" cy="${cellSize*7.5}" r="${cellSize*1.0}" fill="none" stroke="url(#frame-gold)" stroke-width="3" opacity="0.8" />
            <circle cx="${cellSize*7.5}" cy="${cellSize*7.5}" r="${cellSize*0.75}" fill="url(#crown-gold-grad)" stroke="#ffffff" stroke-width="2" filter="url(#crown-glow)" />
            <circle cx="${cellSize*7.5}" cy="${cellSize*7.5}" r="${cellSize*0.62}" fill="none" stroke="#78350f" stroke-width="1" stroke-dasharray="3,2" />
            <text x="${cellSize*7.5}" y="${cellSize*7.72}" font-size="22" text-anchor="middle" font-weight="bold">👑</text>
        </g>

        <!-- Pawns Container -->
        <g id="pawns-layer"></g>

        <!-- Dynamic Magic Tiles Layer (rendered by game.js renderMagicTiles) -->
        <g id="magic-tiles-layer"></g>

        <!-- Outer Frame -->
        <rect x="3" y="3" width="${boardPx - 6}" height="${boardPx - 6}" rx="20" fill="none" stroke="url(#frame-gold)" stroke-width="5" />
        <rect x="7" y="7" width="${boardPx - 14}" height="${boardPx - 14}" rx="16" fill="none" stroke="#b45309" stroke-width="1.5" opacity="0.6" />
    </svg>`;

    return svg;
}

function renderLamaYardPockets(x1, y1, x2, y2, x3, y3, x4, y4, cs, themeColor) {
    const coords = [[x1, y1], [x2, y1], [x1, y3], [x2, y3]];
    return coords.map(c => `
        <g class="yard-pocket">
            <circle cx="${c[0]*cs}" cy="${c[1]*cs + 1}" r="${cs*0.68}" fill="rgba(0,0,0,0.12)" />
            <circle cx="${c[0]*cs}" cy="${c[1]*cs}" r="${cs*0.65}" fill="url(#frame-gold)" />
            <circle cx="${c[0]*cs}" cy="${c[1]*cs}" r="${cs*0.54}" fill="url(#pocket-recess)" />
            <circle cx="${c[0]*cs}" cy="${c[1]*cs}" r="${cs*0.48}" fill="#ffffff" />
            <circle cx="${c[0]*cs}" cy="${c[1]*cs}" r="${cs*0.18}" fill="${themeColor}" opacity="0.35" />
        </g>
    `).join('');
}

function renderLamaGridTiles(cs) {
    let tilesSvg = '';

    for (let r = 0; r < 15; r++) {
        for (let c = 0; c < 15; c++) {
            if ((r < 6 && c < 6) || (r < 6 && c > 8) || (r > 8 && c < 6) || (r > 8 && c > 8)) continue;
            if (r >= 6 && r <= 8 && c >= 6 && c <= 8) continue;

            const pad = 1.5;
            const x = c * cs + pad;
            const y = r * cs + pad;
            const w = cs - pad * 2;
            const h = cs - pad * 2;

            let fill = '#ffffff';
            let stroke = '#e2d9cc';
            let isStar = false;
            let arrowDir = null;

            // Track Index for this cell
            const trackIdx = ACCURATE_MAIN_TRACK.findIndex(pos => pos[0] === c && pos[1] === r);

            // Red Start & Home Path
            if (c === 1 && r === 6) { fill = 'url(#path-red)'; stroke = '#b91c1c'; arrowDir = 'right'; }
            else if (r === 7 && c >= 1 && c <= 5) { fill = 'url(#path-red)'; stroke = '#b91c1c'; }

            // Green Start & Home Path
            else if (c === 8 && r === 1) { fill = 'url(#path-green)'; stroke = '#15803d'; arrowDir = 'down'; }
            else if (c === 7 && r >= 1 && r <= 5) { fill = 'url(#path-green)'; stroke = '#15803d'; }

            // Yellow Start & Home Path
            else if (c === 13 && r === 8) { fill = 'url(#path-yellow)'; stroke = '#b45309'; arrowDir = 'left'; }
            else if (r === 7 && c >= 9 && c <= 13) { fill = 'url(#path-yellow)'; stroke = '#b45309'; }

            // Blue Start & Home Path
            else if (c === 6 && r === 13) { fill = 'url(#path-blue)'; stroke = '#1d4ed8'; arrowDir = 'up'; }
            else if (c === 7 && r >= 9 && r <= 13) { fill = 'url(#path-blue)'; stroke = '#1d4ed8'; }

            // Safe Stars
            if ((c === 6 && r === 2) || (c === 12 && r === 6) || (c === 8 && r === 12) || (c === 2 && r === 8)) {
                isStar = true;
                fill = '#fffbeb';
                stroke = '#f59e0b';
            }

            tilesSvg += `
                <g class="tile" data-col="${c}" data-row="${r}" data-track="${trackIdx}">
                    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${fill}" stroke="${stroke}" stroke-width="1.5" filter="url(#tile-bevel)" />

                    <!-- Golden Star -->
                    ${isStar ? `
                        <circle cx="${(c+0.5)*cs}" cy="${(r+0.5)*cs}" r="${cs*0.4}" fill="url(#crown-gold-grad)" stroke="#ffffff" stroke-width="1.2" filter="url(#soft-shadow)" />
                        <text x="${(c+0.5)*cs}" y="${(r+0.66)*cs}" font-size="20" text-anchor="middle" fill="#78350f" font-weight="bold">★</text>
                    ` : ''}

                    <!-- Magic tiles are rendered dynamically via renderMagicTiles() in game.js -->

                    <!-- 3D Direction Arrows -->
                    ${arrowDir === 'right' ? `
                        <polygon points="${(c+0.3)*cs},${(r+0.3)*cs} ${(c+0.75)*cs},${(r+0.5)*cs} ${(c+0.3)*cs},${(r+0.7)*cs}" fill="#ffffff" filter="url(#soft-shadow)" />
                    ` : ''}
                    ${arrowDir === 'down' ? `
                        <polygon points="${(c+0.3)*cs},${(r+0.3)*cs} ${(c+0.5)*cs},${(r+0.75)*cs} ${(c+0.7)*cs},${(r+0.3)*cs}" fill="#ffffff" filter="url(#soft-shadow)" />
                    ` : ''}
                    ${arrowDir === 'left' ? `
                        <polygon points="${(c+0.7)*cs},${(r+0.3)*cs} ${(c+0.25)*cs},${(r+0.5)*cs} ${(c+0.7)*cs},${(r+0.7)*cs}" fill="#ffffff" filter="url(#soft-shadow)" />
                    ` : ''}
                    ${arrowDir === 'up' ? `
                        <polygon points="${(c+0.3)*cs},${(r+0.7)*cs} ${(c+0.5)*cs},${(r+0.25)*cs} ${(c+0.7)*cs},${(r+0.7)*cs}" fill="#ffffff" filter="url(#soft-shadow)" />
                    ` : ''}
                </g>
            `;
        }
    }
    return tilesSvg;
}

window.LudoBoard = {
    BOARD_SIZE,
    MAIN_TRACK: ACCURATE_MAIN_TRACK,
    SAFE_INDICES,
    MAGIC_TILES,
    PLAYER_CONFIG,
    getTokenGridPos,
    getTrackIndex,
    isStepSafe,
    createLudoBoardSVG
};
