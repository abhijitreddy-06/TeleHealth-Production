import express from "express";
import authenticate from "../middleware/authenticate.js";
import { supabase } from "../config/supabase.js";
import multer from "multer";

const router = express.Router();

/*
  IMPORTANT:
  ----------
  - Supabase Storage requires file BUFFER
  - Use multer memory storage (NOT disk)
  - Backend is API-only
*/

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024 // 5 MB
    }
});

/* =========================
   FILE UPLOAD (IMAGE / PDF)
========================= */
router.post(
    "/api/upload",
    authenticate,
    upload.single("file"),
    async (req, res) => {
        try {
            const userId = req.user.id;
            const file = req.file;

            if (!file) {
                return res.status(400).json({
                    error: "No file uploaded"
                });
            }

            const isImage = file.mimetype.startsWith("image/");
            const isPdf = file.mimetype === "application/pdf";

            if (!isImage && !isPdf) {
                return res.status(400).json({
                    error: "Only images and PDFs are allowed"
                });
            }

            const folder = isImage ? "images" : "pdfs";
            const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");

            const filePath = `${folder}/user_${userId}/${Date.now()}_${safeName}`;

            const { error: uploadError } = await supabase.storage
                .from("uploads")
                .upload(filePath, file.buffer, {
                    contentType: file.mimetype,
                    upsert: false
                });

            if (uploadError) {
                throw uploadError;
            }

            // Create signed URL (valid 5 minutes)
            const { data, error: urlError } =
                await supabase.storage
                    .from("uploads")
                    .createSignedUrl(filePath, 300);

            if (urlError) {
                throw urlError;
            }

            res.status(200).json({
                message: "File uploaded successfully",
                path: filePath,
                signedUrl: data.signedUrl
            });

        } catch (err) {
            console.error("Upload error:", err);
            res.status(500).json({
                error: "File upload failed"
            });
        }
    }
);

export default router;
