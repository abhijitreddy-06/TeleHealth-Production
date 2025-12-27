
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

// Mobile Menu
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

// Close menu when clicking outside
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

// Show chat bubble after 3 seconds
setTimeout(() => {
    chatBubble.classList.add('active');
}, 3000);

chatbot.addEventListener('click', () => {
    alert('Welcome to TeleHealth! I am your AI assistant. How can I help you today?\n\nFor doctor login: You can access patient records, appointments, and e-prescriptions.\nFor patient login: You can book appointments, view medical history, and consult with doctors.');
});

// Login button functionality
const doctorLoginBtn = document.querySelector('a[href="/doctor-login"]');
const patientLoginBtn = document.querySelector('a[href="/patient-login"]');

doctorLoginBtn.addEventListener('click', function (e) {
    e.preventDefault();
    alert('Redirecting to Doctor Login Page...\n\nIn a real application, this would take you to the doctor login form.');
    // In a real app: window.location.href = '/doctor-login';
});

patientLoginBtn.addEventListener('click', function (e) {
    e.preventDefault();
    alert('Redirecting to Patient Login Page...\n\nIn a real application, this would take you to the patient login form.');
    // In a real app: window.location.href = '/patient-login';
});
