import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import db from "../config/db.js";
import { JWT_SECRET, JWT_EXPIRES_IN } from "../config/jwt.js";

const saltRounds = 10;

export default function authRoutes(app) {

    /* =========================
       USER SIGNUP
    ========================= */
    app.post("/user_signup", async (req, res) => {
        const { phone, password, confirmpassword } = req.body;

        if (!password || password.length < 6)
            return res.send(`<script>alert('Password must be at least 6 characters.');location='/user_signup'</script>`);

        if (password !== confirmpassword)
            return res.send(`<script>alert('Passwords must match.');location='/user_signup'</script>`);

        const exists = await db.query(
            "SELECT id FROM login WHERE phone=$1",
            [phone]
        );
        if (exists.rows.length)
            return res.send(`<script>alert('Account already exists');location='/user_signup'</script>`);

        const hash = bcrypt.hashSync(password, bcrypt.genSaltSync(saltRounds));
        const result = await db.query(
            "INSERT INTO login (phone,password) VALUES ($1,$2) RETURNING id",
            [phone, hash]
        );

        // ✅ FIXED PAYLOAD
        const token = jwt.sign(
            {
                id: result.rows[0].id,   // ← unified
                phone,
                role: "user"
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        res.cookie("token", token, { httpOnly: true, sameSite: "Strict" });
        res.redirect("/user_profile");
    });

    /* =========================
       USER LOGIN
    ========================= */
    app.post("/user_login", async (req, res) => {
        const { phone, password } = req.body;

        const result = await db.query(
            "SELECT * FROM login WHERE phone=$1",
            [phone]
        );

        if (!result.rows.length)
            return res.send(`<script>alert('Account not found');location='/user_login'</script>`);

        if (!bcrypt.compareSync(password, result.rows[0].password))
            return res.send(`<script>alert('Incorrect password');location='/user_login'</script>`);

        const token = jwt.sign(
            {
                id: result.rows[0].id,   // ✅ FIXED
                phone,
                role: "user"
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        res.cookie("token", token, { httpOnly: true, sameSite: "Strict" });
        res.redirect("/user_home");
    });

    /* =========================
       DOCTOR SIGNUP
    ========================= */
    app.post("/doc_signup", async (req, res) => {
        const { phone, password, confirmpassword } = req.body;

        if (!password || password.length < 6)
            return res.send(`<script>alert('Password must be at least 6 characters.');location='/doc_signup'</script>`);

        if (password !== confirmpassword)
            return res.send(`<script>alert('Passwords must match.');location='/doc_signup'</script>`);

        const exists = await db.query(
            "SELECT docid FROM doc_login WHERE phone=$1",
            [phone]
        );
        if (exists.rows.length)
            return res.send(`<script>alert('Account already exists');location='/doc_signup'</script>`);

        const hash = bcrypt.hashSync(password, bcrypt.genSaltSync(saltRounds));
        const result = await db.query(
            "INSERT INTO doc_login (phone,password) VALUES ($1,$2) RETURNING docid",
            [phone, hash]
        );

        const token = jwt.sign(
            {
                id: result.rows[0].docid,   // ✅ FIXED
                phone,
                role: "doctor"
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        res.cookie("token", token, { httpOnly: true, sameSite: "Strict" });
        res.redirect("/doc_profile");
    });

    /* =========================
       DOCTOR LOGIN
    ========================= */
    app.post("/doc_login", async (req, res) => {
        const { phone, password } = req.body;

        const result = await db.query(
            "SELECT * FROM doc_login WHERE phone=$1",
            [phone]
        );

        if (!result.rows.length)
            return res.send(`<script>alert('Account not found');location='/doc_login'</script>`);

        if (!bcrypt.compareSync(password, result.rows[0].password))
            return res.send(`<script>alert('Incorrect password');location='/doc_login'</script>`);

        const token = jwt.sign(
            {
                id: result.rows[0].docid,   // ✅ FIXED
                phone,
                role: "doctor"
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        res.cookie("token", token, { httpOnly: true, sameSite: "Strict" });
        res.redirect("/doc_home");
    });

    /* =========================
       LOGOUT
    ========================= */
    app.get("/logout", (req, res) => {
        res.clearCookie("token");
        res.redirect("/role");
    });
}
