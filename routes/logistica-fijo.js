const express = require("express");
const router = express.Router();

const db = require("../models/db");
const isAuthenticated = require("../middleware/authMiddleware");

const QRCode = require("qrcode");
const path = require("path");
const fs = require("fs");


// ============================================================
// HELPER
// ============================================================

function usuarioActual(req) {

    return (
        req.session?.user?.username ||
        req.session?.username ||
        "Usuario"
    );

}


// ============================================================
// DASHBOARD LOGÍSTICA
// ============================================================

router.get("/", isAuthenticated, (req, res) => {

    try {

        res.render("logistica/dashboard", {

            username: usuarioActual(req),

            role:
                req.session?.user?.role || ""

        });

    } catch (error) {

        console.error(
            "❌ Error cargando dashboard logística:",
            error
        );

        return res.status(500).send(
            "Error cargando dashboard de logística."
        );

    }

});


// ============================================================
// ============================================================
// DEPÓSITO - MÓDULO INDEPENDIENTE
// ============================================================
// ============================================================


// ============================================================
// DEPÓSITO - PÁGINA
// GET /panel/logistica/deposito
// ============================================================

router.get(
    "/deposito",
    isAuthenticated,
    (req, res) => {

        try {

            return res.render(
                "logistica/deposito",
                {

                    username:
                        usuarioActual(req),

                    role:
                        req.session?.user?.role || ""

                }
            );

        } catch (error) {

            console.error(
                "❌ Error cargando depósito:",
                error
            );

            return res.status(500).send(
                "Error cargando el módulo de depósito."
            );

        }

    }
);


// ============================================================
// DEPÓSITO - DATOS GENERALES
// GET /panel/logistica/deposito/api/datos
// ============================================================

router.get(
    "/deposito/api/datos",
    isAuthenticated,
    (req, res) => {

        try {

            // ------------------------------------------------
            // PAQUETES
            // ------------------------------------------------

            const paquetesTotal = db.prepare(`
                SELECT COUNT(*) AS total
                FROM logistica_paquetes
            `).get();


            const paquetesRecibidos = db.prepare(`
                SELECT COUNT(*) AS total
                FROM logistica_paquetes
                WHERE estado = 'recibido'
            `).get();


            const paquetesPendientes = db.prepare(`
                SELECT COUNT(*) AS total
                FROM logistica_paquetes
                WHERE estado IN (
                    'pendiente',
                    'pendiente_colecta',
                    'en_espera'
                )
            `).get();


            const paquetesColectados = db.prepare(`
                SELECT COUNT(*) AS total
                FROM logistica_paquetes
                WHERE colecta_id IS NOT NULL
            `).get();


            // ------------------------------------------------
            // CLIENTES
            // ------------------------------------------------

            const clientesTotal = db.prepare(`
                SELECT COUNT(*) AS total
                FROM logistica_clientes
                WHERE estado = 'activo'
                   OR estado IS NULL
            `).get();


            // ------------------------------------------------
            // COLECTAS
            // ------------------------------------------------

            const colectasTotal = db.prepare(`
                SELECT COUNT(*) AS total
                FROM logistica_colectas
            `).get();


            // ------------------------------------------------
            // CHOFERES
            // ------------------------------------------------

            let choferesTotal = { total: 0 };

            try {

                choferesTotal = db.prepare(`
                    SELECT COUNT(*) AS total
                    FROM logistica_choferes
                    WHERE estado = 'activo'
                       OR estado IS NULL
                `).get();

            } catch (e) {

                console.warn(
                    "⚠️ No se pudo consultar choferes:",
                    e.message
                );

            }


            // ------------------------------------------------
            // ÚLTIMOS PAQUETES
            // ------------------------------------------------

            const paquetes = db.prepare(`
                SELECT

                    p.id,
                    p.codigo_interno,
                    p.codigo_externo,
                    p.tipo,
                    p.estado,
                    p.descripcion,
                    p.colecta_id,
                    p.created_at,

                    c.nombre AS cliente_nombre

                FROM logistica_paquetes p

                LEFT JOIN logistica_clientes c
                    ON p.cliente_id = c.id

                ORDER BY p.id DESC

                LIMIT 50

            `).all();


            // ------------------------------------------------
            // RESPUESTA
            // ------------------------------------------------

            return res.json({

                ok: true,

                resumen: {

                    paquetes:
                        paquetesTotal?.total || 0,

                    recibidos:
                        paquetesRecibidos?.total || 0,

                    pendientes:
                        paquetesPendientes?.total || 0,

                    colectados:
                        paquetesColectados?.total || 0,

                    clientes:
                        clientesTotal?.total || 0,

                    colectas:
                        colectasTotal?.total || 0,

                    choferes:
                        choferesTotal?.total || 0

                },

                paquetes

            });

        } catch (error) {

            console.error(
                "❌ ERROR API DEPÓSITO /datos:",
                error
            );

            return res.status(500).json({

                ok: false,

                mensaje:
                    "Error cargando datos del depósito.",

                error:
                    error.message

            });

        }

    }
);


