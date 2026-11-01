const express = require("express");
const router = express.Router();
const db = require("../models/db");

// =====================================================
// CONFIGURACIÓN
// =====================================================

const ESTADOS_TRABAJO = [
    "pendiente",
    "en_proceso",
    "pausado",
    "terminado",
    "cancelado"
];

const PRIORIDADES = [
    "baja",
    "normal",
    "alta",
    "urgente"
];

// =====================================================
// UTILIDADES
// =====================================================

function usuarioActual(req) {
    const u = req.session?.user || {};

    return {
        id: u.id || u.userId || req.session?.userId || null,
        username: u.username || u.nombre || u.email || "Usuario",
        role: u.role || u.rol || "usuario"
    };
}

function numero(value, defecto = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : defecto;
}

function dinero(value) {
    return Math.max(0, numero(value));
}

function texto(value) {
    return typeof value === "string" ? value.trim() : "";
}

function obtenerOrden(id) {
    return db.prepare(`
        SELECT
            o.*,
            c.nombre AS cliente_nombre,
            c.telefono AS cliente_telefono,
            c.email AS cliente_email
        FROM servicios_ordenes o
        INNER JOIN servicios_clientes c
            ON c.id = o.cliente_id
        WHERE o.id = ?
    `).get(id);
}

function obtenerTrabajo(id) {
    return db.prepare(`
        SELECT
            t.*,
            o.cliente_id,
            o.tipo_servicio,
            o.estado AS estado_orden,
            c.nombre AS cliente_nombre,
            c.telefono AS cliente_telefono,
            c.email AS cliente_email
        FROM servicios_trabajos t
        INNER JOIN servicios_ordenes o
            ON o.id = t.orden_id
        INNER JOIN servicios_clientes c
            ON c.id = o.cliente_id
        WHERE t.id = ?
    `).get(id);
}

function obtenerVisitas(ordenId) {
    return db.prepare(`
        SELECT
            id,
            orden_id,
            numero_visita,
            fecha_programada,
            fecha_inicio,
            fecha_fin,
            estado,
            diagnostico
        FROM servicios_visitas
        WHERE orden_id = ?
        ORDER BY numero_visita ASC, id ASC
    `).all(ordenId);
}

function registrarHistorial(ordenId, accion, detalle, usuarioId) {
    try {
        db.prepare(`
            INSERT INTO servicios_historial (
                orden_id,
                accion,
                detalle,
                usuario_id
            ) VALUES (?, ?, ?, ?)
        `).run(
            ordenId,
            accion,
            detalle,
            usuarioId || null
        );

    } catch (error) {
        console.error(
            "No se pudo registrar el historial:",
            error.message
        );
    }
}

function validarFecha(fecha) {
    if (!fecha) return null;

    const valor = texto(fecha);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
        return null;
    }

    const [anio, mes, dia] = valor.split("-").map(Number);

    const fechaReal = new Date(anio, mes - 1, dia);

    if (
        fechaReal.getFullYear() !== anio ||
        fechaReal.getMonth() !== mes - 1 ||
        fechaReal.getDate() !== dia
    ) {
        return null;
    }

    return valor;
}

function fechaActual() {
    const ahora = new Date();

    const anio = ahora.getFullYear();
    const mes = String(ahora.getMonth() + 1).padStart(2, "0");
    const dia = String(ahora.getDate()).padStart(2, "0");

    return `${anio}-${mes}-${dia}`;
}

function prioridadValida(valor, defecto = "normal") {
    return PRIORIDADES.includes(valor) ? valor : defecto;
}

function estadoValido(valor, defecto = "pendiente") {
    return ESTADOS_TRABAJO.includes(valor) ? valor : defecto;
}

// =====================================================
// LISTADO GENERAL DE TRABAJOS
// GET /
// =====================================================

