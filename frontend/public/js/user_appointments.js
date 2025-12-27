
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

        // Calendar and Time Picker Logic
        let currentDate = new Date();
        let selectedDate = null;
        let selectedTime = null;

        const monthNames = ["January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
        ];

        const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

        // Business hours based on your requirements
        const businessHours = {
            0: { start: 10, end: 16 }, // Sunday: 10 AM - 4 PM
            1: { start: 8, end: 20 },  // Monday: 8 AM - 8 PM
            2: { start: 8, end: 20 },  // Tuesday: 8 AM - 8 PM
            3: { start: 8, end: 20 },  // Wednesday: 8 AM - 8 PM
            4: { start: 8, end: 20 },  // Thursday: 8 AM - 8 PM
            5: { start: 8, end: 20 },  // Friday: 8 AM - 8 PM
            6: { start: 9, end: 17 }   // Saturday: 9 AM - 5 PM
        };

        function generateCalendar() {
            const calendarGrid = document.getElementById('calendarGrid');
            const calendarHeader = document.querySelector('.calendar-header h2');

            // Clear existing days (keeping headers)
            const existingDays = Array.from(calendarGrid.children).slice(7);
            existingDays.forEach(day => day.remove());

            // Update header
            calendarHeader.innerHTML = `<i class="fas fa-calendar-alt"></i> ${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;

            const year = currentDate.getFullYear();
            const month = currentDate.getMonth();

            // Get first day of month and total days
            const firstDay = new Date(year, month, 1);
            const lastDay = new Date(year, month + 1, 0);
            const totalDays = lastDay.getDate();

            // Get day of week for first day (0 = Sunday, 6 = Saturday)
            const firstDayIndex = firstDay.getDay();

            // Add empty cells for days before first day of month
            for (let i = 0; i < firstDayIndex; i++) {
                const emptyDay = document.createElement('div');
                emptyDay.className = 'calendar-day empty';
                calendarGrid.appendChild(emptyDay);
            }

            // Add days of month
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            for (let day = 1; day <= totalDays; day++) {
                const date = new Date(year, month, day);
                const dayElement = document.createElement('div');
                dayElement.className = 'calendar-day';
                dayElement.textContent = day;

                // Check if it's a weekend
                const dayOfWeek = date.getDay();
                if (dayOfWeek === 0 || dayOfWeek === 6) {
                    dayElement.classList.add('weekend');
                }

                // Check if it's today
                if (date.getTime() === today.getTime()) {
                    dayElement.classList.add('today');
                }

                // Check if it's in the past
                if (date < today) {
                    dayElement.classList.add('past');
                    dayElement.classList.add('disabled');
                } else {
                    // Add click event for selectable days
                    dayElement.addEventListener('click', () => selectDate(date));

                    // Check if it's currently selected
                    if (selectedDate &&
                        date.getDate() === selectedDate.getDate() &&
                        date.getMonth() === selectedDate.getMonth() &&
                        date.getFullYear() === selectedDate.getFullYear()) {
                        dayElement.classList.add('selected');
                    }
                }

                calendarGrid.appendChild(dayElement);
            }

            // Generate time slots for selected date
            if (selectedDate && !isDatePast(selectedDate)) {
                generateTimeSlots(selectedDate);
            }
        }

        function isDatePast(date) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return date < today;
        }

        function generateTimeSlots(date) {
            const timeSlotsGrid = document.getElementById('timeSlots');
            timeSlotsGrid.innerHTML = '';

            const dayOfWeek = date.getDay();
            const hours = businessHours[dayOfWeek];

            if (!hours) return;

            // Generate 30-minute intervals
            for (let hour = hours.start; hour < hours.end; hour++) {
                for (let minute = 0; minute < 60; minute += 30) {
                    const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
                    const timeSlot = document.createElement('div');
                    timeSlot.className = 'time-slot';
                    timeSlot.textContent = formatTime(hour, minute);
                    timeSlot.dataset.time = timeString;

                    // Check if this time is in the past for today
                    const now = new Date();
                    if (isToday(date)) {
                        const slotTime = new Date();
                        slotTime.setHours(hour, minute, 0, 0);
                        if (slotTime < now) {
                            timeSlot.classList.add('disabled');
                        } else {
                            timeSlot.addEventListener('click', () => selectTime(timeString));
                        }
                    } else {
                        timeSlot.addEventListener('click', () => selectTime(timeString));
                    }

                    // Check if this time is currently selected
                    if (selectedTime === timeString) {
                        timeSlot.classList.add('selected');
                    }

                    timeSlotsGrid.appendChild(timeSlot);
                }
            }
        }

        function formatTime(hour, minute) {
            const ampm = hour >= 12 ? 'PM' : 'AM';
            const displayHour = hour % 12 || 12;
            return `${displayHour}:${minute.toString().padStart(2, '0')} ${ampm}`;
        }

        function isToday(date) {
            const today = new Date();
            return date.getDate() === today.getDate() &&
                date.getMonth() === today.getMonth() &&
                date.getFullYear() === today.getFullYear();
        }

        function selectDate(date) {
            if (isDatePast(date)) return;

            selectedDate = date;
            selectedTime = null;

            // Update hidden inputs
            document.getElementById('selectedDate').value = formatDateForInput(date);
            document.getElementById('selectedTime').value = '';

            // Update display
            document.getElementById('displayDate').textContent = formatDate(date);
            document.getElementById('displayTime').textContent = 'Not selected';

            // Regenerate calendar with new selection
            generateCalendar();
            generateTimeSlots(date);

            updateSubmitButton();
        }

        function selectTime(time) {
            if (!selectedDate) return;

            selectedTime = time;

            // Update hidden input
            document.getElementById('selectedTime').value = time;

            // Update display
            const [hour, minute] = time.split(':').map(Number);
            document.getElementById('displayTime').textContent = formatTime(hour, minute);

            // Update time slots UI
            document.querySelectorAll('.time-slot').forEach(slot => {
                slot.classList.remove('selected');
                if (slot.dataset.time === time) {
                    slot.classList.add('selected');
                }
            });

            updateSubmitButton();
        }

        function formatDate(date) {
            return date.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        }

        function formatDateForInput(date) {
            return date.toISOString().split('T')[0];
        }

        // Navigation between months
        document.getElementById('prevMonth').addEventListener('click', () => {
            currentDate.setMonth(currentDate.getMonth() - 1);
            generateCalendar();
        });

        document.getElementById('nextMonth').addEventListener('click', () => {
            currentDate.setMonth(currentDate.getMonth() + 1);
            generateCalendar();
        });

        // Update submit button state
        function updateSubmitButton() {
            const submitBtn = document.getElementById('submitBtn');
            const doctorSelect = document.getElementById('doctorSelect');

            if (selectedDate && selectedTime && doctorSelect.value) {
                submitBtn.disabled = false;
            } else {
                submitBtn.disabled = true;
            }
        }

        // Your original loadDoctors function
        async function loadDoctors() {
            try {
                const res = await fetch("/api/doctors");
                const doctors = await res.json();

                const select = document.getElementById("doctorSelect");
                select.innerHTML = '<option value="">Select Doctor</option>';

                doctors.forEach(doc => {
                    const opt = document.createElement("option");
                    opt.value = doc.id;
                    opt.textContent = `${doc.full_name} (${doc.specialization})`;
                    select.appendChild(opt);
                });

                // Add event listener for doctor selection
                select.addEventListener('change', () => {
                    updateDoctorDisplay();
                    updateSubmitButton();
                });
            } catch (err) {
                console.error("Failed to load doctors", err);
                const select = document.getElementById("doctorSelect");
                select.innerHTML = '<option value="">Failed to load doctors. Please try again.</option>';
            }
        }

        function updateDoctorDisplay() {
            const doctorSelect = document.getElementById('doctorSelect');
            const selectedOption = doctorSelect.options[doctorSelect.selectedIndex];
            document.getElementById('displayDoctor').textContent = selectedOption.textContent || 'Not selected';
        }

        // Form submission
        document.getElementById('appointmentForm').addEventListener('submit', function (e) {
            if (!selectedDate || !selectedTime) {
                e.preventDefault();
                alert('Please select both date and time before booking.');
                return;
            }

            const submitBtn = this.querySelector('.submit-btn');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Booking...';
        });

        // Initialize
        window.addEventListener('DOMContentLoaded', () => {
            // Set initial date to today
            selectDate(new Date());

            // Generate calendar
            generateCalendar();

            // Load doctors
            loadDoctors();
        });
 