// ============================================================
// DEPÓSITO - CLIENTES
// GET /panel/logistica/deposito/api/clientes
// ============================================================

router.get(
    "/deposito/api/clientes",
    isAuthenticated,
    (req, res) => {

        try {

            const clientes = db.prepare(`
                SELECT

                    id,
                    nombre,
                    empresa,
                    telefono,
                    email,
                    direccion,
                    estado,
                    created_at,
                    updated_at

                FROM logistica_clientes

                ORDER BY nombre ASC

            `).all();


            return res.json({

                ok: true,

                clientes

            });

        } catch (error) {

            console.error(
                "❌ ERROR API DEPÓSITO /clientes:",
                error
            );

            return res.status(500).json({

                ok: false,

                mensaje:
                    "Error cargando clientes.",

                error:
                    error.message

            });

        }

    }
);


// ============================================================
// DEPÓSITO - CREAR CLIENTE
// POST /panel/logistica/deposito/api/clientes
// ============================================================

router.post(
    "/deposito/api/clientes",
    isAuthenticated,
    (req, res) => {

        try {

            const nombre =
                String(
                    req.body?.nombre || ""
                ).trim();


            const empresa =
                String(
                    req.body?.empresa || ""
                ).trim();


            const telefono =
                String(
                    req.body?.telefono || ""
                ).trim();


            const email =
                String(
                    req.body?.email || ""
                ).trim();


            const direccion =
                String(
                    req.body?.direccion || ""
                ).trim();


            // ------------------------------------------------
            // VALIDAR
            // ------------------------------------------------

            if (!nombre) {

                return res.status(400).json({

                    ok: false,

                    mensaje:
                        "El nombre del cliente es obligatorio."

                });

            }


            // ------------------------------------------------
            // INSERTAR
            // ------------------------------------------------

            const resultado = db.prepare(`
                INSERT INTO logistica_clientes
                (
                    nombre,
                    empresa,
                    telefono,
                    email,
                    direccion,
                    estado
                )

                VALUES
                (?, ?, ?, ?, ?, ?)

            `).run(

                nombre,
                empresa,
                telefono,
                email,
                direccion,
                "activo"

            );


            // ------------------------------------------------
            // OBTENER CLIENTE
            // ------------------------------------------------

            const cliente = db.prepare(`
                SELECT

                    id,
                    nombre,
                    empresa,
                    telefono,
                    email,
                    direccion,
                    estado,
                    created_at,
                    updated_at

                FROM logistica_clientes

                WHERE id = ?

            `).get(
                resultado.lastInsertRowid
            );


            console.log(
                "✅ DEPÓSITO - Cliente creado:",
                cliente
            );


            return res.status(201).json({

                ok: true,

                mensaje:
                    "Cliente creado correctamente.",

                cliente

            });

        } catch (error) {

            console.error(
                "❌ DEPÓSITO - Error creando cliente:",
                error
            );

            return res.status(500).json({

                ok: false,

                mensaje:
                    "Error creando cliente.",

                error:
                    error.message

            });

        }

    }
);


// ============================================================
// DEPÓSITO - ACTUALIZAR CLIENTE
// PUT /panel/logistica/deposito/api/clientes/:id
// ============================================================

router.put(
    "/deposito/api/clientes/:id",
    isAuthenticated,
    (req, res) => {

        try {

            const id =
                Number(req.params.id);


            if (!Number.isInteger(id)) {

                return res.status(400).json({

                    ok: false,

                    mensaje:
                        "ID de cliente inválido."

                });

            }


            const nombre =
                String(
                    req.body?.nombre || ""
                ).trim();


            const empresa =
                String(
                    req.body?.empresa || ""
                ).trim();


            const telefono =
                String(
                    req.body?.telefono || ""
                ).trim();


            const email =
                String(
                    req.body?.email || ""
                ).trim();


            const direccion =
                String(
                    req.body?.direccion || ""
                ).trim();


            if (!nombre) {

                return res.status(400).json({

                    ok: false,

                    mensaje:
                        "El nombre del cliente es obligatorio."

                });

            }


            const resultado = db.prepare(`
                UPDATE logistica_clientes

                SET

                    nombre = ?,
                    empresa = ?,
                    telefono = ?,
                    email = ?,
                    direccion = ?,
                    updated_at = CURRENT_TIMESTAMP

                WHERE id = ?

            `).run(

                nombre,
                empresa,
                telefono,
                email,
                direccion,
                id

            );


            if (resultado.changes === 0) {

                return res.status(404).json({

                    ok: false,

                    mensaje:
                        "Cliente no encontrado."

                });

            }


            const cliente = db.prepare(`
                SELECT *

                FROM logistica_clientes

                WHERE id = ?

            `).get(id);


            return res.json({

                ok: true,

                mensaje:
                    "Cliente actualizado correctamente.",

                cliente

            });

        } catch (error) {

            console.error(
                "❌ DEPÓSITO - Error actualizando cliente:",
                error
            );

            return res.status(500).json({

                ok: false,

                mensaje:
                    "Error actualizando cliente.",

                error:
                    error.message

            });

        }

    }
);


