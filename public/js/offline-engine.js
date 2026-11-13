// Offline Ludo Server & Bot Engine - LAMA DUDO Edition
// Enables 100% full gameplay in browser without requiring external WebSocket servers

window.OfflineLudoEngine = (function () {
    const SAFE_INDICES = [0, 8, 13, 21, 26, 34, 39, 47];
    const BOT_NAMES = ['روبوت الصقر 🦅', 'روبوت النمر 🐯', 'روبوت الفهد 🐆'];

    function generateMagicTiles(count = 6) {
        const candidates = [];
        for (let i = 1; i < 51; i++) {
            if (!SAFE_INDICES.includes(i)) candidates.push(i);
        }
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
        for (let i = 0; i < count && i < candidates.length; i++) {
            tiles[candidates[i]] = items[i % items.length];
        }
        return tiles;
    }

    class OfflineRoom {
        constructor(playerName, gameMode, clientCallbacks, playerCount = 2) {
            this.callbacks = clientCallbacks;
            this.gameMode = gameMode || 'magic';
            this.code = 'LOCAL';
            this.roundCount = 0;
            this.playerCount = playerCount;

            if (playerCount === 2) {
                // 2 Players: Red (Human) and Green (Bot) only! Players 3 & 4 are completely null/omitted!
                this.players = [
                    { id: 'p0', name: playerName || 'أنت', isBot: false, avatar: '🔴' },
                    { id: 'b1', name: BOT_NAMES[0], isBot: true, avatar: '🟢' },
                    null,
                    null
                ];
            } else {
                this.players = [
                    { id: 'p0', name: playerName || 'أنت', isBot: false, avatar: '🔴' },
                    { id: 'b1', name: BOT_NAMES[0], isBot: true, avatar: '🟢' },
                    { id: 'b2', name: BOT_NAMES[1], isBot: true, avatar: '🟡' },
                    { id: 'b3', name: BOT_NAMES[2], isBot: true, avatar: '🔵' }
                ];
            }

            const initialTokens = [
                [-1, -1, -1, -1],
                [-1, -1, -1, -1],
                [-1, -1, -1, -1],
                [-1, -1, -1, -1]
            ];

            if (this.gameMode === 'quick') {
                for (let p = 0; p < 4; p++) initialTokens[p][0] = 0;
            }

            this.gameState = {
                status: 'playing',
                gameMode: this.gameMode,
                currentTurn: 0,
                diceValue: null,
                hasRolled: false,
                consecutiveSixes: 0,
                validTokens: [],
                winners: [],
                tokens: initialTokens,
                hasKilled: [false, false, false, false],
                magicTiles: (this.gameMode === 'magic') ? generateMagicTiles(6) : {},
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

        emit(event, data) {
            if (this.callbacks[event]) {
                this.callbacks[event](data);
            }
        }

        broadcastState() {
            this.emit('room_update', {
                roomCode: this.code,
                players: this.players,
                hostId: 'p0',
                gameState: this.gameState
            });
        }

        start() {
            this.emit('game_started', {});
            this.broadcastState();
        }

        rollDice(chosenValue = null) {
            if (this.gameState.status !== 'playing' || this.gameState.hasRolled) return;

            const dice = (chosenValue && chosenValue >= 1 && chosenValue <= 6)
                ? chosenValue
                : Math.floor(Math.random() * 6) + 1;

            this.gameState.diceValue = dice;
            this.gameState.hasRolled = true;

            if (dice === 6) this.gameState.consecutiveSixes++;
            else this.gameState.consecutiveSixes = 0;

            if (this.gameState.consecutiveSixes === 3) {
                this.emit('announcement', { text: 'حصل اللاعب على 6 ثلاث مرات متتالية! ينتقل الدور.' });
                setTimeout(() => this.nextTurn(false), 1200);
                return;
            }

            const valid = this.getValidTokens(this.gameState.currentTurn, dice);
            this.gameState.validTokens = valid;

            this.emit('dice_rolled', {
                playerIndex: this.gameState.currentTurn,
                diceValue: dice,
                validTokens: valid
            });

            if (valid.length === 0) {
                setTimeout(() => this.nextTurn(false), 1200);
            } else if (this.gameState.currentTurn !== 0) {
                // Bot Turn
                setTimeout(() => {
                    const chosenToken = this.chooseBotMove(this.gameState.currentTurn, dice, valid);
                    this.moveToken(this.gameState.currentTurn, chosenToken);
                }, 900);
            }
        }

        getValidTokens(pIdx, dice) {
            const tokens = this.gameState.tokens[pIdx];
            const valid = [];
            for (let i = 0; i < 4; i++) {
                const s = tokens[i];
                if (s === 56) continue;
                if (s === -1) {
                    if (dice === 6) valid.push(i);
                } else if (s + dice <= 56) {
                    if (this.gameMode === 'quick' && s < 51 && (s + dice) >= 51 && !this.gameState.hasKilled[pIdx]) {
                        continue;
                    }
                    valid.push(i);
                }
            }
            return valid;
        }

        chooseBotMove(pIdx, dice, valid) {
            const tokens = this.gameState.tokens[pIdx];
            // Landing on Magic tile
            if (this.gameMode === 'magic') {
                for (const t of valid) {
                    const nextS = (tokens[t] === -1) ? 0 : tokens[t] + dice;
                    if (nextS <= 50) {
                        const trk = window.LudoBoard.getTrackIndex(pIdx, nextS);
                        if (this.gameState.magicTiles && this.gameState.magicTiles[trk]) return t;
                    }
                }
            }
            // Capture opponent
            for (const t of valid) {
                const nextS = (tokens[t] === -1) ? 0 : tokens[t] + dice;
                if (nextS <= 50) {
                    const trk = window.LudoBoard.getTrackIndex(pIdx, nextS);
                    if (!SAFE_INDICES.includes(trk)) {
                        for (let op = 0; op < 4; op++) {
                            if (op === pIdx) continue;
                            for (let ot = 0; ot < 4; ot++) {
                                if (!this.gameState.shields[op][ot] && window.LudoBoard.getTrackIndex(op, this.gameState.tokens[op][ot]) === trk) {
                                    return t;
                                }
                            }
                        }
                    }
                }
            }
            // Move into Home
            for (const t of valid) {
                if (tokens[t] !== -1 && tokens[t] + dice === 56) return t;
            }
            // Spawn new token on 6
            if (dice === 6) {
                for (const t of valid) {
                    if (tokens[t] === -1) return t;
                }
            }
            // Advance furthest token
            return valid[0];
        }

        moveToken(pIdx, tIdx) {
            const oldStep = this.gameState.tokens[pIdx][tIdx];
            const dice = this.gameState.diceValue;
            let newStep = (oldStep === -1) ? 0 : oldStep + dice;
            const isSpawn = (oldStep === -1);
            let captured = null;

            this.gameState.tokens[pIdx][tIdx] = newStep;

            // Magic pickup
            if (newStep >= 0 && newStep <= 50 && this.gameMode === 'magic') {
                const landingTrk = window.LudoBoard.getTrackIndex(pIdx, newStep);
                if (this.gameState.magicTiles && this.gameState.magicTiles[landingTrk]) {
                    const item = this.gameState.magicTiles[landingTrk];
                    delete this.gameState.magicTiles[landingTrk];
                    this.gameState.powers[pIdx][item.type] = (this.gameState.powers[pIdx][item.type] || 0) + 1;
                    this.emit('pickup_collected', {
                        trackIdx: landingTrk,
                        power: item.type,
                        icon: item.icon,
                        title: `${item.icon} ${item.name}`,
                        playerName: this.players[pIdx].name
                    });
                }
            }

            // Capture
            if (newStep >= 0 && newStep <= 50) {
                const landingTrk = window.LudoBoard.getTrackIndex(pIdx, newStep);
                if (!SAFE_INDICES.includes(landingTrk)) {
                    for (let op = 0; op < 4; op++) {
                        if (op === pIdx) continue;
                        for (let ot = 0; ot < 4; ot++) {
                            if (this.gameState.tokens[op][ot] >= 0 && this.gameState.tokens[op][ot] <= 50) {
                                if (window.LudoBoard.getTrackIndex(op, this.gameState.tokens[op][ot]) === landingTrk) {
                                    if (!this.gameState.shields[op][ot]) {
                                        this.gameState.tokens[op][ot] = -1;
                                        this.gameState.hasKilled[pIdx] = true;
                                        captured = { playerName: this.players[op].name };
                                    }
                                }
                            }
                        }
                    }
                }
            }

            this.emit('token_moved', {
                playerIndex: pIdx,
                tokenIndex: tIdx,
                oldStep,
                newStep,
                isSpawn,
                captured
            });

            // Check Win
            const targetHome = (this.gameMode === 'quick') ? 2 : 4;
            const homeCount = this.gameState.tokens[pIdx].filter(s => s === 56).length;
            if (homeCount >= targetHome && !this.gameState.winners.includes(pIdx)) {
                this.gameState.winners.push(pIdx);
                this.emit('announcement', { text: `🎉 فاز ${this.players[pIdx].name} بالمركز ${this.gameState.winners.length}!` });
            }

            const activePlayers = this.players.filter(p => p !== null);
            if (this.gameState.winners.length >= activePlayers.length - 1) {
                const last = [0, 1, 2, 3].find(p => this.players[p] && !this.gameState.winners.includes(p));
                if (last !== undefined) this.gameState.winners.push(last);
                this.emit('game_over', {
                    winners: this.gameState.winners.map(w => ({
                        playerIndex: w,
                        name: this.players[w].name,
                        color: window.LudoBoard.PLAYER_CONFIG[w].nameAr
                    }))
                });
                return;
            }

            const getsAnotherRoll = (dice === 6 || captured !== null || newStep === 56);
            const moveAnimDuration = (newStep - oldStep) * 130 + 600;

            setTimeout(() => {
                this.nextTurn(getsAnotherRoll);
            }, moveAnimDuration);
        }

        nextTurn(anotherTurn) {
            if (!anotherTurn) {
                let next = (this.gameState.currentTurn + 1) % 4;
                let attempts = 0;
                while ((!this.players[next] || this.gameState.winners.includes(next)) && attempts < 4) {
                    next = (next + 1) % 4;
                    attempts++;
                }

                const firstActive = this.players.findIndex(p => p !== null);
                if (next === firstActive) {
                    this.roundCount++;
                    if (this.gameMode === 'magic') {
                        this.gameState.magicTiles = generateMagicTiles(6);
                        this.emit('announcement', { text: '🔄 اكتملت لفة كاملة! تجددت أماكن البطاقات السحرية على اللوح ✨' });
                    }
                }

                this.gameState.currentTurn = next;
                if (this.gameState.shields[next]) {
                    this.gameState.shields[next] = [false, false, false, false];
                }
            }

            this.gameState.hasRolled = false;
            this.gameState.diceValue = null;
            this.gameState.validTokens = [];
            this.broadcastState();

            // Trigger Bot
            if (this.gameState.currentTurn !== 0) {
                setTimeout(() => {
                    // Bot powers in magic mode
                    if (this.gameMode === 'magic') {
                        const powers = this.gameState.powers[this.gameState.currentTurn];
                        if (powers && powers.rocket > 0 && Math.random() < 0.3) {
                            for (let ot = 0; ot < 4; ot++) {
                                if (this.gameState.tokens[0][ot] >= 10 && this.gameState.tokens[0][ot] <= 50) {
                                    powers.rocket--;
                                    this.gameState.tokens[0][ot] = -1;
                                    this.emit('power_used', { power: 'rocket', message: `🚀 أطلق ${this.players[this.gameState.currentTurn].name} صاروخاً وفجر قطعتك!` });
                                    this.broadcastState();
                                    break;
                                }
                            }
                        }
                    }
                    this.rollDice();
                }, 800);
            }
        }

        useMagicDice(chosenValue) {
            if (this.gameState.currentTurn === 0 && !this.gameState.hasRolled && this.gameState.powers[0].magicDice > 0) {
                this.gameState.powers[0].magicDice--;
                this.rollDice(chosenValue);
            }
        }

        useShield(tokenIdx) {
            if (this.gameState.currentTurn === 0 && this.gameState.powers[0].shield > 0) {
                this.gameState.powers[0].shield--;
                this.gameState.shields[0][tokenIdx] = true;
                this.emit('power_used', { power: 'shield', message: '🛡️ قمت بتفعيل درع الحماية لقطعتك!' });
                this.broadcastState();
            }
        }

        useRocket(targetPlayerIdx, targetTokenIdx) {
            if (this.gameState.currentTurn === 0 && this.gameState.powers[0].rocket > 0) {
                this.gameState.powers[0].rocket--;
                this.gameState.tokens[targetPlayerIdx][targetTokenIdx] = -1;
                this.emit('power_used', {
                    power: 'rocket',
                    message: `🚀 قمت بتفجير قطعة ${this.players[targetPlayerIdx].name} وإرجاعها للبيت!`
                });
                this.broadcastState();
            }
        }

        sendGift(fromSlot, toSlot, giftType) {
            this.emit('gift_received', {
                fromSlot,
                toSlot,
                giftType,
                fromName: this.players[fromSlot].name,
                toName: this.players[toSlot].name
            });
        }
    }

    return {
        createRoom: function (playerName, gameMode, callbacks, playerCount = 2) {
            return new OfflineRoom(playerName, gameMode, callbacks, playerCount);
        }
    };
})();
