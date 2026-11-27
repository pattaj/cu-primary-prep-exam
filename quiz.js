// =========================================================
// 1. HISTORY STORAGE, STATE, FUZZY MATCHING & HELPERS
// =========================================================
const STORAGE_HISTORY_KEY = "cu_quiz_history";

let currentQuizLabel = "3-Round Practice Quiz";
let loadedModules = {};
let currentModuleData = [];
let currentQuizData = [];
let missedQuestions = [];
let isPracticeMode = false;
let currentStudyMode = "QUIZ";
let flashcardIndex = 0;
let currentQuestionIndex = 0;
let lastScoreSummary = { score: 0, total: 0, percentage: 0 };

const QUESTIONS_PER_ROUND = 6;
const TOTAL_ROUNDS = 3;

const availableModules = [
    { id: "cu-civic", title: "Credit Union & Civic Ireland" },
    { id: "ca", title: "Current Affairs (2025/2026)" },
    { id: "math", title: "Mathematics" },
    { id: "science", title: "Science" },
    { id: "history", title: "History" },
    { id: "geography", title: "Geography" },
    { id: "sports", title: "Sports" },
    { id: "nature-env", title: "Nature & Environment" },
    { id: "music", title: "Music" },
    { id: "literature", title: "Literature" },
    { id: "gen-knowledge", title: "General Knowledge" },
    { id: "countries", title: "Countries & Capitals" },
    { id: "picture-round", title: "Picture Round" }
];

function getAllHistory() {
    const raw = localStorage.getItem(STORAGE_HISTORY_KEY);
    if (!raw) return {};
    try {
        return JSON.parse(raw);
    } catch {
        return {};
    }
}

function getUserHistory(username) {
    const all = getAllHistory();
    return all[username] || [];
}

function saveQuizResultToHistory(username, record) {
    const all = getAllHistory();
    if (!all[username]) all[username] = [];
    all[username].push(record);
    localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(all));
}

function shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function normalizeAnswer(str) {
    return (str || "")
        .toString()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[.,!?;:'"()-]/g, "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");
}

function levenshteinDistance(a, b) {
    const m = a.length;
    const n = b.length;
    const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            dp[i][j] = Math.min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + cost
            );
        }
    }
    return dp[m][n];
}

// Returns "exact", "close" (minor spelling typo), or "wrong"
function evaluateAnswer(userInput, correctAnswerText, acceptedList = []) {
    const normUser = normalizeAnswer(userInput);
    if (!normUser) return "wrong";

    const candidates = [correctAnswerText, ...(Array.isArray(acceptedList) ? acceptedList : [])]
        .map(normalizeAnswer)
        .filter(Boolean);

    if (candidates.includes(normUser)) {
        return "exact";
    }

    for (const target of candidates) {
        if (/^\d+$/.test(target)) continue;

        const maxTypos = target.length >= 9 ? 2 : target.length >= 5 ? 1 : 0;
        if (maxTypos > 0 && levenshteinDistance(normUser, target) <= maxTypos) {
            return "close";
        }
    }

    return "wrong";
}

function renderProgressBar(pct) {
    const color = pct >= 75 ? "#2e7d32" : pct >= 50 ? "#ed6c02" : "#c62828";
    return `
        <div style="width:100%; background:#e5e7eb; border-radius:999px; height:8px; margin-top:5px; overflow:hidden;">
            <div style="width:${pct}%; background:${color}; height:100%; border-radius:999px; transition:width 0.4s ease;"></div>
        </div>
    `;
}

function closeMenu() {
    document.getElementById("sidebar").classList.remove("open");
    document.getElementById("overlay").classList.remove("open");
}

window.toggleMenu = () => {
    document.getElementById("sidebar").classList.toggle("open");
    document.getElementById("overlay").classList.toggle("open");
};

