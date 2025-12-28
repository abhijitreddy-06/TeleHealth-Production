import express from "express";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { Server } from "socket.io";
import pg from "pg";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import multer from "multer";
import crypto from "crypto";
import PDFDocument from "pdfkit";
import { createClient } from "@supabase/supabase-js";

/* ==================================================================
   1. CONFIGURATION & ENVIRONMENT
================================================================== */
dotenv.config();

// Fix Directory Paths (CRITICAL FIX)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Go UP one level from 'backend' to reach 'frontend'
const FRONTEND_PATH = path.join(__dirname, "../frontend");
const PUBLIC_PATH = path.join(FRONTEND_PATH, "public");
const PAGES_PATH = path.join(PUBLIC_PATH, "pages");

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_ChangeThisInEnv";
const JWT_EXPIRES_IN = "2h";
const saltRounds = 10;

// -- Database Connection --
const { Pool } = pg;
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

db.on("connect", () => console.log("✅ Connected to Supabase PostgreSQL"));
db.on("error", (err) => {
  console.error("❌ Supabase DB error:", err);
  process.exit(1);
});

// -- Supabase Client --
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// -- Multer Upload Config --
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

/* ==================================================================
   2. APP SETUP & GLOBAL MIDDLEWARE
================================================================== */
const app = express();
const server = http.createServer(app);

app.set('trust proxy', 1);


// Determine environment
const isProduction = process.env.NODE_ENV === 'production';

// Define allowed origins
const allowedOrigins = [
  'https://telehealth-production.onrender.com',
  'https://telehealth-backend-9c46.onrender.com', // Allow backend to call itself
  'http://localhost:3000',
  'http://localhost:5173'
];

