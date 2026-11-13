// WebRTC Voice Chat Manager for LAMA DUDO (لاما دودو الملكية)
// Handles real-time peer-to-peer audio streaming, local voice activity detection (VAD), and mic controls.

(function () {
    const RTC_CONFIG = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' }
        ]
    };

    class VoiceChatManager {
        constructor() {
            this.socket = null;
            this.myPlayerIndex = 0;
            this.roomPlayers = [];
            this.localStream = null;
            this.isMicActive = false;
            this.loopbackEnabled = false; // Self-test audio loopback

            // Map: socketId -> { pc, targetPlayerIndex, stream, audioEl }
            this.peers = new Map();

            // Web Audio Context for VAD & self-test
            this.audioCtx = null;
            this.localSource = null;
            this.localAnalyser = null;
            this.loopbackGain = null;
            this.vadInterval = null;

            // Callbacks
            this.onSpeakingChange = null;
            this.onMicStateChange = null;
            this.onToast = null;
        }

        init({ socket, getMyPlayerIndex, onSpeakingChange, onMicStateChange, onToast }) {
            this.socket = socket;
            this.getMyPlayerIndex = getMyPlayerIndex;
            this.onSpeakingChange = onSpeakingChange;
            this.onMicStateChange = onMicStateChange;
            this.onToast = onToast || console.log;

            if (this.socket) {
                // Incoming WebRTC signaling from peers
                this.socket.on('voice_signal', async ({ fromId, playerIndex, signal }) => {
                    await this.handleIncomingSignal(fromId, playerIndex, signal);
                });

                // Peer status (mic on/off)
                this.socket.on('voice_status_update', ({ socketId, playerIndex, active }) => {
                    console.log(`[Voice] Peer ${socketId} (slot ${playerIndex}) mic active: ${active}`);
                });

                // Speaking update from server (synchronizes speaking indicator across all clients)
                this.socket.on('voice_speaking_update', ({ playerIndex, speaking }) => {
                    if (this.onSpeakingChange) {
                        this.onSpeakingChange(playerIndex, speaking);
                    }
                });

                // Peer disconnected
                this.socket.on('peer_disconnected', ({ socketId }) => {
                    this.removePeer(socketId);
                });
            }

            // Global user gesture unlock for audio playback & AudioContext
            const unlockAudio = () => {
                if (this.audioCtx && this.audioCtx.state === 'suspended') {
                    this.audioCtx.resume().catch(() => {});
                }
                document.querySelectorAll('audio.remote-voice-audio').forEach(a => {
                    if (a.paused && a.srcObject) {
                        a.play().catch(() => {});
                    }
                });
            };
            window.addEventListener('click', unlockAudio, { passive: true });
            window.addEventListener('touchstart', unlockAudio, { passive: true });
        }

        // Toggle Microphone ON/OFF
        async toggleMic() {
            if (!this.isMicActive) {
                return await this.startMic();
            } else {
                this.stopMic();
                return false;
            }
        }

        // Start Microphone & Broadcast Audio
        async startMic() {
            try {
                if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                    throw new Error('المتصفح لا يدعم الوصول للمايكروفون.');
                }

                // If stream already exists, simply enable tracks
                if (this.localStream && this.localStream.getAudioTracks().length > 0) {
                    this.localStream.getAudioTracks().forEach(t => { t.enabled = true; });
                } else {
                    this.localStream = await navigator.mediaDevices.getUserMedia({
                        audio: {
                            echoCancellation: true,
                            noiseSuppression: true,
                            autoGainControl: true
                        },
                        video: false
                    });
                }

                this.isMicActive = true;

                // Add or update tracks in all active peer connections
                this.peers.forEach((peer) => {
                    this.addLocalStreamToPeer(peer.pc);
                });

                // Start local Voice Activity Detection (VAD)
                this.startLocalVAD();

                // Notify server and peers
                if (this.socket && this.socket.connected) {
                    this.socket.emit('voice_status', { active: true });
                }

                if (this.onMicStateChange) this.onMicStateChange(true);
                this.onToast('🎙️ تم تشغيل المايك! تحدث وصوتك سيصل لجميع اللاعبين.');
                return true;
            } catch (err) {
                console.error('[Voice] Error starting mic:', err);
                this.isMicActive = false;
                if (this.onMicStateChange) this.onMicStateChange(false);
                this.onToast('⚠️ تعذر الوصول للمايك. يرجى السماح بالإذن في المتصفح.');
                return false;
            }
        }

        // Stop Microphone (Mute)
        stopMic() {
            this.isMicActive = false;

            // Mute local tracks (keeps peer connection alive)
            if (this.localStream) {
                this.localStream.getAudioTracks().forEach(t => {
                    t.enabled = false;
                });
            }

            // Stop local VAD interval
            if (this.vadInterval) {
                clearInterval(this.vadInterval);
                this.vadInterval = null;
            }

            // Reset speaking indicator for me
            const myIdx = (this.getMyPlayerIndex) ? this.getMyPlayerIndex() : 0;
            if (this.onSpeakingChange) {
                this.onSpeakingChange(myIdx, false);
            }

            if (this.socket && this.socket.connected) {
                this.socket.emit('voice_speaking', { speaking: false });
                this.socket.emit('voice_status', { active: false });
            }

            if (this.onMicStateChange) this.onMicStateChange(false);
            this.onToast('🔇 تم كتم المايكروفون.');
        }

        // Add Local Audio Tracks to a Peer Connection
        addLocalStreamToPeer(pc) {
            if (!this.localStream) return;
            const senders = pc.getSenders();
            this.localStream.getAudioTracks().forEach(track => {
                const existing = senders.find(s => s.track && s.track.kind === 'audio');
                if (existing) {
                    existing.replaceTrack(track).catch(err => console.warn('[Voice] replaceTrack error:', err));
                } else {
                    pc.addTrack(track, this.localStream);
                }
            });
        }

        // Called on room_update with the players array
        updatePeers(players) {
            if (!this.socket || !this.socket.id) return;
            this.roomPlayers = players || [];

            const currentPeerIds = new Set();

            players.forEach((p, idx) => {
                if (!p || p.isBot || !p.id) return;
                if (p.id === this.socket.id) return; // Skip myself

                currentPeerIds.add(p.id);

                // If not connected to this peer yet:
                if (!this.peers.has(p.id)) {
                    // Deterministic initiator rule: lexicographically smaller socket.id initiates offer
                    const isInitiator = (this.socket.id < p.id);
                    this.createPeer(p.id, idx, isInitiator);
                } else {
                    this.peers.get(p.id).targetPlayerIndex = idx;
                }
            });

            // Clean up any peers that left the room
            this.peers.forEach((peer, peerId) => {
                if (!currentPeerIds.has(peerId)) {
                    this.removePeer(peerId);
                }
            });
        }

        // Create Peer Connection
        async createPeer(targetId, targetPlayerIndex, isInitiator) {
            console.log(`[Voice] Creating RTC Peer for ${targetId} (slot ${targetPlayerIndex}, initiator: ${isInitiator})`);
            const pc = new RTCPeerConnection(RTC_CONFIG);

            // Create dedicated audio element for this remote peer
            let audioEl = document.getElementById(`audio-remote-${targetId}`);
            if (!audioEl) {
                audioEl = document.createElement('audio');
                audioEl.id = `audio-remote-${targetId}`;
                audioEl.className = 'remote-voice-audio';
                audioEl.autoplay = true;
                audioEl.playsInline = true;
                audioEl.style.display = 'none';
                document.body.appendChild(audioEl);
            }

            const peerObj = {
                pc,
                targetPlayerIndex,
                audioEl,
                stream: null
            };
            this.peers.set(targetId, peerObj);

            // If we already have local stream, attach tracks
            if (this.localStream) {
                this.addLocalStreamToPeer(pc);
            }

            // Handle ICE candidate generation
            pc.onicecandidate = (event) => {
                if (event.candidate && this.socket) {
                    this.socket.emit('voice_signal', {
                        targetId: targetId,
                        signal: { candidate: event.candidate }
                    });
                }
            };

            // Handle incoming remote audio stream
            pc.ontrack = (event) => {
                console.log(`[Voice] Received remote audio stream from peer ${targetId}`);
                const stream = event.streams[0];
                peerObj.stream = stream;
                audioEl.srcObject = stream;
                const playPromise = audioEl.play();
                if (playPromise !== undefined) {
                    playPromise.catch(e => {
                        console.log('[Voice] Remote audio autoplay waiting for user interaction');
                    });
                }

                // Attach VAD to remote stream so their card speaks visually when voice arrives
                this.attachRemoteVAD(stream, targetPlayerIndex);
            };

            // If initiator, create and send offer
            if (isInitiator) {
                try {
                    const offer = await pc.createOffer({
                        offerToReceiveAudio: true
                    });
                    await pc.setLocalDescription(offer);
                    if (this.socket) {
                        this.socket.emit('voice_signal', {
                            targetId: targetId,
                            signal: { description: pc.localDescription }
                        });
                    }
                } catch (err) {
                    console.error('[Voice] Error creating offer:', err);
                }
            }

            return peerObj;
        }

        // Handle incoming WebRTC signaling message
        async handleIncomingSignal(fromId, playerIndex, signal) {
            let peer = this.peers.get(fromId);
            if (!peer) {
                peer = await this.createPeer(fromId, playerIndex, false);
            }
            const pc = peer.pc;

            try {
                if (signal.description) {
                    const desc = new RTCSessionDescription(signal.description);
                    await pc.setRemoteDescription(desc);

                    if (desc.type === 'offer') {
                        if (this.localStream) {
                            this.addLocalStreamToPeer(pc);
                        }
                        const answer = await pc.createAnswer();
                        await pc.setLocalDescription(answer);
                        if (this.socket) {
                            this.socket.emit('voice_signal', {
                                targetId: fromId,
                                signal: { description: pc.localDescription }
                            });
                        }
                    }
                } else if (signal.candidate) {
                    await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
                }
            } catch (err) {
                console.error(`[Voice] Error handling voice signal from ${fromId}:`, err);
            }
        }

        // Remove Peer
        removePeer(targetId) {
            const peer = this.peers.get(targetId);
            if (peer) {
                if (peer.pc) peer.pc.close();
                if (peer.audioEl) peer.audioEl.remove();
                this.peers.delete(targetId);
                console.log(`[Voice] Removed peer ${targetId}`);
            }
        }

        // Local Voice Activity Detection (VAD)
        startLocalVAD() {
            try {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                if (!this.audioCtx) this.audioCtx = new AudioContext();
                if (this.audioCtx.state === 'suspended') this.audioCtx.resume();

                if (!this.localStream) return;

                if (this.localSource) {
                    try { this.localSource.disconnect(); } catch (e) {}
                }

                this.localSource = this.audioCtx.createMediaStreamSource(this.localStream);
                this.localAnalyser = this.audioCtx.createAnalyser();
                this.localAnalyser.fftSize = 256;
                this.localAnalyser.smoothingTimeConstant = 0.3;
                this.localSource.connect(this.localAnalyser);

                // Setup loopback gain for self-test (default 0 = muted)
                if (!this.loopbackGain) {
                    this.loopbackGain = this.audioCtx.createGain();
                    this.loopbackGain.gain.value = this.loopbackEnabled ? 1.0 : 0;
                    this.loopbackGain.connect(this.audioCtx.destination);
                }
                this.localAnalyser.connect(this.loopbackGain);

                const dataArray = new Uint8Array(this.localAnalyser.frequencyBinCount);
                let wasSpeaking = false;
                let silenceTicks = 0;

                if (this.vadInterval) clearInterval(this.vadInterval);

                this.vadInterval = setInterval(() => {
                    if (!this.isMicActive || !this.localStream) {
                        if (wasSpeaking) {
                            wasSpeaking = false;
                            const myIdx = (this.getMyPlayerIndex) ? this.getMyPlayerIndex() : 0;
                            if (this.onSpeakingChange) this.onSpeakingChange(myIdx, false);
                        }
                        return;
                    }

                    this.localAnalyser.getByteFrequencyData(dataArray);
                    let sum = 0;
                    for (let i = 0; i < dataArray.length; i++) {
                        sum += dataArray[i];
                    }
                    const avg = sum / dataArray.length;

                    // Speaking threshold (average frequency volume > 15)
                    const isSpeakingNow = (avg > 15);

                    if (isSpeakingNow) {
                        silenceTicks = 0;
                        if (!wasSpeaking) {
                            wasSpeaking = true;
                            const myIdx = (this.getMyPlayerIndex) ? this.getMyPlayerIndex() : 0;
                            if (this.onSpeakingChange) this.onSpeakingChange(myIdx, true);
                            if (this.socket && this.socket.connected) {
                                this.socket.emit('voice_speaking', { speaking: true });
                            }
                        }
                    } else {
                        if (wasSpeaking) {
                            silenceTicks++;
                            if (silenceTicks >= 5) { // ~350ms of quiet before turning off
                                wasSpeaking = false;
                                const myIdx = (this.getMyPlayerIndex) ? this.getMyPlayerIndex() : 0;
                                if (this.onSpeakingChange) this.onSpeakingChange(myIdx, false);
                                if (this.socket && this.socket.connected) {
                                    this.socket.emit('voice_speaking', { speaking: false });
                                }
                            }
                        }
                    }
                }, 70);
            } catch (err) {
                console.warn('[Voice] Local VAD initialization warning:', err);
            }
        }

        // Remote Voice Activity Detection
        attachRemoteVAD(stream, playerIndex) {
            try {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                if (!this.audioCtx) this.audioCtx = new AudioContext();
                if (this.audioCtx.state === 'suspended') this.audioCtx.resume();

                const source = this.audioCtx.createMediaStreamSource(stream);
                const analyser = this.audioCtx.createAnalyser();
                analyser.fftSize = 256;
                analyser.smoothingTimeConstant = 0.3;
                source.connect(analyser);

                const dataArray = new Uint8Array(analyser.frequencyBinCount);
                let wasSpeaking = false;
                let silenceTicks = 0;

                const interval = setInterval(() => {
                    if (!stream.active) {
                        clearInterval(interval);
                        if (this.onSpeakingChange) this.onSpeakingChange(playerIndex, false);
                        return;
                    }

                    analyser.getByteFrequencyData(dataArray);
                    let sum = 0;
                    for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
                    const avg = sum / dataArray.length;

                    if (avg > 15) {
                        silenceTicks = 0;
                        if (!wasSpeaking) {
                            wasSpeaking = true;
                            if (this.onSpeakingChange) this.onSpeakingChange(playerIndex, true);
                        }
                    } else {
                        if (wasSpeaking) {
                            silenceTicks++;
                            if (silenceTicks >= 5) {
                                wasSpeaking = false;
                                if (this.onSpeakingChange) this.onSpeakingChange(playerIndex, false);
                            }
                        }
                    }
                }, 80);
            } catch (e) {
                console.warn('[Voice] Remote VAD setup error:', e);
            }
        }

        // Toggle Self-Test / Loopback (allows player to hear themselves to test microphone)
        toggleSelfTest() {
            this.loopbackEnabled = !this.loopbackEnabled;
            if (this.loopbackGain) {
                this.loopbackGain.gain.value = this.loopbackEnabled ? 1.0 : 0;
            }
            if (this.loopbackEnabled) {
                this.onToast('🎧 تم تفعيل فحص الصوت: يمكنك الآن سماع صوتك عبر السماعات!');
            } else {
                this.onToast('🎧 تم إيقاف فحص الصوت.');
            }
            return this.loopbackEnabled;
        }

        // Cleanup on leaving room
        cleanup() {
            this.stopMic();
            this.peers.forEach((p, id) => this.removePeer(id));
            this.peers.clear();
        }
    }

    window.VoiceChat = new VoiceChatManager();
})();
