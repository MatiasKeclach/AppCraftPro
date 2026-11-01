const express = require("express");
const router = express.Router();
const db = require("../models/db");

// =====================================================
// UTILIDADES GENERALES
// =====================================================

function tableExists(table) {
    try {
        return !!db.prepare(`
            SELECT name
            FROM sqlite_master
            WHERE type = 'table'
            AND name = ?
        `).get(table);
    } catch (error) {
        console.error(`Error verificando tabla ${table}:`, error.message);
        return false;
    }
}

function getColumns(table) {
    if (!tableExists(table)) return [];

    try {
        return db.prepare(`PRAGMA table_info("${table}")`)
            .all()
            .map(c => c.name);
    } catch (error) {
        console.error(`Error obteniendo columnas de ${table}:`, error.message);
        return [];
    }
}

function hasColumn(table, column) {
    return getColumns(table).includes(column);
}

function firstColumn(table, candidates) {
    const columns = getColumns(table);
    return candidates.find(c => columns.includes(c)) || null;
}


// =====================================================
// IDENTIFICACIÓN DEL USUARIO
// =====================================================

function getUserData(req) {
    const sessionUser = req.session?.user || {};

    const userId =
        sessionUser.id ||
        sessionUser.userId ||
        req.session?.userId ||
        null;

    let user = {
        id: userId,
        userId,
        username:
            sessionUser.username ||
            sessionUser.usuario ||
            req.session?.username ||
            "Usuario",
        nombre:
            sessionUser.nombre ||
            sessionUser.name ||
            "",
        apellido:
            sessionUser.apellido ||
            sessionUser.last_name ||
            "",
        role:
            sessionUser.role ||
            sessionUser.rol ||
            req.session?.role ||
            req.session?.rol ||
            "usuario"
    };

    // Recuperar información completa desde la base de datos.
    if (userId && tableExists("users")) {
        try {
            const columns = getColumns("users");

            const idColumn = firstColumn("users", [
                "id",
                "user_id"
            ]);

            const usernameColumn = firstColumn("users", [
                "username",
                "usuario",
                "email"
            ]);

            const nombreColumn = firstColumn("users", [
                "nombre",
                "name",
                "first_name"
            ]);

            const apellidoColumn = firstColumn("users", [
                "apellido",
                "last_name",
                "surname"
            ]);

            const roleColumn = firstColumn("users", [
                "role",
                "rol",
                "tipo"
            ]);

            if (idColumn) {
                const fields = [
                    [usernameColumn, "username"],
                    [nombreColumn, "nombre"],
                    [apellidoColumn, "apellido"],
                    [roleColumn, "role"]
                ].filter(([column]) => column);

                const selectFields = [
                    `"${idColumn}" AS id`,
                    ...fields.map(([column, alias]) =>
                        `"${column}" AS "${alias}"`
                    )
                ];

                const usuarioDB = db.prepare(`
                    SELECT ${selectFields.join(", ")}
                    FROM users
                    WHERE "${idColumn}" = ?
                    LIMIT 1
                `).get(userId);

                if (usuarioDB) {
                    user = {
                        ...user,
                        ...usuarioDB,
                        id: usuarioDB.id || userId,
                        userId: usuarioDB.id || userId
                    };
                }
            }

        } catch (error) {
            console.error(
                "Error recuperando datos del usuario:",
                error.message
            );
        }
    }

    const nombreCompleto = [
        user.nombre,
        user.apellido
    ]
        .filter(Boolean)
        .join(" ")
        .trim();

    const displayName =
        nombreCompleto ||
        user.username ||
        "Usuario";

    const roleLabel = user.role || "usuario";

    return {
        ...user,
        id: user.id || userId,
        userId: user.id || userId,
        displayName,
        roleLabel,
        welcome: `Bienvenido, ${displayName}`
    };
}


function safeCount(table, where = "") {
    if (!tableExists(table)) return 0;

    try {
        return db.prepare(`
            SELECT COUNT(*) AS total
            FROM "${table}"
            ${where}
        `).get().total || 0;
    } catch (error) {
        console.error(`Error contando ${table}:`, error.message);
        return 0;
    }
}


