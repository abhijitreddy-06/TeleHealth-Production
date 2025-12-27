/*
  API-ONLY AUTHORIZATION MIDDLEWARE

  Rules:
  - Backend NEVER redirects
  - Backend NEVER serves HTML
  - Backend ONLY returns JSON errors
*/

export default function authorize(...allowedRoles) {
    return (req, res, next) => {
        // authenticate middleware must run first
        if (!req.user) {
            return res.status(401).json({
                error: "Authentication required"
            });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                error: "Access denied"
            });
        }

        next();
    };
}
