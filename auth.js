// =========================================================
// AUTHENTICATION (users.json + admin.json) & USER MANAGEMENT
// =========================================================
let adminCredentials = null;
const STORAGE_EXTRA_USERS_KEY = "cu_quiz_authorized_users";
const STORAGE_SESSION_KEY = "cu_quiz_current_user";

let authorizedUsers = [];
let currentUser = null;

async function loadAdminCredentials() {
    try {
        const res = await fetch("./data/admin.json");
        if (res.ok) {
            adminCredentials = await res.json();
        } else {
            console.error("Failed to load data/admin.json");
        }
    } catch (err) {
        console.error("Could not load data/admin.json:", err);
    }
}

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
                if (u && u.username && u.password) {
                    const key = u.username.trim().toLowerCase();
                    map.set(key, {
                        name: (u.name || u.username).trim(),
                        username: key,
                        password: u.password
                    });
                }
            });
            authorizedUsers = Array.from(map.values());
            return;
        } catch {
            // ignore parse error
        }
    }

    authorizedUsers = jsonUsers
        .filter(u => u && u.username && u.password)
        .map(u => ({
            name: (u.name || u.username).trim(),
            username: u.username.trim().toLowerCase(),
            password: u.password
        }));
}

function saveAuthorizedUsers() {
    localStorage.setItem(STORAGE_EXTRA_USERS_KEY, JSON.stringify(authorizedUsers));
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
    const enteredUsername = document.getElementById("studentUsernameInput").value.trim().toLowerCase();
    const enteredPassword = document.getElementById("studentPasswordInput").value;
    const errorEl = document.getElementById("studentLoginError");

    const match = authorizedUsers.find(
        u => u.username.toLowerCase() === enteredUsername && u.password === enteredPassword
    );

    if (!match) {
        errorEl.innerText = "Invalid student username or password.";
        return;
    }

    errorEl.innerText = "";
    currentUser = {
        username: match.username,
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

    if (!adminCredentials) {
        errorEl.innerText = "Admin configuration could not be loaded. Check data/admin.json.";
        return;
    }

    if (
        usernameInput !== adminCredentials.username.toLowerCase() ||
        passwordInput !== adminCredentials.password
    ) {
        errorEl.innerText = "Invalid admin username or password.";
        return;
    }

    errorEl.innerText = "";
    currentUser = {
        username: adminCredentials.username,
        name: adminCredentials.name || "Admin",
        role: adminCredentials.role || "admin"
    };
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

// =========================================================
// ADMIN MODAL CONTROLS (CREATE / DELETE / EXPORT USERS)
// =========================================================
window.openAdminModal = () => {
    if (!currentUser || currentUser.role !== "admin") return;
    if (typeof closeMenu === "function") closeMenu();
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
    const username = document.getElementById("newUserUsername").value.trim().toLowerCase();
    const password = document.getElementById("newUserPassword").value;
    const msgEl = document.getElementById("adminFormMsg");

    if (!name || !username || !password) {
        msgEl.className = "form-error";
        msgEl.innerText = "Please fill in name, username, and password.";
        return;
    }

    if (authorizedUsers.some(u => u.username.toLowerCase() === username)) {
        msgEl.className = "form-error";
        msgEl.innerText = `Username "${username}" is already taken.`;
        return;
    }

    authorizedUsers.push({ name, username, password });
    saveAuthorizedUsers();

    msgEl.className = "form-error form-success";
    msgEl.innerText = `"${name}" (${username}) added! Click "Download users.json" to update your GitHub repo.`;
    document.getElementById("addUserForm").reset();
    renderAdminUsersList();
};

window.deleteUser = (usernameToRemove) => {
    if (!currentUser || currentUser.role !== "admin") return;
    authorizedUsers = authorizedUsers.filter(
        u => u.username.toLowerCase() !== usernameToRemove.toLowerCase()
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
            <span><b>${u.name}</b> <small style="color:#666;">(@${u.username})</small></span>
            <button type="button" class="btn-delete-user" onclick="deleteUser('${u.username.replace(/'/g, "\\'")}')">Remove</button>
        </div>
    `).join("");
}
