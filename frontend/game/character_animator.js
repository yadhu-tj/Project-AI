import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160/build/three.module.js";

export class CharacterAnimator {
    constructor(parts) {
        this.parts = parts; // { group, torso, headGroup, leftArm, rightArm, leftLeg, rightLeg }
        this.walkCycle = 0;
        this.speed = 0;      // Exposed so GameManager can read it
        this.maxSpeed = 0.15;
    }

    update(input) {
        // 1. SPEED — driven by walking momentum from input
        const targetSpeed = input.momentum * this.maxSpeed;
        this.speed = THREE.MathUtils.lerp(this.speed, targetSpeed, 0.1);

        // NOTE: Character does NOT move — the world scrolls instead.
        // this.speed is read by GameManager each frame and passed to LevelManager.

        // 2. WALK ANIMATION LOOP
        if (this.speed > 0.005) {
            this.walkCycle += this.speed * 1.5;

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
            // Return legs to neutral when idle
            this.parts.leftLeg.hip.rotation.x = THREE.MathUtils.lerp(this.parts.leftLeg.hip.rotation.x, 0, 0.15);
            this.parts.rightLeg.hip.rotation.x = THREE.MathUtils.lerp(this.parts.rightLeg.hip.rotation.x, 0, 0.15);
            this.parts.leftLeg.knee.rotation.x = THREE.MathUtils.lerp(this.parts.leftLeg.knee.rotation.x, 0, 0.15);
            this.parts.rightLeg.knee.rotation.x = THREE.MathUtils.lerp(this.parts.rightLeg.knee.rotation.x, 0, 0.15);
            this.parts.torso.position.y = THREE.MathUtils.lerp(this.parts.torso.position.y, 1.1, 0.1);
        }

        // 3. ARMS
        this._updateArm(this.parts.leftArm, input.r_arm, input.r_wave, true);
        this._updateArm(this.parts.rightArm, input.l_arm, input.l_wave, false);

        // 4. HEAD idle sway
        this.parts.headGroup.rotation.y = Math.sin(Date.now() * 0.001) * 0.05;

        // 5. Lock torso rotation
        this.parts.torso.rotation.y = 0;
    }

    _updateArm(arm, degrees, waveDegrees, isLeft) {
        const side = isLeft ? -1 : 1;

        if (degrees > 60) {
            // WAVE MODE
            const targetShoulderZ = side * 1.4;
            const waveRad = THREE.MathUtils.degToRad(waveDegrees);
            const targetElbowZ = isLeft ? (-1.9 - waveRad) : (1.9 - waveRad);

            arm.shoulder.rotation.x = THREE.MathUtils.lerp(arm.shoulder.rotation.x, 0, 0.1);
            arm.shoulder.rotation.z = THREE.MathUtils.lerp(arm.shoulder.rotation.z, targetShoulderZ, 0.1);
            arm.elbow.rotation.x = THREE.MathUtils.lerp(arm.elbow.rotation.x, 0, 0.1);
            arm.elbow.rotation.z = THREE.MathUtils.lerp(arm.elbow.rotation.z, targetElbowZ, 0.1);
        } else {
            // IDLE / WALK SWAY
            const sway = (this.speed > 0.005)
                ? Math.sin(this.walkCycle + (isLeft ? 0 : Math.PI)) * 0.1
                : 0;

            arm.shoulder.rotation.x = THREE.MathUtils.lerp(arm.shoulder.rotation.x, sway, 0.1);
            arm.shoulder.rotation.z = THREE.MathUtils.lerp(arm.shoulder.rotation.z, 0, 0.1);
            arm.elbow.rotation.x = THREE.MathUtils.lerp(arm.elbow.rotation.x, -0.1, 0.1);
            arm.elbow.rotation.z = THREE.MathUtils.lerp(arm.elbow.rotation.z, 0, 0.1);
        }
    }
}
