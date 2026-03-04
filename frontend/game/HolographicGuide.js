import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160/build/three.module.js";
import { CharacterFactory } from "./character_factory.js";

export class HolographicGuide {
    constructor(scene, playerName, onComplete) {
        this.scene = scene;
        this.playerName = playerName;
        this.onComplete = onComplete; // callback passing true when done

        this.stage = 1;
        this.active = true;
        this.timer = 0; // For walk cycle

        // UI Handles
        this.overlay = document.getElementById("tutorial-overlay");
        this.textEl = document.getElementById("tutorial-text");
        this.subtextEl = document.getElementById("tutorial-subtext");

        // 1. Create Mesh Hierarchy via Factory
        this.parts = CharacterFactory.create(scene);
        this.group = this.parts.group;

        // Customize Material for Hologram look
        const holoMat = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            wireframe: true,
            transparent: true,
            opacity: 0.8
        });

        this.group.traverse((child) => {
            if (child.isMesh) {
                child.material = holoMat;
                child.castShadow = false;
                child.receiveShadow = false;
            }
        });

        // 2. Position it floating in front of camera
        this.group.scale.set(0.2, 0.2, 0.2);
        this.group.position.set(0, 1.2, 3.5);
        this.group.rotation.y = Math.PI; // Face the player

        // Start Stage 1 prompts
        this.showPrompt(
            `> TRY TO RUN...`,
            ``
        );
    }

    showPrompt(mainText, subText) {
        this.textEl.textContent = mainText;
        this.subtextEl.textContent = subText;
        this.overlay.classList.remove("hidden");
    }

    hidePrompt() {
        this.overlay.classList.add("hidden");
    }

    update(input) {
        if (!this.active) return;
        this.timer += 0.05;

        // Reset poses each frame, then manually drive the ones we need
        this._resetPoses();

        switch (this.stage) {
            case 1:
                this._handleStage1Walking(input);
                break;
            case 2:
                this._handleStage2Leaning(input);
                break;
            case 3:
                this._handleStage3Arms(input);
                break;
        }
    }

    _resetPoses() {
        this.parts.leftLeg.hip.rotation.set(0, 0, 0);
        this.parts.leftLeg.knee.rotation.set(0, 0, 0);
        this.parts.rightLeg.hip.rotation.set(0, 0, 0);
        this.parts.rightLeg.knee.rotation.set(0, 0, 0);

        this.parts.leftArm.shoulder.rotation.set(0, 0, 0);
        this.parts.leftArm.elbow.rotation.set(0, 0, 0);
        this.parts.rightArm.shoulder.rotation.set(0, 0, 0);
        this.parts.rightArm.elbow.rotation.set(0, 0, 0);

        this.parts.torso.rotation.z = 0;
        this.parts.headGroup.rotation.z = 0;
    }

    _handleStage1Walking(input) {
        // Drive walking animation for hologram
        const cycle = Math.sin(this.timer * 2);
        this.parts.leftLeg.hip.rotation.x = cycle * 0.5;
        this.parts.rightLeg.hip.rotation.x = -cycle * 0.5;
        this.parts.leftArm.shoulder.rotation.x = -cycle * 0.5;
        this.parts.rightArm.shoulder.rotation.x = cycle * 0.5;

        // Check player momentum
        if (input.momentum > 0.5) {
            this.stage = 2;
            this.showPrompt("> SHIFT YOUR WEIGHT TO LEFT AND RIGHT", "");
            // Setup for stage 2 tracking
            this.hasTurnedLeft = false;
            this.hasTurnedRight = false;
            this.timer = 0;
        }
    }

    _handleStage2Leaning(input) {
        // Hologram leaning back and forth to demonstrate
        const lean = Math.sin(this.timer);
        this.parts.torso.rotation.z = lean * 0.3;
        this.parts.headGroup.rotation.z = lean * 0.15;

        // Track player leans
        if (input.turn === "LEFT") this.hasTurnedLeft = true;
        if (input.turn === "RIGHT") this.hasTurnedRight = true;

        if (this.hasTurnedLeft && this.hasTurnedRight) {
            this.stage = 3;
            this.showPrompt("> RAISE YOUR HANDS TO START THE GAME!", "");
        }
    }

    _handleStage3Arms(input) {
        // Hologram raises arms
        this.parts.leftArm.shoulder.rotation.z = Math.PI / 2;
        this.parts.leftArm.shoulder.rotation.y = Math.PI / 6;
        this.parts.rightArm.shoulder.rotation.z = -Math.PI / 2;
        this.parts.rightArm.shoulder.rotation.y = -Math.PI / 6;

        // Check if player raises both arms
        if (input.l_arm > 60 && input.r_arm > 60) {
            this.active = false;
            this.hidePrompt();
            this._triggerSeamlessDrop();
        }
    }

    _triggerSeamlessDrop() {
        // Shrink the hologram
        let scale = 0.2;
        const shrinkTick = setInterval(() => {
            scale -= 0.01;
            if (scale <= 0) {
                scale = 0;
                clearInterval(shrinkTick);
                this.scene.remove(this.group);
                if (this.onComplete) this.onComplete();
            }
            this.group.scale.set(scale, scale, scale);
        }, 16);
    }
}
