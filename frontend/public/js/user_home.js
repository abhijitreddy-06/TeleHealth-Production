/* =========================
   API CONFIG
========================= */
const API_BASE = "https://telehealth-backend-9c46.onrender.com";

/* =========================
   THEME TOGGLE (SAFE)
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
    const next = html.getAttribute("data-theme") === "dark" ? "light" : "dark";
    html.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
    updateThemeIcon(next);
}

function updateThemeIcon(theme) {
    const icon = theme === "dark" ? "fa-sun" : "fa-moon";

    if (themeToggle) {
        themeToggle.innerHTML = `<i class="fas ${icon}"></i>`;
    }
    if (mobileThemeToggle) {
        mobileThemeToggle.innerHTML = `<i class="fas ${icon}"></i>`;
    }
}

themeToggle?.addEventListener("click", toggleTheme);
mobileThemeToggle?.addEventListener("click", toggleTheme);

/* =========================
   MOBILE MENU (SAFE)
========================= */
const mobileMenuBtn = document.getElementById("mobileMenuBtn");
const closeMenuBtn = document.getElementById("closeMenu");
const mobileMenu = document.getElementById("mobileMenu");

mobileMenuBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    mobileMenu.classList.add("active");
    document.body.style.overflow = "hidden";
});

closeMenuBtn?.addEventListener("click", () => {
    mobileMenu.classList.remove("active");
    document.body.style.overflow = "auto";
});

document.addEventListener("click", (e) => {
    if (
        mobileMenu?.classList.contains("active") &&
        !mobileMenu.contains(e.target) &&
        e.target !== mobileMenuBtn
    ) {
        mobileMenu.classList.remove("active");
        document.body.style.overflow = "auto";
    }
});

/* =========================
   CHAT BUBBLE
========================= */
const chatBubble = document.getElementById("chat-bubble");
const chatbot = document.getElementById("chatbot");

setTimeout(() => {
    chatBubble?.classList.add("active");
}, 3000);

chatbot?.addEventListener("click", () => {
    alert("Chatbot feature would open here.");
});
