import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160/build/three.module.js";

/**
 * HolographicTutorial v4
 *
 * Stage 1 – WALK  : World + grid, walk animation ON, bottom HUD.
 * Stage 2 – LEAN  : Walk FROZEN. Screen edge glows react ONLY to real
 *                   telemetry (input.turn). Demo card shows static arrows.
 * Stage 3 – HANDS : Walk momentum ZEROED (arms still animate freely).
 *                   Demo card shown for 1.5 s then auto-hides.
 *                   No auto-pulsing, no top glow.
 * Spacebar progresses each stage.
 */
export class HolographicTutorial {

    constructor(scene, camera, input, onComplete) {
        this._scene = scene;
        this._camera = camera;
        this._input = input;
        this._onComplete = onComplete;

        this._stage = 0;
        this._active = false;
        this._playerName = 'AGENT';
        this._clock = 0;

        // DOM refs
        this._hud = document.getElementById('tutorial-hud');
        this._hudLabel = document.getElementById('tutorial-stage-label');
        this._hudText = document.getElementById('tutorial-text');
        this._gameHud = document.getElementById('hud-container');
        this._glowLeft = document.getElementById('tut-glow-left');
        this._glowRight = document.getElementById('tut-glow-right');
        this._demoCard = document.getElementById('tutorial-demo-card');
        this._demoContent = document.getElementById('tutorial-demo-content');

        // Flags for game_engine.js
        /** Completely skip character.update() — used in Stage 2 */
        this.freezeCharacter = false;
        /** Zero input.momentum before character.update() — used in Stage 3 */
        this.freezeWalkOnly = false;

        this._worldGroup = null;
        this._floorGrid = null;
        this._demoTimeout = null;
        this._handleKeyDown = this._handleKeyDown.bind(this);

        this._stages = [
            {
                label: 'STAGE 1  ·  LOCOMOTION',
                text: (n) =>
                    `CALIBRATING WALKING, <span class="tut-name">${n}</span>. ` +
                    `JOG IN PLACE TO MOVE. PRESS <span class="tut-key">SPACE</span> TO CONTINUE.`,
            },
            {
                label: 'STAGE 2  ·  NAVIGATION',
                text: (n) =>
                    `LEAN LEFT OR RIGHT TO TURN, <span class="tut-name">${n}</span>. ` +
                    `WATCH THE SCREEN EDGES LIGHT UP. PRESS <span class="tut-key">SPACE</span> TO CONTINUE.`,
            },
            {
                label: 'STAGE 3  ·  OVERRIDE',
                text: (n) =>
                    `ALMOST READY, <span class="tut-name">${n}</span>! ` +
                    `RAISE EITHER ARM ABOVE YOUR SHOULDER TO ANSWER QUESTIONS. ` +
                    `PRESS <span class="tut-key">SPACE</span> TO BEGIN.`,
            },
        ];
    }

    // ─── Public API ──────────────────────────────────────────────────────────

    start(playerName) {
        this._playerName = (playerName || 'AGENT').toUpperCase();
        this._active = true;
        this._stage = 1;
        this._clock = 0;

        if (this._gameHud) this._gameHud.style.display = 'none';

        this._buildTutorialWorld();
        this._applyStage(1);
        window.addEventListener('keydown', this._handleKeyDown);
    }

