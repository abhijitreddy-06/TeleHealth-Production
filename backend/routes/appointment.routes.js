import db from "../config/db.js";
import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";
import crypto from "crypto";

export default function appointmentRoutes(app) {

    /* ===============================
       BOOK APPOINTMENT (USER)
       API ONLY – NO REDIRECTS
    =============================== */
    app.post(
        "/api/appointments/book",
        authenticate,
        authorize("user"),
        async (req, res) => {
            const { doctorId, appointment_date, appointment_time } = req.body;

            try {
                // 1️⃣ Check if user already has an active appointment
                const existing = await db.query(
                    `
          SELECT id
          FROM appointments
          WHERE user_id = $1
            AND status IN ('scheduled', 'approved', 'started')
          LIMIT 1
          `,
                    [req.user.id]
                );

                if (existing.rows.length > 0) {
                    return res.status(400).json({
                        error: "You already have an active appointment"
                    });
                }

                // 2️⃣ Create new appointment
                await db.query(
                    `
          INSERT INTO appointments
          (user_id, doctor_id, appointment_date, appointment_time, status)
          VALUES ($1, $2, $3, $4, 'scheduled')
          `,
                    [req.user.id, doctorId, appointment_date, appointment_time]
                );

                res.json({ success: true });

            } catch (err) {
                console.error("Appointment booking error:", err);
                res.status(500).json({ error: "Internal Server Error" });
            }
        }
    );

    /* ===============================
       USER ACTIVE APPOINTMENT
    =============================== */
    app.get(
        "/api/appointments/user",
        authenticate,
        authorize("user"),
        async (req, res) => {
            try {
                const result = await db.query(
                    `
          SELECT 
            a.*,
            p.full_name AS doctor_name,
            p.specialization
          FROM appointments a
          JOIN doc_profile p ON p.doc_id = a.doctor_id
          WHERE a.user_id = $1
            AND a.status != 'completed'
          ORDER BY a.appointment_date, a.appointment_time
          LIMIT 1
          `,
                    [req.user.id]
                );

                res.json(result.rows);
            } catch (err) {
                console.error(err);
                res.status(500).json({ error: "Failed to load appointment" });
            }
        }
    );

    /* ===============================
       DOCTOR START APPOINTMENT
    =============================== */
    app.post(
        "/api/appointments/:id/start",
        authenticate,
        authorize("doctor"),
        async (req, res) => {
            try {
                const { id } = req.params;
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
                    [roomId, id, req.user.id]
                );

                if (!result.rowCount) {
                    return res.status(400).json({
                        error: "Call already started or completed"
                    });
                }

                res.json({ roomId });
            } catch (err) {
                console.error(err);
                res.status(500).json({ error: "Failed to start appointment" });
            }
        }
    );

    /* ===============================
       DOCTOR ACTIVE APPOINTMENT
    =============================== */
    app.get(
        "/api/appointments/doctor",
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
            a.room_id,
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

                res.json(result.rows);
            } catch (err) {
                console.error(err);
                res.status(500).json({ error: "Failed to load appointment" });
            }
        }
    );

    /* ===============================
       FETCH DOCTORS (USER)
    =============================== */
    app.get(
        "/api/doctors",
        authenticate,
        authorize("user"),
        async (req, res) => {
            try {
                const result = await db.query(
                    `
          SELECT 
            d.docid AS id,
            p.full_name,
            p.specialization
          FROM doc_login d
          JOIN doc_profile p ON p.doc_id = d.docid
          ORDER BY p.full_name
          `
                );

                res.json(result.rows);
            } catch (err) {
                console.error(err);
                res.status(500).json({ error: "Failed to load doctors" });
            }
        }
    );

    /* ===============================
       DOCTOR END APPOINTMENT
    =============================== */
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
          WHERE id = $1 AND doctor_id = $2
          `,
                    [req.params.id, req.user.id]
                );

                res.json({ success: true });
            } catch (err) {
                console.error(err);
                res.status(500).json({ error: "Failed to complete appointment" });
            }
        }
    );
}
