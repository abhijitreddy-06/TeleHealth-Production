import express from "express";
import db from "../config/db.js";
import authenticate from "../middleware/authenticate.js";
import PDFDocument from "pdfkit";

const router = express.Router();

router.get(
    "/api/prescription/:roomId",
    authenticate,
    async (req, res) => {

        const { roomId } = req.params;

        const result = await db.query(`
      SELECT notes
      FROM doctor_notes
      WHERE room_id = $1
    `, [roomId]);

        if (!result.rows.length) {
            return res.status(404).send("Prescription not found");
        }

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
            "Content-Disposition",
            'attachment; filename="prescription.pdf"'
        );

        const doc = new PDFDocument({ margin: 50 });
        doc.pipe(res);

        doc.fontSize(18).text("Doctor Prescription", { underline: true });
        doc.moveDown();
        doc.fontSize(12).text(result.rows[0].notes);

        doc.end();
    }
);

export default router;