// =========================================================
// 2. DATA LOADING & 3-ROUND QUIZ GENERATION
// =========================================================
async function fetchCategory(moduleId) {
    if (loadedModules[moduleId]) return loadedModules[moduleId];

    const response = await fetch(`./data/${moduleId}.json`);
    if (!response.ok) {
        throw new Error(`Failed to load data/${moduleId}.json`);
    }
    const rawQuestions = await response.json();

    const processed = rawQuestions.map((q, idx) => {
        let difficulty = "Easy";
        if (idx >= 17 && idx < 34) {
            difficulty = "Medium";
        } else if (idx >= 34) {
            difficulty = "Difficult";
        }

        const correctAnswerText =
            q.answer ??
            (q.options && q.options[q.correct_answer]
                ? q.options[q.correct_answer]
                : q.correct_answer) ??
            "";

        return {
            ...q,
            difficulty,
            correctAnswerText,
            originalIndex: idx,
            categoryId: moduleId
        };
    });

    loadedModules[moduleId] = processed;
    return processed;
}

window.startPracticeQuiz = async () => {
    closeMenu();
    isPracticeMode = true;
    currentQuestionIndex = 0;
    currentQuizLabel = "3-Round Practice Quiz";

    document.querySelectorAll(".menu-btn").forEach(btn => btn.classList.remove("active"));
    document.getElementById("difficultySelector").style.display = "none";
    document.getElementById("modeToggleContainer").style.display = "none";
    document.getElementById("standaloneHistoryView").style.display = "none";
    document.getElementById("mainTitle").innerText = `🏆 Hi ${currentUser.name} — 3-Round Practice Quiz`;
    document.getElementById("mainSubtitle").innerText = "Official Irish Credit Union Schools Quiz Structure";

    const selectedMods = shuffle(availableModules).slice(0, 6);
    try {
        await Promise.all(selectedMods.map(m => fetchCategory(m.id)));
    } catch (err) {
        alert("Could not load JSON files. Please ensure they are inside the 'data' folder.");
        console.error(err);
        return;
    }

    let easyPool = [];
    let medPool = [];
    let diffPool = [];

    Object.values(loadedModules).forEach(catQuestions => {
        catQuestions.forEach(q => {
            if (q.difficulty === "Easy") easyPool.push(q);
            else if (q.difficulty === "Medium") medPool.push(q);
            else if (q.difficulty === "Difficult") diffPool.push(q);
        });
    });

    const requiredPerDifficulty = TOTAL_ROUNDS * 2;
    if (
        easyPool.length < requiredPerDifficulty ||
        medPool.length < requiredPerDifficulty ||
        diffPool.length < requiredPerDifficulty
    ) {
        alert("Not enough Easy, Medium, or Difficult questions available to build a 3-round quiz.");
        return;
    }

    easyPool = shuffle(easyPool);
    medPool = shuffle(medPool);
    diffPool = shuffle(diffPool);

    currentQuizData = [];
    for (let r = 1; r <= TOTAL_ROUNDS; r++) {
        const rEasy = easyPool.splice(0, 2);
        const rMed = medPool.splice(0, 2);
        const rDiff = diffPool.splice(0, 2);

        const roundSet = [
            { ...rEasy[0], round: r, roundQNum: 1 },
            { ...rEasy[1], round: r, roundQNum: 2 },
            { ...rMed[0], round: r, roundQNum: 3 },
            { ...rMed[1], round: r, roundQNum: 4 },
            { ...rDiff[0], round: r, roundQNum: 5 },
            { ...rDiff[1], round: r, roundQNum: 6 }
        ];

        currentQuizData.push(...roundSet);
    }

    currentQuizData = currentQuizData.map((q, idx) => ({
        ...q,
        quizIndex: idx,
        userAnswer: ""
    }));

    renderQuestion();
    showQuizView();
};

