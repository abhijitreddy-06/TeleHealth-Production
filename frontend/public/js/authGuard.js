// authGuard.js - Simple authentication guard for protected pages
(async function () {
    try {
        // Check if user is authenticated
        const response = await fetch('/api/auth/user', {
            credentials: 'include'
        });

        if (response.ok) {
            // User is authenticated, do nothing (stay on page)
            console.log('User authenticated');
        } else {
            // User is not authenticated, redirect to login
            window.location.href = '/user_login';
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        // On error, redirect to login page
        window.location.href = '/user_login';
    }
})();