import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/jwt.js";

export default function authenticate(req, res, next) {
    const token = req.cookies.token;
    if (!token) return res.redirect("/role");
    

    try {
        const payload = jwt.verify(token, JWT_SECRET);

        req.user = {
            id: payload.id,     // ✅ ALWAYS EXISTS
            role: payload.role,
            phone: payload.phone
        };
        next();
    } catch (err) {
        res.clearCookie("token");
        return res.redirect("/role");
    }
    

}
