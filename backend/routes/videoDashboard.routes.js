import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";
import db from "../config/db.js";
import crypto from "crypto";

export default function videoDashboardRoutes(app) {

    /* =====================================
       DOCTOR VIDEO DASHBOARD
    ===================================== */
    app.get(
        "/doc_video_dashboard",
        authenticate,
        authorize("doctor"),
        async (req, res) => {
            const result = await db.query(
                `
        SELECT
          a.id,
          a.appointment_time,
          up.full_name AS user_name
        FROM appointments a
        JOIN user_profile up ON up.user_id = a.user_id
        WHERE a.doctor_id = $1
          AND a.status IN ('scheduled','started')
        ORDER BY a.appointment_date, a.appointment_time
        LIMIT 1
        `,
                [req.user.id]
            );

            res.render("doc_video_dashboard", {
                appointment: result.rows[0] || null
            });
        }
    );

    /* =====================================
       START CALL (doctor)
    ===================================== */
    app.post(
        "/appointments/:id/start",
        authenticate,
        authorize("doctor"),
        async (req, res) => {
            const roomId = crypto.randomUUID();

            const result = await db.query(
                `
        UPDATE appointments
        SET status = 'started',
            room_id = $1
        WHERE id = $2
          AND doctor_id = $3
          AND status = 'scheduled'
        RETURNING room_id
        `,
                [roomId, req.params.id, req.user.id]
            );

            if (!result.rowCount) {
                return res.status(400).json({
                    error: "Call already started or completed"
                });
            }

            res.json({ roomId });
        }
    );

    /* =====================================
       END CALL (doctor)
    ===================================== */
    app.post(
        "/appointments/:id/complete",
        authenticate,
        authorize("doctor"),
        async (req, res) => {
            await db.query(
                `
        UPDATE appointments
        SET status = 'completed'
        WHERE id = $1
          AND doctor_id = $2
        `,
                [req.params.id, req.user.id]
            );

            res.sendStatus(200);
        }
    );

    /* =====================================
       USER VIDEO DASHBOARD
    ===================================== */
    app.get(
        "/user_video_dashboard",
        authenticate,
        authorize("user"),
        async (req, res) => {
            const result = await db.query(
                `
        SELECT
          a.id,
          a.appointment_time,
          a.status,
          dp.full_name AS doctor_name
        FROM appointments a
        JOIN doc_profile dp ON dp.doc_id = a.doctor_id
        WHERE a.user_id = $1
          AND a.status IN ('scheduled','started')
        ORDER BY a.appointment_date, a.appointment_time
        LIMIT 1
        `,
                [req.user.id]
            );

            res.render("user_video_dashboard", {
                appointment: result.rows[0] || null
            });
        }
    );
}
