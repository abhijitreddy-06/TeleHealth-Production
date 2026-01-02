// ==============================================
// IMPORTS & CONFIGURATION (COMMONJS)
// ==============================================
require('dotenv').config();
const express = require("express");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const { Pool } = require("pg");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const PDFDocument = require("pdfkit");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require('express-rate-limit');
const winston = require('winston');
const expressWinston = require('express-winston');
const { createClient } = require('@supabase/supabase-js');

// ==============================================
// INITIALIZATION
// ==============================================
const app = express();
const PROJECT_ROOT = __dirname;

// Get port from environment or default to 3000
const port = process.env.PORT || 3000;

// ==============================================
// JWT CONFIGURATION
// ==============================================
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
const JWT_EXPIRES_IN = "7d";

// ==============================================
// LOGGING CONFIGURATION
// ==============================================
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' }),
    ],
});

if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
        ),
    }));
}

// ==============================================
// SUPABASE CONFIGURATION
// ==============================================
const supabase = createClient(
    process.env.SUPABASE_URL || "",
    process.env.SUPABASE_ANON_KEY || "",
    process.env.SUPABASE_SERVICE_KEY ? {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    } : undefined
);

// ==============================================
// DATABASE CONFIGURATION (POOLING)
// ==============================================

const db = new Pool({
    connectionString: process.env.DATABASE_URL || "postgresql://postgres:Abhi.data@localhost:5432/CottonCure",
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Test database connection
db.connect()
    .then(() => {
        logger.info("✅ Connected to PostgreSQL database");
        console.log("Connected to PostgreSQL");
    })
    .catch(err => {
        logger.error("❌ Failed to connect to PostgreSQL:", err);
        console.error("Failed to connect to PostgreSQL:", err.stack);
    });

// ==============================================
// MIDDLEWARE SETUP
// ==============================================

// Security middleware
// In server.js, update helmet configuration:
// app.use(helmet({
//     contentSecurityPolicy: {
//         directives: {
//             defaultSrc: ["'self'"],
//             styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
//             scriptSrc: ["'self'", "'unsafe-inline'"],
//             imgSrc: ["'self'", "data:", "https:"],
//             connectSrc: ["'self'", "http://127.0.0.1:8000", "ws://localhost:3000"],
//             fontSrc: ["'self'", "https://fonts.gstatic.com"],
//         }
//     },
//     crossOriginEmbedderPolicy: false
// }));

// CORS configuration for frontend-backend separation
app.use(cors({
    origin: process.env.NODE_ENV === 'production'
        ? [process.env.FRONTEND_URL, 'https://telehealth-production.onrender.com']
        : ['http://localhost:3000', 'http://localhost:8080'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
}));

// Rate limiting
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests from this IP, please try again later.'
});

// Request logging
app.use(expressWinston.logger({
    winstonInstance: logger,
    meta: true,
    msg: 'HTTP {{req.method}} {{req.url}}',
    expressFormat: true,
    colorize: false,
    ignoreRoute: function (req, res) { return req.path === '/health'; }
}));

// Body parsing
app.use(bodyParser.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Static files
app.use(express.static(path.join(PROJECT_ROOT, "public")));

// View engine
app.set("view engine", "ejs");
app.set("views", path.join(PROJECT_ROOT, "views"));

// Cookie configuration
const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // true for HTTPS
    sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax', // 'None' for cross-site
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/'
};
// ==============================================
// SOCKET.IO SETUP
// ==============================================
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.NODE_ENV === 'production'
            ? process.env.FRONTEND_URL || 'https://your-frontend.com'
            : ['http://localhost:3000', 'http://localhost:8080'],
        credentials: true
    }
});

// CORS configuration for production
const corsOptions = {
    origin: 'https://telehealth-production.onrender.com',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
    exposedHeaders: ['Set-Cookie']
};

if (process.env.NODE_ENV !== 'production') {
    corsOptions.origin = ['http://localhost:3000', 'http://localhost:8080'];
}

app.use(cors(corsOptions));

// Update your authenticate middleware to DEBUG:
function authenticate(req, res, next) {
    console.log("DEBUG: Authenticate middleware called");
    console.log("DEBUG: Cookies received:", req.cookies);
    const token = req.cookies.token;

    if (!token) {
        console.log("DEBUG: No token found, redirecting to /role");
        return res.redirect("/role");
    }

    try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.user = {
            id: payload.id,
            role: payload.role,
            phone: payload.phone
        };
        console.log("DEBUG: User authenticated:", req.user);
        next();
    } catch (err) {
        console.log("DEBUG: JWT verification failed:", err.message);
        res.clearCookie("token", cookieOptions);
        return res.redirect("/role");
    }
}

function authorize(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.redirect("/role");
        }

        if (!allowedRoles.includes(req.user.role)) {
            logger.warn(`Unauthorized access attempt by ${req.user.role} to ${req.path}`);
            return res.redirect("/role");
        }

        next();
    };
}