// ============================================================
// DEPÓSITO - ELIMINAR CLIENTE
// DELETE /panel/logistica/deposito/api/clientes/:id
// ============================================================

router.delete(
    "/deposito/api/clientes/:id",
    isAuthenticated,
    (req, res) => {

        try {

            const id =
                Number(req.params.id);


            if (!Number.isInteger(id)) {

                return res.status(400).json({

                    ok: false,

                    mensaje:
                        "ID de cliente inválido."

                });

            }


            const cliente = db.prepare(`
                SELECT id, nombre

                FROM logistica_clientes

                WHERE id = ?

            `).get(id);


            if (!cliente) {

                return res.status(404).json({

                    ok: false,

                    mensaje:
                        "Cliente no encontrado."

                });

            }


            // ------------------------------------------------
            // VERIFICAR SI TIENE PAQUETES
            // ------------------------------------------------

            const paquetes = db.prepare(`
                SELECT COUNT(*) AS total

                FROM logistica_paquetes

                WHERE cliente_id = ?

            `).get(id);


            if (paquetes.total > 0) {

                return res.status(409).json({

                    ok: false,

                    mensaje:
                        "No se puede eliminar el cliente porque tiene paquetes asociados."

                });

            }


            // ------------------------------------------------
            // VERIFICAR SI TIENE COLECTAS
            // ------------------------------------------------

            const colectas = db.prepare(`
                SELECT COUNT(*) AS total

                FROM logistica_colectas

                WHERE cliente_id = ?

            `).get(id);


            if (colectas.total > 0) {

                return res.status(409).json({

                    ok: false,

                    mensaje:
                        "No se puede eliminar el cliente porque tiene colectas asociadas."

                });

            }


            db.prepare(`
                DELETE FROM logistica_clientes

                WHERE id = ?

            `).run(id);


            console.log(
                "🗑️ DEPÓSITO - Cliente eliminado:",
                cliente
            );


            return res.json({

                ok: true,

                mensaje:
                    "Cliente eliminado correctamente."

            });

        } catch (error) {

            console.error(
                "❌ DEPÓSITO - Error eliminando cliente:",
                error
            );

            return res.status(500).json({

                ok: false,

                mensaje:
                    "Error eliminando cliente.",

                error:
                    error.message

            });

        }

    }
);


// ============================================================
// DEPÓSITO - COLECTAS
// GET /panel/logistica/deposito/api/colectas
// ============================================================

router.get(
    "/deposito/api/colectas",
    isAuthenticated,
    (req, res) => {

        try {

            const colectas = db.prepare(`
                SELECT

                    c.id,
                    c.cliente_id,
                    c.fecha,
                    c.chofer,
                    c.chofer_id,
                    c.cantidad_paquetes,
                    c.observaciones,
                    c.estado,
                    c.created_at,

                    cl.nombre AS cliente_nombre,

                    COUNT(p.id) AS paquetes_reales

                FROM logistica_colectas c

                LEFT JOIN logistica_clientes cl
                    ON c.cliente_id = cl.id

                LEFT JOIN logistica_paquetes p
                    ON p.colecta_id = c.id

                GROUP BY c.id

                ORDER BY c.id DESC

            `).all();


            return res.json({

                ok: true,

                colectas

            });

        } catch (error) {

            console.error(
                "❌ DEPÓSITO - Error cargando colectas:",
                error
            );

            return res.status(500).json({

                ok: false,

                mensaje:
                    "Error cargando colectas.",

                error:
                    error.message

            });

        }

    }
);


// ============================================================
// DEPÓSITO - CREAR COLECTA
// POST /panel/logistica/deposito/api/colectas
// ============================================================

