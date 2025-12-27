import db from "../config/db.js";
import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";

export default function notesRoutes(app) {

    app.post(
        "/api/notes/save",
        authenticate,
        authorize("doctor"),
        async (req, res) => {

            const { roomId, notes } = req.body;

            if (!roomId) {
                return res.status(400).json({ error: "roomId required" });
            }

            await db.query(`
        INSERT INTO doctor_notes (room_id, doctor_id, notes)
        VALUES ($1, $2, $3)
        ON CONFLICT (room_id)
        DO UPDATE SET notes = EXCLUDED.notes
      `, [roomId, req.user.id, notes || ""]);

            res.sendStatus(200);
        }
    );
}
