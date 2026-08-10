
// ============================================================
// models/initDB.js
// APPCRAFT PRO
// BASE DE DATOS PRINCIPAL + MÓDULO LOGÍSTICA
// ============================================================

const db = require("./db");


// ============================================================
// TABLAS PRINCIPALES DE APPCRAFT PRO
// ============================================================

db.exec(`

CREATE TABLE IF NOT EXISTS users (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    username TEXT UNIQUE NOT NULL,

    password TEXT NOT NULL,

    role TEXT NOT NULL,

    status TEXT DEFAULT 'active',

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    last_login_at DATETIME,

    last_login_ip TEXT,

    nombre TEXT,

    apellido TEXT,

    email TEXT

);


CREATE TABLE IF NOT EXISTS apps (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    name TEXT NOT NULL,

    owner_id INTEGER,

    theme TEXT,

    style TEXT,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (owner_id)
        REFERENCES users(id)

);


CREATE TABLE IF NOT EXISTS login_logs (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    user_id INTEGER,

    login_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    ip_address TEXT,

    success INTEGER DEFAULT 1,

    FOREIGN KEY (user_id)
        REFERENCES users(id)

);


CREATE TABLE IF NOT EXISTS templates (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    name TEXT NOT NULL,

    description TEXT,

    folder TEXT NOT NULL,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP

);


CREATE TABLE IF NOT EXISTS projects (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    user_id INTEGER NOT NULL,

    name TEXT NOT NULL,

    type TEXT NOT NULL,

    data TEXT NOT NULL,

    status TEXT DEFAULT 'draft',

    thumbnail TEXT,

    last_modified DATETIME DEFAULT CURRENT_TIMESTAMP,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(user_id, name),

    FOREIGN KEY (user_id)
        REFERENCES users(id)

);

`);


// ============================================================
// FUNCIÓN AUXILIAR
// AGREGAR COLUMNA SI NO EXISTE
// ============================================================

function agregarColumna(tabla, columna, tipo) {

    const columnas = db
        .prepare(`PRAGMA table_info(${tabla})`)
        .all()
        .map(c => c.name);


    if (!columnas.includes(columna)) {

        console.log(
            `🔹 Agregando columna '${columna}' a '${tabla}'`
        );


        db.prepare(
            `ALTER TABLE ${tabla}
             ADD COLUMN ${columna} ${tipo}`
        ).run();

    }

}


// ============================================================
// USUARIOS
// ============================================================

agregarColumna(
    "users",
    "nombre",
    "TEXT"
);

agregarColumna(
    "users",
    "apellido",
    "TEXT"
);

agregarColumna(
    "users",
    "email",
    "TEXT"
);

console.log(
    "✅ Tabla users actualizada"
);


// ============================================================
// CLIENTES LOGÍSTICA
// ============================================================

db.exec(`

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

`);


// ============================================================
// ACTUALIZAR CLIENTES EXISTENTES
// ============================================================

const columnasClientes = {

    contacto: "TEXT",

    telefono: "TEXT",

    email: "TEXT",

    direccion: "TEXT",

    localidad: "TEXT",

    provincia: "TEXT",

    horario: "TEXT",

    observaciones: "TEXT",

    estado: "TEXT DEFAULT 'activo'",

    updated_at: "DATETIME"

};


for (
    const columna in columnasClientes
) {

    agregarColumna(
        "logistica_clientes",
        columna,
        columnasClientes[columna]
    );

}


console.log(
    "✅ Tabla logistica_clientes actualizada"
);


// ============================================================
// CHOFERES
// ============================================================

db.exec(`

CREATE TABLE IF NOT EXISTS logistica_choferes (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    nombre TEXT NOT NULL,

    telefono TEXT,

    vehiculo TEXT,

    patente TEXT,

    estado TEXT DEFAULT 'activo',

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP

);

`);

console.log(
    "✅ Tabla logistica_choferes lista"
);


// ============================================================
// COLECTAS
//
// IMPORTANTE:
// Una colecta representa una recepción de paquetes.
//
// Ejemplo:
//
// Colecta #25
// Fecha: 2026-08-10
// Cliente: Cliente ABC
// Paquetes: 17
//
// Cada paquete tendrá posteriormente:
// colecta_id = 25
// ============================================================

