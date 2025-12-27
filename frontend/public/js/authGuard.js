// public/js/authGuard.js
fetch("/api/me", { credentials: "include" })
    .then(res => {
        if (res.status === 401) {
            window.location.href = "/role";
        }
    })
    .catch(() => {
        window.location.href = "/role";
    });
