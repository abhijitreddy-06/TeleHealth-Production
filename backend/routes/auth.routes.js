import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import db from "../config/db.js";
import { JWT_SECRET, JWT_EXPIRES_IN } from "../config/jwt.js";

const saltRounds = 10;

export default function authRoutes(app) {

    /* =========================
       USER SIGNUP
    ========================= */
    app.post("/api/user_signup", async (req, res) => {
        try {
            const { phone, password, confirmpassword } = req.body;

            if (!password || password.length < 6)
                return res.status(400).json({ error: "Password must be at least 6 characters" });

            if (password !== confirmpassword)
                return res.status(400).json({ error: "Passwords do not match" });

            const exists = await db.query(
                "SELECT id FROM login WHERE phone=$1",
                [phone]
            );

            if (exists.rows.length)
                return res.status(400).json({ error: "Account already exists" });

            const hash = bcrypt.hashSync(password, bcrypt.genSaltSync(saltRounds));

            const result = await db.query(
                "INSERT INTO login (phone,password) VALUES ($1,$2) RETURNING id",
                [phone, hash]
            );

            const token = jwt.sign(
                { id: result.rows[0].id, phone, role: "user" },
                JWT_SECRET,
                { expiresIn: JWT_EXPIRES_IN }
            );

            res.cookie("token", token, {
                httpOnly: true,
                secure: true,
                sameSite: "None"
            });

            res.json({ success: true, role: "user" });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: "Server error" });
        }
    });

    /* =========================
       USER LOGIN
    ========================= */
    app.post("/api/user_login", async (req, res) => {
        try {
            const { phone, password } = req.body;

            const result = await db.query(
                "SELECT * FROM login WHERE phone=$1",
                [phone]
            );

            if (!result.rows.length)
                return res.status(400).json({ error: "Account not found" });

            if (!bcrypt.compareSync(password, result.rows[0].password))
                return res.status(400).json({ error: "Incorrect password" });

            const token = jwt.sign(
                { id: result.rows[0].id, phone, role: "user" },
                JWT_SECRET,
                { expiresIn: JWT_EXPIRES_IN }
            );

            res.cookie("token", token, {
                httpOnly: true,
                secure: true,
                sameSite: "None"
            });

            res.json({ success: true, role: "user" });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: "Server error" });
        }
    });

    /* =========================
       DOCTOR LOGIN
    ========================= */
    app.post("/api/doc_login", async (req, res) => {
        try {
            const { phone, password } = req.body;

            const result = await db.query(
                "SELECT * FROM doc_login WHERE phone=$1",
                [phone]
            );

            if (!result.rows.length)
                return res.status(400).json({ error: "Account not found" });

            if (!bcrypt.compareSync(password, result.rows[0].password))
                return res.status(400).json({ error: "Incorrect password" });

            const token = jwt.sign(
                { id: result.rows[0].docid, phone, role: "doctor" },
                JWT_SECRET,
                { expiresIn: JWT_EXPIRES_IN }
            );

            res.cookie("token", token, {
                httpOnly: true,
                secure: true,
                sameSite: "None"
            });

            res.json({ success: true, role: "doctor" });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: "Server error" });
        }
    });

    /* =========================
       LOGOUT
    ========================= */
    app.post("/api/logout", (req, res) => {
        res.clearCookie("token", {
            httpOnly: true,
            secure: true,
            sameSite: "None"
        });
        res.json({ success: true });
    });
}