// =========================================================
// 3. SINGLE-QUESTION RENDERING & NAVIGATION
// =========================================================
function renderQuestion() {
    const container = document.getElementById("quizContainer");
    container.innerHTML = "";

    const q = currentQuizData[currentQuestionIndex];
    if (!q) return;

    const roundIndicator = document.getElementById("roundIndicator");
    roundIndicator.style.display = "block";
    if (isPracticeMode) {
        roundIndicator.innerHTML = `
            <div class="round-badge">Round ${q.round} of ${TOTAL_ROUNDS} • Question ${q.roundQNum} of ${QUESTIONS_PER_ROUND}</div>
            <div class="round-desc">Overall Progress: ${currentQuestionIndex + 1} / ${currentQuizData.length}</div>
        `;
    } else {
        roundIndicator.innerHTML = `
            <div class="round-badge">Question ${currentQuestionIndex + 1} of ${currentQuizData.length}</div>
            <div class="round-desc">Level: ${q.difficulty}</div>
        `;
    }

    const card = document.createElement("div");
    card.className = "question-card";

    const badgeClass = q.difficulty.toLowerCase();
    const cleanQuestion = q.question.replace(/^\d+\.\s*/, "");
    const imageHtml = q.image
        ? `<div class="question-image-wrap">
               <img src="${q.image}" alt="Quiz picture" class="question-image" />
           </div>`
        : "";

    card.innerHTML = `
        <div class="question-header">
            <span class="q-number">Question ${currentQuestionIndex + 1}</span>
            <span class="difficulty-badge badge-${badgeClass}">${q.difficulty}</span>
            <span class="topic-tag">${q.topic}</span>
        </div>
        ${imageHtml}
        <div class="question-title">${cleanQuestion}</div>
        <div class="answer-input-group">
            <input
                type="text"
                id="userAnswerInput"
                class="answer-input"
                placeholder="Type your answer here..."
                autocomplete="off"
            />
        </div>
    `;

    container.appendChild(card);

    const inputEl = document.getElementById("userAnswerInput");
    inputEl.value = q.userAnswer || "";
    inputEl.focus();

    inputEl.addEventListener("input", (e) => {
        currentQuizData[currentQuestionIndex].userAnswer = e.target.value;
    });

    inputEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            if (currentQuestionIndex < currentQuizData.length - 1) {
                nextQuestion();
            } else {
                gradeQuiz();
            }
        }
    });

    updateNavigation();
}

function updateNavigation() {
    const controls = document.getElementById("paginationControls");
    const prevBtn = document.getElementById("prevPageBtn");
    const nextBtn = document.getElementById("nextPageBtn");
    const submitBtn = document.getElementById("submitQuizBtn");

    controls.style.display = "flex";
    prevBtn.style.display = currentQuestionIndex > 0 ? "block" : "none";

    if (currentQuestionIndex < currentQuizData.length - 1) {
        nextBtn.style.display = "block";
        submitBtn.style.display = "none";
    } else {
        nextBtn.style.display = "none";
        submitBtn.style.display = "block";
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
}

window.nextQuestion = () => {
    if (currentQuestionIndex < currentQuizData.length - 1) {
        currentQuestionIndex++;
        renderQuestion();
    }
};

window.prevQuestion = () => {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        renderQuestion();
    }
};

