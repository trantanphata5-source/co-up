/**
 * Cờ Úp - Visual Effects System
 * 
 * Canvas-based particle effects, screen shake, flash, and confetti
 */
window.CoUp = window.CoUp || {};

window.CoUp.Effects = (function () {
    'use strict';

    var canvas, ctx;
    var particles = [];
    var animFrameId = null;

    function init() {
        canvas = document.getElementById('effects-canvas');
        if (!canvas) return;
        ctx = canvas.getContext('2d');
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
    }

    function resizeCanvas() {
        if (!canvas) return;
        var rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * (window.devicePixelRatio || 1);
        canvas.height = rect.height * (window.devicePixelRatio || 1);
        ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
    }

    // --- Particle ---
    function Particle(x, y, color, size, speed, angle, life, gravity) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.size = size;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.life = life;
        this.maxLife = life;
        this.gravity = gravity || 0;
        this.rotation = Math.random() * Math.PI * 2;
        this.rotSpeed = (Math.random() - 0.5) * 0.2;
    }

    Particle.prototype.update = function () {
        this.x += this.vx;
        this.vy += this.gravity;
        this.y += this.vy;
        this.life--;
        this.vx *= 0.97;
        this.vy *= 0.97;
        this.rotation += this.rotSpeed;
    };

    Particle.prototype.draw = function (c) {
        var alpha = Math.max(0, this.life / this.maxLife);
        var sz = this.size * (0.5 + 0.5 * alpha);
        c.save();
        c.globalAlpha = alpha;
        c.translate(this.x, this.y);
        c.rotate(this.rotation);
        c.fillStyle = this.color;
        c.fillRect(-sz / 2, -sz / 2, sz, sz);
        c.restore();
    };

    Particle.prototype.isDead = function () { return this.life <= 0; };

    // --- Spawn particles ---
    function spawnParticles(x, y, colors, count, opts) {
        opts = opts || {};
        var speedMin = opts.speedMin || 2;
        var speedMax = opts.speedMax || 8;
        var sizeMin = opts.sizeMin || 2;
        var sizeMax = opts.sizeMax || 6;
        var lifeMin = opts.lifeMin || 20;
        var lifeMax = opts.lifeMax || 50;
        var gravity = opts.gravity !== undefined ? opts.gravity : 0.1;

        for (var i = 0; i < count; i++) {
            var angle = Math.random() * Math.PI * 2;
            var speed = speedMin + Math.random() * (speedMax - speedMin);
            var size = sizeMin + Math.random() * (sizeMax - sizeMin);
            var life = Math.floor(lifeMin + Math.random() * (lifeMax - lifeMin));
            var color = colors[Math.floor(Math.random() * colors.length)];
            particles.push(new Particle(x, y, color, size, speed, angle, life, gravity));
        }
        if (!animFrameId) animate();
    }

    // --- Animation loop ---
    function animate() {
        if (!ctx || !canvas) return;
        var w = canvas.width / (window.devicePixelRatio || 1);
        var h = canvas.height / (window.devicePixelRatio || 1);
        ctx.clearRect(0, 0, w, h);

        particles = particles.filter(function (p) { return !p.isDead(); });
        particles.forEach(function (p) {
            p.update();
            p.draw(ctx);
        });
        ctx.globalAlpha = 1;

        if (particles.length > 0) {
            animFrameId = requestAnimationFrame(animate);
        } else {
            animFrameId = null;
            ctx.clearRect(0, 0, w, h);
        }
    }

    // --- Get position relative to canvas ---
    function getCanvasPos(element) {
        if (!canvas) return { x: 0, y: 0 };
        var rect = element.getBoundingClientRect();
        var cRect = canvas.getBoundingClientRect();
        return {
            x: rect.left + rect.width / 2 - cRect.left,
            y: rect.top + rect.height / 2 - cRect.top
        };
    }

    // --- Effect: Regular capture explosion ---
    function explodeAt(element, color) {
        if (!canvas) return;
        var pos = getCanvasPos(element);
        var colors;
        if (color === 'red') {
            colors = ['#ff4444', '#ff8800', '#ffcc00', '#ff2222', '#ffaa44'];
        } else {
            colors = ['#4488ff', '#2266dd', '#88bbff', '#1144aa', '#66aaff'];
        }
        spawnParticles(pos.x, pos.y, colors, 35, {
            speedMin: 2, speedMax: 10,
            sizeMin: 3, sizeMax: 8,
            lifeMin: 20, lifeMax: 45,
            gravity: 0.15
        });
    }

    // --- Effect: Cannon explosion (much bigger!) ---
    function cannonExplosion(element) {
        if (!canvas) return;
        var pos = getCanvasPos(element);

        // Fire particles
        spawnParticles(pos.x, pos.y,
            ['#ff4400', '#ff8800', '#ffcc00', '#ff0000', '#fff', '#ff6600'],
            70,
            {
                speedMin: 3, speedMax: 14,
                sizeMin: 3, sizeMax: 12,
                lifeMin: 25, lifeMax: 60,
                gravity: 0.1
            }
        );

        // Smoke particles
        spawnParticles(pos.x, pos.y,
            ['#555', '#777', '#999', '#444', '#666'],
            25,
            {
                speedMin: 1, speedMax: 5,
                sizeMin: 8, sizeMax: 18,
                lifeMin: 40, lifeMax: 80,
                gravity: -0.04
            }
        );

        // Spark particles
        spawnParticles(pos.x, pos.y,
            ['#fff', '#ffee88', '#ffe044'],
            15,
            {
                speedMin: 6, speedMax: 18,
                sizeMin: 1, sizeMax: 3,
                lifeMin: 10, lifeMax: 25,
                gravity: 0.05
            }
        );
    }

    // --- Effect: Screen shake ---
    function screenShake(element, intensity, duration) {
        if (!element) return;
        intensity = intensity || 5;
        duration = duration || 300;
        var originalTransform = element.style.transform || '';
        var start = Date.now();

        function shake() {
            var elapsed = Date.now() - start;
            if (elapsed >= duration) {
                element.style.transform = originalTransform;
                return;
            }
            var decay = 1 - elapsed / duration;
            var dx = (Math.random() - 0.5) * intensity * 2 * decay;
            var dy = (Math.random() - 0.5) * intensity * 2 * decay;
            element.style.transform = 'translate(' + dx + 'px, ' + dy + 'px)';
            requestAnimationFrame(shake);
        }
        shake();
    }

    // --- Effect: Flash overlay on element ---
    function flash(element, color, duration) {
        if (!element) return;
        color = color || '#fff';
        duration = duration || 250;

        var overlay = document.createElement('div');
        overlay.style.cssText =
            'position:absolute;top:0;left:0;right:0;bottom:0;' +
            'background:' + color + ';opacity:0.6;pointer-events:none;' +
            'border-radius:inherit;z-index:10;';
        element.style.position = element.style.position || 'relative';
        element.appendChild(overlay);

        var anim = overlay.animate(
            [{ opacity: 0.6 }, { opacity: 0 }],
            { duration: duration, fill: 'forwards' }
        );
        anim.onfinish = function () { overlay.remove(); };
    }

    // --- Effect: Victory confetti ---
    function confetti() {
        if (!canvas) return;
        var w = canvas.width / (window.devicePixelRatio || 1);
        var colors = ['#ff0000', '#ffd700', '#00ff00', '#00aaff', '#ff00ff', '#ff8800', '#fff'];

        for (var wave = 0; wave < 6; wave++) {
            (function (w2, wave2) {
                setTimeout(function () {
                    var x = Math.random() * w2;
                    spawnParticles(x, -10, colors, 45, {
                        speedMin: 1, speedMax: 6,
                        sizeMin: 4, sizeMax: 10,
                        lifeMin: 80, lifeMax: 150,
                        gravity: 0.08
                    });
                }, wave2 * 250);
            })(w, wave);
        }
    }

    // --- Effect: Flip sparkle ---
    function flipSparkle(element) {
        if (!canvas) return;
        var pos = getCanvasPos(element);
        spawnParticles(pos.x, pos.y,
            ['#ffd700', '#ffee88', '#fff', '#ffe066'],
            12,
            {
                speedMin: 1, speedMax: 4,
                sizeMin: 2, sizeMax: 5,
                lifeMin: 15, lifeMax: 30,
                gravity: 0
            }
        );
    }

    return {
        init: init,
        explodeAt: explodeAt,
        cannonExplosion: cannonExplosion,
        screenShake: screenShake,
        flash: flash,
        confetti: confetti,
        flipSparkle: flipSparkle
    };
})();