function blockAfterLogin(req, res, next) {
    const token = req.cookies.token;
    if (!token) return next();

    try {
        const payload = jwt.verify(token, JWT_SECRET);

        if (payload.role === "doctor") {
            return res.redirect("/doc_home");
        }

        return res.redirect("/user_home");

    } catch {
        return next();
    }
}

// ==============================================
// MULTER CONFIGURATION (for form file uploads)
// ==============================================
const storage = multer.memoryStorage(); // Store in memory for Supabase upload
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|pdf|doc|docx/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only images, PDFs, and Word documents are allowed'));
        }
    }
});

// ==============================================
// ROUTE HANDLERS
// ==============================================

// AI Routes
function aiRoutes(app) {
    // Render AI page
    app.get("/predict", authenticate, (req, res) => {
        res.render("predict");
    });

    // Proxy AI request → Flask
    app.post("/api/ai/precheck", authenticate, async (req, res) => {
        try {
            const response = await fetch("http://127.0.0.1:8000/ai/precheck", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(req.body)
            });

            const data = await response.json();

            await db.query(
                `INSERT INTO ai_prechecks (user_id, symptoms, ai_response, severity)
                 VALUES ($1, $2, $3, $4)`,
                [
                    req.user.id,
                    req.body.text,
                    JSON.stringify(data),
                    data.severity || "unknown"
                ]
            );

            res.json(data);

        } catch (err) {
            logger.error("AI service error:", err);
            res.status(500).json({ error: "AI service unavailable" });
        }
    });
}

// Appointment Routes
function appointmentRoutes(app) {
    // Book Appointment (User)
    app.post(
        "/appointments/book",
        authenticate,
        authorize("user"),
        async (req, res) => {
            const { doctorId, appointment_date, appointment_time } = req.body;
            const date = appointment_date;
            const time = appointment_time;

            try {
                // Check if user already has an active appointment
                const existing = await db.query(
                    `SELECT id FROM appointments
                     WHERE user_id = $1
                       AND status IN ('scheduled', 'approved', 'started')
                     LIMIT 1`,
                    [req.user.id]
                );

                if (existing.rows.length > 0) {
                    return res.status(400).send(`
                        <script>
                            alert("You already have an active appointment. Please complete it before booking a new one.");
                            window.location.href = "/appointments";
                        </script>
                    `);
                }

                // Create new appointment
                await db.query(
                    `INSERT INTO appointments
                     (user_id, doctor_id, appointment_date, appointment_time, status)
                     VALUES ($1, $2, $3, $4, 'scheduled')`,
                    [req.user.id, doctorId, date, time]
                );

                res.redirect("/user_video_dashboard");

            } catch (err) {
                logger.error("Appointment booking error:", err);
                res.status(500).send("Internal Server Error");
            }
        }
    );

    // User Appointments (API)
    app.get(
        "/api/appointments/user",
        authenticate,
        authorize("user"),
        async (req, res) => {
            try {
                const result = await db.query(
                    `SELECT a.*, 
                        COALESCE(dp.full_name, 'Doctor') AS doctor_name,
                        dp.specialization
                 FROM appointments a
                 LEFT JOIN doc_profile dp ON dp.doc_id = a.doctor_id
                 WHERE a.user_id = $1
                   AND a.status != 'completed'
                 ORDER BY a.appointment_date, a.appointment_time
                 LIMIT 1`,
                    [req.user.id]
                );

                console.log("API - User appointments:", result.rows);
                res.json(result.rows);
            } catch (err) {
                console.error("Fetch user appointments error:", err);
                res.status(500).json({
                    error: "Failed to load appointments",
                    details: process.env.NODE_ENV === 'development' ? err.message : undefined
                });
            }
        }
    )

    // Start Appointment (Doctor)
    app.post(
        "/appointments/:id/start",
        authenticate,
        authorize("doctor"),
        async (req, res) => {
            const { id } = req.params;
            const roomId = crypto.randomUUID();

            try {
                const result = await db.query(
                    `UPDATE appointments
                     SET status = 'started', room_id = $1
                     WHERE id = $2
                       AND doctor_id = $3
                       AND status = 'scheduled'
                     RETURNING room_id`,
                    [roomId, id, req.user.id]
                );

                if (!result.rowCount) {
                    return res.status(400).json({
                        error: "Call already started or completed"
                    });
                }

                res.json({ roomId: result.rows[0].room_id });
            } catch (err) {
                logger.error("Start appointment error:", err);
                res.status(500).json({ error: "Failed to start appointment" });
            }
        }
    );

    // Doctor Appointments (API)
    app.get(
        "/api/appointments/doctor",
        authenticate,
        authorize("doctor"),
        async (req, res) => {
            try {
                const result = await db.query(
                    `SELECT a.id, a.appointment_date, a.appointment_time,
                        a.status, a.room_id, 
                        COALESCE(up.full_name, 'Patient') AS user_name
                 FROM appointments a
                 LEFT JOIN user_profile up ON up.user_id = a.user_id
                 WHERE a.doctor_id = $1
                   AND a.status IN ('scheduled','started')
                 ORDER BY a.appointment_date, a.appointment_time
                 LIMIT 1`,
                    [req.user.id]
                );

                console.log("API - Doctor appointments:", result.rows);
                res.json(result.rows);
            } catch (err) {
                console.error("Fetch doctor appointments error:", err);
                res.status(500).json({
                    error: "Failed to load appointment",
                    details: process.env.NODE_ENV === 'development' ? err.message : undefined
                });
            }
        }
    );

    // Fetch Doctors (User Form)
    app.get(
        "/api/doctors",
        authenticate,
        authorize("user"),
        async (req, res) => {
            try {
                const result = await db.query(
                    `SELECT d.docid AS id, p.full_name, p.specialization
                     FROM doc_login d
                     JOIN doc_profile p ON p.doc_id = d.docid
                     ORDER BY p.full_name`
                );
                res.json(result.rows);
            } catch (err) {
                logger.error("Fetch doctors error:", err);
                res.status(500).json({ error: "Failed to load doctors" });
            }
        }
    );

    // Complete Appointment (Doctor)
    app.post(
        "/appointments/:id/complete",
        authenticate,
        authorize("doctor"),
        async (req, res) => {
            try {
                await db.query(
                    `UPDATE appointments
                     SET status = 'completed'
                     WHERE id = $1 AND doctor_id = $2`,
                    [req.params.id, req.user.id]
                );
                res.sendStatus(200);
            } catch (err) {
                logger.error("Complete appointment error:", err);
                res.status(500).json({ error: "Failed to complete appointment" });
            }
        }
    );
}

