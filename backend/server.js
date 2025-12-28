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

// Simple CORS setup that should work
app.use(cors({
  origin: ['https://telehealth-production.onrender.com', 'http://localhost:3000'],
  credentials: true
}));











app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(PUBLIC_PATH));
app.use(checkProfileComplete);
// Cache Control
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});










/* ==================================================================
   3. CUSTOM MIDDLEWARE (UPDATED)
================================================================== */
const authenticate = (req, res, next) => {
  try {
    const token = req.cookies?.token;
    if (!token) return res.status(401).json({ error: "Authentication required" });

    const payload = jwt.verify(token, JWT_SECRET);
    req.user = {
      id: payload.id,
      role: payload.role,
      phone: payload.phone,
      profileComplete: payload.profileComplete || false
    };
    next();
  } catch (err) {
    console.error("Auth Error:", err.message);
    res.clearCookie("token", {
      httpOnly: true,
      secure: true,
      sameSite: "None",
      path: "/"
    });

    // For HTML pages, redirect to login instead of JSON error
    if (req.accepts('html')) {
      if (req.path.includes('/doc_')) {
        return res.redirect('/doc_login');
      } else {
        return res.redirect('/user_login');
      }
    }

    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Authentication required" });
    if (!allowedRoles.includes(req.user.role)) {
      // For HTML pages, redirect to appropriate home
      if (req.accepts('html')) {
        if (req.user.role === "doctor") return res.redirect("/doc_home");
        if (req.user.role === "user") return res.redirect("/user_home");
      }
      return res.status(403).json({ error: "Access denied" });
    }
    next();
  };
};

const blockAfterLogin = (req, res, next) => {
  const token = req.cookies?.token;
  if (token) {
    try {
      jwt.verify(token, JWT_SECRET);
      // Only block authentication pages when logged in
      const authPages = ['/role', '/user_login', '/user_signup', '/doc_login', '/doc_signup'];

      if (authPages.includes(req.path)) {
        // Get role from token without verification (it was already verified)
        const payload = jwt.decode(token);
        if (payload.role === "doctor") return res.redirect("/doc_home");
        if (payload.role === "user") return res.redirect("/user_home");
      }
    } catch (e) {
      // Invalid token - clear it and continue
      res.clearCookie("token", {
        httpOnly: true,
        secure: true,
        sameSite: "None",
        path: "/"
      });
    }
  }
  next();
};

// Helper to check if profile exists
const checkProfileExists = async (userId, role) => {
  try {
    if (role === "user") {
      const result = await db.query("SELECT 1 FROM user_profile WHERE user_id = $1", [userId]);
      return result.rows.length > 0;
    } else {
      const result = await db.query("SELECT 1 FROM doc_profile WHERE doc_id = $1", [userId]);
      return result.rows.length > 0;
    }
  } catch (err) {
    console.error("Error checking profile:", err);
    return false;
  }
};

// Middleware to check and handle profile completion
const checkProfileComplete = async (req, res, next) => {
  try {
    if (!req.user) return next();

    const { id, role } = req.user;

    // Routes that don't require profile completion
    const exemptRoutes = [
      '/user_profile', '/doc_profile',
      '/user_profile_create', '/doc_profile_create',
      '/api/logout', '/api/user/profile', '/api/doctor/profile'
    ];

    // If accessing a profile creation page, allow it
    if (exemptRoutes.includes(req.path)) return next();

    // Check if profile exists
    const profileExists = await checkProfileExists(id, role);

    // If profile doesn't exist and trying to access home, redirect to profile creation
    if (!profileExists) {
      if (req.path === '/user_home' || req.path === '/doc_home') {
        if (role === "user") return res.redirect('/user_profile_create');
        if (role === "doctor") return res.redirect('/doc_profile_create');
      }
    }

    // Update profileComplete status in req.user
    req.user.profileComplete = profileExists;

    next();
  } catch (err) {
    console.error("Profile check error:", err);
    next();
  }
};

