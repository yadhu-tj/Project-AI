import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160/build/three.module.js";
import { InputAdapter } from "../../game/input_adapter.js";
import { CharacterController } from "../../game/character_control.js";
import { CameraController } from "../../game/camera_controller.js";
import { LevelManager } from "../../game/world/LevelManager.js";
import { GameManager } from "../../game/logic/GameManager.js";
import { QuizManager } from "../../game/logic/QuizManager.js";
import { PersonalizationManager } from "../../game/PersonalizationManager.js";
import { HolographicTutorial } from "../../game/HolographicTutorial.js";
import { CONFIG } from "../../game/config.js";

// Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050505);
scene.fog = new THREE.Fog(0x050505, 10, 60);

const camera = new THREE.PerspectiveCamera(
    70,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);
camera.position.set(0, 2, 5);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Lights
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
dirLight.position.set(3, 10, 10);
dirLight.castShadow = true;
scene.add(dirLight);

// --- LEVEL MANAGER (deferred — world generates AFTER tutorial) ---
const levelManager = new LevelManager(scene, { deferred: true });
// Give the factory a scene ref so setTheme() can update fog/background
levelManager.factory._scene = scene;

// UI Elements
const uiIds = {
    status: document.getElementById("status"),
    indicator: document.getElementById("status-indicator"),
    momentumVal: document.getElementById("momentum-val"),
    momentumArc: document.getElementById("momentum-arc"),
    score: document.getElementById("score-display"),
    turnLeft: document.getElementById("turn-left"),
    turnRight: document.getElementById("turn-right"),
};

const calibOverlay = document.getElementById("calib-overlay");
const calibHeading = document.getElementById("calib-heading");
const calibPhaseEl = document.getElementById("calib-phase-section");
const calibProgFill = document.getElementById("calib-prog-fill");
const calibPctEl = document.getElementById("calib-pct");
const calibCountSec = document.getElementById("calib-countdown-section");
const calibNumberEl = document.getElementById("calib-number");

let _wasCalibrating = true;
let _countdownStarted = false;
let _calibrationComplete = false;
let _personalizationDone = false;
let _tutorialComplete = false;  // set to true when HolographicTutorial finishes

function _startCountdown() {
    // Bring back the calib overlay for the 3-2-1-GO! display
    calibOverlay.classList.remove('hidden', 'calib-fade-out');
    calibOverlay.style.opacity = '';
    calibPhaseEl.classList.add("hidden");
    calibHeading.textContent = "GET READY";
    calibCountSec.classList.remove("hidden");

    const steps = ["3", "2", "1", "GO!"];
    let i = 0;

    function tick() {
        calibNumberEl.textContent = steps[i];
        calibNumberEl.classList.remove("pop");
        void calibNumberEl.offsetWidth;
        calibNumberEl.classList.add("pop");

        if (steps[i] === "GO!") {
            calibNumberEl.style.color = "#00ff88";
            calibNumberEl.style.textShadow = "0 0 40px rgba(0,255,136,0.9)";
            setTimeout(() => {
                calibOverlay.classList.add("calib-fade-out");
                setTimeout(() => calibOverlay.classList.add("hidden"), 400);
                gameManager.startTime = Date.now();
                gameManager.timerActive = true;
            }, 700);
            return;
        }
        i++;
        setTimeout(tick, 900);
    }
    tick();
}