router.get("/", (req, res) => {
    try {
        const user = usuarioActual(req);

        const filtros = [];
        const parametros = [];

        if (
            req.query.estado &&
            ESTADOS_TRABAJO.includes(req.query.estado)
        ) {
            filtros.push("t.estado = ?");
            parametros.push(req.query.estado);
        }

        if (req.query.rubro) {
            filtros.push("t.rubro = ?");
            parametros.push(texto(req.query.rubro));
        }

        if (req.query.orden_id) {
            const ordenId = numero(req.query.orden_id);

            if (ordenId > 0) {
                filtros.push("t.orden_id = ?");
                parametros.push(ordenId);
            }
        }

        if (req.query.buscar) {
            filtros.push(`
                (
                    t.titulo LIKE ?
                    OR t.descripcion LIKE ?
                    OR c.nombre LIKE ?
                    OR CAST(t.id AS TEXT) LIKE ?
                )
            `);

            const busqueda = `%${texto(req.query.buscar)}%`;

            parametros.push(
                busqueda,
                busqueda,
                busqueda,
                busqueda
            );
        }

        const where = filtros.length
            ? `WHERE ${filtros.join(" AND ")}`
            : "";

        const trabajos = db.prepare(`
            SELECT
                t.*,
                c.nombre AS cliente_nombre,
                o.id AS numero_orden,
                o.tipo_servicio,
                (
                    SELECT COUNT(*)
                    FROM servicios_visitas_trabajos vt
                    WHERE vt.trabajo_id = t.id
                ) AS cantidad_visitas
            FROM servicios_trabajos t
            INNER JOIN servicios_ordenes o
                ON o.id = t.orden_id
            INNER JOIN servicios_clientes c
                ON c.id = o.cliente_id
            ${where}
            ORDER BY t.created_at DESC, t.id DESC
        `).all(...parametros);

        const estadisticas = {
            total: trabajos.length,

            pendientes: trabajos.filter(
                t => t.estado === "pendiente"
            ).length,

            enProceso: trabajos.filter(
                t => t.estado === "en_proceso"
            ).length,

            terminados: trabajos.filter(
                t => t.estado === "terminado"
            ).length
        };

        res.render("servicios-tecnicos/trabajos/index", {
            user,
            username: user.username,
            role: user.role,
            trabajos,
            estadisticas,
            filtros: req.query
        });

    } catch (error) {
        console.error("Error listando trabajos:", error);

        res.status(500).send(
            "No se pudieron cargar los trabajos."
        );
    }
});

// =====================================================
// FORMULARIO NUEVO TRABAJO
// GET /nuevo
// =====================================================

router.get("/nuevo", (req, res) => {
    try {
        const user = usuarioActual(req);

        const ordenId = numero(req.query.orden_id);
        const visitaId = numero(req.query.visita_id);

        let orden = null;
        let visita = null;
        let visitas = [];

        // Órdenes disponibles para el selector.
        const ordenes = db.prepare(`
            SELECT
                o.id,
                o.cliente_id,
                o.tipo_servicio,
                o.estado,
                o.created_at,
                c.nombre AS cliente_nombre
            FROM servicios_ordenes o
            INNER JOIN servicios_clientes c
                ON c.id = o.cliente_id
            ORDER BY o.id DESC
        `).all();

        if (ordenId) {
            orden = obtenerOrden(ordenId);

            if (!orden) {
                return res.status(404).send(
                    "La orden no existe."
                );
            }

            visitas = obtenerVisitas(ordenId);
        }

        if (visitaId) {
            visita = db.prepare(`
                SELECT *
                FROM servicios_visitas
                WHERE id = ?
            `).get(visitaId);

            if (!visita) {
                return res.status(404).send(
                    "La visita no existe."
                );
            }

            orden = obtenerOrden(visita.orden_id);

            if (!orden) {
                return res.status(404).send(
                    "La orden de la visita no existe."
                );
            }

            visitas = obtenerVisitas(orden.id);
        }

        res.render("servicios-tecnicos/trabajos/nuevo", {
            user,
            username: user.username,
            role: user.role,
            ordenes,
            orden,
            visita,
            visitas,
            estados: ESTADOS_TRABAJO,
            prioridades: PRIORIDADES
        });

    } catch (error) {
        console.error(
            "Error cargando formulario de trabajo:",
            error
        );

        res.status(500).send(
            "No se pudo cargar el formulario."
        );
    }
});

