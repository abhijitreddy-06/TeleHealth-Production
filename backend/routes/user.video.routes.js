import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";
import db from "../config/db.js";

/*
  USER VIDEO ROUTES – API ONLY

  Backend responsibilities:
  - Validate auth
  - Validate appointment ownership
  - Return roomId as JSON

  Frontend responsibilities:
  - Handle redirects
  - Open video page
*/

export default function userVideoRoutes(app) {

    /* =========================
       GET ROOM ID (USER)
    ========================= */
    app.get(
        "/api/user/join-call/:appointmentId",
        authenticate,
        authorize("user"),
        async (req, res) => {
            try {
                const { appointmentId } = req.params;

                const result = await db.query(
                    `
          SELECT room_id
          FROM appointments
          WHERE id = $1
            AND user_id = $2
            AND status = 'started'
          `,
                    [appointmentId, req.user.id]
                );

                if (!result.rows.length) {
                    return res.status(404).json({
                        error: "Doctor has not started the call yet"
                    });
                }

                res.json({
                    roomId: result.rows[0].room_id
                });

            } catch (err) {
                console.error("Join call error:", err);
                res.status(500).json({
                    error: "Unable to join call"
                });
            }
        }
    );

}