function safeSum(table, column, where = "") {
    if (!tableExists(table) || !hasColumn(table, column)) return 0;

    try {
        return Number(db.prepare(`
            SELECT COALESCE(SUM("${column}"), 0) AS total
            FROM "${table}"
            ${where}
        `).get().total || 0);
    } catch (error) {
        console.error(`Error sumando ${table}.${column}:`, error.message);
        return 0;
    }
}


function moneyNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
}


function getPeriod(req) {
    const allowed = ["week", "month", "year"];

    return allowed.includes(req.query.periodo)
        ? req.query.periodo
        : "month";
}


function getPeriodStart(period) {
    const date = new Date();

    if (period === "week") {
        date.setDate(date.getDate() - 6);
    } else if (period === "year") {
        date.setMonth(date.getMonth() - 11);
        date.setDate(1);
    } else {
        date.setDate(date.getDate() - 29);
    }

    date.setHours(0, 0, 0, 0);

    return date;
}


function formatDateKey(date) {
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0")
    ].join("-");
}


function parseDate(value) {
    if (!value) return null;

    const date = new Date(value);

    return Number.isNaN(date.getTime()) ? null : date;
}


// =====================================================
// ESTADÍSTICAS GENERALES
// =====================================================

function getStats() {
    const clientes = safeCount(
        "servicios_clientes",
        "WHERE estado = 'activo'"
    );

    const pendientes = safeCount(
        "servicios_ordenes",
        `WHERE estado IN (
            'pendiente',
            'programado',
            'en_camino',
            'en_proceso'
        )`
    );

    const terminados = safeCount(
        "servicios_ordenes",
        `WHERE estado IN (
            'terminado',
            'finalizado',
            'completado'
        )`
    );

    const facturacion = safeSum(
        "servicios_ordenes",
        "monto_cobrado"
    );

    return {
        clientes,
        pendientes,
        terminados,
        facturacion
    };
}


// =====================================================
// AGENDA DE TRABAJOS
// =====================================================

function getProximosTrabajos(limit = 8) {
    if (!tableExists("servicios_ordenes")) return [];

    try {
        const direccion = hasColumn(
            "servicios_ordenes",
            "direccion_servicio"
        )
            ? "o.direccion_servicio"
            : "c.direccion";

        return db.prepare(`
            SELECT
                o.*,
                c.nombre AS cliente_nombre,
                c.telefono AS cliente_telefono,
                ${direccion} AS direccion_servicio

            FROM servicios_ordenes o

            INNER JOIN servicios_clientes c
                ON c.id = o.cliente_id

            WHERE o.estado NOT IN (
                'terminado',
                'finalizado',
                'completado',
                'cancelado'
            )

            ORDER BY
                CASE
                    WHEN o.fecha_programada IS NULL THEN 1
                    ELSE 0
                END,
                o.fecha_programada ASC,
                o.id DESC

            LIMIT ?
        `).all(limit);

    } catch (error) {
        console.error("Error obteniendo agenda:", error.message);
        return [];
    }
}


// =====================================================
// ÚLTIMOS TRABAJOS
// =====================================================

function getUltimosTrabajos(limit = 6) {
    if (!tableExists("servicios_ordenes")) return [];

    try {
        return db.prepare(`
            SELECT
                o.*,
                c.nombre AS cliente_nombre,
                c.telefono AS cliente_telefono

            FROM servicios_ordenes o

            INNER JOIN servicios_clientes c
                ON c.id = o.cliente_id

            ORDER BY o.created_at DESC

            LIMIT ?
        `).all(limit);

    } catch (error) {
        console.error("Error obteniendo últimos trabajos:", error.message);
        return [];
    }
}


// =====================================================
// ÚLTIMOS CLIENTES
// =====================================================

function getClientesRecientes(limit = 7) {
    if (!tableExists("servicios_clientes")) return [];

    try {
        return db.prepare(`
            SELECT *
            FROM servicios_clientes
            ORDER BY created_at DESC
            LIMIT ?
        `).all(limit);

    } catch (error) {
        console.error("Error obteniendo clientes recientes:", error.message);
        return [];
    }
}


// =====================================================
// DISTRIBUCIÓN DE ÓRDENES
// =====================================================

