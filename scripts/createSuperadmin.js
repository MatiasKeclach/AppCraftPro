// script/create_superadmin.js

const bcrypt = require("bcrypt");
const path = require("path");
const Database = require("better-sqlite3");

// Configurar ruta de la DB
const dbPath = path.join(__dirname, "../database/appcraftpro.db");
const db = new Database(dbPath);

// Datos del superadmin que querés insertar
const username = "superadmin";        // Cambiá por tu usuario
const password = "MiPasswordSegura";  // Cambiá por tu contraseña
const role = "superadmin";

// Generar hash de la contraseña
const hashedPassword = bcrypt.hashSync(password, 10);

try {
  // Preparar insert
  const stmt = db.prepare(`
    INSERT INTO users (username, password, role)
    VALUES (?, ?, ?)
  `);

  // Ejecutar insert
  const info = stmt.run(username, hashedPassword, role);

  console.log("✅ Superadmin creado correctamente:");
  console.log(`ID: ${info.lastInsertRowid}`);
  console.log(`Usuario: ${username}`);
  console.log(`Rol: ${role}`);
} catch (err) {
  if (err.code === "SQLITE_CONSTRAINT_UNIQUE") {
    console.error("❌ Error: Ya existe un usuario con ese nombre.");
  } else {
    console.error("❌ Error al crear superadmin:", err.message);
  }
}

// Cerrar DB
db.close();