// =====================================================
// CREAR TRABAJO
// POST /
// =====================================================

router.post("/", (req, res) => {
    try {
        const user = usuarioActual(req);

        const {
            orden_id,
            visita_id,
            rubro,
            titulo,
            descripcion,
            equipo,
            marca,
            modelo,
            diagnostico,
            trabajo_realizado,
            prioridad,
            mano_obra,
            costo_repuestos,
            total,
            monto_cobrado,
            fecha_inicio,
            fecha_finalizacion,
            observaciones
        } = req.body;

        const ordenId = numero(orden_id);
        const visitaId = numero(visita_id);

        if (!ordenId) {
            return res.status(400).send(
                "Debés indicar una orden."
            );
        }

        if (!texto(titulo)) {
            return res.status(400).send(
                "El título del trabajo es obligatorio."
            );
        }

        if (!texto(rubro)) {
            return res.status(400).send(
                "Debés seleccionar un rubro."
            );
        }

        const orden = obtenerOrden(ordenId);

        if (!orden) {
            return res.status(404).send(
                "La orden seleccionada no existe."
            );
        }

        let visita = null;

        if (visitaId) {
            visita = db.prepare(`
                SELECT id, orden_id
                FROM servicios_visitas
                WHERE id = ?
            `).get(visitaId);

            if (
                !visita ||
                Number(visita.orden_id) !== ordenId
            ) {
                return res.status(400).send(
                    "La visita seleccionada no pertenece a esta orden."
                );
            }
        }

        const estado = estadoValido(req.body.estado);

        const prioridadFinal = prioridadValida(prioridad);

        const fechaInicio = validarFecha(fecha_inicio);
        const fechaFinal = validarFecha(fecha_finalizacion);

        if (
            fechaInicio &&
            fechaFinal &&
            fechaFinal < fechaInicio
        ) {
            return res.status(400).send(
                "La fecha de finalización no puede ser anterior a la fecha de inicio."
            );
        }

        const manoObra = dinero(mano_obra);
        const costoRepuestos = dinero(costo_repuestos);

        const totalFinal = dinero(total);
        const montoCobrado = dinero(monto_cobrado);

        if (montoCobrado > totalFinal) {
            return res.status(400).send(
                "El importe cobrado no puede superar el total del trabajo."
            );
        }

        const crear = db.transaction(() => {

            const resultado = db.prepare(`
                INSERT INTO servicios_trabajos (
                    orden_id,
                    visita_origen_id,
                    rubro,
                    titulo,
                    descripcion,
                    equipo,
                    marca,
                    modelo,
                    diagnostico,
                    trabajo_realizado,
                    estado,
                    prioridad,
                    mano_obra,
                    costo_repuestos,
                    total,
                    monto_cobrado,
                    fecha_inicio,
                    fecha_finalizacion,
                    observaciones
                ) VALUES (
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?, ?, ?, ?
                )
            `).run(
                ordenId,
                visitaId || null,
                texto(rubro),
                texto(titulo),
                texto(descripcion) || null,
                texto(equipo) || null,
                texto(marca) || null,
                texto(modelo) || null,
                texto(diagnostico) || null,
                texto(trabajo_realizado) || null,
                estado,
                prioridadFinal,
                manoObra,
                costoRepuestos,
                totalFinal,
                montoCobrado,
                fechaInicio,
                fechaFinal,
                texto(observaciones) || null
            );

            const trabajoId = Number(
                resultado.lastInsertRowid
            );

            if (visitaId) {
                db.prepare(`
                    INSERT INTO servicios_visitas_trabajos (
                        visita_id,
                        trabajo_id,
                        estado
                    ) VALUES (?, ?, ?)
                `).run(
                    visitaId,
                    trabajoId,
                    estado
                );
            }

            return trabajoId;
        });

        const trabajoId = crear();

        registrarHistorial(
            ordenId,
            "Trabajo creado",
            `Se creó el trabajo #${trabajoId}: ${texto(titulo)}`,
            user.id
        );

        if (visitaId) {
            return res.redirect(
                `/panel/servicios-tecnicos/visitas/${visitaId}`
            );
        }

        res.redirect(
            `/panel/servicios-tecnicos/trabajos/${trabajoId}`
        );

    } catch (error) {
        console.error("Error creando trabajo:", error);

        res.status(500).send(
            "No se pudo crear el trabajo."
        );
    }
});

