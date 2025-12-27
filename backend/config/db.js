import pg from "pg";
const { Pool } = pg;

const db = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

db.on("connect", () => {
    console.log("✅ Connected to Supabase PostgreSQL");
});

db.on("error", (err) => {
    console.error("❌ Supabase DB error:", err);
    process.exit(1);
});

export default db;
