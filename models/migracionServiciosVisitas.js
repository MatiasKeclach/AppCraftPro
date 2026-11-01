const db = require("./db");

// Comprueba si existe una tabla
function tablaExiste(nombre) {
    return !!db.prepare(`
        SELECT name
        FROM sqlite_master
        WHERE type = 'table' AND name = ?
    `).get(nombre);
}

// Comprueba si existe una columna
function columnaExiste(tabla, columna) {
    if (!tablaExiste(tabla)) return false;

    const columnas = db.prepare(`PRAGMA table_info(${tabla})`).all();

    return columnas.some(c => c.name === columna);
}

// Agrega una columna solamente si todavía no existe
function agregarColumna(tabla, columna, definicion) {
    if (tablaExiste(tabla) && !columnaExiste(tabla, columna)) {
        db.exec(`
            ALTER TABLE ${tabla}
            ADD COLUMN ${columna} ${definicion}
        `);

        console.log(`✔ Columna agregada: ${tabla}.${columna}`);
    }
}

const migrar = db.transaction(() => {

    // ==========================================
    // TRABAJOS INDIVIDUALES DE CADA ORDEN
    // ==========================================

    db.exec(`
        CREATE TABLE IF NOT EXISTS servicios_trabajos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,

            orden_id INTEGER NOT NULL,
            visita_origen_id INTEGER,

            rubro TEXT NOT NULL DEFAULT 'general',
            titulo TEXT NOT NULL,
            descripcion TEXT,

            equipo TEXT,
            marca TEXT,
            modelo TEXT,

            diagnostico TEXT,
            trabajo_realizado TEXT,

            estado TEXT NOT NULL DEFAULT 'pendiente',

            prioridad TEXT DEFAULT 'normal',

            mano_obra REAL DEFAULT 0,
            costo_repuestos REAL DEFAULT 0,
            total REAL DEFAULT 0,
            monto_cobrado REAL DEFAULT 0,

            fecha_inicio DATETIME,
            fecha_finalizacion DATETIME,

            observaciones TEXT,

            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

            FOREIGN KEY (orden_id)
                REFERENCES servicios_ordenes(id)
                ON DELETE CASCADE,

            FOREIGN KEY (visita_origen_id)
                REFERENCES servicios_visitas(id)
                ON DELETE SET NULL
        );

        CREATE INDEX IF NOT EXISTS
            idx_servicios_trabajos_orden
        ON servicios_trabajos(orden_id);

        CREATE INDEX IF NOT EXISTS
            idx_servicios_trabajos_estado
        ON servicios_trabajos(estado);
    `);

    // ==========================================
    // RELACIÓN ENTRE VISITAS Y TRABAJOS
    // Un trabajo puede tener varias visitas.
    // Una visita puede resolver varios trabajos.
    // ==========================================

    db.exec(`
        CREATE TABLE IF NOT EXISTS servicios_visitas_trabajos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,

            visita_id INTEGER NOT NULL,
            trabajo_id INTEGER NOT NULL,

            estado TEXT DEFAULT 'pendiente',

            notas TEXT,

            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

            FOREIGN KEY (visita_id)
                REFERENCES servicios_visitas(id)
                ON DELETE CASCADE,

            FOREIGN KEY (trabajo_id)
                REFERENCES servicios_trabajos(id)
                ON DELETE CASCADE,

            UNIQUE (visita_id, trabajo_id)
        );

        CREATE INDEX IF NOT EXISTS
            idx_visitas_trabajos_visita
        ON servicios_visitas_trabajos(visita_id);

        CREATE INDEX IF NOT EXISTS
            idx_visitas_trabajos_trabajo
        ON servicios_visitas_trabajos(trabajo_id);
    `);

    // ==========================================
    // RELACIONAR REPUESTOS CON TRABAJOS
    // ==========================================

    agregarColumna(
        "servicios_repuestos_orden",
        "trabajo_id",
        "INTEGER REFERENCES servicios_trabajos(id) ON DELETE SET NULL"
    );

    // ==========================================
    // RELACIONAR PAGOS CON TRABAJOS
    // ==========================================

    agregarColumna(
        "servicios_pagos",
        "trabajo_id",
        "INTEGER REFERENCES servicios_trabajos(id) ON DELETE SET NULL"
    );

    // ==========================================
    // RELACIONAR GASTOS CON TRABAJOS
    // ==========================================

    agregarColumna(
        "servicios_gastos",
        "trabajo_id",
        "INTEGER REFERENCES servicios_trabajos(id) ON DELETE SET NULL"
    );

    // ==========================================
    // ÍNDICES FINANCIEROS
    // ==========================================

    db.exec(`
        CREATE INDEX IF NOT EXISTS
            idx_pagos_trabajo
        ON servicios_pagos(trabajo_id);

        CREATE INDEX IF NOT EXISTS
            idx_gastos_trabajo
        ON servicios_gastos(trabajo_id);

        CREATE INDEX IF NOT EXISTS
            idx_repuestos_trabajo
        ON servicios_repuestos_orden(trabajo_id);
    `);
});

try {
    migrar();
    console.log("✔ Migración de servicios y visitas completada.");
} catch (error) {
    console.error("❌ Error en migración de servicios:", error);
    throw error;
}