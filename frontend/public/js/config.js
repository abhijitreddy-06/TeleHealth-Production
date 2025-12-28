// config.js
const CONFIG = {
    // Backend API URL
    API_BASE_URL: 'https://telehealth-backend-9c46.onrender.com'
};

// Make it available globally
window.CONFIG = CONFIG;
console.log('Config loaded:', CONFIG.API_BASE_URL);