/* =========================
   API CONFIG
========================= */
const API_BASE = "https://telehealth-backend-9c46.onrender.com";

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
   DOCTOR LOGIN HANDLER
========================= */
const loginForm = document.getElementById("loginForm");
const phoneInput = document.getElementById("phone");
const passwordInput = document.getElementById("password");

loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const phone = phoneInput.value.trim();
    const password = passwordInput.value.trim();

    if (!phone || !password) {
        alert("Please fill all fields");
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/doc_login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include", // ✅ REQUIRED FOR JWT COOKIE
            body: JSON.stringify({ phone, password })
        });

        if (!res.ok) {
            const text = await res.text();
            alert("Invalid credentials");
            console.error(text);
            return;
        }

        // ✅ JWT cookie is now set by backend
        window.location.href = "/doc_home";

    } catch (err) {
        console.error("Doctor login error:", err);
        alert("Server error. Please try again.");
    }
});

/* =========================
   PREVENT ENTER KEY
========================= */
phoneInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        e.preventDefault();
    }
});
