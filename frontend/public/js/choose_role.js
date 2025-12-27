/* =========================
   API CONFIG
========================= */
const API_BASE = "https://telehealth-production.onrender.com";

/* =========================
   THEME TOGGLE
========================= */
const themeToggle = document.getElementById("themeToggle");
const mobileThemeToggle = document.getElementById("mobileThemeToggle");
const html = document.documentElement;

const savedTheme =
    localStorage.getItem("theme") ||
    (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

html.setAttribute("data-theme", savedTheme);
updateThemeIcon(savedTheme);

function toggleTheme() {
    const currentTheme = html.getAttribute("data-theme");
    const newTheme = currentTheme === "dark" ? "light" : "dark";
    html.setAttribute("data-theme", newTheme);
    localStorage.setItem("theme", newTheme);
    updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
    const icon = theme === "dark" ? "fa-sun" : "fa-moon";
    themeToggle.innerHTML = `<i class="fas ${icon}"></i>`;
    mobileThemeToggle.innerHTML = `<i class="fas ${icon}"></i>`;
}

themeToggle.addEventListener("click", toggleTheme);
mobileThemeToggle.addEventListener("click", toggleTheme);

/* =========================
   MOBILE MENU
========================= */
const mobileMenuBtn = document.getElementById("mobileMenuBtn");
const closeMenuBtn = document.getElementById("closeMenu");
const mobileMenu = document.getElementById("mobileMenu");

mobileMenuBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    mobileMenu.classList.add("active");
    document.body.style.overflow = "hidden";
});

closeMenuBtn.addEventListener("click", () => {
    mobileMenu.classList.remove("active");
    document.body.style.overflow = "";
});

document.addEventListener("click", (e) => {
    if (
        mobileMenu.classList.contains("active") &&
        !mobileMenu.contains(e.target) &&
        e.target !== mobileMenuBtn
    ) {
        mobileMenu.classList.remove("active");
        document.body.style.overflow = "";
    }
});

/* =========================
   AUTO REDIRECT IF LOGGED IN
========================= */
(async () => {
    try {
        const userRes = await fetch(`${API_BASE}/api/auth/user`, {
            credentials: "include"
        });

        if (userRes.ok) {
            window.location.href = "/user_home";
            return;
        }

        const docRes = await fetch(`${API_BASE}/api/auth/doctor`, {
            credentials: "include"
        });

        if (docRes.ok) {
            window.location.href = "/doc_home";
        }
    } catch {
        // ignore → stay on role page
    }
})();

/* =========================
   ROLE BUTTONS
========================= */
const doctorLoginBtn = document.getElementById("doctorLoginBtn");
const patientLoginBtn = document.getElementById("patientLoginBtn");

doctorLoginBtn.addEventListener("click", () => {
    window.location.href = "/doc_login";
});

patientLoginBtn.addEventListener("click", () => {
    window.location.href = "/user_login";
});

/* =========================
   CHATBOT (OPTIONAL UI)
========================= */
const chatBubble = document.getElementById("chat-bubble");
const chatbot = document.getElementById("chatbot");

setTimeout(() => {
    chatBubble.classList.add("active");
}, 3000);

chatbot.addEventListener("click", () => {
    alert(
        "Welcome to TeleHealth!\n\n" +
        "Doctor: Manage appointments & prescriptions\n" +
        "Patient: Book appointments & consult doctors"
    );
});
