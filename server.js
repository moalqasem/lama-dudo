const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

// Safe spots on the 52-tile track
const SAFE_INDICES = [0, 8, 13, 21, 26, 34, 39, 47];
const START_INDICES = [0, 13, 26, 39];

// Dynamic Magic Tiles Generator (Randomized per game and refreshed every round!)
function generateMagicTiles(count = 6) {
    const candidates = [];
    for (let i = 1; i < 51; i++) {
        if (!SAFE_INDICES.includes(i)) {
            candidates.push(i);
        }
    }
    // Fisher-Yates shuffle
    for (let i = candidates.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    const items = [
        { type: 'rocket', icon: '🚀', name: 'صاروخ' },
        { type: 'rocket', icon: '🚀', name: 'صاروخ' },
        { type: 'shield', icon: '🛡️', name: 'درع حماية' },
        { type: 'shield', icon: '🛡️', name: 'درع حماية' },
        { type: 'magicDice', icon: '🎲', name: 'نرد سحري' },
        { type: 'magicDice', icon: '🎲', name: 'نرد سحري' }
    ];

    const tiles = {};
    for (let i = 0; i < Math.min(count, candidates.length); i++) {
        const trackIdx = candidates[i];
        tiles[trackIdx] = items[i % items.length];
    }
    return tiles;
}

const rooms = new Map();

function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return rooms.has(code) ? generateRoomCode() : code;
}

function createNewGameState(gameMode = 'classic') {
    const initialTokens = [
        [-1, -1, -1, -1],
        [-1, -1, -1, -1],
        [-1, -1, -1, -1],
        [-1, -1, -1, -1]
    ];

    if (gameMode === 'quick') {
        for (let p = 0; p < 4; p++) {
            initialTokens[p][0] = 0; // Starts active on track
        }
    }

    return {
        status: 'waiting',
        gameMode: gameMode,
        currentTurn: 0,
        roundCount: 0,
        diceValue: null,
        hasRolled: false,
        consecutiveSixes: 0,
        validTokens: [],
        winners: [],
        tokens: initialTokens,
        hasKilled: [false, false, false, false],
        // Dynamic magic tiles: generated fresh on each game start!
        magicTiles: (gameMode === 'magic') ? generateMagicTiles(6) : {},
        shields: [
            [false, false, false, false],
            [false, false, false, false],
            [false, false, false, false],
            [false, false, false, false]
        ],
        powers: [
            { magicDice: 0, shield: 0, rocket: 0 },
            { magicDice: 0, shield: 0, rocket: 0 },
            { magicDice: 0, shield: 0, rocket: 0 },
            { magicDice: 0, shield: 0, rocket: 0 }
        ]
    };
}

function getTrackIndex(playerIndex, step) {
    if (step >= 0 && step <= 50) {
        return (START_INDICES[playerIndex] + step) % 52;
    }
    return -1;
}

function getTargetTokensToWin(gameMode) {
    return (gameMode === 'quick') ? 2 : 4;
}

function getValidTokensForMove(gameState, playerIdx, dice) {
    const tokens = gameState.tokens[playerIdx];
    const valid = [];
    const mode = gameState.gameMode;
    const hasKilled = gameState.hasKilled[playerIdx];

    tokens.forEach((step, tokenIdx) => {
        if (step === -1) {
            if (dice === 6 || (mode === 'quick' && dice === 1)) {
                valid.push(tokenIdx);
            }
        } else if (step >= 0 && step < 56) {
            const nextStep = step + dice;
            if (mode === 'quick' && nextStep > 50 && !hasKilled) {
                return;
            }
            if (nextStep <= 56) {
                valid.push(tokenIdx);
            }
        }
    });

    return valid;
}