// Auth Routes
// Auth Routes
function authRoutes(app) {
    // User Signup
    app.post("/user_signup", async (req, res) => {
        const { phone, password, confirmpassword } = req.body;
        console.log("DEBUG: User signup attempt:", { phone });

        if (!password || password.length < 6)
            return res.send(`<script>alert('Password must be at least 6 characters.');location='/user_signup'</script>`);

        if (password !== confirmpassword)
            return res.send(`<script>alert('Passwords must match.');location='/user_signup'</script>`);

        try {
            const exists = await db.query(
                "SELECT id FROM login WHERE phone=$1",
                [phone]
            );
            if (exists.rows.length)
                return res.send(`<script>alert('Account already exists');location='/user_signup'</script>`);

            const hash = bcrypt.hashSync(password, bcrypt.genSaltSync(10));
            const result = await db.query(
                "INSERT INTO login (phone,password) VALUES ($1,$2) RETURNING id",
                [phone, hash]
            );

            const token = jwt.sign(
                { id: result.rows[0].id, phone, role: "user" },
                JWT_SECRET,
                { expiresIn: JWT_EXPIRES_IN }
            );

            console.log("DEBUG: Setting cookie for user signup");
            res.cookie("token", token, cookieOptions);

            // Test cookie is set
            res.setHeader('Cache-Control', 'no-cache, no-store');
            res.redirect("/user_profile");

        } catch (err) {
            console.error("User signup error:", err);
            res.status(500).send("Internal Server Error");
        }
    });

    // User Login
    app.post("/user_login", async (req, res) => {
        const { phone, password } = req.body;
        console.log("DEBUG: User login attempt:", { phone });

        try {
            const result = await db.query(
                "SELECT * FROM login WHERE phone=$1",
                [phone]
            );

            if (!result.rows.length)
                return res.send(`<script>alert('Account not found');location='/user_login'</script>`);

            if (!bcrypt.compareSync(password, result.rows[0].password))
                return res.send(`<script>alert('Incorrect password');location='/user_login'</script>`);

            const token = jwt.sign(
                { id: result.rows[0].id, phone, role: "user" },
                JWT_SECRET,
                { expiresIn: JWT_EXPIRES_IN }
            );

            console.log("DEBUG: Setting cookie for user login");
            res.cookie("token", token, cookieOptions);

            // Test: Add a meta refresh as fallback
            res.send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <meta http-equiv="refresh" content="0;url=/user_home">
                </head>
                <body>
                    <script>
                        console.log('Cookie set:', document.cookie);
                        window.location.href = '/user_home';
                    </script>
                </body>
                </html>
            `);

        } catch (err) {
            console.error("User login error:", err);
            res.status(500).send("Internal Server Error");
        }
    });

    // Doctor Login
    app.post("/doc_login", async (req, res) => {
        const { phone, password } = req.body;
        console.log("DEBUG: Doctor login attempt:", { phone });

        try {
            const result = await db.query(
                "SELECT * FROM doc_login WHERE phone=$1",
                [phone]
            );

            if (!result.rows.length)
                return res.send(`<script>alert('Account not found');location='/doc_login'</script>`);

            if (!bcrypt.compareSync(password, result.rows[0].password))
                return res.send(`<script>alert('Incorrect password');location='/doc_login'</script>`);

            const token = jwt.sign(
                { id: result.rows[0].docid, phone, role: "doctor" },
                JWT_SECRET,
                { expiresIn: JWT_EXPIRES_IN }
            );

            console.log("DEBUG: Setting cookie for doctor login");
            res.cookie("token", token, cookieOptions);

            res.send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <meta http-equiv="refresh" content="0;url=/doc_home">
                </head>
                <body>
                    <script>
                        console.log('Cookie set:', document.cookie);
                        window.location.href = '/doc_home';
                    </script>
                </body>
                </html>
            `);

        } catch (err) {
            console.error("Doctor login error:", err);
            res.status(500).send("Internal Server Error");
        }
    });

    // Logout
    app.get("/logout", (req, res) => {
        console.log("DEBUG: Logging out");
        res.clearCookie("token", cookieOptions);
        res.redirect("/role");
    });
}

