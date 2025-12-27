import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";
import db from "../config/db.js";

export default function userVideoRoutes(app) {

    /* =========================
       JOIN VIDEO CALL (USER)
    ========================= */
    app.get(
        "/user/join-call/:appointmentId",
        authenticate,
        authorize("user"),
        async (req, res) => {
            try {
                const result = await db.query(
                    `
                    SELECT room_id
                    FROM appointments
                    WHERE id = $1
                      AND user_id = $2
                      AND status = 'started'
                    `,
                    [req.params.appointmentId, req.user.id]
                );

                if (!result.rows.length) {
                    return res.send("Doctor has not started the call yet");
                }

                res.redirect(`/user_video/${result.rows[0].room_id}`);

            } catch (err) {
                console.error("Join call error:", err);
                res.status(500).send("Unable to join call");
            }
        }
    );
}
