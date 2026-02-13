export class InputAdapter {
    constructor(onTelemetry) {
        this.momentum = 0;
        this.turn = "CENTER";
        this.l_arm = 0;
        this.r_arm = 0;

        // "http://localhost:5000" might need to conform to where it is hosted; 
        // usually it defaults to window.location if served from same origin, 
        // but here we are explicit as requested.
        const socket = io("http://localhost:5000");

        socket.on("telemetry", (data) => {
            // Update internal state
            this.momentum = data.momentum;
            this.turn = data.turn;
            this.l_arm = data.l_arm;
            this.r_arm = data.r_arm;

            // Pass everything to the engine/UI
            if (onTelemetry) {
                onTelemetry(data);
            }
        });
    }
}