function getOrdenesPorEstado() {
    if (!tableExists("servicios_ordenes")) return [];

    try {
        return db.prepare(`
            SELECT
                estado,
                COUNT(*) AS total

            FROM servicios_ordenes

            GROUP BY estado

            ORDER BY total DESC
        `).all();

    } catch (error) {
        console.error("Error obteniendo estados:", error.message);
        return [];
    }
}


// =====================================================
// PAGOS
// =====================================================

function getTotalPagos() {
    if (!tableExists("servicios_pagos")) return null;

    const columna = firstColumn(
        "servicios_pagos",
        ["monto", "importe", "monto_pago", "total"]
    );

    if (!columna) return null;

    return safeSum("servicios_pagos", columna);
}


function getPagosPorFecha(inicio, fin) {
    if (!tableExists("servicios_pagos")) return [];

    const monto = firstColumn(
        "servicios_pagos",
        ["monto", "importe", "monto_pago", "total"]
    );

    const fecha = firstColumn(
        "servicios_pagos",
        ["fecha", "fecha_pago", "created_at"]
    );

    if (!monto || !fecha) return [];

    try {
        return db.prepare(`
            SELECT
                DATE("${fecha}") AS dia,
                SUM("${monto}") AS total

            FROM servicios_pagos

            WHERE DATE("${fecha}") BETWEEN DATE(?) AND DATE(?)

            GROUP BY DATE("${fecha}")
        `).all(inicio, fin);

    } catch (error) {
        console.error("Error consultando pagos:", error.message);
        return [];
    }
}


// =====================================================
// GASTOS
// =====================================================

function getTotalGastos() {
    if (!tableExists("servicios_gastos")) return 0;

    const columna = firstColumn(
        "servicios_gastos",
        ["monto", "importe", "total", "costo"]
    );

    if (!columna) return 0;

    return safeSum("servicios_gastos", columna);
}


function getGastosPorFecha(inicio, fin) {
    if (!tableExists("servicios_gastos")) return [];

    const monto = firstColumn(
        "servicios_gastos",
        ["monto", "importe", "total", "costo"]
    );

    const fecha = firstColumn(
        "servicios_gastos",
        ["fecha", "created_at"]
    );

    if (!monto || !fecha) return [];

    try {
        return db.prepare(`
            SELECT
                DATE("${fecha}") AS dia,
                SUM("${monto}") AS total

            FROM servicios_gastos

            WHERE DATE("${fecha}") BETWEEN DATE(?) AND DATE(?)

            GROUP BY DATE("${fecha}")
        `).all(inicio, fin);

    } catch (error) {
        console.error("Error consultando gastos:", error.message);
        return [];
    }
}


// =====================================================
// PRESUPUESTOS
// =====================================================

function getPresupuestos() {
    const result = {
        pendientes: 0,
        porResponder: 0,
        enviados: 0,
        aceptados: 0,
        rechazados: 0
    };

    if (!tableExists("servicios_presupuestos")) {
        return result;
    }

    const estado = firstColumn(
        "servicios_presupuestos",
        ["estado", "status"]
    );

    if (!estado) return result;

    try {
        const rows = db.prepare(`
            SELECT
                LOWER("${estado}") AS estado,
                COUNT(*) AS total

            FROM servicios_presupuestos

            GROUP BY LOWER("${estado}")
        `).all();

        for (const row of rows) {
            const value = Number(row.total || 0);

            if (["pendiente", "borrador"].includes(row.estado)) {
                result.pendientes += value;
            }

            if (["enviado", "enviados"].includes(row.estado)) {
                result.enviados += value;
            }

            if (["aceptado", "aceptados"].includes(row.estado)) {
                result.aceptados += value;
            }

            if (["rechazado", "rechazados"].includes(row.estado)) {
                result.rechazados += value;
            }
        }

        result.porResponder =
            result.pendientes + result.enviados;

    } catch (error) {
        console.error("Error presupuestos:", error.message);
    }

    return result;
}


// =====================================================
// INVENTARIO
// =====================================================

