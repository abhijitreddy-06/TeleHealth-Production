import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import http from "http";
import { Server } from "socket.io";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import cors from "cors";

import uploadRoutes from "./routes/upload.routes.js";
import publicRoutes from "./routes/public.routes.js";
import authRoutes from "./routes/auth.routes.js";
import videoRoutes from "./routes/video.routes.js";
import videoSocket from "./sockets/video.socket.js";
import protectedRoutes from "./routes/protected.routes.js";
import profileRoutes from "./routes/profile.routes.js";
import appointmentRoutes from "./routes/appointment.routes.js";
import videoDashboardRoutes from "./routes/videoDashboard.routes.js";
import vaultRoutes from "./routes/vault.routes.js";
import notesRoutes from "./routes/notes.routes.js";
import prescriptionRoutes from "./routes/prescription.routes.js";
import aiRoutes from "./routes/ai.routes.js";
import db from "./config/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* =========================
   APP SETUP
========================= */
const app = express();
const port = process.env.PORT || 3000;

/* =========================
   CORS (MUST BE FIRST)
========================= */
app.use(
  cors({
    origin: "https://telehealth-production.onrender.com",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

/* =========================
   MIDDLEWARE
========================= */
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

/* =========================
   ROUTES (API ONLY)
========================= */
app.use(uploadRoutes);
publicRoutes(app);
authRoutes(app);
aiRoutes(app);
protectedRoutes(app);
profileRoutes(app);
appointmentRoutes(app);
videoDashboardRoutes(app);
vaultRoutes(app);
notesRoutes(app);
app.use(prescriptionRoutes);

/* =========================
   404 HANDLER
========================= */
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

/* =========================
   SERVER + SOCKET.IO
========================= */
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "https://telehealth-production.onrender.com",
    credentials: true
  }
});

videoSocket(io);

/* =========================
   START SERVER
========================= */
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
