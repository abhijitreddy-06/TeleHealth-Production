import authenticate from "../middleware/authenticate.js";
import db from "../config/db.js";
import fetch from "node-fetch";

export default function aiRoutes(app) {

    /* =========================
       AI PAGE
    ========================= */
    app.get("/predict", authenticate, (req, res) => {
        res.render("predict");
    });

    /* =========================
       AI PRECHECK API
    ========================= */
    app.post("/api/ai/precheck", authenticate, async (req, res) => {
        try {
            const AI_URL = process.env.AI_SERVICE_URL || "http://127.0.0.1:8000";

            const response = await fetch(`${AI_URL}/ai/precheck`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(req.body)
            });

            const data = await response.json();

            // 🔐 Optional DB logging (safe)
            try {
                await db.query(
                    `
                    INSERT INTO ai_prechecks (user_id, symptoms, ai_response, severity)
                    VALUES ($1, $2, $3, $4)
                    `,
                    [
                        req.user.id,
                        req.body.text,
                        JSON.stringify(data),
                        data.severity || "unknown"
                    ]
                );
            } catch (dbErr) {
                console.warn("AI precheck log skipped:", dbErr.message);
            }

            res.json(data);

        } catch (err) {
            console.error("AI service error:", err);
            res.status(500).json({ error: "AI service unavailable" });
        }
    });
}