function getInventario() {
    const result = {
        totalItems: 0,
        stockBajo: 0,
        sinStock: 0,
        valor: 0
    };

    if (!tableExists("servicios_inventario")) {
        return result;
    }

    const stock = firstColumn(
        "servicios_inventario",
        ["stock_actual", "stock", "cantidad"]
    );

    const minimo = firstColumn(
        "servicios_inventario",
        ["stock_minimo", "minimo", "stock_alerta"]
    );

    const costo = firstColumn(
        "servicios_inventario",
        ["costo_unitario", "costo", "precio_compra"]
    );

    try {
        result.totalItems = safeCount("servicios_inventario");

        if (stock) {
            result.sinStock = safeCount(
                "servicios_inventario",
                `WHERE "${stock}" <= 0`
            );

            if (minimo) {
                result.stockBajo = safeCount(
                    "servicios_inventario",
                    `WHERE "${stock}" > 0
                    AND "${stock}" <= "${minimo}"`
                );
            }

            if (costo) {
                result.valor = Number(db.prepare(`
                    SELECT COALESCE(
                        SUM("${stock}" * "${costo}"),
                        0
                    ) AS total

                    FROM servicios_inventario
                `).get().total || 0);
            }
        }

    } catch (error) {
        console.error("Error inventario:", error.message);
    }

    return result;
}


// =====================================================
// COMPRAS
// =====================================================

function getTotalCompras() {
    if (!tableExists("servicios_compras")) return 0;

    const total = firstColumn(
        "servicios_compras",
        ["total", "monto", "importe"]
    );

    if (!total) return 0;

    return safeSum("servicios_compras", total);
}


function getComprasPendientes() {
    if (!tableExists("servicios_compras")) return 0;

    const total = firstColumn(
        "servicios_compras",
        ["total", "monto", "importe"]
    );

    const pagado = firstColumn(
        "servicios_compras",
        ["monto_pagado", "pagado"]
    );

    if (!total || !pagado) return 0;

    try {
        return Number(db.prepare(`
            SELECT COALESCE(
                SUM(
                    CASE
                        WHEN "${total}" > "${pagado}"
                        THEN "${total}" - "${pagado}"
                        ELSE 0
                    END
                ),
                0
            ) AS total

            FROM servicios_compras
        `).get().total || 0);

    } catch (error) {
        console.error("Error compras pendientes:", error.message);
        return 0;
    }
}


// =====================================================
// TÉCNICOS
// =====================================================

function getTecnicos() {
    if (!tableExists("servicios_tecnicos")) return [];

    try {
        const tecnicos = db.prepare(`
            SELECT *
            FROM servicios_tecnicos
            ORDER BY nombre ASC
        `).all();

        return tecnicos.map(tecnico => {
            const id = tecnico.id;

            let asignados = 0;
            let terminados = 0;
            let horas = 0;

            if (
                tableExists("servicios_visitas_tecnicos") &&
                tableExists("servicios_visitas")
            ) {
                try {
                    const relacion = firstColumn(
                        "servicios_visitas_tecnicos",
                        ["tecnico_id"]
                    );

                    if (relacion) {
                        asignados = db.prepare(`
                            SELECT COUNT(*)
                            FROM servicios_visitas_tecnicos
                            WHERE tecnico_id = ?
                        `).get(id)["COUNT(*)"] || 0;
                    }
                } catch (error) {
                    console.error("Error consultando asignaciones:", error.message);
                }
            }

            return {
                ...tecnico,
                trabajosAsignados: asignados,
                trabajosTerminados: terminados,
                horas
            };
        });

    } catch (error) {
        console.error("Error técnicos:", error.message);
        return [];
    }
}


// =====================================================
// ACTIVIDAD RECIENTE
// =====================================================

function getActividad(limit = 8) {
    if (!tableExists("servicios_historial")) return [];

    try {
        const rows = db.prepare(`
            SELECT
                h.*,
                o.id AS orden_numero,
                c.nombre AS cliente_nombre

            FROM servicios_historial h

            LEFT JOIN servicios_ordenes o
                ON o.id = h.orden_id

            LEFT JOIN servicios_clientes c
                ON c.id = o.cliente_id

            ORDER BY h.fecha DESC

            LIMIT ?
        `).all(limit);

        return rows.map(row => ({
            ...row,
            titulo: row.accion || "Movimiento",
            detalle: row.detalle || "",
            fecha: row.fecha || "",
            icono: "fa-clock-rotate-left"
        }));

    } catch (error) {
        console.error("Error actividad:", error.message);
        return [];
    }
}