const noCacheForDynamicPages = (req, res, next) => {
  const dynamicPages = [
    '/user_home', '/doc_home', '/user_profile', '/doc_profile',
    '/user_video_dashboard', '/doc_video_dashboard', '/appointments',
    '/records', '/predict', '/user_profile_create', '/doc_profile_create'
  ];

  if (dynamicPages.includes(req.path)) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }
  next();
};

// Apply middlewares
app.use(blockAfterLogin);
app.use(checkProfileComplete);
app.use(noCacheForDynamicPages);
















/* ==================================================================
   4. API ROUTES (UPDATED PROFILE SECTION)
================================================================== */

// --- A. AUTHENTICATION API (UPDATED) ---
app.post("/api/user_signup", async (req, res) => {
  try {
    const { phone, password, confirmpassword } = req.body;

    if (!password || password.length < 6) {
      return res.redirect('/user_signup?error=Password must be at least 6 characters');
    }

    if (password !== confirmpassword) {
      return res.redirect('/user_signup?error=Passwords do not match');
    }

    const exists = await db.query("SELECT id FROM login WHERE phone=$1", [phone]);
    if (exists.rows.length) {
      return res.redirect('/user_signup?error=Account already exists with this phone number');
    }

    const hash = bcrypt.hashSync(password, bcrypt.genSaltSync(saltRounds));
    const result = await db.query("INSERT INTO login (phone,password) VALUES ($1,$2) RETURNING id", [phone, hash]);

    const userId = result.rows[0].id;
    const token = jwt.sign({
      id: userId,
      phone,
      role: "user",
      profileComplete: false
    }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    // Set cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "None" : "Lax",
      path: "/",
      maxAge: 2 * 60 * 60 * 1000
    });

    // Always redirect to profile creation after signup
    return res.redirect('/user_profile_create');

  } catch (err) {
    console.error("Signup error:", err);
    res.redirect('/user_signup?error=Server error. Please try again.');
  }
});

app.post("/api/user_login", async (req, res) => {
  try {
    const { phone, password } = req.body;

    const result = await db.query("SELECT * FROM login WHERE phone=$1", [phone]);

    if (!result.rows.length) {
      return res.redirect('/user_login?error=Account not found');
    }

    const isValid = bcrypt.compareSync(password, result.rows[0].password);
    if (!isValid) {
      return res.redirect('/user_login?error=Incorrect password');
    }

    const userId = result.rows[0].id;

    // Check if profile exists
    const profileExists = await checkProfileExists(userId, "user");

    const token = jwt.sign({
      id: userId,
      phone,
      role: "user",
      profileComplete: profileExists
    }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    // Set cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "None" : "Lax",
      path: "/",
      maxAge: 2 * 60 * 60 * 1000
    });

    if (!profileExists) {
      return res.redirect('/user_profile_create');
    } else {
      return res.redirect('/user_home');
    }

  } catch (err) {
    console.error("Login error:", err);
    res.redirect('/user_login?error=Server error. Please try again.');
  }
});

app.post("/api/doc_signup", async (req, res) => {
  try {
    const { phone, password, confirmpassword } = req.body;

    if (!password || password.length < 6) {
      return res.redirect('/doc_signup?error=Password must be at least 6 characters');
    }

    if (password !== confirmpassword) {
      return res.redirect('/doc_signup?error=Passwords do not match');
    }

    const exists = await db.query("SELECT docid FROM doc_login WHERE phone=$1", [phone]);
    if (exists.rows.length) {
      return res.redirect('/doc_signup?error=Doctor account already exists with this phone number');
    }

    const hash = bcrypt.hashSync(password, bcrypt.genSaltSync(saltRounds));
    const result = await db.query("INSERT INTO doc_login (phone,password) VALUES ($1,$2) RETURNING docid", [phone, hash]);

    const doctorId = result.rows[0].docid;
    const token = jwt.sign({
      id: doctorId,
      phone,
      role: "doctor",
      profileComplete: false
    }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    // Set cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "None" : "Lax",
      path: "/",
      maxAge: 2 * 60 * 60 * 1000
    });

    return res.redirect('/doc_profile_create');

  } catch (err) {
    console.error("Doctor signup error:", err);
    res.redirect('/doc_signup?error=Server error. Please try again.');
  }
});

