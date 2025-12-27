
    let appointmentId = null;
    let polling = null;

    async function loadAppointment() {
            try {
                const res = await fetch("/api/appointments/doctor");
    const appointments = await res.json();

    // No upcoming appointments
    if (!appointments.length) {
        clearInterval(polling);
    document.getElementById("patientName").innerText = "—";
    document.getElementById("apptDate").innerText = "—";
    document.getElementById("apptTime").innerText = "—";
    document.getElementById("statusText").innerHTML = `
    <i class="fas fa-calendar-times"></i>
    No upcoming appointments.
    `;
    document.getElementById("statusText").className = "status completed";
    document.getElementById("startBtn").disabled = true;
    document.getElementById("startBtn").innerHTML = `
    <i class="fas fa-calendar-times"></i>
    No Appointments
    `;
    document.getElementById("startBtn").className = "btn btn-completed";
    return;
                }

    const appt = appointments[0]; // nearest appointment
    appointmentId = appt.id;

    document.getElementById("patientName").innerText =
    appt.user_name || "Patient";

    document.getElementById("apptDate").innerText =
    appt.appointment_date;

    document.getElementById("apptTime").innerText =
    appt.appointment_time;

    // Check appointment status
    const startBtn = document.getElementById("startBtn");
    const statusText = document.getElementById("statusText");

    // Scheduled - Ready to start
    if (appt.status === "scheduled") {
        statusText.innerHTML = `
                        <i class="fas fa-clock"></i>
                        Appointment is scheduled and ready to start
                    `;
    statusText.className = "status ready";
    startBtn.disabled = false;
    startBtn.innerHTML = `<i class="fas fa-video"></i> Start Call`;
    startBtn.className = "btn btn-primary";
                    startBtn.onclick = () => startCall();
                }

    // Started - Call is in progress
    if (appt.status === "started" && appt.room_id) {
        statusText.innerHTML = `
                        <i class="fas fa-video"></i>
                        Call is in progress
                    `;
    statusText.className = "status waiting";
    startBtn.disabled = false;
    startBtn.innerHTML = `<i class="fas fa-sign-in-alt"></i> Join Call`;
    startBtn.className = "btn btn-success";
                    startBtn.onclick = () => joinCall(appt.room_id);
                }

    // Completed - Appointment finished
    if (appt.status === "completed") {
        clearInterval(polling);
    statusText.innerHTML = `
    <i class="fas fa-check-circle"></i>
    Appointment completed
    `;
    statusText.className = "status completed";
    startBtn.disabled = true;
    startBtn.innerHTML = `<i class="fas fa-check-circle"></i> Completed`;
    startBtn.className = "btn btn-completed";
    startBtn.onclick = null;
                }
    const sendBtn = document.getElementById("sendPrescriptionBtn");

    if (appt.status === "completed") {
        sendBtn.style.display = "inline-flex";
                }

            } catch (err) {
        console.error(err);
    document.getElementById("statusText").innerHTML = `
    <i class="fas fa-exclamation-triangle"></i>
    Failed to load appointment
    `;
            }
        }


    async function startCall() {
            if (!appointmentId) return;

    try {
                const res = await fetch(`/appointments/${appointmentId}/start`, {
        method: "POST"
                });

    const data = await res.json();

    if (!res.ok) {
        alert(data.error || "Unable to start call");
    return;
                }

    // Redirect to video call room
    window.location.href = `/doc_video/${data.roomId}`;

            } catch (err) {
        console.error(err);
    alert("Server error while starting call");
            }
        }

    function joinCall(roomId) {
            if (!roomId) return;
    window.location.href = `/doc_video/${roomId}`;
        }


    const themeToggle = document.getElementById('themeToggle');
    const mobileThemeToggle = document.getElementById('mobileThemeToggle');
    const html = document.documentElement;

    const savedTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    if (savedTheme) {
        html.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
        }

    function toggleTheme() {
            const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
        }

    function updateThemeIcon(theme) {
            const icon = theme === 'dark' ? 'fa-sun' : 'fa-moon';
    themeToggle.innerHTML = `<i class="fas ${icon}"></i>`;
    mobileThemeToggle.innerHTML = `<i class="fas ${icon}"></i>`;
        }

    themeToggle.addEventListener('click', toggleTheme);
    mobileThemeToggle.addEventListener('click', toggleTheme);


    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const closeMenuBtn = document.getElementById('closeMenu');
    const mobileMenu = document.getElementById('mobileMenu');

        mobileMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
    mobileMenu.classList.add('active');
    document.body.style.overflow = 'hidden';
        });

        closeMenuBtn.addEventListener('click', () => {
        mobileMenu.classList.remove('active');
    document.body.style.overflow = '';
        });

        document.addEventListener('click', (e) => {
            if (mobileMenu.classList.contains('active') &&
    !mobileMenu.contains(e.target) &&
    e.target !== mobileMenuBtn) {
        mobileMenu.classList.remove('active');
    document.body.style.overflow = '';
            }
        });

    // Chatbot functionality
    const chatBubble = document.getElementById('chat-bubble');
    const chatbot = document.getElementById('chatbot');

        setTimeout(() => {
        chatBubble.classList.add('active');
        }, 3000);

        chatbot.addEventListener('click', () => {
        alert('Technical support would open here. This is a frontend demonstration.');
        });

    // Initialize appointment loading and start polling
    loadAppointment();
    polling = setInterval(loadAppointment, 5000);
