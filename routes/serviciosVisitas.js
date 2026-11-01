
const express = require("express");
const router = express.Router();
const db = require("../models/db");

// =====================================================
// UTILIDADES
// =====================================================

function usuarioActual(req) {
    const u = req.session?.user || {};

    return {
        user: u,
        username: u.username || u.nombre || u.email || "Usuario",
        role: u.role || u.rol || "usuario"
    };
}

function obtenerClientes() {
    return db.prepare(`
        SELECT id, nombre, telefono, direccion, localidad
        FROM servicios_clientes
        WHERE estado = 'activo' OR estado IS NULL
        ORDER BY nombre COLLATE NOCASE
    `).all();
}

function obtenerDomicilios() {
    return db.prepare(`
        SELECT
            id,
            cliente_id,
            alias,
            direccion,
            localidad,
            provincia,
            referencia,
            entre_calles
        FROM servicios_domicilios
        WHERE estado = 'activo'
        ORDER BY direccion ASC
    `).all();
}

function obtenerVisita(id) {
    return db.prepare(`
        SELECT
            v.*,

            o.id AS orden_id,
            o.cliente_id,
            o.tipo_servicio,
            o.tipo_trabajo,
            o.problema_reportado,
            o.diagnostico AS diagnostico_orden,
            o.trabajo_realizado AS trabajo_orden,
            o.estado AS estado_orden,
            o.prioridad,
            o.direccion_servicio,
            o.localidad_servicio,
            o.total,
            o.monto_cobrado,

            c.nombre AS cliente_nombre,
            c.telefono AS cliente_telefono,
            c.email AS cliente_email,

            d.alias AS domicilio_alias,
            d.referencia AS domicilio_referencia,
            d.entre_calles

        FROM servicios_visitas v

        INNER JOIN servicios_ordenes o
            ON o.id = v.orden_id

        INNER JOIN servicios_clientes c
            ON c.id = o.cliente_id

        LEFT JOIN servicios_domicilios d
            ON d.id = v.domicilio_id

        WHERE v.id = ?
    `).get(id);
}

function validarDomicilio(clienteId, domicilioId) {
    if (!domicilioId) return null;

    return db.prepare(`
        SELECT *
        FROM servicios_domicilios
        WHERE id = ?
          AND cliente_id = ?
          AND estado = 'activo'
    `).get(domicilioId, clienteId);
}

function fechaLocalActual() {
    const fecha = new Date();

    fecha.setMinutes(
        fecha.getMinutes() - fecha.getTimezoneOffset()
    );

    return fecha.toISOString().slice(0, 16);
}

function fechaValida(fecha) {
    if (!fecha) return false;

    return !Number.isNaN(new Date(fecha).getTime());
}

function estadoValido(estado) {
    return [
        "programada",
        "en_curso",
        "realizada",
        "seguimiento",
        "cancelada"
    ].includes(estado);
}

// =====================================================
// AGENDA DE VISITAS
// GET /
// =====================================================