// =========================================================
// 4. GRADING, ANALYTICS, RETRY MISSED & PROGRESS BARS
// =========================================================
window.gradeQuiz = async () => {
    const unanswered = currentQuizData.filter(q => !normalizeAnswer(q.userAnswer)).length;
    if (unanswered > 0) {
        const modal = document.getElementById("customModal");
        document.getElementById("modalMessage").innerText =
            `You have ${unanswered} question(s) unanswered. Unanswered questions score 0. Do you want to submit?`;
        modal.classList.remove("hidden");

        const proceed = await new Promise(resolve => {
            document.getElementById("modalConfirmBtn").onclick = () => {
                modal.classList.add("hidden");
                resolve(true);
            };
            document.getElementById("modalCancelBtn").onclick = () => {
                modal.classList.add("hidden");
                resolve(false);
            };
        });
        if (!proceed) return;
    }

    let totalScore = 0;
    let closeSpellingCount = 0;
    missedQuestions = [];

    const totalQuestions = currentQuizData.length;
    const roundScores = { 1: 0, 2: 0, 3: 0 };
    const diffScores = {
        Easy: { correct: 0, total: 0 },
        Medium: { correct: 0, total: 0 },
        Difficult: { correct: 0, total: 0 }
    };
    const topicScores = {};

    currentQuizData.forEach(q => {
        const status = evaluateAnswer(q.userAnswer, q.correctAnswerText, q.answers);
        q.evalStatus = status;
        const isCorrect = status === "exact" || status === "close";

        diffScores[q.difficulty].total++;

        if (isCorrect) {
            totalScore++;
            if (status === "close") closeSpellingCount++;
            if (roundScores[q.round] !== undefined) {
                roundScores[q.round]++;
            }
            diffScores[q.difficulty].correct++;
        } else {
            missedQuestions.push(q);
        }

        if (!topicScores[q.topic]) {
            topicScores[q.topic] = { correct: 0, total: 0 };
        }
        topicScores[q.topic].total++;
        if (isCorrect) topicScores[q.topic].correct++;
    });

    const percentage = totalQuestions > 0 ? Math.round((totalScore / totalQuestions) * 100) : 0;
    lastScoreSummary = { score: totalScore, total: totalQuestions, percentage };

    const prevHistory = getUserHistory(currentUser.username);
    const prevBest = prevHistory.length ? Math.max(...prevHistory.map(h => h.percentage)) : -1;
    const isPersonalBest = prevHistory.length > 0 && percentage > prevBest;

    const now = new Date();
    saveQuizResultToHistory(currentUser.username, {
        date: now.toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" }),
        time: now.toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit" }),
        quizTitle: currentQuizLabel,
        score: totalScore,
        total: totalQuestions,
        percentage,
        topicScores
    });

    document.getElementById("analyticsHeading").innerText = `Hi ${currentUser.name} — Competition Scorecard`;
    document.getElementById("overallScoreCircle").innerHTML = `${totalScore}/${totalQuestions}<br><small>${percentage}%</small>`;

    let feedback = `🥉 Keep practicing, ${currentUser.name}, to sharpen your recall!`;
    if (percentage >= 85) {
        feedback = `🥇 Exceptional work, ${currentUser.name}! Competition Final caliber performance!`;
    } else if (percentage >= 65) {
        feedback = `🥈 Strong score, ${currentUser.name}! Focus on the harder questions to gain the edge.`;
    }

    const badges = [];
    if (isPersonalBest) {
        badges.push(`<span style="display:inline-block; background:#fef3c7; color:#92400e; padding:3px 10px; border-radius:999px; font-size:12px; font-weight:700; margin-top:6px;">🌟 New Personal Best!</span>`);
    }
    if (closeSpellingCount > 0) {
        badges.push(`<span style="display:inline-block; background:#e0f2fe; color:#075985; padding:3px 10px; border-radius:999px; font-size:12px; font-weight:600; margin-top:6px;">✏️ ${closeSpellingCount} answer(s) accepted with minor typo</span>`);
    }

    const retryBtnHtml = missedQuestions.length > 0
        ? `<div style="margin-top:12px;">
               <button type="button" onclick="retryMissedQuestions()" style="background:#ed6c02; color:#fff; border:none; padding:9px 16px; border-radius:8px; font-weight:600; cursor:pointer;">
                   🔁 Retry ${missedQuestions.length} Missed Question${missedQuestions.length > 1 ? "s" : ""}
               </button>
           </div>`
        : "";

    document.getElementById("overallScoreText").innerHTML = `
        <div>${feedback}</div>
        <div style="display:flex; flex-wrap:wrap; gap:6px; justify-content:center;">${badges.join("")}</div>
        ${retryBtnHtml}
    `;

    let roundHtml = "";
    if (isPracticeMode) {
        for (let r = 1; r <= TOTAL_ROUNDS; r++) {
            const pct = Math.round((roundScores[r] / QUESTIONS_PER_ROUND) * 100);
            roundHtml += `
                <div class="analytics-row" style="flex-direction:column; align-items:stretch;">
                    <div style="display:flex; justify-content:space-between;">
                        <span><b>Round ${r}</b></span>
                        <span><b>${roundScores[r]} / ${QUESTIONS_PER_ROUND} pts (${pct}%)</b></span>
                    </div>
                    ${renderProgressBar(pct)}
                </div>`;
        }
    } else {
        roundHtml = `
            <div class="analytics-row" style="flex-direction:column; align-items:stretch;">
                <div style="display:flex; justify-content:space-between;">
                    <span><b>Selected Level</b></span>
                    <span><b>${totalScore} / ${totalQuestions} pts (${percentage}%)</b></span>
                </div>
                ${renderProgressBar(percentage)}
            </div>`;
    }
    document.getElementById("roundAnalyticsContent").innerHTML = roundHtml;

    let diffHtml = "";
    ["Easy", "Medium", "Difficult"].forEach(d => {
        const { correct, total } = diffScores[d];
        if (total === 0 && !isPracticeMode) return;
        const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
        diffHtml += `
            <div class="analytics-row" style="flex-direction:column; align-items:stretch;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span class="difficulty-badge badge-${d.toLowerCase()}">${d}</span>
                    <span>${correct} / ${total} (${pct}%)</span>
                </div>
                ${renderProgressBar(pct)}
            </div>`;
    });
    document.getElementById("difficultyAnalyticsContent").innerHTML = diffHtml;

    const strengths = [];
    const weaknesses = [];
    let topicHtml = "";

    for (const [topic, data] of Object.entries(topicScores)) {
        const pct = Math.round((data.correct / data.total) * 100);
        topicHtml += `
            <div class="analytics-row" style="flex-direction:column; align-items:stretch;">
                <div style="display:flex; justify-content:space-between;">
                    <span>${topic}</span>
                    <span><b>${data.correct} / ${data.total} (${pct}%)</b></span>
                </div>
                ${renderProgressBar(pct)}
            </div>`;

        if (pct >= 75) {
            strengths.push({ topic, pct, correct: data.correct, total: data.total });
        } else if (pct < 60) {
            weaknesses.push({ topic, pct, correct: data.correct, total: data.total });
        }
    }

    document.getElementById("analyticsContent").innerHTML = topicHtml;

    document.getElementById("strengthsContent").innerHTML = strengths.length
        ? strengths.map(s => `
            <div class="analytics-row">
                <span>✅ ${s.topic}</span>
                <span style="color:#2e7d32; font-weight:600;">${s.pct}%</span>
            </div>`).join("")
        : `<p style="font-size:13px; color:#666;">Score 75%+ in a topic to highlight it as a strength.</p>`;

    document.getElementById("weaknessesContent").innerHTML = weaknesses.length
        ? weaknesses.map(w => `
            <div class="analytics-row">
                <span>📌 ${w.topic}</span>
                <span style="color:#c62828; font-weight:600;">${w.pct}% (${w.correct}/${w.total})</span>
            </div>`).join("")
        : `<p style="font-size:13px; color:#2e7d32;">🎉 Great job! No weak topics in this quiz.</p>`;

    renderProgressSection("progressTrendBanner", "progressHistoryContent");
    reviewAnswers();
};