// =====================================================
// DETALLE DEL TRABAJO
// GET /:id
// =====================================================

router.get("/:id", (req, res) => {
    try {
        const user = usuarioActual(req);
        const id = numero(req.params.id);

        if (!id) {
            return res.status(400).send(
                "ID de trabajo inválido."
            );
        }

        const trabajo = obtenerTrabajo(id);

        if (!trabajo) {
            return res.status(404).send(
                "Trabajo no encontrado."
            );
        }

        // Visitas que ya están vinculadas al trabajo.
        const visitas = db.prepare(`
            SELECT
                v.*,
                vt.estado AS estado_trabajo_visita,
                vt.notas AS notas_visita
            FROM servicios_visitas_trabajos vt
            INNER JOIN servicios_visitas v
                ON v.id = vt.visita_id
            WHERE vt.trabajo_id = ?
            ORDER BY v.numero_visita ASC, v.id ASC
        `).all(id);

        // Visitas de la misma orden que todavía no están vinculadas.
        const listaVisitasDisponibles = db.prepare(`
            SELECT v.*
            FROM servicios_visitas v
            WHERE v.orden_id = ?
              AND v.id NOT IN (
                  SELECT visita_id
                  FROM servicios_visitas_trabajos
                  WHERE trabajo_id = ?
              )
            ORDER BY v.numero_visita ASC, v.id ASC
        `).all(
            trabajo.orden_id,
            trabajo.id
        );

        // Repuestos asociados.
        const repuestos = db.prepare(`
            SELECT *
            FROM servicios_repuestos_orden
            WHERE trabajo_id = ?
            ORDER BY id DESC
        `).all(id);

        // Pagos asociados.
        const pagos = db.prepare(`
            SELECT *
            FROM servicios_pagos
            WHERE trabajo_id = ?
            ORDER BY fecha_pago DESC, id DESC
        `).all(id);

        // Gastos asociados.
        const gastos = db.prepare(`
            SELECT *
            FROM servicios_gastos
            WHERE trabajo_id = ?
            ORDER BY fecha_gasto DESC, id DESC
        `).all(id);

        // Fotografías y documentos.
        const archivos = db.prepare(`
            SELECT *
            FROM servicios_archivos
            WHERE trabajo_id = ?
            ORDER BY created_at DESC, id DESC
        `).all(id);

        res.render("servicios-tecnicos/trabajos/detalle", {
            user,
            username: user.username,
            role: user.role,
            trabajo,
            visitas,
            listaVisitasDisponibles,
            repuestos,
            pagos,
            gastos,
            archivos
        });

    } catch (error) {
        console.error(
            "Error consultando trabajo:",
            error
        );

        res.status(500).send(
            "No se pudo consultar el trabajo."
        );
    }
});

// =====================================================
// FORMULARIO EDITAR TRABAJO
// GET /:id/editar
// =====================================================

router.get("/:id/editar", (req, res) => {
    try {
        const user = usuarioActual(req);
        const id = numero(req.params.id);

        if (!id) {
            return res.status(400).send(
                "ID de trabajo inválido."
            );
        }

        const trabajo = obtenerTrabajo(id);

        if (!trabajo) {
            return res.status(404).send(
                "Trabajo no encontrado."
            );
        }

        const visitas = obtenerVisitas(
            trabajo.orden_id
        );

        const visitasAsignadas = db.prepare(`
            SELECT visita_id
            FROM servicios_visitas_trabajos
            WHERE trabajo_id = ?
        `).all(id).map(v => v.visita_id);

        res.render("servicios-tecnicos/trabajos/editar", {
            user,
            username: user.username,
            role: user.role,
            trabajo,
            visitas,
            visitasAsignadas,
            estados: ESTADOS_TRABAJO,
            prioridades: PRIORIDADES
        });

    } catch (error) {
        console.error(
            "Error cargando edición:",
            error
        );

        res.status(500).send(
            "No se pudo cargar la edición."
        );
    }
});