router.get("/", (req, res) => {
    try {
        const { username, role, user } = usuarioActual(req);

        const buscar = (req.query.buscar || "").trim();
        const estado = (req.query.estado || "").trim();
        const fecha = (req.query.fecha || "").trim();

        let sql = `
            SELECT
                v.id AS visita_id,
                v.numero_visita,
                v.fecha_programada,
                v.fecha_inicio,
                v.fecha_fin,
                v.estado AS estado_visita,
                v.observaciones,

                o.id AS orden_id,
                o.tipo_servicio,
                o.problema_reportado,
                o.estado AS estado_orden,
                o.prioridad,
                o.direccion_servicio,
                o.localidad_servicio,

                c.id AS cliente_id,
                c.nombre AS cliente_nombre,
                c.telefono AS cliente_telefono

            FROM servicios_visitas v

            INNER JOIN servicios_ordenes o
                ON o.id = v.orden_id

            INNER JOIN servicios_clientes c
                ON c.id = o.cliente_id

            WHERE 1 = 1
        `;

        const params = [];

        if (buscar) {
            sql += `
                AND (
                    c.nombre LIKE ?
                    OR c.telefono LIKE ?
                    OR o.tipo_servicio LIKE ?
                    OR o.direccion_servicio LIKE ?
                    OR o.problema_reportado LIKE ?
                )
            `;

            const termino = `%${buscar}%`;

            params.push(
                termino,
                termino,
                termino,
                termino,
                termino
            );
        }

        if (estado && estadoValido(estado)) {
            sql += ` AND v.estado = ? `;
            params.push(estado);
        }

        if (fecha) {
            sql += `
                AND DATE(v.fecha_programada) = DATE(?)
            `;
            params.push(fecha);
        }

        sql += `
            ORDER BY
                CASE
                    WHEN v.estado = 'en_curso' THEN 0
                    WHEN v.estado = 'programada' THEN 1
                    WHEN v.estado = 'seguimiento' THEN 2
                    WHEN v.estado = 'realizada' THEN 3
                    ELSE 4
                END,
                v.fecha_programada ASC,
                v.id DESC
        `;

        const visitas = db.prepare(sql).all(...params);

        const resumen = db.prepare(`
            SELECT
                COUNT(*) AS total,

                SUM(CASE WHEN estado = 'programada'
                    THEN 1 ELSE 0 END) AS programadas,

                SUM(CASE WHEN estado = 'en_curso'
                    THEN 1 ELSE 0 END) AS en_curso,

                SUM(CASE WHEN estado = 'realizada'
                    THEN 1 ELSE 0 END) AS realizadas,

                SUM(CASE WHEN estado = 'seguimiento'
                    THEN 1 ELSE 0 END) AS seguimiento,

                SUM(CASE WHEN estado = 'cancelada'
                    THEN 1 ELSE 0 END) AS canceladas

            FROM servicios_visitas
        `).get();

        res.render("servicios-tecnicos/visitas/index", {
            visitas,
            resumen,
            buscar,
            estado,
            fecha,
            username,
            role,
            user
        });

    } catch (error) {
        console.error("Error cargando agenda:", error);
        res.status(500).send("No se pudo cargar la agenda de visitas.");
    }
});

// =====================================================
// NUEVA VISITA
// GET /nueva
// =====================================================

router.get("/nueva", (req, res) => {
    try {
        const { username, role, user } = usuarioActual(req);

        res.render("servicios-tecnicos/visitas/nueva", {
            clientes: obtenerClientes(),
            domicilios: obtenerDomicilios(),
            username,
            role,
            user,
            error: null
        });

    } catch (error) {
        console.error("Error abriendo nueva visita:", error);
        res.status(500).send("No se pudo abrir el formulario.");
    }
});

// =====================================================
// CREAR ORDEN Y PRIMERA VISITA
// POST /nueva
// =====================================================

