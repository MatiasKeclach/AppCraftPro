
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

-- Clientes de logística
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

-- ==============================
-- Colectas de paquetes
-- ==============================

CREATE TABLE IF NOT EXISTS logistica_colectas (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    cliente_id INTEGER NOT NULL,

    fecha DATETIME DEFAULT CURRENT_TIMESTAMP,

    chofer TEXT,

    cantidad_paquetes INTEGER DEFAULT 0,

    observaciones TEXT,

    estado TEXT DEFAULT 'recibida',

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (cliente_id) REFERENCES logistica_clientes(id)

);

-- Choferes
CREATE TABLE IF NOT EXISTS logistica_choferes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    telefono TEXT,
    vehiculo TEXT,
    patente TEXT,
    estado TEXT DEFAULT 'activo',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Paquetes
CREATE TABLE IF NOT EXISTS logistica_paquetes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_id INTEGER NOT NULL,
    codigo TEXT,
    descripcion TEXT,
    foto TEXT,
    estado TEXT DEFAULT 'pendiente',
    fecha_recepcion DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cliente_id) REFERENCES logistica_clientes(id)
);

-- Asignaciones de paquetes a choferes
CREATE TABLE IF NOT EXISTS logistica_asignaciones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    paquete_id INTEGER NOT NULL,
    chofer_id INTEGER NOT NULL,
    fecha_asignacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    estado TEXT DEFAULT 'asignado',
    FOREIGN KEY (paquete_id) REFERENCES logistica_paquetes(id),
    FOREIGN KEY (chofer_id) REFERENCES logistica_choferes(id)
);

-- Colectas de paquetes