// Doctor Video Routes
function docVideoRoutes(app) {
    // Start Video Call (Doctor)
    app.post(
        "/doc/start-call/:appointmentId",
        authenticate,
        authorize("doctor"),
        async (req, res) => {
            try {
                const roomId = crypto.randomUUID();

                await db.query(
                    `UPDATE appointments
                     SET room_id = $1, status = 'started'
                     WHERE id = $2 AND doctor_id = $3`,
                    [roomId, req.params.appointmentId, req.user.id]
                );

                res.redirect(`/doc_video/${roomId}`);
            } catch (err) {
                logger.error("Start call error:", err);
                res.status(500).send("Failed to start call");
            }
        }
    );
}

// Notes Routes
function notesRoutes(app) {
    app.post(
        "/api/notes/save",
        authenticate,
        authorize("doctor"),
        async (req, res) => {
            const { roomId, notes } = req.body;

            if (!roomId) {
                return res.status(400).json({ error: "roomId required" });
            }

            try {
                await db.query(
                    `INSERT INTO doctor_notes (room_id, doctor_id, notes)
                     VALUES ($1, $2, $3)
                     ON CONFLICT (room_id)
                     DO UPDATE SET notes = EXCLUDED.notes`,
                    [roomId, req.user.id, notes || ""]
                );
                res.sendStatus(200);
            } catch (err) {
                logger.error("Save notes error:", err);
                res.status(500).json({ error: "Failed to save notes" });
            }
        }
    );
}