function checkNextTurn(room, extraRoll = false) {
    const gameState = room.gameState;
    if (gameState.status !== 'playing') return;

    if (extraRoll) {
        gameState.hasRolled = false;
        gameState.diceValue = null;
        gameState.validTokens = [];
        broadcastRoomState(room);
        triggerBotIfApplicable(room);
        return;
    }

    gameState.consecutiveSixes = 0;

    let nextTurn = gameState.currentTurn;
    let attempts = 0;
    do {
        nextTurn = (nextTurn + 1) % 4;
        attempts++;
    } while (
        attempts < 4 &&
        (room.players[nextTurn] === null || gameState.winners.includes(nextTurn))
    );

    // Check if full round completed (wrapped around to first active player)
    const firstActive = room.players.findIndex(p => p !== null && !gameState.winners.includes(room.players.indexOf(p)));
    if (nextTurn === firstActive) {
        gameState.roundCount = (gameState.roundCount || 0) + 1;
        // In Magic Mode: Regenerate magic tiles in new random locations every full round!
        if (gameState.gameMode === 'magic') {
            gameState.magicTiles = generateMagicTiles(6);
            io.to(room.code).emit('announcement', {
                text: `🔄 اكتملت لفة كاملة! تجددت أماكن البطاقات السحرية على اللوح ✨`,
                type: 'magic'
            });
        }
    }

    gameState.currentTurn = nextTurn;
    gameState.hasRolled = false;
    gameState.diceValue = null;
    gameState.validTokens = [];

    // Clear shields for next turn player
    if (gameState.shields[nextTurn]) {
        gameState.shields[nextTurn] = [false, false, false, false];
    }

    broadcastRoomState(room);
    triggerBotIfApplicable(room);
}

function triggerBotIfApplicable(room) {
    const gameState = room.gameState;
    if (gameState.status !== 'playing') return;

    const currentPlayer = room.players[gameState.currentTurn];
    if (currentPlayer && currentPlayer.isBot) {
        setTimeout(() => {
            if (room.gameState.status !== 'playing') return;

            // In Magic Mode, Bot uses collected powers
            if (gameState.gameMode === 'magic') {
                const powers = gameState.powers[gameState.currentTurn];
                if (powers.rocket > 0 && Math.random() < 0.4) {
                    for (let p = 0; p < 4; p++) {
                        if (p !== gameState.currentTurn && room.players[p]) {
                            const oppToken = gameState.tokens[p].findIndex(s => s >= 15 && s <= 50);
                            if (oppToken !== -1) {
                                powers.rocket--;
                                applyRocket(room, gameState.currentTurn, p, oppToken);
                                return;
                            }
                        }
                    }
                }
            }

            handleDiceRoll(room, null);
        }, 800);
    }
}

function handleDiceRoll(room, chosenValue = null) {
    const gameState = room.gameState;
    if (gameState.status !== 'playing' || gameState.hasRolled) return;

    const dice = (chosenValue && chosenValue >= 1 && chosenValue <= 6) 
        ? chosenValue 
        : Math.floor(Math.random() * 6) + 1;

    gameState.diceValue = dice;
    gameState.hasRolled = true;

    if (dice === 6) {
        gameState.consecutiveSixes++;
    } else {
        gameState.consecutiveSixes = 0;
    }

    if (gameState.consecutiveSixes === 3) {
        io.to(room.code).emit('announcement', {
            text: `حصل اللاعب على 6 ثلاث مرات متتالية! ينتقل الدور.`,
            type: 'warning'
        });
        setTimeout(() => {
            checkNextTurn(room, false);
        }, 1200);
        return;
    }

    const validTokens = getValidTokensForMove(gameState, gameState.currentTurn, dice);
    gameState.validTokens = validTokens;

    io.to(room.code).emit('dice_rolled', {
        playerIndex: gameState.currentTurn,
        diceValue: dice,
        validTokens: validTokens
    });

    if (validTokens.length === 0) {
        setTimeout(() => {
            checkNextTurn(room, false);
        }, 1200);
    } else {
        const currentPlayer = room.players[gameState.currentTurn];
        if (currentPlayer && currentPlayer.isBot) {
            setTimeout(() => {
                const chosenToken = chooseBotMove(room, gameState.currentTurn, dice, validTokens);
                handleTokenMove(room, gameState.currentTurn, chosenToken);
            }, 900);
        }
    }
}