router.post(
    "/deposito/api/colectas",
    isAuthenticated,
    (req, res) => {

        try {

            const cliente_id =
                Number(req.body?.cliente_id);


            const chofer =
                String(
                    req.body?.chofer || ""
                ).trim();


            const chofer_id =
                req.body?.chofer_id
                    ? Number(req.body.chofer_id)
                    : null;


            const cantidad_paquetes =
                Number(
                    req.body?.cantidad_paquetes || 0
                );


            const observaciones =
                String(
                    req.body?.observaciones || ""
                ).trim();


            const fecha =
                req.body?.fecha ||
                new Date().toISOString();


            if (!Number.isInteger(cliente_id)) {

                return res.status(400).json({

                    ok: false,

                    mensaje:
                        "Debe seleccionar un cliente."

                });

            }


            const cliente = db.prepare(`
                SELECT id

                FROM logistica_clientes

                WHERE id = ?

            `).get(cliente_id);


            if (!cliente) {

                return res.status(404).json({

                    ok: false,

                    mensaje:
                        "El cliente seleccionado no existe."

                });

            }


            const resultado = db.prepare(`
                INSERT INTO logistica_colectas

                (
                    cliente_id,
                    fecha,
                    chofer,
                    chofer_id,
                    cantidad_paquetes,
                    observaciones,
                    estado
                )

                VALUES
                (?, ?, ?, ?, ?, ?, ?)

            `).run(

                cliente_id,
                fecha,
                chofer,
                chofer_id,
                cantidad_paquetes,
                observaciones,
                "pendiente"

            );


            const colecta = db.prepare(`
                SELECT *

                FROM logistica_colectas

                WHERE id = ?

            `).get(
                resultado.lastInsertRowid
            );


            console.log(
                "🚚 DEPÓSITO - Colecta creada:",
                colecta
            );


            return res.status(201).json({

                ok: true,

                mensaje:
                    "Colecta creada correctamente.",

                colecta

            });

        } catch (error) {

            console.error(
                "❌ DEPÓSITO - Error creando colecta:",
                error
            );

            return res.status(500).json({

                ok: false,

                mensaje:
                    "Error creando colecta.",

                error:
                    error.message

            });

        }

    }
);


// ============================================================
// DEPÓSITO - ELIMINAR COLECTA
// DELETE /panel/logistica/deposito/api/colectas/:id
// ============================================================

router.delete(
    "/deposito/api/colectas/:id",
    isAuthenticated,
    (req, res) => {

        try {

            const id =
                Number(req.params.id);


            if (!Number.isInteger(id)) {

                return res.status(400).json({

                    ok: false,

                    mensaje:
                        "ID de colecta inválido."

                });

            }


            // ------------------------------------------------
            // DESVINCULAR PAQUETES
            // ------------------------------------------------

            db.prepare(`
                UPDATE logistica_paquetes

                SET colecta_id = NULL

                WHERE colecta_id = ?

            `).run(id);


            // ------------------------------------------------
            // ELIMINAR COLECTA
            // ------------------------------------------------

            const resultado = db.prepare(`
                DELETE FROM logistica_colectas

                WHERE id = ?

            `).run(id);


            if (resultado.changes === 0) {

                return res.status(404).json({

                    ok: false,

                    mensaje:
                        "Colecta no encontrada."

                });

            }


            console.log(
                "🗑️ DEPÓSITO - Colecta eliminada:",
                id
            );


            return res.json({

                ok: true,

                mensaje:
                    "Colecta eliminada correctamente."

            });

        } catch (error) {

            console.error(
                "❌ DEPÓSITO - Error eliminando colecta:",
                error
            );

            return res.status(500).json({

                ok: false,

                mensaje:
                    "Error eliminando colecta.",

                error:
                    error.message

            });

        }

    }
);


// ============================================================
// DEPÓSITO - PAQUETES
// GET /panel/logistica/deposito/api/paquetes
// ============================================================

router.get(
    "/deposito/api/paquetes",
    isAuthenticated,
    (req, res) => {

        try {

            const paquetes = db.prepare(`
                SELECT

                    p.*,

                    c.nombre AS cliente_nombre

                FROM logistica_paquetes p

                LEFT JOIN logistica_clientes c
                    ON p.cliente_id = c.id

                ORDER BY p.id DESC

            `).all();


            return res.json({

                ok: true,

                paquetes

            });

        } catch (error) {

            console.error(
                "❌ DEPÓSITO - Error cargando paquetes:",
                error
            );

            return res.status(500).json({

                ok: false,

                mensaje:
                    "Error cargando paquetes.",

                error:
                    error.message

            });

        }

    }
);


// ============================================================
// DEPÓSITO - PAQUETES DE UNA COLECTA
// GET /panel/logistica/deposito/api/colectas/:id/paquetes
// ============================================================

router.get(
    "/deposito/api/colectas/:id/paquetes",
    isAuthenticated,
    (req, res) => {

        try {

            const id =
                Number(req.params.id);


            if (!Number.isInteger(id)) {

                return res.status(400).json({

                    ok: false,

                    mensaje:
                        "ID de colecta inválido."

                });

            }


            const paquetes = db.prepare(`
                SELECT

                    p.*,

                    c.nombre AS cliente_nombre

                FROM logistica_paquetes p

                LEFT JOIN logistica_clientes c
                    ON p.cliente_id = c.id

                WHERE p.colecta_id = ?

                ORDER BY p.id DESC

            `).all(id);


            return res.json({

                ok: true,

                paquetes

            });

        } catch (error) {

            console.error(
                "❌ DEPÓSITO - Error cargando paquetes de colecta:",
                error
            );

            return res.status(500).json({

                ok: false,

                mensaje:
                    "Error cargando paquetes de la colecta.",

                error:
                    error.message

            });

        }

    }
);


