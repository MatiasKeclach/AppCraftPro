const express = require("express");
const router = express.Router();
const db = require("../models/db");

// ========================================
// UTILIDADES
// ========================================

function obtenerClientes() {
    return db.prepare(`
        SELECT id, nombre, telefono, email
        FROM servicios_clientes
        WHERE estado = 'activo' OR estado IS NULL
        ORDER BY nombre COLLATE NOCASE
    `).all();
}

function obtenerDomicilio(id) {
    return db.prepare(`
        SELECT
            d.*,
            c.nombre AS cliente_nombre,
            c.telefono AS cliente_telefono,
            c.email AS cliente_email
        FROM servicios_domicilios d
        INNER JOIN servicios_clientes c
            ON c.id = d.cliente_id
        WHERE d.id = ?
    `).get(id);
}

function validarDomicilio(datos) {
    return {
        cliente_id: Number(datos.cliente_id),
        alias: datos.alias?.trim() || "",
        tipo_inmueble: datos.tipo_inmueble || "casa",
        direccion: datos.direccion?.trim() || "",
        altura: datos.altura?.trim() || "",
        torre: datos.torre?.trim() || "",
        piso: datos.piso?.trim() || "",
        departamento: datos.departamento?.trim() || "",
        unidad: datos.unidad?.trim() || "",
        localidad: datos.localidad?.trim() || "",
        provincia: datos.provincia?.trim() || "",
        entre_calles: datos.entre_calles?.trim() || "",
        referencia: datos.referencia?.trim() || "",
        observaciones: datos.observaciones?.trim() || ""
    };
}

function validarDatos(datos) {
    if (!datos.cliente_id || !Number.isInteger(datos.cliente_id)) {
        return "Seleccioná un cliente válido.";
    }

    if (!datos.direccion) {
        return "La calle o dirección es obligatoria.";
    }

    return null;
}

// ========================================
// LISTADO DE DOMICILIOS
// GET /
// ========================================

router.get("/", (req, res) => {
    try {
        const busqueda = (req.query.buscar || "").trim();

        let domicilios;

        if (busqueda) {
            const termino = `%${busqueda}%`;

            domicilios = db.prepare(`
                SELECT
                    d.*,
                    c.nombre AS cliente_nombre,
                    c.telefono AS cliente_telefono
                FROM servicios_domicilios d
                INNER JOIN servicios_clientes c
                    ON c.id = d.cliente_id
                WHERE
                    c.nombre LIKE ?
                    OR c.telefono LIKE ?
                    OR d.direccion LIKE ?
                    OR d.altura LIKE ?
                    OR d.localidad LIKE ?
                    OR d.departamento LIKE ?
                    OR d.alias LIKE ?
                ORDER BY d.created_at DESC, d.id DESC
            `).all(
                termino, termino, termino, termino,
                termino, termino, termino
            );
        } else {
            domicilios = db.prepare(`
                SELECT
                    d.*,
                    c.nombre AS cliente_nombre,
                    c.telefono AS cliente_telefono
                FROM servicios_domicilios d
                INNER JOIN servicios_clientes c
                    ON c.id = d.cliente_id
                WHERE d.estado = 'activo'
                ORDER BY d.created_at DESC, d.id DESC
            `).all();
        }

        res.render("servicios-tecnicos/domicilios/index", {
            domicilios,
            buscar: busqueda
        });

    } catch (error) {
        console.error("Error listando domicilios:", error);
        res.status(500).send("No se pudieron cargar los domicilios.");
    }
});

// ========================================
// NUEVO DOMICILIO
// ========================================

router.get("/nuevo", (req, res) => {
    res.render("servicios-tecnicos/domicilios/form", {
        domicilio: {},
        clientes: obtenerClientes(),
        modo: "nuevo",
        error: null
    });
});