// Input
const input = new InputAdapter((data) => {
    uiIds.status.textContent = data.status;
    uiIds.indicator.className = "";

    if (data.status === "CALIBRATING") uiIds.indicator.classList.add("calibrating");
    else if (data.status === "NO PLAYER") uiIds.indicator.classList.add("disconnected");
    else uiIds.indicator.classList.add("active");

    const momPct = Math.min(100, Math.round(data.momentum * 100));
    uiIds.momentumVal.textContent = momPct + "%";

    // Update Momentum Arc
    if (!uiIds.arcLength && uiIds.momentumArc) {
        uiIds.arcLength = uiIds.momentumArc.getTotalLength();
        uiIds.momentumArc.style.strokeDasharray = uiIds.arcLength;
    }
    if (uiIds.momentumArc && uiIds.arcLength) {
        const dashOffset = uiIds.arcLength - ((momPct / 100) * uiIds.arcLength);
        uiIds.momentumArc.style.strokeDashoffset = dashOffset;
    }

    // Turn Indicators Edge Fades
    if (data.turn === "LEFT" && uiIds.turnLeft && uiIds.turnRight) {
        uiIds.turnLeft.style.opacity = 0.8;
        uiIds.turnRight.style.opacity = 0;
    } else if (data.turn === "RIGHT" && uiIds.turnLeft && uiIds.turnRight) {
        uiIds.turnRight.style.opacity = 0.8;
        uiIds.turnLeft.style.opacity = 0;
    } else if (uiIds.turnLeft && uiIds.turnRight) {
        uiIds.turnLeft.style.opacity = 0;
        uiIds.turnRight.style.opacity = 0;
    }

    const calibPct = Math.min(100, Math.round(data.calibration * 100));
    calibProgFill.style.width = calibPct + "%";
    calibPctEl.textContent = calibPct + "%";

    if (_wasCalibrating && data.status !== "CALIBRATING" && data.status !== "NO PLAYER") {
        _calibrationComplete = true;
        if (_personalizationDone && _tutorialComplete && !_countdownStarted) {
            _countdownStarted = true;
            _startCountdown();
        }
    }
    if (data.status === "CALIBRATING") _wasCalibrating = true;
});

// Character
const character = new CharacterController(scene, input);

// ─── Flash Feedback ────────────────────────────────────────────────────────────
const _flashEl = document.getElementById("flash-overlay");
const _flashText = document.getElementById("flash-text");
let _flashTimeout = null;

function triggerFlash(type, message) {
    _flashEl.classList.remove("hidden", "flash-red", "flash-cyan");
    _flashEl.classList.add("flash-" + type);
    _flashText.textContent = message;
    clearTimeout(_flashTimeout);
    _flashTimeout = setTimeout(() => _flashEl.classList.add("hidden"), 1500);
}

// --- GAME MANAGER ---
const gameManager = new GameManager(character, levelManager, input, triggerFlash);

// Wire level-theme change: recolour the world each time the level increases
gameManager.onLevelChange = (newLevel) => {
    levelManager.factory.setTheme(newLevel);
};

// Wire respawn hook: reset junction overlay so it shows on the new run
gameManager.onRespawn = () => {
    overlayShownOnce = false; // Bug #6 fix: show junction overlay again after respawn
};

// --- QUIZ MANAGER ---
const quizManager = new QuizManager(gameManager, input);

// --- HOLOGRAPHIC TUTORIAL ---
const holographicTutorial = new HolographicTutorial(
    scene, camera, input,
    () => {
        // Tutorial complete: now spawn the world, then fire countdown
        _tutorialComplete = true;
        levelManager.initialize();
        if (_calibrationComplete && !_countdownStarted) {
            _countdownStarted = true;
            _startCountdown();
        }
    }
);

// --- PERSONALIZATION MANAGER ---
const _sharedSocket = io(CONFIG.SOCKET_URL);

const personalizationManager = new PersonalizationManager(
    _sharedSocket,
    quizManager,
    (playerName) => {
        // Personalization done — hide calib overlay, start animate loop, launch tutorial
        _personalizationDone = true;
        _playerNameForVictory = (playerName || 'AGENT').toUpperCase();

        // Hide calib overlay so the void tutorial scene is fully visible
        calibOverlay.classList.add('calib-fade-out');
        setTimeout(() => calibOverlay.classList.add('hidden'), 420);

        // Show pre-tutorial overlay
        const preTutOverlay = document.getElementById("pre-tutorial-overlay");
        preTutOverlay.classList.remove("hidden");
        preTutOverlay.style.display = "flex";
        setTimeout(() => preTutOverlay.style.opacity = "1", 50);

        // Wait for spacebar to dismiss pre-tutorial and start the tutorial
        let preTutDismissed = false;
        const tryDismissPreTut = (e) => {
            if (!preTutDismissed && (e.code === 'Space' || e.key === ' ')) {
                e.preventDefault();
                preTutDismissed = true;
                window.removeEventListener("keydown", tryDismissPreTut);

                preTutOverlay.classList.add("hidden");
                preTutOverlay.style.opacity = "0";

                setTimeout(() => {
                    preTutOverlay.style.display = "none";
                    animate();
                    holographicTutorial.start(playerName || 'AGENT');
                }, 500); // Wait for transition out
            }
        };

        window.addEventListener("keydown", tryDismissPreTut);
    }
);
personalizationManager.init();

