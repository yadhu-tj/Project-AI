import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160/build/three.module.js";
import { InputAdapter } from "../../game/input_adapter.js";
import { CharacterController } from "../../game/character_control.js";
import { CameraController } from "../../game/camera_controller.js";



// Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa0a0a0);
scene.fog = new THREE.Fog(0xa0a0a0, 10, 50);

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
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444);
hemiLight.position.set(0, 20, 0);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.5); // Increased intensity
dirLight.position.set(3, 10, 10);
dirLight.castShadow = true;
dirLight.shadow.camera.top = 2;
dirLight.shadow.camera.bottom = -2;
dirLight.shadow.camera.left = -2;
dirLight.shadow.camera.right = 2;
dirLight.shadow.camera.near = 0.1;
dirLight.shadow.camera.far = 40;
scene.add(dirLight);

// Floor / Grid
const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(100, 100),
    new THREE.MeshPhongMaterial({ color: 0x999999, depthWrite: false })
);
mesh.rotation.x = -Math.PI / 2;
mesh.receiveShadow = true;
scene.add(mesh);

const grid = new THREE.GridHelper(100, 40, 0x000000, 0x000000);
grid.material.opacity = 0.2;
grid.material.transparent = true;
scene.add(grid);

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

// Camera
const camController = new CameraController(camera, character);

// Loop
function animate() {
    requestAnimationFrame(animate);

    character.update();
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