    update() {
        if (!this._active) return;
        this._clock += 0.016;

        // Scroll grid in Stage 1 to feel like movement
        if (this._floorGrid && this._stage === 1) {
            const mom = (this._input && this._input.momentum) || 0;
            const newZ = this._floorGrid.position.z + mom * 0.4;
            // Floor-based modulo to handle potential negative momentum safely
            this._floorGrid.position.z = ((newZ % 2) + 2) % 2;
        }

        // Stage 2: reactive edge glow driven by REAL telemetry
        if (this._stage === 2) {
            const turn = this._input && this._input.turn;
            if (turn === 'LEFT') {
                if (this._glowLeft) this._glowLeft.classList.add('glow-on');
                if (this._glowRight) this._glowRight.classList.remove('glow-on');
                if (this._arrL) this._arrL.classList.add('active');
                if (this._arrR) this._arrR.classList.remove('active');
            } else if (turn === 'RIGHT') {
                if (this._glowRight) this._glowRight.classList.add('glow-on');
                if (this._glowLeft) this._glowLeft.classList.remove('glow-on');
                if (this._arrR) this._arrR.classList.add('active');
                if (this._arrL) this._arrL.classList.remove('active');
            } else {
                // Centred — dim both
                if (this._glowLeft) this._glowLeft.classList.remove('glow-on');
                if (this._glowRight) this._glowRight.classList.remove('glow-on');
                if (this._arrL) this._arrL.classList.remove('active');
                if (this._arrR) this._arrR.classList.remove('active');
            }
        }
    }

    // ─── Private ─────────────────────────────────────────────────────────────

    _applyStage(n) {
        this._clearDemos();
        this._stage = n;

        const def = this._stages[n - 1];
        if (this._hudLabel) this._hudLabel.textContent = def.label;
        if (this._hudText) this._hudText.innerHTML = def.text(this._playerName);
        if (this._hud) this._hud.classList.remove('hidden');

        this.freezeCharacter = false;
        this.freezeWalkOnly = false;

        if (n === 2) {
            this.freezeCharacter = true;  // complete freeze — no walk glitch
            this._showLeanCard();

        } else if (n === 3) {
            this.freezeWalkOnly = true;   // arms still animate
            this._showHandCard();         // auto-hides after 1.5 s
        }
    }

    // ── Stage 2 lean card (static — reacts to real input in update()) ────────
    _showLeanCard() {
        if (this._glowLeft) this._glowLeft.classList.remove('hidden');
        if (this._glowRight) this._glowRight.classList.remove('hidden');

        if (this._demoContent) {
            this._demoContent.innerHTML = `
                <div class="tut-demo-arrows">
                    <span class="tut-demo-arrow" id="demo-arr-left">&#8592; LEAN</span>
                    <span class="tut-demo-label" style="white-space:nowrap">SHIFT YOUR WEIGHT</span>
                    <span class="tut-demo-arrow" id="demo-arr-right">LEAN &#8594;</span>
                </div>`;
        }
        if (this._demoCard) this._demoCard.classList.remove('hidden');

        this._arrL = document.getElementById('demo-arr-left');
        this._arrR = document.getElementById('demo-arr-right');
    }

    // ── Stage 3 hand card (auto-hides after 1.5 s, arms are live after) ─────
    _showHandCard() {
        if (this._demoContent) {
            this._demoContent.innerHTML = `
                <div class="tut-demo-label">RAISE EITHER ARM ABOVE YOUR SHOULDER</div>
                <div class="tut-demo-hands">
                    <div class="tut-demo-hand active" id="demo-hand-left">🤚</div>
                    <div class="tut-demo-label" style="align-self:center;font-size:1.4rem;opacity:0.5">OR</div>
                    <div class="tut-demo-hand active" id="demo-hand-right">🤚</div>
                </div>`;
        }
        if (this._demoCard) this._demoCard.classList.remove('hidden');

        // Auto-hide after 1.5 s so character arms take over
        this._demoTimeout = setTimeout(() => {
            if (this._demoCard) this._demoCard.classList.add('hidden');
            if (this._demoContent) this._demoContent.innerHTML = '';
        }, 1500);
    }

    _clearDemos() {
        clearTimeout(this._demoTimeout);
        this._demoTimeout = null;
        if (this._demoCard) this._demoCard.classList.add('hidden');
        if (this._demoContent) this._demoContent.innerHTML = '';
        this._arrL = null;
        this._arrR = null;

        if (this._glowLeft) {
            this._glowLeft.classList.add('hidden');
            this._glowLeft.classList.remove('glow-on');
        }
        if (this._glowRight) {
            this._glowRight.classList.add('hidden');
            this._glowRight.classList.remove('glow-on');
        }
    }

