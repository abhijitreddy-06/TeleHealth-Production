/* =========================
   API CONFIG
========================= */
const API_BASE = "";

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
   LOGIN HANDLER
========================= */
const loginForm = document.getElementById("loginForm");
const phoneInput = document.getElementById("phone");
const passwordInput = document.getElementById("password");

loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const phone = phoneInput.value.trim();
    const password = passwordInput.value.trim();

    if (!phone || !password) {
        alert("Please fill all fields");
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/user_login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include", // ✅ JWT cookie
            body: JSON.stringify({ phone, password })
        });

        const data = await res.json();

        if (!res.ok) {
            alert(data.error || "Login failed");
            return;
        }

        // ✅ JWT is already created & stored in cookie by backend
        window.location.href = "/user_home";
    } catch (err) {
        console.error(err);
        alert("Server error. Try again.");
    }
});

/* =========================
   PREVENT ENTER KEY
========================= */
phoneInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        e.preventDefault();
    }
});
