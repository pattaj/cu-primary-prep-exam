// =========================================================
// 1. STATE & COMPETITION CONFIGURATION
// =========================================================
let loadedModules = {};
let currentQuizData = [];
let currentFilter = "NONE";
let isPracticeMode = false;
let currentStudyMode = "QUIZ";
let flashcardIndex = 0;
let currentRound = 1;

const QUESTIONS_PER_ROUND = 6;
const TOTAL_ROUNDS = 3;

// All 12 categories generated from the 700-question bank
const availableModules = [
    { id: "category_01_credit_union_and_civic_ireland", title: "Credit Union & Civic Ireland" },
    { id: "category_02_current_affairs_2025_2026", title: "Current Affairs (2025/2026)" },
    { id: "category_03_mathematics", title: "Mathematics" },
    { id: "category_04_science", title: "Science" },
    { id: "category_05_history", title: "History" },
    { id: "category_06_geography", title: "Geography" },
    { id: "category_07_sport", title: "Sport" },
    { id: "category_08_nature_and_environment", title: "Nature & Environment" },
    { id: "category_09_music", title: "Music" },
    { id: "category_10_literature", title: "Literature" },
    { id: "category_13_general_knowledge", title: "General Knowledge" },
    { id: "category_14_countries_capitals_currency", title: "Countries & Capitals" }
];

function shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// =========================================================
// 2. DATA LOADING & 3-ROUND QUIZ GENERATION
// =========================================================
async function fetchCategory(moduleId) {
    if (loadedModules[moduleId]) return loadedModules[moduleId];
    
    const response = await fetch(`./${moduleId}.json`);
    if (!response.ok) {
        throw new Error(`Failed to load ${moduleId}.json`);
    }
    const rawQuestions = await response.json();

    // In the question bank: Q1-17 = Easy, Q18-34 = Moderate, Q35-50 = Hard
    const processed = rawQuestions.map((q, idx) => {
        let difficulty = "Easy";
        if (idx >= 17 && idx < 34) {
            difficulty = "Moderate";
        } else if (idx >= 34) {
            difficulty = "Hard";
        }
        return {
            ...q,
            difficulty,
            originalIndex: idx,
            categoryId: moduleId
        };
    });

    loadedModules[moduleId] = processed;
    return processed;
}

window.startPracticeQuiz = async () => {
    isPracticeMode = true;
    currentFilter = "PRACTICE_MODE";
    currentRound = 1;

    // Highlight no module as active
    document.querySelectorAll(".menu-btn").forEach(btn => btn.classList.remove("active"));
    document.getElementById("modeToggleContainer").style.display = "none";
    document.getElementById("mainTitle").innerText = "🏆 3-Round Practice Quiz";
    document.getElementById("mainSubtitle").innerText = "Official Irish Credit Union Schools Quiz Structure";

    // Load at least 6 random modules to ensure question variety
    const selectedMods = shuffle(availableModules).slice(0, 6);
    try {
        await Promise.all(selectedMods.map(m => fetchCategory(m.id)));
    } catch (err) {
        alert("Please ensure the 12 category JSON files are in the same directory as index.html.");
        console.error(err);
        return;
    }

    // Partition loaded questions into pools by difficulty
    let easyPool = [];
    let modPool = [];
    let hardPool = [];

    Object.values(loadedModules).forEach(catQuestions => {
        catQuestions.forEach(q => {
            if (q.difficulty === "Easy") easyPool.push(q);
            else if (q.difficulty === "Moderate") modPool.push(q);
            else if (q.difficulty === "Hard") hardPool.push(q);
        });
    });

    easyPool = shuffle(easyPool);
    modPool = shuffle(modPool);
    hardPool = shuffle(hardPool);

    // Build exactly 3 rounds (6 questions each: 2 Easy, 2 Moderate, 2 Hard = 18 total)
    currentQuizData = [];
    for (let r = 1; r <= TOTAL_ROUNDS; r++) {
        const rEasy = easyPool.splice(0, 2);
        const rMod = modPool.splice(0, 2);
        const rHard = hardPool.splice(0, 2);

        const roundSet = [
            { ...rEasy[0], round: r, roundQNum: 1 },
            { ...rEasy[1], round: r, roundQNum: 2 },
            { ...rMod[0], round: r, roundQNum: 3 },
            { ...rMod[1], round: r, roundQNum: 4 },
            { ...rHard[0], round: r, roundQNum: 5 },
            { ...rHard[1], round: r, roundQNum: 6 }
        ];

        currentQuizData.push(...roundSet);
    }

    // Assign global indices for form control
    currentQuizData = currentQuizData.map((q, idx) => ({ ...q, quizIndex: idx, userAnswer: null }));

    renderPracticeQuiz();
    showQuizView();
};

