import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/jwt.js";

/*
  API-ONLY BLOCK-AFTER-LOGIN MIDDLEWARE

  Purpose:
  - Used ONLY on public routes (login/signup)
  - If user is already logged in, BLOCK access
  - Backend NEVER redirects
  - Frontend decides where to go
*/

export default function blockAfterLogin(req, res, next) {
    try {
        const token = req.cookies?.token;

        // Not logged in → allow access
        if (!token) {
            return next();
        }

        const payload = jwt.verify(token, JWT_SECRET);

        // Logged in → block access
        return res.status(403).json({
            error: "Already authenticated",
            role: payload.role
        });

    } catch (err) {
        // Invalid token → allow access
        return next();
    }
}
