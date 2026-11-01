const db = require("./db");

function tablaExiste(tabla) {
    return !!db.prepare(`
        SELECT name
        FROM sqlite_master
        WHERE type = 'table' AND name = ?
    `).get(tabla);
}

function columnaExiste(tabla, columna) {
    if (!tablaExiste(tabla)) return false;

    return db.prepare(`PRAGMA table_info(${tabla})`)
        .all()
        .some(c => c.name === columna);
}

function agregarColumna(tabla, columna, definicion) {
    if (tablaExiste(tabla) && !columnaExiste(tabla, columna)) {
        db.exec(`
            ALTER TABLE ${tabla}
            ADD COLUMN ${columna} ${definicion}
        `);

        console.log(`✔ Agregada ${tabla}.${columna}`);
    }
}

const migrar = db.transaction(() => {

    // =====================================
    // DOMICILIOS DE LOS CLIENTES
    // =====================================

    db.exec(`
        CREATE TABLE IF NOT EXISTS servicios_domicilios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,

            cliente_id INTEGER NOT NULL,

            alias TEXT,
            direccion TEXT NOT NULL,
            localidad TEXT,
            provincia TEXT,

            referencia TEXT,
            entre_calles TEXT,

            latitud REAL,
            longitud REAL,

            observaciones TEXT,

            estado TEXT DEFAULT 'activo',

            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

            FOREIGN KEY (cliente_id)
                REFERENCES servicios_clientes(id)
                ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS
            idx_domicilios_cliente
        ON servicios_domicilios(cliente_id);
    `);

    // =====================================
    // RELACIONAR ÓRDENES CON DOMICILIOS
    // =====================================

    agregarColumna(
        "servicios_ordenes",
        "domicilio_id",
        "INTEGER REFERENCES servicios_domicilios(id) ON DELETE SET NULL"
    );

    // =====================================
    // RELACIONAR VISITAS CON DOMICILIOS
    // =====================================

    agregarColumna(
        "servicios_visitas",
        "domicilio_id",
        "INTEGER REFERENCES servicios_domicilios(id) ON DELETE SET NULL"
    );

    // =====================================
    // IMPORTAR DOMICILIOS QUE YA EXISTEN
    // EN LA FICHA DE LOS CLIENTES
    // =====================================

    if (
        tablaExiste("servicios_clientes") &&
        columnaExiste("servicios_clientes", "direccion")
    ) {
        db.exec(`
            INSERT INTO servicios_domicilios (
                cliente_id,
                direccion,
                localidad,
                provincia,
                observaciones
            )
            SELECT
                c.id,
                TRIM(c.direccion),
                c.localidad,
                c.provincia,
                'Domicilio importado de la ficha del cliente'
            FROM servicios_clientes c
            WHERE
                c.direccion IS NOT NULL
                AND TRIM(c.direccion) <> ''
                AND NOT EXISTS (
                    SELECT 1
                    FROM servicios_domicilios d
                    WHERE
                        d.cliente_id = c.id
                        AND LOWER(TRIM(d.direccion)) =
                            LOWER(TRIM(c.direccion))
                        AND LOWER(TRIM(COALESCE(d.localidad, ''))) =
                            LOWER(TRIM(COALESCE(c.localidad, '')))
                );
        `);
    }

    // =====================================
    // VINCULAR ÓRDENES ANTIGUAS
    // CON EL DOMICILIO CORRESPONDIENTE
    // =====================================

    if (
        tablaExiste("servicios_ordenes") &&
        columnaExiste("servicios_ordenes", "direccion_servicio")
    ) {
        db.exec(`
            UPDATE servicios_ordenes
            SET domicilio_id = (
                SELECT d.id
                FROM servicios_domicilios d
                WHERE
                    d.cliente_id = servicios_ordenes.cliente_id
                    AND LOWER(TRIM(d.direccion)) =
                        LOWER(TRIM(servicios_ordenes.direccion_servicio))
                LIMIT 1
            )
            WHERE
                domicilio_id IS NULL
                AND direccion_servicio IS NOT NULL
                AND TRIM(direccion_servicio) <> '';
        `);
    }

    // =====================================
    // VINCULAR VISITAS ANTIGUAS
    // A TRAVÉS DE SU ORDEN
    // =====================================

    db.exec(`
        UPDATE servicios_visitas
        SET domicilio_id = (
            SELECT o.domicilio_id
            FROM servicios_ordenes o
            WHERE o.id = servicios_visitas.orden_id
        )
        WHERE domicilio_id IS NULL;
    `);
});

try {
    migrar();
    console.log("✔ Migración de domicilios completada.");
} catch (error) {
    console.error("❌ Error migrando domicilios:", error);
    throw error;
}