// ===============================
// THEME TOGGLE
// ===============================
const themeToggle = document.getElementById("themeToggle");
const mobileThemeToggle = document.getElementById("mobileThemeToggle");
const html = document.documentElement;

const savedTheme =
    localStorage.getItem("theme") ||
    (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

html.setAttribute("data-theme", savedTheme);
updateThemeIcon(savedTheme);

function toggleTheme() {
    const current = html.getAttribute("data-theme");
    const next = current === "dark" ? "light" : "dark";
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

// ===============================
// MULTI STEP FORM
// ===============================
const step1 = document.getElementById("step1");
const step2 = document.getElementById("step2");
const step3 = document.getElementById("step3");

const nextBtn1 = document.getElementById("nextBtn1");
const nextBtn2 = document.getElementById("nextBtn2");
const prevBtn1 = document.getElementById("prevBtn1");
const prevBtn2 = document.getElementById("prevBtn2");

const fullNameInput = document.getElementById("fullName");
const specializationInput = document.getElementById("specialization");
const experienceInput = document.getElementById("experience");

// STEP 1 → STEP 2
nextBtn1?.addEventListener("click", () => {
    if (!fullNameInput.value.trim()) {
        alert("Please enter your full name");
        return;
    }
    step1.style.display = "none";
    step2.style.display = "block";
    updateProgress(2);
});

// STEP 2 → STEP 3
nextBtn2?.addEventListener("click", () => {
    if (!specializationInput.value.trim()) {
        alert("Please enter specialization");
        return;
    }
    if (!experienceInput.value.trim()) {
        alert("Please enter experience");
        return;
    }
    step2.style.display = "none";
    step3.style.display = "block";
    updateProgress(3);
});

// BACK BUTTONS
prevBtn1?.addEventListener("click", () => {
    step2.style.display = "none";
    step1.style.display = "block";
    updateProgress(1);
});

prevBtn2?.addEventListener("click", () => {
    step3.style.display = "none";
    step2.style.display = "block";
    updateProgress(2);
});

// ===============================
// PROGRESS BAR
// ===============================
function updateProgress(step) {
    const icons = document.querySelectorAll(".step-icon");
    const texts = document.querySelectorAll(".step-text");

    icons.forEach((icon, i) => {
        icon.classList.toggle("active", i < step);
    });

    texts.forEach((text, i) => {
        text.classList.toggle("active", i < step);
    });
}

// ===============================
// MOBILE MENU TOGGLE
// ===============================
const mobileMenuBtn = document.getElementById("mobileMenuBtn");
const mobileMenu = document.getElementById("mobileMenu");
const closeMenu = document.getElementById("closeMenu");

// Open mobile menu
mobileMenuBtn?.addEventListener("click", () => {
    mobileMenu.classList.add("active");
    document.body.style.overflow = "hidden";
});

// Close mobile menu
closeMenu?.addEventListener("click", () => {
    mobileMenu.classList.remove("active");
    document.body.style.overflow = "auto";
});

// Close menu when clicking on a link
document.querySelectorAll(".mobile-menu a").forEach(link => {
    link.addEventListener("click", () => {
        mobileMenu.classList.remove("active");
        document.body.style.overflow = "auto";
    });
});

// Close menu when clicking outside
mobileMenu?.addEventListener("click", (e) => {
    if (e.target === mobileMenu) {
        mobileMenu.classList.remove("active");
        document.body.style.overflow = "auto";
    }
});
