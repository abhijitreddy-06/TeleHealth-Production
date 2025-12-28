document.addEventListener("DOMContentLoaded", () => {
    console.log("✅ User Login Script Loaded Successfully");

    /* =========================
       API CONFIG
    ========================= */
    // Ensure this matches your backend URL exactly
    const API_BASE = "https://telehealth-backend-9c46.onrender.com";

    /* =========================
       THEME TOGGLE
    ========================= */
    const themeToggle = document.getElementById("themeToggle");
    const mobileThemeToggle = document.getElementById("mobileThemeToggle");
    const html = document.documentElement;

    const savedTheme = localStorage.getItem("theme") ||
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
        if (themeToggle) themeToggle.innerHTML = `<i class="fas ${icon}"></i>`;
        if (mobileThemeToggle) mobileThemeToggle.innerHTML = `<i class="fas ${icon}"></i>`;
    }

    if (themeToggle) themeToggle.addEventListener("click", toggleTheme);
    if (mobileThemeToggle) mobileThemeToggle.addEventListener("click", toggleTheme);

    /* =========================
       MOBILE MENU
    ========================= */
    const mobileMenuBtn = document.getElementById("mobileMenuBtn");
    const closeMenuBtn = document.getElementById("closeMenu");
    const mobileMenu = document.getElementById("mobileMenu");

    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            mobileMenu.classList.add("active");
            document.body.style.overflow = "hidden";
        });
    }

    if (closeMenuBtn) {
        closeMenuBtn.addEventListener("click", () => {
            mobileMenu.classList.remove("active");
            document.body.style.overflow = "auto";
        });
    }

    document.addEventListener("click", (e) => {
        if (mobileMenu && mobileMenu.classList.contains("active") &&
            !mobileMenu.contains(e.target) &&
            e.target !== mobileMenuBtn
        ) {
            mobileMenu.classList.remove("active");
            document.body.style.overflow = "auto";
        }
    });

    /* =========================
       LOGIN HANDLER (CRITICAL FIX)
    ========================= */
    const loginForm = document.getElementById("loginForm");
    const phoneInput = document.getElementById("phone");
    const passwordInput = document.getElementById("password");

    if (loginForm) {
        console.log("✅ Login Form Found. Attaching Event Listener.");

        loginForm.addEventListener("submit", async (e) => {
            // 1. STOP the form from submitting to the URL
            e.preventDefault();
            console.log("🚀 Form Submitted via JavaScript");

            const phone = phoneInput.value.trim();
            const password = passwordInput.value.trim();

            if (!phone || !password) {
                alert("Please fill all fields");
                return;
            }

            // Optional: Disable button while loading
            const submitBtn = loginForm.querySelector("button[type='submit']");
            const originalBtnText = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = "Signing in...";

            try {
                const res = await fetch(`${API_BASE}/api/user_login`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include", // Important for Cookies
                    body: JSON.stringify({ phone, password })
                });

                const data = await res.json();
                console.log("📥 Server Response:", data);

                if (!res.ok) {
                    throw new Error(data.error || "Login failed");
                }

                // Login Successful
                console.log("✅ Login Success! Redirecting...");
                window.location.href = "/user_home";

            } catch (err) {
                console.error("❌ Login Error:", err);
                alert(err.message || "Server error. Try again.");

                // Re-enable button on error
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnText;
            }
        });
    } else {
        console.error("❌ ERROR: Login Form NOT found in HTML. Check ID 'loginForm'.");
    }

    /* =========================
       PREVENT ENTER KEY (Optional)
    ========================= */
    if (phoneInput) {
        phoneInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                passwordInput.focus(); // Move to password instead of submitting
            }
        });
    }
});