    _handleKeyDown(e) {
        if (!this._active) return;
        if (e.code !== 'Space' && e.key !== ' ') return;
        e.preventDefault();

        if (this._stage < 3) {
            this._applyStage(this._stage + 1);
        } else {
            window.removeEventListener('keydown', this._handleKeyDown);
            this._beginDrop();
        }
    }

    _beginDrop() {
        this._active = false;
        this.freezeCharacter = false;
        this.freezeWalkOnly = false;

        if (this._hud) this._hud.classList.add('hidden');
        this._clearDemos();
        if (this._gameHud) this._gameHud.style.display = '';

        setTimeout(() => {
            this._cleanup();
            if (this._onComplete) this._onComplete();
        }, 200);
    }

    _buildTutorialWorld() {
        this._worldGroup = new THREE.Group();
        this._scene.add(this._worldGroup);

        const floorGeo = new THREE.PlaneGeometry(24, 80);
        const floorMat = new THREE.MeshStandardMaterial({ color: 0x050e18, roughness: 0.9, metalness: 0.1 });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(0, -0.01, -20);
        floor.receiveShadow = true;
        this._worldGroup.add(floor);

        this._floorGrid = new THREE.GridHelper(80, 40, 0x00ffff, 0x003344);
        this._floorGrid.position.set(0, 0.01, -20);
        this._floorGrid.material.transparent = true;
        this._floorGrid.material.opacity = 0.2;
        this._worldGroup.add(this._floorGrid);

        const wallMat = new THREE.MeshStandardMaterial({ color: 0x0a1525, roughness: 0.8, metalness: 0.5, emissive: 0x001122, emissiveIntensity: 0.3 });
        const wallGeo = new THREE.BoxGeometry(0.4, 4, 60);
        [-5, 5].forEach((x) => {
            const w = new THREE.Mesh(wallGeo, wallMat);
            w.position.set(x, 2, -20);
            this._worldGroup.add(w);
        });

        const stripMat = new THREE.MeshStandardMaterial({ color: 0x00d4ff, emissive: 0x00d4ff, emissiveIntensity: 2.0 });
        const stripGeo = new THREE.BoxGeometry(0.05, 0.08, 60);
        [[-4.7, 0.22], [-4.7, 3.6], [4.7, 0.22], [4.7, 3.6]].forEach(([x, y]) => {
            const s = new THREE.Mesh(stripGeo, stripMat);
            s.position.set(x, y, -20);
            this._worldGroup.add(s);
        });

        const ceilMat = new THREE.MeshStandardMaterial({ color: 0x060f1a, roughness: 1.0, side: THREE.DoubleSide });
        const ceil = new THREE.Mesh(new THREE.PlaneGeometry(10.4, 60), ceilMat);
        ceil.rotation.x = Math.PI / 2;
        ceil.position.set(0, 4.0, -20);
        this._worldGroup.add(ceil);

        this._worldGroup.add(new THREE.AmbientLight(0x112233, 1.2));
        [-3, 3].forEach(x => {
            const spot = new THREE.SpotLight(0x00aaff, 1.5, 30, Math.PI / 5, 0.4);
            spot.position.set(x, 6, 0);
            spot.target.position.set(x, 0, -5);
            this._worldGroup.add(spot, spot.target);
        });
    }

    _cleanup() {
        if (this._worldGroup) {
            // Traverse and dispose geometries/materials to free GPU memory
            this._worldGroup.traverse((child) => {
                if (child.geometry) {
                    child.geometry.dispose();
                }
                if (child.material) {
                    // material can be an array in some cases
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => m.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            });

            this._scene.remove(this._worldGroup);
            this._worldGroup = null;
        }
    }
}
