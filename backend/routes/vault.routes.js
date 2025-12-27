import db from "../config/db.js";
import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";
import { upload } from "../middleware/upload.js";
import path from "path";

export default function vaultRoutes(app) {

    /* ===============================
       USER: upload record
    =============================== */
    app.post(
        "/vault/upload",
        authenticate,
        authorize("user"),
        upload.single("file"),
        async (req, res) => {
            if (!req.file) return res.status(400).send("No file uploaded");

            await db.query(
                `
                INSERT INTO medical_records
                (user_id, file_name, file_path, record_type)
                VALUES ($1, $2, $3, $4)
                `,
                [
                    req.user.id,
                    req.file.originalname,
                    req.file.path,
                    req.body.recordType || "general"
                ]
            );

            res.redirect("/records");
        }
    );

    /* ===============================
       USER: list own records
    =============================== */
    app.get(
        "/api/vault/user",
        authenticate,
        authorize("user"),
        async (req, res) => {
            const result = await db.query(
                `
                SELECT id, file_name, record_type, uploaded_at
                FROM medical_records
                WHERE user_id = $1
                ORDER BY uploaded_at DESC
                `,
                [req.user.id]
            );
            res.json(result.rows);
        }
    );

    /* ===============================
       DOCTOR: list user records (BY APPOINTMENT)
    =============================== */
    app.get(
        "/api/vault/doctor/:appointmentId",
        authenticate,
        authorize("doctor"),
        async (req, res) => {
            const { appointmentId } = req.params;

            const appt = await db.query(
                `
                SELECT user_id
                FROM appointments
                WHERE id = $1
                  AND doctor_id = $2
                  AND records_allowed = true
                  AND status IN ('started','completed')
                `,
                [appointmentId, req.user.id]
            );

            if (!appt.rows.length) {
                return res.sendStatus(403);
            }

            const records = await db.query(
                `
                SELECT id, file_name, record_type, uploaded_at
                FROM medical_records
                WHERE user_id = $1
                ORDER BY uploaded_at DESC
                `,
                [appt.rows[0].user_id]
            );

            res.json(records.rows);
        }
    );

    /* ===============================
       DOWNLOAD (user or doctor)
    =============================== */
    app.get(
        "/vault/file/:id",
        authenticate,
        async (req, res) => {

            // user owns
            const userFile = await db.query(
                `
                SELECT file_path
                FROM medical_records
                WHERE id = $1 AND user_id = $2
                `,
                [req.params.id, req.user.id]
            );

            if (userFile.rows.length) {
                return res.sendFile(path.resolve(userFile.rows[0].file_path));
            }

            // doctor via appointment permission
            if (req.user.role === "doctor") {
                const docFile = await db.query(
                    `
                    SELECT mr.file_path
                    FROM medical_records mr
                    JOIN appointments a ON a.user_id = mr.user_id
                    WHERE mr.id = $1
                      AND a.doctor_id = $2
                      AND a.records_allowed = true
                    `,
                    [req.params.id, req.user.id]
                );

                if (docFile.rows.length) {
                    return res.sendFile(path.resolve(docFile.rows[0].file_path));
                }
            }

            res.sendStatus(403);
        }
    );
}
