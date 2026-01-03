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
console.log("🔧 Supabase Configuration Check:");
console.log("   URL:", process.env.SUPABASE_URL ? "✅ Set" : "❌ Missing");
console.log("   Service Key:", process.env.SUPABASE_SERVICE_KEY ? "✅ Set (first 10 chars): " + process.env.SUPABASE_SERVICE_KEY.substring(0, 10) + "..." : "❌ Missing");
const supabaseService = createClient(
    process.env.SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_KEY || "", // Use service key explicitly
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
);
// Test Supabase connection
async function testSupabaseConnection() {
    try {
        console.log("🔍 Testing Supabase connection...");

        // Test 1: Check if we can list buckets
        const { data: buckets, error: bucketsError } = await supabaseService.storage
            .listBuckets();

        if (bucketsError) {
            console.error("❌ Supabase storage error:", bucketsError.message);
        } else {
            console.log("✅ Supabase storage buckets:", buckets.map(b => b.name));
        }

        // Test 2: Try to create a test bucket if 'uploads' doesn't exist
        const uploadsBucketExists = buckets?.some(b => b.name === 'uploads');

        if (!uploadsBucketExists) {
            console.log("⚠️ 'uploads' bucket not found. Creating...");
            const { data: newBucket, error: createError } = await supabaseService.storage
                .createBucket('uploads', {
                    public: true,
                    fileSizeLimit: 10485760 // 10MB
                });

            if (createError) {
                console.error("❌ Failed to create 'uploads' bucket:", createError.message);
            } else {
                console.log("✅ Created 'uploads' bucket");
            }
        } else {
            console.log("✅ 'uploads' bucket exists");
        }

    } catch (error) {
        console.error("❌ Supabase connection test failed:", error.message);
    }
}