db.exec(`

CREATE TABLE IF NOT EXISTS logistica_colectas (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    cliente_id INTEGER NOT NULL,

    fecha DATE NOT NULL,

    chofer_id INTEGER,

    cantidad_paquetes INTEGER DEFAULT 0,

    observaciones TEXT,

    estado TEXT DEFAULT 'recibida',

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (cliente_id)
        REFERENCES logistica_clientes(id),

    FOREIGN KEY (chofer_id)
        REFERENCES logistica_choferes(id)

);

`);


// ============================================================
// COMPATIBILIDAD CON COLECTAS EXISTENTES
// ============================================================

agregarColumna(
    "logistica_colectas",
    "chofer_id",
    "INTEGER"
);

agregarColumna(
    "logistica_colectas",
    "updated_at",
    "DATETIME"
);

console.log(
    "✅ Tabla logistica_colectas lista"
);


// ============================================================
// PAQUETES
//
// ESTA ES LA TABLA CENTRAL DEL SISTEMA.
//
// Cada paquete pertenece a:
// - un cliente
// - una colecta
//
// Y puede tener:
// - foto
// - dirección
// - barrio
// - zona
// - destinatario
// - teléfono
// - DNI
// - chofer
// - estado
// ============================================================

db.exec(`

CREATE TABLE IF NOT EXISTS logistica_paquetes (

    id INTEGER PRIMARY KEY AUTOINCREMENT,


    -- RELACIONES

    colecta_id INTEGER,

    cliente_id INTEGER NOT NULL,

    chofer_id INTEGER,


    -- IDENTIFICACIÓN

    tipo TEXT DEFAULT 'flex',

    codigo_externo TEXT,

    codigo_interno TEXT UNIQUE,

    qr_codigo TEXT,


    -- FOTO

    foto TEXT,


    -- INFORMACIÓN DEL PAQUETE

    descripcion TEXT,

    peso REAL,

    bultos INTEGER,

    numero_bulto INTEGER,


    -- DESTINATARIO

    destinatario TEXT,

    dni TEXT,

    telefono TEXT,


    -- DIRECCIÓN

    direccion TEXT,

    barrio TEXT,

    zona TEXT,

    localidad TEXT,

    provincia TEXT,

    referencia TEXT,


    -- REMITENTE

    remitente TEXT,


    -- OPERACIÓN

    estado TEXT DEFAULT 'recibido',

    fecha_colecta DATETIME DEFAULT CURRENT_TIMESTAMP,

    fecha_recepcion DATETIME DEFAULT CURRENT_TIMESTAMP,

    fecha_entrega DATETIME,


    colectado_por TEXT,


    observaciones TEXT,


    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,


    FOREIGN KEY (colecta_id)
        REFERENCES logistica_colectas(id),

    FOREIGN KEY (cliente_id)
        REFERENCES logistica_clientes(id),

    FOREIGN KEY (chofer_id)
        REFERENCES logistica_choferes(id)

);

`);


// ============================================================
// AGREGAR CAMPOS A PAQUETES EXISTENTES
// ============================================================

const columnasPaquetes = {

    colecta_id: "INTEGER",

    tipo: "TEXT DEFAULT 'flex'",

    codigo_externo: "TEXT",

    codigo_interno: "TEXT",

    qr_codigo: "TEXT",

    foto: "TEXT",

    descripcion: "TEXT",

    peso: "REAL",

    bultos: "INTEGER",

    numero_bulto: "INTEGER",

    destinatario: "TEXT",

    dni: "TEXT",

    telefono: "TEXT",

    direccion: "TEXT",

    barrio: "TEXT",

    zona: "TEXT",

    localidad: "TEXT",

    provincia: "TEXT",

    referencia: "TEXT",

    remitente: "TEXT",

    estado: "TEXT DEFAULT 'recibido'",

    fecha_colecta: "DATETIME",

    fecha_recepcion: "DATETIME",

    fecha_entrega: "DATETIME",

    colectado_por: "TEXT",

    observaciones: "TEXT",

    chofer_id: "INTEGER",

    updated_at: "DATETIME"

};


