import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";
import path from "path";
import db from "../config/db.js";

export default function protectedRoutes(app, PROJECT_ROOT) {

    /* =========================
       USER PAGES
    ========================= */

    app.get("/user_home", authenticate, authorize("user"), (req, res) => {
        res.sendFile(path.join(PROJECT_ROOT, "public/pages/user_home.html"));
    });

    app.get("/appointments", authenticate, authorize("user"), (req, res) => {
        res.sendFile(
            path.join(PROJECT_ROOT, "public/pages/user_appointments.html")
        );
    });

    app.get(
        "/user_video_dashboard",
        authenticate,
        authorize("user"),
        (req, res) => {
            res.sendFile(
                path.join(PROJECT_ROOT, "public/pages/user_video_dashboard.html")
            );
        }
    );

    app.get(
        "/user_video/:roomId",
        authenticate,
        authorize("user"),
        (req, res) => {
            res.render("user_video", {
                roomId: req.params.roomId
            });
        }
    );

    /* =========================
       DOCTOR PAGES
    ========================= */

    app.get("/doc_home", authenticate, authorize("doctor"), (req, res) => {
        res.sendFile(path.join(PROJECT_ROOT, "public/pages/doc_home.html"));
    });

    app.get(
        "/doc_video_dashboard",
        authenticate,
        authorize("doctor"),
        (req, res) => {
            res.sendFile(
                path.join(PROJECT_ROOT, "public/pages/doc_video_dashboard.html")
            );
        }
    );
    app.get(
        "/records",
        authenticate,
        authorize("user"),
        (req, res) => {
            res.sendFile(
                path.join(PROJECT_ROOT, "public/pages/vault.html")
            );
        }
    );
    app.get(
        "/doc_video/:roomId",
        authenticate,
        authorize("doctor"),
        (req, res) => {
            res.render("doc_video", {
                roomId: req.params.roomId
            });
        }
    );

    app.get(
        "/doc_profile_create",
        authenticate,
        authorize("doctor"),
        (req, res) => {
            res.sendFile(
                path.join(PROJECT_ROOT, "public/pages/doc_profile_create.html")
            );
        }
    );
    app.get(
        "/user_profile_create",
        authenticate,
        authorize("user"),
        (req, res) => {
            res.sendFile(
                path.join(PROJECT_ROOT, "public/pages/user_profile.html")
            );
        }
    );
    app.get(
        "/api/prescription/download/:appointmentId",
        authenticate,
        authorize("user"),
        async (req, res) => {
            const result = await db.query(`
            SELECT prescription_pdf
            FROM doctor_notes dn
            JOIN appointments a ON a.id = dn.appointment_id
            WHERE a.id = $1 AND a.user_id = $2 AND dn.sent = TRUE
        `, [req.params.appointmentId, req.user.id]);

            if (!result.rows.length) {
                return res.sendStatus(404);
            }

            res.download(result.rows[0].prescription_pdf);
        }
    );

}
