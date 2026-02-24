import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160/build/three.module.js";
import { InputAdapter } from "../../game/input_adapter.js";
import { CharacterController } from "../../game/character_control.js";
import { CameraController } from "../../game/camera_controller.js";
import { LevelManager } from "../../game/world/LevelManager.js";
import { GameManager } from "../../game/logic/GameManager.js"; // Import GameManager

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

// Camera
const camController = new CameraController(camera, character);

// ─── Junction Overlay ────────────────────────────────────────────────────────
const junctionOverlay = document.getElementById("junction-overlay");
let overlayVisible = false;
let overlayShownOnce = false; // Show only once — first junction only

function showJunctionOverlay() {
    if (overlayVisible || overlayShownOnce) return; // One-shot guard
    overlayVisible = true;
    overlayShownOnce = true;
    gameManager.overlayOpen = true;  // Suppress turns while popup is up
    junctionOverlay.classList.remove("hidden");
}

function hideJunctionOverlay() {
    if (!overlayVisible) return;
    overlayVisible = false;
    gameManager.overlayOpen = false;  // Re-enable turn detection
    gameManager._lastTurn = "CENTER"; // Clear stale turn gesture
    junctionOverlay.classList.add("hidden");
}

// Dev shortcut: press H to dismiss overlay
window.addEventListener("keydown", (e) => {
    if (e.key.toLowerCase() === "h") hideJunctionOverlay();
});

// ─── Game Loop ────────────────────────────────────────────────────────────────
function animate() {
    requestAnimationFrame(animate);

    gameManager.update();
    character.update();

    // Show overlay when junction wall stops the world
    if (levelManager.isBlocked && !overlayVisible) {
        showJunctionOverlay();
    }

    // Dismiss overlay when either hand is raised (l_arm or r_arm > 60°)
    if (overlayVisible && (input.l_arm > 60 || input.r_arm > 60)) {
        hideJunctionOverlay();
    }

    // Snap camera instantly on a turn frame; smooth lerp all other frames
    if (levelManager.justTurned) {
        camController.snap();
    } else {
        camController.update();
    }

    renderer.render(scene, camera);
}
animate();

// Resize
window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});