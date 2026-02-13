import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160/build/three.module.js";

export class CharacterController {
    constructor(scene, input) {
        this.input = input;
        this.group = new THREE.Group();
        scene.add(this.group);

        this.speed = 0;
        this.maxSpeed = 0.15;
        this.turnSpeed = 0.04;
        this.walkCycle = 0;

        this.createRobot();
    }

    createRobot() {
        // Materials
        const armorMat = new THREE.MeshStandardMaterial({
            color: 0x222222,
            roughness: 0.2,
            metalness: 0.8
        });
        const jointMat = new THREE.MeshStandardMaterial({ color: 0x555555 });
        const lightMat = new THREE.MeshBasicMaterial({ color: 0x00ffcc }); // Tron light

        // --- TORSO ---
        this.torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, 0.4), armorMat);
        this.torso.position.y = 1.1;
        this.torso.castShadow = true;
        this.group.add(this.torso);

        // Chest Light (Front is -Z)
        const chestLight = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.05), lightMat);
        chestLight.position.set(0, 0.2, -0.21); // Moved to -Z
        this.torso.add(chestLight);

        // --- HEAD ---
        this.headGroup = new THREE.Group();
        this.headGroup.position.y = 0.6;
        this.torso.add(this.headGroup);

        const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.35, 0.45), armorMat);
        this.headGroup.add(headMesh);

        // Eyes (Front is -Z)
        const eyeGeo = new THREE.BoxGeometry(0.08, 0.02, 0.02);
        const leftEye = new THREE.Mesh(eyeGeo, lightMat);
        leftEye.position.set(-0.1, 0, -0.23); // Moved to -Z
        this.headGroup.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeo, lightMat);
        rightEye.position.set(0.1, 0, -0.23); // Moved to -Z
        this.headGroup.add(rightEye);

        // --- ARMS Helper Function ---
        const createArm = (isLeft) => {
            const side = isLeft ? -1 : 1;

            // Shoulder Joint
            const shoulder = new THREE.Group();
            shoulder.position.set(side * 0.4, 0.35, 0);
            this.torso.add(shoulder);

            // Shoulder Mesh
            const shoulderMesh = new THREE.Mesh(new THREE.SphereGeometry(0.12), jointMat);
            shoulder.add(shoulderMesh);

            // Upper Arm (Pivot at top)
            const upperArm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.6, 0.12), armorMat);
            upperArm.position.y = -0.3;
            shoulder.add(upperArm);

            // Elbow Joint (Bottom of upper arm)
            const elbow = new THREE.Group();
            elbow.position.y = -0.3;
            upperArm.add(elbow);

            const elbowMesh = new THREE.Mesh(new THREE.SphereGeometry(0.1), jointMat);
            elbow.add(elbowMesh);

            // Forearm
            const forearm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.6, 0.1), armorMat);
            forearm.position.y = -0.3;
            elbow.add(forearm);

            // Hand
            const hand = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.15, 0.12), jointMat);
            hand.position.y = -0.35;
            forearm.add(hand);

            return { shoulder, elbow };
        };

        this.leftArm = createArm(true);
        this.rightArm = createArm(false);

        // --- LEGS Helper Function ---
        const createLeg = (isLeft) => {
            const side = isLeft ? -1 : 1;

            // Hip Joint
            const hip = new THREE.Group();
            hip.position.set(side * 0.2, -0.45, 0);
            this.torso.add(hip);

            const hipMesh = new THREE.Mesh(new THREE.SphereGeometry(0.12), jointMat);
            hip.add(hipMesh);

            // Thigh
            const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.18), armorMat);
            thigh.position.y = -0.35;
            hip.add(thigh);

            // Knee
            const knee = new THREE.Group();
            knee.position.y = -0.35;
            thigh.add(knee);

            const kneeMesh = new THREE.Mesh(new THREE.SphereGeometry(0.11), jointMat);
            knee.add(kneeMesh);

            // Shin
            const shin = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.7, 0.15), armorMat);
            shin.position.y = -0.35;
            knee.add(shin);

            // Foot (Toes point -Z)
            const foot = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.25), jointMat);
            foot.position.set(0, -0.4, -0.05); // Toes forward (-Z)
            shin.add(foot);

            return { hip, knee };
        };

        this.leftLeg = createLeg(true);
        this.rightLeg = createLeg(false);
    }

    update() {
        // 1. --- LOCOMOTION ---
        const targetSpeed = this.input.momentum * this.maxSpeed;
        this.speed += (targetSpeed - this.speed) * 0.05; // Smoother acceleration

        // Turning
        if (this.input.turn === "LEFT") {
            this.group.rotation.y += this.turnSpeed;
            this.group.rotation.z = THREE.MathUtils.lerp(this.group.rotation.z, 0.1, 0.05);
        } else if (this.input.turn === "RIGHT") {
            this.group.rotation.y -= this.turnSpeed;
            this.group.rotation.z = THREE.MathUtils.lerp(this.group.rotation.z, -0.1, 0.05);
        } else {
            this.group.rotation.z = THREE.MathUtils.lerp(this.group.rotation.z, 0, 0.05);
        }

        // Apply Movement
        const forward = new THREE.Vector3(0, 0, -1);
        forward.applyQuaternion(this.group.quaternion);
        this.group.position.addScaledVector(forward, this.speed);

        // Walking Animation (Smoothed Sine Wave)
        if (this.speed > 0.005) {
            this.walkCycle += this.speed * 20; // Reduced from 40 for smoother walk

            const l_leg_angle = Math.sin(this.walkCycle) * 0.8;
            const r_leg_angle = Math.sin(this.walkCycle + Math.PI) * 0.8;

            this.leftLeg.hip.rotation.x = l_leg_angle;
            // Knee bends only when leg is moving backward
            // Simple: absolute sin for knee?
            this.leftLeg.knee.rotation.x = (Math.sin(this.walkCycle) > 0) ? 0 : -Math.sin(this.walkCycle) * 1.2;

            this.rightLeg.hip.rotation.x = r_leg_angle;
            this.rightLeg.knee.rotation.x = (Math.sin(this.walkCycle + Math.PI) > 0) ? 0 : -Math.sin(this.walkCycle + Math.PI) * 1.2;

            // Bobbing
            this.torso.position.y = 1.1 + Math.abs(Math.sin(this.walkCycle * 2)) * 0.03;
        } else {
            // Stand Still
            this.leftLeg.hip.rotation.x = THREE.MathUtils.lerp(this.leftLeg.hip.rotation.x, 0, 0.1);
            this.rightLeg.hip.rotation.x = THREE.MathUtils.lerp(this.rightLeg.hip.rotation.x, 0, 0.1);
            this.leftLeg.knee.rotation.x = THREE.MathUtils.lerp(this.leftLeg.knee.rotation.x, 0, 0.1);
            this.rightLeg.knee.rotation.x = THREE.MathUtils.lerp(this.rightLeg.knee.rotation.x, 0, 0.1);
            this.torso.position.y = THREE.MathUtils.lerp(this.torso.position.y, 1.1, 0.1);
        }

        // 2. --- UPPER BODY (ARMS) ---
        // SWAPPED INPUTS for Shadow Method (because character is rotated 180)
        const l_deg = this.input.r_arm; // User Right -> Model Left (Screen Right)
        const r_deg = this.input.l_arm; // User Left -> Model Right (Screen Left)

        // Shoulder Z: 0=Down, 180=Up
        // Elbow Z: 0=Straight, 90=Bent inward
        // Logic: Bend elbow when arm is rising (midway), straighten at top.

        // Helper to get rotations
        const getArmRotations = (deg) => {
            const rad = THREE.MathUtils.degToRad(deg);

            // Shoulder: Linear map
            // Note: If Z- is forward, and shoulder is on Left (-X), 
            // Rotating +Z moves arm UP (if T-pose is 90)
            const shoulderZ = rad;

            // Elbow: Bend max at 90 deg (horizontal), straight at 0 and 180.
            const elbowBend = Math.sin(rad) * 1.5; // Max bend ~85 deg

            return { shoulderZ, elbowBend };
        };

        const l_rot = getArmRotations(l_deg);
        const r_rot = getArmRotations(r_deg);

        // Apply Left
        this.leftArm.shoulder.rotation.z = THREE.MathUtils.lerp(this.leftArm.shoulder.rotation.z, -l_rot.shoulderZ, 0.1);
        this.leftArm.elbow.rotation.z = THREE.MathUtils.lerp(this.leftArm.elbow.rotation.z, -l_rot.elbowBend, 0.1);

        // Apply Right
        this.rightArm.shoulder.rotation.z = THREE.MathUtils.lerp(this.rightArm.shoulder.rotation.z, r_rot.shoulderZ, 0.1);
        this.rightArm.elbow.rotation.z = THREE.MathUtils.lerp(this.rightArm.elbow.rotation.z, r_rot.elbowBend, 0.1);

        // Idle Head
        this.headGroup.rotation.y = Math.sin(Date.now() * 0.001) * 0.05;

        // FIXED: Face Away (Rotate Torso 180)
        this.torso.rotation.y = Math.PI;
    }
}