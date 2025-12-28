// config.js
const CONFIG = {
    // Backend API URL - automatically detect
    API_BASE_URL: (() => {
        // If we're on localhost, use local backend
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return 'http://localhost:3000';
        }
        // Otherwise use the production backend
        return 'https://telehealth-backend-9c46.onrender.com';
    })()
};

// Make it available globally
window.CONFIG = CONFIG;