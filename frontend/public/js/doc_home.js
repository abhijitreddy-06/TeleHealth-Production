/* =========================
   API CONFIG
========================= */
const API_BASE = "https://telehealth-production.onrender.com";

/* =========================
   AUTH GUARD (DOCTOR ONLY)
========================= */
(async () => {
    try {
        const res = await fetch(`${API_BASE}/api/auth/doctor`, {
            credentials: "include"
        });

        if (!res.ok) {
            window.location.href = "/doc_login.html";
        }
    } catch {
        window.location.href = "/doc_login.html";
    }
})();

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
   LOAD DOCTOR DASHBOARD DATA
========================= */
async function loadDashboard() {
    try {
        const res = await fetch(`${API_BASE}/api/video/doctor/dashboard`, {
            credentials: "include"
        });

        if (!res.ok) {
            return;
        }

        const data = await res.json();
        const appointment = data.appointment;

        const container = document.getElementById("appointmentContainer");

        if (!appointment) {
            container.innerHTML = "<p>No active appointments.</p>";
            return;
        }

        container.innerHTML = `
      <div class="appointment-card">
        <h3>Upcoming Appointment</h3>
        <p><strong>Patient:</strong> ${appointment.user_name}</p>
        <p><strong>Date:</strong> ${appointment.appointment_date}</p>
        <p><strong>Time:</strong> ${appointment.appointment_time}</p>
        <button id="startCallBtn">Start Call</button>
      </div>
    `;

        document
            .getElementById("startCallBtn")
            .addEventListener("click", async () => {
                const startRes = await fetch(
                    `${API_BASE}/api/appointments/${appointment.id}/start`,
                    {
                        method: "POST",
                        credentials: "include"
                    }
                );

                const startData = await startRes.json();
                if (startRes.ok) {
                    window.location.href = `/doc_video.html?roomId=${startData.roomId}`;
                } else {
                    alert(startData.error || "Unable to start call");
                }
            });

    } catch (err) {
        console.error("Dashboard load error:", err);
    }
}

loadDashboard();

/* =========================
   CHATBOT (OPTIONAL UI)
========================= */
const chatBubble = document.getElementById("chat-bubble");
const chatbot = document.getElementById("chatbot");

setTimeout(() => {
    chatBubble.classList.add("active");
}, 3000);

chatbot.addEventListener("click", () => {
    alert("Doctor assistant coming soon!");
});
