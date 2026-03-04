import { CONFIG } from "../../game/config.js";
export class QuizManager {
    constructor(gameManager, input) {
        this.gameManager = gameManager;
        this.input = input;

        this.active = false;
        this.timer = CONFIG.QUIZ_TIMER_START;
        this.interval = null;
        this.currentQuestion = null;

        // ── Arm-raise debounce ──────────────────────────────────────────────────
        this._armCooldown = 0;
        this._ARM_COOLDOWN_FRAMES = CONFIG.ARM_COOLDOWN_FRAMES;

        // ── No-repeat deck ──────────────────────────────────────────────────────
        // All questions are merged into a shuffled deck. A pointer advances
        // through it so a question can't repeat until ALL have been shown.
        this._deck = [];
        this._deckIndex = 0;

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

        // Build the initial deck from default questions.
        // PersonalizationManager will call _buildDeck() again after injecting new banks.
        this._buildDeck();
    }

    // ── Shuffle all questions into a flat deck ────────────────────────────────
    _buildDeck() {
        const all = [...this.easyQuestions, ...this.hardQuestions];
        // Fisher-Yates shuffle
        for (let i = all.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [all[i], all[j]] = [all[j], all[i]];
        }
        this._deck = all;
        this._deckIndex = 0;
        console.log(`[QuizManager] Deck built: ${this._deck.length} questions, no repeats until exhausted.`);
    }

    // ── Draw next question without repeat ─────────────────────────────────────
    _drawQuestion() {
        if (this._deck.length === 0) return null;  // banks are empty
        if (this._deckIndex >= this._deck.length) {
            // All questions seen — reshuffle for the next round
            this._buildDeck();
            // Guard: rebuilding could still result in an empty deck
            if (this._deck.length === 0) return null;
        }
        return this._deck[this._deckIndex++] ?? null;  // never return undefined
    }

    // ── Public: called once when AT_DOOR state is detected ────────────────────
    startQuiz() {
        if (this.active) return;
        this.active = true;
        this.timer = CONFIG.QUIZ_TIMER_START;
        this._armCooldown = this._ARM_COOLDOWN_FRAMES;

        // Draw the next question from the no-repeat deck
        this.currentQuestion = this._drawQuestion();
        if (this.currentQuestion === null) {
            // No questions available — reset active so the door can retrigger
            this.active = false;
            console.warn('[QuizManager] No questions in deck — skipping quiz.');
            return;
        }

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

        const leftRaised = this.input.l_arm > CONFIG.ARM_RAISE_THRESHOLD;
        const rightRaised = this.input.r_arm > CONFIG.ARM_RAISE_THRESHOLD;

        if (leftRaised) {
            this._answer("B");
        } else if (rightRaised) {
            this._answer("A");
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
        if (!this.active) return;
        this._clear();
        console.log("✅ Quiz answered correctly — calling addScore().");
        this.gameManager.addScore();
    }

    _fail() {
        if (!this.active) return;
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
