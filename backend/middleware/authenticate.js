import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/jwt.js";

/*
  API-ONLY AUTHENTICATION MIDDLEWARE

  Rules:
  - Backend NEVER redirects
  - Backend NEVER sends HTML
  - Backend ONLY returns JSON errors
*/

export default function authenticate(req, res, next) {
    try {
        const token = req.cookies?.token;

        if (!token) {
            return res.status(401).json({
                error: "Authentication required"
            });
        }

        const payload = jwt.verify(token, JWT_SECRET);

        // Attach authenticated user to request
        req.user = {
            id: payload.id,
            role: payload.role,
            phone: payload.phone
        };

        next();
    } catch (err) {
        console.error("JWT auth error:", err);

        res.clearCookie("token", {
            httpOnly: true,
            secure: true,
            sameSite: "None"
        });

        return res.status(401).json({
            error: "Invalid or expired token"
        });
    }
}