// CORS Configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // In development, allow all origins
    if (!isProduction) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log(`CORS blocked for origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Origin', 'Accept'],
  exposedHeaders: ['Set-Cookie'],
  maxAge: 86400 // 24 hours
};

app.use(cors(corsOptions));

// Handle preflight requests explicitly
app.options('*', (req, res) => {
  const origin = req.headers.origin;

  if (allowedOrigins.includes(origin) || !isProduction) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Origin, Accept');
    res.setHeader('Access-Control-Max-Age', '86400');
  }
  res.sendStatus(200);
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(PUBLIC_PATH));
// Cache Control
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});



/* ==================================================================
   3. CUSTOM MIDDLEWARE
================================================================== */
// Handle preflight requests

const authenticate = (req, res, next) => {
  try {
    const token = req.cookies?.token;
    if (!token) return res.status(401).json({ error: "Authentication required" });

    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: payload.id, role: payload.role, phone: payload.phone };
    next();
  } catch (err) {
    console.error("Auth Error:", err.message);
    res.clearCookie("token", {
      httpOnly: true,
      secure: true,
      sameSite: "None",
      path: "/"
    });

    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Authentication required" });
    if (!allowedRoles.includes(req.user.role)) return res.status(403).json({ error: "Access denied" });
    next();
  };
};

const blockAfterLogin = (req, res, next) => {
  const token = req.cookies?.token;
  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      if (payload.role === "doctor") return res.redirect("/doc_home");
      return res.redirect("/user_home");
    } catch (e) { /* Invalid token */ }
  }
  next();
};

/* ==================================================================
   4. API ROUTES
================================================================== */

// --- A. AUTHENTICATION API ---
app.post("/api/user_signup", async (req, res) => {
  try {
    const { phone, password, confirmpassword } = req.body;
    if (!password || password.length < 6) return res.status(400).json({ error: "Password too short" });
    if (password !== confirmpassword) return res.status(400).json({ error: "Passwords mismatch" });

    const exists = await db.query("SELECT id FROM login WHERE phone=$1", [phone]);
    if (exists.rows.length) return res.status(400).json({ error: "Account exists" });

    const hash = bcrypt.hashSync(password, bcrypt.genSaltSync(saltRounds));
    const result = await db.query("INSERT INTO login (phone,password) VALUES ($1,$2) RETURNING id", [phone, hash]);

    const token = jwt.sign({ id: result.rows[0].id, phone, role: "user" }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER;

    // In your authentication routes (user_login, user_signup, doc_login, doc_signup):
    // In your auth routes (user_login, user_signup, doc_login, doc_signup):
    res.cookie("token", token, {
      httpOnly: true,
      secure: isProduction,          // Secure only in production
      sameSite: isProduction ? "None" : "Lax", // None for cross-site in production
      path: "/",
      maxAge: 2 * 60 * 60 * 1000 // 2 hours
      // REMOVE: domain: isProduction ? ".onrender.com" : undefined
    });


    res.json({ success: true, role: "user" });
  } catch (err) { res.status(500).json({ error: "Server error" }); }
});

app.post("/api/user_login", async (req, res) => {
  try {
    const { phone, password } = req.body;
    const result = await db.query("SELECT * FROM login WHERE phone=$1", [phone]);
    if (!result.rows.length) return res.status(400).json({ error: "Account not found" });
    if (!bcrypt.compareSync(password, result.rows[0].password)) return res.status(400).json({ error: "Incorrect password" });

    const token = jwt.sign({ id: result.rows[0].id, phone, role: "user" }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER;

    // In your authentication routes (user_login, user_signup, doc_login, doc_signup):
    // In your auth routes (user_login, user_signup, doc_login, doc_signup):
    res.cookie("token", token, {
      httpOnly: true,
      secure: isProduction,          // Secure only in production
      sameSite: isProduction ? "None" : "Lax", // None for cross-site in production
      path: "/",
      maxAge: 2 * 60 * 60 * 1000 // 2 hours
      // REMOVE: domain: isProduction ? ".onrender.com" : undefined
    });


    res.json({ success: true, role: "user" });
  } catch (err) { res.status(500).json({ error: "Server error" }); }
});

app.post("/api/doc_signup", async (req, res) => {
  try {
    const { phone, password, confirmpassword } = req.body;
    if (!password || password.length < 6) return res.status(400).json({ error: "Password too short" });
    if (password !== confirmpassword) return res.status(400).json({ error: "Passwords mismatch" });

    const exists = await db.query("SELECT docid FROM doc_login WHERE phone=$1", [phone]);
    if (exists.rows.length) return res.status(400).json({ error: "Doctor account exists" });

    const hash = bcrypt.hashSync(password, bcrypt.genSaltSync(saltRounds));
    const result = await db.query("INSERT INTO doc_login (phone,password) VALUES ($1,$2) RETURNING docid", [phone, hash]);

    const token = jwt.sign({ id: result.rows[0].docid, phone, role: "doctor" }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER;

    // In your authentication routes (user_login, user_signup, doc_login, doc_signup):
    // In your auth routes (user_login, user_signup, doc_login, doc_signup):
    res.cookie("token", token, {
      httpOnly: true,
      secure: isProduction,          // Secure only in production
      sameSite: isProduction ? "None" : "Lax", // None for cross-site in production
      path: "/",
      maxAge: 2 * 60 * 60 * 1000 // 2 hours
      // REMOVE: domain: isProduction ? ".onrender.com" : undefined
    });


    res.json({ success: true, role: "doctor" });
  } catch (err) { res.status(500).json({ error: "Server error" }); }
});

app.post("/api/doc_login", async (req, res) => {
  try {
    const { phone, password } = req.body;
    const result = await db.query("SELECT * FROM doc_login WHERE phone=$1", [phone]);
    if (!result.rows.length) return res.status(400).json({ error: "Account not found" });
    if (!bcrypt.compareSync(password, result.rows[0].password)) return res.status(400).json({ error: "Incorrect password" });

    const token = jwt.sign({ id: result.rows[0].docid, phone, role: "doctor" }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER;

    // In your authentication routes (user_login, user_signup, doc_login, doc_signup):
    // In your auth routes (user_login, user_signup, doc_login, doc_signup):
    res.cookie("token", token, {
      httpOnly: true,
      secure: isProduction,          // Secure only in production
      sameSite: isProduction ? "None" : "Lax", // None for cross-site in production
      path: "/",
      maxAge: 2 * 60 * 60 * 1000 // 2 hours
      // REMOVE: domain: isProduction ? ".onrender.com" : undefined
    });

    res.json({ success: true, role: "doctor" });
  } catch (err) { res.status(500).json({ error: "Server error" }); }
});

app.post("/api/logout", (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure:true,
    sameSite: "None",
    path: "/"
  });
  res.json({ success: true });
});

app.get("/api/auth/guest", (req, res) => res.json({ guest: true }));
app.get("/api/auth/user", authenticate, authorize("user"), (req, res) => res.json({ authenticated: true, role: "user", user: req.user }));
app.get("/api/auth/doctor", authenticate, authorize("doctor"), (req, res) => res.json({ authenticated: true, role: "doctor", user: req.user }));

// --- B. AI API ---
app.post("/api/ai/precheck", authenticate, async (req, res) => {
  try {
    const AI_URL = process.env.AI_SERVICE_URL || "http://127.0.0.1:8000";
    const response = await fetch(`${AI_URL}/ai/precheck`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(req.body)
    });
    const data = await response.json();
    try { await db.query(`INSERT INTO ai_prechecks (user_id, symptoms, ai_response, severity) VALUES ($1, $2, $3, $4)`, [req.user.id, req.body.text, JSON.stringify(data), data.severity || "unknown"]); } catch (e) { }
    res.json(data);
  } catch (err) { res.status(500).json({ error: "AI service unavailable" }); }
});

// --- C. PROFILE API ---
app.get("/api/user/profile", authenticate, authorize("user"), async (req, res) => {
  try {
    const result = await db.query("SELECT full_name, gender, custom_gender, date_of_birth, weight_kg, height_cm, blood_group, allergies FROM user_profile WHERE user_id = $1", [req.user.id]);
    if (!result.rows.length) return res.json({ exists: false });
    const r = result.rows[0];
    res.json({ exists: true, profile: { fullName: r.full_name, gender: r.gender, customGender: r.custom_gender, dob: r.date_of_birth, weight: r.weight_kg, height: r.height_cm, bloodGroup: r.blood_group, allergies: r.allergies } });
  } catch (err) { res.status(500).json({ error: "Failed to load profile" }); }
});

app.post("/api/user/profile", authenticate, authorize("user"), async (req, res) => {
  try {
    const { fullName, gender, customGender, dob, weight, height, bloodGroup, allergies } = req.body;
    if (!fullName || !gender || !dob || !weight || !height || !bloodGroup) return res.status(400).json({ error: "Missing required fields" });
    await db.query(`
            INSERT INTO user_profile (user_id, full_name, gender, custom_gender, date_of_birth, weight_kg, height_cm, blood_group, allergies)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
            ON CONFLICT (user_id) DO UPDATE SET 
            full_name=EXCLUDED.full_name, gender=EXCLUDED.gender, custom_gender=EXCLUDED.custom_gender, 
            date_of_birth=EXCLUDED.date_of_birth, weight_kg=EXCLUDED.weight_kg, height_cm=EXCLUDED.height_cm, 
            blood_group=EXCLUDED.blood_group, allergies=EXCLUDED.allergies`,
      [req.user.id, fullName, gender, customGender || null, dob, weight, height, bloodGroup, allergies || null]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: "Failed to save profile" }); }
});

app.get("/api/doctor/profile", authenticate, authorize("doctor"), async (req, res) => {
  try {
    const result = await db.query("SELECT full_name, specialization, experience_years, qualification, hospital_name, bio FROM doc_profile WHERE doc_id = $1", [req.user.id]);
    if (!result.rows.length) return res.json({ exists: false });
    const r = result.rows[0];
    res.json({ exists: true, profile: { fullName: r.full_name, specialization: r.specialization, experience: r.experience_years, qualification: r.qualification, hospital: r.hospital_name, bio: r.bio } });
  } catch (err) { res.status(500).json({ error: "Failed to load profile" }); }
});

app.post("/api/doctor/profile", authenticate, authorize("doctor"), async (req, res) => {
  try {
    const { fullName, specialization, experience, qualification, hospital, bio } = req.body;
    if (!fullName || !specialization || !experience) return res.status(400).json({ error: "Missing required fields" });
    await db.query(`
            INSERT INTO doc_profile (doc_id, full_name, specialization, experience_years, qualification, hospital_name, bio)
            VALUES ($1,$2,$3,$4,$5,$6,$7)
            ON CONFLICT (doc_id) DO UPDATE SET 
            full_name=EXCLUDED.full_name, specialization=EXCLUDED.specialization, experience_years=EXCLUDED.experience_years,
            qualification=EXCLUDED.qualification, hospital_name=EXCLUDED.hospital_name, bio=EXCLUDED.bio`,
      [req.user.id, fullName, specialization, experience, qualification || null, hospital || null, bio || null]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: "Failed to save profile" }); }
});

// --- D. APPOINTMENTS API ---
app.post("/api/appointments/book", authenticate, authorize("user"), async (req, res) => {
  try {
    const { doctorId, appointment_date, appointment_time } = req.body;
    const existing = await db.query(`SELECT id FROM appointments WHERE user_id=$1 AND status IN ('scheduled', 'approved', 'started') LIMIT 1`, [req.user.id]);
    if (existing.rows.length > 0) return res.status(400).json({ error: "You already have an active appointment" });

    await db.query("INSERT INTO appointments (user_id, doctor_id, appointment_date, appointment_time, status) VALUES ($1, $2, $3, $4, 'scheduled')",
      [req.user.id, doctorId, appointment_date, appointment_time]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: "Booking failed" }); }
});

app.get("/api/appointments/user", authenticate, authorize("user"), async (req, res) => {
  try {
    const result = await db.query(`SELECT a.*, p.full_name AS doctor_name, p.specialization FROM appointments a JOIN doc_profile p ON p.doc_id = a.doctor_id WHERE a.user_id = $1 AND a.status != 'completed' ORDER BY a.appointment_date, a.appointment_time LIMIT 1`, [req.user.id]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: "Load failed" }); }
});

app.get("/api/appointments/doctor", authenticate, authorize("doctor"), async (req, res) => {
  try {
    const result = await db.query(`SELECT a.id, a.appointment_date, a.appointment_time, a.status, a.room_id, up.full_name AS user_name FROM appointments a JOIN user_profile up ON up.user_id = a.user_id WHERE a.doctor_id = $1 AND a.status IN ('scheduled','started') ORDER BY a.appointment_date, a.appointment_time LIMIT 1`, [req.user.id]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: "Load failed" }); }
});

app.get("/api/doctors", authenticate, authorize("user"), async (req, res) => {
  try {
    const result = await db.query(`SELECT d.docid AS id, p.full_name, p.specialization FROM doc_login d JOIN doc_profile p ON p.doc_id = d.docid ORDER BY p.full_name`);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: "Load failed" }); }
});

// --- E. VIDEO API ---
app.get("/api/video/doctor/dashboard", authenticate, authorize("doctor"), async (req, res) => {
  try {
    const result = await db.query(`SELECT a.id, a.appointment_date, a.appointment_time, a.status, up.full_name AS user_name FROM appointments a JOIN user_profile up ON up.user_id = a.user_id WHERE a.doctor_id = $1 AND a.status IN ('scheduled','started') ORDER BY a.appointment_date, a.appointment_time LIMIT 1`, [req.user.id]);
    res.json({ appointment: result.rows[0] || null });
  } catch (err) { res.status(500).json({ error: "Failed to load dashboard" }); }
});

app.get("/api/video/user/dashboard", authenticate, authorize("user"), async (req, res) => {
  try {
    const result = await db.query(`SELECT a.id, a.appointment_date, a.appointment_time, a.status, dp.full_name AS doctor_name FROM appointments a JOIN doc_profile dp ON dp.doc_id = a.doctor_id WHERE a.user_id = $1 AND a.status IN ('scheduled','started') ORDER BY a.appointment_date, a.appointment_time LIMIT 1`, [req.user.id]);
    res.json({ appointment: result.rows[0] || null });
  } catch (err) { res.status(500).json({ error: "Failed to load dashboard" }); }
});

const startCallHandler = async (req, res, appointmentId) => {
  try {
    const roomId = crypto.randomUUID();
    const result = await db.query(`UPDATE appointments SET status='started', room_id=$1 WHERE id=$2 AND doctor_id=$3 AND status='scheduled' RETURNING room_id`, [roomId, appointmentId, req.user.id]);
    if (!result.rowCount) return res.status(400).json({ error: "Call already started/completed" });
    res.json({ roomId });
  } catch (err) { res.status(500).json({ error: "Failed to start call" }); }
};

app.post("/api/appointments/:id/start", authenticate, authorize("doctor"), (req, res) => startCallHandler(req, res, req.params.id));
app.post("/api/doc/start-call/:appointmentId", authenticate, authorize("doctor"), (req, res) => startCallHandler(req, res, req.params.appointmentId));

app.post("/api/appointments/:id/complete", authenticate, authorize("doctor"), async (req, res) => {
  try {
    await db.query("UPDATE appointments SET status='completed' WHERE id=$1 AND doctor_id=$2", [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: "End call failed" }); }
});

app.get("/api/user/join-call/:appointmentId", authenticate, authorize("user"), async (req, res) => {
  try {
    const result = await db.query("SELECT room_id FROM appointments WHERE id=$1 AND user_id=$2 AND status='started'", [req.params.appointmentId, req.user.id]);
    if (!result.rows.length) return res.status(404).json({ error: "Call not active" });
    res.json({ roomId: result.rows[0].room_id });
  } catch (err) { res.status(500).json({ error: "Join call failed" }); }
});

// --- F. UPLOAD & VAULT API ---
app.post("/api/upload", authenticate, upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "No file" });
    const folder = file.mimetype.startsWith("image/") ? "images" : "pdfs";
    const filePath = `${folder}/user_${req.user.id}/${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

    const { error } = await supabase.storage.from("uploads").upload(filePath, file.buffer, { contentType: file.mimetype });
    if (error) throw error;
    const { data } = await supabase.storage.from("uploads").createSignedUrl(filePath, 300);
    res.json({ message: "File uploaded", path: filePath, signedUrl: data.signedUrl });
  } catch (err) { res.status(500).json({ error: "Upload failed" }); }
});

