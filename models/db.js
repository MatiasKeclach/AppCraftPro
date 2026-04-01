// models/db.js
const Database = require("better-sqlite3");
const path = require("path");

// Ruta de la base de datos
const dbPath = path.join(__dirname, "../database/appcraftpro.db");

// Conexión a la base de datos (síncrona)
const db = new Database(dbPath);

// Exportamos la conexión
module.exports = db;