app.post("/api/doc_login", async (req, res) => {
  try {
    const { phone, password } = req.body;

    const result = await db.query("SELECT * FROM doc_login WHERE phone=$1", [phone]);

    if (!result.rows.length) {
      return res.redirect('/doc_login?error=Account not found');
    }

    const isValid = bcrypt.compareSync(password, result.rows[0].password);
    if (!isValid) {
      return res.redirect('/doc_login?error=Incorrect password');
    }

    const doctorId = result.rows[0].docid;

    // Check if profile exists
    const profileExists = await checkProfileExists(doctorId, "doctor");

    const token = jwt.sign({
      id: doctorId,
      phone,
      role: "doctor",
      profileComplete: profileExists
    }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    // Set cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "None" : "Lax",
      path: "/",
      maxAge: 2 * 60 * 60 * 1000
    });

    if (!profileExists) {
      return res.redirect('/doc_profile_create');
    } else {
      return res.redirect('/doc_home');
    }

  } catch (err) {
    console.error("Doctor login error:", err);
    res.redirect('/doc_login?error=Server error. Please try again.');
  }
});










// --- C. PROFILE API (COMPLETELY UPDATED) ---
app.get("/api/user/profile", authenticate, authorize("user"), async (req, res) => {
  try {
    const result = await db.query(
      "SELECT full_name, gender, custom_gender, date_of_birth, weight_kg, height_cm, blood_group, allergies FROM user_profile WHERE user_id = $1",
      [req.user.id]
    );

    if (!result.rows.length) {
      return res.json({
        exists: false,
        message: "Profile not found"
      });
    }

    const r = result.rows[0];
    res.json({
      exists: true,
      profile: {
        fullName: r.full_name,
        gender: r.gender,
        customGender: r.custom_gender,
        dob: r.date_of_birth ? new Date(r.date_of_birth).toISOString().split('T')[0] : null,
        weight: r.weight_kg,
        height: r.height_cm,
        bloodGroup: r.blood_group,
        allergies: r.allergies
      }
    });
  } catch (err) {
    console.error("Error loading user profile:", err);
    res.status(500).json({ error: "Failed to load profile" });
  }
});

app.post("/api/user/profile", authenticate, authorize("user"), async (req, res) => {
  try {
    const { fullName, gender, customGender, dob, weight, height, bloodGroup, allergies } = req.body;

    // Validate required fields
    if (!fullName || !gender || !dob || !weight || !height || !bloodGroup) {
      return res.status(400).json({
        error: "Missing required fields",
        details: { fullName, gender, dob, weight, height, bloodGroup }
      });
    }

    // Insert or update profile
    await db.query(`
      INSERT INTO user_profile (user_id, full_name, gender, custom_gender, date_of_birth, weight_kg, height_cm, blood_group, allergies)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (user_id) DO UPDATE SET 
        full_name = EXCLUDED.full_name, 
        gender = EXCLUDED.gender, 
        custom_gender = EXCLUDED.custom_gender, 
        date_of_birth = EXCLUDED.date_of_birth, 
        weight_kg = EXCLUDED.weight_kg, 
        height_cm = EXCLUDED.height_cm, 
        blood_group = EXCLUDED.blood_group, 
        allergies = EXCLUDED.allergies
    `, [
      req.user.id,
      fullName,
      gender,
      customGender || null,
      dob,
      parseFloat(weight),
      parseFloat(height),
      bloodGroup,
      allergies || null
    ]);

    // Update token with profileComplete flag
    const newToken = jwt.sign({
      ...req.user,
      profileComplete: true
    }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    // Update cookie
    res.cookie("token", newToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "None" : "Lax",
      path: "/",
      maxAge: 2 * 60 * 60 * 1000
    });

    res.json({
      success: true,
      message: "Profile saved successfully",
      redirect: "/user_home"
    });
  } catch (err) {
    console.error("Error saving user profile:", err);

    if (err.code === '23505') { // Unique violation
      return res.status(400).json({ error: "Profile already exists for this user" });
    }

    res.status(500).json({ error: "Failed to save profile" });
  }
});