// =====================================================
// GRÁFICO FINANCIERO
// =====================================================

function getGrafico(period) {
    const inicio = getPeriodStart(period);
    const fin = new Date();

    const labels = [];
    const ingresos = [];
    const gastos = [];
    const resultado = [];

    const payments = getPagosPorFecha(
        formatDateKey(inicio),
        formatDateKey(fin)
    );

    const expenses = getGastosPorFecha(
        formatDateKey(inicio),
        formatDateKey(fin)
    );

    const paymentMap = new Map(
        payments.map(x => [
            x.dia,
            moneyNumber(x.total)
        ])
    );

    const expenseMap = new Map(
        expenses.map(x => [
            x.dia,
            moneyNumber(x.total)
        ])
    );

    const current = new Date(inicio);

    if (period === "year") {
        for (let i = 0; i < 12; i++) {
            const key =
                current.getFullYear() + "-" +
                String(current.getMonth() + 1).padStart(2, "0");

            const monthPayments = payments
                .filter(x => String(x.dia || "").startsWith(key))
                .reduce((sum, x) => sum + moneyNumber(x.total), 0);

            const monthExpenses = expenses
                .filter(x => String(x.dia || "").startsWith(key))
                .reduce((sum, x) => sum + moneyNumber(x.total), 0);

            labels.push(
                current.toLocaleDateString("es-AR", {
                    month: "short",
                    year: "2-digit"
                })
            );

            ingresos.push(monthPayments);
            gastos.push(monthExpenses);
            resultado.push(monthPayments - monthExpenses);

            current.setMonth(current.getMonth() + 1);
        }

    } else {
        const days = period === "week" ? 7 : 30;

        for (let i = 0; i < days; i++) {
            const key = formatDateKey(current);

            const income = paymentMap.get(key) || 0;
            const expense = expenseMap.get(key) || 0;

            labels.push(
                current.toLocaleDateString("es-AR", {
                    day: "2-digit",
                    month: "2-digit"
                })
            );

            ingresos.push(income);
            gastos.push(expense);
            resultado.push(income - expense);

            current.setDate(current.getDate() + 1);
        }
    }

    return {
        labels,
        ingresos,
        gastos,
        resultado
    };
}


// =====================================================
// MÉTRICAS FINANCIERAS
// =====================================================

function getFinanzas() {
    const totalFacturado = safeSum(
        "servicios_ordenes",
        "total"
    );

    const pagosRegistrados = getTotalPagos();

    const totalCobrado = pagosRegistrados !== null
        ? pagosRegistrados
        : safeSum("servicios_ordenes", "monto_cobrado");

    const porCobrar = Math.max(
        0,
        totalFacturado - totalCobrado
    );

    const gastos = getTotalGastos();
    const compras = getTotalCompras();

    const costoRepuestos = safeSum(
        "servicios_repuestos_orden",
        "costo_unitario"
    );

    // Se mantienen en cero hasta conectar las liquidaciones reales.
    const honorariosDevengados = 0;
    const honorariosPendientes = 0;

    const saldoCaja = totalCobrado - gastos;

    const resultado =
        totalFacturado -
        gastos -
        costoRepuestos -
        honorariosDevengados;

    return {
        facturado: totalFacturado,
        cobrado: totalCobrado,
        porCobrar,
        gastos,
        compras,
        costoRepuestos,
        honorariosDevengados,
        honorariosPendientes,
        saldoCaja,
        resultado,
        comprasPendientes: getComprasPendientes()
    };
}


// =====================================================
// ALERTAS
// =====================================================

