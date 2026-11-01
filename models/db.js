const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(__dirname, "../database/appcraftpro.db");

const db = new Database(dbPath);

// Activar restricciones de claves foráneas
db.pragma("foreign_keys = ON");

// Configuración de SQLite
db.pragma("journal_mode = WAL");
db.pragma("busy_timeout = 5000");

module.exports = db;
