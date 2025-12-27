import db from "../config/db.js";
import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";

export default function notesRoutes(app) {

    /* ===============================
       SAVE / UPDATE DOCTOR NOTES
       API ONLY
    =============================== */
    app.post(
        "/api/notes/save",
        authenticate,
        authorize("doctor"),
        async (req, res) => {
            try {
                const { roomId, notes } = req.body;

                if (!roomId) {
                    return res.status(400).json({
                        error: "roomId is required"
                    });
                }

                await db.query(
                    `
          INSERT INTO doctor_notes (room_id, doctor_id, notes)
          VALUES ($1, $2, $3)
          ON CONFLICT (room_id)
          DO UPDATE SET notes = EXCLUDED.notes
          `,
                    [roomId, req.user.id, notes || ""]
                );

                res.json({ success: true });
            } catch (err) {
                console.error("Save notes error:", err);
                res.status(500).json({ error: "Failed to save notes" });
            }
        }
    );
}