// ─── Title Screen Logic ───────────────────────────────────────────────────────
const titleOverlay = document.getElementById("title-overlay");
const persoOverlay = document.getElementById("personalization-overlay");
let titleDismissed = false;

window.addEventListener("keydown", (e) => {
    if (!titleDismissed && (e.code === 'Space' || e.key === ' ')) {
        e.preventDefault();
        titleDismissed = true;

        // Hide title screen
        titleOverlay.classList.add("hidden");

        setTimeout(() => {
            titleOverlay.style.display = "none";
            // Show personalization
            persoOverlay.style.display = "flex";
            // Small delay to allow display: flex to apply before transitioning opacity
            setTimeout(() => {
                persoOverlay.style.opacity = "1";
            }, 50);
        }, 500); // Wait for transition
    }
});

// Camera
const camController = new CameraController(camera, character);

// ─── Junction Overlay ────────────────────────────────────────────────────────
const junctionOverlay = document.getElementById("junction-overlay");
let overlayVisible = false;
let overlayShownOnce = false; // Show only once — first junction only

function showJunctionOverlay() {
    if (overlayVisible || overlayShownOnce) return;
    overlayVisible = true;
    overlayShownOnce = true;
    junctionOverlay.classList.remove("hidden");
}

function hideJunctionOverlay() {
    if (!overlayVisible) return;
    overlayVisible = false;
    junctionOverlay.classList.add("hidden");
}

// ─── Game Over Overlay ────────────────────────────────────────────────────────
const gameOverOverlay = document.getElementById("game-over-overlay");
let gameOverVisible = false;

function showGameOver() {
    if (gameOverVisible) return;
    gameOverVisible = true;
    gameOverOverlay.classList.remove("hidden");
}

function hideGameOver() {
    if (!gameOverVisible) return;
    gameOverVisible = false;
    gameOverOverlay.classList.add("hidden");
}

// ─── Victory Overlay ──────────────────────────────────────────────────────────
const victoryOverlay = document.getElementById("victory-overlay");
const finalTimeDisplay = document.getElementById("final-time-display");
let victoryVisible = false;
let _playerNameForVictory = 'AGENT';  // filled in by personalization callback

function showVictory() {
    if (victoryVisible) return;
    victoryVisible = true;

    const timeMs = gameManager.endTime - gameManager.startTime;
    const formattedTime = gameManager.formatTime(timeMs);

    finalTimeDisplay.textContent = formattedTime;

    // Show player name
    const nameEl = document.getElementById('victory-player-name');
    if (nameEl) nameEl.textContent = _playerNameForVictory;

    // Submit score to leaderboard
    if (_sharedSocket) {
        _sharedSocket.emit('submit_score', {
            time_ms: timeMs,
            time_str: formattedTime
        });
    }

    victoryOverlay.classList.remove('hidden');
}

function hideVictory() {
    if (!victoryVisible) return;
    victoryVisible = false;
    victoryOverlay.classList.add("hidden");
}

// ─── Lives / Level / Time HUD ─────────────────────────────────────────────────
const levelDisplay = document.getElementById("level-display");
const timeDisplay = document.getElementById("time-display");

function updateLivesHUD() {
    const lives = Math.max(gameManager.lives, 0);
    for (let i = 1; i <= 3; i++) {
        const seg = document.getElementById("life-" + i);
        if (seg) {
            if (i <= lives) {
                seg.classList.remove("lost");
            } else {
                seg.classList.add("lost");
            }
        }
    }
}

