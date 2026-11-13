// WebRTC Peer-to-Peer Voice Chat for LAMA DUDO (لاما دودو الملكية)
// Streams microphone audio in real time to the other player's speakers/device.

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

            // Map: socketId -> { pc, targetPlayerIndex, pendingCandidates, audioEl }
            this.peers = new Map();

            // AudioContext for speaker output and speaking detection
            this.audioCtx = null;
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

                // Status updates (peer mic active/muted)
                this.socket.on('voice_status_update', ({ socketId, playerIndex, active }) => {
                    console.log(`[Voice] Peer ${socketId} (slot ${playerIndex}) mic: ${active ? 'ON' : 'OFF'}`);
                });

                // Speaking update (avatar glowing ring)
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

            // Resume audio output on any user click/touch
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

        // Toggle Microphone
        async toggleMic() {
            if (!this.isMicActive) {
                return await this.startMic();
            } else {
                this.stopMic();
                return false;
            }
        }

        // Start Microphone & Broadcast to other players
        async startMic() {
            try {
                if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                    throw new Error('المتصفح لا يدعم الوصول للمايكروفون.');
                }

                // Capture local mic if not already captured
                if (!this.localStream || this.localStream.getAudioTracks().length === 0) {
                    this.localStream = await navigator.mediaDevices.getUserMedia({
                        audio: {
                            echoCancellation: true,
                            noiseSuppression: true,
                            autoGainControl: true
                        },
                        video: false
                    });
                } else {
                    this.localStream.getAudioTracks().forEach(t => { t.enabled = true; });
                }

                this.isMicActive = true;

                // Push audio track to all peer connections and renegotiate so the other player receives sound
                for (const [peerId, peer] of this.peers.entries()) {
                    this.attachLocalTrackToPeer(peer.pc);
                    await this.renegotiatePeer(peerId, peer.pc);
                }

                // Start local speaking indicator detection
                this.startLocalVAD();

                // Notify room
                if (this.socket && this.socket.connected) {
                    this.socket.emit('voice_status', { active: true });
                }

                if (this.onMicStateChange) this.onMicStateChange(true);
                this.onToast('🎙️ المايك شغال! صوتك الآن مسموع عند اللاعب الآخر.');
                return true;
            } catch (err) {
                console.error('[Voice] Error starting mic:', err);
                this.isMicActive = false;
                if (this.onMicStateChange) this.onMicStateChange(false);
                this.onToast('⚠️ تعذر تشغيل المايك. يرجى السماح بالإذن في المتصفح.');
                return false;
            }
        }

        // Stop Microphone (Mute)
        stopMic() {
            this.isMicActive = false;

            if (this.localStream) {
                this.localStream.getAudioTracks().forEach(t => {
                    t.enabled = false;
                });
            }

            if (this.vadInterval) {
                clearInterval(this.vadInterval);
                this.vadInterval = null;
            }

            const myIdx = (this.getMyPlayerIndex) ? this.getMyPlayerIndex() : 0;
            if (this.onSpeakingChange) {
                this.onSpeakingChange(myIdx, false);
            }

            if (this.socket && this.socket.connected) {
                this.socket.emit('voice_speaking', { speaking: false });
                this.socket.emit('voice_status', { active: false });
            }

            if (this.onMicStateChange) this.onMicStateChange(false);
            this.onToast('🔇 تم كتم المايك.');
        }

        // Attach local track to a peer connection
        attachLocalTrackToPeer(pc) {
            if (!this.localStream) return;
            const audioTrack = this.localStream.getAudioTracks()[0];
            if (!audioTrack) return;

            const senders = pc.getSenders();
            const audioSender = senders.find(s => s.track && s.track.kind === 'audio');
            if (audioSender) {
                audioSender.replaceTrack(audioTrack).catch(e => console.warn('[Voice] replaceTrack:', e));
            } else {
                pc.addTrack(audioTrack, this.localStream);
            }
        }

        // Renegotiate peer connection when new track is added
        async renegotiatePeer(targetId, pc) {
            try {
                const offer = await pc.createOffer({ offerToReceiveAudio: true });
                await pc.setLocalDescription(offer);
                if (this.socket && this.socket.connected) {
                    this.socket.emit('voice_signal', {
                        targetId: targetId,
                        signal: { description: pc.localDescription }
                    });
                }
            } catch (err) {
                console.error(`[Voice] Error renegotiating with ${targetId}:`, err);
            }
        }

        // Called on room_update with the active players array
        updatePeers(players) {
            if (!this.socket || !this.socket.id) return;
            this.roomPlayers = players || [];

            const currentPeerIds = new Set();

            players.forEach((p, idx) => {
                if (!p || p.isBot || !p.id) return;
                if (p.id === this.socket.id) return; // Skip myself

                currentPeerIds.add(p.id);

                if (!this.peers.has(p.id)) {
                    // Lower socket ID initiates offer
                    const isInitiator = (this.socket.id < p.id);
                    this.createPeer(p.id, idx, isInitiator);
                } else {
                    this.peers.get(p.id).targetPlayerIndex = idx;
                }
            });

            // Clean up left peers
            this.peers.forEach((peer, peerId) => {
                if (!currentPeerIds.has(peerId)) {
                    this.removePeer(peerId);
                }
            });
        }

        // Create RTCPeerConnection for a remote peer
        async createPeer(targetId, targetPlayerIndex, isInitiator) {
            console.log(`[Voice] Creating RTC connection for player ${targetPlayerIndex} (${targetId}), initiator: ${isInitiator}`);
            const pc = new RTCPeerConnection(RTC_CONFIG);

            const peerObj = {
                pc,
                targetPlayerIndex,
                pendingCandidates: [],
                stream: null
            };
            this.peers.set(targetId, peerObj);

            // Add bidirectional audio transceiver so audio is ready to flow immediately
            if (pc.addTransceiver) {
                pc.addTransceiver('audio', { direction: 'sendrecv' });
            }

            // If we already have local mic captured, attach track
            if (this.localStream) {
                this.attachLocalTrackToPeer(pc);
            }

            // ICE Candidate Generation
            pc.onicecandidate = (event) => {
                if (event.candidate && this.socket && this.socket.connected) {
                    this.socket.emit('voice_signal', {
                        targetId: targetId,
                        signal: { candidate: event.candidate }
                    });
                }
            };

            // INCOMING AUDIO TRACK FROM THE OTHER PLAYER
            pc.ontrack = (event) => {
                console.log(`[Voice] 🔊 RECEIVED REMOTE AUDIO TRACK from player ${targetPlayerIndex}! Playing through speakers...`);
                const remoteStream = event.streams[0] || new MediaStream([event.track]);
                peerObj.stream = remoteStream;

                // 1. Web Audio API Destination: Streams direct to hardware speakers
                this.playStreamToSpeakers(remoteStream);

                // 2. HTML Audio element backup
                let audioEl = document.getElementById(`audio-remote-${targetId}`);
                if (!audioEl) {
                    audioEl = document.createElement('audio');
                    audioEl.id = `audio-remote-${targetId}`;
                    audioEl.className = 'remote-voice-audio';
                    audioEl.autoplay = true;
                    audioEl.playsInline = true;
                    audioEl.style.position = 'fixed';
                    audioEl.style.left = '-9999px';
                    document.body.appendChild(audioEl);
                }
                audioEl.srcObject = remoteStream;
                audioEl.volume = 1.0;
                audioEl.play().catch(() => {});

                // Remote Voice Speaking Ring
                this.attachRemoteVAD(remoteStream, targetPlayerIndex);
            };

            // If initiator, send initial offer
            if (isInitiator) {
                try {
                    const offer = await pc.createOffer({ offerToReceiveAudio: true });
                    await pc.setLocalDescription(offer);
                    if (this.socket && this.socket.connected) {
                        this.socket.emit('voice_signal', {
                            targetId: targetId,
                            signal: { description: pc.localDescription }
                        });
                    }
                } catch (err) {
                    console.error('[Voice] Initial offer error:', err);
                }
            }

            return peerObj;
        }

        // Direct hardware speaker output via Web Audio API
        playStreamToSpeakers(stream) {
            try {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                if (!this.audioCtx) this.audioCtx = new AudioContext();
                if (this.audioCtx.state === 'suspended') this.audioCtx.resume().catch(() => {});

                const source = this.audioCtx.createMediaStreamSource(stream);
                const gain = this.audioCtx.createGain();
                gain.gain.value = 1.0;
                source.connect(gain);
                gain.connect(this.audioCtx.destination);
                console.log('[Voice] Remote audio successfully connected to audioCtx.destination (speakers)');
            } catch (err) {
                console.warn('[Voice] playStreamToSpeakers error:', err);
            }
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

                    // Drain pending candidates
                    if (peer.pendingCandidates && peer.pendingCandidates.length > 0) {
                        for (const cand of peer.pendingCandidates) {
                            await pc.addIceCandidate(cand).catch(e => console.warn(e));
                        }
                        peer.pendingCandidates = [];
                    }

                    if (desc.type === 'offer') {
                        if (this.localStream) {
                            this.attachLocalTrackToPeer(pc);
                        }
                        const answer = await pc.createAnswer();
                        await pc.setLocalDescription(answer);
                        if (this.socket && this.socket.connected) {
                            this.socket.emit('voice_signal', {
                                targetId: fromId,
                                signal: { description: pc.localDescription }
                            });
                        }
                    }
                } else if (signal.candidate) {
                    const iceCand = new RTCIceCandidate(signal.candidate);
                    if (pc.remoteDescription && pc.remoteDescription.type) {
                        await pc.addIceCandidate(iceCand);
                    } else {
                        peer.pendingCandidates.push(iceCand);
                    }
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
                const el = document.getElementById(`audio-remote-${targetId}`);
                if (el) el.remove();
                this.peers.delete(targetId);
                console.log(`[Voice] Disconnected peer ${targetId}`);
            }
        }

        // Local Voice Activity Detection (lights up speaking ring when voice is active)
        startLocalVAD() {
            try {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                if (!this.audioCtx) this.audioCtx = new AudioContext();
                if (this.audioCtx.state === 'suspended') this.audioCtx.resume().catch(() => {});

                if (!this.localStream) return;

                const source = this.audioCtx.createMediaStreamSource(this.localStream);
                const analyser = this.audioCtx.createAnalyser();
                analyser.fftSize = 256;
                analyser.smoothingTimeConstant = 0.3;
                source.connect(analyser); // Analyser only, NOT connected to audioCtx.destination (no self echo!)

                const dataArray = new Uint8Array(analyser.frequencyBinCount);
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

                    analyser.getByteFrequencyData(dataArray);
                    let sum = 0;
                    for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
                    const avg = sum / dataArray.length;

                    const isSpeakingNow = (avg > 14);

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
                            if (silenceTicks >= 5) {
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
                console.warn('[Voice] Local VAD error:', err);
            }
        }

        // Remote Voice Activity Detection (lights up the other player's avatar when they talk)
        attachRemoteVAD(stream, playerIndex) {
            try {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                if (!this.audioCtx) this.audioCtx = new AudioContext();
                if (this.audioCtx.state === 'suspended') this.audioCtx.resume().catch(() => {});

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

                    if (avg > 14) {
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
                console.warn('[Voice] Remote VAD error:', e);
            }
        }

        // Cleanup
        cleanup() {
            this.stopMic();
            this.peers.forEach((p, id) => this.removePeer(id));
            this.peers.clear();
        }
    }

    window.VoiceChat = new VoiceChatManager();
})();
