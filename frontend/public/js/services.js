
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
        // Service cards animation
        document.addEventListener('DOMContentLoaded', () => {
            const serviceCards = document.querySelectorAll('.service-card');
            
            serviceCards.forEach((card, index) => {
        // Add staggered animation
        card.style.animationDelay = `${index * 0.1}s`;
    card.classList.add('animate__animated', 'animate__fadeInUp');
            });
        });