function getAlertas(inventario, presupuestos, finanzas) {
    const alerts = [];

    if (inventario.sinStock > 0) {
        alerts.push({
            tipo: "critica",
            icono: "fa-box-open",
            titulo: "Artículos sin stock",
            detalle: `${inventario.sinStock} artículos necesitan reposición.`,
            url: "/panel/servicios-tecnicos/inventario"
        });
    }

    if (inventario.stockBajo > 0) {
        alerts.push({
            tipo: "aviso",
            icono: "fa-boxes-stacked",
            titulo: "Stock bajo",
            detalle: `${inventario.stockBajo} artículos están por debajo del mínimo.`,
            url: "/panel/servicios-tecnicos/inventario"
        });
    }

    if (presupuestos.porResponder > 0) {
        alerts.push({
            tipo: "aviso",
            icono: "fa-file-invoice-dollar",
            titulo: "Presupuestos pendientes",
            detalle: `${presupuestos.porResponder} presupuestos necesitan seguimiento.`,
            url: "/panel/servicios-tecnicos/presupuestos"
        });
    }

    if (finanzas.porCobrar > 0) {
        alerts.push({
            tipo: "aviso",
            icono: "fa-hand-holding-dollar",
            titulo: "Cobros pendientes",
            detalle: `${moneyNumber(finanzas.porCobrar).toLocaleString("es-AR")} pendientes de cobro.`,
            url: "/panel/servicios-tecnicos/ordenes"
        });
    }

    if (finanzas.honorariosPendientes > 0) {
        alerts.push({
            tipo: "aviso",
            icono: "fa-user-clock",
            titulo: "Honorarios pendientes",
            detalle: "Hay pagos pendientes al equipo técnico.",
            url: "/panel/servicios-tecnicos/tecnicos"
        });
    }

    return alerts;
}


// =====================================================
// CONSTRUIR DASHBOARD
// =====================================================

function getDashboard(period = "month") {
    const stats = getStats();
    const finanzas = getFinanzas();
    const presupuestos = getPresupuestos();
    const inventario = getInventario();
    const ordenesPorEstado = getOrdenesPorEstado();

    const totalOrdenes = safeCount("servicios_ordenes");

    const ordenesProgramadas = safeCount(
        "servicios_ordenes",
        "WHERE estado = 'programado'"
    );

    const ordenesEnProceso = safeCount(
        "servicios_ordenes",
        "WHERE estado IN ('en_proceso','en_camino')"
    );

    const ordenesPendientes = safeCount(
        "servicios_ordenes",
        "WHERE estado = 'pendiente'"
    );

    const ordenesAbiertas = safeCount(
        "servicios_ordenes",
        `WHERE estado IN (
            'pendiente',
            'programado',
            'en_camino',
            'en_proceso'
        )`
    );

    const ordenesTerminadas = stats.terminados;

    const clientesNuevosPeriodo = 0;
    const terminadasPeriodo = 0;

    const kpis = {
        clientesActivos: stats.clientes,
        clientesNuevosPeriodo,
        ordenesAbiertas,
        ordenesProgramadas,
        ordenesEnProceso,
        ordenesPendientes,
        ordenesTerminadas,
        terminadasPeriodo,
        totalOrdenes,
        facturado: finanzas.facturado,
        cobrado: finanzas.cobrado,
        porCobrar: finanzas.porCobrar,
        resultado: finanzas.resultado,
        gastos: finanzas.gastos,
        compras: finanzas.compras,
        costoRepuestos: finanzas.costoRepuestos,
        honorariosDevengados: finanzas.honorariosDevengados,
        honorariosPendientes: finanzas.honorariosPendientes,
        saldoCaja: finanzas.saldoCaja,
        comprasPendientes: finanzas.comprasPendientes
    };

    return {
        kpis,
        finanzas,
        presupuestos,
        inventario,
        agenda: getProximosTrabajos(8),
        tecnicos: getTecnicos(),
        alertas: getAlertas(inventario, presupuestos, finanzas),
        actividad: getActividad(8),
        clientesRecientes: getClientesRecientes(7),
        ordenesPorEstado,
        grafico: getGrafico(period)
    };
}


// =====================================================
// DASHBOARD PRINCIPAL
// =====================================================

router.get("/", (req, res) => {
    try {
        const user = getUserData(req);
        const periodo = getPeriod(req);
        const stats = getStats();
        const dashboard = getDashboard(periodo);

        res.render("servicios-tecnicos/dashboard", {
            user,

            username: user.username,
            role: user.role,

            stats,
            estadísticas: stats,

            dashboard,
            d: dashboard,

            proximosTrabajos: dashboard.agenda,
            ultimosTrabajos: getUltimosTrabajos(6),

            periodo
        });

    } catch (error) {
        console.error(
            "❌ Error dashboard Servicios Técnicos:",
            error
        );

        res.status(500).send(
            "Error cargando Servicios Técnicos"
        );
    }
});