app.post("/api/vault/upload", authenticate, authorize("user"), upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "No file" });
    const filePath = `vault/user_${req.user.id}/${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error } = await supabase.storage.from("uploads").upload(filePath, file.buffer, { contentType: file.mimetype });
    if (error) throw error;
    await db.query("INSERT INTO medical_records (user_id, file_name, file_path, record_type) VALUES ($1, $2, $3, $4)", [req.user.id, file.originalname, filePath, req.body.recordType || "general"]);
    res.status(200).json({ message: "Uploaded" });
  } catch (err) { res.status(500).json({ error: "Upload failed" }); }
});

app.get("/api/vault/user", authenticate, authorize("user"), async (req, res) => {
  const result = await db.query("SELECT id, file_name, record_type, uploaded_at FROM medical_records WHERE user_id=$1 ORDER BY uploaded_at DESC", [req.user.id]);
  res.json(result.rows);
});

app.get("/api/vault/doctor/:appointmentId", authenticate, authorize("doctor"), async (req, res) => {
  const appt = await db.query("SELECT user_id FROM appointments WHERE id=$1 AND doctor_id=$2 AND records_allowed=true AND status IN ('started','completed')", [req.params.appointmentId, req.user.id]);
  if (!appt.rows.length) return res.status(403).json({ error: "Access denied" });
  const records = await db.query("SELECT id, file_name, record_type, uploaded_at FROM medical_records WHERE user_id=$1 ORDER BY uploaded_at DESC", [appt.rows[0].user_id]);
  res.json(records.rows);
});

app.get("/api/vault/file/:id", authenticate, async (req, res) => {
  try {
    let record;
    const userFile = await db.query("SELECT file_path FROM medical_records WHERE id=$1 AND user_id=$2", [req.params.id, req.user.id]);
    if (userFile.rows.length) record = userFile.rows[0];
    if (!record && req.user.role === "doctor") {
      const docFile = await db.query(`SELECT mr.file_path FROM medical_records mr JOIN appointments a ON a.user_id = mr.user_id WHERE mr.id=$1 AND a.doctor_id=$2 AND a.records_allowed=true`, [req.params.id, req.user.id]);
      if (docFile.rows.length) record = docFile.rows[0];
    }
    if (!record) return res.status(403).json({ error: "Access denied" });
    const { data } = await supabase.storage.from("uploads").createSignedUrl(record.file_path, 300);
    res.json({ signedUrl: data.signedUrl });
  } catch (err) { res.status(500).json({ error: "Fetch failed" }); }
});

// --- G. PRESCRIPTION API ---
app.post("/api/notes/save", authenticate, authorize("doctor"), async (req, res) => {
  try {
    const { roomId, notes } = req.body;
    if (!roomId) return res.status(400).json({ error: "roomId required" });
    await db.query("INSERT INTO doctor_notes (room_id, doctor_id, notes) VALUES ($1, $2, $3) ON CONFLICT (room_id) DO UPDATE SET notes=EXCLUDED.notes", [roomId, req.user.id, notes || ""]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: "Save failed" }); }
});

app.get("/api/prescription/download/:roomId", authenticate, authorize("user", "doctor"), async (req, res) => {
  try {
    const { roomId } = req.params;
    if (req.user.role === "user") {
      const owns = await db.query(`SELECT 1 FROM appointments WHERE room_id = $1 AND user_id = $2 AND status = 'completed'`, [roomId, req.user.id]);
      if (!owns.rows.length) return res.status(403).json({ error: "Access denied" });
    }
    if (req.user.role === "doctor") {
      const owns = await db.query(`SELECT 1 FROM appointments WHERE room_id = $1 AND doctor_id = $2`, [roomId, req.user.id]);
      if (!owns.rows.length) return res.status(403).json({ error: "Access denied" });
    }
    const result = await db.query("SELECT notes FROM doctor_notes WHERE room_id = $1", [roomId]);
    if (!result.rows.length) return res.status(404).json({ error: "Prescription not found" });

    const notes = result.rows[0].notes || "No notes provided";
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="prescription.pdf"');

    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(res);
    doc.fontSize(20).text("Medical Prescription", { align: "center" });
    doc.moveDown();
    doc.fontSize(12).text(`Date: ${new Date().toLocaleString()}`);
    doc.moveDown();
    doc.fontSize(12).text("Doctor Notes:");
    doc.moveDown();
    doc.fontSize(11).text(notes);
    doc.end();
  } catch (err) { res.status(500).json({ error: "Failed to generate prescription" }); }
});
// Debug endpoint to check CORS headers
app.get('/api/debug/headers', (req, res) => {
  res.json({
    origin: req.headers.origin,
    host: req.headers.host,
    referer: req.headers.referer,
    headers: req.headers
  });
});

// Simple test endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'TeleHealth Backend'
  });
});


/* ==================================================================
   5. VIEW ROUTES (HTML ONLY - NO EJS)
================================================================== */

// --- Public Pages ---
app.get("/", (req, res) => res.sendFile(path.join(PAGES_PATH, "index.html")));
app.get("/role", (req, res) => res.sendFile(path.join(PAGES_PATH, "role.html")));
app.get("/services", (req, res) => res.sendFile(path.join(PAGES_PATH, "services.html")));
app.get("/contact", (req, res) => res.sendFile(path.join(PAGES_PATH, "contact.html")));

// --- Auth Pages ---
app.get("/user_login", blockAfterLogin, (req, res) => res.sendFile(path.join(PAGES_PATH, "user_login.html")));
app.get("/user_signup", blockAfterLogin, (req, res) => res.sendFile(path.join(PAGES_PATH, "user_signup.html")));
app.get("/doc_login", blockAfterLogin, (req, res) => res.sendFile(path.join(PAGES_PATH, "doc_login.html")));
app.get("/doc_signup", blockAfterLogin, (req, res) => res.sendFile(path.join(PAGES_PATH, "doc_signup.html")));

// --- User Protected Pages ---
app.get("/user_home", authenticate, authorize("user"), (req, res) => res.sendFile(path.join(PAGES_PATH, "user_home.html")));
app.get("/user_profile", authenticate, authorize("user"), (req, res) => res.sendFile(path.join(PAGES_PATH, "user_profile.html"))); // Converted to HTML
app.get("/user_video_dashboard", authenticate, authorize("user"), (req, res) => res.sendFile(path.join(PAGES_PATH, "user_video_dashboard.html")));
app.get("/appointments", authenticate, authorize("user"), (req, res) => res.sendFile(path.join(PAGES_PATH, "appointments.html")));
app.get("/records", authenticate, authorize("user"), (req, res) => res.sendFile(path.join(PAGES_PATH, "records.html")));
app.get("/predict", authenticate, authorize("user"), (req, res) => res.sendFile(path.join(PAGES_PATH, "predict.html"))); // Converted to HTML

// --- Doctor Protected Pages ---
app.get("/doc_home", authenticate, authorize("doctor"), (req, res) => res.sendFile(path.join(PAGES_PATH, "doc_home.html")));
app.get("/doc_profile", authenticate, authorize("doctor"), (req, res) => res.sendFile(path.join(PAGES_PATH, "doc_profile.html"))); // Converted to HTML
app.get("/doc_video_dashboard", authenticate, authorize("doctor"), (req, res) => res.sendFile(path.join(PAGES_PATH, "doc_video_dashboard.html")));

// --- Video Call Rooms (HTML) ---
// Note: Logic inside these HTML files extracts roomId from URL
app.get("/video/user/:roomId", authenticate, authorize("user"), (req, res) => res.sendFile(path.join(PAGES_PATH, "user_video.html")));
app.get("/video/doc/:roomId", authenticate, authorize("doctor"), (req, res) => res.sendFile(path.join(PAGES_PATH, "doc_video.html")));

// Handle 404 (Must be last)
app.use((req, res) => res.status(404).sendFile(path.join(PAGES_PATH, "404.html")));


/* ==================================================================
   6. SOCKET.IO
================================================================== */
/* ==================================================================
   6. SOCKET.IO
================================================================== */
const io = new Server(server, {
  cors: {
    origin: ['https://telehealth-production.onrender.com', 'http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST']
  }
});
io.on("connection", (socket) => {
  socket.on("join-room", ({ roomId, role }) => {
    if (!roomId || !role) return;
    socket.join(roomId);
    socket.roomId = roomId;
    socket.role = role;
    socket.to(roomId).emit("peer-joined", { role });
  });
  socket.on("signal", ({ roomId, payload }) => {
    if (roomId && payload) socket.to(roomId).emit("signal", payload);
  });
  socket.on("call-ended", ({ roomId }) => {
    if (roomId) {
      io.to(roomId).emit("call-ended");
      io.in(roomId).socketsLeave(roomId);
    }
  });
  socket.on("disconnect", () => {
    if (socket.roomId) socket.to(socket.roomId).emit("peer-disconnected", { role: socket.role });
  });
});

/* ==================================================================
   7. SERVER START
================================================================== */
server.listen(PORT, () => {
  console.log(`🚀 Final Server running on port ${PORT}`);
});