// =========================================================
// 0. AUTHENTICATION (users.json + ADMIN) & HISTORY STORAGE
// =========================================================
const ADMIN_CREDENTIALS = { username: "admin", password: "admin123", name: "Admin", role: "admin" };
const STORAGE_EXTRA_USERS_KEY = "cu_quiz_authorized_users";
const STORAGE_SESSION_KEY = "cu_quiz_current_user";
const STORAGE_HISTORY_KEY = "cu_quiz_history";

let authorizedUsers = [];
let currentUser = null;
let currentQuizLabel = "3-Round Practice Quiz";

async function loadAuthorizedUsers() {
    let jsonUsers = [];
    try {
        const res = await fetch("./data/users.json");
        if (res.ok) {
            jsonUsers = await res.json();
        }
    } catch (err) {
        console.warn("Could not load data/users.json, falling back to saved users.", err);
    }

    const savedRaw = localStorage.getItem(STORAGE_EXTRA_USERS_KEY);
    if (savedRaw) {
        try {
            const savedUsers = JSON.parse(savedRaw);
            const map = new Map();
            [...jsonUsers, ...savedUsers].forEach(u => {
                if (u && u.name) map.set(u.name.trim().toLowerCase(), { name: u.name.trim() });
            });
            authorizedUsers = Array.from(map.values());
            return;
        } catch {
            // ignore parse error
        }
    }

    authorizedUsers = jsonUsers.filter(u => u && u.name).map(u => ({ name: u.name.trim() }));
}

function saveAuthorizedUsers() {
    localStorage.setItem(STORAGE_EXTRA_USERS_KEY, JSON.stringify(authorizedUsers));
}

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

window.switchLoginTab = (tab) => {
    const isStudent = tab === "student";
    document.getElementById("tabStudent").classList.toggle("active", isStudent);
    document.getElementById("tabAdmin").classList.toggle("active", !isStudent);
    document.getElementById("studentLoginForm").style.display = isStudent ? "block" : "none";
    document.getElementById("adminLoginForm").style.display = isStudent ? "none" : "block";
    document.getElementById("studentLoginError").innerText = "";
    document.getElementById("adminLoginError").innerText = "";
};

window.handleStudentLogin = (e) => {
    e.preventDefault();
    const enteredName = document.getElementById("studentNameInput").value.trim();
    const errorEl = document.getElementById("studentLoginError");

    const match = authorizedUsers.find(
        u => u.name.toLowerCase() === enteredName.toLowerCase()
    );

    if (!match) {
        errorEl.innerText = `"${enteredName}" is not on the authorized list. Please ask the Admin to add your name.`;
        return;
    }

    errorEl.innerText = "";
    currentUser = {
        username: match.name.toLowerCase(),
        name: match.name,
        role: "user"
    };
    localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(currentUser));
    initAppForUser();
};

window.handleAdminLogin = (e) => {
    e.preventDefault();
    const usernameInput = document.getElementById("loginUsername").value.trim().toLowerCase();
    const passwordInput = document.getElementById("loginPassword").value;
    const errorEl = document.getElementById("adminLoginError");

    if (
        usernameInput !== ADMIN_CREDENTIALS.username ||
        passwordInput !== ADMIN_CREDENTIALS.password
    ) {
        errorEl.innerText = "Invalid admin username or password.";
        return;
    }

    errorEl.innerText = "";
    currentUser = { ...ADMIN_CREDENTIALS };
    localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(currentUser));
    initAppForUser();
};

window.handleLogout = () => {
    currentUser = null;
    localStorage.removeItem(STORAGE_SESSION_KEY);
    document.getElementById("appWrapper").style.display = "none";
    document.getElementById("loginScreen").style.display = "flex";
    document.getElementById("studentLoginForm").reset();
    document.getElementById("adminLoginForm").reset();
};

function initAppForUser() {
    document.getElementById("loginScreen").style.display = "none";
    document.getElementById("appWrapper").style.display = "block";

    document.getElementById("sidebarGreeting").innerText = `👋 Hi, ${currentUser.name}`;
    document.getElementById("mainTitle").innerText = `Hi ${currentUser.name}, take the quiz!`;
    document.getElementById("mainSubtitle").innerText = "Primary Schools Competition Preparation";

    const adminBtn = document.getElementById("adminManageBtn");
    adminBtn.style.display = currentUser.role === "admin" ? "block" : "none";

    document.getElementById("instructionsText").style.display = "block";
    document.getElementById("quizForm").style.display = "none";
    document.getElementById("flashcardView").style.display = "none";
    document.getElementById("fullAnalyticsView").style.display = "none";
    document.getElementById("standaloneHistoryView").style.display = "none";
    document.getElementById("difficultySelector").style.display = "none";
    document.getElementById("modeToggleContainer").style.display = "none";
}

