
        // Original video dashboard logic (unchanged)
    let roomId = null;
    let polling = null;


    async function loadAppointment() {
            try {
                const res = await fetch("/api/appointments/user");
    const appointments = await res.json();

    // No active appointments
    if (!appointments.length) {
        clearInterval(polling);
    document.getElementById("doctorName").innerText = "—";
    document.getElementById("apptDate").innerText = "—";
    document.getElementById("apptTime").innerText = "—";
    document.getElementById("statusText").innerHTML = `
    <i class="fas fa-calendar-times"></i>
    No active appointments.
    `;
    document.getElementById("statusText").className = "status completed";
    document.getElementById("joinBtn").disabled = true;
    return;
                }

    const appt = appointments[0];

    document.getElementById("doctorName").innerText =
    `${appt.doctor_name} (${appt.specialization})`;

    document.getElementById("apptDate").innerText =
    appt.appointment_date;

    document.getElementById("apptTime").innerText =
    appt.appointment_time;

    // Scheduled
    if (appt.status === "scheduled") {
        document.getElementById("statusText").innerHTML = `
                        <i class="fas fa-clock"></i>
                        Waiting for doctor to start the call...
                    `;
    document.getElementById("statusText").className = "status waiting";
    document.getElementById("joinBtn").disabled = true;
                }

    // Started
    if (appt.status === "started" && appt.room_id) {
        roomId = appt.room_id;
    document.getElementById("statusText").innerHTML = `
    <i class="fas fa-check-circle"></i>
    Doctor has started the call
    `;
    document.getElementById("statusText").className = "status ready";
    document.getElementById("joinBtn").disabled = false;
                }

    // Completed
    if (appt.status === "completed") {
        clearInterval(polling);
    document.getElementById("statusText").innerHTML = `
    <i class="fas fa-check-circle"></i>
    Appointment completed
    `;
    document.getElementById("statusText").className = "status completed";
    document.getElementById("joinBtn").disabled = true;
                }

            } catch (err) {
        console.error(err);
    document.getElementById("statusText").innerHTML = `
    <i class="fas fa-exclamation-triangle"></i>
    Failed to load appointment
    `;
            }
        }

    function joinCall() {
            if (!roomId) return;
    window.location.href = `/user_video/${roomId}`;
        }

    // Theme Toggle (from user_home)
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

    // Mobile Menu (from user_home)
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

    // Chatbot functionality (from user_home)
    const chatBubble = document.getElementById('chat-bubble');
    const chatbot = document.getElementById('chatbot');

        setTimeout(() => {
        chatBubble.classList.add('active');
        }, 3000);

        chatbot.addEventListener('click', () => {
        alert('Chatbot feature would open here. This is a frontend demonstration.');
        });

    // Initialize appointment loading
    loadAppointment();
    polling = setInterval(loadAppointment, 5000);
