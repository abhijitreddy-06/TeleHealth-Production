async function checkAuth() {
    try {
        // Try user auth first
        let res = await fetch("/api/auth/user", { credentials: "include" });
        if (res.ok) return; // User is logged in

        // If not user, try doctor auth
        res = await fetch("/api/auth/doctor", { credentials: "include" });
        if (res.ok) return; // Doctor is logged in

        // If neither, redirect to role selection
        throw new Error("Not authenticated");
    } catch (err) {
        console.log("Redirecting to login...");
        window.location.href = "/role"; // Or /user_login
    }
}

checkAuth();