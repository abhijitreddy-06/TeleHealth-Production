import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";

/*
  IMPORTANT:
  ----------
  In production, the backend MUST NOT:
  - serve HTML pages
  - render views
  - redirect users to frontend routes

  Frontend (Render Static Site) handles pages.
  Backend only exposes APIs to CHECK access.
*/

export default function protectedRoutes(app) {

    /* =========================
       AUTH CHECK – USER
       Frontend uses this to protect user pages
    ========================= */
    app.get(
        "/api/auth/user",
        authenticate,
        authorize("user"),
        (req, res) => {
            res.json({
                authenticated: true,
                role: "user",
                user: req.user
            });
        }
    );

    /* =========================
       AUTH CHECK – DOCTOR
       Frontend uses this to protect doctor pages
    ========================= */
    app.get(
        "/api/auth/doctor",
        authenticate,
        authorize("doctor"),
        (req, res) => {
            res.json({
                authenticated: true,
                role: "doctor",
                user: req.user
            });
        }
    );

}
