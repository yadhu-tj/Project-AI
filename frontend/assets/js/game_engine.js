import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160/build/three.module.js";

const socket = io();

// UI
const statusEl = document.getElementById("status");
const stepsEl = document.getElementById("steps");
const turnEl = document.getElementById("turn");

// Motion data
let momentum = 0;
let turn = "CENTER";
let leftArm = 0;
let rightArm = 0;

// Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

const camera = new THREE.PerspectiveCamera(
    70,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Lights
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(5, 10, 5);
scene.add(light);
scene.add(new THREE.AmbientLight(0xffffff, 0.3));

// Floor
const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.MeshStandardMaterial({ color: 0x222222 })
);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

// Maze walls
function createWall(x, z, width, depth) {
    const wall = new THREE.Mesh(
        new THREE.BoxGeometry(width, 5, depth),
        new THREE.MeshStandardMaterial({ color: 0x5555ff })
    );
    wall.position.set(x, 2.5, z);
    scene.add(wall);
}

// Simple maze corridor
createWall(0, -10, 10, 1);
createWall(-5, -5, 1, 10);
createWall(5, -5, 1, 10);
createWall(0, 0, 10, 1);
createWall(5, 5, 1, 10);
createWall(0, 10, 10, 1);

// Character
const character = new THREE.Group();

// Body
const body = new THREE.Mesh(
    new THREE.BoxGeometry(1, 2, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x00ff88 })
);
body.position.y = 1;
character.add(body);

// Head
const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.8, 0.8),
    new THREE.MeshStandardMaterial({ color: 0xffffaa })
);
head.position.y = 2.4;
character.add(head);

// Arms
const armMaterial = new THREE.MeshStandardMaterial({ color: 0xff4444 });
const armGeometry = new THREE.BoxGeometry(0.3, 1.5, 0.3);
armGeometry.translate(0, -0.75, 0); // Shift pivot to top

const leftArmMesh = new THREE.Mesh(armGeometry, armMaterial);
leftArmMesh.position.set(-0.9, 2.0, 0); // Shoulder position
character.add(leftArmMesh);

const rightArmMesh = new THREE.Mesh(armGeometry, armMaterial);
rightArmMesh.position.set(0.9, 2.0, 0); // Shoulder position
character.add(rightArmMesh);

scene.add(character);

// Camera offset
const cameraOffset = new THREE.Vector3(0, 4, 6);

// Socket events
socket.on("telemetry", (data) => {
    statusEl.textContent = data.status;
    stepsEl.textContent = data.steps;
    turnEl.textContent = data.turn;

    momentum = data.momentum;
    turn = data.turn;
    leftArm = data.l_arm;
    rightArm = data.r_arm;
});

// Animation loop
function animate() {
    requestAnimationFrame(animate);

    // Turning
    if (turn === "LEFT") {
        character.rotation.y += 0.03;
    } else if (turn === "RIGHT") {
        character.rotation.y -= 0.03;
    }

    // Forward movement
    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyQuaternion(character.quaternion);
    character.position.addScaledVector(forward, momentum * 0.1);

    // Arm animation (0 = Down, 180 = Up)
    // Left Arm: Rotate Negative Z (Outward/Up)
    leftArmMesh.rotation.z = -THREE.MathUtils.degToRad(leftArm);

    // Right Arm: Rotate Positive Z (Outward/Up)
    rightArmMesh.rotation.z = THREE.MathUtils.degToRad(rightArm);

    // Camera follow
    const camPos = cameraOffset.clone();
    camPos.applyQuaternion(character.quaternion);
    camPos.add(character.position);

    camera.position.lerp(camPos, 0.1);
    camera.lookAt(character.position);

    renderer.render(scene, camera);
}

animate();

// Resize
window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
