/**
 * Cờ Úp - Online Multiplayer Engine (WebRTC P2P via PeerJS)
 * 
 * Enables 2 players on 2 different devices to play together seamlessly:
 * - Host creates a room -> gets room code and direct join link (?room=CODE)
 * - Guest enters room code or clicks shared link to connect
 * - Direct peer-to-peer data channel for zero-latency move synchronization
 */
window.CoUp = window.CoUp || {};

window.CoUp.Multiplayer = (function () {
    'use strict';

    var peer = null;
    var conn = null;
    var isHost = false;
    var roomCode = null;
    var isConnected = false;
    var onEventCallback = null;

    // Prefix to avoid collisions on public PeerJS cloud server
    var ROOM_PREFIX = 'coup-vn-';

    function init(eventCallback) {
        onEventCallback = eventCallback;
        checkUrlForRoomCode();
    }

    /**
     * Generate a short human-friendly 4-digit code (e.g. 7824)
     */
    function generateShortCode() {
        return Math.floor(1000 + Math.random() * 9000).toString();
    }

    /**
     * Create a room as Host
     */
    function createRoom(callback) {
        cleanup();

        roomCode = generateShortCode();
        var fullPeerId = ROOM_PREFIX + roomCode;

        try {
            peer = new Peer(fullPeerId, {
                debug: 1,
                config: {
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' },
                        { urls: 'stun:stun2.l.google.com:19302' }
                    ]
                }
            });
        } catch (e) {
            console.error('[Multiplayer] Failed to initialize Peer:', e);
            if (callback) callback(false, 'Không thể kết nối máy chủ phòng');
            return;
        }

        peer.on('open', function (id) {
            isHost = true;
            if (callback) callback(true, roomCode);
            dispatch('room_created', { roomCode: roomCode, isHost: true });
        });

        peer.on('connection', function (connection) {
            conn = connection;
            setupConnectionHandlers();
        });

        peer.on('error', function (err) {
            console.warn('[Multiplayer] Peer error:', err);
            if (err.type === 'unavailable-id') {
                // Retry with new ID if collision
                createRoom(callback);
            } else {
                dispatch('error', { message: 'Lỗi kết nối phòng: ' + err.type });
            }
        });
    }

    /**
     * Join an existing room as Guest
     */
    function joinRoom(code, callback) {
        cleanup();

        code = code.trim().toUpperCase().replace(/[^0-9]/g, '');
        if (!code || code.length < 4) {
            if (callback) callback(false, 'Mã phòng phải gồm 4 chữ số');
            return;
        }

        roomCode = code;
        var hostPeerId = ROOM_PREFIX + code;

        try {
            peer = new Peer({
                debug: 1,
                config: {
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' },
                        { urls: 'stun:stun2.l.google.com:19302' }
                    ]
                }
            });
        } catch (e) {
            if (callback) callback(false, 'Lỗi kết nối mạng');
            return;
        }

        peer.on('open', function () {
            isHost = false;
            conn = peer.connect(hostPeerId, { reliable: true });
            setupConnectionHandlers(callback);
        });

        peer.on('error', function (err) {
            console.warn('[Multiplayer] Join error:', err);
            if (callback) callback(false, 'Không tìm thấy phòng hoặc phòng đã đầy');
            dispatch('error', { message: 'Không thể kết nối tới phòng ' + code });
        });
    }

    function setupConnectionHandlers(joinCallback) {
        if (!conn) return;

        conn.on('open', function () {
            isConnected = true;
            if (joinCallback) joinCallback(true, roomCode);
            dispatch('connected', { isHost: isHost, roomCode: roomCode });
        });

        conn.on('data', function (data) {
            if (data && data.type) {
                dispatch(data.type, data.payload);
            }
        });

        conn.on('close', function () {
            isConnected = false;
            dispatch('disconnected', { message: 'Đối thủ đã ngắt kết nối' });
        });

        conn.on('error', function (err) {
            dispatch('error', { message: 'Lỗi truyền nhận dữ liệu' });
        });
    }

    /**
     * Send an event payload to the remote peer
     */
    function send(type, payload) {
        if (conn && isConnected) {
            try {
                conn.send({ type: type, payload: payload });
            } catch (e) {
                console.error('[Multiplayer] Failed to send message:', e);
            }
        }
    }

    function cleanup() {
        if (conn) {
            try { conn.close(); } catch (e) {}
            conn = null;
        }
        if (peer) {
            try { peer.destroy(); } catch (e) {}
            peer = null;
        }
        isConnected = false;
        isHost = false;
        roomCode = null;
    }

    function dispatch(type, payload) {
        if (onEventCallback) {
            onEventCallback(type, payload);
        }
    }

    /**
     * Check if URL has ?room=1234
     */
    function checkUrlForRoomCode() {
        try {
            var params = new URLSearchParams(window.location.search);
            var roomParam = params.get('room');
            if (roomParam) {
                setTimeout(function () {
                    dispatch('url_room_detected', { roomCode: roomParam.replace(/[^0-9]/g, '') });
                }, 500);
            }
        } catch (e) {}
    }

    function getShareableUrl(code) {
        var base = window.location.origin + window.location.pathname;
        return base + '?room=' + code;
    }

    return {
        init: init,
        createRoom: createRoom,
        joinRoom: joinRoom,
        send: send,
        cleanup: cleanup,
        getShareableUrl: getShareableUrl,
        isHost: function () { return isHost; },
        isConnected: function () { return isConnected; },
        getRoomCode: function () { return roomCode; }
    };
})();
