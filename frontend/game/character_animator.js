import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160/build/three.module.js";

export class CharacterAnimator {
    constructor(parts) {
        this.parts = parts; // { group, torso, headGroup, leftArm, ... }
        this.walkCycle = 0;
        this.speed = 0;
        this.maxSpeed = 0.15;
        this.turnSpeed = 0.035; // Tuned for responsive junction turns
        this.isBlocked = false; // Collision Flag

        // MOVEMENT CONSTRAINTS
        this.constraintAxis = 'Z'; // 'Z' (Main Path) or 'X' (Side Path)
        this.constraintCenter = 0; // Ideal center line value
    }

    setConstraintMode(axis, centerVal) {
        this.constraintAxis = axis;
        this.constraintCenter = centerVal;
    }

    update(input) {
        if (this.isBlocked) {
            this.speed = 0;
            // Allow turning or idle animations, but NO forward movement
        }

        // 1. SPEED & MOVEMENT
        if (!this.isBlocked) {
            const targetSpeed = input.momentum * this.maxSpeed;
            this.speed = THREE.MathUtils.lerp(this.speed, targetSpeed, 0.1);

            // Move Forward (Local Z)
            const forward = new THREE.Vector3(0, 0, -1);
            forward.applyQuaternion(this.parts.group.quaternion);
            this.parts.group.position.addScaledVector(forward, this.speed);

            // AUTO-CENTERING & CLAMPING (Lane Assist)
            const pos = this.parts.group.position;
            const deviationMax = 2.9; // Max distance from center
            const centeringStrength = 0.03; // Smooth pull factor (reduced from 0.08 to prevent jerky snap)

            if (this.constraintAxis === 'Z') {
                // Moving along Z. Constrain X.
                // 1. Clamp
                pos.x = Math.max(this.constraintCenter - deviationMax, Math.min(this.constraintCenter + deviationMax, pos.x));
                // 2. Smooth Center
                if (this.speed > 0.001) {
                    pos.x = THREE.MathUtils.lerp(pos.x, this.constraintCenter, centeringStrength);
                }
            } else {
                // Moving along X. Constrain Z.
                // 1. Clamp
                pos.z = Math.max(this.constraintCenter - deviationMax, Math.min(this.constraintCenter + deviationMax, pos.z));
                // 2. Smooth Center
                if (this.speed > 0.001) {
                    pos.z = THREE.MathUtils.lerp(pos.z, this.constraintCenter, centeringStrength);
                }
            }
        }

        // 2. TURNING
        if (input.turn === "LEFT") {
            this.parts.group.rotation.y += this.turnSpeed;
            this.parts.group.rotation.z = THREE.MathUtils.lerp(this.parts.group.rotation.z, 0.05, 0.05);
        } else if (input.turn === "RIGHT") {
            this.parts.group.rotation.y -= this.turnSpeed;
            this.parts.group.rotation.z = THREE.MathUtils.lerp(this.parts.group.rotation.z, -0.05, 0.05);
        } else {
            // AUTO-ALIGN (Magnetic Rotation)
            // If no input, rely on constraint axis to straighten the character
            this.parts.group.rotation.z = THREE.MathUtils.lerp(this.parts.group.rotation.z, 0, 0.1);

            const currentRot = this.parts.group.rotation.y;

            // Snap to nearest 90° (supports ALL 4 directions: N, S, E, W)
            // This handles any combination of consecutive turns
            const targetRot = Math.round(currentRot / (Math.PI / 2)) * (Math.PI / 2);

            // Apply smooth correction
            if (Math.abs(currentRot - targetRot) < 1.0) {
                this.parts.group.rotation.y = THREE.MathUtils.lerp(currentRot, targetRot, 0.15);
            }
        }

        // 3. WALK ANIMATION LOOP
        if (this.speed > 0.005) {
            this.walkCycle += this.speed * 1.5; // Optimized speed multiplier

            // Inverted Hip Rotation for correct direction
            const l_hip_angle = -Math.sin(this.walkCycle) * 0.8;
            const r_hip_angle = -Math.sin(this.walkCycle + Math.PI) * 0.8;

            const l_knee_raw = Math.sin(this.walkCycle + 0.5);
            const l_knee_angle = (l_knee_raw > 0) ? 0 : l_knee_raw * 1.5;

            const r_knee_raw = Math.sin(this.walkCycle + Math.PI + 0.5);
            const r_knee_angle = (r_knee_raw > 0) ? 0 : r_knee_raw * 1.5;

            this.parts.leftLeg.hip.rotation.x = l_hip_angle;
            this.parts.leftLeg.knee.rotation.x = l_knee_angle;
            this.parts.rightLeg.hip.rotation.x = r_hip_angle;
            this.parts.rightLeg.knee.rotation.x = r_knee_angle;

            // Body Bobbing
            this.parts.torso.position.y = 1.1 + Math.abs(Math.sin(this.walkCycle)) * 0.05;
        } else {
            // Auto-Stand
            this.parts.leftLeg.hip.rotation.x = THREE.MathUtils.lerp(this.parts.leftLeg.hip.rotation.x, 0, 0.15);
            this.parts.rightLeg.hip.rotation.x = THREE.MathUtils.lerp(this.parts.rightLeg.hip.rotation.x, 0, 0.15);
            this.parts.leftLeg.knee.rotation.x = THREE.MathUtils.lerp(this.parts.leftLeg.knee.rotation.x, 0, 0.15);
            this.parts.rightLeg.knee.rotation.x = THREE.MathUtils.lerp(this.parts.rightLeg.knee.rotation.x, 0, 0.15);
            this.parts.torso.position.y = THREE.MathUtils.lerp(this.parts.torso.position.y, 1.1, 0.1);
        }

        // 4. ARMS & WAVE
        this.updateArm(this.parts.leftArm, input.r_arm, input.r_wave, true);
        this.updateArm(this.parts.rightArm, input.l_arm, input.l_wave, false);

        // Head idle
        this.parts.headGroup.rotation.y = Math.sin(Date.now() * 0.001) * 0.05;

        // Lock Orientation
        this.parts.torso.rotation.y = 0;
    }

