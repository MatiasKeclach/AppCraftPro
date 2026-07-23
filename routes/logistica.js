// ============================================================
// routes/logistica.js
// MÓDULO COMPLETO DE LOGÍSTICA - APPCRAFTPRO
// ============================================================

const express = require("express");
const router = express.Router();

const db = require("../models/db");
const isAuthenticated = require("../middleware/authMiddleware");

const QRCode = require("qrcode");
const path = require("path");
const fs = require("fs");


// ============================================================
// DASHBOARD LOGÍSTICA
// GET /panel/logistica
// ============================================================

router.get("/", isAuthenticated, (req, res) => {

    try {

        res.render("logistica/dashboard", {

            username:
                req.session.user.username,

            role:
                req.session.user.role

        });

    } catch (error) {

        console.error(
            "❌ Error cargando dashboard de logística:",
            error
        );

        res
            .status(500)
            .send("Error cargando el módulo de logística.");

    }

});


// ============================================================
// FLEX SCANNER
// GET /panel/logistica/flex-scanner
// ============================================================

router.get(
    "/flex-scanner",
    isAuthenticated,
    (req, res) => {

        try {

            const clientes = db.prepare(`

                SELECT *

                FROM logistica_clientes

                WHERE estado = 'activo'

                ORDER BY nombre ASC

            `).all();


            res.render(
                "logistica/flex-scanner",
                {

                    username:
                        req.session.user.username,

                    role:
                        req.session.user.role,

                    clientes

                }
            );


        } catch (error) {

            console.error(
                "❌ Error cargando Flex Scanner:",
                error
            );

            res
                .status(500)
                .send(
                    "Error cargando Flex Scanner"
                );

        }

    }
);


// ============================================================
// GUARDAR PAQUETE PARTICULAR
// POST /panel/logistica/flex-scanner/guardar
// ============================================================

router.post(
    "/flex-scanner/guardar",
    isAuthenticated,
    (req, res) => {

        try {

            const {

                cliente_id,
                codigo_externo,
                numero_orden,
                fecha_emision,
                peso,
                bultos,
                numero_bulto,
                remitente,
                destinatario,
                telefono,
                direccion,
                localidad,
                zona,
                observaciones

            } = req.body;


            // ------------------------------------------------
            // VALIDAR CLIENTE
            // ------------------------------------------------

            if (!cliente_id) {

                return res
                    .status(400)
                    .json({

                        ok: false,

                        mensaje:
                            "Debe seleccionar un cliente interno."

                    });

            }


            // ------------------------------------------------
            // GENERAR CÓDIGO INTERNO
            // ------------------------------------------------

            const ultimo = db.prepare(`

                SELECT id

                FROM logistica_paquetes

                ORDER BY id DESC

                LIMIT 1

            `).get();


            let numero = 1;


            if (ultimo) {

                numero =
                    Number(ultimo.id) + 1;

            }


            const codigoInterno =
                "PKG-" +
                String(numero).padStart(6, "0");


            // ------------------------------------------------
            // INSERTAR PAQUETE
            // ------------------------------------------------

            const resultado = db.prepare(`

                INSERT INTO logistica_paquetes

                (

                    cliente_id,

                    tipo,

                    codigo_externo,

                    codigo_interno,

                    numero_orden,

                    fecha_emision,

                    peso,

                    bultos,

                    numero_bulto,

                    remitente,

                    destinatario,

                    telefono,

                    direccion,

                    localidad,

                    zona,

                    observaciones,

                    colectado_por,

                    estado

                )

                VALUES

                (

                    ?,

                    'particular',

                    ?,

                    ?,

                    ?,

                    ?,

                    ?,

                    ?,

                    ?,

                    ?,

                    ?,

                    ?,

                    ?,

                    ?,

                    ?,

                    ?,

                    ?,

                    'recibido'

                )

            `).run(

                cliente_id,

                codigo_externo || null,

                codigoInterno,

                numero_orden || null,

                fecha_emision || null,

                peso || null,

                bultos || null,

                numero_bulto || null,

                remitente || null,

                destinatario || null,

                telefono || null,

                direccion || null,

                localidad || null,

                zona || null,

                observaciones || null,

                req.session.user.username

            );


            console.log(
                "📦 Paquete particular guardado:",
                codigoInterno
            );


            // ------------------------------------------------
            // RESPUESTA
            // ------------------------------------------------

            return res.json({

                ok: true,

                mensaje:
                    "Paquete guardado correctamente.",

                id:
                    resultado.lastInsertRowid,

                codigo_interno:
                    codigoInterno

            });


        } catch (error) {

            console.error(
                "❌ Error guardando paquete particular:",
                error
            );


            return res
                .status(500)
                .json({

                    ok: false,

                    mensaje:
                        "Error guardando paquete.",

                    error:
                        error.message

                });

        }

    }
);


