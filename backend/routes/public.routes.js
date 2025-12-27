/*
  PUBLIC ROUTES – API ONLY

  IMPORTANT:
  ----------
  - Backend MUST NOT serve HTML files
  - Backend MUST NOT redirect users
  - Static frontend (Render Static Site) handles pages
  - Backend only exposes API health + auth helpers
*/

export default function publicRoutes(app) {

    /* =========================
       API HEALTH CHECK
       (Used by Render & debugging)
    ========================= */
    app.get("/", (req, res) => {
        res.json({
            status: "API running",
            service: "TeleHealth Backend"
        });
    });

    /* =========================
       BLOCK-AFTER-LOGIN CHECK
       (Frontend calls this optionally)
    ========================= */
    app.get("/api/auth/guest", (req, res) => {
        res.json({ guest: true });
    });

}