    updateArm(arm, degrees, waveDegrees, isLeft) {
        const side = isLeft ? -1 : 1;

        if (degrees > 60) {
            // WAVE MODE (L-Shape)
            const targetShoulderZ = side * 1.4;
            const targetShoulderX = 0;
            const waveRad = THREE.MathUtils.degToRad(waveDegrees);

            // Inverted Bend Logic for Vertical Forearm
            let targetElbowZ;
            if (isLeft) {
                targetElbowZ = -1.9 - waveRad;
            } else {
                targetElbowZ = 1.9 - waveRad;
            }

            arm.shoulder.rotation.x = THREE.MathUtils.lerp(arm.shoulder.rotation.x, targetShoulderX, 0.1);
            arm.shoulder.rotation.z = THREE.MathUtils.lerp(arm.shoulder.rotation.z, targetShoulderZ, 0.1);

            arm.elbow.rotation.x = THREE.MathUtils.lerp(arm.elbow.rotation.x, 0, 0.1);
            arm.elbow.rotation.z = THREE.MathUtils.lerp(arm.elbow.rotation.z, targetElbowZ, 0.1);

        } else {
            // IDLE MODE
            const sway = (this.speed > 0.005) ? Math.sin(this.walkCycle + (isLeft ? 0 : Math.PI)) * 0.1 : 0;

            arm.shoulder.rotation.x = THREE.MathUtils.lerp(arm.shoulder.rotation.x, sway, 0.1);
            arm.shoulder.rotation.z = THREE.MathUtils.lerp(arm.shoulder.rotation.z, 0, 0.1);

            arm.elbow.rotation.x = THREE.MathUtils.lerp(arm.elbow.rotation.x, -0.1, 0.1);
            arm.elbow.rotation.z = THREE.MathUtils.lerp(arm.elbow.rotation.z, 0, 0.1);
        }
    }
}