// ============================================================
// CLIENTES
// ============================================================

// LISTADO
// GET /panel/logistica/clientes

router.get(
    "/clientes",
    isAuthenticated,
    (req, res) => {

        try {

            const clientes =
                db.prepare(`

                    SELECT *

                    FROM logistica_clientes

                    ORDER BY id DESC

                `).all();


            res.render(
                "logistica/clientes",
                {

                    username:
                        req.session.user.username,

                    clientes

                }
            );


        } catch (error) {

            console.error(
                "❌ Error cargando clientes:",
                error
            );


            res
                .status(500)
                .send(
                    "Error cargando clientes"
                );

        }

    }
);


// ============================================================
// CREAR CLIENTE
// POST /panel/logistica/clientes
// ============================================================

router.post(
    "/clientes",
    isAuthenticated,
    (req, res) => {

        try {

            const {

                nombre,
                empresa,
                telefono,
                email,
                direccion

            } = req.body;


            if (!nombre) {

                return res
                    .status(400)
                    .send(
                        "El nombre del cliente es obligatorio."
                    );

            }


            db.prepare(`

                INSERT INTO logistica_clientes

                (

                    nombre,

                    empresa,

                    telefono,

                    email,

                    direccion

                )

                VALUES (?, ?, ?, ?, ?)

            `).run(

                nombre,
                empresa || null,
                telefono || null,
                email || null,
                direccion || null

            );


            return res.redirect(
                "/panel/logistica/clientes"
            );


        } catch (error) {

            console.error(
                "❌ Error creando cliente:",
                error
            );


            return res
                .status(500)
                .send(
                    "Error creando cliente"
                );

        }

    }
);


// ============================================================
// FORMULARIO EDITAR CLIENTE
// GET /panel/logistica/clientes/editar/:id
// ============================================================

router.get(
    "/clientes/editar/:id",
    isAuthenticated,
    (req, res) => {

        try {

            const cliente =
                db.prepare(`

                    SELECT *

                    FROM logistica_clientes

                    WHERE id = ?

                `).get(
                    req.params.id
                );


            if (!cliente) {

                return res
                    .status(404)
                    .send(
                        "Cliente no encontrado"
                    );

            }


            return res.render(
                "logistica/editarCliente",
                {

                    username:
                        req.session.user.username,

                    cliente

                }
            );


        } catch (error) {

            console.error(
                "❌ Error buscando cliente:",
                error
            );


            return res
                .status(500)
                .send(
                    "Error buscando cliente"
                );

        }

    }
);


// ============================================================
// ACTUALIZAR CLIENTE
// POST /panel/logistica/clientes/editar/:id
// ============================================================

router.post(
    "/clientes/editar/:id",
    isAuthenticated,
    (req, res) => {

        try {

            const {

                nombre,
                empresa,
                telefono,
                email,
                direccion

            } = req.body;


            db.prepare(`

                UPDATE logistica_clientes

                SET

                    nombre = ?,

                    empresa = ?,

                    telefono = ?,

                    email = ?,

                    direccion = ?,

                    updated_at =
                        CURRENT_TIMESTAMP

                WHERE id = ?

            `).run(

                nombre,
                empresa || null,
                telefono || null,
                email || null,
                direccion || null,
                req.params.id

            );


            return res.redirect(
                "/panel/logistica/clientes"
            );


        } catch (error) {

            console.error(
                "❌ Error actualizando cliente:",
                error
            );


            return res
                .status(500)
                .send(
                    "Error actualizando cliente"
                );

        }

    }
);


// ============================================================
// ELIMINAR CLIENTE
// GET /panel/logistica/clientes/eliminar/:id
// ============================================================

router.get(
    "/clientes/eliminar/:id",
    isAuthenticated,
    (req, res) => {

        try {

            db.prepare(`

                DELETE FROM logistica_clientes

                WHERE id = ?

            `).run(
                req.params.id
            );


            return res.redirect(
                "/panel/logistica/clientes"
            );


        } catch (error) {

            console.error(
                "❌ Error eliminando cliente:",
                error
            );


            return res
                .status(500)
                .send(
                    "Error eliminando cliente"
                );

        }

    }
);


