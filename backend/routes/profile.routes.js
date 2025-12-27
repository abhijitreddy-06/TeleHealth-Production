import db from "../config/db.js";
import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";

export default function profileRoutes(app) {

    /* =====================================================
       USER PROFILE (FETCH / ROUTER)
       - Navbar always points here
       - Backend decides: create OR view
    ====================================================== */
    app.get(
        "/user_profile",
        authenticate,
        authorize("user"),
        async (req, res) => {
            try {
                const result = await db.query(
                    `
                    SELECT
                        full_name,
                        gender,
                        custom_gender,
                        date_of_birth,
                        weight_kg,
                        height_cm,
                        blood_group,
                        allergies
                    FROM user_profile
                    WHERE user_id = $1
                    `,
                    [req.user.id]
                );

                // ❗ Profile NOT created → show CREATE page
                if (!result.rows.length) {
                    return res.redirect("/user_profile_create");
                }

                // ✅ Profile exists → render VIEW
                const r = result.rows[0];

                res.render("profile", {
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
                console.error("User profile fetch error:", err);
                res.status(500).send("Internal Server Error");
            }
        }
    );

    /* =====================================================
       USER PROFILE (CREATE / UPDATE)
    ====================================================== */
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
                    `
                    INSERT INTO user_profile
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
                        allergies = EXCLUDED.allergies
                    `,
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
                console.error("User profile save error:", err);
                res.status(500).send("Internal Server Error");
            }
        }
    );

    /* =====================================================
       DOCTOR PROFILE (FETCH / ROUTER)
       - Navbar always points here
       - Backend decides
    ====================================================== */
    app.get(
        "/doc_profile",
        authenticate,
        authorize("doctor"),
        async (req, res) => {
            try {
                const result = await db.query(
                    `
                    SELECT
                        full_name,
                        specialization,
                        experience_years,
                        qualification,
                        hospital_name,
                        bio
                    FROM doc_profile
                    WHERE doc_id = $1
                    `,
                    [req.user.id]
                );

                // ❗ No profile → CREATE page
                if (!result.rows.length) {
                    return res.redirect("/doc_profile_create");
                }

                // ✅ Profile exists → VIEW
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
                console.error("Doctor profile fetch error:", err);
                res.status(500).send("Internal Server Error");
            }
        }
    );

    /* =====================================================
       DOCTOR PROFILE (CREATE / UPDATE)
    ====================================================== */
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
                    `
                    INSERT INTO doc_profile
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
                        bio = EXCLUDED.bio
                    `,
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
                console.error("Doctor profile save error:", err);
                res.status(500).send("Internal Server Error");
            }
        }
    );
}
