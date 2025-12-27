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
    if (themeToggle) themeToggle.innerHTML = `<i class="fas ${icon}"></i>`;
    if (mobileThemeToggle) mobileThemeToggle.innerHTML = `<i class="fas ${icon}"></i>`;
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
   PROFILE FORM (MULTI-STEP)
========================= */
const step1 = document.getElementById("step1");
const step2 = document.getElementById("step2");
const step3 = document.getElementById("step3");

const nextBtn1 = document.getElementById("nextBtn1");
const nextBtn2 = document.getElementById("nextBtn2");
const prevBtn1 = document.getElementById("prevBtn1");
const prevBtn2 = document.getElementById("prevBtn2");

const profileForm = document.getElementById("profileForm");

const dobInput = document.getElementById("dob");
const weightInput = document.getElementById("weight");
const weightRange = document.getElementById("weightRange");
const heightInput = document.getElementById("height");
const heightRange = document.getElementById("heightRange");

const genderOptions = document.querySelectorAll(".gender-option");
const otherGenderField = document.getElementById("otherGenderField");
const genderInput = document.getElementById("genderInput");
const customGenderInput = document.getElementById("customGenderInput");

/* =========================
   GENDER SELECTION
========================= */
const initiallySelected = document.querySelector(".gender-option.selected");
if (initiallySelected) {
    genderInput.value = initiallySelected.dataset.gender;
}

genderOptions.forEach((option) => {
    option.addEventListener("click", () => {
        genderOptions.forEach((o) => o.classList.remove("selected"));
        option.classList.add("selected");

        const selected = option.dataset.gender;
        genderInput.value = selected;

        if (selected === "other") {
            otherGenderField.style.display = "block";
        } else {
            otherGenderField.style.display = "none";
            customGenderInput.value = "";
        }
    });
});

/* =========================
   STEP NAVIGATION
========================= */
nextBtn1?.addEventListener("click", () => {
    if (!document.getElementById("fullName").value.trim()) {
        alert("Please enter your name");
        return;
    }
    if (!dobInput.value) {
        alert("Please select your date of birth");
        return;
    }

    step1.style.display = "none";
    step2.style.display = "block";
    updateProgress(2);
});

nextBtn2?.addEventListener("click", () => {
    if (!weightInput.value || !heightInput.value) {
        alert("Please enter weight and height");
        return;
    }

    step2.style.display = "none";
    step3.style.display = "block";
    updateProgress(3);
});

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

/* =========================
   FORM SUBMIT (FINAL)
========================= */
profileForm?.addEventListener("submit", (e) => {
    const bloodGroup = document.getElementById("bloodGroup").value;
    if (!bloodGroup) {
        e.preventDefault();
        alert("Please select your blood group");
        return;
    }

    let gender = genderInput.value;
    if (gender === "other") {
        const cg = customGenderInput.value.trim();
        if (!cg) {
            e.preventDefault();
            alert("Please specify your gender");
            return;
        }
        gender = cg;
    }

    genderInput.value = gender; // ✅ FINAL VALUE SENT TO BACKEND
});

/* =========================
   PROGRESS UI
========================= */
function updateProgress(step) {
    document.querySelectorAll(".step-icon").forEach((icon, i) =>
        icon.classList.toggle("active", i < step)
    );
    document.querySelectorAll(".step-text").forEach((text, i) =>
        text.classList.toggle("active", i < step)
    );
}

/* =========================
   RANGE SYNC
========================= */
weightRange?.addEventListener("input", () => (weightInput.value = weightRange.value));
weightInput?.addEventListener("input", () => (weightRange.value = weightInput.value));

heightRange?.addEventListener("input", () => (heightInput.value = heightRange.value));
heightInput?.addEventListener("input", () => (heightRange.value = heightInput.value));

/* =========================
   DEFAULT VALUES
========================= */
weightInput.value = weightRange.value = 70;
heightInput.value = heightRange.value = 170;

const today = new Date();
const defaultDob = new Date(today.getFullYear() - 30, today.getMonth(), today.getDate());
dobInput.value = defaultDob.toISOString().split("T")[0];
