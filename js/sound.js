/**
 * Cờ Úp - Sound System
 * 
 * Procedural audio using Web Audio API
 * No external audio files needed - all sounds are synthesized
 */
window.CoUp = window.CoUp || {};

window.CoUp.Sound = (function () {
    'use strict';

    var audioCtx = null;
    var enabled = true;
    var volume = 0.5;

    function getCtx() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        return audioCtx;
    }

    function createNoise(ctx, duration) {
        var bufferSize = Math.floor(ctx.sampleRate * duration);
        var buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        var data = buffer.getChannelData(0);
        for (var i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        var source = ctx.createBufferSource();
        source.buffer = buffer;
        return source;
    }

    /**
     * Flip sound - swoosh/card flip
     */
    function playFlip() {
        if (!enabled) return;
        var ctx = getCtx();
        var t = ctx.currentTime;

        var noise = createNoise(ctx, 0.18);
        var filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(4000, t);
        filter.frequency.exponentialRampToValueAtTime(600, t + 0.18);
        filter.Q.value = 0.8;

        var gain = ctx.createGain();
        gain.gain.setValueAtTime(volume * 0.25, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        noise.start(t);
        noise.stop(t + 0.18);
    }

    /**
     * Move sound - soft tock
     */
    function playMove() {
        if (!enabled) return;
        var ctx = getCtx();
        var t = ctx.currentTime;

        var osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, t);
        osc.frequency.exponentialRampToValueAtTime(350, t + 0.08);

        var gain = ctx.createGain();
        gain.gain.setValueAtTime(volume * 0.15, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.1);
    }

    /**
     * Select sound - light click
     */
    function playSelect() {
        if (!enabled) return;
        var ctx = getCtx();
        var t = ctx.currentTime;

        var osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, t);
        osc.frequency.exponentialRampToValueAtTime(800, t + 0.05);

        var gain = ctx.createGain();
        gain.gain.setValueAtTime(volume * 0.1, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.06);
    }

    /**
     * Capture sound - strong clash/impact
     */
    function playCapture() {
        if (!enabled) return;
        var ctx = getCtx();
        var t = ctx.currentTime;

        // Impact noise burst
        var noise = createNoise(ctx, 0.25);
        var filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(3000, t);
        filter.frequency.exponentialRampToValueAtTime(100, t + 0.25);

        var gainN = ctx.createGain();
        gainN.gain.setValueAtTime(volume * 0.35, t);
        gainN.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

        noise.connect(filter);
        filter.connect(gainN);
        gainN.connect(ctx.destination);
        noise.start(t);
        noise.stop(t + 0.25);

        // Low thud
        var osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(180, t);
        osc.frequency.exponentialRampToValueAtTime(50, t + 0.2);

        var gainO = ctx.createGain();
        gainO.gain.setValueAtTime(volume * 0.3, t);
        gainO.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

        osc.connect(gainO);
        gainO.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.2);
    }

    /**
     * CANNON fire - loud explosion BOOM 💥
     */
    function playCannon() {
        if (!enabled) return;
        var ctx = getCtx();
        var t = ctx.currentTime;

        // Main explosion noise
        var noise = createNoise(ctx, 0.9);
        var filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(6000, t);
        filter.frequency.exponentialRampToValueAtTime(40, t + 0.7);

        // Distortion for grit
        var distortion = ctx.createWaveShaper();
        var curve = new Float32Array(256);
        for (var i = 0; i < 256; i++) {
            var x = (i * 2) / 256 - 1;
            curve[i] = (Math.PI + 150 * x) / (Math.PI + 150 * Math.abs(x));
        }
        distortion.curve = curve;
        distortion.oversample = '4x';

        var gainN = ctx.createGain();
        gainN.gain.setValueAtTime(volume * 0.55, t);
        gainN.gain.exponentialRampToValueAtTime(0.001, t + 0.9);

        noise.connect(filter);
        filter.connect(distortion);
        distortion.connect(gainN);
        gainN.connect(ctx.destination);
        noise.start(t);
        noise.stop(t + 0.9);

        // Sub-bass rumble
        var bass = ctx.createOscillator();
        bass.type = 'sine';
        bass.frequency.setValueAtTime(70, t);
        bass.frequency.exponentialRampToValueAtTime(15, t + 0.7);

        var gainB = ctx.createGain();
        gainB.gain.setValueAtTime(volume * 0.5, t);
        gainB.gain.exponentialRampToValueAtTime(0.001, t + 0.7);

        bass.connect(gainB);
        gainB.connect(ctx.destination);
        bass.start(t);
        bass.stop(t + 0.7);

        // Initial crack
        var crack = ctx.createOscillator();
        crack.type = 'sawtooth';
        crack.frequency.setValueAtTime(400, t);
        crack.frequency.exponentialRampToValueAtTime(40, t + 0.08);

        var gainC = ctx.createGain();
        gainC.gain.setValueAtTime(volume * 0.45, t);
        gainC.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

        crack.connect(gainC);
        gainC.connect(ctx.destination);
        crack.start(t);
        crack.stop(t + 0.1);

        // Secondary pop
        var pop = ctx.createOscillator();
        pop.type = 'square';
        pop.frequency.setValueAtTime(200, t + 0.05);
        pop.frequency.exponentialRampToValueAtTime(30, t + 0.15);

        var gainP = ctx.createGain();
        gainP.gain.setValueAtTime(0, t);
        gainP.gain.linearRampToValueAtTime(volume * 0.3, t + 0.05);
        gainP.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

        pop.connect(gainP);
        gainP.connect(ctx.destination);
        pop.start(t);
        pop.stop(t + 0.2);
    }

    /**
     * General captured - gong/bell sound
     */
    function playGeneralCaptured() {
        if (!enabled) return;
        var ctx = getCtx();
        var t = ctx.currentTime;

        var freqs = [523, 784, 1047, 1318];
        freqs.forEach(function (freq, i) {
            var osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = freq;

            var gain = ctx.createGain();
            gain.gain.setValueAtTime(volume * 0.25 / (i + 1), t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 2.0);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(t);
            osc.stop(t + 2.0);
        });

        // Low gong
        var gong = ctx.createOscillator();
        gong.type = 'triangle';
        gong.frequency.setValueAtTime(220, t);
        gong.frequency.exponentialRampToValueAtTime(180, t + 1.5);

        var gGain = ctx.createGain();
        gGain.gain.setValueAtTime(volume * 0.3, t);
        gGain.gain.exponentialRampToValueAtTime(0.001, t + 1.8);

        gong.connect(gGain);
        gGain.connect(ctx.destination);
        gong.start(t);
        gong.stop(t + 1.8);
    }

    /**
     * Victory fanfare - ascending triumphant notes
     */
    function playVictory() {
        if (!enabled) return;
        var ctx = getCtx();
        var t = ctx.currentTime;

        var notes = [523, 659, 784, 880, 1047]; // C5 E5 G5 A5 C6
        notes.forEach(function (freq, i) {
            var osc = ctx.createOscillator();
            osc.type = 'triangle';
            osc.frequency.value = freq;

            var gain = ctx.createGain();
            var start = t + i * 0.18;
            gain.gain.setValueAtTime(0, start);
            gain.gain.linearRampToValueAtTime(volume * 0.25, start + 0.04);
            gain.gain.setValueAtTime(volume * 0.25, start + 0.12);
            gain.gain.exponentialRampToValueAtTime(0.001, start + 0.5);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(start);
            osc.stop(start + 0.5);
        });

        // Final chord
        var chordFreqs = [523, 659, 784, 1047];
        var chordStart = t + notes.length * 0.18;
        chordFreqs.forEach(function (freq) {
            var osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = freq;

            var gain = ctx.createGain();
            gain.gain.setValueAtTime(0, chordStart);
            gain.gain.linearRampToValueAtTime(volume * 0.15, chordStart + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, chordStart + 1.2);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(chordStart);
            osc.stop(chordStart + 1.2);
        });
    }

    /**
     * Invalid move buzz
     */
    function playInvalid() {
        if (!enabled) return;
        var ctx = getCtx();
        var t = ctx.currentTime;

        var osc = ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.value = 180;

        var gain = ctx.createGain();
        gain.gain.setValueAtTime(volume * 0.1, t);
        gain.gain.setValueAtTime(0, t + 0.05);
        gain.gain.setValueAtTime(volume * 0.1, t + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.15);
    }

    /**
     * Start game chime
     */
    function playGameStart() {
        if (!enabled) return;
        var ctx = getCtx();
        var t = ctx.currentTime;

        var notes = [784, 988, 1175]; // G5 B5 D6
        notes.forEach(function (freq, i) {
            var osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = freq;

            var gain = ctx.createGain();
            var start = t + i * 0.12;
            gain.gain.setValueAtTime(0, start);
            gain.gain.linearRampToValueAtTime(volume * 0.2, start + 0.03);
            gain.gain.exponentialRampToValueAtTime(0.001, start + 0.4);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(start);
            osc.stop(start + 0.4);
        });
    }

    /**
     * Check sound - tense gong / warning chime (Chiếu tướng!)
     */
    function playCheck() {
        if (!enabled) return;
        var ctx = getCtx();
        var t = ctx.currentTime;

        var osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(520, t);
        osc.frequency.exponentialRampToValueAtTime(320, t + 0.35);

        var gain = ctx.createGain();
        gain.gain.setValueAtTime(volume * 0.4, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.45);
    }

    function setEnabled(val) { enabled = !!val; }
    function isEnabled() { return enabled; }
    function setVolume(val) { volume = Math.max(0, Math.min(1, val)); }
    function getVolume() { return volume; }

    return {
        playFlip: playFlip,
        playMove: playMove,
        playSelect: playSelect,
        playCapture: playCapture,
        playCannon: playCannon,
        playGeneralCaptured: playGeneralCaptured,
        playVictory: playVictory,
        playInvalid: playInvalid,
        playGameStart: playGameStart,
        playCheck: playCheck,
        setEnabled: setEnabled,
        isEnabled: isEnabled,
        setVolume: setVolume,
        getVolume: getVolume
    };
})();
