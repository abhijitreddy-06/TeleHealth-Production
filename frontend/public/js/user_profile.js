
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
    if (mobileThemeToggle) {
        mobileThemeToggle.innerHTML = `<i class="fas ${icon}"></i>`;
            }
        }

    themeToggle.addEventListener('click', toggleTheme);
    if (mobileThemeToggle) {
        mobileThemeToggle.addEventListener('click', toggleTheme);
        }


    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const closeMenuBtn = document.getElementById('closeMenu');
    const mobileMenu = document.getElementById('mobileMenu');

    if (mobileMenuBtn && mobileMenu) {
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
        }

    // Profile Form Functionality
    const step1 = document.getElementById('step1');
    const step2 = document.getElementById('step2');
    const step3 = document.getElementById('step3');
    const successStep = document.getElementById('successStep');
    const nextBtn1 = document.getElementById('nextBtn1');
    const nextBtn2 = document.getElementById('nextBtn2');
    const prevBtn1 = document.getElementById('prevBtn1');
    const prevBtn2 = document.getElementById('prevBtn2');
    const otherGender = document.getElementById('otherGender');
    const otherGenderField = document.getElementById('otherGenderField');
    const profileForm = document.getElementById('profileForm');
    const weightInput = document.getElementById('weight');
    const weightRange = document.getElementById('weightRange');
    const heightInput = document.getElementById('height');
    const heightRange = document.getElementById('heightRange');
    const genderOptions = document.querySelectorAll('.gender-option');
    const dobInput = document.getElementById('dob');
    const genderInput = document.getElementById('genderInput');
    const customGenderInput = document.getElementById('customGenderInput');

    // Initialize hidden gender to the initially selected option:
    const initiallySelected = document.querySelector('.gender-option.selected');
    if (initiallySelected) {
        genderInput.value = initiallySelected.dataset.gender;
        }

        // Show/hide other gender field and set selection
        genderOptions.forEach(option => {
        option.addEventListener('click', function () {
            genderOptions.forEach(opt => opt.classList.remove('selected'));
            this.classList.add('selected');
            const selected = this.dataset.gender;
            if (selected === 'other') {
                otherGenderField.style.display = 'block';
            } else {
                otherGenderField.style.display = 'none';
                customGenderInput.value = '';
            }
            // Set hidden input right away (will be finalized on submit)
            genderInput.value = selected;
        });
        });

    // Form navigation
    nextBtn1.addEventListener('click', function () {
            // Validate step 1
            if (document.getElementById('fullName').value.trim() === '') {
        alert('Please enter your name');
    return;
            }
    if (dobInput.value.trim() === '') {
        alert('Please enter your date of birth');
    return;
            }
    step1.style.display = 'none';
    step2.style.display = 'block';
    updateProgress(2);
        });

    nextBtn2.addEventListener('click', function () {
            // Validate step 2
            if (weightInput.value.trim() === '') {
        alert('Please enter your weight');
    return;
            }
    if (heightInput.value.trim() === '') {
        alert('Please enter your height');
    return;
            }
    step2.style.display = 'none';
    step3.style.display = 'block';
    updateProgress(3);
        });

    prevBtn1.addEventListener('click', function () {
        step2.style.display = 'none';
    step1.style.display = 'block';
    updateProgress(1);
        });

    prevBtn2.addEventListener('click', function () {
        step3.style.display = 'none';
    step2.style.display = 'block';
    updateProgress(2);
        });

    // Form submission: only preventDefault on validation failure; otherwise allow POST
    profileForm.addEventListener('submit', function (e) {
            // Validate step 3
            if (document.getElementById('bloodGroup').value === '') {
        e.preventDefault();
    alert('Please select your blood group');
    return;
            }
    // Before submit, set final gender value:
    let finalGender = genderInput.value;
    if (finalGender === 'other') {
                const cg = customGenderInput.value.trim();
    if (!cg) {
        e.preventDefault();
    alert('Please specify your gender');
    return;
                }
    finalGender = cg;
            }
    genderInput.value = finalGender;

        });

    // Update progress indicators
    function updateProgress(step) {
            const stepIcons = document.querySelectorAll('.step-icon');
    const stepTexts = document.querySelectorAll('.step-text');

            stepIcons.forEach((icon, index) => {
                if (index < step) {
        icon.classList.add('active');
                } else {
        icon.classList.remove('active');
                }
            });

            stepTexts.forEach((text, index) => {
                if (index < step) {
        text.classList.add('active');
                } else {
        text.classList.remove('active');
                }
            });
        }

    // Sync weight input and range slider
    weightRange.addEventListener('input', function () {
        weightInput.value = this.value;
        });
    weightInput.addEventListener('input', function () {
        weightRange.value = this.value;
        });
    // Sync height input and range slider
    heightRange.addEventListener('input', function () {
        heightInput.value = this.value;
        });
    heightInput.addEventListener('input', function () {
        heightRange.value = this.value;
        });

    // Set default values
    weightInput.value = weightRange.value = 70;
    heightInput.value = heightRange.value = 170;

    // Set a reasonable default date (30 years ago)
    const today = new Date();
    const defaultDob = new Date(today.getFullYear() - 30, today.getMonth(), today.getDate());
    dobInput.value = defaultDob.toISOString().split('T')[0];