// ============================================================
// COLECTAS
// ============================================================

// LISTADO DE COLECTAS
// GET /panel/logistica/colectas

router.get(
    "/colectas",
    isAuthenticated,
    (req, res) => {

        try {

            const colectas =
                db.prepare(`

                    SELECT

                        logistica_colectas.*,

                        logistica_clientes.nombre
                        AS cliente_nombre

                    FROM logistica_colectas

                    INNER JOIN logistica_clientes

                    ON
                        logistica_colectas.cliente_id
                        =
                        logistica_clientes.id

                    ORDER BY
                        logistica_colectas.id DESC

                `).all();


            const clientes =
                db.prepare(`

                    SELECT *

                    FROM logistica_clientes

                    WHERE estado = 'activo'

                    ORDER BY nombre ASC

                `).all();


            res.render(
                "logistica/colectas",
                {

                    username:
                        req.session.user.username,

                    role:
                        req.session.user.role,

                    colectas,

                    clientes

                }
            );


        } catch (error) {

            console.error(
                "❌ Error cargando colectas:",
                error
            );


            res
                .status(500)
                .send(
                    "Error cargando colectas"
                );

        }

    }
);


// ============================================================
// CREAR COLECTA
// POST /panel/logistica/colectas
// ============================================================

router.post(
    "/colectas",
    isAuthenticated,
    (req, res) => {

        try {

            const {

                cliente_id,
                chofer,
                cantidad_paquetes,
                observaciones

            } = req.body;


            if (!cliente_id) {

                return res
                    .status(400)
                    .send(
                        "Debe seleccionar un cliente."
                    );

            }


            db.prepare(`

                INSERT INTO logistica_colectas

                (

                    cliente_id,

                    chofer,

                    cantidad_paquetes,

                    observaciones

                )

                VALUES (?, ?, ?, ?)

            `).run(

                cliente_id,

                chofer || null,

                Number(cantidad_paquetes) || 0,

                observaciones || null

            );


            return res.redirect(
                "/panel/logistica/colectas"
            );


        } catch (error) {

            console.error(
                "❌ Error creando colecta:",
                error
            );


            return res
                .status(500)
                .send(
                    "Error creando colecta"
                );

        }

    }
);


// ============================================================
// CHOFERES
// ============================================================

// LISTADO
// GET /panel/logistica/choferes

router.get(
    "/choferes",
    isAuthenticated,
    (req, res) => {

        try {

            const choferes =
                db.prepare(`

                    SELECT *

                    FROM logistica_choferes

                    ORDER BY id DESC

                `).all();


            res.render(
                "logistica/choferes",
                {

                    username:
                        req.session.user.username,

                    choferes

                }
            );


        } catch (error) {

            console.error(
                "❌ Error cargando choferes:",
                error
            );


            res
                .status(500)
                .send(
                    "Error cargando choferes"
                );

        }

    }
);


// ============================================================
// CREAR CHOFER
// POST /panel/logistica/choferes
// ============================================================

router.post(
    "/choferes",
    isAuthenticated,
    (req, res) => {

        try {

            const {

                nombre,
                telefono,
                vehiculo,
                patente,
                estado

            } = req.body;


            if (!nombre) {

                return res
                    .status(400)
                    .send(
                        "El nombre del chofer es obligatorio."
                    );

            }


            db.prepare(`

                INSERT INTO logistica_choferes

                (

                    nombre,

                    telefono,

                    vehiculo,

                    patente,

                    estado

                )

                VALUES (?, ?, ?, ?, ?)

            `).run(

                nombre,

                telefono || null,

                vehiculo || null,

                patente || null,

                estado || "activo"

            );


            return res.redirect(
                "/panel/logistica/choferes"
            );


        } catch (error) {

            console.error(
                "❌ Error creando chofer:",
                error
            );


            return res
                .status(500)
                .send(
                    "Error creando chofer"
                );

        }

    }
);


// ============================================================
// EDITAR CHOFER
// GET /panel/logistica/choferes/editar/:id
// ============================================================

