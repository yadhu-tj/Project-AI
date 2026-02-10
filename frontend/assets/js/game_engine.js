const socket = io('http://localhost:5000');
const world = document.getElementById('world');
const hero = document.getElementById('hero');
const statusText = document.getElementById('status-text');

// Game State
let isRunning = false;
let currentZone = "CENTER";
let isTurning = false; // LOCK to prevent spamming
let currentSpeed = 0;

// Build the World
const segments = [];
for (let i = 0; i < 20; i++) createSegment(i * -800);

function createSegment(z) {
    const el = document.createElement('div');
    el.className = 'wall-segment';
    el.style.transform = `translateZ(${z}px)`;

    const left = document.createElement('div'); left.className = 'face-left';
    const right = document.createElement('div'); right.className = 'face-right';
    const floor = document.createElement('div'); floor.className = 'face-floor';

    el.appendChild(left); el.appendChild(right); el.appendChild(floor);
    world.appendChild(el);
    segments.push({ el, z });
}

// =============================================================
// SOCKET — Connection Reliability
// =============================================================

socket.on('connect', () => {
    statusText.style.color = '#00ff00';
    statusText.innerText = 'CONNECTED';
    console.log('[Aero-Run] Connected to server.');
});

socket.on('disconnect', () => {
    statusText.style.color = '#ff0055';
    statusText.innerText = 'DISCONNECTED — RECONNECTING...';
    hero.classList.remove('running');
    currentSpeed = 0;
    console.warn('[Aero-Run] Disconnected from server.');
});

socket.on('connect_error', (err) => {
    statusText.style.color = '#ff0055';
    statusText.innerText = 'CONNECTION ERROR';
    console.error('[Aero-Run] Connection error:', err.message);
});

// =============================================================
// SOCKET — Game Update Listener
// =============================================================

socket.on('game_update', (data) => {

    // --- CALIBRATION STATES ---
    if (data.state === 'CALIBRATING') {
        statusText.style.color = '#ffaa00';
        statusText.innerText = `CALIBRATING... ${data.progress || 0}%`;
        hero.classList.remove('running');
        currentSpeed = 0;
        return;
    }

    if (data.state === 'CALIBRATED') {
        statusText.style.color = '#00ff00';
        statusText.innerText = 'CALIBRATED ✓ — START WALKING!';
        return;
    }

    // --- CAMERA ERROR STATES ---
    if (data.state === 'CAMERA_ERROR') {
        statusText.style.color = '#ff0055';
        statusText.innerText = '⚠ CAMERA ERROR — RECONNECTING...';
        hero.classList.remove('running');
        currentSpeed = 0;
        return;
    }

    if (data.state === 'CAMERA_RECOVERED') {
        statusText.style.color = '#00ff00';
        statusText.innerText = 'CAMERA RECOVERED ✓';
        return;
    }

    // --- NORMAL GAMEPLAY ---
    if (data.state === "WALKING") {
        statusText.style.color = '#00ff00';
        hero.classList.add('running');
        if (!isTurning) currentSpeed += (25 - currentSpeed) * 0.1;
    } else {
        statusText.style.color = '#888888';
        hero.classList.remove('running');
        currentSpeed *= 0.9;
    }
    statusText.innerText = `STATE: ${data.state} | ZONE: ${data.zone}`;

    // TURN LOGIC
    if (!isTurning && Math.abs(currentSpeed) > 5) {
        if (data.zone === "LEFT") triggerTurn("LEFT");
        else if (data.zone === "RIGHT") triggerTurn("RIGHT");
    }
});

// =============================================================
// TURN EVENT
// =============================================================

function triggerTurn(dir) {
    isTurning = true;
    const targetRot = (dir === "LEFT") ? -90 : 90;

    // A. Visuals: Rotate the World 90 Degrees
    gsap.to(world, {
        rotationY: targetRot,
        duration: 0.5,
        ease: "power2.inOut",
        onComplete: resetWorld
    });

    // B. Hero Animation: Lean into it
    hero.style.transition = "transform 0.5s ease";
    hero.style.transform = `rotateY(${targetRot * 0.5}deg)`;
}

// =============================================================
// RESET (THE MAGIC TRICK FIX)
// =============================================================

function resetWorld() {
    gsap.set(world, { rotationY: 0 });

    hero.style.transition = "transform 0.2s ease";
    hero.style.transform = `rotateY(0deg)`;

    segments.forEach((seg, index) => {
        seg.z = index * -800;
        seg.el.className = 'wall-segment';
        seg.el.style.transform = `translateZ(${seg.z}px)`;
    });

    isTurning = false;
}

// =============================================================
// GAME LOOP
// =============================================================

function update() {
    if (currentSpeed > 0.1 && !isTurning) {
        segments.forEach(seg => {
            seg.z += currentSpeed;
            if (seg.z > 600) {
                seg.z -= (segments.length * 800);

                seg.el.className = 'wall-segment';

                // 20% Chance for New Junction
                if (Math.random() > 0.8) {
                    seg.el.classList.add(Math.random() > 0.5 ? 'turn-left' : 'turn-right');
                }
            }
            seg.el.style.transform = `translateZ(${seg.z}px)`;
        });
    }
    requestAnimationFrame(update);
}

update();