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


-- ==============================
-- Módulo Logística
-- ==============================
CREATE TABLE IF NOT EXISTS logistica_clientes (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    nombre TEXT NOT NULL,
    empresa TEXT,

    contacto TEXT,
    telefono TEXT,
    email TEXT,

    direccion TEXT,
    localidad TEXT,
    provincia TEXT,

    horario TEXT,
    observaciones TEXT,

    estado TEXT DEFAULT 'activo',

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP

);

CREATE TABLE IF NOT EXISTS logistica_colectas (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    cliente_id INTEGER NOT NULL,

    fecha DATETIME DEFAULT CURRENT_TIMESTAMP,

    colectado_por TEXT,

    cantidad_paquetes INTEGER DEFAULT 0,

    observaciones TEXT,

    estado TEXT DEFAULT 'recibida',

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY(cliente_id)
    REFERENCES logistica_clientes(id)

);

CREATE TABLE IF NOT EXISTS logistica_choferes (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    nombre TEXT NOT NULL,

    telefono TEXT,

    vehiculo TEXT,

    patente TEXT,

    estado TEXT DEFAULT 'activo',

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP

);

CREATE TABLE IF NOT EXISTS logistica_paquetes (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    cliente_id INTEGER NOT NULL,

    tipo TEXT DEFAULT 'flex',

    codigo_externo TEXT,

    codigo_interno TEXT UNIQUE,

    qr_codigo TEXT,

    descripcion TEXT,

    foto TEXT,

    colectado_por TEXT,

    fecha_colecta DATETIME DEFAULT CURRENT_TIMESTAMP,

    estado TEXT DEFAULT 'recibido',

    chofer_id INTEGER,

    fecha_entrega DATETIME,

    observaciones TEXT,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY(cliente_id)
    REFERENCES logistica_clientes(id),

    FOREIGN KEY(chofer_id)
    REFERENCES logistica_choferes(id)

);

CREATE TABLE IF NOT EXISTS logistica_asignaciones (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    paquete_id INTEGER NOT NULL,

    chofer_id INTEGER NOT NULL,

    fecha_asignacion DATETIME DEFAULT CURRENT_TIMESTAMP,

    estado TEXT DEFAULT 'asignado',

    observaciones TEXT,

    FOREIGN KEY(paquete_id)
    REFERENCES logistica_paquetes(id),

    FOREIGN KEY(chofer_id)
    REFERENCES logistica_choferes(id)

);

CREATE TABLE IF NOT EXISTS logistica_movimientos (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    paquete_id INTEGER NOT NULL,

    accion TEXT,

    detalle TEXT,

    usuario TEXT,

    fecha DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY(paquete_id)
    REFERENCES logistica_paquetes(id)

);

// ==========================================
// AGREGAR COLUMNAS SI FALTAN
// ==========================================


function agregarColumna(tabla,columna,tipo){


    const columnas = db
    .prepare(`PRAGMA table_info(${tabla})`)
    .all()
    .map(c=>c.name);



    if(!columnas.includes(columna)){


        console.log(
            `🔹 Agregando ${columna} a ${tabla}`
        );


        db.prepare(
            `
            ALTER TABLE ${tabla}
            ADD COLUMN ${columna} ${tipo}
            `
        ).run();


    }

}



// Paquetes

agregarColumna(
"logistica_paquetes",
"tipo",
"TEXT DEFAULT 'flex'"
);


agregarColumna(
"logistica_paquetes",
"codigo_externo",
"TEXT"
);


agregarColumna(
"logistica_paquetes",
"codigo_interno",
"TEXT"
);


agregarColumna(
"logistica_paquetes",
"qr_codigo",
"TEXT"
);


agregarColumna(
"logistica_paquetes",
"colectado_por",
"TEXT"
);


agregarColumna(
"logistica_paquetes",
"fecha_colecta",
"DATETIME"
);


agregarColumna(
"logistica_paquetes",
"chofer_id",
"INTEGER"
);


agregarColumna(
"logistica_paquetes",
"fecha_entrega",
"DATETIME"
);


agregarColumna(
"logistica_paquetes",
"observaciones",
"TEXT"
);



console.log(
"✅ Módulo paquetes actualizado"
);


console.log(
"🚚 Logística lista para colectas y entregas"
);


// ------------------ Actualizar tabla logistica_clientes ------------------ //

const logisticaTable = "logistica_clientes";

const nuevasColumnasLogistica = {
  contacto: "TEXT",
  localidad: "TEXT",
  provincia: "TEXT",
  horario: "TEXT",
  observaciones: "TEXT",
  estado: "TEXT DEFAULT 'activo'",
  updated_at: "DATETIME"
};


const columnasLogistica = db
  .prepare(`PRAGMA table_info(${logisticaTable})`)
  .all()
  .map(c => c.name);


for (const columna in nuevasColumnasLogistica) {

  if (!columnasLogistica.includes(columna)) {

    console.log(`🔹 Agregando columna '${columna}' a '${logisticaTable}'`);

    db.prepare(
      `ALTER TABLE ${logisticaTable} ADD COLUMN ${columna} ${nuevasColumnasLogistica[columna]}`
    ).run();

  }

}


console.log("✅ Tabla 'logistica_clientes' actualizada");
console.log("✅ Base de datos inicializada correctamente");