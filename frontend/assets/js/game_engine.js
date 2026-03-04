import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160/build/three.module.js";
import { InputAdapter } from "../../game/input_adapter.js";
import { CharacterController } from "../../game/character_control.js";
import { CameraController } from "../../game/camera_controller.js";
import { LevelManager } from "../../game/world/LevelManager.js";
import { GameManager } from "../../game/logic/GameManager.js";
import { QuizManager } from "../../game/logic/QuizManager.js";
import { PersonalizationManager } from "../../game/PersonalizationManager.js";
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

// --- LEVEL MANAGER ---
const levelManager = new LevelManager(scene);

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
// Set to true once telemetry confirms the server has left CALIBRATING state.
let _calibrationComplete = false;
// Blocks telemetry-driven countdown until personalization overlay is dismissed.
let _personalizationDone = false;

function _startCountdown() {
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
        _calibrationComplete = true;  // mark that server is ready
        if (_personalizationDone && !_countdownStarted) {
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

// --- QUIZ MANAGER ---
const quizManager = new QuizManager(gameManager, input);

// --- PERSONALIZATION MANAGER ---
// A shared socket created here (separate from InputAdapter's internal one)
// so PersonalizationManager can emit/listen for personalization events.
const _sharedSocket = io(CONFIG.SOCKET_URL);
const personalizationManager = new PersonalizationManager(
    _sharedSocket,
    quizManager,
    () => {
        // onComplete: personalization done.
        // If calibration already finished while the player was filling the form,
        // start the countdown immediately. Otherwise, unlock the telemetry path
        // and let it fire once the server transitions to ACTIVE.
        _personalizationDone = true;
        if (_calibrationComplete && !_countdownStarted) {
            _countdownStarted = true;
            _startCountdown();
        }
        animate();
    }
);
personalizationManager.init();

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

function showVictory() {
    if (victoryVisible) return;
    victoryVisible = true;
    finalTimeDisplay.textContent = gameManager.formatTime(gameManager.endTime - gameManager.startTime);
    victoryOverlay.classList.remove("hidden");
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

    if (wasGameWon) {
        gameManager.score = 0;
        gameManager.level = 1;
    }

    gameManager.gameState = "RUNNING";
    gameManager._lastTurn = "CENTER";
    gameManager.junctionCount = 0;
    gameManager.junctionDismissed = false;
    overlayShownOnce = false;
    character.group.rotation.set(0, 0, 0);
    levelManager.resetToStart();
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
    character.update();
    quizManager.update();

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

    if (levelManager.justTurned) {
        camController.snap();
    } else {
        camController.update();
    }

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