// ============================================================
// DEPÓSITO - CREAR PAQUETE
// POST /panel/logistica/deposito/api/paquetes
// ============================================================

router.post(
    "/deposito/api/paquetes",
    isAuthenticated,
    async (req, res) => {

        try {

            const cliente_id =
                Number(req.body?.cliente_id);


            const tipo =
                String(
                    req.body?.tipo || "particular"
                ).trim();


            const codigo_externo =
                String(
                    req.body?.codigo_externo || ""
                ).trim();


            const descripcion =
                String(
                    req.body?.descripcion || ""
                ).trim();


            if (!Number.isInteger(cliente_id)) {

                return res.status(400).json({

                    ok: false,

                    mensaje:
                        "Debe seleccionar un cliente."

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


            const numero =
                ultimo
                    ? ultimo.id + 1
                    : 1;


            const codigoInterno =
                "PKG-" +
                String(numero).padStart(6, "0");


            // ------------------------------------------------
            // QR
            // ------------------------------------------------

            const qrNombre =
                codigoInterno + ".png";


            const carpetaQR =
                path.join(
                    __dirname,
                    "../public/uploads/qr"
                );


            if (!fs.existsSync(carpetaQR)) {

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
            // INSERTAR
            // ------------------------------------------------

            const resultado = db.prepare(`
                INSERT INTO logistica_paquetes

                (
                    cliente_id,
                    tipo,
                    codigo_externo,
                    codigo_interno,
                    qr_codigo,
                    descripcion,
                    colectado_por,
                    estado
                )

                VALUES
                (?, ?, ?, ?, ?, ?, ?, ?)

            `).run(

                cliente_id,
                tipo,
                codigo_externo,
                codigoInterno,
                "/uploads/qr/" + qrNombre,
                descripcion,
                usuarioActual(req),
                "recibido"

            );


            const paquete = db.prepare(`
                SELECT *

                FROM logistica_paquetes

                WHERE id = ?

            `).get(
                resultado.lastInsertRowid
            );


            console.log(
                "📦 DEPÓSITO - Paquete creado:",
                codigoInterno
            );


            return res.status(201).json({

                ok: true,

                mensaje:
                    "Paquete creado correctamente.",

                paquete

            });

        } catch (error) {

            console.error(
                "❌ DEPÓSITO - Error creando paquete:",
                error
            );

            return res.status(500).json({

                ok: false,

                mensaje:
                    "Error creando paquete.",

                error:
                    error.message

            });

        }

    }
);


// ============================================================
// DEPÓSITO - ELIMINAR PAQUETE
// DELETE /panel/logistica/deposito/api/paquetes/:id
// ============================================================

router.delete(
    "/deposito/api/paquetes/:id",
    isAuthenticated,
    (req, res) => {

        try {

            const id =
                Number(req.params.id);


            if (!Number.isInteger(id)) {

                return res.status(400).json({

                    ok: false,

                    mensaje:
                        "ID de paquete inválido."

                });

            }


            const paquete = db.prepare(`
                SELECT *

                FROM logistica_paquetes

                WHERE id = ?

            `).get(id);


            if (!paquete) {

                return res.status(404).json({

                    ok: false,

                    mensaje:
                        "Paquete no encontrado."

                });

            }


            db.prepare(`
                DELETE FROM logistica_paquetes

                WHERE id = ?

            `).run(id);


            // ------------------------------------------------
            // ELIMINAR QR
            // ------------------------------------------------

            if (paquete.qr_codigo) {

                const nombreQR =
                    path.basename(
                        paquete.qr_codigo
                    );


                const rutaQR =
                    path.join(
                        __dirname,
                        "../public/uploads/qr",
                        nombreQR
                    );


                if (fs.existsSync(rutaQR)) {

                    try {

                        fs.unlinkSync(rutaQR);

                    } catch (e) {

                        console.warn(
                            "⚠️ No se pudo eliminar QR:",
                            e.message
                        );

                    }

                }

            }


            return res.json({

                ok: true,

                mensaje:
                    "Paquete eliminado correctamente."

            });

        } catch (error) {

            console.error(
                "❌ DEPÓSITO - Error eliminando paquete:",
                error
            );

            return res.status(500).json({

                ok: false,

                mensaje:
                    "Error eliminando paquete.",

                error:
                    error.message

            });

        }

    }
);


// ============================================================
// DEPÓSITO - CHOFERES
// ============================================================

router.get(
    "/deposito/api/choferes",
    isAuthenticated,
    (req, res) => {

        try {

            const choferes = db.prepare(`
                SELECT

                    id,
                    nombre,
                    telefono,
                    vehiculo,
                    patente,
                    estado

                FROM logistica_choferes

                ORDER BY nombre ASC

            `).all();


            return res.json({

                ok: true,

                choferes

            });

        } catch (error) {

            console.error(
                "❌ DEPÓSITO - Error cargando choferes:",
                error
            );

            return res.status(500).json({

                ok: false,

                mensaje:
                    "Error cargando choferes.",

                error:
                    error.message

            });

        }

    }
);


// ============================================================
// ============================================================
// MÓDULOS ANTIGUOS DE LOGÍSTICA
// ============================================================
// ============================================================


// ============================================================
// FLEX SCANNER
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


            return res.render(
                "logistica/flex-scanner",
                {

                    username:
                        usuarioActual(req),

                    role:
                        req.session?.user?.role || "",

                    clientes

                }
            );

        } catch (error) {

            console.error(
                "❌ Error cargando Flex Scanner:",
                error
            );

            return res.status(500).send(
                "Error cargando Flex Scanner."
            );

        }

    }
);


// ============================================================
// GUARDAR PAQUETE PARTICULAR
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


            if (!cliente_id) {

                return res.status(400).json({

                    ok: false,

                    mensaje:
                        "Debe seleccionar un cliente."

                });

            }


            const ultimo = db.prepare(`
                SELECT id

                FROM logistica_paquetes

                ORDER BY id DESC

                LIMIT 1

            `).get();


            const numero =
                ultimo
                    ? ultimo.id + 1
                    : 1;


            const codigoInterno =
                "PKG-" +
                String(numero).padStart(6, "0");


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
                codigo_externo || "",
                codigoInterno,
                numero_orden || "",
                fecha_emision || "",
                peso || 0,
                bultos || 1,
                numero_bulto || 1,
                remitente || "",
                destinatario || "",
                telefono || "",
                direccion || "",
                localidad || "",
                zona || "",
                observaciones || "",
                usuarioActual(req)

            );


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

            return res.status(500).json({

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
// CLIENTES - MÓDULO ANTIGUO
// ============================================================

router.get(
    "/clientes",
    isAuthenticated,
    (req, res) => {

        try {

            const clientes = db.prepare(`
                SELECT *

                FROM logistica_clientes

                ORDER BY id DESC

            `).all();


            return res.render(
                "logistica/clientes",
                {

                    username:
                        usuarioActual(req),

                    clientes

                }
            );

        } catch (error) {

            console.error(
                "❌ Error cargando clientes:",
                error
            );

            return res.status(500).send(
                "Error cargando clientes."
            );

        }

    }
);


// ============================================================
// CLIENTES - CREAR MÓDULO ANTIGUO
// ============================================================

router.post(
    "/clientes",
    isAuthenticated,
    (req, res) => {

        try {

            const nombre =
                String(
                    req.body?.nombre || ""
                ).trim();


            const empresa =
                String(
                    req.body?.empresa || ""
                ).trim();


            const telefono =
                String(
                    req.body?.telefono || ""
                ).trim();


            const email =
                String(
                    req.body?.email || ""
                ).trim();


            const direccion =
                String(
                    req.body?.direccion || ""
                ).trim();


            if (!nombre) {

                return res.status(400).json({

                    ok: false,

                    mensaje:
                        "El nombre es obligatorio."

                });

            }


            const resultado = db.prepare(`
                INSERT INTO logistica_clientes

                (
                    nombre,
                    empresa,
                    telefono,
                    email,
                    direccion,
                    estado
                )

                VALUES
                (?, ?, ?, ?, ?, ?)

            `).run(

                nombre,
                empresa,
                telefono,
                email,
                direccion,
                "activo"

            );


            return res.redirect(
                "/panel/logistica/clientes"
            );

        } catch (error) {

            console.error(
                "❌ Error creando cliente:",
                error
            );

            return res.status(500).send(
                "Error creando cliente."
            );

        }

    }
);


// ============================================================
// CLIENTES - EDITAR
// ============================================================

router.get(
    "/clientes/editar/:id",
    isAuthenticated,
    (req, res) => {

        try {

            const cliente = db.prepare(`
                SELECT *

                FROM logistica_clientes

                WHERE id = ?

            `).get(
                req.params.id
            );


            if (!cliente) {

                return res.status(404).send(
                    "Cliente no encontrado."
                );

            }


            return res.render(
                "logistica/editarCliente",
                {

                    username:
                        usuarioActual(req),

                    cliente

                }
            );

        } catch (error) {

            console.error(error);

            return res.status(500).send(
                "Error buscando cliente."
            );

        }

    }
);


// ============================================================
// CLIENTES - ACTUALIZAR
// ============================================================

router.post(
    "/clientes/editar/:id",
    isAuthenticated,
    (req, res) => {

        try {

            const nombre =
                String(
                    req.body?.nombre || ""
                ).trim();


            if (!nombre) {

                return res.status(400).send(
                    "El nombre es obligatorio."
                );

            }


            db.prepare(`
                UPDATE logistica_clientes

                SET

                    nombre = ?,
                    empresa = ?,
                    telefono = ?,
                    email = ?,
                    direccion = ?,
                    updated_at = CURRENT_TIMESTAMP

                WHERE id = ?

            `).run(

                nombre,
                req.body?.empresa || "",
                req.body?.telefono || "",
                req.body?.email || "",
                req.body?.direccion || "",
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

            return res.status(500).send(
                "Error actualizando cliente."
            );

        }

    }
);


// ============================================================
// CLIENTES - ELIMINAR
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

            return res.status(500).send(
                "Error eliminando cliente."
            );

        }

    }
);


