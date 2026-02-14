export class InputAdapter {
    constructor(onTelemetry) {
        this.momentum = 0;
        this.turn = "CENTER";
        this.l_arm = 0;
        this.r_arm = 0;
        this.l_wave = 0; // New: Lateral Wiper Angle
        this.r_wave = 0;

        // "http://localhost:5000" might need to conform to where it is hosted; 
        // usually it defaults to window.location if served from same origin, 
        // but here we are explicit as requested.
        console.log("InputAdapter: Attempting connection to http://localhost:5000...");
        const socket = io("http://localhost:5000");

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
            // Update internal state
            this.momentum = data.momentum;
            this.turn = data.turn;
            this.l_arm = data.l_arm;
            this.r_arm = data.r_arm;
            this.l_wave = data.l_wave; // New
            this.r_wave = data.r_wave; // New

            // Pass everything to the engine/UI
            if (onTelemetry) {
                onTelemetry(data);
            }
        });

        // KEYBOARD CONTROLS (Dev Mode)
        window.addEventListener("keydown", (e) => {
            const key = e.key.toLowerCase();
            if (key === "w" || key === "arrowup") this.momentum = 1.0;
            if (key === "a" || key === "arrowleft") this.turn = "LEFT";
            if (key === "d" || key === "arrowright") this.turn = "RIGHT";
            if (key === "q") this.l_wave = 1; // Simulate wave right
            if (key === "e") this.r_wave = 1; // Simulate wave left (inverted logic?)

            // Trigger update manually for local input
            if (onTelemetry) onTelemetry(this);
        });

        window.addEventListener("keyup", (e) => {
            const key = e.key.toLowerCase();
            if (key === "w" || key === "arrowup") this.momentum = 0;
            if (key === "a" || key === "arrowleft") this.turn = "CENTER";
            if (key === "d" || key === "arrowright") this.turn = "CENTER";
            if (key === "q") this.l_wave = 0;
            if (key === "e") this.r_wave = 0;

            if (onTelemetry) onTelemetry(this);
        });
    }
}