CREATE TABLE IF NOT EXISTS logistica_colectas (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    cliente_id INTEGER NOT NULL,

    fecha DATETIME DEFAULT CURRENT_TIMESTAMP,

    chofer TEXT,

    cantidad_paquetes INTEGER DEFAULT 0,

    observaciones TEXT,

    estado TEXT DEFAULT 'recibida',

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (cliente_id) REFERENCES logistica_clientes(id)

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

const existingColumns = db
  .prepare(`PRAGMA table_info(${tableName})`)
  .all()
  .map(c => c.name);


for (const columnName in newColumns) {

  if (!existingColumns.includes(columnName)) {

    console.log(`🔹 Agregando columna '${columnName}' a la tabla '${tableName}'`);

    db.prepare(
      `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${newColumns[columnName]}`
    ).run();

  }

}

console.log("✅ Tabla 'users' actualizada");

// ==========================================
// ACTUALIZACIÓN MÓDULO PAQUETES LOGÍSTICA
// ==========================================


// Paquetes completos
db.exec(`

CREATE TABLE IF NOT EXISTS logistica_paquetes (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    cliente_id INTEGER NOT NULL,

    tipo TEXT DEFAULT 'flex',
    -- flex | particular


    codigo_externo TEXT,
    -- código original del paquete


    codigo_interno TEXT UNIQUE,
    -- generado por sistema


    qr_codigo TEXT,
    -- código para QR interno


    descripcion TEXT,

    foto TEXT,


    colectado_por TEXT,


    fecha_colecta DATETIME DEFAULT CURRENT_TIMESTAMP,


    estado TEXT DEFAULT 'recibido',
    -- recibido
    -- asignado
    -- en_reparto
    -- entregado
    -- rechazado


    chofer_id INTEGER,


    fecha_entrega DATETIME,


    observaciones TEXT,


    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,


    FOREIGN KEY(cliente_id)
    REFERENCES logistica_clientes(id),


    FOREIGN KEY(chofer_id)
    REFERENCES logistica_choferes(id)

);





-- Asignaciones de entrega

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






-- Historial de movimientos

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


`);





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

// ==========================================
// ACTUALIZACIÓN DATOS COMPLETOS PARTICULARES
// ==========================================

const columnasParticulares = {

    numero_orden: "TEXT",
    fecha_emision: "TEXT",
    peso: "TEXT",
    bultos: "TEXT",
    numero_bulto: "TEXT",

    remitente: "TEXT",
    destinatario: "TEXT",

    telefono: "TEXT",
    direccion: "TEXT",

    localidad: "TEXT",
    zona: "TEXT"

};


for (const columna in columnasParticulares) {

    agregarColumna(
        "logistica_paquetes",
        columna,
        columnasParticulares[columna]
    );

}


console.log(
    "✅ Campos de paquetes particulares actualizados"
);

// ==========================================
// INTEGRACIÓN MERCADO LIBRE - LOGÍSTICA
// ==========================================

console.log("");
console.log("==========================================");
console.log("🔵 INICIANDO ACTUALIZACIÓN MERCADO LIBRE");
console.log("==========================================");


// ==========================================
// FUNCIÓN SEGURA PARA AGREGAR COLUMNAS
// ==========================================

function agregarColumnaMercadoLibre(tabla, columna, tipo) {

    const columnas = db
        .prepare(`PRAGMA table_info(${tabla})`)
        .all()
        .map(c => c.name);


    if (!columnas.includes(columna)) {

        console.log(
            `🔹 Agregando columna '${columna}' a '${tabla}'...`
        );


        db.prepare(`
            ALTER TABLE ${tabla}
            ADD COLUMN ${columna} ${tipo}
        `).run();


        console.log(
            `✅ Columna '${columna}' agregada correctamente`
        );

    } else {

        console.log(
            `✔️ Columna '${columna}' ya existe`
        );

    }

}


// ==========================================
// COLUMNAS MERCADO LIBRE EN PAQUETES
// ==========================================

agregarColumnaMercadoLibre(
    "logistica_paquetes",
    "colecta_id",
    "INTEGER"
);


agregarColumnaMercadoLibre(
    "logistica_paquetes",
    "mercadolibre_order_id",
    "TEXT"
);


agregarColumnaMercadoLibre(
    "logistica_paquetes",
    "mercadolibre_shipment_id",
    "TEXT"
);


agregarColumnaMercadoLibre(
    "logistica_paquetes",
    "mercadolibre_pack_id",
    "TEXT"
);


agregarColumnaMercadoLibre(
    "logistica_paquetes",
    "mercadolibre_status",
    "TEXT"
);


agregarColumnaMercadoLibre(
    "logistica_paquetes",
    "tracking_number",
    "TEXT"
);


agregarColumnaMercadoLibre(
    "logistica_paquetes",
    "destinatario",
    "TEXT"
);


agregarColumnaMercadoLibre(
    "logistica_paquetes",
    "telefono",
    "TEXT"
);


agregarColumnaMercadoLibre(
    "logistica_paquetes",
    "direccion",
    "TEXT"
);


agregarColumnaMercadoLibre(
    "logistica_paquetes",
    "localidad",
    "TEXT"
);


agregarColumnaMercadoLibre(
    "logistica_paquetes",
    "provincia",
    "TEXT"
);


agregarColumnaMercadoLibre(
    "logistica_paquetes",
    "codigo_postal",
    "TEXT"
);


agregarColumnaMercadoLibre(
    "logistica_paquetes",
    "fecha_importacion",
    "DATETIME"
);


agregarColumnaMercadoLibre(
    "logistica_paquetes",
    "origen",
    "TEXT DEFAULT 'mercadolibre'"
);


// ==========================================
// TABLA DE RELACIÓN MERCADO LIBRE
// ==========================================

db.exec(`

    CREATE TABLE IF NOT EXISTS logistica_mercadolibre_importaciones (

        id INTEGER PRIMARY KEY AUTOINCREMENT,

        mercadolibre_order_id TEXT,

        mercadolibre_shipment_id TEXT UNIQUE,

        mercadolibre_pack_id TEXT,

        paquete_id INTEGER,

        cliente_id INTEGER,

        colecta_id INTEGER,

        estado TEXT DEFAULT 'importado',

        fecha_importacion DATETIME DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (paquete_id)
            REFERENCES logistica_paquetes(id),

        FOREIGN KEY (cliente_id)
            REFERENCES logistica_clientes(id),

        FOREIGN KEY (colecta_id)
            REFERENCES logistica_colectas(id)

    );

`);


console.log(
    "✅ Tabla 'logistica_mercadolibre_importaciones' verificada"
);


// ==========================================
// FINAL
// ==========================================

console.log("");
console.log("==========================================");
console.log("🎉 MERCADO LIBRE - BASE DE DATOS LISTA");
console.log("==========================================");

console.log(
    "📦 Paquetes preparados para integración Mercado Libre"
);

console.log(
    "🔗 Relación paquete → colecta disponible"
);

console.log(
    "👤 Relación paquete → cliente disponible"
);

console.log(
    "🚚 Paquetes preparados para asignación a chofer"
);

console.log(
    "🔄 Control de envíos duplicados habilitado"
);

// ==========================================
// MÓDULO POTENCIALES CLIENTES
// ==========================================

db.exec(`

CREATE TABLE IF NOT EXISTS potenciales_clientes (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    tipo TEXT DEFAULT 'ambos',
    -- logistica | programacion | ambos

    nombre TEXT NOT NULL,

    empresa TEXT,

    mercadolibre_nickname TEXT,

    mercadolibre_seller_id TEXT,

    mercadolibre_url TEXT,

    categoria TEXT,

    ventas INTEGER DEFAULT 0,

    nivel_mercadolider TEXT,

    reputacion TEXT,

    publicaciones INTEGER DEFAULT 0,

    web TEXT,

    instagram TEXT,

    facebook TEXT,

    whatsapp TEXT,

    email TEXT,

    telefono TEXT,

    direccion TEXT,

    localidad TEXT,

    provincia TEXT,

    estado TEXT DEFAULT 'potencial',
    -- potencial
    -- contactado
    -- interesado
    -- cliente
    -- no_interesado

    observaciones TEXT,

    created_by INTEGER,

    updated_by INTEGER,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY(created_by)
        REFERENCES users(id),

    FOREIGN KEY(updated_by)
        REFERENCES users(id)

);


CREATE TABLE IF NOT EXISTS potenciales_busquedas (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    tipo TEXT NOT NULL,

    categoria TEXT,

    criterio_ventas INTEGER,

    criterio_mercadolider INTEGER DEFAULT 0,

    cantidad_solicitada INTEGER DEFAULT 100,

    resultados_encontrados INTEGER DEFAULT 0,

    usuario_id INTEGER,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY(usuario_id)
        REFERENCES users(id)

);


CREATE TABLE IF NOT EXISTS potenciales_contactos (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    potencial_id INTEGER NOT NULL,

    tipo TEXT,

    detalle TEXT,

    fecha DATETIME DEFAULT CURRENT_TIMESTAMP,

    usuario_id INTEGER,

    FOREIGN KEY(potencial_id)
        REFERENCES potenciales_clientes(id),

    FOREIGN KEY(usuario_id)
        REFERENCES users(id)

);

`);

console.log("🎯 Módulo Potenciales Clientes inicializado");

console.log(
    "==========================================");
// ==========================================
// MÓDULO SERVICIOS TÉCNICOS
// ==========================================

db.exec(`

-- Clientes de servicios técnicos
CREATE TABLE IF NOT EXISTS servicios_clientes (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    nombre TEXT NOT NULL,
    telefono TEXT,
    email TEXT,

    direccion TEXT,
    localidad TEXT,
    provincia TEXT,

    observaciones TEXT,

    estado TEXT DEFAULT 'activo',

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP

);


-- Órdenes de trabajo
CREATE TABLE IF NOT EXISTS servicios_ordenes (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    cliente_id INTEGER NOT NULL,

    tipo_servicio TEXT NOT NULL,
    -- aire_acondicionado
    -- refrigeracion
    -- calefon
    -- plomeria
    -- otro

    tipo_trabajo TEXT,
    -- instalacion
    -- reparacion
    -- mantenimiento
    -- diagnostico

    equipo TEXT,
    marca TEXT,
    modelo TEXT,

    problema_reportado TEXT,

    diagnostico TEXT,

    trabajo_realizado TEXT,

    estado TEXT DEFAULT 'pendiente',
    -- pendiente
    -- programado
    -- en_camino
    -- en_proceso
    -- terminado
    -- cancelado

    fecha_programada DATETIME,

    fecha_inicio DATETIME,

    fecha_finalizacion DATETIME,

    mano_obra REAL DEFAULT 0,

    costo_repuestos REAL DEFAULT 0,

    total REAL DEFAULT 0,

    monto_cobrado REAL DEFAULT 0,

    observaciones TEXT,

    created_by INTEGER,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY(cliente_id)
        REFERENCES servicios_clientes(id),

    FOREIGN KEY(created_by)
        REFERENCES users(id)

);


-- Repuestos utilizados en cada trabajo
CREATE TABLE IF NOT EXISTS servicios_repuestos_orden (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    orden_id INTEGER NOT NULL,

    descripcion TEXT NOT NULL,

    cantidad REAL DEFAULT 1,

    costo_unitario REAL DEFAULT 0,

    precio_cobrado REAL DEFAULT 0,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY(orden_id)
        REFERENCES servicios_ordenes(id)

);


-- Historial de movimientos de la orden
CREATE TABLE IF NOT EXISTS servicios_historial (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    orden_id INTEGER NOT NULL,

    accion TEXT NOT NULL,

    detalle TEXT,

    usuario_id INTEGER,

    fecha DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY(orden_id)
        REFERENCES servicios_ordenes(id),

    FOREIGN KEY(usuario_id)
        REFERENCES users(id)

);

`);

console.log("🔧 Módulo Servicios Técnicos inicializado");


// =====================================================
// SERVICIOS TÉCNICOS — AMPLIACIÓN OPERATIVA
// =====================================================

// 1. Ampliar datos de las órdenes existentes

agregarColumna("servicios_ordenes", "fecha_solicitud", "DATETIME");
agregarColumna("servicios_ordenes", "direccion_servicio", "TEXT");
agregarColumna("servicios_ordenes", "localidad_servicio", "TEXT");
agregarColumna("servicios_ordenes", "prioridad", "TEXT DEFAULT 'normal'");
agregarColumna("servicios_ordenes", "origen", "TEXT");
agregarColumna("servicios_ordenes", "presupuesto_estimado", "REAL DEFAULT 0");
agregarColumna("servicios_ordenes", "fecha_cierre", "DATETIME");


// 2. Crear tablas operativas

db.exec(`

-- Técnicos
CREATE TABLE IF NOT EXISTS servicios_tecnicos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    apellido TEXT,
    telefono TEXT,
    email TEXT,
    especialidad TEXT,
    modalidad_pago TEXT DEFAULT 'variable',
    valor_hora REAL DEFAULT 0,
    porcentaje REAL DEFAULT 0,
    observaciones TEXT,
    estado TEXT DEFAULT 'activo',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Visitas de cada orden
CREATE TABLE IF NOT EXISTS servicios_visitas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    orden_id INTEGER NOT NULL,
    numero_visita INTEGER NOT NULL,
    fecha_programada DATETIME,
    fecha_inicio DATETIME,
    fecha_fin DATETIME,
    duracion_minutos INTEGER DEFAULT 0,
    estado TEXT DEFAULT 'programada',
    diagnostico TEXT,
    trabajo_realizado TEXT,
    observaciones TEXT,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (orden_id) REFERENCES servicios_ordenes(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    UNIQUE (orden_id, numero_visita)
);

-- Técnicos asignados a cada visita
CREATE TABLE IF NOT EXISTS servicios_visitas_tecnicos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    visita_id INTEGER NOT NULL,
    tecnico_id INTEGER NOT NULL,
    horas_trabajadas REAL DEFAULT 0,
    remuneracion_acordada REAL DEFAULT 0,
    observaciones TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (visita_id) REFERENCES servicios_visitas(id),
    FOREIGN KEY (tecnico_id) REFERENCES servicios_tecnicos(id),
    UNIQUE (visita_id, tecnico_id)
);

-- Pagos recibidos de los clientes
CREATE TABLE IF NOT EXISTS servicios_pagos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    orden_id INTEGER NOT NULL,
    visita_id INTEGER,
    monto REAL NOT NULL,
    fecha_pago DATETIME DEFAULT CURRENT_TIMESTAMP,
    medio_pago TEXT DEFAULT 'efectivo',
    referencia TEXT,
    recibido_por INTEGER,
    observaciones TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (orden_id) REFERENCES servicios_ordenes(id),
    FOREIGN KEY (visita_id) REFERENCES servicios_visitas(id),
    FOREIGN KEY (recibido_por) REFERENCES users(id)
);

-- Gastos asociados a cada trabajo
CREATE TABLE IF NOT EXISTS servicios_gastos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    orden_id INTEGER NOT NULL,
    visita_id INTEGER,
    categoria TEXT NOT NULL,
    descripcion TEXT,
    monto REAL NOT NULL,
    fecha_gasto DATETIME DEFAULT CURRENT_TIMESTAMP,
    pagado_por TEXT,
    usuario_id INTEGER,
    comprobante TEXT,
    observaciones TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (orden_id) REFERENCES servicios_ordenes(id),
    FOREIGN KEY (visita_id) REFERENCES servicios_visitas(id),
    FOREIGN KEY (usuario_id) REFERENCES users(id)
);

-- Índices para agilizar las consultas
CREATE INDEX IF NOT EXISTS idx_servicios_visitas_orden
ON servicios_visitas(orden_id);

CREATE INDEX IF NOT EXISTS idx_servicios_visitas_fecha
ON servicios_visitas(fecha_programada);

CREATE INDEX IF NOT EXISTS idx_servicios_pagos_orden
ON servicios_pagos(orden_id);

CREATE INDEX IF NOT EXISTS idx_servicios_gastos_orden
ON servicios_gastos(orden_id);

CREATE INDEX IF NOT EXISTS idx_servicios_tecnicos_estado
ON servicios_tecnicos(estado);

`);

console.log("✅ Servicios Técnicos: estructura operativa ampliada");

// ==========================================
// SERVICIOS TÉCNICOS — REGISTRO DE VISITAS
// ==========================================

agregarColumna(
    "servicios_visitas",
    "trabajos_adicionales",
    "TEXT"
);

agregarColumna(
    "servicios_visitas",
    "tareas_pendientes",
    "TEXT"
);

console.log("✅ Registro técnico por visita actualizado");

// =====================================================
// SERVICIOS TÉCNICOS — MÓDULO DE PRESUPUESTOS
// =====================================================

db.exec(`

-- Presupuestos generales
CREATE TABLE IF NOT EXISTS servicios_presupuestos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    numero TEXT UNIQUE,

    cliente_id INTEGER,
    orden_id INTEGER,

    fecha_emision DATETIME DEFAULT CURRENT_TIMESTAMP,
    fecha_vencimiento DATETIME,

    estado TEXT DEFAULT 'borrador',

    subtotal REAL DEFAULT 0,
    descuento_tipo TEXT DEFAULT 'importe',
    descuento_valor REAL DEFAULT 0,
    descuento_monto REAL DEFAULT 0,
    impuestos REAL DEFAULT 0,
    total REAL DEFAULT 0,

    condiciones TEXT,
    observaciones TEXT,

    fecha_envio DATETIME,
    fecha_aceptacion DATETIME,
    fecha_rechazo DATETIME,

    created_by INTEGER,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (cliente_id)
        REFERENCES servicios_clientes(id),

    FOREIGN KEY (orden_id)
        REFERENCES servicios_ordenes(id),

    FOREIGN KEY (created_by)
        REFERENCES users(id)
);

-- Detalle de cada presupuesto
CREATE TABLE IF NOT EXISTS servicios_presupuestos_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    presupuesto_id INTEGER NOT NULL,

    tipo TEXT DEFAULT 'servicio',

    descripcion TEXT NOT NULL,

    cantidad REAL DEFAULT 1,

    costo_unitario REAL DEFAULT 0,

    precio_unitario REAL DEFAULT 0,

    subtotal REAL DEFAULT 0,

    observaciones TEXT,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (presupuesto_id)
        REFERENCES servicios_presupuestos(id)
        ON DELETE CASCADE
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_servicios_presupuestos_cliente
ON servicios_presupuestos(cliente_id);

CREATE INDEX IF NOT EXISTS idx_servicios_presupuestos_estado
ON servicios_presupuestos(estado);

CREATE INDEX IF NOT EXISTS idx_servicios_presupuestos_fecha
ON servicios_presupuestos(fecha_emision);

CREATE INDEX IF NOT EXISTS idx_servicios_presupuestos_orden
ON servicios_presupuestos(orden_id);

CREATE INDEX IF NOT EXISTS idx_servicios_presupuestos_items
ON servicios_presupuestos_items(presupuesto_id);

`);

console.log("✅ Servicios Técnicos: módulo de presupuestos inicializado");

// =====================================================
// SERVICIOS TÉCNICOS — ARCHIVOS MULTIMEDIA
// =====================================================

db.exec(`

CREATE TABLE IF NOT EXISTS servicios_archivos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    cliente_id INTEGER,
    orden_id INTEGER,
    visita_id INTEGER,
    presupuesto_id INTEGER,
    compra_id INTEGER,

    tipo TEXT NOT NULL,
    categoria TEXT DEFAULT 'general',

    nombre_original TEXT NOT NULL,
    nombre_guardado TEXT NOT NULL,

    ruta_archivo TEXT NOT NULL,
    tipo_mime TEXT,
    extension TEXT,
    tamano_bytes INTEGER DEFAULT 0,

    descripcion TEXT,
    transcripcion TEXT,

    fecha_archivo DATETIME DEFAULT CURRENT_TIMESTAMP,

    usuario_id INTEGER,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (cliente_id)
        REFERENCES servicios_clientes(id),

    FOREIGN KEY (orden_id)
        REFERENCES servicios_ordenes(id),

    FOREIGN KEY (visita_id)
        REFERENCES servicios_visitas(id),

    FOREIGN KEY (presupuesto_id)
        REFERENCES servicios_presupuestos(id),

    FOREIGN KEY (compra_id)
        REFERENCES servicios_compras(id),

    FOREIGN KEY (usuario_id)
        REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_servicios_archivos_cliente
ON servicios_archivos(cliente_id);

CREATE INDEX IF NOT EXISTS idx_servicios_archivos_orden
ON servicios_archivos(orden_id);

CREATE INDEX IF NOT EXISTS idx_servicios_archivos_visita
ON servicios_archivos(visita_id);

CREATE INDEX IF NOT EXISTS idx_servicios_archivos_presupuesto
ON servicios_archivos(presupuesto_id);

CREATE INDEX IF NOT EXISTS idx_servicios_archivos_compra
ON servicios_archivos(compra_id);

CREATE INDEX IF NOT EXISTS idx_servicios_archivos_tipo
ON servicios_archivos(tipo);

`);

console.log("✅ Servicios Técnicos: archivos multimedia inicializados");

// =====================================================
// SERVICIOS TÉCNICOS — COMPRAS E INVENTARIO
// =====================================================

db.exec(`

CREATE TABLE IF NOT EXISTS servicios_proveedores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    contacto TEXT,
    telefono TEXT,
    email TEXT,
    direccion TEXT,
    localidad TEXT,
    cuit TEXT,
    observaciones TEXT,
    estado TEXT DEFAULT 'activo',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS servicios_inventario (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo TEXT UNIQUE,
    descripcion TEXT NOT NULL,
    categoria TEXT,
    marca TEXT,
    modelo TEXT,
    proveedor_id INTEGER,
    costo_unitario REAL DEFAULT 0,
    precio_venta REAL DEFAULT 0,
    stock_actual REAL DEFAULT 0,
    stock_minimo REAL DEFAULT 0,
    unidad TEXT DEFAULT 'unidad',
    ubicacion TEXT,
    observaciones TEXT,
    estado TEXT DEFAULT 'activo',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (proveedor_id)
        REFERENCES servicios_proveedores(id)
);

CREATE TABLE IF NOT EXISTS servicios_compras (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    numero TEXT UNIQUE,
    proveedor_id INTEGER,
    fecha_compra DATETIME DEFAULT CURRENT_TIMESTAMP,
    tipo_comprobante TEXT,
    numero_comprobante TEXT,
    subtotal REAL DEFAULT 0,
    impuestos REAL DEFAULT 0,
    total REAL DEFAULT 0,
    estado TEXT DEFAULT 'registrada',
    observaciones TEXT,
    usuario_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (proveedor_id)
        REFERENCES servicios_proveedores(id),
    FOREIGN KEY (usuario_id)
        REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS servicios_compras_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    compra_id INTEGER NOT NULL,
    inventario_id INTEGER,
    descripcion TEXT NOT NULL,
    cantidad REAL DEFAULT 1,
    costo_unitario REAL DEFAULT 0,
    subtotal REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (compra_id)
        REFERENCES servicios_compras(id)
        ON DELETE CASCADE,
    FOREIGN KEY (inventario_id)
        REFERENCES servicios_inventario(id)
);

CREATE TABLE IF NOT EXISTS servicios_compras_pagos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    compra_id INTEGER NOT NULL,
    monto REAL NOT NULL,
    fecha_pago DATETIME DEFAULT CURRENT_TIMESTAMP,
    medio_pago TEXT DEFAULT 'efectivo',
    referencia TEXT,
    observaciones TEXT,
    usuario_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (compra_id)
        REFERENCES servicios_compras(id),
    FOREIGN KEY (usuario_id)
        REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS servicios_movimientos_stock (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    inventario_id INTEGER NOT NULL,
    tipo TEXT NOT NULL,
    cantidad REAL NOT NULL,
    costo_unitario REAL DEFAULT 0,
    compra_item_id INTEGER,
    orden_id INTEGER,
    visita_id INTEGER,
    fecha_movimiento DATETIME DEFAULT CURRENT_TIMESTAMP,
    motivo TEXT,
    observaciones TEXT,
    usuario_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (inventario_id)
        REFERENCES servicios_inventario(id),
    FOREIGN KEY (compra_item_id)
        REFERENCES servicios_compras_items(id),
    FOREIGN KEY (orden_id)
        REFERENCES servicios_ordenes(id),
    FOREIGN KEY (visita_id)
        REFERENCES servicios_visitas(id),
    FOREIGN KEY (usuario_id)
        REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_servicios_proveedores_nombre
ON servicios_proveedores(nombre);

CREATE INDEX IF NOT EXISTS idx_servicios_inventario_codigo
ON servicios_inventario(codigo);

CREATE INDEX IF NOT EXISTS idx_servicios_compras_fecha
ON servicios_compras(fecha_compra);

CREATE INDEX IF NOT EXISTS idx_servicios_compras_proveedor
ON servicios_compras(proveedor_id);

CREATE INDEX IF NOT EXISTS idx_servicios_compras_items_compra
ON servicios_compras_items(compra_id);

CREATE INDEX IF NOT EXISTS idx_servicios_movimientos_inventario
ON servicios_movimientos_stock(inventario_id);

CREATE INDEX IF NOT EXISTS idx_servicios_movimientos_orden
ON servicios_movimientos_stock(orden_id);

CREATE INDEX IF NOT EXISTS idx_servicios_compras_pagos
ON servicios_compras_pagos(compra_id);

`);

console.log("✅ Servicios Técnicos: compras e inventario inicializados");

// =====================================================
// SERVICIOS TÉCNICOS — ESTRUCTURA COMPLEMENTARIA FINAL
// =====================================================

// 1. COLUMNAS ADICIONALES PARA RELACIONAR LOS MÓDULOS

agregarColumna(
    "servicios_ordenes",
    "equipo_cliente_id",
    "INTEGER"
);

agregarColumna(
    "servicios_repuestos_orden",
    "inventario_id",
    "INTEGER"
);

agregarColumna(
    "servicios_repuestos_orden",
    "visita_id",
    "INTEGER"
);

agregarColumna(
    "servicios_movimientos_stock",
    "repuesto_orden_id",
    "INTEGER"
);


// 2. ESTRUCTURAS COMPLEMENTARIAS

db.exec(`

-- EQUIPOS DE CADA CLIENTE
CREATE TABLE IF NOT EXISTS servicios_clientes_equipos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_id INTEGER NOT NULL,
    tipo_equipo TEXT NOT NULL,
    marca TEXT,
    modelo TEXT,
    numero_serie TEXT,
    ubicacion TEXT,
    fecha_instalacion DATE,
    observaciones TEXT,
    estado TEXT DEFAULT 'activo',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (cliente_id)
        REFERENCES servicios_clientes(id)
);

-- ARCHIVOS MULTIMEDIA
CREATE TABLE IF NOT EXISTS servicios_archivos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    cliente_id INTEGER,
    orden_id INTEGER,
    visita_id INTEGER,
    presupuesto_id INTEGER,
    compra_id INTEGER,

    tipo TEXT NOT NULL,
    categoria TEXT DEFAULT 'general',

    nombre_original TEXT NOT NULL,
    nombre_guardado TEXT NOT NULL,

    ruta_archivo TEXT NOT NULL,
    tipo_mime TEXT,
    extension TEXT,
    tamano_bytes INTEGER DEFAULT 0,

    descripcion TEXT,
    transcripcion TEXT,

    fecha_archivo DATETIME DEFAULT CURRENT_TIMESTAMP,
    usuario_id INTEGER,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (cliente_id)
        REFERENCES servicios_clientes(id),

    FOREIGN KEY (orden_id)
        REFERENCES servicios_ordenes(id),

    FOREIGN KEY (visita_id)
        REFERENCES servicios_visitas(id),

    FOREIGN KEY (presupuesto_id)
        REFERENCES servicios_presupuestos(id),

    FOREIGN KEY (compra_id)
        REFERENCES servicios_compras(id),

    FOREIGN KEY (usuario_id)
        REFERENCES users(id)
);

-- LIQUIDACIONES DE TÉCNICOS
CREATE TABLE IF NOT EXISTS servicios_liquidaciones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    tecnico_id INTEGER NOT NULL,

    periodo_desde DATE,
    periodo_hasta DATE,

    fecha_liquidacion DATETIME DEFAULT CURRENT_TIMESTAMP,

    total_devengado REAL DEFAULT 0,
    total_adelantos REAL DEFAULT 0,
    total_pagado REAL DEFAULT 0,
    saldo_pendiente REAL DEFAULT 0,

    estado TEXT DEFAULT 'pendiente',
    observaciones TEXT,

    usuario_id INTEGER,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (tecnico_id)
        REFERENCES servicios_tecnicos(id),

    FOREIGN KEY (usuario_id)
        REFERENCES users(id)
);

-- DETALLE DE LAS LIQUIDACIONES
CREATE TABLE IF NOT EXISTS servicios_liquidaciones_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    liquidacion_id INTEGER NOT NULL,
    visita_tecnico_id INTEGER,

    concepto TEXT NOT NULL,

    horas REAL DEFAULT 0,
    importe REAL DEFAULT 0,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (liquidacion_id)
        REFERENCES servicios_liquidaciones(id)
        ON DELETE CASCADE,

    FOREIGN KEY (visita_tecnico_id)
        REFERENCES servicios_visitas_tecnicos(id)
);

-- PAGOS Y ADELANTOS A TÉCNICOS
CREATE TABLE IF NOT EXISTS servicios_tecnicos_pagos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    tecnico_id INTEGER NOT NULL,
    liquidacion_id INTEGER,

    tipo TEXT DEFAULT 'pago',

    monto REAL NOT NULL,

    fecha_pago DATETIME DEFAULT CURRENT_TIMESTAMP,

    medio_pago TEXT DEFAULT 'efectivo',
    referencia TEXT,

    observaciones TEXT,
    usuario_id INTEGER,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (tecnico_id)
        REFERENCES servicios_tecnicos(id),

    FOREIGN KEY (liquidacion_id)
        REFERENCES servicios_liquidaciones(id),

    FOREIGN KEY (usuario_id)
        REFERENCES users(id)
);

-- MOVIMIENTOS DE CAJA
CREATE TABLE IF NOT EXISTS servicios_caja_movimientos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    tipo TEXT NOT NULL,
    categoria TEXT NOT NULL,

    origen_tipo TEXT,
    origen_id INTEGER,

    orden_id INTEGER,

    descripcion TEXT,

    monto REAL NOT NULL,

    medio_pago TEXT DEFAULT 'efectivo',
    cuenta TEXT DEFAULT 'caja_general',

    fecha_movimiento DATETIME DEFAULT CURRENT_TIMESTAMP,

    referencia TEXT,
    observaciones TEXT,

    usuario_id INTEGER,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (orden_id)
        REFERENCES servicios_ordenes(id),

    FOREIGN KEY (usuario_id)
        REFERENCES users(id),

    UNIQUE (origen_tipo, origen_id)
);

-- ÍNDICES

CREATE INDEX IF NOT EXISTS idx_servicios_equipos_cliente
ON servicios_clientes_equipos(cliente_id);

CREATE INDEX IF NOT EXISTS idx_servicios_archivos_cliente
ON servicios_archivos(cliente_id);

CREATE INDEX IF NOT EXISTS idx_servicios_archivos_orden
ON servicios_archivos(orden_id);

CREATE INDEX IF NOT EXISTS idx_servicios_archivos_visita
ON servicios_archivos(visita_id);

CREATE INDEX IF NOT EXISTS idx_servicios_archivos_compra
ON servicios_archivos(compra_id);

CREATE INDEX IF NOT EXISTS idx_servicios_liquidaciones_tecnico
ON servicios_liquidaciones(tecnico_id);

CREATE INDEX IF NOT EXISTS idx_servicios_liquidaciones_periodo
ON servicios_liquidaciones(periodo_desde, periodo_hasta);

CREATE INDEX IF NOT EXISTS idx_servicios_liquidaciones_items
ON servicios_liquidaciones_items(liquidacion_id);

CREATE INDEX IF NOT EXISTS idx_servicios_tecnicos_pagos
ON servicios_tecnicos_pagos(tecnico_id);

CREATE INDEX IF NOT EXISTS idx_servicios_caja_fecha
ON servicios_caja_movimientos(fecha_movimiento);

CREATE INDEX IF NOT EXISTS idx_servicios_caja_tipo
ON servicios_caja_movimientos(tipo);

CREATE INDEX IF NOT EXISTS idx_servicios_caja_orden
ON servicios_caja_movimientos(orden_id);

CREATE INDEX IF NOT EXISTS idx_servicios_repuestos_inventario
ON servicios_repuestos_orden(inventario_id);

CREATE INDEX IF NOT EXISTS idx_servicios_repuestos_visita
ON servicios_repuestos_orden(visita_id);

`);

console.log("✅ Servicios Técnicos: estructura complementaria inicializada");