// Run the test
testSupabaseConnection();

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
            ? ['https://telehealth-production.onrender.com']
            : ['http://localhost:3000'],
        credentials: true,
        methods: ['GET', 'POST']
    },
    transports: ['websocket', 'polling']
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

    const token = req.cookies.token;

    if (!token) {
        return res.redirect("/role");
    }

    try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.user = {
            id: payload.id,
            role: payload.role,
            phone: payload.phone
        };
  
        next();
    } catch (err) {

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
    // User Appointments (API)
    app.get(
        "/api/appointments/user",
        authenticate,
        authorize("user"),
        async (req, res) => {
            try {
               

                const result = await db.query(
                    `SELECT a.id, a.appointment_date, a.appointment_time,
                        a.status, a.room_id, 
                        COALESCE(dp.full_name, 'Doctor') AS doctor_name,
                        COALESCE(dp.specialization, 'General') AS specialization
                 FROM appointments a
                 LEFT JOIN doc_profile dp ON dp.doc_id = a.doctor_id
                 WHERE a.user_id = $1
                   AND a.status IN ('scheduled','started')
                 ORDER BY a.appointment_date, a.appointment_time
                 LIMIT 1`,
                    [req.user.id]
                );

               

                // Make sure we return JSON
                res.setHeader('Content-Type', 'application/json');

                if (result.rows.length === 0) {
                    return res.json([]); // Return empty array
                }

                res.json(result.rows);
            } catch (err) {
                
                res.setHeader('Content-Type', 'application/json');
                res.status(500).json({
                    error: "Failed to load appointments",
                    details: process.env.NODE_ENV === 'development' ? err.message : undefined
                });
            }
        }
    );
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

         

                // Make sure we return JSON
                res.setHeader('Content-Type', 'application/json');

                if (result.rows.length === 0) {
                    return res.json([]); // Return empty array
                }

                res.json(result.rows);
            } catch (err) {
                
                res.setHeader('Content-Type', 'application/json');
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

      
            res.cookie("token", token, cookieOptions);

            // Test cookie is set
            res.setHeader('Cache-Control', 'no-cache, no-store');
            res.redirect("/user_profile");

        } catch (err) {
     
            res.status(500).send("Internal Server Error");
        }
    });

    // User Login
    app.post("/user_login", async (req, res) => {
        const { phone, password } = req.body;


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
                     
                        window.location.href = '/user_home';
                    </script>
                </body>
                </html>
            `);

        } catch (err) {
    
            res.status(500).send("Internal Server Error");
        }
    });

    // Doctor Login
    app.post("/doc_login", async (req, res) => {
        const { phone, password } = req.body;
    

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

            res.cookie("token", token, cookieOptions);
 
            res.send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <meta http-equiv="refresh" content="0;url=/doc_home">
                </head>
                <body>
                    <script>
                       
                        window.location.href = '/doc_home';
                    </script>
                </body>
                </html>
            `);

        } catch (err) {
            
            res.status(500).send("Internal Server Error");
        }
    });

    // Logout
    app.get("/logout", (req, res) => {
     
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
// Vault Routes (with Supabase storage) - UPDATED
function vaultRoutes(app) {
    // User: upload record - FIXED
    app.post(
        "/vault/upload",
        authenticate,
        authorize("user"),
        upload.single("file"),
        async (req, res) => {
            if (!req.file) return res.status(400).send("No file uploaded");

            try {
                console.log("📤 Upload attempt for user:", req.user.id);
                console.log("📄 File details:", {
                    originalname: req.file.originalname,
                    mimetype: req.file.mimetype,
                    size: req.file.size
                });

                const fileName = `${Date.now()}-${req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
                const filePath = `user_${req.user.id}/${fileName}`;

                console.log("📍 File path for storage:", filePath);

                // 1. Upload to Supabase Storage - FIXED METHOD
                const { data: uploadData, error: uploadError } = await supabaseService.storage
                    .from('uploads')
                    .upload(filePath, req.file.buffer, {
                        contentType: req.file.mimetype,
                        upsert: false,
                        cacheControl: '3600'
                    });

                if (uploadError) {
                    console.error("❌ Storage upload error:", uploadError);
                    return res.status(500).send(`
                        <h3>Storage Upload Error</h3>
                        <p>${uploadError.message}</p>
                        <a href="/records">Back to Records</a>
                    `);
                }

                console.log("✅ File uploaded to storage:", uploadData);

                // 2. Get public URL - FIXED METHOD
                const { data: urlData } = supabaseService.storage
                    .from('uploads')
                    .getPublicUrl(filePath);

                console.log("🔗 Public URL generated:", urlData.publicUrl);

                // 3. Insert into database using PostgreSQL directly
                try {
                    const dbResult = await db.query(
                        `INSERT INTO medical_records 
                         (user_id, file_name, file_path, record_type, uploaded_at)
                         VALUES ($1, $2, $3, $4, $5)
                         RETURNING id`,
                        [
                            req.user.id,
                            req.file.originalname,
                            urlData.publicUrl,
                            req.body.recordType || "general",
                            new Date().toISOString()
                        ]
                    );

                    console.log("💾 Database record created with ID:", dbResult.rows[0].id);

                    res.redirect("/records");

                } catch (dbError) {
                    console.error("❌ Database insert error:", dbError);

                    // Try to delete the uploaded file since DB insert failed
                    try {
                        await supabaseService.storage
                            .from('uploads')
                            .remove([filePath]);
                        console.log("🗑️ Removed orphaned file from storage");
                    } catch (cleanupError) {
                        console.error("⚠️ Failed to cleanup storage file:", cleanupError);
                    }

                    return res.status(500).send(`
                        <h3>Database Error</h3>
                        <p>File uploaded but failed to save record in database.</p>
                        <p>Error: ${dbError.message}</p>
                        <a href="/records">Back to Records</a>
                    `);
                }

            } catch (err) {
                console.error("❌ Vault upload error:", err);
                res.status(500).send(`
                    <h3>Server Error</h3>
                    <p>${err.message}</p>
                    <p>Please try again or contact support.</p>
                    <a href="/records">Back to Records</a>
                `);
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
                    `SELECT id, file_name, record_type, uploaded_at, file_path
                     FROM medical_records
                     WHERE user_id = $1
                     ORDER BY uploaded_at DESC`,
                    [req.user.id]
                );

                // Check if files still exist in storage
                const recordsWithStatus = await Promise.all(
                    result.rows.map(async (record) => {
                        if (record.file_path && record.file_path.includes('supabase')) {
                            try {
                                // Extract file path from URL
                                const url = new URL(record.file_path);
                                const pathParts = url.pathname.split('/');
                                const bucket = pathParts[1];
                                const filePath = pathParts.slice(2).join('/');

                                // Check if file exists
                                const { data: fileExists } = await supabaseService.storage
                                    .from(bucket)
                                    .list(filePath.split('/').slice(0, -1).join('/') || '');

                                const exists = fileExists?.some(file => file.name === filePath.split('/').pop());

                                return {
                                    ...record,
                                    status: exists ? 'available' : 'missing'
                                };
                            } catch (error) {
                                console.error(`Error checking file ${record.id}:`, error);
                                return {
                                    ...record,
                                    status: 'unknown'
                                };
                            }
                        }
                        return {
                            ...record,
                            status: 'available'
                        };
                    })
                );

                res.json(recordsWithStatus);
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
                    `SELECT id, file_name, record_type, uploaded_at, file_path
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
// Video Dashboard Routes - MPA Style
// Video Dashboard Routes - MPA Style
function videoDashboardRoutes(app) {
    /* =====================================
       DOCTOR VIDEO DASHBOARD (MPA)
    ===================================== */
    app.get(
        "/doc_video_dashboard",
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



                // Always pass hasAppointment as boolean
                const hasAppointment = result.rows.length > 0;
                const appointment = hasAppointment ? result.rows[0] : null;



                res.render("doc_video_dashboard", {
                    appointment: appointment,
                    hasAppointment: hasAppointment
                });

            } catch (err) {
               
                res.status(500).send(`
                    <html>
                        <body>
                            <h1>Internal Server Error</h1>
                            <p>${err.message}</p>
                            <a href="/doc_home">Go back to home</a>
                        </body>
                    </html>
                `);
            }
        }
    );

    /* =====================================
       USER VIDEO DASHBOARD (MPA)
    ===================================== */
    app.get(
        "/user_video_dashboard",
        authenticate,
        authorize("user"),
        async (req, res) => {
            try {
                

                const result = await db.query(
                    `SELECT a.id, a.appointment_date, a.appointment_time,
                            a.status, a.room_id,
                            COALESCE(dp.full_name, 'Doctor') AS doctor_name,
                            COALESCE(dp.specialization, 'General') AS specialization
                     FROM appointments a
                     LEFT JOIN doc_profile dp ON dp.doc_id = a.doctor_id
                     WHERE a.user_id = $1
                       AND a.status IN ('scheduled','started')
                     ORDER BY a.appointment_date, a.appointment_time
                     LIMIT 1`,
                    [req.user.id]
                );



                // Always pass hasAppointment as boolean
                const hasAppointment = result.rows.length > 0;
                const appointment = hasAppointment ? result.rows[0] : null;


                res.render("user_video_dashboard", {
                    appointment: appointment,
                    hasAppointment: hasAppointment
                });

            } catch (err) {
               
                res.status(500).send(`
                    <html>
                        <body>
                            <h1>Internal Server Error</h1>
                            <p>${err.message}</p>
                            <a href="/user_home">Go back to home</a>
                        </body>
                    </html>
                `);
            }
        }
    );
}

// Video Socket Function
// Video Socket Function - UPDATED
// Video Socket Function - UPDATED
function videoSocket(io) {
    io.on("connection", socket => {
        console.log(`Socket connected: ${socket.id}`);

        socket.on("join-room", ({ roomId, role }) => {
            socket.join(roomId);
            socket.roomId = roomId;
            socket.role = role;
            console.log(`Socket ${socket.id} (${role}) joined room ${roomId}`);

            // Notify the other participant
            if (role === "user") {
                socket.to(roomId).emit("user-ready");
            }
        });

        socket.on("signal", ({ roomId, ...payload }) => {
            console.log(`Signal from ${socket.id} in room ${roomId}:`, payload);
            socket.to(roomId).emit("signal", payload);
        });

        // Add this new event handler for when doctor ends call
        socket.on("doctor-end-call", async ({ roomId, appointmentId, notes }) => {
            console.log(`Doctor ending call in room ${roomId}`);

            try {
                // Check if appointment exists and is valid
                const appointmentCheck = await db.query(
                    `SELECT id, user_id, doctor_id, status 
             FROM appointments 
             WHERE room_id = $1 AND id = $2`,
                    [roomId, appointmentId]
                );

                if (appointmentCheck.rows.length === 0) {
                  
                    socket.emit('prescription-error', { message: 'Invalid appointment' });
                    return;
                }

               

                // Save the prescription to database
                if (notes && notes.trim()) {
                    const saveResult = await db.query(
                        `INSERT INTO doctor_notes (room_id, appointment_id, notes, sent, created_at)
                 VALUES ($1, $2, $3, TRUE, NOW())
                 ON CONFLICT (room_id) 
                 DO UPDATE SET 
                    notes = EXCLUDED.notes, 
                    sent = TRUE, 
                    created_at = NOW()
                 RETURNING id`,
                        [roomId, appointmentId, notes]
                    );

                   
                } else {
                    // Save empty notes if doctor didn't write anything
                    await db.query(
                        `INSERT INTO doctor_notes (room_id, appointment_id, notes, sent, created_at)
                 VALUES ($1, $2, $3, TRUE, NOW())
                 ON CONFLICT (room_id) 
                 DO UPDATE SET 
                    notes = EXCLUDED.notes, 
                    sent = TRUE, 
                    created_at = NOW()`,
                        [roomId, appointmentId, "No prescription notes provided."]
                    );
                 
                }

                // Update appointment status to completed
                await db.query(
                    `UPDATE appointments 
             SET status = 'completed', completed_at = NOW()
             WHERE room_id = $1 AND id = $2`,
                    [roomId, appointmentId]
                );

               

                // Notify user that prescription is ready and call is ending
                setTimeout(() => {
                    socket.to(roomId).emit("call-ended-with-prescription", {
                        roomId,
                        message: "Doctor ended the consultation. Prescription is ready."
                    });
               
                }, 500);

            } catch (error) {
                
                // Notify doctor about the error
                socket.emit('prescription-error', {
                    message: 'Failed to save prescription',
                    error: error.message
                });

                // Still notify user that call ended (without prescription)
                socket.to(roomId).emit("call-ended", {
                    roomId,
                    message: "Consultation ended. Prescription may not be available."
                });
            }
        });

        socket.on("disconnect", () => {
            console.log(`Socket disconnected: ${socket.id}`);
        });
    });
}
// Prescription PDF Routes
// Prescription PDF Routes - ENSURE THIS EXISTS
// Prescription PDF Routes - UPDATED
function prescriptionRoutes(app) {
    app.get("/api/prescription/download/:roomId",
        authenticate,
        async (req, res) => {
            try {
                const { roomId } = req.params;



                // First, let's check if the user has access to this room
                let appointmentQuery;
                if (req.user.role === "user") {
                    appointmentQuery = await db.query(
                        `SELECT a.id, a.user_id, a.doctor_id, a.appointment_date,
                                dp.full_name as doctor_name,
                                dp.specialization,
                                dp.qualification,
                                dp.hospital_name
                         FROM appointments a
                         LEFT JOIN doc_profile dp ON dp.doc_id = a.doctor_id
                         WHERE a.room_id = $1 AND a.user_id = $2`,
                        [roomId, req.user.id]
                    );
                } else if (req.user.role === "doctor") {
                    appointmentQuery = await db.query(
                        `SELECT a.id, a.user_id, a.doctor_id, a.appointment_date,
                                dp.full_name as doctor_name,
                                dp.specialization,
                                dp.qualification,
                                dp.hospital_name
                         FROM appointments a
                         LEFT JOIN doc_profile dp ON dp.doc_id = a.doctor_id
                         WHERE a.room_id = $1 AND a.doctor_id = $2`,
                        [roomId, req.user.id]
                    );
                }

      

                if (!appointmentQuery.rows.length) {
                  
                    return res.status(404).send(`
                        <h2>Prescription Not Found</h2>
                        <p>No appointment found for this consultation.</p>
                        <p>Room ID: ${roomId}</p>
                        <p>User ID: ${req.user.id}</p>
                        <a href="/user_video_dashboard">Return to Dashboard</a>
                    `);
                }

                const appointment = appointmentQuery.rows[0];

                // Get prescription notes from doctor_notes table
                const notesQuery = await db.query(
                    `SELECT notes, created_at
                     FROM doctor_notes
                     WHERE room_id = $1
                     ORDER BY created_at DESC
                     LIMIT 1`,
                    [roomId]
                );

    

                let notes = "No prescription notes provided by the doctor.";
                let prescriptionDate = new Date();

                if (notesQuery.rows.length > 0) {
                    notes = notesQuery.rows[0].notes || notes;
                    prescriptionDate = notesQuery.rows[0].created_at || prescriptionDate;
                }

                // Get patient information if available
                let patientName = "Patient";
                let patientInfo = "";

                if (req.user.role === "doctor") {
                    const patientQuery = await db.query(
                        `SELECT full_name, date_of_birth, gender, blood_group
                         FROM user_profile
                         WHERE user_id = $1`,
                        [appointment.user_id]
                    );

                    if (patientQuery.rows.length > 0) {
                        const patient = patientQuery.rows[0];
                        patientName = patient.full_name || "Patient";
                        patientInfo = `Patient: ${patientName}`;
                        if (patient.date_of_birth) {
                            const dob = new Date(patient.date_of_birth);
                            const age = new Date().getFullYear() - dob.getFullYear();
                            patientInfo += ` | Age: ${age} years`;
                        }
                        if (patient.gender) {
                            patientInfo += ` | Gender: ${patient.gender}`;
                        }
                        if (patient.blood_group) {
                            patientInfo += ` | Blood Group: ${patient.blood_group}`;
                        }
                    }
                } else {
                    // For user, get their own info
                    const patientQuery = await db.query(
                        `SELECT full_name, date_of_birth, gender, blood_group
                         FROM user_profile
                         WHERE user_id = $1`,
                        [req.user.id]
                    );

                    if (patientQuery.rows.length > 0) {
                        const patient = patientQuery.rows[0];
                        patientName = patient.full_name || "Patient";
                        patientInfo = `Patient: ${patientName}`;
                        if (patient.date_of_birth) {
                            const dob = new Date(patient.date_of_birth);
                            const age = new Date().getFullYear() - dob.getFullYear();
                            patientInfo += ` | Age: ${age} years`;
                        }
                        if (patient.gender) {
                            patientInfo += ` | Gender: ${patient.gender}`;
                        }
                        if (patient.blood_group) {
                            patientInfo += ` | Blood Group: ${patient.blood_group}`;
                        }
                    }
                }

                // Doctor info
                const doctorName = appointment.doctor_name || "Dr. Unknown";
                const specialization = appointment.specialization || "General Physician";
                const qualification = appointment.qualification || "MD";
                const hospital = appointment.hospital_name || "TeleHealth Clinic";

                // Format dates
                const appointmentDate = appointment.appointment_date
                    ? new Date(appointment.appointment_date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    })
                    : new Date().toLocaleDateString();

                const prescriptionDateStr = new Date(prescriptionDate).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });



                // Set headers for PDF
                res.setHeader("Content-Type", "application/pdf");
                res.setHeader(
                    "Content-Disposition",
                    `attachment; filename="Prescription_${roomId}_${Date.now()}.pdf"`
                );

                // Create PDF
                const doc = new PDFDocument({
                    margin: 50,
                    size: 'A4',
                    info: {
                        Title: 'Medical Prescription',
                        Author: 'TeleHealth System',
                        Subject: 'Medical Consultation Prescription',
                        Keywords: 'prescription, medical, telehealth',
                        CreationDate: new Date()
                    }
                });

                // Pipe to response
                doc.pipe(res);

                try {
                    // Add header with logo
                    doc.fontSize(18).text('TELEHEALTH PRESCRIPTION', {
                        align: 'center',
                        underline: true
                    });
                    doc.moveDown(0.5);
                    doc.fontSize(10).text('Electronic Medical Prescription', { align: 'center' });
                    doc.moveDown(1);

                    // Add line separator
                    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
                    doc.moveDown(1);

                    // Doctor Information Section
                    doc.fontSize(12).fillColor('#333333').text('PRESCRIBING PHYSICIAN:', {
                        underline: true
                    });
                    doc.moveDown(0.3);
                    doc.fontSize(11).fillColor('#000000');
                    doc.text(`Dr. ${doctorName}`, { continued: true });
                    doc.fontSize(9).fillColor('#666666').text(` (${qualification})`, {
                        align: 'left'
                    });
                    doc.fontSize(10);
                    doc.text(`Specialization: ${specialization}`);
                    doc.text(`Hospital/Clinic: ${hospital}`);
                    doc.moveDown(1);

                    // Patient Information Section
                    doc.fontSize(12).fillColor('#333333').text('PATIENT INFORMATION:', {
                        underline: true
                    });
                    doc.moveDown(0.3);
                    doc.fontSize(10);
                    doc.text(patientInfo);
                    doc.moveDown(1);

                    // Consultation Details
                    doc.fontSize(12).fillColor('#333333').text('CONSULTATION DETAILS:', {
                        underline: true
                    });
                    doc.moveDown(0.3);
                    doc.fontSize(10);
                    doc.text(`Appointment Date: ${appointmentDate}`);
                    doc.text(`Prescription Date: ${prescriptionDateStr}`);
                    doc.text(`Consultation ID: ${roomId}`);
                    doc.moveDown(1.5);

                    // Prescription Content
                    doc.fontSize(12).fillColor('#333333').text('MEDICAL PRESCRIPTION:', {
                        underline: true
                    });
                    doc.moveDown(0.5);

                    // Prescription box with border
                    const prescriptionY = doc.y;
                    doc.rect(50, prescriptionY, 500, 200).stroke();
                    doc.moveDown(0.1);

                    // Add prescription content
                    doc.fontSize(11).fillColor('#000000');
                    const lines = notes.split('\n');
                    let lineY = prescriptionY + 20;

                    for (let line of lines) {
                        if (line.trim()) {
                            doc.text(`• ${line.trim()}`, 60, lineY, {
                                width: 480,
                                align: 'left'
                            });
                            lineY += 20;
                        }
                    }

                    doc.y = prescriptionY + 210;
                    doc.moveDown(2);

                    // Doctor's Signature
                    doc.fontSize(10).fillColor('#333333');
                    doc.text('________________________________', 400, doc.y, { align: 'right' });
                    doc.text(`Dr. ${doctorName}`, 400, doc.y + 20, { align: 'right' });
                    doc.text(qualification, 400, doc.y + 35, { align: 'right' });
                    doc.text(specialization, 400, doc.y + 50, { align: 'right' });

                    doc.moveDown(4);

                    // Footer
                    doc.fontSize(8).fillColor('#666666');
                    doc.text('This is an electronically generated prescription from TeleHealth System.', {
                        align: 'center'
                    });
                    doc.text('For any queries, please contact: support@telehealth.com | Phone: 1800-TELEHEALTH', {
                        align: 'center'
                    });
                    doc.text('Prescription ID: ' + roomId + ' | Generated on: ' + new Date().toLocaleString(), {
                        align: 'center'
                    });

                    // End the document
                    doc.end();

                

                } catch (pdfError) {
                
                    // Fallback to simple text response
                    res.setHeader("Content-Type", "text/html");
                    res.send(`
                        <h2>Prescription</h2>
                        <h3>Dr. ${doctorName} (${specialization})</h3>
                        <p><strong>Patient:</strong> ${patientName}</p>
                        <p><strong>Date:</strong> ${prescriptionDateStr}</p>
                        <p><strong>Consultation ID:</strong> ${roomId}</p>
                        <hr>
                        <h4>Prescription Notes:</h4>
                        <pre>${notes}</pre>
                        <hr>
                        <p><em>Digitally signed by Dr. ${doctorName}</em></p>
                        <a href="/user_video_dashboard">Return to Dashboard</a>
                    `);
                }

            } catch (err) {
      

                // Send a user-friendly error message
                res.setHeader("Content-Type", "text/html");
                res.status(500).send(`
                    <h2>Error Generating Prescription</h2>
                    <p>We encountered an error while generating your prescription.</p>
                    <p><strong>Error:</strong> ${err.message}</p>
                    <p><strong>Room ID:</strong> ${req.params.roomId}</p>
                    <p><strong>User ID:</strong> ${req.user.id}</p>
                    <hr>
                    <h3>What to do:</h3>
                    <ol>
                        <li>Return to your dashboard</li>
                        <li>Contact support if the problem persists</li>
                        <li>Your consultation notes are saved in the system</li>
                    </ol>
                    <a href="/user_video_dashboard" style="display:inline-block; padding:10px 20px; background:#007bff; color:white; text-decoration:none; border-radius:5px;">
                        Return to Dashboard
                    </a>
                `);
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

// ==============================================
// HEALTH CHECK ENDPOINT
// ==============================================

// Add this to test Supabase connection
// Add this to your routes for testing
// Add this to your routes (before the error handlers)
app.get("/debug/supabase-test",
    authenticate,
    async (req, res) => {
        try {
            // List buckets
            const { data: buckets, error: bucketsError } = await supabaseService.storage
                .listBuckets();

            // List files in uploads bucket
            let files = [];
            let filesError = null;

            if (!bucketsError) {
                const { data: filesData, error: filesErr } = await supabaseService.storage
                    .from('uploads')
                    .list('', {
                        limit: 10,
                        offset: 0
                    });
                files = filesData || [];
                filesError = filesErr;
            }

            res.json({
                supabaseConfigured: !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY),
                bucketsError: bucketsError?.message,
                buckets: buckets?.map(b => ({ name: b.name, id: b.id })) || [],
                filesError: filesError?.message,
                files: files,
                uploadsBucketExists: buckets?.some(b => b.name === 'uploads') || false
            });

        } catch (error) {
            res.json({
                error: error.message,
                stack: error.stack
            });
        }
    }
);
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