import express from "express";
import db from "../config/db.js";
import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";
import PDFDocument from "pdfkit";

const router = express.Router();

/* ===============================
   DOWNLOAD PRESCRIPTION (PDF)
   API ONLY
=============================== */
router.get(
    "/api/prescription/:roomId",
    authenticate,
    authorize(["doctor", "user"]),
    async (req, res) => {
        try {
            const { roomId } = req.params;

            if (!roomId) {
                return res.status(400).json({
                    error: "roomId is required"
                });
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

            // PDF headers
            res.setHeader("Content-Type", "application/pdf");
            res.setHeader(
                "Content-Disposition",
                'attachment; filename="prescription.pdf"'
            );

            const doc = new PDFDocument({ margin: 50 });
            doc.pipe(res);

            doc.fontSize(18).text("Doctor Prescription", { underline: true });
            doc.moveDown();
            doc.fontSize(12).text(result.rows[0].notes || "No notes provided");

            doc.end();

        } catch (err) {
            console.error("Prescription PDF error:", err);
            res.status(500).json({
                error: "Failed to generate prescription"
            });
        }
    }
);

export default router;
