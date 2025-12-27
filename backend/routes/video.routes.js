import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";
import db from "../config/db.js";
import { supabase } from "../config/supabase.js";
import multer from "multer";

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

/*
  VAULT ROUTES – API ONLY
  - Uses Supabase Storage
  - No local disk
  - No redirects
  - JSON only
*/

export default function vaultRoutes(app) {

    /* ===============================
       USER: UPLOAD MEDICAL RECORD
    =============================== */
    app.post(
        "/api/vault/upload",
        authenticate,
        authorize("user"),
        upload.single("file"),
        async (req, res) => {
            try {
                const file = req.file;
                const userId = req.user.id;
                const recordType = req.body.recordType || "general";

                if (!file) {
                    return res.status(400).json({ error: "No file uploaded" });
                }

                const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
                const filePath = `vault/user_${userId}/${Date.now()}_${safeName}`;

                const { error: uploadError } = await supabase.storage
                    .from("uploads")
                    .upload(filePath, file.buffer, {
                        contentType: file.mimetype
                    });

                if (uploadError) throw uploadError;

                await db.query(
                    `
          INSERT INTO medical_records
          (user_id, file_name, file_path, record_type)
          VALUES ($1, $2, $3, $4)
          `,
                    [userId, file.originalname, filePath, recordType]
                );

                res.status(200).json({
                    message: "Record uploaded successfully"
                });

            } catch (err) {
                console.error("Vault upload error:", err);
                res.status(500).json({
                    error: "Failed to upload record"
                });
            }
        }
    );

    /* ===============================
       USER: LIST OWN RECORDS
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
       DOCTOR: LIST USER RECORDS
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
                return res.status(403).json({
                    error: "Access denied"
                });
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
       DOWNLOAD RECORD (SIGNED URL)
       User OR authorized Doctor
    =============================== */
    app.get(
        "/api/vault/file/:id",
        authenticate,
        async (req, res) => {
            try {
                let record;

                // User owns file
                const userFile = await db.query(
                    `
          SELECT file_path
          FROM medical_records
          WHERE id = $1 AND user_id = $2
          `,
                    [req.params.id, req.user.id]
                );

                if (userFile.rows.length) {
                    record = userFile.rows[0];
                }

                // Doctor access via appointment
                if (!record && req.user.role === "doctor") {
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
                        record = docFile.rows[0];
                    }
                }

                if (!record) {
                    return res.status(403).json({
                        error: "Access denied"
                    });
                }

                const { data, error } = await supabase.storage
                    .from("uploads")
                    .createSignedUrl(record.file_path, 300);

                if (error) throw error;

                res.json({
                    signedUrl: data.signedUrl
                });

            } catch (err) {
                console.error("Vault download error:", err);
                res.status(500).json({
                    error: "Failed to fetch file"
                });
            }
        }
    );
}
