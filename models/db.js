// models/db.js
// Conexión a PostgreSQL / Supabase para AppCraft Pro (datos reales)

const { Pool } = require("pg");

// Configuración de la base de datos Supabase
const pool = new Pool({
  user: "postgres",                                           // tu usuario Supabase
  host: "db.aueumewvonebyfqgteec.supabase.co",               // host Supabase
  database: "postgres",                                       // nombre de la base
  password: "PVJ2ob6j5ndezqK4",                               // contraseña de Supabase
  port: 5432,                                                 // puerto por defecto
  ssl: { rejectUnauthorized: false }                          // SSL obligatorio para Supabase
});

// Función para testear conexión
const testConnection = async () => {
  try {
    const res = await pool.query("SELECT NOW()");
    console.log("✅ Conexión a la base de datos OK. Fecha/hora:", res.rows[0].now);
  } catch (err) {
    console.error("❌ Error conectando a la base de datos:", err);
  }
};

// Ejecutar test si corremos directamente este archivo
if (require.main === module) {
  testConnection();
}

// Exportamos pool para usar en toda la app
module.exports = pool;