// Admin Modal Controls
window.openAdminModal = () => {
    if (!currentUser || currentUser.role !== "admin") return;
    closeMenu();
    document.getElementById("adminFormMsg").innerText = "";
    document.getElementById("addUserForm").reset();
    renderAdminUsersList();
    document.getElementById("adminModal").classList.remove("hidden");
};

window.closeAdminModal = () => {
    document.getElementById("adminModal").classList.add("hidden");
};

window.handleAddUser = (e) => {
    e.preventDefault();
    if (!currentUser || currentUser.role !== "admin") return;

    const name = document.getElementById("newUserName").value.trim();
    const msgEl = document.getElementById("adminFormMsg");

    if (!name) {
        msgEl.className = "form-error";
        msgEl.innerText = "Please enter a name.";
        return;
    }

    if (authorizedUsers.some(u => u.name.toLowerCase() === name.toLowerCase())) {
        msgEl.className = "form-error";
        msgEl.innerText = `"${name}" is already authorized.`;
        return;
    }

    authorizedUsers.push({ name });
    saveAuthorizedUsers();

    msgEl.className = "form-error form-success";
    msgEl.innerText = `"${name}" added! Click "Download users.json" to update your GitHub repo.`;
    document.getElementById("addUserForm").reset();
    renderAdminUsersList();
};

window.deleteUser = (nameToRemove) => {
    if (!currentUser || currentUser.role !== "admin") return;
    authorizedUsers = authorizedUsers.filter(
        u => u.name.toLowerCase() !== nameToRemove.toLowerCase()
    );
    saveAuthorizedUsers();
    renderAdminUsersList();
};

window.downloadUsersJson = () => {
    const dataStr = JSON.stringify(authorizedUsers, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "users.json";
    a.click();
    URL.revokeObjectURL(url);
};

function renderAdminUsersList() {
    const listEl = document.getElementById("adminUsersList");
    if (!authorizedUsers.length) {
        listEl.innerHTML = `<p style="font-size:13px; color:#666;">No authorized users yet.</p>`;
        return;
    }
    listEl.innerHTML = authorizedUsers.map(u => `
        <div class="analytics-row">
            <span><b>${u.name}</b></span>
            <button type="button" class="btn-delete-user" onclick="deleteUser('${u.name.replace(/'/g, "\\'")}')">Remove</button>
        </div>
    `).join("");
}

// =========================================================
// 1. STATE & COMPETITION CONFIGURATION
// =========================================================
let loadedModules = {};
let currentModuleData = [];
let currentQuizData = [];
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
    { id: "countries", title: "Countries & Capitals" }
];

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

