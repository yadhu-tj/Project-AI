import { CONFIG } from "./config.js";

export class InputAdapter {
    constructor(onTelemetry) {
        this.momentum = 0;
        this.turn = "CENTER";
        this.l_arm = 0;
        this.r_arm = 0;
        this.l_wave = 0;
        this.r_wave = 0;

        // Keyboard shadow values — take priority over socket telemetry while held
        this._keyMomentum = 0;
        this._keyTurn = "CENTER";

        console.log(`InputAdapter: Attempting connection to ${CONFIG.SOCKET_URL}...`);
        const socket = io(CONFIG.SOCKET_URL);

        socket.on("connect", () => {
            console.log("✅ InputAdapter: Connected to Server! ID:", socket.id);
        });

        socket.on("connect_error", (err) => {
            console.error("❌ InputAdapter: Connection Error:", err);
        });

        socket.on("disconnect", () => {
            console.warn("⚠️ InputAdapter: Disconnected.");
        });

        socket.on("telemetry", (data) => {
            // Keyboard overrides server telemetry for movement and turn.
            // This prevents socket events with momentum=0 from stopping the
            // character while a key is held.
            this.momentum = this._keyMomentum > 0 ? this._keyMomentum : data.momentum;
            this.turn = this._keyTurn !== "CENTER" ? this._keyTurn : data.turn;

            this.l_arm = data.l_arm;
            this.r_arm = data.r_arm;
            this.l_wave = data.l_wave;
            this.r_wave = data.r_wave;

            if (onTelemetry) onTelemetry(data);
        });

        // KEYBOARD CONTROLS (Dev Mode)
        window.addEventListener("keydown", (e) => {
            const key = e.key.toLowerCase();
            if (key === "w" || key === "arrowup") { this._keyMomentum = 1.0; this.momentum = 1.0; }
            if (key === "a" || key === "arrowleft") { this._keyTurn = "LEFT"; this.turn = "LEFT"; }
            if (key === "d" || key === "arrowright") { this._keyTurn = "RIGHT"; this.turn = "RIGHT"; }
            if (key === "q") this.l_wave = 1;
            if (key === "e") this.r_wave = 1;
            // Z/X = dev arm-raise simulation (used to answer quiz: Z→Option A, X→Option B)
            if (key === "x") this.l_arm = 75;
            if (key === "z") this.r_arm = 75;

            if (onTelemetry) onTelemetry(this);
        });

        window.addEventListener("keyup", (e) => {
            const key = e.key.toLowerCase();
            if (key === "w" || key === "arrowup") { this._keyMomentum = 0; this.momentum = 0; }
            if (key === "a" || key === "arrowleft") { this._keyTurn = "CENTER"; this.turn = "CENTER"; }
            if (key === "d" || key === "arrowright") { this._keyTurn = "CENTER"; this.turn = "CENTER"; }
            if (key === "q") this.l_wave = 0;
            if (key === "e") this.r_wave = 0;
            if (key === "z") this.l_arm = 0;
            if (key === "x") this.r_arm = 0;

            if (onTelemetry) onTelemetry(this);
        });
    }
}
