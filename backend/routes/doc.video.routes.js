import crypto from "crypto";
import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";
import db from "../config/db.js";

export default function docVideoRoutes(app) {

    /* =========================
       START VIDEO CALL (DOCTOR)
    ========================= */
    app.post(
        "/doc/start-call/:appointmentId",
        authenticate,
        authorize("doctor"),
        async (req, res) => {
            try {
                const roomId = crypto.randomUUID();

                await db.query(
                    `
                    UPDATE appointments
                    SET room_id = $1,
                        status = 'started'
                    WHERE id = $2
                      AND doctor_id = $3
                    `,
                    [roomId, req.params.appointmentId, req.user.id]
                );

                res.redirect(`/doc_video/${roomId}`);

            } catch (err) {
                console.error("Start call error:", err);
                res.status(500).send("Failed to start call");
            }
        }
    );
}
