import crypto from "crypto";
import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";
import db from "../config/db.js";

export default function docVideoRoutes(app) {

    /* =========================
       START VIDEO CALL (DOCTOR)
       API ONLY – NO REDIRECTS
    ========================= */
    app.post(
        "/api/doc/start-call/:appointmentId",
        authenticate,
        authorize("doctor"),
        async (req, res) => {
            try {
                const { appointmentId } = req.params;
                const roomId = crypto.randomUUID();

                const result = await db.query(
                    `
          UPDATE appointments
          SET room_id = $1,
              status = 'started'
          WHERE id = $2
            AND doctor_id = $3
            AND status = 'scheduled'
          RETURNING room_id
          `,
                    [roomId, appointmentId, req.user.id]
                );

                if (!result.rowCount) {
                    return res.status(400).json({
                        error: "Call already started or appointment invalid"
                    });
                }

                // ✅ Frontend will handle redirect
                res.json({ roomId });

            } catch (err) {
                console.error("Start call error:", err);
                res.status(500).json({ error: "Failed to start call" });
            }
        }
    );
}