app.get("/api/doctor/profile", authenticate, authorize("doctor"), async (req, res) => {
  try {
    const result = await db.query(
      "SELECT full_name, specialization, experience_years, qualification, hospital_name, bio FROM doc_profile WHERE doc_id = $1",
      [req.user.id]
    );

    if (!result.rows.length) {
      return res.json({
        exists: false,
        message: "Profile not found"
      });
    }

    const r = result.rows[0];
    res.json({
      exists: true,
      profile: {
        fullName: r.full_name,
        specialization: r.specialization,
        experience: r.experience_years,
        qualification: r.qualification,
        hospital: r.hospital_name,
        bio: r.bio
      }
    });
  } catch (err) {
    console.error("Error loading doctor profile:", err);
    res.status(500).json({ error: "Failed to load profile" });
  }
});

app.post("/api/doctor/profile", authenticate, authorize("doctor"), async (req, res) => {
  try {
    const { fullName, specialization, experience, qualification, hospital, bio } = req.body;

    // Validate required fields
    if (!fullName || !specialization || !experience) {
      return res.status(400).json({
        error: "Missing required fields",
        details: { fullName, specialization, experience }
      });
    }

    // Insert or update profile
    await db.query(`
      INSERT INTO doc_profile (doc_id, full_name, specialization, experience_years, qualification, hospital_name, bio)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (doc_id) DO UPDATE SET 
        full_name = EXCLUDED.full_name, 
        specialization = EXCLUDED.specialization, 
        experience_years = EXCLUDED.experience_years,
        qualification = EXCLUDED.qualification, 
        hospital_name = EXCLUDED.hospital_name, 
        bio = EXCLUDED.bio
    `, [
      req.user.id,
      fullName,
      specialization,
      parseInt(experience),
      qualification || null,
      hospital || null,
      bio || null
    ]);

    // Update token with profileComplete flag
    const newToken = jwt.sign({
      ...req.user,
      profileComplete: true
    }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    // Update cookie
    res.cookie("token", newToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "None" : "Lax",
      path: "/",
      maxAge: 2 * 60 * 60 * 1000
    });

    res.json({
      success: true,
      message: "Profile saved successfully",
      redirect: "/doc_home"
    });
  } catch (err) {
    console.error("Error saving doctor profile:", err);

    if (err.code === '23505') { // Unique violation
      return res.status(400).json({ error: "Profile already exists for this doctor" });
    }

    res.status(500).json({ error: "Failed to save profile" });
  }
});

app.post("/api/logout", (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: true,
    sameSite: "None",
    path: "/"
  });

  // For AJAX requests, return JSON. For form submissions, redirect to home
  const isAjax = req.headers['x-requested-with'] === 'XMLHttpRequest';
  if (isAjax) {
    res.json({ success: true });
  } else {
    res.redirect('/');
  }
});
















// --- B. AI API ---
app.post("/api/ai/precheck", authenticate, async (req, res) => {
  try {
    const AI_URL = process.env.AI_SERVICE_URL || "http://127.0.0.1:8000";
    const response = await fetch(`${AI_URL}/ai/precheck`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(req.body)
    });
    const data = await response.json();
    try {
      await db.query(`INSERT INTO ai_prechecks (user_id, symptoms, ai_response, severity) VALUES ($1, $2, $3, $4)`,
        [req.user.id, req.body.text, JSON.stringify(data), data.severity || "unknown"]);
    } catch (e) {
      console.error("Error saving AI precheck:", e);
    }
    res.json(data);
  } catch (err) {
    console.error("AI service error:", err);
    res.status(500).json({ error: "AI service unavailable" });
  }
});