// =========================================================
// 3. QUIZ RENDERING & ROUND NAVIGATION
// =========================================================
function renderPracticeQuiz() {
    const container = document.getElementById("quizContainer");
    container.innerHTML = "";

    const roundIndicator = document.getElementById("roundIndicator");
    roundIndicator.style.display = "block";
    roundIndicator.innerHTML = `
        <div class="round-badge">Round ${currentRound} of ${TOTAL_ROUNDS}</div>
        <div class="round-desc">ILCU Format: Questions 1–2 (Easy), 3–4 (Moderate), 5–6 (Hard)</div>
    `;

    // Filter to current round's 6 questions
    const activeQuestions = currentQuizData.filter(q => q.round === currentRound);

    activeQuestions.forEach(q => {
        const card = document.createElement("div");
        card.className = "question-card";

        const badgeClass = q.difficulty.toLowerCase();
        const cleanQuestion = q.question.replace(/^\d+\.\s*/, "");

        card.innerHTML = `
            <div class="question-header">
                <span class="q-number">Question ${q.roundQNum}</span>
                <span class="difficulty-badge badge-${badgeClass}">${q.difficulty}</span>
                <span class="topic-tag">${q.topic}</span>
            </div>
            <div class="question-title">${cleanQuestion}</div>
        `;

        for (const [key, text] of Object.entries(q.options)) {
            const isChecked = q.userAnswer === key ? "checked" : "";
            const optionId = `q_${q.quizIndex}_${key}`;

            const label = document.createElement("label");
            label.className = "option-label";
            label.htmlFor = optionId;
            label.innerHTML = `
                <input type="radio" id="${optionId}" name="q_${q.quizIndex}" value="${key}" ${isChecked}>
                <span><b>${key}:</b> ${text}</span>
            `;

            label.querySelector("input").addEventListener("change", (e) => {
                saveAnswer(q.quizIndex, e.target.value);
            });

            card.appendChild(label);
        }

        container.appendChild(card);
    });

    updateRoundNavigation();
}

window.saveAnswer = (quizIndex, value) => {
    currentQuizData[quizIndex].userAnswer = value;
};

