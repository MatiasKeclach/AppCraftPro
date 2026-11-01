const db = require("./db");

const columnas = [
    ["tipo_inmueble", "TEXT DEFAULT 'casa'"],
    ["altura", "TEXT"],
    ["torre", "TEXT"],
    ["piso", "TEXT"],
    ["departamento", "TEXT"],
    ["unidad", "TEXT"]
];

const existentes = db.prepare(
    "PRAGMA table_info(servicios_domicilios)"
).all().map(c => c.name);

const migrar = db.transaction(() => {
    for (const [nombre, definicion] of columnas) {
        if (!existentes.includes(nombre)) {
            db.exec(`
                ALTER TABLE servicios_domicilios
                ADD COLUMN ${nombre} ${definicion}
            `);

            console.log(`✔ Domicilios: agregada columna ${nombre}`);
        }
    }
});

try {
    migrar();
    console.log("✔ Campos adicionales de domicilios preparados.");
} catch (error) {
    console.error("Error en migración de domicilios:", error);
    throw error;
}