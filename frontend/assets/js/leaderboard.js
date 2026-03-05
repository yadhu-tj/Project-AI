import { CONFIG } from "../../game/config.js";

const lbBody = document.getElementById("lb-body");
const lbStatus = document.getElementById("lb-status");

// Connect to the same socket URL used by the game
const socket = io(CONFIG.SOCKET_URL);

socket.on("connect", () => {
    console.log("Connected to server, requesting leaderboard...");
    lbStatus.textContent = "FETCHING RECORDS...";
    socket.emit("request_leaderboard");
});

socket.on("leaderboard_update", (data) => {
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
                <div class="lb-name">${entry.name}</div>
                <div class="lb-class">ID: ${entry.class}</div>
            </td>
            <td>${entry.time_str}</td>
        `;

        lbBody.appendChild(tr);
    });
});

socket.on("disconnect", () => {
    lbBody.innerHTML = `
        <tr>
            <td colspan="3">
                <div class="status-msg" style="color: #ff2244;">CONNECTION LOST</div>
            </td>
        </tr>
    `;
});
