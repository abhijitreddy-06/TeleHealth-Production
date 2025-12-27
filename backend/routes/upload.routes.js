import express from "express";
import { upload } from "../middleware/upload.js";
import { supabase } from "../config/supabase.js";
import authenticate from "../middleware/authenticate.js";

const router = express.Router();

router.post(
    "/upload",
    authenticate,
    upload.single("file"),
    async (req, res) => {
        try {
            const userId = req.user.id;
            const file = req.file;

            if (!file) {
                return res.status(400).json({ error: "No file uploaded" });
            }

            const isImage = file.mimetype.startsWith("image/");
            const isPdf = file.mimetype === "application/pdf";

            if (!isImage && !isPdf) {
                return res
                    .status(400)
                    .json({ error: "Only images and PDFs allowed" });
            }

            const folder = isImage ? "images" : "pdfs";
            const safeName = file.originalname.replace(/\s+/g, "_");

            const filePath = `${folder}/user_${userId}/${Date.now()}_${safeName}`;

            const { error } = await supabase.storage
                .from("uploads")
                .upload(filePath, file.buffer, {
                    contentType: file.mimetype
                });

            if (error) throw error;

            const { data } = await supabase.storage
                .from("uploads")
                .createSignedUrl(filePath, 60);

            res.status(200).json({
                message: "File uploaded successfully",
                path: filePath,
                signedUrl: data.signedUrl
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
);

export default router;
