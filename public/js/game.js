// Client Game Controller - Lama Ludo Edition

(function () {
    const socket = (typeof io === 'function') ? io() : null;

    let offlineRoom = null;
    const clientListeners = {};

    function onEvent(event, handler) {
        clientListeners[event] = handler;
        if (socket && socket.on) {
            socket.on(event, handler);
        }
    }

    function emitEvent(event, data = {}) {
        if (offlineRoom) {
            if (event === 'roll_dice') offlineRoom.rollDice();
            else if (event === 'move_token') offlineRoom.moveToken(0, data.tokenIndex);
            else if (event === 'use_magic_dice') offlineRoom.useMagicDice(data.chosenValue);
            else if (event === 'use_shield') offlineRoom.useShield(data.tokenIndex);
            else if (event === 'use_rocket') offlineRoom.useRocket(data.targetPlayerIdx, data.targetTokenIdx);
            else if (event === 'send_gift') offlineRoom.sendGift(data.fromSlot, data.toSlot, data.giftType);
            return;
        }

        if (socket && socket.connected) {
            socket.emit(event, data);
        } else {
            if (event === 'create_room' || event === 'play_offline' || event === 'join_room') {
                state.isOfflineMode = true;
                offlineRoom = window.OfflineLudoEngine.createRoom(data.playerName || 'أنت', state.selectedMode, clientListeners);
                offlineRoom.start();
            }
        }
    }

    // App State
    const state = {
        selectedMode: 'magic', // 'classic' | 'quick' | 'magic'
        myPlayerIndex: 0,
        roomCode: null,
        isHost: false,
        isOfflineMode: false,
        players: [],
        gameState: null,
        soundMuted: false,
        micActive: false,
        micStream: null,
        animating: false,
        giftTargetSlot: null,
        diceSkin: localStorage.getItem('ludo_dice_skin') || 'cat'
    };

    // DOM Elements
    const screens = {
        lobby: document.getElementById('lobby-screen'),
        room: document.getElementById('room-screen'),
        game: document.getElementById('game-screen')
    };

    const lobbyEls = {
        playerName: document.getElementById('player-name-input'),
        btnCreate: document.getElementById('btn-create-room'),
        roomCodeInput: document.getElementById('room-code-input'),
        btnJoin: document.getElementById('btn-join-room'),
        btnPlayOffline: document.getElementById('btn-play-offline'),
        modeChips: document.querySelectorAll('.mode-chip')
    };

    const roomEls = {
        codeDisplay: document.getElementById('display-room-code'),
        modeBadge: document.getElementById('room-current-mode-badge'),
        btnCopy: document.getElementById('btn-copy-code'),
        btnLeave: document.getElementById('btn-leave-room'),
        btnStart: document.getElementById('btn-start-game'),
        btnMicWaiting: document.getElementById('btn-mic-waiting'),
        nameSlots: [
            document.getElementById('name-slot-0'),
            document.getElementById('name-slot-1'),
            document.getElementById('name-slot-2'),
            document.getElementById('name-slot-3')
        ]
    };

    const gameEls = {
        boardContainer: document.getElementById('board-container'),
        playerCards: [
            document.getElementById('card-p-0'),
            document.getElementById('card-p-1'),
            document.getElementById('card-p-2'),
            document.getElementById('card-p-3')
        ],
        homeCounts: [
            document.getElementById('home-count-0'),
            document.getElementById('home-count-1'),
            document.getElementById('home-count-2'),
            document.getElementById('home-count-3')
        ],
        turnBanner: document.getElementById('turn-banner'),
        turnText: document.getElementById('turn-text'),
        diceCube: document.getElementById('dice-cube'),
        btnRollDice: document.getElementById('btn-roll-dice'),
        moveInstruction: document.getElementById('move-instruction'),
        btnMicToggle: document.getElementById('btn-mic-toggle'),
        btnMicTest: document.getElementById('btn-mic-test'),
        btnDiceSkin: document.getElementById('btn-dice-skin'),
        diceSkinsModal: document.getElementById('dice-skins-modal'),
        btnCloseDiceSkins: document.getElementById('btn-close-dice-skins'),
        skinCards: document.querySelectorAll('.skin-card'),
        diceSpecialPopup: document.getElementById('dice-special-popup'),
        popupAvatar: document.getElementById('popup-avatar'),
        popupTitle: document.getElementById('popup-title'),
        btnSoundToggle: document.getElementById('btn-sound-toggle'),
        btnRulesToggle: document.getElementById('btn-rules-toggle'),
        btnChatToggle: document.getElementById('btn-chat-toggle'),
        btnQuitGame: document.getElementById('btn-quit-game'),
        magicDock: document.getElementById('magic-powers-dock'),
        btnPowerMagicDice: document.getElementById('power-magic-dice'),
        btnPowerShield: document.getElementById('power-shield'),
        btnPowerRocket: document.getElementById('power-rocket'),
        countMagicDice: document.getElementById('count-magic-dice'),
        countShield: document.getElementById('count-shield'),
        countRocket: document.getElementById('count-rocket'),
        chatDrawer: document.getElementById('chat-drawer'),
        chatMessages: document.getElementById('chat-messages'),
        chatInput: document.getElementById('chat-input'),
        btnSendChat: document.getElementById('btn-send-chat'),
        btnCloseChat: document.getElementById('btn-close-chat'),
        emojiBtns: document.querySelectorAll('.chat-emoji-btn'),
        rulesModal: document.getElementById('rules-modal'),
        btnCloseRules: document.getElementById('btn-close-rules'),
        victoryModal: document.getElementById('victory-modal'),
        victoryPodium: document.getElementById('victory-podium'),
        btnPlayAgain: document.getElementById('btn-play-again'),
        toast: document.getElementById('toast'),
        flyingGiftsLayer: document.getElementById('flying-gifts-layer'),
        giftModal: document.getElementById('gift-modal'),
        giftTargetName: document.getElementById('gift-target-player-name'),
        btnCloseGifts: document.getElementById('btn-close-gifts'),
        giftItems: document.querySelectorAll('.gift-item'),
        magicDiceModal: document.getElementById('magic-dice-modal'),
        btnNumSelects: document.querySelectorAll('.btn-num-select')
    };

    function initBoard() {
        gameEls.boardContainer.innerHTML = window.LudoBoard.createLudoBoardSVG();
    }

    function showScreen(screenKey) {
        Object.keys(screens).forEach(k => {
            if (screens[k]) screens[k].classList.remove('active');
        });
        if (screens[screenKey]) screens[screenKey].classList.add('active');
    }

    function showToast(text, duration = 3000) {
        gameEls.toast.textContent = text;
        gameEls.toast.classList.add('show');
        setTimeout(() => {
            gameEls.toast.classList.remove('show');
        }, duration);
    }

    // Initialize WebRTC Voice Chat
    if (window.VoiceChat) {
        window.VoiceChat.init({
            socket: socket,
            getMyPlayerIndex: () => state.myPlayerIndex,
            onSpeakingChange: (pIdx, speaking) => {
                setPlayerSpeaking(pIdx, speaking);
            },
            onMicStateChange: (active) => {
                state.micActive = active;
                [gameEls.btnMicToggle, roomEls.btnMicWaiting].forEach(btn => {
                    if (btn) {
                        if (active) {
                            btn.classList.add('active');
                            btn.textContent = '🎙️';
                        } else {
                            btn.classList.remove('active');
                            btn.textContent = '🔇';
                        }
                    }
                });
            },
            onToast: (msg) => {
                showToast(msg);
            }
        });
    }

    // 3D Dice Face Rotation Mapping
    const DICE_ROTATIONS = {
        1: { x: 0, y: 0 },
        2: { x: 0, y: -90 },
        3: { x: 0, y: -180 },
        4: { x: 0, y: 90 },
        5: { x: -90, y: 0 },
        6: { x: 90, y: 0 }
    };

    function animateDice(value, callback) {
        window.soundManager.playDiceRoll();
        const cube = gameEls.diceCube;
        cube.classList.add('rolling');

        setTimeout(() => {
            cube.classList.remove('rolling');
            const rot = DICE_ROTATIONS[value] || { x: 0, y: 0 };
            cube.style.transform = `rotateX(${rot.x}deg) rotateY(${rot.y}deg)`;
            if (callback) callback();
        }, 600);
    }

    // 4 Themed Dice Configurations (Cat, Lion, Dragon, Royal Gold)
    const DICE_THEMES = {
        cat: {
            name: 'نرد القطة 🐱',
            avatar: '🐱',
            title: 'مياااو! 🐾',
            sound: () => window.soundManager.playCatMeow()
        },
        lion: {
            name: 'نرد الأسد 🦁',
            avatar: '🦁',
            title: 'زئييير الأسد! 🔥',
            sound: () => window.soundManager.playLionRoar()
        },
        dragon: {
            name: 'نرد التنين 🐉',
            avatar: '🐉',
            title: 'صرخة التنين! ⚡',
            sound: () => window.soundManager.playDragonScreech()
        },
        gold: {
            name: 'نرد العرش 👑',
            avatar: '👑',
            title: 'تتويج ملكي! ✨',
            sound: () => window.soundManager.playRoyalFanfare()
        }
    };

    function applyDiceSkin(skinKey) {
        state.diceSkin = skinKey;
        localStorage.setItem('ludo_dice_skin', skinKey);

        gameEls.diceCube.classList.remove('theme-cat', 'theme-lion', 'theme-dragon', 'theme-gold');
        gameEls.diceCube.classList.add(`theme-${skinKey}`);

        gameEls.skinCards.forEach(c => {
            if (c.getAttribute('data-skin') === skinKey) c.classList.add('active');
            else c.classList.remove('active');
        });
    }

    function triggerSpecialSixCelebration() {
        const theme = DICE_THEMES[state.diceSkin] || DICE_THEMES.cat;
        theme.sound();

        gameEls.popupAvatar.textContent = theme.avatar;
        gameEls.popupTitle.textContent = theme.title;
        gameEls.diceSpecialPopup.classList.add('show');

        setTimeout(() => {
            gameEls.diceSpecialPopup.classList.remove('show');
        }, 1300);
    }

    // Render Pawns with 3D Lama Ludo Figurine Styling
    function renderPawns() {
        const pawnsLayer = document.getElementById('pawns-layer');
        if (!pawnsLayer || !state.gameState) return;

        pawnsLayer.innerHTML = '';
        const cellSize = 40;
        const tokens = state.gameState.tokens;
        const shields = state.gameState.shields || [[],[],[],[]];

        const positionBuckets = {};

        for (let pIdx = 0; pIdx < 4; pIdx++) {
            for (let tIdx = 0; tIdx < 4; tIdx++) {
                const step = tokens[pIdx][tIdx];
                const key = `${pIdx}_${step}`;
                const posKey = (step >= 0 && step <= 50) 
                    ? `track_${(window.LudoBoard.PLAYER_CONFIG[pIdx].startTrackIndex + step) % 52}`
                    : key;

                if (!positionBuckets[posKey]) positionBuckets[posKey] = [];
                positionBuckets[posKey].push({ pIdx, tIdx, step });
            }
        }

        const sphereGradients = [
            'url(#pawn-red-sphere)',
            'url(#pawn-green-sphere)',
            'url(#pawn-yellow-sphere)',
            'url(#pawn-blue-sphere)'
        ];

        for (let pIdx = 0; pIdx < 4; pIdx++) {
            const pConfig = window.LudoBoard.PLAYER_CONFIG[pIdx];
            const isMyTurn = (state.gameState.currentTurn === state.myPlayerIndex && pIdx === state.myPlayerIndex);
            const canMoveThisTurn = isMyTurn && state.gameState.hasRolled && !state.animating;
            const gradId = sphereGradients[pIdx];

            for (let tIdx = 0; tIdx < 4; tIdx++) {
                const step = tokens[pIdx][tIdx];
                const gridPos = window.LudoBoard.getTokenGridPos(pIdx, tIdx, step);
                const hasShield = shields[pIdx] && shields[pIdx][tIdx];

                const posKey = (step >= 0 && step <= 50) 
                    ? `track_${(pConfig.startTrackIndex + step) % 52}`
                    : `${pIdx}_${step}`;
                
                const cluster = positionBuckets[posKey] || [];
                const clusterIdx = cluster.findIndex(item => item.pIdx === pIdx && item.tIdx === tIdx);
                let offsetX = 0;
                let offsetY = 0;

                if (cluster.length > 1 && step !== -1) {
                    const angle = (clusterIdx / cluster.length) * (2 * Math.PI);
                    const radius = cellSize * 0.22;
                    offsetX = Math.cos(angle) * radius;
                    offsetY = Math.sin(angle) * radius;
                }

                const cx = gridPos[0] * cellSize + offsetX;
                const cy = gridPos[1] * cellSize + offsetY;
                const isMovable = canMoveThisTurn && state.gameState.validTokens && state.gameState.validTokens.includes(tIdx);

                const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                g.setAttribute('class', `ludo-pawn ${isMovable ? 'movable' : ''}`);
                g.setAttribute('data-player', pIdx);
                g.setAttribute('data-token', tIdx);

                g.innerHTML = `
                    <!-- 3D Realistic Drop Shadow -->
                    <ellipse cx="${cx}" cy="${cy + 10}" rx="${cellSize * 0.32}" ry="${cellSize * 0.12}" fill="rgba(0,0,0,0.35)" />

                    <!-- Movable Aura Ring -->
                    ${isMovable ? `
                        <circle cx="${cx}" cy="${cy + 4}" r="${cellSize * 0.44}" fill="none" stroke="#f59e0b" stroke-width="2.5" class="movable-aura-ring" />
                    ` : ''}

                    <!-- 3D Pawn Figurine Base Skirt -->
                    <path d="M ${cx - cellSize*0.28} ${cy + 8} Q ${cx} ${cy + 12} ${cx + cellSize*0.28} ${cy + 8} L ${cx + cellSize*0.18} ${cy + 1} Q ${cx} ${cy - 1} ${cx - cellSize*0.18} ${cy + 1} Z" fill="${pConfig.darkColor}" />
                    <ellipse cx="${cx}" cy="${cy + 8}" rx="${cellSize * 0.28}" ry="${cellSize * 0.08}" fill="${pConfig.primaryColor}" />

                    <!-- Gold Waist Ring -->
                    <ellipse cx="${cx}" cy="${cy + 2}" rx="${cellSize * 0.2}" ry="${cellSize * 0.06}" fill="url(#frame-gold)" stroke="#78350f" stroke-width="0.5" />

                    <!-- 3D Glossy Sphere Head -->
                    <circle cx="${cx}" cy="${cy - 3}" r="${cellSize * 0.27}" fill="${gradId}" stroke="#ffffff" stroke-width="1.2" filter="url(#soft-shadow)" />

                    <!-- Specular Orb Reflection -->
                    <ellipse cx="${cx - 3}" cy="${cy - 6}" rx="${cellSize * 0.08}" ry="${cellSize * 0.05}" fill="#ffffff" opacity="0.85" />

                    <!-- Shield Forcefield (Lama Ludo Shield Power) -->
                    ${hasShield ? `
                        <circle cx="${cx}" cy="${cy}" r="${cellSize * 0.5}" fill="rgba(56, 189, 248, 0.2)" stroke="#38bdf8" stroke-width="2.5" stroke-dasharray="5,3" class="shield-bubble-anim" />
                        <text x="${cx}" y="${cy - cellSize * 0.45}" font-size="12" text-anchor="middle">🛡️</text>
                    ` : ''}
                `;

                if (isMovable) {
                    g.style.cursor = 'pointer';
                    g.addEventListener('click', () => {
                        window.soundManager.playClick();
                        emitEvent('move_token', { tokenIndex: tIdx });
                    });
                }

                pawnsLayer.appendChild(g);
            }
        }
    }

    // ===== Dynamic Magic Tiles Rendering =====
    function renderMagicTiles() {
        const layer = document.getElementById('magic-tiles-layer');
        if (!layer || !state.gameState) return;
        layer.innerHTML = '';

        if (state.gameState.gameMode !== 'magic') return;

        const tiles = state.gameState.magicTiles || {};
        const cellSize = 40;
        const TRACK = window.LudoBoard.MAIN_TRACK; // ACCURATE_MAIN_TRACK exposed as MAIN_TRACK

        Object.entries(tiles).forEach(([trackIdx, item]) => {
            const cell = TRACK[parseInt(trackIdx)];
            if (!cell) return;

            const cx = (cell[0] + 0.5) * cellSize;
            const cy = (cell[1] + 0.5) * cellSize;

            const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            g.setAttribute('class', 'magic-tile-badge-dyn');
            g.innerHTML = `
                <circle cx="${cx}" cy="${cy + 1}" r="${cellSize * 0.38}" fill="rgba(0,0,0,0.18)" />
                <circle cx="${cx}" cy="${cy}" r="${cellSize * 0.38}" fill="rgba(139,92,246,0.22)" stroke="#8b5cf6" stroke-width="1.8" />
                <circle cx="${cx}" cy="${cy}" r="${cellSize * 0.3}" fill="#ffffff" />
                <text x="${cx}" y="${cy + cellSize * 0.14}" font-size="15" text-anchor="middle" dominant-baseline="middle">${item.icon}</text>
            `;
            layer.appendChild(g);
        });
    }

    // Step-by-Step Pawn Animation
    function animateTokenMove(playerIndex, tokenIndex, oldStep, newStep, isSpawn, captured, callback) {
        state.animating = true;
        const steps = [];

        if (isSpawn) {
            steps.push(0);
        } else {
            for (let s = oldStep + 1; s <= newStep; s++) {
                steps.push(s);
            }
        }

        let i = 0;
        function stepNext() {
            if (i < steps.length) {
                const currentS = steps[i];
                window.soundManager.playStep();
                state.gameState.tokens[playerIndex][tokenIndex] = currentS;
                renderPawns();
                i++;
                setTimeout(stepNext, 120);
            } else {
                state.animating = false;
                state.gameState.tokens[playerIndex][tokenIndex] = newStep;

                if (captured) {
                    window.soundManager.playKill();
                    showToast(`💥 تم أكل قطعة ${captured.playerName}!`);
                } else if (window.LudoBoard.isStepSafe(playerIndex, newStep) || newStep === 56) {
                    window.soundManager.playSafe();
                }

                renderPawns();
                updateUI();
                if (callback) callback();
            }
        }

        stepNext();
    }

    // Flying Gift Animation Engine
    const GIFT_EMOJIS = {
        rose: '🌹',
        bomb: '💣',
        tomato: '🍅',
        egg: '🥚',
        ring: '💍',
        rocket: '🚀'
    };

    function triggerFlyingGift(fromSlot, toSlot, giftType, fromName, toName) {
        const fromCard = gameEls.playerCards[fromSlot];
        const toCard = gameEls.playerCards[toSlot];
        if (!fromCard || !toCard) return;

        const fromRect = fromCard.getBoundingClientRect();
        const toRect = toCard.getBoundingClientRect();

        const startX = fromRect.left + fromRect.width / 2;
        const startY = fromRect.top + fromRect.height / 2;
        const endX = toRect.left + toRect.width / 2;
        const endY = toRect.top + toRect.height / 2;

        const emoji = GIFT_EMOJIS[giftType] || '🎁';
        const projectile = document.createElement('div');
        projectile.className = 'flying-gift-projectile';
        projectile.textContent = emoji;
        projectile.style.left = `${startX}px`;
        projectile.style.top = `${startY}px`;

        gameEls.flyingGiftsLayer.appendChild(projectile);

        // Sound trigger on release
        if (giftType === 'rocket') window.soundManager.playRocket();
        else if (giftType === 'rose' || giftType === 'ring') window.soundManager.playGiftHeart();
        else window.soundManager.playClick();

        // Animate flying
        requestAnimationFrame(() => {
            projectile.style.left = `${endX}px`;
            projectile.style.top = `${endY}px`;
            projectile.style.transform = 'scale(1.3) rotate(360deg)';
        });

        // Arrival after 800ms
        setTimeout(() => {
            projectile.remove();

            // Splash / Explode effect on target
            const splat = document.createElement('div');
            splat.className = 'gift-splat-effect';
            if (giftType === 'bomb' || giftType === 'rocket') {
                splat.textContent = '💥';
                window.soundManager.playKill();
            } else if (giftType === 'tomato') {
                splat.textContent = '🥫';
                window.soundManager.playSplat();
            } else if (giftType === 'egg') {
                splat.textContent = '🍳';
                window.soundManager.playSplat();
            } else {
                splat.textContent = '💖';
                window.soundManager.playGiftHeart();
            }
            splat.style.left = `${endX}px`;
            splat.style.top = `${endY}px`;
            gameEls.flyingGiftsLayer.appendChild(splat);

            setTimeout(() => splat.remove(), 800);
            showToast(`${emoji} ${fromName} أرسل ${emoji} إلى ${toName}!`);
        }, 800);
    }

    // Player Speaking UI Indicator Helper
    function setPlayerSpeaking(playerIndex, speaking) {
        const card = gameEls.playerCards[playerIndex];
        const slot = document.querySelector(`.player-slot[data-slot="${playerIndex}"]`);
        if (card) {
            if (speaking) card.classList.add('speaking');
            else card.classList.remove('speaking');
        }
        if (slot) {
            if (speaking) slot.classList.add('speaking');
            else slot.classList.remove('speaking');
        }
    }

    // Voice Chat WebRTC / Audio Toggle
    async function toggleMicrophone() {
        if (window.VoiceChat) {
            await window.VoiceChat.toggleMic();
        }
    }

    // Update Overall Game UI
    function updateUI() {
        if (!state.gameState) return;

        const gs = state.gameState;
        const curTurn = gs.currentTurn;
        const curPlayer = state.players[curTurn];
        const isMyTurn = (curTurn === state.myPlayerIndex);
        const pConfig = window.LudoBoard.PLAYER_CONFIG[curTurn];
        const targetHome = (gs.gameMode === 'quick') ? 2 : 4;

        // Player Cards Active Indicator
        gameEls.playerCards.forEach((card, idx) => {
            if (card) {
                if (idx === curTurn) card.classList.add('active-turn');
                else card.classList.remove('active-turn');
            }
        });

        // Tokens Home Counts
        for (let p = 0; p < 4; p++) {
            if (gameEls.homeCounts[p] && gs.tokens[p]) {
                const homeTokens = gs.tokens[p].filter(s => s === 56).length;
                gameEls.homeCounts[p].textContent = `${homeTokens}/${targetHome}`;
            }
        }

        // Turn Banner Text
        if (curPlayer) {
            const name = curPlayer.name + (curPlayer.isBot ? ' 🤖' : '');
            let extraHint = '';
            if (gs.gameMode === 'quick') extraHint = ' (النمط السريع ⚡)';
            if (gs.gameMode === 'magic') extraHint = ' (النمط السحري 🪄)';

            gameEls.turnText.textContent = isMyTurn ? `حان دورك! ارمِ النرد 🎲${extraHint}` : `دور ${name} (${pConfig.nameAr})${extraHint}`;
            gameEls.turnBanner.style.borderColor = pConfig.primaryColor;
        }

        // Roll Dice Button State
        if (isMyTurn && !gs.hasRolled && !state.animating) {
            gameEls.btnRollDice.disabled = false;
        } else {
            gameEls.btnRollDice.disabled = true;
        }

        // Magic Powers Dock (Only in Magic Mode)
        if (gs.gameMode === 'magic') {
            gameEls.magicDock.classList.add('active');
            const myPowers = gs.powers && gs.powers[state.myPlayerIndex] 
                ? gs.powers[state.myPlayerIndex] 
                : { magicDice: 0, shield: 0, rocket: 0 };

            gameEls.countMagicDice.textContent = myPowers.magicDice;
            gameEls.countShield.textContent = myPowers.shield;
            gameEls.countRocket.textContent = myPowers.rocket;

            gameEls.btnPowerMagicDice.disabled = (!isMyTurn || gs.hasRolled || myPowers.magicDice <= 0);
            gameEls.btnPowerShield.disabled = (!isMyTurn || myPowers.shield <= 0);
            gameEls.btnPowerRocket.disabled = (!isMyTurn || myPowers.rocket <= 0);
        } else {
            gameEls.magicDock.classList.remove('active');
        }

        // Move Instruction
        if (isMyTurn && gs.hasRolled && gs.validTokens && gs.validTokens.length > 0 && !state.animating) {
            gameEls.moveInstruction.classList.add('visible');
        } else {
            gameEls.moveInstruction.classList.remove('visible');
        }

        if (!state.animating) {
            renderPawns();
            renderMagicTiles();
        }
    }

    // ================= Socket / Offline Event Handlers =================

    onEvent('connect', () => {
        console.log('Connected to LAMA DUDO Server');
    });

    onEvent('room_created', ({ code, playerIndex }) => {
        state.roomCode = code;
        state.myPlayerIndex = playerIndex;
        state.isHost = true;
        roomEls.codeDisplay.textContent = code;
        showScreen('room');
    });

    onEvent('joined_room', ({ code, playerIndex }) => {
        state.roomCode = code;
        state.myPlayerIndex = playerIndex;
        state.isHost = false;
        roomEls.codeDisplay.textContent = code;
        showScreen('room');
    });

    onEvent('room_update', (data) => {
        state.players = data.players;
        state.gameState = data.gameState;
        state.isHost = (socket && socket.id === data.hostId) || state.isOfflineMode;

        // Update mode badge
        const modeNames = { classic: '🎲 كلاسيكي', quick: '⚡ سريع (Quick)', magic: '🪄 سحري (Magic)' };
        roomEls.modeBadge.textContent = modeNames[data.gameState.gameMode] || '🎲 كلاسيكي';

        // Update Waiting Room Slots
        data.players.forEach((p, idx) => {
            const nameEl = roomEls.nameSlots[idx];
            const botBtn = document.querySelector(`.btn-add-bot[data-slot="${idx}"]`);

            if (p) {
                if (nameEl) nameEl.textContent = p.name + (p.isBot ? ' 🤖' : '');
                if (botBtn) {
                    if (p.isBot && state.isHost) {
                        botBtn.textContent = '✕ حذف';
                        botBtn.style.display = 'block';
                        botBtn.onclick = () => emitEvent('remove_bot', { slotIndex: idx });
                    } else {
                        botBtn.style.display = 'none';
                    }
                }
            } else {
                if (nameEl) nameEl.textContent = 'فارغ';
                if (botBtn) {
                    botBtn.textContent = '+ بوت';
                    botBtn.style.display = state.isHost ? 'block' : 'none';
                    botBtn.onclick = () => emitEvent('add_bot');
                }
            }
        });

        // Start Game Button enabled if host and >= 2 players
        const activeCount = data.players.filter(p => p !== null).length;
        if (state.isHost) {
            roomEls.btnStart.disabled = (activeCount < 2);
            roomEls.btnStart.style.display = 'block';
        } else {
            roomEls.btnStart.style.display = 'none';
        }

        // Update Player Names in Top Bar
        data.players.forEach((p, idx) => {
            const cardName = gameEls.playerCards[idx]?.querySelector('.p-name');
            if (cardName) cardName.textContent = p ? p.name : 'فارغ';
        });

        if (window.VoiceChat) {
            window.VoiceChat.updatePeers(data.players);
        }

        updateUI();
    });

    onEvent('game_started', () => {
        initBoard();
        showScreen('game');
        updateUI();
        renderMagicTiles();
    });

    onEvent('dice_rolled', ({ playerIndex, diceValue, validTokens }) => {
        if (state.gameState) {
            state.gameState.currentTurn = playerIndex;
            state.gameState.diceValue = diceValue;
            state.gameState.hasRolled = true;
            state.gameState.validTokens = validTokens;
        }

        animateDice(diceValue, () => {
            if (diceValue === 6) {
                triggerSpecialSixCelebration();
            }
            updateUI();
        });
    });

    onEvent('token_moved', ({ playerIndex, tokenIndex, oldStep, newStep, isSpawn, captured }) => {
        animateTokenMove(playerIndex, tokenIndex, oldStep, newStep, isSpawn, captured);
    });

    onEvent('pickup_collected', ({ trackIdx, power, icon, title, playerName }) => {
        if (state.gameState && state.gameState.magicTiles) {
            delete state.gameState.magicTiles[trackIdx];
            renderMagicTiles();
        }
        window.soundManager.playMagic();
        showToast(`✨ التقط ${playerName} بطاقة [${title}] من اللوح!`);
        addChatMessage({ senderName: '🪄 بطاقة سحرية', text: `حصل ${playerName} على ${title} بالوقوف على مربعه في اللوح!`, isSystem: true });
    });

    onEvent('gift_received', (data) => {
        triggerFlyingGift(data.fromSlot, data.toSlot, data.giftType, data.fromName, data.toName);
    });

    onEvent('voice_speaking_update', ({ playerIndex, speaking }) => {
        setPlayerSpeaking(playerIndex, speaking);
    });

    onEvent('power_used', ({ power, message }) => {
        if (power === 'rocket') window.soundManager.playRocket();
        if (power === 'shield') window.soundManager.playShield();
        showToast(message);
        addChatMessage({ senderName: '🪄 سحر', text: message, isSystem: true });
    });

    onEvent('announcement', ({ text }) => {
        showToast(text);
        addChatMessage({ senderName: '📢 النظام', text: text, isSystem: true });
        renderMagicTiles();
    });

    onEvent('error_message', (msg) => {
        showToast(`⚠️ ${msg}`);
    });

    onEvent('chat_received', (data) => {
        addChatMessage(data);
    });

    onEvent('game_over', ({ winners }) => {
        window.soundManager.playWin();
        showVictoryScreen(winners);
    });

    function addChatMessage({ senderName, text, isSystem }) {
        const msgEl = document.createElement('div');
        msgEl.className = `chat-msg ${isSystem ? 'system' : ''}`;
        msgEl.innerHTML = `<span class="sender">${senderName}:</span> <span class="content">${text}</span>`;
        gameEls.chatMessages.appendChild(msgEl);
        gameEls.chatMessages.scrollTop = gameEls.chatMessages.scrollHeight;
    }

    function showVictoryScreen(winners) {
        gameEls.victoryPodium.innerHTML = '';
        const medals = ['👑 المركز الأول (بطل اللودو)', '🥈 المركز الثاني', '🥉 المركز الثالث', '🎖️ المركز الرابع'];

        winners.forEach((w, idx) => {
            const item = document.createElement('div');
            item.className = 'podium-rank-item';
            item.innerHTML = `
                <span>${medals[idx] || `المركز ${idx + 1}`}</span>
                <span>${w.name}</span>
            `;
            gameEls.victoryPodium.appendChild(item);
        });

        gameEls.victoryModal.classList.add('active');
    }

    // ================= Event Listeners =================

    // Mode Chips Selection
    lobbyEls.modeChips.forEach(chip => {
        chip.addEventListener('click', () => {
            window.soundManager.playClick();
            lobbyEls.modeChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            state.selectedMode = chip.getAttribute('data-mode');
        });
    });

    // Create Room
    lobbyEls.btnCreate.addEventListener('click', () => {
        window.soundManager.playClick();
        const name = lobbyEls.playerName.value.trim() || 'الملك 👑';
        emitEvent('create_room', { playerName: name, gameMode: state.selectedMode });
    });

    // Join Room
    lobbyEls.btnJoin.addEventListener('click', () => {
        window.soundManager.playClick();
        const code = lobbyEls.roomCodeInput.value.trim();
        const name = lobbyEls.playerName.value.trim() || 'اللاعب';
        if (!code) {
            showToast('الرجاء كتابة رمز الغرفة أولاً');
            return;
        }
        emitEvent('join_room', { code: code, playerName: name });
    });

    // Offline / Instant Play vs Bots
    lobbyEls.btnPlayOffline.addEventListener('click', () => {
        window.soundManager.playClick();
        const name = lobbyEls.playerName.value.trim() || 'أنت';
        state.isOfflineMode = true;
        offlineRoom = window.OfflineLudoEngine.createRoom(name, state.selectedMode, clientListeners);
        offlineRoom.start();
    });

    // Copy Room Code
    roomEls.btnCopy.addEventListener('click', () => {
        if (!state.roomCode) return;
        navigator.clipboard.writeText(state.roomCode).then(() => {
            showToast('تم نسخ رمز الغرفة بنجاح! 📋');
        });
    });

    // Leave Room
    roomEls.btnLeave.addEventListener('click', () => {
        window.location.reload();
    });

    // Start Game
    roomEls.btnStart.addEventListener('click', () => {
        window.soundManager.playClick();
        emitEvent('start_game');
    });

    // Roll Dice
    gameEls.btnRollDice.addEventListener('click', () => {
        window.soundManager.playClick();
        emitEvent('roll_dice');
    });

    // ================= LAMA GIFTS INTERACTION =================
    // Clicking on any player card opens the Gift Box!
    gameEls.playerCards.forEach(card => {
        card.addEventListener('click', () => {
            const slot = parseInt(card.getAttribute('data-player'), 10);
            const targetPlayer = state.players[slot];
            if (!targetPlayer) return;

            window.soundManager.playClick();
            state.giftTargetSlot = slot;
            gameEls.giftTargetName.textContent = targetPlayer.name;
            gameEls.giftModal.classList.add('active');
        });
    });

    // Selecting a gift to throw
    gameEls.giftItems.forEach(item => {
        item.addEventListener('click', () => {
            const giftType = item.getAttribute('data-gift');
            if (state.giftTargetSlot !== null) {
                emitEvent('send_gift', {
                    toSlot: state.giftTargetSlot,
                    giftType: giftType
                });
                gameEls.giftModal.classList.remove('active');
            }
        });
    });

    gameEls.btnCloseGifts.addEventListener('click', () => {
        gameEls.giftModal.classList.remove('active');
    });

    // ================= MAGIC POWERS =================
    // Magic Dice
    gameEls.btnPowerMagicDice.addEventListener('click', () => {
        window.soundManager.playMagic();
        gameEls.magicDiceModal.classList.add('active');
    });

    gameEls.btnNumSelects.forEach(btn => {
        btn.addEventListener('click', () => {
            const num = parseInt(btn.getAttribute('data-num'), 10);
            gameEls.magicDiceModal.classList.remove('active');
            emitEvent('use_magic_dice', { chosenValue: num });
        });
    });

    // Shield
    gameEls.btnPowerShield.addEventListener('click', () => {
        window.soundManager.playShield();
        // Shield the first active token
        const tokens = state.gameState.tokens[state.myPlayerIndex];
        const activeIdx = tokens.findIndex(s => s >= 0 && s < 56);
        const tokenToShield = (activeIdx !== -1) ? activeIdx : 0;
        emitEvent('use_shield', { tokenIndex: tokenToShield });
    });

    // Rocket
    gameEls.btnPowerRocket.addEventListener('click', () => {
        window.soundManager.playRocket();
        // Find furthest opponent
        let targetP = -1;
        let targetT = -1;
        let maxStep = -1;

        for (let p = 0; p < 4; p++) {
            if (p !== state.myPlayerIndex && state.players[p]) {
                state.gameState.tokens[p].forEach((s, t) => {
                    if (s >= 0 && s <= 50 && s > maxStep) {
                        maxStep = s;
                        targetP = p;
                        targetT = t;
                    }
                });
            }
        }

        if (targetP !== -1) {
            emitEvent('use_rocket', { targetPlayerIdx: targetP, targetTokenIdx: targetT });
        } else {
            showToast('لا توجد قطع خصوم نشطة على المسار لاستهدافها!');
        }
    });

    // Microphone toggle
    if (gameEls.btnMicToggle) {
        gameEls.btnMicToggle.addEventListener('click', toggleMicrophone);
    }
    if (roomEls.btnMicWaiting) {
        roomEls.btnMicWaiting.addEventListener('click', toggleMicrophone);
    }

    // Microphone Self-Test (Loopback toggle to hear yourself)
    if (gameEls.btnMicTest) {
        gameEls.btnMicTest.addEventListener('click', () => {
            if (window.VoiceChat) {
                const isTesting = window.VoiceChat.toggleSelfTest();
                if (isTesting) {
                    gameEls.btnMicTest.classList.add('active');
                } else {
                    gameEls.btnMicTest.classList.remove('active');
                }
            }
        });
    }

    // Chat Drawer
    gameEls.btnChatToggle.addEventListener('click', () => {
        gameEls.chatDrawer.classList.toggle('open');
    });
    gameEls.btnCloseChat.addEventListener('click', () => {
        gameEls.chatDrawer.classList.remove('open');
    });

    function sendChat() {
        const text = gameEls.chatInput.value.trim();
        if (text) {
            emitEvent('send_chat', { text: text });
            gameEls.chatInput.value = '';
        }
    }
    gameEls.btnSendChat.addEventListener('click', sendChat);
    gameEls.chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendChat();
    });

    gameEls.emojiBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            emitEvent('send_chat', { text: btn.textContent });
        });
    });

    // Sound toggle
    gameEls.btnSoundToggle.addEventListener('click', () => {
        const muted = window.soundManager.toggleMute();
        gameEls.btnSoundToggle.textContent = muted ? '🔇' : '🔊';
        showToast(muted ? 'تم كتم الصوت' : 'تم تفعيل الصوت 🔊');
    });

    // Rules modal
    if (gameEls.btnRulesToggle) {
        gameEls.btnRulesToggle.addEventListener('click', () => {
            if (gameEls.rulesModal) gameEls.rulesModal.classList.add('active');
        });
    }
    if (gameEls.btnCloseRules) {
        gameEls.btnCloseRules.addEventListener('click', () => {
            if (gameEls.rulesModal) gameEls.rulesModal.classList.remove('active');
        });
    }

    // Quit Game
    gameEls.btnQuitGame.addEventListener('click', () => {
        if (confirm('هل أنت متأكد من مغادرة اللعبة؟')) {
            window.location.reload();
        }
    });

    gameEls.btnPlayAgain.addEventListener('click', () => {
        window.location.reload();
    });

    // Dice skins modal events
    gameEls.btnDiceSkin.addEventListener('click', () => {
        window.soundManager.playClick();
        gameEls.diceSkinsModal.classList.add('active');
    });
    gameEls.btnCloseDiceSkins.addEventListener('click', () => {
        gameEls.diceSkinsModal.classList.remove('active');
    });

    gameEls.skinCards.forEach(card => {
        card.addEventListener('click', () => {
            const skin = card.getAttribute('data-skin');
            applyDiceSkin(skin);
            const theme = DICE_THEMES[skin];
            if (theme) theme.sound();
            showToast(`تم اختيار ${theme ? theme.name : 'النرد'} 🎲`);
            setTimeout(() => {
                gameEls.diceSkinsModal.classList.remove('active');
            }, 350);
        });
    });

    // Close Modals on background click
    [gameEls.rulesModal, gameEls.victoryModal, gameEls.giftModal, gameEls.magicDiceModal, gameEls.diceSkinsModal].forEach(modal => {
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.classList.remove('active');
            });
        }
    });

    // Initial load: Apply saved or default dice skin
    applyDiceSkin(state.diceSkin);

})();
