import authenticate from "../middleware/authenticate.js";
import db from "../config/db.js";          // ✅ ADD THIS


export default function aiRoutes(app) {

    // Render AI page
    app.get("/predict", authenticate, (req, res) => {
        res.render("predict");
    });

    // Proxy AI request → Flask
    app.post("/api/ai/precheck", authenticate, async (req, res) => {
        try {
            const response = await fetch("http://127.0.0.1:8000/ai/precheck", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(req.body)
            });

            const data = await response.json();

            // ✅ OPTIONAL: Save AI result to DB
            await db.query(
                `
    INSERT INTO ai_prechecks (user_id, symptoms, ai_response, severity)
    VALUES ($1, $2, $3, $4)
    `,
                [
                    req.user.id,
                    req.body.text,                 // 👈 maps to symptoms
                    JSON.stringify(data),
                    data.severity || "unknown"
                ]
            );


            res.json(data);

        } catch (err) {
            console.error("AI service error:", err);
            res.status(500).json({ error: "AI service unavailable" });
        }
    });
}
