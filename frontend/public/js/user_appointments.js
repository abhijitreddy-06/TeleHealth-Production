/* =====================================================
   THEME TOGGLE (SAFE)
===================================================== */
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

/* =====================================================
   MOBILE MENU (SAFE)
===================================================== */
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

/* =====================================================
   CALENDAR + TIME LOGIC
===================================================== */
let currentDate = new Date();
let selectedDate = null;
let selectedTime = null;

const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

const businessHours = {
    0: { start: 10, end: 16 },
    1: { start: 8, end: 20 },
    2: { start: 8, end: 20 },
    3: { start: 8, end: 20 },
    4: { start: 8, end: 20 },
    5: { start: 8, end: 20 },
    6: { start: 9, end: 17 }
};

function isDatePast(date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
}

function isToday(date) {
    const today = new Date();
    return (
        date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear()
    );
}

function formatDateForInput(date) {
    return date.toISOString().split("T")[0];
}

function formatDate(date) {
    return date.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
    });
}

function formatTime(hour, minute) {
    const ampm = hour >= 12 ? "PM" : "AM";
    const h = hour % 12 || 12;
    return `${h}:${minute.toString().padStart(2, "0")} ${ampm}`;
}

/* =====================================================
   CALENDAR RENDER
===================================================== */
function generateCalendar() {
    const calendarGrid = document.getElementById("calendarGrid");
    const header = document.querySelector(".calendar-header h2");
    if (!calendarGrid || !header) return;

    calendarGrid.querySelectorAll(".calendar-day:not(.header)").forEach(d => d.remove());

    header.innerHTML = `<i class="fas fa-calendar-alt"></i> ${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < firstDay; i++) {
        const empty = document.createElement("div");
        empty.className = "calendar-day empty";
        calendarGrid.appendChild(empty);
    }

    for (let d = 1; d <= totalDays; d++) {
        const date = new Date(year, month, d);
        const cell = document.createElement("div");
        cell.className = "calendar-day";
        cell.textContent = d;

        if (isDatePast(date)) {
            cell.classList.add("disabled");
        } else {
            cell.addEventListener("click", () => selectDate(date));
        }

        if (selectedDate && date.toDateString() === selectedDate.toDateString()) {
            cell.classList.add("selected");
        }

        calendarGrid.appendChild(cell);
    }

    if (selectedDate && !isDatePast(selectedDate)) {
        generateTimeSlots(selectedDate);
    }
}

/* =====================================================
   TIME SLOTS
===================================================== */
function generateTimeSlots(date) {
    const container = document.getElementById("timeSlots");
    if (!container) return;

    container.innerHTML = "";
    const hours = businessHours[date.getDay()];
    if (!hours) return;

    for (let h = hours.start; h < hours.end; h++) {
        for (let m = 0; m < 60; m += 30) {
            const time = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
            const slot = document.createElement("div");
            slot.className = "time-slot";
            slot.textContent = formatTime(h, m);
            slot.dataset.time = time;

            if (!isToday(date) || new Date().getHours() < h) {
                slot.addEventListener("click", () => selectTime(time));
            } else {
                slot.classList.add("disabled");
            }

            if (selectedTime === time) slot.classList.add("selected");
            container.appendChild(slot);
        }
    }
}

/* =====================================================
   SELECT DATE / TIME
===================================================== */
function selectDate(date) {
    if (isDatePast(date)) return;
    selectedDate = date;
    selectedTime = null;

    document.getElementById("selectedDate").value = formatDateForInput(date);
    document.getElementById("displayDate").textContent = formatDate(date);
    document.getElementById("displayTime").textContent = "Not selected";

    generateCalendar();
    generateTimeSlots(date);
    updateSubmitButton();
}

function selectTime(time) {
    selectedTime = time;
    document.getElementById("selectedTime").value = time;

    const [h, m] = time.split(":").map(Number);
    document.getElementById("displayTime").textContent = formatTime(h, m);

    document.querySelectorAll(".time-slot").forEach(s => s.classList.remove("selected"));
    document.querySelector(`[data-time="${time}"]`)?.classList.add("selected");

    updateSubmitButton();
}

/* =====================================================
   DOCTORS
===================================================== */
async function loadDoctors() {
    try {
        const res = await fetch("/api/doctors", { credentials: "include" });
        const doctors = await res.json();

        const select = document.getElementById("doctorSelect");
        select.innerHTML = '<option value="">Select Doctor</option>';

        doctors.forEach(d => {
            const opt = document.createElement("option");
            opt.value = d.id;
            opt.textContent = `${d.full_name} (${d.specialization})`;
            select.appendChild(opt);
        });

        select.addEventListener("change", updateSubmitButton);
    } catch {
        document.getElementById("doctorSelect").innerHTML =
            "<option>Failed to load doctors</option>";
    }
}

/* =====================================================
   SUBMIT
===================================================== */
function updateSubmitButton() {
    const btn = document.getElementById("submitBtn");
    const doctor = document.getElementById("doctorSelect");

    btn.disabled = !(selectedDate && selectedTime && doctor?.value);
}

document.getElementById("appointmentForm")?.addEventListener("submit", (e) => {
    if (!selectedDate || !selectedTime) {
        e.preventDefault();
        alert("Please select date and time");
    }
});

/* =====================================================
   INIT
===================================================== */
window.addEventListener("DOMContentLoaded", () => {
    selectDate(new Date());
    generateCalendar();
    loadDoctors();
});