function closeMenu() {
    document.getElementById("sidebar").classList.remove("open");
    document.getElementById("overlay").classList.remove("open");
}

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

    card.innerHTML = `
        <div class="question-header">
            <span class="q-number">Question ${currentQuestionIndex + 1}</span>
            <span class="difficulty-badge badge-${badgeClass}">${q.difficulty}</span>
            <span class="topic-tag">${q.topic}</span>
        </div>
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
// 4. GRADING, ANALYTICS, STRENGTHS/WEAKNESSES & HISTORY
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
    const totalQuestions = currentQuizData.length;
    const roundScores = { 1: 0, 2: 0, 3: 0 };
    const diffScores = {
        Easy: { correct: 0, total: 0 },
        Medium: { correct: 0, total: 0 },
        Difficult: { correct: 0, total: 0 }
    };
    const topicScores = {};

    currentQuizData.forEach(q => {
        const isCorrect = normalizeAnswer(q.userAnswer) === normalizeAnswer(q.correctAnswerText);
        diffScores[q.difficulty].total++;

        if (isCorrect) {
            totalScore++;
            if (roundScores[q.round] !== undefined) {
                roundScores[q.round]++;
            }
            diffScores[q.difficulty].correct++;
        }

        if (!topicScores[q.topic]) {
            topicScores[q.topic] = { correct: 0, total: 0 };
        }
        topicScores[q.topic].total++;
        if (isCorrect) topicScores[q.topic].correct++;
    });

    const percentage = totalQuestions > 0 ? Math.round((totalScore / totalQuestions) * 100) : 0;
    lastScoreSummary = { score: totalScore, total: totalQuestions, percentage };

    // Save attempt to user's progress history
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

    // Populate Analytics Dashboard
    document.getElementById("analyticsHeading").innerText = `Hi ${currentUser.name} — Competition Scorecard`;
    document.getElementById("overallScoreCircle").innerHTML = `${totalScore}/${totalQuestions}<br><small>${percentage}%</small>`;

    let feedback = `🥉 Keep practicing, ${currentUser.name}, to sharpen your recall!`;
    if (percentage >= 85) {
        feedback = `🥇 Exceptional work, ${currentUser.name}! Competition Final caliber performance!`;
    } else if (percentage >= 65) {
        feedback = `🥈 Strong score, ${currentUser.name}! Focus on the harder questions to gain the edge.`;
    }
    document.getElementById("overallScoreText").innerText = feedback;

    let roundHtml = "";
    if (isPracticeMode) {
        for (let r = 1; r <= TOTAL_ROUNDS; r++) {
            roundHtml += `
                <div class="analytics-row">
                    <span><b>Round ${r}</b></span>
                    <span><b>${roundScores[r]} / ${QUESTIONS_PER_ROUND} pts</b></span>
                </div>`;
        }
    } else {
        roundHtml = `
            <div class="analytics-row">
                <span><b>Selected Level</b></span>
                <span><b>${totalScore} / ${totalQuestions} pts</b></span>
            </div>`;
    }
    document.getElementById("roundAnalyticsContent").innerHTML = roundHtml;

    let diffHtml = "";
    ["Easy", "Medium", "Difficult"].forEach(d => {
        const { correct, total } = diffScores[d];
        if (total === 0 && !isPracticeMode) return;
        const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
        diffHtml += `
            <div class="analytics-row">
                <span class="difficulty-badge badge-${d.toLowerCase()}">${d}</span>
                <span>${correct} / ${total} (${pct}%)</span>
            </div>`;
    });
    document.getElementById("difficultyAnalyticsContent").innerHTML = diffHtml;

    // Strengths & Weaknesses
    const strengths = [];
    const weaknesses = [];
    let topicHtml = "";

    for (const [topic, data] of Object.entries(topicScores)) {
        const pct = Math.round((data.correct / data.total) * 100);
        topicHtml += `
            <div class="analytics-row">
                <span>${topic}</span>
                <span>${data.correct} / ${data.total} (${pct}%)</span>
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
        <div class="history-row">
            <div>
                <b>${item.quizTitle}</b>
                <div class="history-date">${item.date} at ${item.time}</div>
            </div>
            <div style="text-align:right;">
                <b>${item.score}/${item.total} (${item.percentage}%)</b>
            </div>
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
            const color = t.pct < 60 ? "#c62828" : t.pct >= 75 ? "#2e7d32" : "#b26a00";
            return `
                <div class="analytics-row">
                    <span>${t.topic}</span>
                    <span style="color:${color}; font-weight:600;">${t.correct}/${t.total} (${t.pct}%) • ${label}</span>
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

    const container = document.getElementById("quizContainer");
    container.innerHTML = `
        <div class="review-score-banner">
            <strong>Hi ${currentUser.name}! Final Score: ${lastScoreSummary.score} / ${lastScoreSummary.total} (${lastScoreSummary.percentage}%)</strong>
            <span>Review the correct answers and explanations below, or click "View Scorecard" for full analytics.</span>
        </div>
    `;

    currentQuizData.forEach((q, idx) => {
        const card = document.createElement("div");
        card.className = "question-card";
        const isCorrect = normalizeAnswer(q.userAnswer) === normalizeAnswer(q.correctAnswerText);
        const qLabel = isPracticeMode ? `Round ${q.round} — Q${q.roundQNum}` : `Question ${idx + 1}`;
        const userText = q.userAnswer && q.userAnswer.trim() ? q.userAnswer.trim() : "(No answer entered)";

        card.innerHTML = `
            <div class="question-header">
                <span class="q-number">${qLabel}</span>
                <span class="difficulty-badge badge-${q.difficulty.toLowerCase()}">${q.difficulty}</span>
                <span style="font-weight:bold; color: ${isCorrect ? '#2e7d32' : '#c62828'};">
                    ${isCorrect ? "✅ Correct" : "❌ Incorrect"}
                </span>
                <span class="topic-tag">${q.topic}</span>
            </div>
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
    document.getElementById("fcFrontText").innerText = card.question.replace(/^\d+\.\s*/, "");
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

window.toggleMenu = () => {
    document.getElementById("sidebar").classList.toggle("open");
    document.getElementById("overlay").classList.toggle("open");
};

window.addEventListener("DOMContentLoaded", async () => {
    buildSidebar();
    await loadAuthorizedUsers();

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
