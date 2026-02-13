import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160/build/three.module.js";

export class CameraController {
    constructor(camera, character) {
        this.camera = camera;
        this.character = character;
        this.offset = new THREE.Vector3(0, 4, 6);
    }

    update() {
        const targetPos = this.offset.clone();
        targetPos.applyQuaternion(this.character.group.quaternion);
        targetPos.add(this.character.group.position);

        this.camera.position.lerp(targetPos, 0.1);
        this.camera.lookAt(this.character.group.position);
    }
}