// Profile Routes
function profileRoutes(app) {
    // User Profile (Fetch/Router)
    app.get(
        "/user_profile",
        authenticate,
        authorize("user"),
        async (req, res) => {
            try {
                const result = await db.query(
                    `SELECT full_name, gender, custom_gender, date_of_birth,
                            weight_kg, height_cm, blood_group, allergies
                     FROM user_profile
                     WHERE user_id = $1`,
                    [req.user.id]
                );

                // Profile NOT created → show CREATE page
                if (!result.rows.length) {
                    return res.redirect("/user_profile_create");
                }

                // Profile exists → render VIEW
                const r = result.rows[0];
                res.render("user_profile", {
                    profile: {
                        fullName: r.full_name,
                        gender: r.gender,
                        customGender: r.custom_gender,
                        dob: r.date_of_birth,
                        weight: r.weight_kg,
                        height: r.height_cm,
                        bloodGroup: r.blood_group,
                        allergies: r.allergies
                    }
                });
            } catch (err) {
                logger.error("User profile fetch error:", err);
                res.status(500).send("Internal Server Error");
            }
        }
    );

    // User Profile (Create/Update)
    app.post(
        "/user_profile",
        authenticate,
        authorize("user"),
        async (req, res) => {
            try {
                const {
                    fullName,
                    gender,
                    customGender,
                    dob,
                    weight,
                    height,
                    bloodGroup,
                    allergies
                } = req.body;

                if (!fullName || !gender || !dob || !weight || !height || !bloodGroup) {
                    return res.send(`
                        <script>
                            alert("Please fill all required fields");
                            history.back();
                        </script>
                    `);
                }

                await db.query(
                    `INSERT INTO user_profile
                     (user_id, full_name, gender, custom_gender, date_of_birth,
                      weight_kg, height_cm, blood_group, allergies)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
                     ON CONFLICT (user_id)
                     DO UPDATE SET
                         full_name = EXCLUDED.full_name,
                         gender = EXCLUDED.gender,
                         custom_gender = EXCLUDED.custom_gender,
                         date_of_birth = EXCLUDED.date_of_birth,
                         weight_kg = EXCLUDED.weight_kg,
                         height_cm = EXCLUDED.height_cm,
                         blood_group = EXCLUDED.blood_group,
                         allergies = EXCLUDED.allergies`,
                    [
                        req.user.id,
                        fullName,
                        gender,
                        customGender || null,
                        dob,
                        weight,
                        height,
                        bloodGroup,
                        allergies || null
                    ]
                );

                res.redirect("/user_home");
            } catch (err) {
                logger.error("User profile save error:", err);
                res.status(500).send("Internal Server Error");
            }
        }
    );

    // Doctor Profile (Fetch/Router)
    app.get(
        "/doc_profile",
        authenticate,
        authorize("doctor"),
        async (req, res) => {
            try {
                const result = await db.query(
                    `SELECT full_name, specialization, experience_years,
                            qualification, hospital_name, bio
                     FROM doc_profile
                     WHERE doc_id = $1`,
                    [req.user.id]
                );

                // No profile → CREATE page
                if (!result.rows.length) {
                    return res.redirect("/doc_profile_create");
                }

                // Profile exists → VIEW
                const r = result.rows[0];
                res.render("doc_profile", {
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
                logger.error("Doctor profile fetch error:", err);
                res.status(500).send("Internal Server Error");
            }
        }
    );

    // Doctor Profile (Create/Update)
    app.post(
        "/doc_profile",
        authenticate,
        authorize("doctor"),
        async (req, res) => {
            try {
                const {
                    fullName,
                    specialization,
                    experience,
                    qualification,
                    hospital,
                    bio
                } = req.body;

                if (!fullName || !specialization || !experience) {
                    return res.send(`
                        <script>
                            alert("Please fill all required fields");
                            history.back();
                        </script>
                    `);
                }

                await db.query(
                    `INSERT INTO doc_profile
                     (doc_id, full_name, specialization, experience_years,
                      qualification, hospital_name, bio)
                     VALUES ($1,$2,$3,$4,$5,$6,$7)
                     ON CONFLICT (doc_id)
                     DO UPDATE SET
                         full_name = EXCLUDED.full_name,
                         specialization = EXCLUDED.specialization,
                         experience_years = EXCLUDED.experience_years,
                         qualification = EXCLUDED.qualification,
                         hospital_name = EXCLUDED.hospital_name,
                         bio = EXCLUDED.bio`,
                    [
                        req.user.id,
                        fullName,
                        specialization,
                        experience,
                        qualification || null,
                        hospital || null,
                        bio || null
                    ]
                );

                res.redirect("/doc_home");
            } catch (err) {
                logger.error("Doctor profile save error:", err);
                res.status(500).send("Internal Server Error");
            }
        }
    );
}

// Protected Routes
function protectedRoutes(app, PROJECT_ROOT) {
    // User Pages
    app.get("/user_home", authenticate, authorize("user"), (req, res) => {
        res.sendFile(path.join(PROJECT_ROOT, "public/pages/user_home.html"));
    });

    app.get("/appointments", authenticate, authorize("user"), (req, res) => {
        res.sendFile(path.join(PROJECT_ROOT, "public/pages/appointments.html"));
    });

    // In protectedRoutes function, CHANGE TO:
    app.get("/user_video_dashboard", authenticate, authorize("user"), (req, res) => {
        res.render("user_video_dashboard");
    });

    app.get("/doc_video_dashboard", authenticate, authorize("doctor"), (req, res) => {
        res.render("doc_video_dashboard");
    });

    app.get("/user_video/:roomId", authenticate, authorize("user"), (req, res) => {
        res.render("user_video", { roomId: req.params.roomId });
    });

    // Doctor Pages
    app.get("/doc_home", authenticate, authorize("doctor"), (req, res) => {
        res.sendFile(path.join(PROJECT_ROOT, "public/pages/doc_home.html"));
    });



    app.get("/records", authenticate, authorize("user"), (req, res) => {
        res.sendFile(path.join(PROJECT_ROOT, "public/pages/records.html"));
    });

    app.get("/doc_video/:roomId", authenticate, authorize("doctor"), (req, res) => {
        res.render("doc_video", { roomId: req.params.roomId });
    });

    app.get("/doc_profile_create", authenticate, authorize("doctor"), (req, res) => {
        res.sendFile(path.join(PROJECT_ROOT, "public/pages/doc_profile_create.html"));
    });

    app.get("/user_profile_create", authenticate, authorize("user"), (req, res) => {
        res.sendFile(path.join(PROJECT_ROOT, "public/pages/user_profile_create.html"));
    });

    app.get("/api/prescription/download/:appointmentId", authenticate, authorize("user"), async (req, res) => {
        try {
            const result = await db.query(
                `SELECT prescription_pdf
                 FROM doctor_notes dn
                 JOIN appointments a ON a.id = dn.appointment_id
                 WHERE a.id = $1 AND a.user_id = $2 AND dn.sent = TRUE`,
                [req.params.appointmentId, req.user.id]
            );

            if (!result.rows.length) {
                return res.sendStatus(404);
            }

            res.download(result.rows[0].prescription_pdf);
        } catch (err) {
            logger.error("Download prescription error:", err);
            res.status(500).send("Download failed");
        }
    });
}

// Public Routes
function publicRoutes(app, PROJECT_ROOT) {
    // Landing / Role
    app.get("/role", blockAfterLogin, (req, res) => {
        res.sendFile(path.join(PROJECT_ROOT, "public/pages/role.html"));
    });

    // User Auth Pages
    app.get("/user_login", blockAfterLogin, (req, res) => {
        res.sendFile(path.join(PROJECT_ROOT, "public/pages/user_login.html"));
    });

    app.get("/user_signup", blockAfterLogin, (req, res) => {
        res.sendFile(path.join(PROJECT_ROOT, "public/pages/user_signup.html"));
    });

    // Doctor Auth Pages
    app.get("/doc_login", blockAfterLogin, (req, res) => {
        res.sendFile(path.join(PROJECT_ROOT, "public/pages/doc_login.html"));
    });

    app.get("/doc_signup", blockAfterLogin, (req, res) => {
        res.sendFile(path.join(PROJECT_ROOT, "public/pages/doc_signup.html"));
    });

    // Public Marketing Pages
    app.get("/", blockAfterLogin, (req, res) => {
        res.sendFile(path.join(PROJECT_ROOT, "public/pages/index.html"));
    });

    app.get("/services", blockAfterLogin, (req, res) => {
        res.sendFile(path.join(PROJECT_ROOT, "public/pages/services.html"));
    });

    app.get("/contact", blockAfterLogin, (req, res) => {
        res.sendFile(path.join(PROJECT_ROOT, "public/pages/contact.html"));
    });
}

// User Video Routes
function userVideoRoutes(app) {
    // Join Video Call (User)
    app.get(
        "/user/join-call/:appointmentId",
        authenticate,
        authorize("user"),
        async (req, res) => {
            try {
                const result = await db.query(
                    `SELECT room_id
                     FROM appointments
                     WHERE id = $1
                       AND user_id = $2
                       AND status = 'started'`,
                    [req.params.appointmentId, req.user.id]
                );

                if (!result.rows.length) {
                    return res.send("Doctor has not started the call yet");
                }

                res.redirect(`/user_video/${result.rows[0].room_id}`);
            } catch (err) {
                logger.error("Join call error:", err);
                res.status(500).send("Unable to join call");
            }
        }
    );
}

// Vault Routes (with Supabase storage)
function vaultRoutes(app) {
    // User: upload record
    app.post(
        "/vault/upload",
        authenticate,
        authorize("user"),
        upload.single("file"),
        async (req, res) => {
            if (!req.file) return res.status(400).send("No file uploaded");

            try {
                const fileName = `${Date.now()}-${req.file.originalname}`;
                const filePath = `user_${req.user.id}/${fileName}`;

                // UPLOAD TO CORRECT BUCKET - CHANGE 'medical-records' TO 'uploads'
                const { data, error } = await supabase.storage
                    .from('uploads')  // ← CHANGE THIS LINE
                    .upload(filePath, req.file.buffer, {
                        contentType: req.file.mimetype,
                        upsert: false
                    });

                if (error) {
                    console.error("Supabase upload error:", error);
                    return res.status(500).send(`Upload failed: ${error.message}`);
                }

                // Get public URL - USE SAME BUCKET NAME
                const { data: urlData } = supabase.storage
                    .from('uploads')  // ← CHANGE THIS LINE TOO
                    .getPublicUrl(filePath);

                await db.query(
                    `INSERT INTO medical_records
                     (user_id, file_name, file_path, record_type)
                     VALUES ($1, $2, $3, $4)`,
                    [
                        req.user.id,
                        req.file.originalname,
                        urlData.publicUrl,
                        req.body.recordType || "general"
                    ]
                );

                res.redirect("/records");
            } catch (err) {
                console.error("Vault upload error:", err);
                res.status(500).send("Upload failed");
            }
        }
    );

    // User: list own records
    app.get(
        "/api/vault/user",
        authenticate,
        authorize("user"),
        async (req, res) => {
            try {
                const result = await db.query(
                    `SELECT id, file_name, record_type, uploaded_at
                     FROM medical_records
                     WHERE user_id = $1
                     ORDER BY uploaded_at DESC`,
                    [req.user.id]
                );
                res.json(result.rows);
            } catch (err) {
                logger.error("List user vault error:", err);
                res.status(500).json({ error: "Failed to load records" });
            }
        }
    );

    // Doctor: list user records (BY APPOINTMENT)
    app.get(
        "/api/vault/doctor/:appointmentId",
        authenticate,
        authorize("doctor"),
        async (req, res) => {
            const { appointmentId } = req.params;

            try {
                const appt = await db.query(
                    `SELECT user_id
                     FROM appointments
                     WHERE id = $1
                       AND doctor_id = $2
                       AND records_allowed = true
                       AND status IN ('started','completed')`,
                    [appointmentId, req.user.id]
                );

                if (!appt.rows.length) {
                    return res.sendStatus(403);
                }

                const records = await db.query(
                    `SELECT id, file_name, record_type, uploaded_at
                     FROM medical_records
                     WHERE user_id = $1
                     ORDER BY uploaded_at DESC`,
                    [appt.rows[0].user_id]
                );

                res.json(records.rows);
            } catch (err) {
                logger.error("List doctor vault error:", err);
                res.status(500).json({ error: "Failed to load records" });
            }
        }
    );

    // Download (user or doctor)
    app.get(
        "/vault/file/:id",
        authenticate,
        async (req, res) => {
            try {
                // user owns
                const userFile = await db.query(
                    `SELECT file_path
                     FROM medical_records
                     WHERE id = $1 AND user_id = $2`,
                    [req.params.id, req.user.id]
                );

                if (userFile.rows.length) {
                    // If it's a Supabase URL, redirect to it
                    if (userFile.rows[0].file_path.startsWith('http')) {
                        return res.redirect(userFile.rows[0].file_path);
                    }
                    // If it's a local path (legacy)
                    return res.sendFile(path.resolve(userFile.rows[0].file_path));
                }

                // doctor via appointment permission
                if (req.user.role === "doctor") {
                    const docFile = await db.query(
                        `SELECT mr.file_path
                         FROM medical_records mr
                         JOIN appointments a ON a.user_id = mr.user_id
                         WHERE mr.id = $1
                           AND a.doctor_id = $2
                           AND a.records_allowed = true`,
                        [req.params.id, req.user.id]
                    );

                    if (docFile.rows.length) {
                        if (docFile.rows[0].file_path.startsWith('http')) {
                            return res.redirect(docFile.rows[0].file_path);
                        }
                        return res.sendFile(path.resolve(docFile.rows[0].file_path));
                    }
                }

                res.sendStatus(403);
            } catch (err) {
                logger.error("Download vault file error:", err);
                res.status(500).send("Download failed");
            }
        }
    );
}

// Video Routes
function videoRoutes(app) {
    app.get(
        "/user_video/:roomId",
        authenticate,
        authorize("user"),
        async (req, res) => {
            try {
                const result = await db.query(
                    `SELECT id
                     FROM appointments
                     WHERE room_id = $1
                       AND user_id = $2
                       AND status = 'started'`,
                    [req.params.roomId, req.user.id]
                );

                if (!result.rows.length) {
                    return res.send("Invalid or expired video session");
                }

                res.render("user_video", {
                    roomId: req.params.roomId,
                    appointmentId: result.rows[0].id
                });
            } catch (err) {
                logger.error("User video route error:", err);
                res.status(500).send("Internal Server Error");
            }
        }
    );

    app.get(
        "/doc_video/:roomId",
        authenticate,
        authorize("doctor"),
        async (req, res) => {
            const { roomId } = req.params;

            try {
                const result = await db.query(
                    `SELECT id
                     FROM appointments
                     WHERE room_id = $1
                       AND doctor_id = $2
                     LIMIT 1`,
                    [roomId, req.user.id]
                );

                if (!result.rows.length) {
                    return res.status(404).send("Appointment not found");
                }

                res.render("doc_video", {
                    roomId,
                    appointment: { id: result.rows[0].id }
                });
            } catch (err) {
                logger.error("Doctor video route error:", err);
                res.status(500).send("Internal Server Error");
            }
        }
    );
}

// Video Dashboard Routes
// Video Dashboard Routes
function videoDashboardRoutes(app) {
    // Doctor Video Dashboard
    app.get(
        "/doc_video_dashboard",
        authenticate,
        authorize("doctor"),
        async (req, res) => {
            try {
                const result = await db.query(
                    `SELECT a.id, a.appointment_time, a.status, 
                            a.appointment_date, a.room_id,
                            up.full_name AS user_name
                     FROM appointments a
                     LEFT JOIN user_profile up ON up.user_id = a.user_id
                     WHERE a.doctor_id = $1
                       AND a.status IN ('scheduled','started')
                     ORDER BY a.appointment_date, a.appointment_time
                     LIMIT 1`,
                    [req.user.id]
                );

                // Debug log
                console.log("Doctor dashboard query result:", result.rows);

                // Check if we got data
                if (!result.rows.length) {
                    console.log("No appointments found for doctor:", req.user.id);
                    return res.render("doc_video_dashboard", {
                        appointment: null,
                        message: "No upcoming appointments"
                    });
                }

                res.render("doc_video_dashboard", {
                    appointment: result.rows[0]
                });
            } catch (err) {
                console.error("Doctor video dashboard error:", err);
                // Send a proper error page or JSON
                res.status(500).json({
                    error: "Internal Server Error",
                    details: process.env.NODE_ENV === 'development' ? err.message : undefined
                });
            }
        }
    );
    app.post(
        "/appointments/:id/start",
        authenticate,
        authorize("doctor"),
        async (req, res) => {
            const roomId = crypto.randomUUID();

            const result = await db.query(
                `
        UPDATE appointments
        SET status = 'started',
            room_id = $1
        WHERE id = $2
          AND doctor_id = $3
          AND status = 'scheduled'
        RETURNING room_id
        `,
                [roomId, req.params.id, req.user.id]
            );

            if (!result.rowCount) {
                return res.status(400).json({
                    error: "Call already started or completed"
                });
            }

            res.json({ roomId });
        }
    );

    /* =====================================
       END CALL (doctor)
    ===================================== */
    app.post(
        "/appointments/:id/complete",
        authenticate,
        authorize("doctor"),
        async (req, res) => {
            await db.query(
                `
        UPDATE appointments
        SET status = 'completed'
        WHERE id = $1
          AND doctor_id = $2
        `,
                [req.params.id, req.user.id]
            );

            res.sendStatus(200);
        }
    );
    // User Video Dashboard
    app.get(
        "/user_video_dashboard",
        authenticate,
        authorize("user"),
        async (req, res) => {
            try {
                const result = await db.query(
                    `SELECT a.id, a.appointment_time, a.status,
                            a.appointment_date, a.room_id,
                            dp.full_name AS doctor_name
                     FROM appointments a
                     LEFT JOIN doc_profile dp ON dp.doc_id = a.doctor_id
                     WHERE a.user_id = $1
                       AND a.status IN ('scheduled','started')
                     ORDER BY a.appointment_date, a.appointment_time
                     LIMIT 1`,
                    [req.user.id]
                );

                console.log("User dashboard query result:", result.rows);

                if (!result.rows.length) {
                    console.log("No appointments found for user:", req.user.id);
                    return res.render("user_video_dashboard", {
                        appointment: null,
                        message: "No active appointments"
                    });
                }

                res.render("user_video_dashboard", {
                    appointment: result.rows[0]
                });
            } catch (err) {
                console.error("User video dashboard error:", err);
                res.status(500).json({
                    error: "Internal Server Error",
                    details: process.env.NODE_ENV === 'development' ? err.message : undefined
                });
            }
        }
    );
}

// Video Socket Function
function videoSocket(io) {
    io.on("connection", socket => {
        logger.info(`Socket connected: ${socket.id}`);

        socket.on("join-room", ({ roomId, role }) => {
            socket.join(roomId);
            socket.roomId = roomId;
            logger.info(`Socket ${socket.id} (${role}) joined room ${roomId}`);

            if (role === "user") {
                socket.to(roomId).emit("user-ready");
            }
        });

        socket.on("signal", ({ roomId, payload }) => {
            socket.to(roomId).emit("signal", payload);
        });

        socket.on("call-ended", ({ roomId }) => {
            logger.info(`Call ended in room ${roomId}`);
            io.to(roomId).emit("call-ended", { roomId });
            io.in(roomId).socketsLeave(roomId);
        });

        socket.on("disconnect", () => {
            logger.info(`Socket disconnected: ${socket.id}`);
        });
    });
}

// Prescription PDF Routes
function prescriptionRoutes(app) {
    app.get("/api/prescription/download/:roomId",
        authenticate,
        async (req, res) => {
            try {
                const { roomId } = req.params;

                const result = await db.query(
                    `SELECT dn.notes
                     FROM doctor_notes dn
                     WHERE dn.room_id = $1`,
                    [roomId]
                );

                if (!result.rows.length) {
                    return res.status(404).send("Prescription not found");
                }

                const notes = result.rows[0].notes || "No notes provided";

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
                doc.text("Doctor Notes:");
                doc.moveDown();
                doc.fontSize(11).text(notes);

                doc.end();
            } catch (err) {
                logger.error("PDF generation error:", err);
                res.status(500).send("Failed to generate prescription");
            }
        }
    );
}

// ==============================================
// REGISTER ALL ROUTES
// ==============================================
publicRoutes(app, PROJECT_ROOT);
authRoutes(app);
profileRoutes(app);
aiRoutes(app);
appointmentRoutes(app);
docVideoRoutes(app);
notesRoutes(app);
videoRoutes(app);
videoDashboardRoutes(app);
userVideoRoutes(app);
vaultRoutes(app);
prescriptionRoutes(app);
protectedRoutes(app, PROJECT_ROOT);
videoDashboardRoutes(app);
// ==============================================
// HEALTH CHECK ENDPOINT
// ==============================================

// Add this to test Supabase connection
app.get("/test-supabase", authenticate, async (req, res) => {
    try {
        // Test bucket access
        const { data: buckets, error: bucketsError } = await supabase.storage
            .listBuckets();

        console.log("Available buckets:", buckets);

        // Test upload to 'uploads' bucket
        const testFile = Buffer.from("test content");
        const testPath = `test_${req.user.id}/test.txt`;

        const { data, error } = await supabase.storage
            .from('uploads')
            .upload(testPath, testFile, {
                contentType: 'text/plain'
            });

        if (error) {
            return res.json({
                success: false,
                error: error.message,
                buckets: buckets
            });
        }

        res.json({
            success: true,
            message: "Supabase upload test successful",
            data: data,
            buckets: buckets
        });

    } catch (err) {
        res.json({
            success: false,
            error: err.message
        });
    }
});

// ==============================================
// ERROR HANDLING MIDDLEWARE
// ==============================================
app.use((err, req, res, next) => {
    logger.error("Unhandled error:", err);

    if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: `File upload error: ${err.message}` });
    }

    res.status(500).json({
        error: "Internal Server Error",
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// 404 Handler
app.use((req, res) => {
    res.status(404).sendFile(
        path.join(PROJECT_ROOT, "public/pages/404.html")
    );
});

// ==============================================
// SOCKET.IO INITIALIZATION
// ==============================================
videoSocket(io);

// ==============================================
// SERVER START
// ==============================================
const HOST = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';

server.listen(port, HOST, () => {
    console.log(`✅ Server running on http://${HOST}:${port}`);
    logger.info(`Server started on port ${port}`);
});