router.post("/nueva", (req, res) => {
    try {
        const {
            cliente_id,
            domicilio_id,
            fecha_programada,
            tipo_servicio,
            problema_reportado,
            prioridad,
            direccion_servicio,
            localidad_servicio,
            observaciones,
            guardar_domicilio
        } = req.body;

        const clienteId = Number(cliente_id);

        if (!Number.isInteger(clienteId) || clienteId <= 0) {
            return res.status(400).send("Seleccioná un cliente válido.");
        }

        const cliente = db.prepare(`
            SELECT *
            FROM servicios_clientes
            WHERE id = ?
        `).get(clienteId);

        if (!cliente) {
            return res.status(404).send("Cliente no encontrado.");
        }

        if (!tipo_servicio || !problema_reportado?.trim()) {
            return res.status(400).send(
                "Completá el tipo de servicio y el problema informado."
            );
        }

        const fecha = fecha_programada || fechaLocalActual();

        if (!fechaValida(fecha)) {
            return res.status(400).send("La fecha de visita no es válida.");
        }

        const domicilioId = domicilio_id
            ? Number(domicilio_id)
            : null;

        let domicilio = null;

        if (domicilioId) {
            domicilio = validarDomicilio(clienteId, domicilioId);

            if (!domicilio) {
                return res.status(400).send(
                    "El domicilio seleccionado no pertenece al cliente."
                );
            }
        }

        const direccion =
            direccion_servicio?.trim() ||
            domicilio?.direccion ||
            cliente.direccion ||
            null;

        const localidad =
            localidad_servicio?.trim() ||
            domicilio?.localidad ||
            cliente.localidad ||
            null;

        const usuario = req.session?.user || {};

        const resultado = db.transaction(() => {

            let nuevoDomicilioId = domicilioId;

            if (
                guardar_domicilio === "1" &&
                direccion &&
                !domicilioId
            ) {
                const existe = db.prepare(`
                    SELECT id
                    FROM servicios_domicilios
                    WHERE cliente_id = ?
                      AND LOWER(TRIM(direccion)) = LOWER(TRIM(?))
                      AND COALESCE(LOWER(TRIM(localidad)), '') =
                          COALESCE(LOWER(TRIM(?)), '')
                      AND estado = 'activo'
                    LIMIT 1
                `).get(clienteId, direccion, localidad || "");

                if (existe) {
                    nuevoDomicilioId = existe.id;

                } else {
                    const nuevo = db.prepare(`
                        INSERT INTO servicios_domicilios (
                            cliente_id,
                            alias,
                            tipo_inmueble,
                            direccion,
                            localidad,
                            estado,
                            created_at,
                            updated_at
                        ) VALUES (
                            ?,
                            ?,
                            'casa',
                            ?,
                            ?,
                            'activo',
                            CURRENT_TIMESTAMP,
                            CURRENT_TIMESTAMP
                        )
                    `).run(
                        clienteId,
                        "Domicilio alternativo",
                        direccion,
                        localidad
                    );

                    nuevoDomicilioId = nuevo.lastInsertRowid;
                }
            }

            const orden = db.prepare(`
                INSERT INTO servicios_ordenes (
                    cliente_id,
                    tipo_servicio,
                    problema_reportado,
                    estado,
                    fecha_programada,
                    direccion_servicio,
                    localidad_servicio,
                    prioridad,
                    origen,
                    domicilio_id,
                    observaciones,
                    created_by,
                    created_at,
                    updated_at
                ) VALUES (
                    ?,
                    ?,
                    ?,
                    'pendiente',
                    ?,
                    ?,
                    ?,
                    ?,
                    'visita',
                    ?,
                    ?,
                    ?,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP
                )
            `).run(
                clienteId,
                tipo_servicio,
                problema_reportado.trim(),
                fecha,
                direccion,
                localidad,
                prioridad || "normal",
                nuevoDomicilioId,
                observaciones || null,
                usuario.id || usuario.userId || null
            );

            const ordenId = orden.lastInsertRowid;

            const visita = db.prepare(`
                INSERT INTO servicios_visitas (
                    orden_id,
                    numero_visita,
                    fecha_programada,
                    estado,
                    domicilio_id,
                    observaciones,
                    created_by,
                    created_at,
                    updated_at
                ) VALUES (
                    ?,
                    1,
                    ?,
                    'programada',
                    ?,
                    ?,
                    ?,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP
                )
            `).run(
                ordenId,
                fecha,
                nuevoDomicilioId,
                observaciones || null,
                usuario.id || usuario.userId || null
            );

            return {
                ordenId,
                visitaId: visita.lastInsertRowid
            };
        })();

        res.redirect(
            `/panel/servicios-tecnicos/visitas/${resultado.visitaId}`
        );

    } catch (error) {
        console.error("Error creando visita:", error);
        res.status(500).send("No se pudo registrar la visita.");
    }
});

// =====================================================
// EDITAR VISITA
// GET /:id/editar
// =====================================================

router.get("/:id/editar", (req, res) => {
    try {
        const id = Number(req.params.id);
        const visita = obtenerVisita(id);

        if (!visita) {
            return res.status(404).send("Visita no encontrada.");
        }

        const { username, role, user } = usuarioActual(req);

        res.render("servicios-tecnicos/visitas/editar", {
            visita,
            clientes: obtenerClientes(),
            domicilios: obtenerDomicilios(),
            username,
            role,
            user,
            error: null
        });

    } catch (error) {
        console.error("Error abriendo edición:", error);
        res.status(500).send("No se pudo abrir la visita.");
    }
});

// =====================================================
// ACTUALIZAR VISITA
// No modifica los datos generales de la orden.
// =====================================================