// --- D. APPOINTMENTS API ---
app.post("/api/appointments/book", authenticate, authorize("user"), async (req, res) => {
  try {
    const { doctorId, appointment_date, appointment_time } = req.body;

    // Check for existing active appointments
    const existing = await db.query(
      `SELECT id FROM appointments WHERE user_id=$1 AND status IN ('scheduled', 'approved', 'started') LIMIT 1`,
      [req.user.id]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: "You already have an active appointment" });
    }

    await db.query(
      "INSERT INTO appointments (user_id, doctor_id, appointment_date, appointment_time, status) VALUES ($1, $2, $3, $4, 'scheduled')",
      [req.user.id, doctorId, appointment_date, appointment_time]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Error booking appointment:", err);
    res.status(500).json({ error: "Booking failed" });
  }
});

app.get("/api/appointments/user", authenticate, authorize("user"), async (req, res) => {
  try {
    const result = await db.query(
      `SELECT a.*, p.full_name AS doctor_name, p.specialization 
       FROM appointments a 
       JOIN doc_profile p ON p.doc_id = a.doctor_id 
       WHERE a.user_id = $1 AND a.status != 'completed' 
       ORDER BY a.appointment_date, a.appointment_time LIMIT 1`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error loading user appointments:", err);
    res.status(500).json({ error: "Load failed" });
  }
});

app.get("/api/appointments/doctor", authenticate, authorize("doctor"), async (req, res) => {
  try {
    const result = await db.query(
      `SELECT a.id, a.appointment_date, a.appointment_time, a.status, a.room_id, up.full_name AS user_name 
       FROM appointments a 
       JOIN user_profile up ON up.user_id = a.user_id 
       WHERE a.doctor_id = $1 AND a.status IN ('scheduled','started') 
       ORDER BY a.appointment_date, a.appointment_time LIMIT 1`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error loading doctor appointments:", err);
    res.status(500).json({ error: "Load failed" });
  }
});

app.get("/api/doctors", authenticate, authorize("user"), async (req, res) => {
  try {
    const result = await db.query(
      `SELECT d.docid AS id, p.full_name, p.specialization 
       FROM doc_login d 
       JOIN doc_profile p ON p.doc_id = d.docid 
       ORDER BY p.full_name`
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error loading doctors:", err);
    res.status(500).json({ error: "Load failed" });
  }
});










// --- E. VIDEO API ---
app.get("/api/video/doctor/dashboard", authenticate, authorize("doctor"), async (req, res) => {
  try {
    const result = await db.query(
      `SELECT a.id, a.appointment_date, a.appointment_time, a.status, up.full_name AS user_name 
       FROM appointments a 
       JOIN user_profile up ON up.user_id = a.user_id 
       WHERE a.doctor_id = $1 AND a.status IN ('scheduled','started') 
       ORDER BY a.appointment_date, a.appointment_time LIMIT 1`,
      [req.user.id]
    );
    res.json({ appointment: result.rows[0] || null });
  } catch (err) {
    console.error("Error loading doctor video dashboard:", err);
    res.status(500).json({ error: "Failed to load dashboard" });
  }
});

app.get("/api/video/user/dashboard", authenticate, authorize("user"), async (req, res) => {
  try {
    const result = await db.query(
      `SELECT a.id, a.appointment_date, a.appointment_time, a.status, dp.full_name AS doctor_name 
       FROM appointments a 
       JOIN doc_profile dp ON dp.doc_id = a.doctor_id 
       WHERE a.user_id = $1 AND a.status IN ('scheduled','started') 
       ORDER BY a.appointment_date, a.appointment_time LIMIT 1`,
      [req.user.id]
    );
    res.json({ appointment: result.rows[0] || null });
  } catch (err) {
    console.error("Error loading user video dashboard:", err);
    res.status(500).json({ error: "Failed to load dashboard" });
  }
});

const startCallHandler = async (req, res, appointmentId) => {
  try {
    const roomId = crypto.randomUUID();
    const result = await db.query(
      `UPDATE appointments SET status='started', room_id=$1 WHERE id=$2 AND doctor_id=$3 AND status='scheduled' RETURNING room_id`,
      [roomId, appointmentId, req.user.id]
    );

    if (!result.rowCount) {
      return res.status(400).json({ error: "Call already started/completed" });
    }

    res.json({ roomId });
  } catch (err) {
    console.error("Error starting call:", err);
    res.status(500).json({ error: "Failed to start call" });
  }
};

app.post("/api/appointments/:id/start", authenticate, authorize("doctor"), (req, res) => startCallHandler(req, res, req.params.id));
app.post("/api/doc/start-call/:appointmentId", authenticate, authorize("doctor"), (req, res) => startCallHandler(req, res, req.params.appointmentId));

app.post("/api/appointments/:id/complete", authenticate, authorize("doctor"), async (req, res) => {
  try {
    await db.query(
      "UPDATE appointments SET status='completed' WHERE id=$1 AND doctor_id=$2",
      [req.params.id, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("Error completing appointment:", err);
    res.status(500).json({ error: "End call failed" });
  }
});

app.get("/api/user/join-call/:appointmentId", authenticate, authorize("user"), async (req, res) => {
  try {
    const result = await db.query(
      "SELECT room_id FROM appointments WHERE id=$1 AND user_id=$2 AND status='started'",
      [req.params.appointmentId, req.user.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Call not active" });
    }

    res.json({ roomId: result.rows[0].room_id });
  } catch (err) {
    console.error("Error joining call:", err);
    res.status(500).json({ error: "Join call failed" });
  }
});

















// --- F. UPLOAD & VAULT API ---
app.post("/api/upload", authenticate, upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "No file" });

    const folder = file.mimetype.startsWith("image/") ? "images" : "pdfs";
    const filePath = `${folder}/user_${req.user.id}/${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

    const { error } = await supabase.storage.from("uploads").upload(filePath, file.buffer, {
      contentType: file.mimetype
    });

    if (error) throw error;

    const { data } = await supabase.storage.from("uploads").createSignedUrl(filePath, 300);
    res.json({ message: "File uploaded", path: filePath, signedUrl: data.signedUrl });
  } catch (err) {
    console.error("Error uploading file:", err);
    res.status(500).json({ error: "Upload failed" });
  }
});

app.post("/api/vault/upload", authenticate, authorize("user"), upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "No file" });

    const filePath = `vault/user_${req.user.id}/${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

    const { error } = await supabase.storage.from("uploads").upload(filePath, file.buffer, {
      contentType: file.mimetype
    });

    if (error) throw error;

    await db.query(
      "INSERT INTO medical_records (user_id, file_name, file_path, record_type) VALUES ($1, $2, $3, $4)",
      [req.user.id, file.originalname, filePath, req.body.recordType || "general"]
    );

    res.status(200).json({ message: "Uploaded" });
  } catch (err) {
    console.error("Error uploading to vault:", err);
    res.status(500).json({ error: "Upload failed" });
  }
});

app.get("/api/vault/user", authenticate, authorize("user"), async (req, res) => {
  try {
    const result = await db.query(
      "SELECT id, file_name, record_type, uploaded_at FROM medical_records WHERE user_id=$1 ORDER BY uploaded_at DESC",
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error loading user vault:", err);
    res.status(500).json({ error: "Failed to load records" });
  }
});

app.get("/api/vault/doctor/:appointmentId", authenticate, authorize("doctor"), async (req, res) => {
  try {
    const appt = await db.query(
      "SELECT user_id FROM appointments WHERE id=$1 AND doctor_id=$2 AND records_allowed=true AND status IN ('started','completed')",
      [req.params.appointmentId, req.user.id]
    );

    if (!appt.rows.length) {
      return res.status(403).json({ error: "Access denied" });
    }

    const records = await db.query(
      "SELECT id, file_name, record_type, uploaded_at FROM medical_records WHERE user_id=$1 ORDER BY uploaded_at DESC",
      [appt.rows[0].user_id]
    );

    res.json(records.rows);
  } catch (err) {
    console.error("Error loading doctor vault:", err);
    res.status(500).json({ error: "Failed to load records" });
  }
});

app.get("/api/vault/file/:id", authenticate, async (req, res) => {
  try {
    let record;

    // Check if user owns the file
    const userFile = await db.query(
      "SELECT file_path FROM medical_records WHERE id=$1 AND user_id=$2",
      [req.params.id, req.user.id]
    );

    if (userFile.rows.length) {
      record = userFile.rows[0];
    }

    // If not, check if doctor has access
    if (!record && req.user.role === "doctor") {
      const docFile = await db.query(
        `SELECT mr.file_path 
         FROM medical_records mr 
         JOIN appointments a ON a.user_id = mr.user_id 
         WHERE mr.id=$1 AND a.doctor_id=$2 AND a.records_allowed=true`,
        [req.params.id, req.user.id]
      );

      if (docFile.rows.length) {
        record = docFile.rows[0];
      }
    }

    if (!record) {
      return res.status(403).json({ error: "Access denied" });
    }

    const { data } = await supabase.storage.from("uploads").createSignedUrl(record.file_path, 300);
    res.json({ signedUrl: data.signedUrl });
  } catch (err) {
    console.error("Error fetching vault file:", err);
    res.status(500).json({ error: "Fetch failed" });
  }
});





















// --- G. PRESCRIPTION API ---
app.post("/api/notes/save", authenticate, authorize("doctor"), async (req, res) => {
  try {
    const { roomId, notes } = req.body;
    if (!roomId) return res.status(400).json({ error: "roomId required" });

    await db.query(
      "INSERT INTO doctor_notes (room_id, doctor_id, notes) VALUES ($1, $2, $3) ON CONFLICT (room_id) DO UPDATE SET notes=EXCLUDED.notes",
      [roomId, req.user.id, notes || ""]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Error saving notes:", err);
    res.status(500).json({ error: "Save failed" });
  }
});

app.get("/api/prescription/download/:roomId", authenticate, authorize("user", "doctor"), async (req, res) => {
  try {
    const { roomId } = req.params;

    // Check authorization
    if (req.user.role === "user") {
      const owns = await db.query(
        `SELECT 1 FROM appointments WHERE room_id = $1 AND user_id = $2 AND status = 'completed'`,
        [roomId, req.user.id]
      );
      if (!owns.rows.length) return res.status(403).json({ error: "Access denied" });
    }

    if (req.user.role === "doctor") {
      const owns = await db.query(
        `SELECT 1 FROM appointments WHERE room_id = $1 AND doctor_id = $2`,
        [roomId, req.user.id]
      );
      if (!owns.rows.length) return res.status(403).json({ error: "Access denied" });
    }

    const result = await db.query("SELECT notes FROM doctor_notes WHERE room_id = $1", [roomId]);
    if (!result.rows.length) return res.status(404).json({ error: "Prescription not found" });

    const notes = result.rows[0].notes || "No notes provided";

    // Set headers for PDF download
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
  } catch (err) {
    console.error("Error generating prescription:", err);
    res.status(500).json({ error: "Failed to generate prescription" });
  }
});













/* ==================================================================
   5. VIEW ROUTES (HTML ONLY - NO EJS)
================================================================== */

// --- Public Pages ---
app.get("/", blockAfterLogin, (req, res) => res.sendFile(path.join(PAGES_PATH, "index.html")));
app.get("/role", blockAfterLogin, (req, res) => res.sendFile(path.join(PAGES_PATH, "role.html")));
app.get("/services", blockAfterLogin, (req, res) => res.sendFile(path.join(PAGES_PATH, "services.html")));
app.get("/contact", blockAfterLogin, (req, res) => res.sendFile(path.join(PAGES_PATH, "contact.html")));

// --- Auth Pages ---
app.get("/user_login", blockAfterLogin, (req, res) => res.sendFile(path.join(PAGES_PATH, "user_login.html")));
app.get("/user_signup", blockAfterLogin, (req, res) => res.sendFile(path.join(PAGES_PATH, "user_signup.html")));
app.get("/doc_login", blockAfterLogin, (req, res) => res.sendFile(path.join(PAGES_PATH, "doc_login.html")));
app.get("/doc_signup", blockAfterLogin, (req, res) => res.sendFile(path.join(PAGES_PATH, "doc_signup.html")));

// --- User Protected Pages ---
app.get("/user_home", authenticate, authorize("user"), async (req, res) => {
  try {
    // Double-check profile exists (extra safety)
    const profileExists = await checkProfileExists(req.user.id, "user");
    if (!profileExists) {
      return res.redirect('/user_profile_create');
    }
    res.sendFile(path.join(PAGES_PATH, "user_home.html"));
  } catch (err) {
    console.error("Error loading user home:", err);
    res.status(500).send("Internal server error");
  }
});
app.get("/user_profile", authenticate, authorize("user"), (req, res) => res.sendFile(path.join(PAGES_PATH, "user_profile.html")));
app.get("/userprofile", authenticate, authorize("user"), (req, res) => res.redirect("/user_profile"));
app.get("/user_profile_create", authenticate, authorize("user"), (req, res) => res.sendFile(path.join(PAGES_PATH, "user_profile_create.html")));

app.get("/user_video_dashboard", authenticate, authorize("user"), (req, res) => res.sendFile(path.join(PAGES_PATH, "user_video_dashboard.html")));
app.get("/appointments", authenticate, authorize("user"), (req, res) => res.sendFile(path.join(PAGES_PATH, "appointments.html")));
app.get("/records", authenticate, authorize("user"), (req, res) => res.sendFile(path.join(PAGES_PATH, "records.html")));
app.get("/predict", authenticate, authorize("user"), (req, res) => res.sendFile(path.join(PAGES_PATH, "predict.html")));

// --- Doctor Protected Pages ---
app.get("/doc_home", authenticate, authorize("doctor"), async (req, res) => {
  try {
    // Double-check profile exists (extra safety)
    const profileExists = await checkProfileExists(req.user.id, "doctor");
    if (!profileExists) {
      return res.redirect('/doc_profile_create');
    }
    res.sendFile(path.join(PAGES_PATH, "doc_home.html"));
  } catch (err) {
    console.error("Error loading doctor home:", err);
    res.status(500).send("Internal server error");
  }
});
app.get("/doc_profile", authenticate, authorize("doctor"), (req, res) => res.sendFile(path.join(PAGES_PATH, "doc_profile.html")));
app.get("/doc_video_dashboard", authenticate, authorize("doctor"), (req, res) => res.sendFile(path.join(PAGES_PATH, "doc_video_dashboard.html")));
app.get("/docprofile", authenticate, authorize("doctor"), (req, res) => res.redirect("/doc_profile"));

app.get("/doc_profile_create", authenticate, authorize("doctor"), (req, res) => res.sendFile(path.join(PAGES_PATH, "doc_profile_create.html")));

// --- Video Call Rooms (HTML) ---
app.get("/video/user/:roomId", authenticate, authorize("user"), (req, res) => res.sendFile(path.join(PAGES_PATH, "user_video.html")));
app.get("/video/doc/:roomId", authenticate, authorize("doctor"), (req, res) => res.sendFile(path.join(PAGES_PATH, "doc_video.html")));

// Handle 404 (Must be last)
app.use((req, res) => res.status(404).sendFile(path.join(PAGES_PATH, "404.html")));

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
  console.log(`🌐 Frontend: https://telehealth-production.onrender.com`);
  console.log(`🔧 Backend: https://telehealth-backend-9c46.onrender.com`);
});