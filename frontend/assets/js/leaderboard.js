import { CONFIG } from "../../game/config.js";

const lbBody = document.getElementById("lb-body");
const lbStatus = document.getElementById("lb-status");

// Helper to prevent XSS from user-submitted names/classes
function escapeHTML(str) {
    if (str === null || str === undefined) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Connect to the same socket URL used by the game
const socket = io(CONFIG.SOCKET_URL);

socket.on("connect", () => {
    console.log("Connected to server, requesting leaderboard...");
    if (lbStatus) lbStatus.textContent = "FETCHING RECORDS...";
    socket.emit("request_leaderboard");
});

socket.on("leaderboard_update", (data) => {
    // Clear the "FETCHING RECORDS..." message
    if (lbStatus) lbStatus.textContent = "";

    if (!lbBody) return;

    if (!Array.isArray(data) || data.length === 0) {
        lbBody.innerHTML = `
            <tr>
                <td colspan="3">
                    <div class="status-msg">NO RECORDS FOUND. BE THE FIRST.</div>
                </td>
            </tr>
        `;
        return;
    }

    lbBody.innerHTML = "";

    data.forEach((entry, index) => {
        const rank = index + 1;
        const tr = document.createElement("tr");
        tr.className = "lb-row";

        // Special classes for top 3
        if (rank === 1) tr.classList.add("rank-1");
        else if (rank === 2) tr.classList.add("rank-2");
        else if (rank === 3) tr.classList.add("rank-3");

        tr.innerHTML = `
            <td>#${rank}</td>
            <td>
                <div class="lb-name">${escapeHTML(entry.name)}</div>
                <div class="lb-class">ID: ${escapeHTML(entry.class)}</div>
            </td>
            <td>${escapeHTML(entry.time_str)}</td>
        `;

        lbBody.appendChild(tr);
    });
});

socket.on("disconnect", () => {
    if (lbBody) {
        lbBody.innerHTML = `
            <tr>
                <td colspan="3">
                    <div class="status-msg" style="color: #ff2244;">CONNECTION LOST</div>
                </td>
            </tr>
        `;
    }
});

socket.on("connect_error", (error) => {
    console.warn("Leaderboard socket connection error:", error);
    if (lbStatus) lbStatus.textContent = "CONNECTION ERROR";
    if (lbBody) {
        lbBody.innerHTML = `
            <tr>
                <td colspan="3">
                    <div class="status-msg" style="color: #ff2244;">UNABLE TO CONNECT TO SERVER</div>
                </td>
            </tr>
        `;
    }
});