router.get(
    "/choferes/editar/:id",
    isAuthenticated,
    (req, res) => {

        try {

            const chofer =
                db.prepare(`

                    SELECT *

                    FROM logistica_choferes

                    WHERE id = ?

                `).get(
                    req.params.id
                );


            if (!chofer) {

                return res
                    .status(404)
                    .send(
                        "Chofer no encontrado"
                    );

            }


            return res.render(
                "logistica/editarChofer",
                {

                    username:
                        req.session.user.username,

                    chofer

                }
            );


        } catch (error) {

            console.error(
                "❌ Error buscando chofer:",
                error
            );


            return res
                .status(500)
                .send(
                    "Error buscando chofer"
                );

        }

    }
);


// ============================================================
// ACTUALIZAR CHOFER
// POST /panel/logistica/choferes/editar/:id
// ============================================================

router.post(
    "/choferes/editar/:id",
    isAuthenticated,
    (req, res) => {

        try {

            const {

                nombre,
                telefono,
                vehiculo,
                patente,
                estado

            } = req.body;


            db.prepare(`

                UPDATE logistica_choferes

                SET

                    nombre = ?,

                    telefono = ?,

                    vehiculo = ?,

                    patente = ?,

                    estado = ?

                WHERE id = ?

            `).run(

                nombre,
                telefono || null,
                vehiculo || null,
                patente || null,
                estado || "activo",
                req.params.id

            );


            return res.redirect(
                "/panel/logistica/choferes"
            );


        } catch (error) {

            console.error(
                "❌ Error actualizando chofer:",
                error
            );


            return res
                .status(500)
                .send(
                    "Error actualizando chofer"
                );

        }

    }
);


// ============================================================
// ELIMINAR CHOFER
// GET /panel/logistica/choferes/eliminar/:id
// ============================================================

router.get(
    "/choferes/eliminar/:id",
    isAuthenticated,
    (req, res) => {

        try {

            db.prepare(`

                DELETE FROM logistica_choferes

                WHERE id = ?

            `).run(
                req.params.id
            );


            return res.redirect(
                "/panel/logistica/choferes"
            );


        } catch (error) {

            console.error(
                "❌ Error eliminando chofer:",
                error
            );


            return res
                .status(500)
                .send(
                    "Error eliminando chofer"
                );

        }

    }
);


// ============================================================
// PAQUETES
// ============================================================

// LISTADO DE PAQUETES
// GET /panel/logistica/paquetes

router.get(
    "/paquetes",
    isAuthenticated,
    (req, res) => {

        try {

            const paquetes =
                db.prepare(`

                    SELECT

                        logistica_paquetes.*,

                        logistica_clientes.nombre
                        AS cliente_nombre

                    FROM logistica_paquetes

                    INNER JOIN logistica_clientes

                    ON
                        logistica_paquetes.cliente_id
                        =
                        logistica_clientes.id

                    ORDER BY
                        logistica_paquetes.id DESC

                `).all();


            const clientes =
                db.prepare(`

                    SELECT *

                    FROM logistica_clientes

                    WHERE estado = 'activo'

                    ORDER BY nombre ASC

                `).all();


            res.render(
                "logistica/paquetes",
                {

                    username:
                        req.session.user.username,

                    role:
                        req.session.user.role,

                    paquetes,

                    clientes

                }
            );


        } catch (error) {

            console.error(
                "❌ Error cargando paquetes:",
                error
            );


            res
                .status(500)
                .send(
                    "Error cargando paquetes"
                );

        }

    }
);


// ============================================================
// CREAR PAQUETE
// POST /panel/logistica/paquetes
// ============================================================