// ============================================================
// COLECTAS - MÓDULO ANTIGUO
// ============================================================

router.get(
    "/colectas",
    isAuthenticated,
    (req, res) => {

        try {

            const colectas = db.prepare(`
                SELECT

                    c.*,

                    cl.nombre AS cliente_nombre,

                    COUNT(p.id) AS paquetes_reales

                FROM logistica_colectas c

                LEFT JOIN logistica_clientes cl
                    ON c.cliente_id = cl.id

                LEFT JOIN logistica_paquetes p
                    ON p.colecta_id = c.id

                GROUP BY c.id

                ORDER BY c.id DESC

            `).all();


            const clientes = db.prepare(`
                SELECT

                    id,
                    nombre,
                    empresa

                FROM logistica_clientes

                WHERE estado = 'activo'
                   OR estado IS NULL

                ORDER BY nombre ASC

            `).all();


            let choferes = [];

            try {

                choferes = db.prepare(`
                    SELECT

                        id,
                        nombre,
                        telefono,
                        vehiculo,
                        patente

                    FROM logistica_choferes

                    WHERE estado = 'activo'
                       OR estado IS NULL

                    ORDER BY nombre ASC

                `).all();

            } catch (e) {

                console.warn(
                    "⚠️ No se pudieron cargar choferes:",
                    e.message
                );

            }


            return res.render(
                "logistica/colectas-nueva",
                {

                    username:
                        usuarioActual(req),

                    role:
                        req.session?.user?.role || "",

                    colectas,
                    clientes,
                    choferes

                }
            );

        } catch (error) {

            console.error(
                "❌ Error cargando colectas:",
                error
            );

            return res.status(500).send(
                "Error cargando colectas."
            );

        }

    }
);