function chooseBotMove(room, playerIdx, dice, validTokens) {
    const tokens = room.gameState.tokens[playerIdx];

    // Priority 0: Landing on a Magic Board Pickup!
    if (room.gameState.gameMode === 'magic') {
        for (const tIdx of validTokens) {
            const step = tokens[tIdx];
            const nextStep = (step === -1) ? 0 : step + dice;
            if (nextStep <= 50) {
                const trackIdx = getTrackIndex(playerIdx, nextStep);
                if (room.gameState.magicTiles && room.gameState.magicTiles[trackIdx]) {
                    return tIdx; // Specifically step on the Rocket/Shield/MagicDice tile!
                }
            }
        }
    }

    // Priority 1: Move that captures opponent
    for (const tIdx of validTokens) {
        const step = tokens[tIdx];
        const nextStep = (step === -1) ? 0 : step + dice;
        if (nextStep <= 50) {
            const trackIdx = getTrackIndex(playerIdx, nextStep);
            if (!SAFE_INDICES.includes(trackIdx)) {
                for (let p = 0; p < 4; p++) {
                    if (p === playerIdx || !room.players[p]) continue;
                    for (let ot = 0; ot < 4; ot++) {
                        if (!room.gameState.shields[p][ot] && getTrackIndex(p, room.gameState.tokens[p][ot]) === trackIdx) {
                            return tIdx;
                        }
                    }
                }
            }
        }
    }

    // Priority 2: Move into Home
    for (const tIdx of validTokens) {
        const step = tokens[tIdx];
        if (step !== -1 && step + dice === 56) return tIdx;
    }

    // Priority 3: Bring out of yard
    if ((dice === 6 || (room.gameState.gameMode === 'quick' && dice === 1)) && validTokens.some(t => tokens[t] === -1)) {
        return validTokens.find(t => tokens[t] === -1);
    }

    // Priority 4: Move to safe zone
    for (const tIdx of validTokens) {
        const step = tokens[tIdx];
        const nextStep = (step === -1) ? 0 : step + dice;
        if (nextStep <= 50 && SAFE_INDICES.includes(getTrackIndex(playerIdx, nextStep))) {
            return tIdx;
        }
    }

    // Priority 5: Advance furthest token
    validTokens.sort((a, b) => tokens[b] - tokens[a]);
    return validTokens[0];
}

