import path from "path";
import blockAfterLogin from "../middleware/blockAfterLogin.js";

export default function publicRoutes(app, PROJECT_ROOT) {

    /* =========================
       LANDING / ROLE
    ========================= */
    app.get("/role", blockAfterLogin, (req, res) => {
        res.sendFile(
            path.join(PROJECT_ROOT, "public/pages/choose_role.html")
        );
    });

    /* =========================
       USER AUTH PAGES
    ========================= */
    app.get("/user_login", blockAfterLogin, (req, res) => {
        res.sendFile(
            path.join(PROJECT_ROOT, "public/pages/user_login.html")
        );
    });

    app.get("/user_signup", blockAfterLogin, (req, res) => {
        res.sendFile(
            path.join(PROJECT_ROOT, "public/pages/user_signup.html")
        );
    });

    /* =========================
       DOCTOR AUTH PAGES
    ========================= */
    app.get("/doc_login", blockAfterLogin, (req, res) => {
        res.sendFile(
            path.join(PROJECT_ROOT, "public/pages/doc_login.html")
        );
    });

    app.get("/doc_signup", blockAfterLogin, (req, res) => {
        res.sendFile(
            path.join(PROJECT_ROOT, "public/pages/doc_signup.html")
        );
    });

    /* =========================
       PUBLIC MARKETING PAGES
       (accessible only BEFORE login)
    ========================= */
    app.get("/", blockAfterLogin, (req, res) => {
        res.sendFile(
            path.join(PROJECT_ROOT, "public/pages/landing.html")
        );
    });

    app.get("/services", blockAfterLogin, (req, res) => {
        res.sendFile(
            path.join(PROJECT_ROOT, "public/pages/services.html")
        );
    });

    app.get("/contact", blockAfterLogin, (req, res) => {
        res.sendFile(
            path.join(PROJECT_ROOT, "public/pages/contact.html")
        );
    });

}