router.post(
    "/paquetes",
    isAuthenticated,
    async (req, res) => {

        try {

            const {

                cliente_id,
                tipo,
                codigo_externo,
                descripcion

            } = req.body;


            if (!cliente_id) {

                return res
                    .status(400)
                    .send(
                        "Debe seleccionar un cliente."
                    );

            }


            // ------------------------------------------------
            // GENERAR CÓDIGO INTERNO
            // ------------------------------------------------

            const ultimo =
                db.prepare(`

                    SELECT id

                    FROM logistica_paquetes

                    ORDER BY id DESC

                    LIMIT 1

                `).get();


            let numero = 1;


            if (ultimo) {

                numero =
                    Number(ultimo.id) + 1;

            }


            const codigoInterno =
                "PKG-" +
                String(numero).padStart(6, "0");


            // ------------------------------------------------
            // GENERAR QR
            // ------------------------------------------------

            const qrNombre =
                codigoInterno + ".png";


            const carpetaQR =
                path.join(
                    __dirname,
                    "../public/uploads/qr"
                );


            if (
                !fs.existsSync(carpetaQR)
            ) {

                fs.mkdirSync(
                    carpetaQR,
                    {
                        recursive: true
                    }
                );

            }


            const rutaQR =
                path.join(
                    carpetaQR,
                    qrNombre
                );


            await QRCode.toFile(

                rutaQR,

                codigoInterno

            );


            // ------------------------------------------------
            // GUARDAR PAQUETE
            // ------------------------------------------------

            db.prepare(`

                INSERT INTO logistica_paquetes

                (

                    cliente_id,

                    tipo,

                    codigo_externo,

                    codigo_interno,

                    qr_codigo,

                    descripcion,

                    colectado_por

                )

                VALUES (?, ?, ?, ?, ?, ?, ?)

            `).run(

                cliente_id,

                tipo || "flex",

                codigo_externo || null,

                codigoInterno,

                "/uploads/qr/" +
                    qrNombre,

                descripcion || null,

                req.session.user.username

            );


            console.log(
                "📦 Paquete creado:",
                codigoInterno
            );


            return res.redirect(
                "/panel/logistica/paquetes"
            );


        } catch (error) {

            console.error(
                "❌ Error creando paquete:",
                error
            );


            return res
                .status(500)
                .send(
                    "Error creando paquete"
                );

        }

    }
);


// ============================================================
// API AUXILIAR PARA MERCADO LIBRE
//
// Estas rutas NO reemplazan mercadolibre.js.
// Sirven para que mercadolibre.ejs pueda consultar
// información logística desde el frontend.
//
// GET /panel/logistica/api/clientes
// GET /panel/logistica/api/choferes
// GET /panel/logistica/api/paquetes
// ============================================================


// ------------------------------------------------------------
// CLIENTES
// ------------------------------------------------------------

router.get(
    "/api/clientes",
    isAuthenticated,
    (req, res) => {

        try {

            const clientes =
                db.prepare(`

                    SELECT

                        id,

                        nombre,

                        empresa,

                        telefono,

                        email,

                        direccion,

                        localidad,

                        provincia,

                        estado

                    FROM logistica_clientes

                    WHERE estado = 'activo'

                    ORDER BY nombre ASC

                `).all();


            return res.json({

                ok: true,

                clientes

            });


        } catch (error) {

            console.error(
                "❌ Error API clientes:",
                error
            );


            return res
                .status(500)
                .json({

                    ok: false,

                    mensaje:
                        "Error obteniendo clientes."

                });

        }

    }
);


// ------------------------------------------------------------
// CHOFERES
// ------------------------------------------------------------

router.get(
    "/api/choferes",
    isAuthenticated,
    (req, res) => {

        try {

            const choferes =
                db.prepare(`

                    SELECT

                        id,

                        nombre,

                        telefono,

                        vehiculo,

                        patente,

                        estado

                    FROM logistica_choferes

                    WHERE estado = 'activo'

                    ORDER BY nombre ASC

                `).all();


            return res.json({

                ok: true,

                choferes

            });


        } catch (error) {

            console.error(
                "❌ Error API choferes:",
                error
            );


            return res
                .status(500)
                .json({

                    ok: false,

                    mensaje:
                        "Error obteniendo choferes."

                });

        }

    }
);


// ------------------------------------------------------------
// PAQUETES
// ------------------------------------------------------------

router.get(
    "/api/paquetes",
    isAuthenticated,
    (req, res) => {

        try {

            const paquetes =
                db.prepare(`

                    SELECT

                        p.*,

                        c.nombre
                        AS cliente_nombre,

                        c.empresa
                        AS cliente_empresa

                    FROM logistica_paquetes p

                    LEFT JOIN logistica_clientes c

                    ON
                        p.cliente_id
                        =
                        c.id

                    ORDER BY
                        p.id DESC

                `).all();


            return res.json({

                ok: true,

                paquetes

            });


        } catch (error) {

            console.error(
                "❌ Error API paquetes:",
                error
            );


            return res
                .status(500)
                .json({

                    ok: false,

                    mensaje:
                        "Error obteniendo paquetes."

                });

        }

    }
);


// ============================================================
// EXPORTAR ROUTER
// ============================================================

module.exports = router;