window.retryMissedQuestions = () => {
    if (!missedQuestions.length) return;

    isPracticeMode = false;
    currentQuestionIndex = 0;
    currentQuizLabel = "Retry Missed Questions";

    document.getElementById("difficultySelector").style.display = "none";
    document.getElementById("modeToggleContainer").style.display = "none";
    document.getElementById("mainTitle").innerText = `🔁 Retry Missed Questions`;
    document.getElementById("mainSubtitle").innerText = `Practicing ${missedQuestions.length} question${missedQuestions.length > 1 ? "s" : ""} you missed`;

    currentQuizData = missedQuestions.map((q, idx) => ({
        ...q,
        round: 1,
        roundQNum: idx + 1,
        quizIndex: idx,
        userAnswer: "",
        evalStatus: undefined
    }));

    renderQuestion();
    showQuizView();
};

function renderProgressSection(trendElId, listElId) {
    const history = getUserHistory(currentUser.username);
    const trendEl = document.getElementById(trendElId);
    const listEl = document.getElementById(listElId);

    if (!history.length) {
        trendEl.innerHTML = "";
        listEl.innerHTML = `<p style="font-size:13px; color:#666;">No quiz history yet. Complete a quiz to start tracking your progress!</p>`;
        return;
    }

    if (history.length >= 2) {
        const latest = history[history.length - 1];
        const prev = history[history.length - 2];
        const diff = latest.percentage - prev.percentage;
        if (diff > 0) {
            trendEl.innerHTML = `<div class="trend-banner trend-up">📈 Improved by +${diff}% compared to your previous attempt (${prev.percentage}% → ${latest.percentage}%)!</div>`;
        } else if (diff < 0) {
            trendEl.innerHTML = `<div class="trend-banner trend-down">📉 Down ${Math.abs(diff)}% from your previous attempt (${prev.percentage}% → ${latest.percentage}%). Review your focus areas!</div>`;
        } else {
            trendEl.innerHTML = `<div class="trend-banner trend-same">➡️ Consistent performance at ${latest.percentage}%!</div>`;
        }
    } else {
        trendEl.innerHTML = `<div class="trend-banner trend-same">🌟 First quiz recorded (${history[0].percentage}%). Take another quiz to track your improvement!</div>`;
    }

    const reversed = [...history].reverse();
    listEl.innerHTML = reversed.map(item => `
        <div class="history-row" style="flex-direction:column; align-items:stretch;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <b>${item.quizTitle}</b>
                    <div class="history-date">${item.date} at ${item.time}</div>
                </div>
                <div style="text-align:right;">
                    <b>${item.score}/${item.total} (${item.percentage}%)</b>
                </div>
            </div>
            ${renderProgressBar(item.percentage)}
        </div>
    `).join("");
}