router.post("/:id/editar", (req, res) => {
    try {
        const id = Number(req.params.id);
        const visita = obtenerVisita(id);

        if (!visita) {
            return res.status(404).send("Visita no encontrada.");
        }

        const {
            domicilio_id,
            fecha_programada,
            observaciones,
            direccion_servicio,
            localidad_servicio
        } = req.body;

        const fecha = fecha_programada || fechaLocalActual();

        if (!fechaValida(fecha)) {
            return res.status(400).send("Fecha inválida.");
        }

        const domicilioId = domicilio_id
            ? Number(domicilio_id)
            : null;

        let domicilio = null;

        if (domicilioId) {
            domicilio = validarDomicilio(
                visita.cliente_id,
                domicilioId
            );

            if (!domicilio) {
                return res.status(400).send(
                    "El domicilio no corresponde al cliente de la orden."
                );
            }
        }

        const direccion =
            direccion_servicio?.trim() ||
            domicilio?.direccion ||
            null;

        const localidad =
            localidad_servicio?.trim() ||
            domicilio?.localidad ||
            null;

        db.transaction(() => {

            db.prepare(`
                UPDATE servicios_visitas
                SET
                    fecha_programada = ?,
                    domicilio_id = ?,
                    observaciones = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(
                fecha,
                domicilioId,
                observaciones || null,
                id
            );

            // La ubicación de la visita no modifica
            // la dirección general de la orden.

        })();

        res.redirect(
            `/panel/servicios-tecnicos/visitas/${id}`
        );

    } catch (error) {
        console.error("Error actualizando visita:", error);
        res.status(500).send("No se pudo actualizar la visita.");
    }
});

// =====================================================
// CAMBIAR ESTADO DE VISITA
// La orden conserva su estado independiente.
// =====================================================

router.post("/:id/estado", (req, res) => {
    try {
        const id = Number(req.params.id);
        const { estado } = req.body;

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).send("ID de visita inválido.");
        }

        if (!estadoValido(estado)) {
            return res.status(400).send("Estado no válido.");
        }

        const visita = db.prepare(`
            SELECT id, estado, fecha_inicio, fecha_fin
            FROM servicios_visitas
            WHERE id = ?
        `).get(id);

        if (!visita) {
            return res.status(404).send("Visita no encontrada.");
        }

        db.transaction(() => {

            db.prepare(`
                UPDATE servicios_visitas
                SET
                    estado = ?,

                    fecha_inicio = CASE
                        WHEN ? = 'en_curso'
                        THEN COALESCE(fecha_inicio, CURRENT_TIMESTAMP)
                        ELSE fecha_inicio
                    END,

                    fecha_fin = CASE
                        WHEN ? IN ('realizada', 'cancelada')
                        THEN COALESCE(fecha_fin, CURRENT_TIMESTAMP)
                        ELSE NULL
                    END,

                    duracion_minutos = CASE
                        WHEN ? IN ('realizada', 'cancelada')
                             AND fecha_inicio IS NOT NULL
                        THEN MAX(
                            0,
                            CAST(
                                (
                                    julianday(CURRENT_TIMESTAMP) -
                                    julianday(fecha_inicio)
                                ) * 1440 AS INTEGER
                            )
                        )
                        ELSE duracion_minutos
                    END,

                    updated_at = CURRENT_TIMESTAMP

                WHERE id = ?
            `).run(
                estado,
                estado,
                estado,
                estado,
                id
            );

        })();

        res.redirect(
            `/panel/servicios-tecnicos/visitas/${id}`
        );

    } catch (error) {
        console.error("Error cambiando estado:", error);
        res.status(500).send("No se pudo cambiar el estado.");
    }
});

// =====================================================
// GUARDAR REGISTRO TÉCNICO DE LA VISITA
// =====================================================

router.post("/:id/registro", (req, res) => {
    try {
        const visitaId = Number(req.params.id);

        const diagnostico = String(
            req.body.diagnostico || ""
        ).trim();

        const trabajoRealizado = String(
            req.body.trabajo_realizado || ""
        ).trim();

        const trabajosAdicionales = String(
            req.body.trabajos_adicionales || ""
        ).trim();

        const tareasPendientes = String(
            req.body.tareas_pendientes || ""
        ).trim();

        const observaciones = String(
            req.body.observaciones || ""
        ).trim();

        if (!Number.isInteger(visitaId) || visitaId <= 0) {
            return res.status(400).send("ID de visita inválido.");
        }

        const visita = db.prepare(`
            SELECT id
            FROM servicios_visitas
            WHERE id = ?
        `).get(visitaId);

        if (!visita) {
            return res.status(404).send("Visita no encontrada.");
        }

        db.prepare(`
            UPDATE servicios_visitas
            SET
                diagnostico = ?,
                trabajo_realizado = ?,
                trabajos_adicionales = ?,
                tareas_pendientes = ?,
                observaciones = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(
            diagnostico,
            trabajoRealizado,
            trabajosAdicionales,
            tareasPendientes,
            observaciones,
            visitaId
        );

        res.redirect(
            `/panel/servicios-tecnicos/visitas/${visitaId}`
        );

    } catch (error) {
        console.error("Error guardando registro técnico:", error);
        res.status(500).send("No se pudo guardar el registro técnico.");
    }
});

// =====================================================
// DETALLE DE VISITA
// GET /:id
// =====================================================
// =====================================================
// DETALLE DE VISITA
// GET /:id
// =====================================================

router.get("/:id", (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).send("ID de visita inválido.");
        }

        const visita = obtenerVisita(id);

        if (!visita) {
            return res.status(404).send("Visita no encontrada.");
        }

        // -----------------------------------------
        // RESUMEN DE VISITAS DE LA ORDEN
        // -----------------------------------------

        const resumen = db.prepare(`
            SELECT
                COUNT(*) AS total,

                SUM(CASE WHEN estado = 'programada'
                    THEN 1 ELSE 0 END) AS programadas,

                SUM(CASE WHEN estado = 'en_curso'
                    THEN 1 ELSE 0 END) AS en_curso,

                SUM(CASE WHEN estado = 'realizada'
                    THEN 1 ELSE 0 END) AS realizadas,

                SUM(CASE WHEN estado = 'seguimiento'
                    THEN 1 ELSE 0 END) AS seguimiento,

                SUM(CASE WHEN estado = 'cancelada'
                    THEN 1 ELSE 0 END) AS canceladas

            FROM servicios_visitas
            WHERE orden_id = ?
        `).get(visita.orden_id);

        // -----------------------------------------
        // TRABAJOS ASOCIADOS A ESTA VISITA
        // -----------------------------------------

        const trabajos = db.prepare(`
            SELECT
                t.*,
                vt.id AS vinculo_id,
                vt.estado AS estado_en_visita,
                vt.notas AS notas_visita,

                (
                    SELECT COUNT(*)
                    FROM servicios_visitas_trabajos vtx
                    WHERE vtx.trabajo_id = t.id
                ) AS cantidad_visitas

            FROM servicios_visitas_trabajos vt

            INNER JOIN servicios_trabajos t
                ON t.id = vt.trabajo_id

            WHERE vt.visita_id = ?

            ORDER BY t.created_at ASC, t.id ASC
        `).all(id);

        // -----------------------------------------
        // TRABAJOS DE LA ORDEN TODAVÍA NO VINCULADOS
        // A ESTA VISITA
        // -----------------------------------------

        const trabajosDisponibles = db.prepare(`
            SELECT
                t.id,
                t.orden_id,
                t.rubro,
                t.titulo,
                t.estado,
                t.prioridad,
                t.total

            FROM servicios_trabajos t

            WHERE t.orden_id = ?

              AND NOT EXISTS (
                  SELECT 1
                  FROM servicios_visitas_trabajos vt
                  WHERE vt.visita_id = ?
                    AND vt.trabajo_id = t.id
              )

            ORDER BY t.created_at ASC, t.id ASC
        `).all(visita.orden_id, id);

        // -----------------------------------------
        // RESUMEN DE TRABAJOS
        // -----------------------------------------

        const resumenTrabajos = {
            total: trabajos.length,

            pendientes: trabajos.filter(t =>
                t.estado === "pendiente"
            ).length,

            enProceso: trabajos.filter(t =>
                t.estado === "en_proceso"
            ).length,

            pausados: trabajos.filter(t =>
                t.estado === "pausado"
            ).length,

            terminados: trabajos.filter(t =>
                t.estado === "terminado"
            ).length,

            cancelados: trabajos.filter(t =>
                t.estado === "cancelado"
            ).length,

            importe: trabajos.reduce((suma, t) =>
                suma + (Number(t.total) || 0), 0)
        };

        const { username, role, user } = usuarioActual(req);

        res.render("servicios-tecnicos/visitas/detalle", {
            visita,
            resumen,
            trabajos,
            trabajosDisponibles,
            resumenTrabajos,
            username,
            role,
            user
        });

    } catch (error) {
        console.error("Error consultando detalle de visita:", error);

        res.status(500).send(
            "No se pudo consultar el detalle de la visita."
        );
    }
});

module.exports = router;
