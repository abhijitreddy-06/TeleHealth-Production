import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";
import db from "../config/db.js";
import crypto from "crypto";

/*
  VIDEO DASHBOARD ROUTES – API ONLY

  Backend:
  - Provides appointment data
  - Starts / ends calls
  - Returns JSON only

  Frontend:
  - Renders dashboards
  - Handles redirects & UI
*/

export default function videoDashboardRoutes(app) {

    /* =====================================
       DOCTOR: FETCH DASHBOARD DATA
    ===================================== */
    app.get(
        "/api/video/doctor/dashboard",
        authenticate,
        authorize("doctor"),
        async (req, res) => {
            try {
                const result = await db.query(
                    `
          SELECT
            a.id,
            a.appointment_date,
            a.appointment_time,
            a.status,
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

                res.json({
                    appointment: result.rows[0] || null
                });

            } catch (err) {
                console.error("Doctor dashboard error:", err);
                res.status(500).json({
                    error: "Failed to load dashboard"
                });
            }
        }
    );

    /* =====================================
       USER: FETCH DASHBOARD DATA
    ===================================== */
    app.get(
        "/api/video/user/dashboard",
        authenticate,
        authorize("user"),
        async (req, res) => {
            try {
                const result = await db.query(
                    `
          SELECT
            a.id,
            a.appointment_date,
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

                res.json({
                    appointment: result.rows[0] || null
                });

            } catch (err) {
                console.error("User dashboard error:", err);
                res.status(500).json({
                    error: "Failed to load dashboard"
                });
            }
        }
    );

    /* =====================================
       DOCTOR: START CALL
    ===================================== */
    app.post(
        "/api/appointments/:id/start",
        authenticate,
        authorize("doctor"),
        async (req, res) => {
            try {
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

            } catch (err) {
                console.error("Start call error:", err);
                res.status(500).json({
                    error: "Failed to start call"
                });
            }
        }
    );

    /* =====================================
       DOCTOR: END CALL
    ===================================== */
    app.post(
        "/api/appointments/:id/complete",
        authenticate,
        authorize("doctor"),
        async (req, res) => {
            try {
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

            } catch (err) {
                console.error("End call error:", err);
                res.status(500).json({
                    error: "Failed to end call"
                });
            }
        }
    );

}
