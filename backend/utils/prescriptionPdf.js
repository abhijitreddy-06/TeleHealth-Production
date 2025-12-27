import db from "../config/db.js";
import authenticate from "../middleware/authenticate.js";
import PDFDocument from "pdfkit";

export default function prescriptionRoutes(app) {

    app.get("/api/prescription/download/:roomId",
        authenticate,
        async (req, res) => {

            try {
                const { roomId } = req.params;

                const result = await db.query(`
                    SELECT dn.notes
                    FROM doctor_notes dn
                    WHERE dn.room_id = $1
                `, [roomId]);

                if (!result.rows.length) {
                    return res.status(404).send("Prescription not found");
                }

                const notes = result.rows[0].notes || "No notes provided";

                res.setHeader("Content-Type", "application/pdf");
                res.setHeader(
                    "Content-Disposition",
                    "attachment; filename=\"prescription.pdf\""
                );

                const doc = new PDFDocument({ margin: 50 });
                doc.pipe(res);

                doc.fontSize(20).text("Medical Prescription", { align: "center" });
                doc.moveDown();
                doc.fontSize(12).text(`Date: ${new Date().toLocaleString()}`);
                doc.moveDown();
                doc.text("Doctor Notes:");
                doc.moveDown();
                doc.fontSize(11).text(notes);

                doc.end(); // 🚨 THIS IS CRITICAL

            } catch (err) {
                console.error("PDF error:", err);
                res.status(500).send("Failed to generate prescription");
            }
        }
    );
}
