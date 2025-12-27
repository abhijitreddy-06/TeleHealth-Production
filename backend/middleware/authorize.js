export default function authorize(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.redirect("/role");
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.redirect("/role");
        }

        next();
    };
}