function updateProgressHUD() {
    const lvl = Math.min(gameManager.level, 3);
    levelDisplay.textContent = lvl + " / 3";
    timeDisplay.textContent = gameManager.globalTime;
    if (uiIds.score) {
        uiIds.score.textContent = gameManager.score;
    }
}

// ─── Restart ─────────────────────────────────────────────────────────────────
function restart() {
    const wasGameWon = gameManager.gameState === "GAME_WON";

    gameManager.lives = 3;
    gameManager.endTime = null;
    gameManager.timerActive = false;
    gameManager._prevFrameTime = null; // Bug #3 fix: prevents timer jump on restart

    gameManager.score = 0;
    gameManager.level = 1;

    gameManager.gameState = "RUNNING";
    gameManager._lastTurn = "CENTER";
    gameManager.junctionCount = 0;
    gameManager.junctionDismissed = false;
    overlayShownOnce = false;
    character.group.position.set(0, 0, 0);
    character.group.rotation.set(0, 0, 0);
    character.group.userData.targetRotY = 0;
    levelManager.resetToStart();
    levelManager.factory.setTheme(1); // Reset colors to level 1
    if (quizManager.active) quizManager._clear();
    hideGameOver();
    hideVictory();

    calibOverlay.classList.remove("hidden", "calib-fade-out");
    calibPhaseEl.classList.add("hidden");
    calibCountSec.classList.remove("hidden");
    calibHeading.textContent = "GET READY";
    calibNumberEl.style.color = "#00ffff";
    calibNumberEl.style.textShadow = "";
    _startCountdown();
}

// ─── Dev / Input Shortcuts ────────────────────────────────────────────────────
window.addEventListener("keydown", (e) => {
    const key = e.key.toLowerCase();

    // H = keyboard arm raise: dismiss the junction overlay at the FIRST junction only.
    // Junction 2+ are auto-dismissed; H has no effect there.
    if (key === "h") {
        if (
            gameManager.gameState === "AT_JUNCTION" &&
            gameManager.junctionCount === 0 &&
            !gameManager.junctionDismissed
        ) {
            gameManager.junctionDismissed = true;
        }
        return;
    }

    // Q: restart on DEAD or GAME_WON; lose a life otherwise (dev test)
    if (key === "q") {
        if (gameManager.gameState === "DEAD" || gameManager.gameState === "GAME_WON") restart();
        else gameManager.loseLife();
    }
});

// ─── Game Loop ────────────────────────────────────────────────────────────────
function animate() {
    requestAnimationFrame(animate);

    gameManager.update();
    // Tutorial freeze controls:
    //  freezeCharacter = true  → skip all animation (Stage 2)
    //  freezeWalkOnly  = true  → run arms but zero momentum (Stage 3)
    if (!holographicTutorial.freezeCharacter) {
        if (holographicTutorial.freezeWalkOnly) {
            const savedMom = input.momentum;
            input.momentum = 0;
            character.update();
            input.momentum = savedMom;
        } else {
            character.update();
        }
    }
    quizManager.update();
    holographicTutorial.update();

    if (gameManager.gameState === "AT_JUNCTION" && !gameManager.junctionDismissed) {
        showJunctionOverlay();
    } else if (overlayVisible) {
        hideJunctionOverlay();
    }

    if (gameManager.gameState === "AT_DOOR" && !quizManager.active) {
        quizManager.startQuiz();
    }

    if (gameManager.gameState === "DEAD") {
        showGameOver();
    }

    if (gameManager.gameState === "GAME_WON") {
        showVictory();
    }

    updateLivesHUD();
    updateProgressHUD();

    // Smooth camera tracking (no more instant snapping on turns)
    camController.update();

    renderer.render(scene, camera);
}
// NOTE: animate() is now called by PersonalizationManager.onComplete(),
// not directly here. This prevents the game loop from running during
// personalization. If personalization is already handled (e.g. dev reload),
// it remains deferred until the overlay is dismissed.

// Resize
window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});