// =====================================================
// ACTUALIZAR TRABAJO
// POST /:id/editar
// =====================================================

router.post("/:id/editar", (req, res) => {
    try {
        const user = usuarioActual(req);
        const id = numero(req.params.id);

        if (!id) {
            return res.status(400).send(
                "ID de trabajo inválido."
            );
        }

        const trabajo = obtenerTrabajo(id);

        if (!trabajo) {
            return res.status(404).send(
                "Trabajo no encontrado."
            );
        }

        const {
            rubro,
            titulo,
            descripcion,
            equipo,
            marca,
            modelo,
            diagnostico,
            trabajo_realizado,
            prioridad,
            mano_obra,
            costo_repuestos,
            total,
            monto_cobrado,
            fecha_inicio,
            fecha_finalizacion,
            observaciones
        } = req.body;

        if (!texto(titulo)) {
            return res.status(400).send(
                "El título es obligatorio."
            );
        }

        if (!texto(rubro)) {
            return res.status(400).send(
                "Debés seleccionar un rubro."
            );
        }

        const estado = estadoValido(
            req.body.estado,
            trabajo.estado
        );

        const prioridadFinal = prioridadValida(
            prioridad,
            trabajo.prioridad || "normal"
        );

        const fechaInicio = validarFecha(fecha_inicio);
        const fechaFinal = validarFecha(fecha_finalizacion);

        if (
            fechaInicio &&
            fechaFinal &&
            fechaFinal < fechaInicio
        ) {
            return res.status(400).send(
                "La fecha de finalización no puede ser anterior a la fecha de inicio."
            );
        }

        const manoObra = dinero(mano_obra);
        const costoRepuestos = dinero(costo_repuestos);
        const totalFinal = dinero(total);
        const montoCobrado = dinero(monto_cobrado);

        if (montoCobrado > totalFinal) {
            return res.status(400).send(
                "El importe cobrado no puede superar el total del trabajo."
            );
        }

        db.prepare(`
            UPDATE servicios_trabajos
            SET
                rubro = ?,
                titulo = ?,
                descripcion = ?,
                equipo = ?,
                marca = ?,
                modelo = ?,
                diagnostico = ?,
                trabajo_realizado = ?,
                estado = ?,
                prioridad = ?,
                mano_obra = ?,
                costo_repuestos = ?,
                total = ?,
                monto_cobrado = ?,
                fecha_inicio = ?,
                fecha_finalizacion = ?,
                observaciones = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(
            texto(rubro),
            texto(titulo),
            texto(descripcion) || null,
            texto(equipo) || null,
            texto(marca) || null,
            texto(modelo) || null,
            texto(diagnostico) || null,
            texto(trabajo_realizado) || null,
            estado,
            prioridadFinal,
            manoObra,
            costoRepuestos,
            totalFinal,
            montoCobrado,
            fechaInicio,
            fechaFinal,
            texto(observaciones) || null,
            id
        );

        registrarHistorial(
            trabajo.orden_id,
            "Trabajo actualizado",
            `Se actualizó el trabajo #${id}: ${texto(titulo)}`,
            user.id
        );

        res.redirect(
            `/panel/servicios-tecnicos/trabajos/${id}`
        );

    } catch (error) {
        console.error(
            "Error actualizando trabajo:",
            error
        );

        res.status(500).send(
            "No se pudo actualizar el trabajo."
        );
    }
});

// =====================================================
// VINCULAR TRABAJO A OTRA VISITA
// POST /:id/vincular-visita
// =====================================================

