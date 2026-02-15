import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160/build/three.module.js";

export class ChunkFactory {
    constructor() {
        this.chunkLength = 20;
        this.chunkWidth = 7;
        this.wallHeight = 15;

        // Shared Materials
        this.mats = {
            floor: new THREE.MeshStandardMaterial({
                color: 0x111111,
                roughness: 0.1,
                metalness: 0.8
            }),
            wall: new THREE.MeshStandardMaterial({
                color: 0x404455, // Slate Blue-Grey
                roughness: 0.2,
                metalness: 0.1
            }),
            neon: new THREE.MeshBasicMaterial({
                color: 0x00ffff
            })
        };

        // Geometries (Reuse to save memory)
        this.geos = {
            floor: new THREE.PlaneGeometry(this.chunkWidth, this.chunkLength),
            wall: new THREE.BoxGeometry(1, this.wallHeight, this.chunkLength),
            pillar: new THREE.BoxGeometry(1.5, this.wallHeight + 1, 2),
            pillarNeon: new THREE.BoxGeometry(1.6, this.wallHeight, 0.2),
            trim: new THREE.BoxGeometry(0.5, 0.2, this.chunkLength),
            blockWall: new THREE.BoxGeometry(this.chunkWidth + 10, this.wallHeight, 1)
        };
    }

    createStandardChunk() {
        const chunk = new THREE.Group();

        // Floor
        const floor = new THREE.Mesh(this.geos.floor, this.mats.floor);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        chunk.add(floor);

        // Grid
        const gridHelper = new THREE.GridHelper(this.chunkWidth, 7, 0x00ffff, 0x222222);
        gridHelper.scale.z = this.chunkLength / this.chunkWidth;
        gridHelper.position.y = 0.02;
        chunk.add(gridHelper);

        // Walls
        this._addWallSide(chunk, -this.chunkWidth / 2 - 0.5);
        this._addWallSide(chunk, this.chunkWidth / 2 + 0.5);

        return chunk;
    }

    createJunctionChunk() {
        const chunk = new THREE.Group();

        const junctionZ = -this.chunkLength / 2 + this.chunkWidth / 2; // -6.5
        const widthOffset = this.chunkLength / 2 + this.chunkWidth / 2; // 13.5

        // LEFT PATH (Rotated +90 deg)
        const leftCorridor = this._createCorridorSegment(-widthOffset, 0, junctionZ, Math.PI / 2);
        chunk.add(leftCorridor);

        // RIGHT PATH (Rotated -90 deg)
        const rightCorridor = this._createCorridorSegment(widthOffset, 0, junctionZ, -Math.PI / 2);
        chunk.add(rightCorridor);

        // APPROACH WALLS (The path leading up to the T)
        const approachLength = this.chunkLength - this.chunkWidth; // 13
        const approachZ = (this.chunkLength / 2) - (approachLength / 2); // 3.5

        this._addApproachWall(chunk, -this.chunkWidth / 2 - 0.5, approachLength, approachZ);
        this._addApproachWall(chunk, this.chunkWidth / 2 + 0.5, approachLength, approachZ);

        // CENTER GRID
        const grid = new THREE.GridHelper(this.chunkWidth, 7, 0xff0000, 0x111111);
        grid.position.set(0, 0.02, junctionZ);
        grid.scale.z = 1;
        chunk.add(grid);

        // BLOCKING WALL (End)
        const blockWall = new THREE.Mesh(this.geos.blockWall, this.mats.wall);
        blockWall.position.set(0, this.wallHeight / 2, -this.chunkLength / 2);
        blockWall.castShadow = true;
        chunk.add(blockWall);

        // SIGN
        this._addSign(chunk);

        return chunk;
    }

    // --- INTERNAL HELPERS ---

    _addWallSide(parent, xPos) {
        // Main Wall
        const wall = new THREE.Mesh(this.geos.wall, this.mats.wall);
        wall.position.set(xPos, this.wallHeight / 2, 0);
        wall.receiveShadow = true;
        parent.add(wall);

        // Pillar
        const pillar = new THREE.Mesh(this.geos.pillar, this.mats.wall);
        pillar.position.set(xPos, this.wallHeight / 2, this.chunkLength / 2);
        parent.add(pillar);

        // Neon
        const vNeon = new THREE.Mesh(this.geos.pillarNeon, this.mats.neon);
        vNeon.position.set(xPos, this.wallHeight / 2, this.chunkLength / 2);
        parent.add(vNeon);

        // Trims
        const t1 = new THREE.Mesh(this.geos.trim, this.mats.neon);
        t1.position.set((xPos > 0 ? xPos - 0.5 : xPos + 0.5), 4, 0);
        parent.add(t1);

        const t2 = new THREE.Mesh(this.geos.trim, this.mats.neon);
        t2.position.set((xPos > 0 ? xPos - 0.5 : xPos + 0.5), this.wallHeight - 1, 0); // Top Trim?
        // Original code only had one trim in 'spawnChunk' but two in 'spawnTJunction helper'.
        // Standardizing to ONE text-trim for now to match spawnChunk, or use 2?
        // Let's use 1 for standard.
        parent.add(t2);
    }

    _createCorridorSegment(px, py, pz, ry) {
        const seg = new THREE.Group();

        // Floor
        const fMesh = new THREE.Mesh(this.geos.floor, this.mats.floor);
        fMesh.rotation.x = -Math.PI / 2;
        fMesh.receiveShadow = true;
        seg.add(fMesh);

        // Grid
        const gHelp = new THREE.GridHelper(this.chunkWidth, 7, 0x00ffff, 0x222222);
        gHelp.scale.z = this.chunkLength / this.chunkWidth;
        gHelp.position.y = 0.02;
        seg.add(gHelp);

        // Walls
        this._addWallSide(seg, -this.chunkWidth / 2 - 0.5);
        this._addWallSide(seg, this.chunkWidth / 2 + 0.5);

        seg.position.set(px, py, pz);
        seg.rotation.y = ry;
        return seg;
    }

    _addApproachWall(parent, xOffset, length, zPos) {
        const wallGeo = new THREE.BoxGeometry(1, this.wallHeight, length);
        const w = new THREE.Mesh(wallGeo, this.mats.wall);
        w.position.set(xOffset, this.wallHeight / 2, zPos);
        w.castShadow = true;
        w.receiveShadow = true;
        parent.add(w);

        const trimGeo = new THREE.BoxGeometry(0.5, 0.2, length);
        const t1 = new THREE.Mesh(trimGeo, this.mats.neon);
        t1.position.set((xOffset > 0 ? xOffset - 0.5 : xOffset + 0.5), 4, zPos);
        parent.add(t1);
    }

    _addSign(parent) {
        const canvas = document.createElement('canvas');
        canvas.width = 512; canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, 512, 128);
        ctx.fillStyle = '#00ffff'; ctx.font = 'bold 60px Arial';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('TURN  <  >', 256, 64);

        const textTex = new THREE.CanvasTexture(canvas);
        const textMat = new THREE.MeshBasicMaterial({ map: textTex });
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(8, 2), textMat);
        sign.position.set(0, 5, -this.chunkLength / 2 + 0.6);
        parent.add(sign);
    }
}