window.showProgressHistory = () => {
    closeMenu();
    document.getElementById("instructionsText").style.display = "none";
    document.getElementById("quizForm").style.display = "none";
    document.getElementById("flashcardView").style.display = "none";
    document.getElementById("fullAnalyticsView").style.display = "none";
    document.getElementById("difficultySelector").style.display = "none";
    document.getElementById("modeToggleContainer").style.display = "none";
    document.getElementById("standaloneHistoryView").style.display = "block";

    document.getElementById("mainTitle").innerText = `Hi ${currentUser.name}, here is your progress!`;
    document.getElementById("mainSubtitle").innerText = "Track your improvement over time";
    document.getElementById("historyHeading").innerText = `${currentUser.name}'s Progress & History`;

    renderProgressSection("standaloneTrendBanner", "standaloneHistoryContent");

    const history = getUserHistory(currentUser.username);
    const allTopics = {};
    history.forEach(attempt => {
        if (!attempt.topicScores) return;
        for (const [topic, stats] of Object.entries(attempt.topicScores)) {
            if (!allTopics[topic]) allTopics[topic] = { correct: 0, total: 0 };
            allTopics[topic].correct += stats.correct;
            allTopics[topic].total += stats.total;
        }
    });

    const sortedTopics = Object.entries(allTopics)
        .map(([topic, s]) => ({ topic, pct: Math.round((s.correct / s.total) * 100), ...s }))
        .sort((a, b) => a.pct - b.pct);

    const focusEl = document.getElementById("allTimeFocusContent");
    if (!sortedTopics.length) {
        focusEl.innerHTML = `<p style="font-size:13px; color:#666;">Complete a quiz to see your all-time topic strengths and weaknesses.</p>`;
    } else {
        focusEl.innerHTML = sortedTopics.map(t => {
            const label = t.pct < 60 ? "🎯 Focus" : t.pct >= 75 ? "💪 Strong" : "👍 Good";
            const color = t.pct < 60 ? "#c62828" : t.pct >= 75 ? "#2e7d32" : "#ed6c02";
            return `
                <div class="analytics-row" style="flex-direction:column; align-items:stretch;">
                    <div style="display:flex; justify-content:space-between;">
                        <span>${t.topic}</span>
                        <span style="color:${color}; font-weight:600;">${t.correct}/${t.total} (${t.pct}%) • ${label}</span>
                    </div>
                    ${renderProgressBar(t.pct)}
                </div>`;
        }).join("");
    }
};

