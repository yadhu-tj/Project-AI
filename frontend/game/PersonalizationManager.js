/**
 * PersonalizationManager.js
 *
 * Handles the pre-game personalization flow:
 *  1. Renders the #personalization-overlay form.
 *  2. On INITIALIZE: emits `request_questions` to the Python backend via Socket.IO.
 *  3. Listens for `questions_ready` — overwrites QuizManager question banks.
 *  4. Calls onComplete() to hand control back to the game engine.
 *
 * Socket events:
 *   → emit  : 'request_questions'  { name, classId, topic }
 *   ← listen: 'questions_ready'    Array<{text,optA,optB,answer}>  (10 items)
 *   ← listen: 'questions_error'    { message: string }
 */
export class PersonalizationManager {

    /**
     * @param {import('socket.io-client').Socket} socket   - Shared Socket.IO client
     * @param {import('./logic/QuizManager.js').QuizManager} quizManager - Game quiz manager
     * @param {() => void} onComplete - Called when personalization is done; starts calibration
     */
    constructor(socket, quizManager, onComplete) {
        this._socket = socket;
        this._quiz = quizManager;
        this._onComplete = onComplete;

        // DOM refs
        this._overlay = document.getElementById('personalization-overlay');
        this._form = document.getElementById('perso-form');
        this._nameInput = document.getElementById('perso-name');
        this._classInput = document.getElementById('perso-class');
        this._topicInput = document.getElementById('perso-topic');
        this._btn = document.getElementById('perso-init-btn');
        this._status = document.getElementById('perso-status');
    }

    /** Wire up the form and socket listeners. Call once after construction. */
    init() {
        this._form.addEventListener('submit', (e) => {
            e.preventDefault();
            this._handleSubmit();
        });

        this._socket.on('questions_ready', (questions) => {
            this._onQuestionsReady(questions);
        });

        this._socket.on('questions_error', (payload) => {
            this._onError(payload?.message || 'Unknown error from server.');
        });
    }

    // ─── Private ─────────────────────────────────────────────────────────────

    _handleSubmit() {
        const name = this._nameInput.value.trim();
        const classId = this._classInput.value.trim();
        const topic = this._topicInput.value.trim();

        if (!name || !classId || !topic) {
            this._onError('All fields are required.');
            return;
        }

        // Loading state
        this._btn.disabled = true;
        this._status.classList.remove('perso-error');
        this._status.textContent = 'GENERATING SECURE PATHWAY...';

        console.log(`[PersonalizationManager] Emitting request_questions → Topic: "${topic}"`);
        this._socket.emit('request_questions', { name, classId, topic });
    }

    _onQuestionsReady(questions) {
        if (!Array.isArray(questions) || questions.length < 2) {
            this._onError('Received invalid question data. Please retry.');
            return;
        }

        console.log(`[PersonalizationManager] ✅ Received ${questions.length} questions.`);

        // Split 10 questions: first 5 → easy, last 5 → hard
        const half = Math.ceil(questions.length / 2);
        this._quiz.easyQuestions = questions.slice(0, half);
        this._quiz.hardQuestions = questions.slice(half);

        // Rebuild the shuffle deck with the new AI questions
        this._quiz._buildDeck();

        // Expose on window for devtools inspection
        window.__quizManager = this._quiz;

        this._status.textContent = 'PATHWAY SECURED. INITIALIZING...';
        setTimeout(() => this._hideOverlayAndStart(), 900);
    }

    _onError(message) {
        console.error('[PersonalizationManager] ❌ Error:', message);
        this._btn.disabled = false;
        this._status.classList.add('perso-error');
        this._status.textContent = 'ERROR: ' + message.toUpperCase();
    }

    _hideOverlayAndStart() {
        // Animate overlay out
        this._overlay.classList.add('perso-hide');
        // After transition (500ms), fully remove and trigger game
        setTimeout(() => {
            this._overlay.style.display = 'none';
            this._onComplete();
        }, 520);
    }
}
