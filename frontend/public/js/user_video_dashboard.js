/* =========================
   USER VIDEO DASHBOARD
========================= */

let roomId = null;
let polling = null;

/* =========================
   LOAD APPOINTMENT (USER)
========================= */
async function loadAppointment() {
    try {
        const res = await fetch("/api/appointments/user", {
            credentials: "include"
        });

        if (!res.ok) throw new Error("Failed to fetch");

        const appointments = await res.json();

        // ❌ No active appointment
        if (!appointments.length) {
            clearInterval(polling);
            updateUI({
                doctor: "—",
                date: "—",
                time: "—",
                statusHTML: `
          <i class="fas fa-calendar-times"></i>
          No active appointments.
        `,
                statusClass: "status completed",
                joinDisabled: true
            });
            return;
        }

        const appt = appointments[0];

        document.getElementById("doctorName").innerText =
            `${appt.doctor_name} (${appt.specialization})`;

        document.getElementById("apptDate").innerText = appt.appointment_date;
        document.getElementById("apptTime").innerText = appt.appointment_time;

        // ⏳ Scheduled
        if (appt.status === "scheduled") {
            updateStatus(
                `<i class="fas fa-clock"></i> Waiting for doctor to start the call...`,
                "status waiting",
                true
            );
        }

        // 🎥 Started
        if (appt.status === "started" && appt.room_id) {
            roomId = appt.room_id;
            updateStatus(
                `<i class="fas fa-video"></i> Doctor has started the call`,
                "status ready",
                false
            );
        }

        // ✅ Completed
        if (appt.status === "completed") {
            clearInterval(polling);
            updateStatus(
                `<i class="fas fa-check-circle"></i> Appointment completed`,
                "status completed",
                true
            );
        }

    } catch (err) {
        console.error(err);
        updateStatus(
            `<i class="fas fa-exclamation-triangle"></i> Failed to load appointment`,
            "status error",
            true
        );
    }
}

/* =========================
   JOIN CALL
========================= */
function joinCall() {
    if (!roomId) return;
    window.location.href = `/user_video/${roomId}`;
}

/* =========================
   UI HELPERS
========================= */
function updateStatus(html, className, disableJoin) {
    const statusText = document.getElementById("statusText");
    const joinBtn = document.getElementById("joinBtn");

    statusText.innerHTML = html;
    statusText.className = className;
    joinBtn.disabled = disableJoin;
}

function updateUI({ doctor, date, time, statusHTML, statusClass, joinDisabled }) {
    document.getElementById("doctorName").innerText = doctor;
    document.getElementById("apptDate").innerText = date;
    document.getElementById("apptTime").innerText = time;
    updateStatus(statusHTML, statusClass, joinDisabled);
}

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
   CHATBOT (OPTIONAL)
========================= */
const chatBubble = document.getElementById("chat-bubble");
const chatbot = document.getElementById("chatbot");

setTimeout(() => {
    chatBubble?.classList.add("active");
}, 3000);

chatbot?.addEventListener("click", () => {
    alert("Chatbot feature would open here.");
});

/* =========================
   INIT
========================= */
loadAppointment();
polling = setInterval(loadAppointment, 5000);