window.reviewAnswers = () => {
    document.getElementById("fullAnalyticsView").style.display = "none";
    document.getElementById("standaloneHistoryView").style.display = "none";
    document.getElementById("quizForm").style.display = "block";
    document.getElementById("paginationControls").style.display = "none";
    document.getElementById("submitQuizBtn").style.display = "none";
    document.getElementById("roundIndicator").style.display = "none";
    document.getElementById("reviewActionBtns").style.display = "flex";

    const retryBtnHtml = missedQuestions.length > 0
        ? `<div style="margin-top:10px;">
               <button type="button" onclick="retryMissedQuestions()" style="background:#ed6c02; color:#fff; border:none; padding:8px 14px; border-radius:8px; font-weight:600; cursor:pointer;">
                   🔁 Retry ${missedQuestions.length} Missed Question${missedQuestions.length > 1 ? "s" : ""}
               </button>
           </div>`
        : "";

    const container = document.getElementById("quizContainer");
    container.innerHTML = `
        <div class="review-score-banner">
            <strong>Hi ${currentUser.name}! Final Score: ${lastScoreSummary.score} / ${lastScoreSummary.total} (${lastScoreSummary.percentage}%)</strong>
            <span>Review the correct answers and explanations below, or click "View Scorecard" for full analytics.</span>
            ${retryBtnHtml}
        </div>
    `;

    currentQuizData.forEach((q, idx) => {
        const card = document.createElement("div");
        card.className = "question-card";
        const status = q.evalStatus || evaluateAnswer(q.userAnswer, q.correctAnswerText, q.answers);
        const isCorrect = status === "exact" || status === "close";
        const qLabel = isPracticeMode ? `Round ${q.round} — Q${q.roundQNum}` : `Question ${idx + 1}`;
        const userText = q.userAnswer && q.userAnswer.trim() ? q.userAnswer.trim() : "(No answer entered)";

        let statusHtml = `<span style="font-weight:bold; color:#c62828;">❌ Incorrect</span>`;
        if (status === "exact") {
            statusHtml = `<span style="font-weight:bold; color:#2e7d32;">✅ Correct</span>`;
        } else if (status === "close") {
            statusHtml = `<span style="font-weight:bold; color:#b45309;">✨ Almost! (Check spelling — Point Awarded)</span>`;
        }

        const reviewImageHtml = q.image
            ? `<div class="question-image-wrap">
                   <img src="${q.image}" alt="Quiz picture" class="question-image review-thumb" />
               </div>`
            : "";

        card.innerHTML = `
            <div class="question-header">
                <span class="q-number">${qLabel}</span>
                <span class="difficulty-badge badge-${q.difficulty.toLowerCase()}">${q.difficulty}</span>
                ${statusHtml}
                <span class="topic-tag">${q.topic}</span>
            </div>
            ${reviewImageHtml}
            <div class="question-title">${q.question.replace(/^\d+\.\s*/, "")}</div>
            <div class="review-answer ${isCorrect ? 'review-correct' : 'review-wrong'}">
                <b>Your Answer:</b> ${userText}
            </div>
            <div class="explanation" style="display:block;">
                💡 <b>Correct Answer:</b> ${q.correctAnswerText}<br>
                <span style="color:#444;">${q.explanation}</span>
            </div>
        `;

        container.appendChild(card);
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
};

window.showAnalytics = () => {
    document.getElementById("quizForm").style.display = "none";
    document.getElementById("standaloneHistoryView").style.display = "none";
    document.getElementById("fullAnalyticsView").style.display = "block";
    window.scrollTo({ top: 0, behavior: "smooth" });
};

// =========================================================
// 5. SINGLE MODULE BROWSER, DIFFICULTY PICKER & FLASHCARDS
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
    closeMenu();
    isPracticeMode = false;

    document.querySelectorAll(".menu-btn").forEach(b => b.classList.remove("active"));
    const activeBtn = document.getElementById(`btn_${moduleId}`);
    if (activeBtn) activeBtn.classList.add("active");

    const modMeta = availableModules.find(m => m.id === moduleId);
    currentQuizLabel = modMeta.title;
    document.getElementById("mainTitle").innerText = modMeta.title;
    document.getElementById("mainSubtitle").innerText = "Choose a difficulty level (Easy, Medium, or Difficult)";

    try {
        currentModuleData = await fetchCategory(moduleId);
    } catch (err) {
        alert(`Could not load data/${moduleId}.json. Please ensure the JSON file is in the 'data' folder.`);
        console.error(err);
        return;
    }

    document.getElementById("instructionsText").style.display = "none";
    document.getElementById("quizForm").style.display = "none";
    document.getElementById("flashcardView").style.display = "none";
    document.getElementById("fullAnalyticsView").style.display = "none";
    document.getElementById("standaloneHistoryView").style.display = "none";
    document.getElementById("modeToggleContainer").style.display = "none";
    document.getElementById("difficultySelector").style.display = "block";

    document.querySelectorAll(".diff-select-btn").forEach(btn => btn.classList.remove("active"));
};

window.selectDifficulty = (level) => {
    const filtered = currentModuleData.filter(q => q.difficulty === level);
    if (!filtered.length) {
        alert(`No ${level} questions found in this module.`);
        return;
    }

    document.querySelectorAll(".diff-select-btn").forEach(btn => {
        btn.classList.toggle("active", btn.innerText.includes(level));
    });

    const baseTitle = document.getElementById("mainTitle").innerText;
    currentQuizLabel = `${baseTitle} (${level})`;
    document.getElementById("mainSubtitle").innerText = `${level} Level (${filtered.length} Questions)`;

    currentQuestionIndex = 0;
    currentQuizData = filtered.map((q, idx) => ({
        ...q,
        round: 1,
        roundQNum: idx + 1,
        quizIndex: idx,
        userAnswer: ""
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
        renderQuestion();
        showQuizView();
    } else {
        document.getElementById("quizForm").style.display = "none";
        document.getElementById("fullAnalyticsView").style.display = "none";
        document.getElementById("standaloneHistoryView").style.display = "none";
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

    const fcImgHtml = card.image
        ? `<img src="${card.image}" alt="Flashcard picture" class="question-image fc-thumb" />`
        : "";
    document.getElementById("fcFrontText").innerHTML = `${fcImgHtml}<div>${card.question.replace(/^\d+\.\s*/, "")}</div>`;

    document.getElementById("fcBackAnswer").innerText = card.correctAnswerText;
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
    document.getElementById("standaloneHistoryView").style.display = "none";
    document.getElementById("instructionsText").style.display = "none";
    document.getElementById("quizForm").style.display = "block";
    document.getElementById("flashcardView").style.display = "none";
    document.getElementById("reviewActionBtns").style.display = "none";
}

// =========================================================
// 6. APP INITIALIZATION
// =========================================================
window.addEventListener("DOMContentLoaded", async () => {
    buildSidebar();
    await Promise.all([
        loadAuthorizedUsers(),
        loadAdminCredentials()
    ]);

    const savedSession = localStorage.getItem(STORAGE_SESSION_KEY);
    if (savedSession) {
        try {
            currentUser = JSON.parse(savedSession);
            initAppForUser();
        } catch {
            localStorage.removeItem(STORAGE_SESSION_KEY);
        }
    }
});