function updateRoundNavigation() {
    const controls = document.getElementById("paginationControls");
    const prevBtn = document.getElementById("prevPageBtn");
    const nextBtn = document.getElementById("nextPageBtn");
    const submitBtn = document.getElementById("submitQuizBtn");

    controls.style.display = "flex";
    prevBtn.style.display = currentRound > 1 ? "block" : "none";
    prevBtn.innerText = `⬅ Round ${currentRound - 1}`;

    if (currentRound < TOTAL_ROUNDS) {
        nextBtn.style.display = "block";
        nextBtn.innerText = `Round ${currentRound + 1} ➡`;
        submitBtn.style.display = "none";
    } else {
        nextBtn.style.display = "none";
        submitBtn.style.display = "block";
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
}

window.nextRoundOrPage = () => {
    if (currentRound < TOTAL_ROUNDS) {
        currentRound++;
        renderPracticeQuiz();
    }
};

window.prevRoundOrPage = () => {
    if (currentRound > 1) {
        currentRound--;
        renderPracticeQuiz();
    }
};

// =========================================================
// 4. GRADING & ADVANCED ANALYTICS
// =========================================================
window.gradeQuiz = async () => {
    const unanswered = currentQuizData.filter(q => !q.userAnswer).length;
    if (unanswered > 0) {
        const modal = document.getElementById("customModal");
        document.getElementById("modalMessage").innerText =
            `You have ${unanswered} question(s) unanswered across the 3 rounds. Unanswered questions score 0. Do you want to submit?`;
        modal.classList.remove("hidden");

        const proceed = await new Promise(resolve => {
            document.getElementById("modalConfirmBtn").onclick = () => { modal.classList.add("hidden"); resolve(true); };
            document.getElementById("modalCancelBtn").onclick = () => { modal.classList.add("hidden"); resolve(false); };
        });
        if (!proceed) return;
    }

    let totalScore = 0;
    const totalQuestions = currentQuizData.length;
    const roundScores = { 1: 0, 2: 0, 3: 0 };
    const diffScores = { Easy: { correct: 0, total: 6 }, Moderate: { correct: 0, total: 6 }, Hard: { correct: 0, total: 6 } };
    const topicScores = {};

    currentQuizData.forEach(q => {
        const isCorrect = q.userAnswer === q.correct_answer;
        if (isCorrect) {
            totalScore++;
            roundScores[q.round]++;
            diffScores[q.difficulty].correct++;
        }
        if (!topicScores[q.topic]) {
            topicScores[q.topic] = { correct: 0, total: 0 };
        }
        topicScores[q.topic].total++;
        if (isCorrect) topicScores[q.topic].correct++;
    });

    const percentage = Math.round((totalScore / totalQuestions) * 100);
    document.getElementById("overallScoreCircle").innerHTML = `${totalScore}/${totalQuestions}<br><small>${percentage}%</small>`;

    let feedback = "🥉 Keep practicing to sharpen your recall!";
    if (percentage >= 85) {
        feedback = "🥇 Exceptional! Competition Final caliber performance!";
    } else if (percentage >= 65) {
        feedback = "🥈 Strong score! Focus on the harder questions to gain the edge.";
    }
    document.getElementById("overallScoreText").innerText = feedback;

    // 1. Round Stats
    let roundHtml = "";
    for (let r = 1; r <= TOTAL_ROUNDS; r++) {
        roundHtml += `
            <div class="analytics-row">
                <span><b>Round ${r}</b></span>
                <span><b>${roundScores[r]} / 6 pts</b></span>
            </div>`;
    }
    document.getElementById("roundAnalyticsContent").innerHTML = roundHtml;

    // 2. Difficulty Breakdown
    let diffHtml = "";
    ["Easy", "Moderate", "Hard"].forEach(d => {
        const pct = Math.round((diffScores[d].correct / diffScores[d].total) * 100);
        diffHtml += `
            <div class="analytics-row">
                <span class="difficulty-badge badge-${d.toLowerCase()}">${d}</span>
                <span>${diffScores[d].correct} / ${diffScores[d].total} (${pct}%)</span>
            </div>`;
    });
    document.getElementById("difficultyAnalyticsContent").innerHTML = diffHtml;

    // 3. Topic Breakdown
    let topicHtml = "";
    for (const [topic, data] of Object.entries(topicScores)) {
        topicHtml += `
            <div class="analytics-row">
                <span>${topic}</span>
                <span>${data.correct} / ${data.total}</span>
            </div>`;
    }
    document.getElementById("analyticsContent").innerHTML = topicHtml;

    document.getElementById("quizForm").style.display = "none";
    document.getElementById("fullAnalyticsView").style.display = "block";
    window.scrollTo({ top: 0, behavior: "smooth" });
};

window.reviewAnswers = () => {
    document.getElementById("fullAnalyticsView").style.display = "none";
    document.getElementById("quizForm").style.display = "block";
    document.getElementById("paginationControls").style.display = "none";
    document.getElementById("submitQuizBtn").style.display = "none";
    document.getElementById("roundIndicator").style.display = "none";
    document.getElementById("reviewActionBtns").style.display = "flex";

    const container = document.getElementById("quizContainer");
    container.innerHTML = "";

    // Render all 18 questions with correctness highlighting
    currentQuizData.forEach(q => {
        const card = document.createElement("div");
        card.className = "question-card";
        const isCorrect = q.userAnswer === q.correct_answer;

        card.innerHTML = `
            <div class="question-header">
                <span class="q-number">Round ${q.round} — Q${q.roundQNum}</span>
                <span class="difficulty-badge badge-${q.difficulty.toLowerCase()}">${q.difficulty}</span>
                <span style="font-weight:bold; color: ${isCorrect ? '#2e7d32' : '#c62828'};">
                    ${isCorrect ? "✅ Correct" : "❌ Incorrect"}
                </span>
                <span class="topic-tag">${q.topic}</span>
            </div>
            <div class="question-title">${q.question.replace(/^\d+\.\s*/, "")}</div>
        `;

        for (const [key, text] of Object.entries(q.options)) {
            let style = "";
            if (key === q.correct_answer) {
                style = "background: #e8f5e9; border-color: #2e7d32; font-weight: bold;";
            } else if (key === q.userAnswer && !isCorrect) {
                style = "background: #ffebee; border-color: #c62828;";
            }

            const label = document.createElement("label");
            label.className = "option-label";
            label.style.cssText = style;
            label.innerHTML = `
                <input type="radio" disabled ${key === q.userAnswer ? "checked" : ""}>
                <span><b>${key}:</b> ${text}</span>
            `;
            card.appendChild(label);
        }

        const exp = document.createElement("div");
        exp.className = "explanation";
        exp.style.display = "block";
        exp.innerHTML = `💡 <b>Official Answer (${q.correct_answer}):</b> ${q.explanation}`;
        card.appendChild(exp);

        container.appendChild(card);
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
};

window.showAnalytics = () => {
    document.getElementById("quizForm").style.display = "none";
    document.getElementById("fullAnalyticsView").style.display = "block";
    window.scrollTo({ top: 0, behavior: "smooth" });
};

// =========================================================
// 5. SINGLE MODULE BROWSER & FLASHCARDS
// =========================================================
function buildSidebar() {
    const container = document.getElementById("moduleContainer");
    if (!container) return;
    container.innerHTML = "";

    availableModules.forEach(mod => {
        const div = document.createElement("div");
        div.className = "module-group";
        div.innerHTML = `
            <button type="button" class="menu-btn" id="btn_${mod.id}" onclick="loadModule('${mod.id}')">
                📁 ${mod.title}
            </button>
        `;
        container.appendChild(div);
    });
}

window.loadModule = async (moduleId) => {
    isPracticeMode = false;
    currentRound = 1;

    document.querySelectorAll(".menu-btn").forEach(b => b.classList.remove("active"));
    const activeBtn = document.getElementById(`btn_${moduleId}`);
    if (activeBtn) activeBtn.classList.add("active");

    const modMeta = availableModules.find(m => m.id === moduleId);
    document.getElementById("mainTitle").innerText = modMeta.title;
    document.getElementById("mainSubtitle").innerText = "Category Question Bank (50 Questions)";

    const data = await fetchCategory(moduleId);
    currentQuizData = data.map((q, idx) => ({
        ...q,
        round: 1,
        roundQNum: idx + 1,
        quizIndex: idx,
        userAnswer: null
    }));

    document.getElementById("modeToggleContainer").style.display = "flex";
    switchMode(currentStudyMode);
};

window.switchMode = (mode) => {
    currentStudyMode = mode;
    document.getElementById("btnQuizMode").classList.toggle("active", mode === "QUIZ");
    document.getElementById("btnFlashcardMode").classList.toggle("active", mode === "FLASHCARD");

    if (mode === "QUIZ") {
        document.getElementById("flashcardView").style.display = "none";
        renderPracticeQuiz();
        showQuizView();
    } else {
        document.getElementById("quizForm").style.display = "none";
        document.getElementById("fullAnalyticsView").style.display = "none";
        document.getElementById("flashcardView").style.display = "block";
        flashcardIndex = 0;
        renderFlashcard();
    }
};

function renderFlashcard() {
    if (!currentQuizData.length) return;
    const card = currentQuizData[flashcardIndex];

    const fcInner = document.getElementById("flashcardInner");
    fcInner.classList.remove("is-flipped");

    document.getElementById("fcFrontBadge").innerText = `${card.topic} • ${card.difficulty}`;
    document.getElementById("fcFrontText").innerText = card.question.replace(/^\d+\.\s*/, "");
    document.getElementById("fcBackAnswer").innerText = `Answer: (${card.correct_answer}) ${card.options[card.correct_answer]}`;
    document.getElementById("fcBackExplanation").innerText = card.explanation;
    document.getElementById("fcCounter").innerText = `${flashcardIndex + 1} / ${currentQuizData.length}`;
}

window.flipCard = () => {
    document.getElementById("flashcardInner").classList.toggle("is-flipped");
};

window.nextFlashcard = () => {
    if (flashcardIndex < currentQuizData.length - 1) {
        flashcardIndex++;
        renderFlashcard();
    }
};

window.prevFlashcard = () => {
    if (flashcardIndex > 0) {
        flashcardIndex--;
        renderFlashcard();
    }
};

function showQuizView() {
    document.getElementById("fullAnalyticsView").style.display = "none";
    document.getElementById("instructionsText").style.display = "none";
    document.getElementById("quizForm").style.display = "block";
    document.getElementById("flashcardView").style.display = "none";
    document.getElementById("reviewActionBtns").style.display = "none";
}

// Mobile sidebar toggle
window.toggleMenu = () => {
    document.getElementById("sidebar").classList.toggle("open");
    document.getElementById("overlay").classList.toggle("open");
};

// Initialization
window.addEventListener("DOMContentLoaded", () => {
    buildSidebar();
});