for (
    const columna in columnasPaquetes
) {

    agregarColumna(
        "logistica_paquetes",
        columna,
        columnasPaquetes[columna]
    );

}


console.log(
    "✅ Tabla logistica_paquetes actualizada"
);


// ============================================================
// ASIGNACIONES
//
// Permite mantener historial.
//
// Un paquete puede ser asignado a un chofer
// y posteriormente reasignado.
//
// La tabla conserva el historial.
// ============================================================

db.exec(`

CREATE TABLE IF NOT EXISTS logistica_asignaciones (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    paquete_id INTEGER NOT NULL,

    chofer_id INTEGER NOT NULL,

    fecha_asignacion DATETIME DEFAULT CURRENT_TIMESTAMP,

    estado TEXT DEFAULT 'asignado',

    observaciones TEXT,

    FOREIGN KEY (paquete_id)
        REFERENCES logistica_paquetes(id),

    FOREIGN KEY (chofer_id)
        REFERENCES logistica_choferes(id)

);

`);

console.log(
    "✅ Tabla logistica_asignaciones lista"
);


// ============================================================
// HISTORIAL DE MOVIMIENTOS
// ============================================================

db.exec(`

CREATE TABLE IF NOT EXISTS logistica_movimientos (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    paquete_id INTEGER NOT NULL,

    accion TEXT,

    detalle TEXT,

    usuario TEXT,

    fecha DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (paquete_id)
        REFERENCES logistica_paquetes(id)

);

`);

console.log(
    "✅ Tabla logistica_movimientos lista"
);


// ============================================================
// ÍNDICES
//
// Esto va a ser MUY importante cuando tengamos muchos paquetes.
//
// Las búsquedas por fecha, barrio, zona, cliente y chofer
// serán mucho más rápidas.
// ============================================================

db.exec(`

CREATE INDEX IF NOT EXISTS idx_paquetes_colecta
ON logistica_paquetes(colecta_id);


CREATE INDEX IF NOT EXISTS idx_paquetes_cliente
ON logistica_paquetes(cliente_id);


CREATE INDEX IF NOT EXISTS idx_paquetes_chofer
ON logistica_paquetes(chofer_id);


CREATE INDEX IF NOT EXISTS idx_paquetes_tipo
ON logistica_paquetes(tipo);


CREATE INDEX IF NOT EXISTS idx_paquetes_estado
ON logistica_paquetes(estado);


CREATE INDEX IF NOT EXISTS idx_paquetes_barrio
ON logistica_paquetes(barrio);


CREATE INDEX IF NOT EXISTS idx_paquetes_zona
ON logistica_paquetes(zona);


CREATE INDEX IF NOT EXISTS idx_paquetes_fecha
ON logistica_paquetes(fecha_colecta);


CREATE INDEX IF NOT EXISTS idx_colectas_fecha
ON logistica_colectas(fecha);


CREATE INDEX IF NOT EXISTS idx_colectas_cliente
ON logistica_colectas(cliente_id);

`);

console.log(
    "✅ Índices de logística creados"
);


// ============================================================
// NORMALIZAR DATOS EXISTENTES
// ============================================================

// Si existen paquetes viejos sin tipo,
// los consideramos FLEX por compatibilidad.

db.prepare(`

    UPDATE logistica_paquetes

    SET tipo = 'flex'

    WHERE tipo IS NULL
       OR TRIM(tipo) = ''

`).run();


// Si existen paquetes viejos sin estado,
// los marcamos como recibidos.

db.prepare(`

    UPDATE logistica_paquetes

    SET estado = 'recibido'

    WHERE estado IS NULL
       OR TRIM(estado) = ''

`).run();


// ============================================================
// FINAL
// ============================================================

console.log(
    "=================================================="
);

console.log(
    "🚚 APPCRAFT PRO - LOGÍSTICA"
);

console.log(
    "✅ Base de datos inicializada correctamente"
);

console.log(
    "📦 Paquetes vinculados a colectas"
);

console.log(
    "📸 Soporte para fotografías"
);

console.log(
    "📍 Dirección / barrio / zona"
);

console.log(
    "🚚 Asignación de choferes"
);

console.log(
    "🔎 Índices para búsquedas"
);

console.log(
    "=================================================="
);