function handleTokenMove(room, playerIdx, tokenIdx) {
    const gameState = room.gameState;
    if (gameState.status !== 'playing' || !gameState.hasRolled) return;
    if (playerIdx !== gameState.currentTurn) return;
    if (!gameState.validTokens.includes(tokenIdx)) return;

    const dice = gameState.diceValue;
    const currentStep = gameState.tokens[playerIdx][tokenIdx];
    let nextStep;
    let isSpawn = false;

    if (currentStep === -1) {
        nextStep = 0;
        isSpawn = true;
    } else {
        nextStep = currentStep + dice;
    }

    gameState.tokens[playerIdx][tokenIdx] = nextStep;

    let captured = null;
    let extraRoll = false;
    let collectedPickup = null;

    // Check Specific Magic Item Tile on Board!
    if (nextStep >= 0 && nextStep <= 50 && gameState.gameMode === 'magic') {
        const landingTrack = getTrackIndex(playerIdx, nextStep);
        if (gameState.magicTiles && gameState.magicTiles[landingTrack]) {
            const item = gameState.magicTiles[landingTrack];
            delete gameState.magicTiles[landingTrack]; // Remove from tile on pickup!
            gameState.powers[playerIdx][item.type] = (gameState.powers[playerIdx][item.type] || 0) + 1;
            collectedPickup = {
                trackIdx: landingTrack,
                power: item.type,
                icon: item.icon,
                title: `${item.icon} ${item.name}`,
                playerName: room.players[playerIdx].name
            };
            io.to(room.code).emit('pickup_collected', collectedPickup);
        }
    }

    // Check capture
    if (nextStep >= 0 && nextStep <= 50) {
        const landingTrack = getTrackIndex(playerIdx, nextStep);
        if (!SAFE_INDICES.includes(landingTrack)) {
            for (let oppIdx = 0; oppIdx < 4; oppIdx++) {
                if (oppIdx === playerIdx || !room.players[oppIdx]) continue;
                for (let oppToken = 0; oppToken < 4; oppToken++) {
                    const oppStep = gameState.tokens[oppIdx][oppToken];
                    const isShielded = gameState.shields[oppIdx][oppToken];
                    if (!isShielded && oppStep >= 0 && oppStep <= 50) {
                        const oppTrack = getTrackIndex(oppIdx, oppStep);
                        if (oppTrack === landingTrack) {
                            // Capture!
                            gameState.tokens[oppIdx][oppToken] = -1;
                            gameState.hasKilled[playerIdx] = true;
                            captured = {
                                playerIndex: oppIdx,
                                tokenIndex: oppToken,
                                playerName: room.players[oppIdx].name
                            };
                            extraRoll = true;
                            break;
                        }
                    }
                }
                if (captured) break;
            }
        }
    }

    if (dice === 6) extraRoll = true;
    if (nextStep === 56) extraRoll = true;

    // Win check based on mode
    const targetWins = getTargetTokensToWin(gameState.gameMode);
    const homeTokensCount = gameState.tokens[playerIdx].filter(s => s === 56).length;

    if (homeTokensCount >= targetWins && !gameState.winners.includes(playerIdx)) {
        gameState.winners.push(playerIdx);
        io.to(room.code).emit('player_finished', {
            playerIndex: playerIdx,
            playerName: room.players[playerIdx].name,
            rank: gameState.winners.length
        });

        const activeCount = room.players.filter(p => p !== null).length;
        if (gameState.winners.length >= activeCount - 1 || gameState.winners.length === activeCount) {
            gameState.status = 'finished';
            io.to(room.code).emit('game_over', {
                winners: gameState.winners.map(pIdx => ({
                    playerIndex: pIdx,
                    name: room.players[pIdx].name
                }))
            });
            broadcastRoomState(room);
            return;
        }
    }

    io.to(room.code).emit('token_moved', {
        playerIndex: playerIdx,
        tokenIndex: tokenIdx,
        oldStep: currentStep,
        newStep: nextStep,
        isSpawn: isSpawn,
        captured: captured,
        collectedPickup: collectedPickup,
        extraRoll: extraRoll
    });

    setTimeout(() => {
        checkNextTurn(room, extraRoll);
    }, 800);
}

// Magic Powers
function applyRocket(room, senderIdx, targetPlayerIdx, targetTokenIdx) {
    const gameState = room.gameState;
    const oldStep = gameState.tokens[targetPlayerIdx][targetTokenIdx];
    if (oldStep === -1 || oldStep === 56) return;

    gameState.tokens[targetPlayerIdx][targetTokenIdx] = -1;
    io.to(room.code).emit('power_used', {
        power: 'rocket',
        senderIdx: senderIdx,
        targetPlayerIdx: targetPlayerIdx,
        targetTokenIdx: targetTokenIdx,
        oldStep: oldStep,
        newStep: -1,
        message: `🚀 أطلق ${room.players[senderIdx].name} صاروخاً وفجّر قطعة ${room.players[targetPlayerIdx].name}!`
    });
    broadcastRoomState(room);
}

function broadcastRoomState(room) {
    io.to(room.code).emit('room_update', {
        code: room.code,
        hostId: room.hostId,
        players: room.players,
        gameState: {
            status: room.gameState.status,
            gameMode: room.gameState.gameMode,
            currentTurn: room.gameState.currentTurn,
            diceValue: room.gameState.diceValue,
            hasRolled: room.gameState.hasRolled,
            validTokens: room.gameState.validTokens,
            winners: room.gameState.winners,
            tokens: room.gameState.tokens,
            shields: room.gameState.shields,
            powers: room.gameState.powers,
            magicTiles: room.gameState.magicTiles,
            hasKilled: room.gameState.hasKilled
        }
    });
}

