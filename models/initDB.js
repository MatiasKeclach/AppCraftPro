// models/initDB.js
const db = require("./db");

// Crear tablas iniciales si no existen
db.exec(`
-- Tabla de usuarios internos actualizada
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL,              -- superadmin | admin | colaborador
    status TEXT DEFAULT 'active',    -- active | inactive
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login_at DATETIME,
    last_login_ip TEXT,
    nombre TEXT,
    apellido TEXT,
    email TEXT
);

-- Tabla de aplicaciones internas
CREATE TABLE IF NOT EXISTS apps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    owner_id INTEGER,                -- referencia a users.id
    theme TEXT,
    style TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id)
);

-- Tabla de logs de login (opcional para auditoría)
CREATE TABLE IF NOT EXISTS login_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    login_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ip_address TEXT,
    success INTEGER DEFAULT 1,       -- 1 = éxito, 0 = fallo
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    folder TEXT NOT NULL, -- nombre de la carpeta dentro de /templates/
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,               -- Usuario propietario
  name TEXT NOT NULL,                     -- Nombre del proyecto
  type TEXT NOT NULL,                     -- Tipo: web, app, crm, etc.
  data TEXT NOT NULL,                     -- Estado completo del proyecto (JSON como TEXT)
  status TEXT DEFAULT 'draft',            -- Estado del proyecto: 'draft' o 'published'
  thumbnail TEXT,                         -- Ruta a una miniatura para vista previa
  last_modified DATETIME DEFAULT CURRENT_TIMESTAMP, -- Última modificación
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,   -- Fecha de creación
  UNIQUE(user_id, name),                  -- Evita duplicados de nombre por usuario
  FOREIGN KEY (user_id) REFERENCES users(id)
);
`);


// ------------------ Actualizar tabla users ------------------ //
// ------------------ Actualizar tabla users ------------------ //
const tableName = "users";
const newColumns = {
  nombre: "TEXT",
  apellido: "TEXT",
  email: "TEXT"
};

// Obtener las columnas actuales de la tabla
const existingColumnsStmt = db.prepare(`PRAGMA table_info(${tableName})`);
const existingColumns = existingColumnsStmt.all().map(c => c.name);

// Agregar columnas faltantes
for (const columnName in newColumns) {
  if (!existingColumns.includes(columnName)) {
    console.log(`🔹 Agregando columna '${columnName}' a la tabla '${tableName}'`);
    
    // Este es el comando correcto
    const sql = `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${newColumns[columnName]}`;
    db.prepare(sql).run();
  }
}

console.log("✅ Tabla 'users' actualizada con nuevas columnas (si faltaban)");

console.log("✅ Tablas inicializadas correctamente con mejoras para usuarios internos y apps");