router.post("/:id/vincular-visita", (req, res) => {
    try {
        const user = usuarioActual(req);

        const trabajoId = numero(req.params.id);
        const visitaId = numero(req.body.visita_id);

        const trabajo = obtenerTrabajo(trabajoId);

        if (!trabajo) {
            return res.status(404).send(
                "Trabajo no encontrado."
            );
        }

        if (!visitaId) {
            return res.status(400).send(
                "Debés seleccionar una visita."
            );
        }

        const visita = db.prepare(`
            SELECT *
            FROM servicios_visitas
            WHERE id = ?
        `).get(visitaId);

        if (!visita) {
            return res.status(404).send(
                "Visita no encontrada."
            );
        }

        if (
            Number(visita.orden_id) !==
            Number(trabajo.orden_id)
        ) {
            return res.status(400).send(
                "La visita no pertenece a la orden de este trabajo."
            );
        }

        const existente = db.prepare(`
            SELECT id
            FROM servicios_visitas_trabajos
            WHERE visita_id = ?
              AND trabajo_id = ?
        `).get(
            visitaId,
            trabajoId
        );

        if (existente) {
            return res.redirect(
                `/panel/servicios-tecnicos/trabajos/${trabajoId}`
            );
        }

        db.prepare(`
            INSERT INTO servicios_visitas_trabajos (
                visita_id,
                trabajo_id,
                estado
            ) VALUES (?, ?, ?)
        `).run(
            visitaId,
            trabajoId,
            trabajo.estado
        );

        registrarHistorial(
            trabajo.orden_id,
            "Trabajo vinculado a visita",
            `El trabajo #${trabajoId} se vinculó a la visita #${visitaId}.`,
            user.id
        );

        res.redirect(
            `/panel/servicios-tecnicos/trabajos/${trabajoId}`
        );

    } catch (error) {
        console.error(
            "Error vinculando trabajo:",
            error
        );

        res.status(500).send(
            "No se pudo vincular el trabajo a la visita."
        );
    }
});

// =====================================================
// ACTUALIZAR ESTADO DEL TRABAJO
// POST /:id/estado
// =====================================================

router.post("/:id/estado", (req, res) => {
    try {
        const user = usuarioActual(req);

        const id = numero(req.params.id);
        const estado = texto(req.body.estado);

        const trabajo = obtenerTrabajo(id);

        if (!trabajo) {
            return res.status(404).send(
                "Trabajo no encontrado."
            );
        }

        if (!ESTADOS_TRABAJO.includes(estado)) {
            return res.status(400).send(
                "Estado inválido."
            );
        }

        let fechaInicio = trabajo.fecha_inicio;
        let fechaFinalizacion = trabajo.fecha_finalizacion;

        if (estado === "en_proceso" && !fechaInicio) {
            fechaInicio = fechaActual();
        }

        if (estado === "terminado") {
            fechaFinalizacion = fechaActual();

            if (!fechaInicio) {
                fechaInicio = fechaFinalizacion;
            }
        }

        if (estado !== "terminado") {
            fechaFinalizacion = null;
        }

        db.prepare(`
            UPDATE servicios_trabajos
            SET
                estado = ?,
                fecha_inicio = ?,
                fecha_finalizacion = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(
            estado,
            fechaInicio,
            fechaFinalizacion,
            id
        );

        // Actualizamos también el estado del vínculo
        // correspondiente a cada visita, sin cambiar
        // el estado general de las visitas.
        db.prepare(`
            UPDATE servicios_visitas_trabajos
            SET estado = ?
            WHERE trabajo_id = ?
        `).run(
            estado,
            id
        );

        registrarHistorial(
            trabajo.orden_id,
            "Estado de trabajo actualizado",
            `El trabajo #${id} cambió de ${trabajo.estado} a ${estado}.`,
            user.id
        );

        res.redirect(
            `/panel/servicios-tecnicos/trabajos/${id}`
        );

    } catch (error) {
        console.error(
            "Error cambiando estado:",
            error
        );

        res.status(500).send(
            "No se pudo actualizar el estado."
        );
    }
});

// =====================================================
// EXPORTAR ROUTER
// =====================================================

module.exports = router;