// checkUsers.js
const db = require("../models/db"); // tu conexión a la DB

try {
  const stmt = db.prepare("SELECT id, username, role, status, created_at FROM users");
  const users = stmt.all();

  console.log("✅ Usuarios en la base de datos:");
  users.forEach(u => {
    console.log(`ID: ${u.id} | Usuario: ${u.username} | Rol: ${u.role} | Status: ${u.status} | Creado: ${u.created_at}`);
  });

} catch (err) {
  console.error("❌ Error al consultar usuarios:", err.message);
}