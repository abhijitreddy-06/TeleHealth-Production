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
   MOBILE MENU
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
   DOCTOR SIGNUP HANDLER
========================= */
const signupForm = document.getElementById("signupForm");
const phoneInput = document.getElementById("phone");
const passwordInput = document.getElementById("password");
const confirmPasswordInput = document.getElementById("confirmpassword");

signupForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const phone = phoneInput.value.trim();
    const password = passwordInput.value.trim();
    const confirmpassword = confirmPasswordInput.value.trim();

    if (!phone || !password || !confirmpassword) {
        alert("Please fill all fields");
        return;
    }

    if (password.length < 6) {
        alert("Password must be at least 6 characters");
        return;
    }

    if (password !== confirmpassword) {
        alert("Passwords do not match");
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/doc_signup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include", // ✅ safe for future cookies
            body: JSON.stringify({ phone, password, confirmpassword })
        });

        const data = await res.json();

        if (!res.ok) {
            alert(data.error || "Signup failed");
            return;
        }

        // ✅ Signup success → redirect to login
        alert("Signup successful. Please login.");
        window.location.href = "/doc_login.html";

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
