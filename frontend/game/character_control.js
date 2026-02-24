import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160/build/three.module.js";
import { CharacterFactory } from "./character_factory.js";
import { CharacterAnimator } from "./character_animator.js";

export class CharacterController {
    constructor(scene, input) {
        this.input = input;

        // 1. Create Mesh Hierarchy via Factory
        this.parts = CharacterFactory.create(scene);
        this.group = this.parts.group;

        // 2. Initialize Animator
        this.animator = new CharacterAnimator(this.parts);
    }

    update() {
        // Delegate all movement & animation to the Animator
        this.animator.update(this.input);
    }
}
