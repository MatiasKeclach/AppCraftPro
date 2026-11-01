const db = require("../models/db");
const fs = require("fs");
const path = require("path");

async function migrar() {
    try {
        console.log("\n======================================");
        console.log(" MIGRACIÓN - SERVICIOS TÉCNICOS");
        console.log("======================================\n");

        // 1. Crear copia de seguridad
        const carpetaBackup = path.join(
            __dirname,
            "../database/backups"
        );

        fs.mkdirSync(carpetaBackup, { recursive: true });

        const fecha = new Date()
            .toISOString()
            .replace(/[:.]/g, "-");

        const backupPath = path.join(
            carpetaBackup,
            `appcraftpro-${fecha}.db`
        );

        await db.backup(backupPath);

        console.log("OK - Copia de seguridad creada:");
        console.log(backupPath);

        // 2. Comprobar columnas existentes
        function tieneColumna(tabla, columna) {
            return db.prepare(
                `PRAGMA table_info("${tabla}")`
            ).all().some(c => c.name === columna);
        }

        // 3. Ejecutar modificaciones
        const ejecutarMigracion = db.transaction(() => {

            // Archivos asociados directamente a trabajos
            if (!tieneColumna("servicios_archivos", "trabajo_id")) {
                db.exec(`
                    ALTER TABLE servicios_archivos
                    ADD COLUMN trabajo_id INTEGER
                    REFERENCES servicios_trabajos(id)
                    ON DELETE SET NULL
                `);

                console.log("OK - Columna trabajo_id agregada a archivos");
            } else {
                console.log("INFO - archivos.trabajo_id ya existe");
            }

            // Índice de archivos por trabajo
            db.exec(`
                CREATE INDEX IF NOT EXISTS
                idx_servicios_archivos_trabajo
                ON servicios_archivos(trabajo_id)
            `);

            // Relación entre técnicos, trabajos y visitas
            db.exec(`
                CREATE TABLE IF NOT EXISTS
                servicios_visitas_trabajos_tecnicos (

                    id INTEGER PRIMARY KEY AUTOINCREMENT,

                    visita_id INTEGER NOT NULL,
                    trabajo_id INTEGER NOT NULL,
                    tecnico_id INTEGER NOT NULL,

                    fecha_entrada DATETIME,
                    fecha_salida DATETIME,

                    horas_trabajadas REAL DEFAULT 0,

                    remuneracion_acordada REAL DEFAULT 0,

                    observaciones TEXT,

                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

                    FOREIGN KEY (visita_id)
                        REFERENCES servicios_visitas(id)
                        ON DELETE CASCADE,

                    FOREIGN KEY (trabajo_id)
                        REFERENCES servicios_trabajos(id)
                        ON DELETE CASCADE,

                    FOREIGN KEY (tecnico_id)
                        REFERENCES servicios_tecnicos(id),

                    UNIQUE (visita_id, trabajo_id, tecnico_id)
                )
            `);

            // Índices
            db.exec(`
                CREATE INDEX IF NOT EXISTS
                idx_visitas_trabajos_tecnicos_visita
                ON servicios_visitas_trabajos_tecnicos(visita_id)
            `);

            db.exec(`
                CREATE INDEX IF NOT EXISTS
                idx_visitas_trabajos_tecnicos_trabajo
                ON servicios_visitas_trabajos_tecnicos(trabajo_id)
            `);

            db.exec(`
                CREATE INDEX IF NOT EXISTS
                idx_visitas_trabajos_tecnicos_tecnico
                ON servicios_visitas_trabajos_tecnicos(tecnico_id)
            `);
        });

        ejecutarMigracion();

        // 4. Comprobar integridad
        const errores = db.pragma("foreign_key_check");

        console.log("\n======================================");

        if (errores.length > 0) {
            console.error("ATENCIÓN: Se encontraron errores de claves foráneas:");
            console.table(errores);
        } else {
            console.log("OK - Integridad referencial correcta");
        }

        console.log("======================================");
        console.log("\nMIGRACIÓN FINALIZADA");

    } catch (error) {
        console.error("\nERROR EN LA MIGRACIÓN:");
        console.error(error);
        process.exitCode = 1;

    } finally {
        db.close();
    }
}

migrar();