import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160/build/three.module.js";
import { InputAdapter } from "../../game/input_adapter.js";
import { CharacterController } from "../../game/character_control.js";
import { CameraController } from "../../game/camera_controller.js";
import { LevelManager } from "../../game/world/LevelManager.js";
import { GameManager } from "../../game/logic/GameManager.js";
import { QuizManager } from "../../game/logic/QuizManager.js";

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
    momentumBar: document.getElementById("momentum-bar"),
    calibVal: document.getElementById("calib-val"),
    calibBar: document.getElementById("calib-bar"),
    steps: document.getElementById("step-count"),
    turn: document.getElementById("turn-signal"),
};

// Input
const input = new InputAdapter((data) => {
    // 1. Status Text & Indicator
    uiIds.status.textContent = data.status;
    uiIds.indicator.className = ""; // reset

    if (data.status === "CALIBRATING") uiIds.indicator.classList.add("calibrating");
    else if (data.status === "NO PLAYER") uiIds.indicator.classList.add("disconnected");
    else uiIds.indicator.classList.add("active");

    // 2. Momentum
    const momPct = Math.min(100, Math.round(data.momentum * 100));
    uiIds.momentumVal.textContent = momPct + "%";
    uiIds.momentumBar.style.width = momPct + "%";

    // 3. Calibration
    const calibPct = Math.min(100, Math.round(data.calibration * 100));
    uiIds.calibVal.textContent = calibPct + "%";
    uiIds.calibBar.style.width = calibPct + "%";

    // 4. Stats
    uiIds.steps.textContent = data.steps;
    uiIds.turn.textContent = data.turn;
});

// Character
const character = new CharacterController(scene, input);

// --- GAME MANAGER ---
const gameManager = new GameManager(character, levelManager, input);

// --- QUIZ MANAGER ---
const quizManager = new QuizManager(gameManager, input);

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
const livesDisplay = document.getElementById("lives-display");
const levelDisplay = document.getElementById("level-display");
const timeDisplay = document.getElementById("time-display");

function updateLivesHUD() {
    const lives = Math.max(gameManager.lives, 0);
    const hearts = ["♥ ♥ ♥", "♥ ♥ ♡", "♥ ♡ ♡", "♡ ♡ ♡"];
    const idx = Math.min(3 - lives, 3);
    livesDisplay.textContent = hearts[idx];
    livesDisplay.className = "lives-display" + (lives === 0 ? " lost" : "");
}

function updateProgressHUD() {
    const lvl = Math.min(gameManager.level, 3);
    levelDisplay.textContent = lvl + " / 3";
    timeDisplay.textContent = gameManager.globalTime;
}

// ─── Restart ─────────────────────────────────────────────────────────────────
function restart() {
    gameManager.lives = 3;
    gameManager.score = 0;
    gameManager.level = 1;
    gameManager.startTime = Date.now();
    gameManager.endTime = null;
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

    // Start quiz when entering AT_DOOR (only once per door)
    if (gameManager.gameState === "AT_DOOR" && !quizManager.active) {
        quizManager.startQuiz();
    }

    if (gameManager.gameState === "DEAD") {
        showGameOver();
    }

    if (gameManager.gameState === "GAME_WON") {
        showVictory();
    }

    // HUD updates every frame
    updateLivesHUD();
    updateProgressHUD();

    // Camera
    camController.update();

    renderer.render(scene, camera);
}
animate();

// Resize
window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});