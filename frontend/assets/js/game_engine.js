import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160/build/three.module.js";
import { InputAdapter } from "../../game/input_adapter.js";
import { CharacterController } from "../../game/character_control.js";
import { CameraController } from "../../game/camera_controller.js";
import { LevelManager } from "../../game/world/LevelManager.js";
import { GameManager } from "../../game/logic/GameManager.js";
import { QuizManager } from "../../game/logic/QuizManager.js";
import { PersonalizationManager } from "../../game/PersonalizationManager.js";
import { CONFIG } from "../../game/config.js";
import { HolographicGuide } from "../../game/HolographicGuide.js";

// State Flags for Init Flow
let playerName = "Pilot";
let nameSubmitted = true;
let isCalibrated = false;
let hasCompletedTutorial = false;
let holographicGuide = null;
let tutorialStarted = false;

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
    nameOverlay: document.getElementById("name-input-overlay"),

    status: document.getElementById("status"),
    indicator: document.getElementById("status-indicator"),
    momentumVal: document.getElementById("momentum-val"),
    momentumArc: document.getElementById("momentum-arc"),
    score: document.getElementById("score-display"),
    turnLeft: document.getElementById("turn-left"),
    turnRight: document.getElementById("turn-right"),

    // Intro Specifics
    introContentContainer: document.getElementById("intro-content-container"),
    bootLines: document.querySelectorAll(".boot-line"),
    hudContainer: document.getElementById("hud-container"),
    turnNotification: document.getElementById("turn-notification"),
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
                uiIds.hudContainer.classList.remove("hidden"); // Reveal HUD here
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

function startTutorial() {
    tutorialStarted = true;
    calibOverlay.classList.add("hidden");

    // Instantiate Hologram Guide
    holographicGuide = new HolographicGuide(scene, playerName, () => {
        // Tutorial Complete Callback:
        hasCompletedTutorial = true;
        holographicGuide = null;
        levelManager.startProceduralGeneration();

        // Show "PILOT VERIFIED" Screen ready
        calibOverlay.classList.remove("hidden");
        calibPhaseEl.classList.remove("hidden");
        calibCountSec.classList.add("hidden");

        calibHeading.textContent = "PILOT VERIFIED";
        calibHeading.style.color = "#00ff88";
        calibHeading.style.textShadow = "0 0 40px rgba(0,255,136,0.9)";

        const hintEl = document.querySelector("#calib-phase-section .calib-hint");
        hintEl.textContent = "SYNCING NEURAL PATHWAYS...";

        // User requested removing the progress bar from this screen
        calibProgFill.parentElement.style.display = "none";
        calibPctEl.style.display = "none";

        setTimeout(() => {
            // Reset styles and start countdown
            calibHeading.style.color = "#00ffff";
            calibHeading.style.textShadow = "0 0 20px rgba(0, 255, 255, 0.8), 0 0 60px rgba(0, 255, 255, 0.3)";
            hintEl.textContent = "Stand still \u00B7 Face the camera \u00B7 Arms at sides"; // Reset just in case
            _startCountdown();
        }, 1500);
    });
}

// --- INTRO BOOT SEQUENCE & PARALLAX ---
// Add parallax tilt on mousemove
uiIds.nameOverlay.addEventListener("mousemove", (e) => {
    const rect = uiIds.nameOverlay.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;

    const tiltX = -(y / rect.height) * 20; // max 10 deg tilt
    const tiltY = (x / rect.width) * 20;

    uiIds.introContentContainer.style.transform = `rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
});

uiIds.nameOverlay.addEventListener("mouseleave", () => {
    uiIds.introContentContainer.style.transform = `rotateX(0deg) rotateY(0deg)`;
});

function runBootSequence() {
    const lines = uiIds.bootLines;
    let delay = 600;

    // 1. Reveal boot lines progressively
    lines.forEach((line, index) => {
        if (index === 0) return; // First line already visible
        setTimeout(() => {
            line.style.opacity = "1";
        }, delay);
        delay += 800;
    });

    // 2. Hide console, then auto-proceed to calibration
    setTimeout(() => {
        lines.forEach(line => line.style.opacity = "0");
        setTimeout(() => {
            document.getElementById("boot-console").style.display = "none";
            // Auto-proceed: fade out overlay and show calibration
            uiIds.nameOverlay.style.opacity = "0";
            uiIds.nameOverlay.style.pointerEvents = "none";
            setTimeout(() => uiIds.nameOverlay.classList.add("hidden"), 600);

            if (isCalibrated) {
                startTutorial();
            } else {
                calibOverlay.classList.remove("hidden");
                calibPhaseEl.classList.remove("hidden");
                calibCountSec.classList.add("hidden");
                calibHeading.textContent = "CALIBRATING";
            }
        }, 300);
    }, delay + 600);
}

// Start sequence on load
runBootSequence();



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

    // Turn Indicators Edge Fades + Popup
    const turnNotif = uiIds.turnNotification;
    if (data.turn === "LEFT" && uiIds.turnLeft && uiIds.turnRight) {
        uiIds.turnLeft.style.opacity = 0.8;
        uiIds.turnRight.style.opacity = 0;
        if (hasCompletedTutorial && turnNotif) {
            turnNotif.textContent = "◀  TURNED LEFT";
            turnNotif.classList.add("visible");
        }
    } else if (data.turn === "RIGHT" && uiIds.turnLeft && uiIds.turnRight) {
        uiIds.turnRight.style.opacity = 0.8;
        uiIds.turnLeft.style.opacity = 0;
        if (hasCompletedTutorial && turnNotif) {
            turnNotif.textContent = "TURNED RIGHT  ▶";
            turnNotif.classList.add("visible");
        }
    } else if (uiIds.turnLeft && uiIds.turnRight) {
        uiIds.turnLeft.style.opacity = 0;
        uiIds.turnRight.style.opacity = 0;
        if (turnNotif) turnNotif.classList.remove("visible");
    }

    const calibPct = Math.min(100, Math.round(data.calibration * 100));
    if (!hasCompletedTutorial) {
        calibProgFill.style.transition = "width 0.3s ease";
        calibProgFill.style.width = calibPct + "%";
        calibPctEl.textContent = calibPct + "%";
    }

    if (_wasCalibrating && data.status !== "CALIBRATING" && data.status !== "NO PLAYER") {
        _calibrationComplete = true;  // mark that server is ready
        isCalibrated = true;
        _wasCalibrating = false;

        if (_personalizationDone && !_countdownStarted) {
            if (!tutorialStarted) {
                // Small delay for visual completion
                setTimeout(() => {
                    startTutorial();
                }, 500);
            } else {
                _countdownStarted = true;
                _startCountdown();
            }
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

    if (holographicGuide && !hasCompletedTutorial) {
        holographicGuide.update(input);
    }

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