router.post("/nuevo", (req, res) => {
    try {
        const datos = validarDomicilio(req.body);
        const error = validarDatos(datos);

        if (error) {
            return res.status(400).render(
                "servicios-tecnicos/domicilios/form",
                {
                    domicilio: req.body,
                    clientes: obtenerClientes(),
                    modo: "nuevo",
                    error
                }
            );
        }

        const resultado = db.prepare(`
            INSERT INTO servicios_domicilios (
                cliente_id,
                alias,
                tipo_inmueble,
                direccion,
                altura,
                torre,
                piso,
                departamento,
                unidad,
                localidad,
                provincia,
                entre_calles,
                referencia,
                observaciones,
                estado,
                created_at,
                updated_at
            ) VALUES (
                @cliente_id,
                @alias,
                @tipo_inmueble,
                @direccion,
                @altura,
                @torre,
                @piso,
                @departamento,
                @unidad,
                @localidad,
                @provincia,
                @entre_calles,
                @referencia,
                @observaciones,
                'activo',
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP
            )
        `).run(datos);

        res.redirect(
            `/panel/servicios-tecnicos/domicilios/${resultado.lastInsertRowid}`
        );

    } catch (error) {
        console.error("Error creando domicilio:", error);
        res.status(500).send("No se pudo crear el domicilio.");
    }
});

// ========================================
// DETALLE DEL DOMICILIO
// ========================================

router.get("/:id", (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).send("Identificador inválido.");
        }

        const domicilio = obtenerDomicilio(id);

        if (!domicilio) {
            return res.status(404).send("Domicilio no encontrado.");
        }

        const ordenes = db.prepare(`
            SELECT *
            FROM servicios_ordenes
            WHERE domicilio_id = ?
            ORDER BY created_at DESC
        `).all(id);

        const visitas = db.prepare(`
            SELECT
                v.*,
                o.tipo_servicio,
                o.tipo_trabajo,
                o.estado AS estado_orden
            FROM servicios_visitas v
            LEFT JOIN servicios_ordenes o
                ON o.id = v.orden_id
            WHERE v.domicilio_id = ?
            ORDER BY
                COALESCE(v.fecha_programada, v.created_at) DESC
        `).all(id);

        res.render("servicios-tecnicos/domicilios/detalle", {
            domicilio,
            ordenes,
            visitas
        });

    } catch (error) {
        console.error("Error consultando domicilio:", error);
        res.status(500).send("No se pudo consultar el domicilio.");
    }
});

// ========================================
// EDITAR DOMICILIO
// ========================================

router.get("/:id/editar", (req, res) => {
    const domicilio = obtenerDomicilio(Number(req.params.id));

    if (!domicilio) {
        return res.status(404).send("Domicilio no encontrado.");
    }

    res.render("servicios-tecnicos/domicilios/form", {
        domicilio,
        clientes: obtenerClientes(),
        modo: "editar",
        error: null
    });
});

router.post("/:id/editar", (req, res) => {
    try {
        const id = Number(req.params.id);
        const actual = obtenerDomicilio(id);

        if (!actual) {
            return res.status(404).send("Domicilio no encontrado.");
        }

        const datos = validarDomicilio(req.body);
        const error = validarDatos(datos);

        if (error) {
            return res.status(400).render(
                "servicios-tecnicos/domicilios/form",
                {
                    domicilio: { ...req.body, id },
                    clientes: obtenerClientes(),
                    modo: "editar",
                    error
                }
            );
        }

        db.prepare(`
            UPDATE servicios_domicilios
            SET
                cliente_id = @cliente_id,
                alias = @alias,
                tipo_inmueble = @tipo_inmueble,
                direccion = @direccion,
                altura = @altura,
                torre = @torre,
                piso = @piso,
                departamento = @departamento,
                unidad = @unidad,
                localidad = @localidad,
                provincia = @provincia,
                entre_calles = @entre_calles,
                referencia = @referencia,
                observaciones = @observaciones,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = @id
        `).run({ ...datos, id });

        res.redirect(
            `/panel/servicios-tecnicos/domicilios/${id}`
        );

    } catch (error) {
        console.error("Error actualizando domicilio:", error);
        res.status(500).send("No se pudo actualizar el domicilio.");
    }
});

module.exports = router;