io.on('connection', (socket) => {
    // Create new room with chosen mode
    socket.on('create_room', ({ playerName, gameMode = 'classic' }) => {
        const code = generateRoomCode();
        const room = {
            code: code,
            hostId: socket.id,
            players: [
                { id: socket.id, name: playerName || 'اللاعب 1', isBot: false, ready: true },
                null,
                null,
                null
            ],
            gameState: createNewGameState(gameMode)
        };
        rooms.set(code, room);
        socket.join(code);
        socket.roomCode = code;
        socket.playerIndex = 0;

        socket.emit('room_created', { code: code, playerIndex: 0 });
        broadcastRoomState(room);
    });

    // Join room
    socket.on('join_room', ({ code, playerName }) => {
        const cleanCode = (code || '').toUpperCase().trim();
        const room = rooms.get(cleanCode);

        if (!room) return socket.emit('error_message', 'رمز الغرفة غير موجود.');
        if (room.gameState.status !== 'waiting') return socket.emit('error_message', 'اللعبة بدأت بالفعل.');

        const slot = room.players.findIndex(p => p === null);
        if (slot === -1) return socket.emit('error_message', 'الغرفة ممتلئة بالكامل.');

        room.players[slot] = {
            id: socket.id,
            name: playerName || `اللاعب ${slot + 1}`,
            isBot: false,
            ready: true
        };

        socket.join(cleanCode);
        socket.roomCode = cleanCode;
        socket.playerIndex = slot;

        socket.emit('joined_room', { code: cleanCode, playerIndex: slot });
        broadcastRoomState(room);
    });

    // Change Game Mode
    socket.on('set_game_mode', ({ gameMode }) => {
        const room = rooms.get(socket.roomCode);
        if (!room || room.hostId !== socket.id || room.gameState.status !== 'waiting') return;
        room.gameState = createNewGameState(gameMode);
        broadcastRoomState(room);
    });

    // Add Bot
    socket.on('add_bot', () => {
        const room = rooms.get(socket.roomCode);
        if (!room || room.hostId !== socket.id || room.gameState.status !== 'waiting') return;

        const slot = room.players.findIndex(p => p === null);
        if (slot !== -1) {
            const botNames = ['روبوت المارد 🧞', 'روبوت الصقر 🦅', 'روبوت النجم ⭐', 'روبوت الفارس ⚔️'];
            room.players[slot] = {
                id: `bot_${Date.now()}_${slot}`,
                name: botNames[slot] || `بوت ${slot + 1}`,
                isBot: true,
                ready: true
            };
            broadcastRoomState(room);
        }
    });

    // Remove Bot
    socket.on('remove_bot', ({ slotIndex }) => {
        const room = rooms.get(socket.roomCode);
        if (!room || room.hostId !== socket.id || room.gameState.status !== 'waiting') return;
        if (room.players[slotIndex] && room.players[slotIndex].isBot) {
            room.players[slotIndex] = null;
            broadcastRoomState(room);
        }
    });

    // Start game
    socket.on('start_game', () => {
        const room = rooms.get(socket.roomCode);
        if (!room || room.hostId !== socket.id || room.gameState.status !== 'waiting') return;

        const activePlayers = room.players.filter(p => p !== null);
        if (activePlayers.length < 2) {
            return socket.emit('error_message', 'يجب أن يكون هناك لاعبان على الأقل لبدء اللعبة.');
        }

        room.gameState.status = 'playing';
        room.gameState.currentTurn = room.players.findIndex(p => p !== null);

        io.to(room.code).emit('game_started');
        broadcastRoomState(room);
        triggerBotIfApplicable(room);
    });

    // Roll Dice
    socket.on('roll_dice', () => {
        const room = rooms.get(socket.roomCode);
        if (!room || room.gameState.currentTurn !== socket.playerIndex) return;
        handleDiceRoll(room);
    });

    // Magic Dice Power
    socket.on('use_magic_dice', ({ chosenValue }) => {
        const room = rooms.get(socket.roomCode);
        if (!room || room.gameState.currentTurn !== socket.playerIndex) return;
        const pIdx = socket.playerIndex;
        if (room.gameState.powers[pIdx].magicDice <= 0) return;

        room.gameState.powers[pIdx].magicDice--;
        io.to(room.code).emit('announcement', {
            text: `✨ استخدم ${room.players[pIdx].name} النرد السحري واختار الرقم ${chosenValue}!`,
            type: 'magic'
        });
        handleDiceRoll(room, chosenValue);
    });

    // Shield Power
    socket.on('use_shield', ({ tokenIndex }) => {
        const room = rooms.get(socket.roomCode);
        if (!room || room.gameState.currentTurn !== socket.playerIndex) return;
        const pIdx = socket.playerIndex;
        if (room.gameState.powers[pIdx].shield <= 0) return;

        room.gameState.powers[pIdx].shield--;
        room.gameState.shields[pIdx][tokenIndex] = true;
        io.to(room.code).emit('power_used', {
            power: 'shield',
            playerIndex: pIdx,
            tokenIndex: tokenIndex,
            message: `🛡️ درع الحماية تم تفعيله على قطعة ${room.players[pIdx].name}!`
        });
        broadcastRoomState(room);
    });

    // Rocket Power
    socket.on('use_rocket', ({ targetPlayerIdx, targetTokenIdx }) => {
        const room = rooms.get(socket.roomCode);
        if (!room || room.gameState.currentTurn !== socket.playerIndex) return;
        const pIdx = socket.playerIndex;
        if (room.gameState.powers[pIdx].rocket <= 0) return;

        room.gameState.powers[pIdx].rocket--;
        applyRocket(room, pIdx, targetPlayerIdx, targetTokenIdx);
    });

    // Move Token
    socket.on('move_token', ({ tokenIndex }) => {
        const room = rooms.get(socket.roomCode);
        if (!room || room.gameState.currentTurn !== socket.playerIndex) return;
        handleTokenMove(room, socket.playerIndex, tokenIndex);
    });

    // Send Interactive Gift
    socket.on('send_gift', ({ toSlot, giftType }) => {
        const room = rooms.get(socket.roomCode);
        if (!room) return;
        const fromPlayer = room.players[socket.playerIndex];
        const toPlayer = room.players[toSlot];
        if (!fromPlayer || !toPlayer) return;

        io.to(room.code).emit('gift_received', {
            fromSlot: socket.playerIndex,
            toSlot: toSlot,
            fromName: fromPlayer.name,
            toName: toPlayer.name,
            giftType: giftType
        });
    });

    // Voice Chat State
    socket.on('voice_speaking', ({ speaking }) => {
        if (!socket.roomCode) return;
        io.to(socket.roomCode).emit('voice_speaking_update', {
            playerIndex: socket.playerIndex,
            speaking: !!speaking
        });
    });

    // Chat Message
    socket.on('send_chat', ({ text }) => {
        const room = rooms.get(socket.roomCode);
        if (!room || !text) return;
        const player = room.players[socket.playerIndex];
        if (!player) return;

        io.to(room.code).emit('chat_received', {
            senderName: player.name,
            playerIndex: socket.playerIndex,
            text: text.slice(0, 150),
            time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
        });
    });

    // Disconnect
    socket.on('disconnect', () => {
        if (!socket.roomCode) return;
        const room = rooms.get(socket.roomCode);
        if (!room) return;

        const pIdx = socket.playerIndex;
        if (room.gameState.status === 'waiting') {
            room.players[pIdx] = null;
            if (room.hostId === socket.id) {
                const nextHost = room.players.find(p => p && !p.isBot);
                if (nextHost) room.hostId = nextHost.id;
                else { rooms.delete(room.code); return; }
            }
            broadcastRoomState(room);
        } else if (room.gameState.status === 'playing') {
            if (room.players[pIdx]) {
                room.players[pIdx].isBot = true;
                room.players[pIdx].name += ' (روبوت)';
                broadcastRoomState(room);
                if (room.gameState.currentTurn === pIdx) {
                    triggerBotIfApplicable(room);
                }
            }
        }
    });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (!process.env.VERCEL) {
    server.listen(PORT, () => {
        console.log(`Ludo Game Server running on http://localhost:${PORT}`);
    });
}

module.exports = app;