// ============================================================
// COLECTAS - CREAR MÓDULO ANTIGUO
// ============================================================

router.post(
    "/colectas",
    isAuthenticated,
    (req, res) => {

        try {

            const cliente_id =
                Number(req.body?.cliente_id);


            if (!Number.isInteger(cliente_id)) {

                return res.status(400).json({

                    ok: false,

                    mensaje:
                        "Debe seleccionar un cliente."

                });

            }


            const resultado = db.prepare(`
                INSERT INTO logistica_colectas

                (
                    cliente_id,
                    fecha,
                    chofer,
                    chofer_id,
                    cantidad_paquetes,
                    observaciones,
                    estado
                )

                VALUES
                (?, ?, ?, ?, ?, ?, ?)

            `).run(

                cliente_id,

                req.body?.fecha ||
                    new Date().toISOString(),

                req.body?.chofer || "",

                req.body?.chofer_id
                    ? Number(req.body.chofer_id)
                    : null,

                Number(
                    req.body?.cantidad_paquetes || 0
                ),

                req.body?.observaciones || "",

                "pendiente"

            );


            return res.redirect(
                "/panel/logistica/colectas"
            );

        } catch (error) {

            console.error(
                "❌ Error creando colecta:",
                error
            );

            return res.status(500).send(
                "Error creando colecta."
            );

        }

    }
);


// ============================================================
// CHOFERES
// ============================================================

router.get(
    "/choferes",
    isAuthenticated,
    (req, res) => {

        try {

            const choferes = db.prepare(`
                SELECT *

                FROM logistica_choferes

                ORDER BY id DESC

            `).all();


            return res.render(
                "logistica/choferes",
                {

                    username:
                        usuarioActual(req),

                    choferes

                }
            );

        } catch (error) {

            console.error(
                "❌ Error cargando choferes:",
                error
            );

            return res.status(500).send(
                "Error cargando choferes."
            );

        }

    }
);


// ============================================================
// CHOFERES - CREAR
// ============================================================

router.post(
    "/choferes",
    isAuthenticated,
    (req, res) => {

        try {

            const nombre =
                String(
                    req.body?.nombre || ""
                ).trim();


            if (!nombre) {

                return res.status(400).json({

                    ok: false,

                    mensaje:
                        "El nombre del chofer es obligatorio."

                });

            }


            const resultado = db.prepare(`
                INSERT INTO logistica_choferes

                (
                    nombre,
                    telefono,
                    vehiculo,
                    patente,
                    estado
                )

                VALUES
                (?, ?, ?, ?, ?)

            `).run(

                nombre,
                req.body?.telefono || "",
                req.body?.vehiculo || "",
                req.body?.patente || "",
                req.body?.estado || "activo"

            );


            return res.redirect(
                "/panel/logistica/choferes"
            );

        } catch (error) {

            console.error(
                "❌ Error creando chofer:",
                error
            );

            return res.status(500).send(
                "Error creando chofer."
            );

        }

    }
);


