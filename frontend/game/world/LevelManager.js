import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160/build/three.module.js";
import { ChunkFactory } from "./ChunkFactory.js";
import { CONFIG } from "../config.js";

export class LevelManager {
    constructor(scene, options = {}) {
        this.scene = scene;
        this.chunks = [];
        this.factory = new ChunkFactory();
        this.factory.setScene(scene);

        this.chunkLength = CONFIG.CHUNK_LENGTH;
        this.renderDistance = CONFIG.RENDER_DISTANCE;
        this.SEQUENCE_LEN = CONFIG.SEQUENCE_LEN;

        this.worldContainer = new THREE.Group();
        scene.add(this.worldContainer);

        this.nextChunkLocalZ = 0;
        this.chunksSpawned = 0;
        this.stopSpawning = false;

        this.travelDistance = 0;

        this.isBlocked = false;
        this.blockerType = null;
        this.activeJunction = null;
        this.activeDoor = null;
        this.justTurned = false;
        this.hasHadFirstJunction = false;

        // Deferred mode: don't generate chunks yet — call initialize() later.
        if (!options.deferred) {
            this._initialSpawn();
        }
    }

    /** Spawns the initial batch of corridor chunks. Call once after tutorial. */
    initialize() {
        if (this._initialized) return;
        this._initialSpawn();
        this._initialized = true;
    }

    _initialSpawn() {
        for (let i = 0; i < this.renderDistance; i++) {
            this._spawnSequence();
        }
    }

    update(speed) {
        this.justTurned = false;

        if (this.isBlocked || speed <= 0) return;

        this.worldContainer.translateZ(speed);
        this.travelDistance += speed;

        if (!this.stopSpawning) {
            const distToFrontier = Math.abs(this.nextChunkLocalZ) - this.travelDistance;
            if (distToFrontier < this.renderDistance * this.chunkLength) {
                this._spawnSequence();
                this._removeOldChunks();
            }
        }

        if (this.activeJunction) {
            const distToWall = Math.abs(this.activeJunction.localZ) + this.chunkLength / 2;
            if (this.travelDistance >= distToWall - 4.0) {
                this.isBlocked = true;
                this.blockerType = "JUNCTION";
            }
        }

        if (this.activeDoor) {
            const distToDoor = Math.abs(this.activeDoor.localZ);
            if (this.travelDistance >= distToDoor - 4.0) {
                this.isBlocked = true;
                this.blockerType = "DOOR";
            }
        }
    }

    handleTurn(direction, characterGroup) {
        const angle = (direction === "LEFT") ? Math.PI / 2 : -Math.PI / 2;

        this.worldContainer.rotation.y += angle;

        if (characterGroup) {
            characterGroup.rotation.y += angle;
        }

        for (const chunk of this.chunks) {
            this.worldContainer.remove(chunk.mesh);
        }
        this.chunks = [];

        this.worldContainer.position.set(0, 0, 0);

        this.nextChunkLocalZ = 0;
        this.chunksSpawned = 0;
        this.stopSpawning = false;
        this.activeJunction = null;
        this.activeDoor = null;
        this.isBlocked = false;
        this.blockerType = null;
        this.travelDistance = 0;
        this.justTurned = true;
        this.hasHadFirstJunction = true;

        for (let i = 0; i < this.renderDistance; i++) {
            this._spawnSequence();
        }
    }

    openActiveDoor() {
        if (!this.activeDoor) return true;

        const leftDoor = this.activeDoor.mesh.leftDoor;
        const rightDoor = this.activeDoor.mesh.rightDoor;

        leftDoor.position.x -= 0.15;
        rightDoor.position.x += 0.15;

        if (leftDoor.position.x < -this.factory.chunkWidth) {
            this.isBlocked = false;
            this.blockerType = null;
            this.activeDoor = null;
            return true;
        }
        return false;
    }

    _spawnSequence() {
        if (this.stopSpawning) return;

        if (this.chunksSpawned === 2 && this.hasHadFirstJunction) {
            this._spawnDoorChunk();
        } else if (this.chunksSpawned > 0 && this.chunksSpawned % this.SEQUENCE_LEN === 0) {
            this._spawnJunctionChunk();
            this.stopSpawning = true;
        } else {
            this._spawnStraightChunk();
        }
        this.chunksSpawned++;
    }

    _spawnStraightChunk() {
        const chunk = this.factory.createStandardChunk();
        chunk.position.z = this.nextChunkLocalZ;
        this.worldContainer.add(chunk);

        this.chunks.push({ mesh: chunk, localZ: this.nextChunkLocalZ, type: "NORMAL" });
        this.nextChunkLocalZ -= this.chunkLength;
    }

    _spawnJunctionChunk() {
        const chunk = this.factory.createJunctionChunk();
        chunk.position.z = this.nextChunkLocalZ;
        this.worldContainer.add(chunk);

        const data = { mesh: chunk, localZ: this.nextChunkLocalZ, type: "JUNCTION" };
        this.chunks.push(data);
        this.activeJunction = data;

        this.nextChunkLocalZ -= this.chunkLength;
    }

    _spawnDoorChunk() {
        const chunk = this.factory.createDoorChunk();
        chunk.position.z = this.nextChunkLocalZ;
        this.worldContainer.add(chunk);

        const data = { mesh: chunk, localZ: this.nextChunkLocalZ, type: "DOOR" };
        this.chunks.push(data);
        this.activeDoor = data;

        this.nextChunkLocalZ -= this.chunkLength;
    }

    _removeOldChunks() {
        const REMOVE_BUFFER = this.chunkLength * 2;

        if (this.chunks.length > 0) {
            const oldest = this.chunks[0];
            const distWhenSpawned = Math.abs(oldest.localZ);
            if (this.travelDistance > distWhenSpawned + REMOVE_BUFFER) {
                this.worldContainer.remove(oldest.mesh);
                this.chunks.shift();
            }
        }
    }

    resetToStart() {
        for (const chunk of this.chunks) {
            this.worldContainer.remove(chunk.mesh);
        }
        this.chunks = [];

        this.worldContainer.position.set(0, 0, 0);
        this.worldContainer.rotation.set(0, 0, 0);

        this.travelDistance = 0;
        this.nextChunkLocalZ = 0;
        this.chunksSpawned = 0;
        this.isBlocked = false;
        this.blockerType = null;
        this.stopSpawning = false;
        this.activeJunction = null;
        this.activeDoor = null;
        this.hasHadFirstJunction = false;

        this.justTurned = true;

        for (let i = 0; i < this.renderDistance; i++) {
            this._spawnSequence();
        }
    }
}
