import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/jwt.js";

export default function blockAfterLogin(req, res, next) {
    const token = req.cookies.token;
    if (!token) return next(); // not logged in

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
