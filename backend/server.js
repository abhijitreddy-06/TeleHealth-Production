
import path from "path";
import { fileURLToPath } from "url";

/* =========================
   FORCE LOAD backend/.env
========================= */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);




/* =========================
   NORMAL IMPORTS (UNCHANGED)
========================= */
import express from "express";
import http from "http";
import { Server } from "socket.io";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";

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


/* =========================
   APP SETUP (UNCHANGED)
========================= */
const app = express();
const port = process.env.PORT || 3000;

const PROJECT_ROOT = path.resolve(__dirname, "..");

app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use("/api", uploadRoutes);



app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

vaultRoutes(app);
notesRoutes(app);
app.use(prescriptionRoutes);

publicRoutes(app, PROJECT_ROOT);
authRoutes(app);
aiRoutes(app);
videoRoutes(app, PROJECT_ROOT);
protectedRoutes(app, PROJECT_ROOT);
profileRoutes(app);
videoDashboardRoutes(app, PROJECT_ROOT);

app.set("view engine", "ejs");
app.set("views", path.join(PROJECT_ROOT, "views"));

appointmentRoutes(app);

const server = http.createServer(app);
const io = new Server(server);

videoSocket(io);

app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});



server.listen(port, () =>
  console.log(`Server running on http://localhost:${port}`)
);
