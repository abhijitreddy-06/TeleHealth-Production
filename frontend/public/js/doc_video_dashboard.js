/* =========================
   STATE
========================= */
let appointmentId = null;
let polling = null;

/* =========================
   LOAD APPOINTMENT
========================= */
async function loadAppointment() {
    try {
        const res = await fetch("/api/appointments/doctor", {
            credentials: "include"
        });

        const appointments = await res.json();

        const patientName = document.getElementById("patientName");
        const apptDate = document.getElementById("apptDate");
        const apptTime = document.getElementById("apptTime");
        const statusText = document.getElementById("statusText");
        const startBtn = document.getElementById("startBtn");
        const sendBtn = document.getElementById("sendPrescriptionBtn");

        if (!appointments.length) {
            clearInterval(polling);

            patientName.innerText = "—";
            apptDate.innerText = "—";
            apptTime.innerText = "—";

            statusText.innerHTML = `<i class="fas fa-calendar-times"></i> No upcoming appointments`;
            statusText.className = "status completed";

            startBtn.disabled = true;
            startBtn.innerHTML = `<i class="fas fa-calendar-times"></i> No Appointments`;
            startBtn.className = "btn btn-completed";
            return;
        }

        const appt = appointments[0];
        appointmentId = appt.id;

        patientName.innerText = appt.user_name || "Patient";
        apptDate.innerText = appt.appointment_date;
        apptTime.innerText = appt.appointment_time;

        // Scheduled
        if (appt.status === "scheduled") {
            statusText.innerHTML = `<i class="fas fa-clock"></i> Ready to start`;
            statusText.className = "status ready";

            startBtn.disabled = false;
            startBtn.innerHTML = `<i class="fas fa-video"></i> Start Call`;
            startBtn.className = "btn btn-primary";
            startBtn.onclick = startCall;
        }

        // Started
        if (appt.status === "started" && appt.room_id) {
            statusText.innerHTML = `<i class="fas fa-video"></i> Call in progress`;
            statusText.className = "status waiting";

            startBtn.disabled = false;
            startBtn.innerHTML = `<i class="fas fa-sign-in-alt"></i> Join Call`;
            startBtn.className = "btn btn-success";
            startBtn.onclick = () => joinCall(appt.room_id);
        }

        // Completed
        if (appt.status === "completed") {
            clearInterval(polling);

            statusText.innerHTML = `<i class="fas fa-check-circle"></i> Appointment completed`;
            statusText.className = "status completed";

            startBtn.disabled = true;
            startBtn.innerHTML = `<i class="fas fa-check-circle"></i> Completed`;
            startBtn.className = "btn btn-completed";
            startBtn.onclick = null;

            if (sendBtn) sendBtn.style.display = "inline-flex";
        }

    } catch (err) {
        console.error(err);
        const statusText = document.getElementById("statusText");
        if (statusText) {
            statusText.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Failed to load appointment`;
        }
    }
}

/* =========================
   START CALL
========================= */
async function startCall() {
    if (!appointmentId) return;

    try {
        const res = await fetch(`/appointments/${appointmentId}/start`, {
            method: "POST",
            credentials: "include"
        });

        const data = await res.json();

        if (!res.ok) {
            alert(data.error || "Unable to start call");
            return;
        }

        window.location.href = `/doc_video/${data.roomId}`;

    } catch (err) {
        console.error(err);
        alert("Server error while starting call");
    }
}

/* =========================
   JOIN CALL
========================= */
function joinCall(roomId) {
    if (!roomId) return;
    window.location.href = `/doc_video/${roomId}`;
}

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
    const next = html.getAttribute("data-theme") === "dark" ? "light" : "dark";
    html.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
    updateThemeIcon(next);
}

function updateThemeIcon(theme) {
    const icon = theme === "dark" ? "fa-sun" : "fa-moon";
    themeToggle && (themeToggle.innerHTML = `<i class="fas ${icon}"></i>`);
    mobileThemeToggle && (mobileThemeToggle.innerHTML = `<i class="fas ${icon}"></i>`);
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
   CHAT BUBBLE
========================= */
const chatBubble = document.getElementById("chat-bubble");
const chatbot = document.getElementById("chatbot");

setTimeout(() => {
    chatBubble?.classList.add("active");
}, 3000);

chatbot?.addEventListener("click", () => {
    alert("Technical support would open here.");
});

/* =========================
   INIT
========================= */
loadAppointment();
polling = setInterval(loadAppointment, 5000);