// =====================================================
// CLIENTES
// =====================================================

router.get("/clientes", (req, res) => {
    try {
        const user = getUserData(req);

        const clientes = db.prepare(`
            SELECT *
            FROM servicios_clientes
            ORDER BY nombre ASC
        `).all();

        const estadísticas = {
            clientes: clientes.length,

            activos: clientes.filter(
                c => c.estado === "activo"
            ).length,

            inactivos: clientes.filter(
                c => c.estado === "inactivo"
            ).length
        };

        res.render("servicios-tecnicos/clientes", {
            user,
            username: user.username,
            role: user.role,

            clientes,
            estadísticas,
            stats: estadísticas,

            proximosTrabajos: getProximosTrabajos(8),
            ultimosTrabajos: getUltimosTrabajos(6)
        });

    } catch (error) {
        console.error("❌ Error cargando clientes:", error);

        res.status(500).send("Error cargando clientes");
    }
});


// =====================================================
// NUEVO CLIENTE
// =====================================================

router.post("/clientes/nuevo", (req, res) => {
    try {
        const {
            nombre,
            telefono,
            email,
            direccion,
            localidad,
            provincia,
            observaciones
        } = req.body;

        if (!nombre || !nombre.trim()) {
            return res.status(400).json({
                success: false,
                error: "El nombre del cliente es obligatorio"
            });
        }

        const resultado = db.prepare(`
            INSERT INTO servicios_clientes (
                nombre,
                telefono,
                email,
                direccion,
                localidad,
                provincia,
                observaciones,
                estado
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            nombre.trim(),
            telefono || null,
            email || null,
            direccion || null,
            localidad || null,
            provincia || null,
            observaciones || null,
            "activo"
        );

        res.json({
            success: true,
            id: resultado.lastInsertRowid,
            message: "Cliente creado correctamente"
        });

    } catch (error) {
        console.error("❌ Error creando cliente:", error);

        res.status(500).json({
            success: false,
            error: "No se pudo crear el cliente"
        });
    }
});


// =====================================================
// LISTADO DE ÓRDENES
// =====================================================

router.get("/ordenes", (req, res) => {
    try {
        const user = getUserData(req);

        const ordenes = db.prepare(`
            SELECT
                o.*,
                c.nombre AS cliente_nombre,
                c.telefono AS cliente_telefono,
                c.direccion AS cliente_direccion

            FROM servicios_ordenes o

            INNER JOIN servicios_clientes c
                ON c.id = o.cliente_id

            ORDER BY o.created_at DESC
        `).all();

        const statsOrdenes = {
            total: ordenes.length,

            pendientes: ordenes.filter(
                o => [
                    "pendiente",
                    "programado",
                    "en_camino",
                    "en_proceso"
                ].includes(o.estado)
            ).length,

            terminadas: ordenes.filter(
                o => [
                    "terminado",
                    "finalizado",
                    "completado"
                ].includes(o.estado)
            ).length
        };

        res.render("servicios-tecnicos/ordenes", {
            user,
            username: user.username,
            role: user.role,

            ordenes,
            stats: statsOrdenes,
            estadísticas: statsOrdenes,

            proximosTrabajos: getProximosTrabajos(8),
            ultimosTrabajos: getUltimosTrabajos(6)
        });

    } catch (error) {
        console.error("❌ Error cargando órdenes:", error);

        res.status(500).send("Error cargando órdenes");
    }
});


// =====================================================
// NUEVA ORDEN - FORMULARIO
// =====================================================

router.get("/ordenes/nueva", (req, res) => {
    try {
        const user = getUserData(req);

        const clientes = db.prepare(`
            SELECT *
            FROM servicios_clientes
            WHERE estado = 'activo'
            ORDER BY nombre ASC
        `).all();

        res.render("servicios-tecnicos/nueva-orden", {
            user,
            username: user.username,
            role: user.role,

            clientes,
            stats: getStats(),

            proximosTrabajos: getProximosTrabajos(8),
            ultimosTrabajos: getUltimosTrabajos(6)
        });

    } catch (error) {
        console.error("❌ Error cargando formulario:", error);

        res.status(500).send("Error cargando formulario");
    }
});


// =====================================================
// CREAR ORDEN
// =====================================================

router.post("/ordenes/nueva", (req, res) => {
    try {
        const user = getUserData(req);

        const {
            cliente_id,
            tipo_servicio,
            tipo_trabajo,
            equipo,
            marca,
            modelo,
            problema_reportado,
            diagnostico,
            trabajo_realizado,
            fecha_programada,
            mano_obra,
            costo_repuestos,
            total,
            monto_cobrado,
            observaciones
        } = req.body;

        if (!cliente_id || !tipo_servicio) {
            return res.status(400).send(
                "Debés seleccionar un cliente y un tipo de servicio"
            );
        }

        const cliente = db.prepare(`
            SELECT id
            FROM servicios_clientes
            WHERE id = ?
        `).get(cliente_id);

        if (!cliente) {
            return res.status(404).send(
                "El cliente seleccionado no existe"
            );
        }

        const crearOrden = db.transaction(() => {
            const resultado = db.prepare(`
                INSERT INTO servicios_ordenes (
                    cliente_id,
                    tipo_servicio,
                    tipo_trabajo,
                    equipo,
                    marca,
                    modelo,
                    problema_reportado,
                    diagnostico,
                    trabajo_realizado,
                    fecha_programada,
                    mano_obra,
                    costo_repuestos,
                    total,
                    monto_cobrado,
                    observaciones,
                    created_by
                ) VALUES (
                    ?, ?, ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?, ?, ?
                )
            `).run(
                Number(cliente_id),
                tipo_servicio,
                tipo_trabajo || null,
                equipo || null,
                marca || null,
                modelo || null,
                problema_reportado || null,
                diagnostico || null,
                trabajo_realizado || null,
                fecha_programada || null,
                moneyNumber(mano_obra),
                moneyNumber(costo_repuestos),
                moneyNumber(total),
                moneyNumber(monto_cobrado),
                observaciones || null,
                user.userId
            );

            db.prepare(`
                INSERT INTO servicios_historial (
                    orden_id,
                    accion,
                    detalle,
                    usuario_id
                ) VALUES (?, ?, ?, ?)
            `).run(
                resultado.lastInsertRowid,
                "Orden creada",
                "Se creó una nueva orden de trabajo",
                user.userId
            );

            return resultado.lastInsertRowid;
        });

        crearOrden();

        res.redirect("/panel/servicios-tecnicos/ordenes");

    } catch (error) {
        console.error("❌ Error creando orden:", error);

        res.status(500).send("Error creando orden de trabajo");
    }
});

// =====================================================
// DETALLE DE ORDEN
// GET /ordenes/:id
// =====================================================

router.get("/ordenes/:id", (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).send("ID de orden inválido.");
        }

        const user = getUserData(req);

        const orden = db.prepare(`
            SELECT
                o.*,
                c.nombre AS cliente_nombre,
                c.telefono AS cliente_telefono,
                c.email AS cliente_email,
                c.direccion AS cliente_direccion,
                c.localidad AS cliente_localidad,
                c.provincia AS cliente_provincia

            FROM servicios_ordenes o

            INNER JOIN servicios_clientes c
                ON c.id = o.cliente_id

            WHERE o.id = ?
        `).get(id);

        if (!orden) {
            return res.status(404).send("Orden no encontrada.");
        }

        const visitas = db.prepare(`
            SELECT *
            FROM servicios_visitas
            WHERE orden_id = ?
            ORDER BY numero_visita ASC, id ASC
        `).all(id);

        let historial = [];

        if (tableExists("servicios_historial")) {
            historial = db.prepare(`
                SELECT *
                FROM servicios_historial
                WHERE orden_id = ?
                ORDER BY fecha DESC, id DESC
            `).all(id);
        }

        res.render("servicios-tecnicos/orden-detalle", {
            user,
            username: user.username,
            role: user.role,
            orden,
            visitas,
            historial
        });

    } catch (error) {
        console.error("Error consultando orden:", error);
        res.status(500).send("No se pudo consultar la orden.");
    }
});
// =====================================================
// EXPORTAR ROUTER
// =====================================================

module.exports = router;