import db from "../config/db.js";
import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";
import PDFDocument from "pdfkit";

/*
  PRESCRIPTION ROUTES – API ONLY

  Rules:
  - Doctor can generate
  - User can download ONLY their own
  - Backend returns PDF stream
*/

export default function prescriptionRoutes(app) {

    /* =====================================
       DOWNLOAD PRESCRIPTION (PDF)
       User OR Doctor (authorized)
    ===================================== */
    app.get(
        "/api/prescription/download/:roomId",
        authenticate,
        authorize("user", "doctor"),
        async (req, res) => {
            try {
                const { roomId } = req.params;

                // 🔒 Ownership check
                if (req.user.role === "user") {
                    const owns = await db.query(
                        `
            SELECT 1
            FROM appointments
            WHERE room_id = $1
              AND user_id = $2
              AND status = 'completed'
            `,
                        [roomId, req.user.id]
                    );

                    if (!owns.rows.length) {
                        return res.status(403).json({
                            error: "Access denied"
                        });
                    }
                }

                if (req.user.role === "doctor") {
                    const owns = await db.query(
                        `
            SELECT 1
            FROM appointments
            WHERE room_id = $1
              AND doctor_id = $2
            `,
                        [roomId, req.user.id]
                    );

                    if (!owns.rows.length) {
                        return res.status(403).json({
                            error: "Access denied"
                        });
                    }
                }

                const result = await db.query(
                    `
          SELECT notes
          FROM doctor_notes
          WHERE room_id = $1
          `,
                    [roomId]
                );

                if (!result.rows.length) {
                    return res.status(404).json({
                        error: "Prescription not found"
                    });
                }

                const notes = result.rows[0].notes || "No notes provided";

                // PDF headers
                res.setHeader("Content-Type", "application/pdf");
                res.setHeader(
                    "Content-Disposition",
                    'attachment; filename="prescription.pdf"'
                );

                const doc = new PDFDocument({ margin: 50 });
                doc.pipe(res);

                doc.fontSize(20).text("Medical Prescription", { align: "center" });
                doc.moveDown();
                doc.fontSize(12).text(`Date: ${new Date().toLocaleString()}`);
                doc.moveDown();
                doc.fontSize(12).text("Doctor Notes:");
                doc.moveDown();
                doc.fontSize(11).text(notes);

                doc.end(); // ✅ CRITICAL

            } catch (err) {
                console.error("Prescription PDF error:", err);
                res.status(500).json({
                    error: "Failed to generate prescription"
                });
            }
        }
    );
}