// ============================================================
// PAQUETES - LISTADO
// ============================================================

router.get(
    "/paquetes",
    isAuthenticated,
    (req, res) => {

        try {

            const paquetes = db.prepare(`
                SELECT

                    p.*,

                    c.nombre AS cliente_nombre

                FROM logistica_paquetes p

                LEFT JOIN logistica_clientes c
                    ON p.cliente_id = c.id

                ORDER BY p.id DESC

            `).all();


            const clientes = db.prepare(`
                SELECT *

                FROM logistica_clientes

                WHERE estado = 'activo'
                   OR estado IS NULL

                ORDER BY nombre ASC

            `).all();


            return res.render(
                "logistica/paquetes",
                {

                    username:
                        usuarioActual(req),

                    role:
                        req.session?.user?.role || "",

                    paquetes,
                    clientes

                }
            );

        } catch (error) {

            console.error(
                "❌ Error cargando paquetes:",
                error
            );

            return res.status(500).send(
                "Error cargando paquetes."
            );

        }

    }
);


// ============================================================
// PAQUETES - CREAR
// ============================================================

router.post(
    "/paquetes",
    isAuthenticated,
    async (req, res) => {

        try {

            const cliente_id =
                Number(req.body?.cliente_id);


            if (!Number.isInteger(cliente_id)) {

                return res.status(400).json({

                    ok: false,

                    mensaje:
                        "Debe seleccionar un cliente."

                });

            }


            const ultimo = db.prepare(`
                SELECT id

                FROM logistica_paquetes

                ORDER BY id DESC

                LIMIT 1

            `).get();


            const numero =
                ultimo
                    ? ultimo.id + 1
                    : 1;


            const codigoInterno =
                "PKG-" +
                String(numero).padStart(6, "0");


            const qrNombre =
                codigoInterno + ".png";


            const carpetaQR =
                path.join(
                    __dirname,
                    "../public/uploads/qr"
                );


            if (!fs.existsSync(carpetaQR)) {

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


            const resultado = db.prepare(`
                INSERT INTO logistica_paquetes

                (
                    cliente_id,
                    tipo,
                    codigo_externo,
                    codigo_interno,
                    qr_codigo,
                    descripcion,
                    colectado_por,
                    estado
                )

                VALUES
                (?, ?, ?, ?, ?, ?, ?, ?)

            `).run(

                cliente_id,

                req.body?.tipo ||
                    "particular",

                req.body?.codigo_externo ||
                    "",

                codigoInterno,

                "/uploads/qr/" +
                    qrNombre,

                req.body?.descripcion ||
                    "",

                usuarioActual(req),

                "recibido"

            );


            return res.redirect(
                "/panel/logistica/paquetes"
            );

        } catch (error) {

            console.error(
                "❌ Error creando paquete:",
                error
            );

            return res.status(500).send(
                "Error creando paquete."
            );

        }

    }
);


// ============================================================
// API PAQUETES DE COLECTA
// ============================================================

router.get(
    "/api/colectas/:id/paquetes",
    isAuthenticated,
    (req, res) => {

        try {

            const paquetes = db.prepare(`
                SELECT

                    p.*,

                    c.nombre AS cliente_nombre

                FROM logistica_paquetes p

                LEFT JOIN logistica_clientes c
                    ON p.cliente_id = c.id

                WHERE p.colecta_id = ?

                ORDER BY p.id DESC

            `).all(
                req.params.id
            );


            return res.json({

                ok: true,

                paquetes

            });

        } catch (error) {

            console.error(
                "❌ Error API paquetes colecta:",
                error
            );

            return res.status(500).json({

                ok: false,

                mensaje:
                    "Error cargando paquetes.",

                error:
                    error.message

            });

        }

    }
);


// ============================================================
// MERCADO LIBRE - CALLBACK
// ============================================================

router.get(
    "/mercadolibre/callback",
    async (req, res) => {

        console.log(
            "🔵 Callback recibido desde Mercado Libre"
        );

        console.log(
            "Query:",
            req.query
        );


        return res.send(
            "Mercado Libre devolvió la autorización correctamente."
        );

    }
);


// ============================================================
// MERCADO LIBRE - WEBHOOK
// ============================================================

router.post(
    "/mercadolibre/webhook",
    async (req, res) => {

        console.log(
            "📡 Webhook recibido de Mercado Libre"
        );

        console.log(
            "Body:",
            req.body
        );


        return res.sendStatus(200);

    }
);


// ============================================================
// EXPORTAR
// ============================================================

module.exports = router;