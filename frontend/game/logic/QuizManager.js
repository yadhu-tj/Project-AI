export class QuizManager {
    constructor(gameManager, input) {
        this.gameManager = gameManager;
        this.input = input;

        this.active = false;
        this.timer = 30;
        this.interval = null;
        this.currentQuestion = null;

        // ── Arm-raise debounce: ignore arm spikes shorter than this cooldown ──
        // This prevents walking arm-swings (~l_arm fluctuating briefly > 60)
        // from instantly selecting an answer.
        this._armCooldown = 0;
        this._ARM_COOLDOWN_FRAMES = 20; // ~0.33s at 60fps before an arm triggers answer

        // ── Question banks ──────────────────────────────────────────────────────
        this.easyQuestions = [
            { text: "What is 8 × 7?", optA: "A) 54", optB: "B) 56", answer: "B" },
            { text: "Which is a prime number?", optA: "A) 9", optB: "B) 11", answer: "B" },
            { text: "What is 144 ÷ 12?", optA: "A) 12", optB: "B) 13", answer: "A" },
            { text: "Square root of 81?", optA: "A) 9", optB: "B) 7", answer: "A" },
            { text: "15% of 200 = ?", optA: "A) 30", optB: "B) 25", answer: "A" },
            { text: "True or False: 2³ = 8", optA: "A) True", optB: "B) False", answer: "A" },
            { text: "How many sides has a hexagon?", optA: "A) 5", optB: "B) 6", answer: "B" },
            { text: "0.5 × 0.5 = ?", optA: "A) 0.25", optB: "B) 0.5", answer: "A" },
        ];

        this.hardQuestions = [
            { text: "If f(x) = x² – 4, f(3) = ?", optA: "A) 5", optB: "B) 9", answer: "A" },
            { text: "Next prime after 97?", optA: "A) 101", optB: "B) 103", answer: "A" },
            { text: "log₂(64) = ?", optA: "A) 5", optB: "B) 6", answer: "B" },
            { text: "Fibonacci: _ 8 13 21 ?", optA: "A) 34", optB: "B) 33", answer: "A" },
            {
                text: "Speed = Distance × Time. Solve: D=90, T=1.5. Speed?",
                optA: "A) 60", optB: "B) 135", answer: "A"
            },
            { text: "Angle sum of a pentagon?", optA: "A) 540°", optB: "B) 360°", answer: "A" },
            { text: "2⁸ = ?", optA: "A) 256", optB: "B) 512", answer: "A" },
            { text: "Which sorting algo is O(n log n)?", optA: "A) Bubble", optB: "B) Merge", answer: "B" },
        ];

        // ── UI elements ─────────────────────────────────────────────────────────
        this._overlay = document.getElementById("quiz-overlay");
        this._timerEl = document.getElementById("quiz-timer");
        this._questEl = document.getElementById("quiz-question");
        this._optAEl = document.getElementById("quiz-opt-a");
        this._optBEl = document.getElementById("quiz-opt-b");
    }

    // ── Public: called once when AT_DOOR state is detected ────────────────────
    startQuiz() {
        if (this.active) return;
        this.active = true;
        this.timer = 30;
        this._armCooldown = this._ARM_COOLDOWN_FRAMES; // Start with a grace window

        // Random pool selection (simulates luck of the door chosen)
        const pool = Math.random() > 0.5 ? this.easyQuestions : this.hardQuestions;
        this.currentQuestion = pool[Math.floor(Math.random() * pool.length)];

        // Populate UI
        this._questEl.textContent = this.currentQuestion.text;
        this._optAEl.textContent = this.currentQuestion.optA;
        this._optBEl.textContent = this.currentQuestion.optB;
        this._timerEl.textContent = this.timer;

        // Show overlay
        this._overlay.classList.remove("hidden");

        // Countdown interval
        this.interval = setInterval(() => {
            this.timer -= 1;
            this._timerEl.textContent = this.timer;
            if (this.timer <= 0) {
                this._fail();
            }
        }, 1000);
    }

    // ── Public: called every frame from game_engine.js animate() ─────────────
    update() {
        if (!this.active || this.gameManager.gameState !== "AT_DOOR") return;

        // Decrement arm cooldown (grace period after quiz starts / after walking)
        if (this._armCooldown > 0) {
            this._armCooldown--;
            return;
        }

        const leftRaised = this.input.l_arm > 60;
        const rightRaised = this.input.r_arm > 60;

        if (leftRaised) {
            this._answer("A");
        } else if (rightRaised) {
            this._answer("B");
        }
    }

    // ── Private helpers ────────────────────────────────────────────────────────
    _answer(choice) {
        if (choice === this.currentQuestion.answer) {
            this._success();
        } else {
            this._fail();
        }
    }

    _success() {
        this._clear();
        console.log("✅ Quiz answered correctly — calling addScore().");
        this.gameManager.addScore();
    }

    _fail() {
        this._clear();
        console.log("❌ Quiz failed (wrong answer or timeout) — losing a life.");
        this.gameManager.loseLife();
    }

    _clear() {
        clearInterval(this.interval);
        this.interval = null;
        this.active = false;
        this._overlay.classList.add("hidden");
    }
}
