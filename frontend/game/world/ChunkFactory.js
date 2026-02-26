import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160/build/three.module.js";
import { CONFIG } from "../config.js";

export class ChunkFactory {
    constructor() {
        this.chunkLength = CONFIG.CHUNK_LENGTH;
        this.chunkWidth = CONFIG.CHUNK_WIDTH;
        this.wallHeight = CONFIG.WALL_HEIGHT;

        // Shared Materials
        this.mats = {
            floor: new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.1, metalness: 0.8 }),
            wall: new THREE.MeshStandardMaterial({ color: 0x404455, roughness: 0.2, metalness: 0.1 }),
            neon: new THREE.MeshBasicMaterial({ color: 0x00ffff })
        };

        // Reusable Geometries
        this.geos = {
            floor: new THREE.PlaneGeometry(this.chunkWidth, this.chunkLength),
            wall: new THREE.BoxGeometry(1, this.wallHeight, this.chunkLength),
            pillar: new THREE.BoxGeometry(1.5, this.wallHeight + 1, 2),
            pillarNeon: new THREE.BoxGeometry(1.6, this.wallHeight, 0.2),
            trim: new THREE.BoxGeometry(0.5, 0.2, this.chunkLength),
            blockWall: new THREE.BoxGeometry(this.chunkWidth + 10, this.wallHeight, 1)
        };
    }

    // ─── STANDARD STRAIGHT CHUNK ───────────────────────────────────────────────
    createStandardChunk() {
        const chunk = new THREE.Group();

        const floor = new THREE.Mesh(this.geos.floor, this.mats.floor);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        chunk.add(floor);

        const grid = new THREE.GridHelper(this.chunkWidth, 7, 0x00ffff, 0x222222);
        grid.scale.z = this.chunkLength / this.chunkWidth;
        grid.position.y = 0.02;
        chunk.add(grid);

        this._addWallSide(chunk, -this.chunkWidth / 2 - 0.5);
        this._addWallSide(chunk, this.chunkWidth / 2 + 0.5);

        return chunk;
    }

    // ─── T-JUNCTION CHUNK ──────────────────────────────────────────────────────
    createJunctionChunk() {
        const chunk = new THREE.Group();

        // Geometric constants (relative to chunk center at local origin)
        const junctionZ = -this.chunkLength / 2 + this.chunkWidth / 2; // -6.5
        const widthOffset = this.chunkLength / 2 + this.chunkWidth / 2;  //  13.5

        // ── Approach walls (the straight section leading up to the T) ──
        const approachLen = this.chunkLength - this.chunkWidth;  // 13
        const approachZ = (this.chunkLength / 2) - (approachLen / 2); // 3.5
        this._addApproachWall(chunk, -this.chunkWidth / 2 - 0.5, approachLen, approachZ);
        this._addApproachWall(chunk, this.chunkWidth / 2 + 0.5, approachLen, approachZ);

        // Approach floor
        const approachFloor = new THREE.Mesh(
            new THREE.PlaneGeometry(this.chunkWidth, approachLen), this.mats.floor
        );
        approachFloor.rotation.x = -Math.PI / 2;
        approachFloor.position.z = approachZ;
        chunk.add(approachFloor);

        // ── Left corridor (rotated +90°) ──
        chunk.add(this._createCorridorSegment(-widthOffset, 0, junctionZ, Math.PI / 2));

        // ── Right corridor (rotated -90°) ──
        chunk.add(this._createCorridorSegment(widthOffset, 0, junctionZ, -Math.PI / 2));

        // ── Junction center floor ──
        const centerFloor = new THREE.Mesh(
            new THREE.PlaneGeometry(this.chunkWidth, this.chunkWidth), this.mats.floor
        );
        centerFloor.rotation.x = -Math.PI / 2;
        centerFloor.position.z = junctionZ;
        chunk.add(centerFloor);

        // ── Blocking wall at far end (collision target) ──
        const blockWall = new THREE.Mesh(this.geos.blockWall, this.mats.wall);
        blockWall.position.set(0, this.wallHeight / 2, -this.chunkLength / 2);
        chunk.add(blockWall);

        // ── Direction sign ──
        this._addSign(chunk);

        return chunk;
    }

    // ─── INTERNAL HELPERS ──────────────────────────────────────────────────────

    _addWallSide(parent, xPos) {
        const wall = new THREE.Mesh(this.geos.wall, this.mats.wall);
        wall.position.set(xPos, this.wallHeight / 2, 0);
        wall.receiveShadow = true;
        parent.add(wall);

        const pillar = new THREE.Mesh(this.geos.pillar, this.mats.wall);
        pillar.position.set(xPos, this.wallHeight / 2, this.chunkLength / 2);
        parent.add(pillar);

        const vNeon = new THREE.Mesh(this.geos.pillarNeon, this.mats.neon);
        vNeon.position.set(xPos, this.wallHeight / 2, this.chunkLength / 2);
        parent.add(vNeon);

        const inner = (xPos > 0) ? xPos - 0.5 : xPos + 0.5;

        const t1 = new THREE.Mesh(this.geos.trim, this.mats.neon);
        t1.position.set(inner, 4, 0);
        parent.add(t1);

        const t2 = new THREE.Mesh(this.geos.trim, this.mats.neon);
        t2.position.set(inner, this.wallHeight - 1, 0);
        parent.add(t2);
    }

    _createCorridorSegment(px, py, pz, ry) {
        const seg = new THREE.Group();

        const floor = new THREE.Mesh(this.geos.floor, this.mats.floor);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        seg.add(floor);

        const grid = new THREE.GridHelper(this.chunkWidth, 7, 0x00ffff, 0x222222);
        grid.scale.z = this.chunkLength / this.chunkWidth;
        grid.position.y = 0.02;
        seg.add(grid);

        this._addWallSide(seg, -this.chunkWidth / 2 - 0.5);
        this._addWallSide(seg, this.chunkWidth / 2 + 0.5);

        seg.position.set(px, py, pz);
        seg.rotation.y = ry;
        return seg;
    }

    _addApproachWall(parent, xPos, length, zPos) {
        const wall = new THREE.Mesh(
            new THREE.BoxGeometry(1, this.wallHeight, length), this.mats.wall
        );
        wall.position.set(xPos, this.wallHeight / 2, zPos);
        parent.add(wall);

        const inner = (xPos > 0) ? xPos - 0.5 : xPos + 0.5;
        const trim = new THREE.Mesh(
            new THREE.BoxGeometry(0.5, 0.2, length), this.mats.neon
        );
        trim.position.set(inner, 4, zPos);
        parent.add(trim);
    }

    _addSign(parent) {
        const canvas = document.createElement('canvas');
        canvas.width = 512; canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, 512, 128);
        ctx.fillStyle = '#00ffff'; ctx.font = 'bold 60px Arial';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('DEAD END', 256, 64);

        const sign = new THREE.Mesh(
            new THREE.PlaneGeometry(8, 2),
            new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas) })
        );
        sign.position.set(0, 5, -this.chunkLength / 2 + 0.6);
        parent.add(sign);
    }

    _makeDoorTexture(side) {
        const W = 256, H = 512;
        const canvas = document.createElement("canvas");
        canvas.width = W; canvas.height = H;
        const ctx = canvas.getContext("2d");

        ctx.fillStyle = "#12122a";
        ctx.fillRect(0, 0, W, H);

        const stripeW = 40;
        ctx.save();
        ctx.translate(side === "left" ? W : 0, 0);
        ctx.scale(side === "left" ? -1 : 1, 1);
        for (let i = -H; i < W + H; i += stripeW * 2) {
            ctx.beginPath();
            ctx.moveTo(i, 0); ctx.lineTo(i + stripeW, 0);
            ctx.lineTo(i + stripeW - H, H); ctx.lineTo(i - H, H);
            ctx.closePath();
            ctx.fillStyle = "rgba(255,180,0,0.13)";
            ctx.fill();
        }
        ctx.restore();

        ctx.strokeStyle = "#ff00dc";
        ctx.lineWidth = 3;
        ctx.strokeRect(6, 6, W - 12, H - 12);

        ctx.globalAlpha = 0.18;
        ctx.strokeStyle = "#ff00dc";
        ctx.lineWidth = 1;
        for (let y = 40; y < H; y += 40) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
        }
        ctx.globalAlpha = 1;

        ctx.fillStyle = "#1e0030";
        ctx.fillRect(W / 2 - 28, H / 2 - 20, 56, 40);
        ctx.strokeStyle = "#ff00dc";
        ctx.lineWidth = 2;
        ctx.strokeRect(W / 2 - 28, H / 2 - 20, 56, 40);
        ctx.fillStyle = "#ff00dc";
        ctx.font = "bold 13px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("LOCKED", W / 2, H / 2);

        return new THREE.CanvasTexture(canvas);
    }

    createDoorChunk() {
        const chunk = this.createStandardChunk();

        const doorW = this.chunkWidth / 2;
        const doorH = this.wallHeight;
        const doorD = 0.9;

        const leftTex = this._makeDoorTexture("left");
        const rightTex = this._makeDoorTexture("right");

        const neonMat = new THREE.MeshBasicMaterial({ color: 0xff00dc });
        const warnMat = new THREE.MeshBasicMaterial({ color: 0xff6600 });

        const mkDoorMat = (tex) => [
            new THREE.MeshBasicMaterial({ color: 0x0a0a1a }),
            new THREE.MeshBasicMaterial({ color: 0x0a0a1a }),
            new THREE.MeshBasicMaterial({ color: 0x0a0a1a }),
            new THREE.MeshBasicMaterial({ color: 0x0a0a1a }),
            new THREE.MeshStandardMaterial({ map: tex, roughness: 0.3, metalness: 0.8 }),
            new THREE.MeshStandardMaterial({ map: tex, roughness: 0.3, metalness: 0.8 }),
        ];

        const leftDoor = new THREE.Mesh(new THREE.BoxGeometry(doorW, doorH, doorD), mkDoorMat(leftTex));
        leftDoor.position.set(-doorW / 2, doorH / 2, 0);
        chunk.add(leftDoor);

        const rightDoor = new THREE.Mesh(new THREE.BoxGeometry(doorW, doorH, doorD), mkDoorMat(rightTex));
        rightDoor.position.set(doorW / 2, doorH / 2, 0);
        chunk.add(rightDoor);

        const seam = new THREE.Mesh(new THREE.BoxGeometry(0.15, doorH, doorD + 0.05), neonMat);
        seam.position.set(doorW / 2, 0, 0);
        leftDoor.add(seam);

        const hBar = new THREE.Mesh(new THREE.BoxGeometry(doorW, 0.35, doorD + 0.05), neonMat);
        hBar.position.set(0, doorH * 0.3, 0);
        leftDoor.add(hBar.clone());
        hBar.position.x = 0;
        rightDoor.add(hBar);

        const lightGeo = new THREE.SphereGeometry(0.22, 8, 8);
        const corners = [
            [doorW / 2 - 0.4, doorH / 2 - 0.6, doorD / 2 + 0.1],
            [doorW / 2 - 0.4, -doorH / 2 + 0.6, doorD / 2 + 0.1],
            [-doorW / 2 + 0.4, doorH / 2 - 0.6, doorD / 2 + 0.1],
            [-doorW / 2 + 0.4, -doorH / 2 + 0.6, doorD / 2 + 0.1],
        ];
        for (const [x, y, z] of corners) {
            const l = new THREE.Mesh(lightGeo, warnMat);
            l.position.set(x, y, z);
            leftDoor.add(l);
            const r = l.clone();
            r.position.x = -x;
            rightDoor.add(r);
        }

        chunk.leftDoor = leftDoor;
        chunk.rightDoor = rightDoor;

        return chunk;
    }
}
