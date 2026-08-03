
// ============================================================
// routes/mercadolibre.js
// APPCRAFTPRO
//
// MERCADO LIBRE + MERCADO ENVÍOS FLEX
//
// VERSION CORREGIDA + DIAGNÓSTICO
//
// - OAuth Mercado Libre
// - Tokens SQLite
// - Webhook Flex
// - Scanner shipment
// - Preparado para logística
// - Diagnóstico de errores EJS
// ============================================================

const express = require("express");
const axios = require("axios");

const router = express.Router();

const isAuthenticated =
    require("../middleware/authMiddleware");

const db =
    require("../models/db");


// ============================================================
// CONFIGURACIÓN MERCADO LIBRE
// ============================================================

const MERCADOLIBRE_CLIENT_ID =
    process.env.MERCADOLIBRE_CLIENT_ID;

const MERCADOLIBRE_CLIENT_SECRET =
    process.env.MERCADOLIBRE_CLIENT_SECRET;

const MERCADOLIBRE_REDIRECT_URI =
    process.env.MERCADOLIBRE_REDIRECT_URI;

const MERCADOLIBRE_SITE_ID =
    process.env.MERCADOLIBRE_SITE_ID || "MLA";


// ============================================================
// CREAR TABLA TOKENS
// ============================================================

try {

    db.prepare(`
        CREATE TABLE IF NOT EXISTS mercadolibre_tokens (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            user_id TEXT UNIQUE,

            access_token TEXT,

            refresh_token TEXT,

            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP

        )
    `).run();

    console.log(
        "✅ Tabla mercadolibre_tokens lista"
    );

} catch (error) {

    console.error(
        "❌ Error creando tabla mercadolibre_tokens:",
        error
    );

}


// ============================================================
// CACHE TEMPORAL PAQUETES FLEX
// ============================================================

const paquetesFlexEscaneados = [];


// ============================================================
// GUARDAR TOKEN MERCADO LIBRE
// ============================================================

function guardarTokenUsuario(
    userId,
    accessToken,
    refreshToken
) {

    try {

        db.prepare(`
            INSERT INTO mercadolibre_tokens
            (
                user_id,
                access_token,
                refresh_token
            )

            VALUES
            (
                ?,
                ?,
                ?
            )

            ON CONFLICT(user_id)

            DO UPDATE SET

                access_token =
                    excluded.access_token,

                refresh_token =
                    excluded.refresh_token,

                updated_at =
                    CURRENT_TIMESTAMP
        `).run(
            String(userId),
            accessToken,
            refreshToken
        );

        console.log(
            "🔐 Token ML guardado:",
            userId
        );

        return true;

    } catch (error) {

        console.error(
            "❌ Error guardando token ML:",
            error
        );

        return false;

    }

}


// ============================================================
// OBTENER TOKEN POR USER ID
// ============================================================

function obtenerTokenPorUsuario(
    userId
) {

    try {

        if (!userId) {
            return null;
        }

        const row =
            db.prepare(`
                SELECT access_token

                FROM mercadolibre_tokens

                WHERE user_id = ?
            `).get(
                String(userId)
            );

        if (!row) {
            return null;
        }

        return row.access_token || null;

    } catch (error) {

        console.error(
            "❌ Error buscando token ML:",
            error
        );

        return null;

    }

}


// ============================================================
// OBTENER TOKEN DESDE SESIÓN
// ============================================================

function obtenerAccessToken(req) {

    if (
        req.session &&
        req.session.mercadolibreAccessToken
    ) {

        return req.session.mercadolibreAccessToken;

    }

    return null;

}


// ============================================================
// VALIDAR CONFIGURACIÓN
// ============================================================

function validarConfiguracion() {

    const faltantes = [];

    if (!MERCADOLIBRE_CLIENT_ID) {

        faltantes.push(
            "MERCADOLIBRE_CLIENT_ID"
        );

    }

    if (!MERCADOLIBRE_CLIENT_SECRET) {

        faltantes.push(
            "MERCADOLIBRE_CLIENT_SECRET"
        );

    }

    if (!MERCADOLIBRE_REDIRECT_URI) {

        faltantes.push(
            "MERCADOLIBRE_REDIRECT_URI"
        );

    }

    return faltantes;

}


// ============================================================
// PETICIÓN GET MERCADO LIBRE
// ============================================================

async function mlGet(
    url,
    accessToken,
    params = {}
) {

    if (!accessToken) {

        throw new Error(
            "Access Token de Mercado Libre inexistente."
        );

    }

    return axios.get(
        url,
        {

            params,

            headers: {

                Authorization:
                    `Bearer ${accessToken}`,

                Accept:
                    "application/json"

            },

            timeout:
                20000

        }
    );

}


// ============================================================
// EXTRAER SHIPMENT ID
// ============================================================

function extraerShipmentId(
    resource
) {

    if (
        !resource ||
        typeof resource !== "string"
    ) {

        return null;

    }

    const match =
        resource.match(
            /\/shipments\/(\d+)/
        );

    return match
        ? match[1]
        : null;

}


// ============================================================
// EXTRAER SITE ID
// ============================================================

function extraerSiteId(
    resource
) {

    if (
        !resource ||
        typeof resource !== "string"
    ) {

        return MERCADOLIBRE_SITE_ID;

    }

    const match =
        resource.match(
            /\/flex\/sites\/([^/]+)/
        );

    return match
        ? match[1]
        : MERCADOLIBRE_SITE_ID;

}


// ============================================================
// DETECTAR FLEX
// ============================================================

function detectarFlex(
    shipment
) {

    if (!shipment) {

        return false;

    }

    const texto = [

        shipment.logistic_type,

        shipment.mode,

        shipment.shipping_option?.name,

        shipment.shipping_option?.type

    ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

    return (

        texto.includes("flex")

        ||

        shipment.logistic_type ===
        "self_service"

    );

}


// ============================================================
// TRANSFORMAR SHIPMENT
// ============================================================

function transformarShipment(
    shipment,
    order = null,
    assignment = null
) {

    shipment =
        shipment || {};

    const receiver =
        shipment.receiver_address || {};

    const buyer =
        order?.buyer || {};

    const destinatario =

        receiver.receiver_name ||

        `${buyer.first_name || ""} ${buyer.last_name || ""}`.trim();

    return {

        id:
            shipment.id || null,

        shipment_id:
            shipment.id || null,

        order_id:
            order?.id || null,

        codigo:
            shipment.tracking_number ||
            shipment.id ||
            "",

        tracking_number:
            shipment.tracking_number ||
            "",

        destinatario,

        direccion:

            receiver.address_line ||

            receiver.street_name ||

            "",

        localidad:

            receiver.city?.name ||

            receiver.city_name ||

            receiver.state?.name ||

            "",

        telefono:

            receiver.receiver_phone ||

            "",

        estado:

            shipment.status ||

            "unknown",

        logistic_type:

            shipment.logistic_type ||

            "",

        es_flex:

            detectarFlex(
                shipment
            ),

        driver_id:

            assignment?.driver_id ||

            null,

        fecha:

            shipment.date_created ||

            new Date().toISOString(),

        origen:

            "mercadolibre-flex",

        raw:

            shipment

    };

}


// ============================================================
// EVITAR DUPLICADOS
// ============================================================

function paqueteExiste(
    shipmentId
) {

    return paquetesFlexEscaneados.some(

        p =>

            String(
                p.shipment_id
            )

            ===

            String(
                shipmentId
            )

    );

}


// ============================================================
// DASHBOARD MERCADO LIBRE
//
// IMPORTANTE:
// ESTA ES LA RUTA RAÍZ DEL ROUTER.
//
// app.js:
// /panel/logistica/mercadolibre
//
// router:
// /
//
// RESULTADO:
// /panel/logistica/mercadolibre
// ============================================================

router.get(
    "/",
    isAuthenticated,
    async (req, res) => {

        console.log(
            "=========================================="
        );

        console.log(
            "🟢 ENTRANDO AL MÓDULO MERCADO LIBRE"
        );

        console.log(
            "URL:",
            req.originalUrl
        );

        console.log(
            "METHOD:",
            req.method
        );

        console.log(
            "SESSION USER:",
            req.session?.user
        );

        console.log(
            "=========================================="
        );


        try {

            // ------------------------------------------------
            // VALIDAR CONFIGURACIÓN
            // ------------------------------------------------

            const faltantes =
                validarConfiguracion();

            console.log(
                "🔍 Variables Mercado Libre faltantes:",
                faltantes
            );


            // ------------------------------------------------
            // PREPARAR DATOS PARA EJS
            // ------------------------------------------------

            const datosVista = {

                username:
                    req.session?.user?.username ||
                    "Usuario",

                role:
                    req.session?.user?.role ||
                    "usuario",

                mercadolibreConnected:

                    !!req.session
                        ?.mercadolibreAccessToken,

                totalShipments:

                    paquetesFlexEscaneados.length,

                importedToday:

                    paquetesFlexEscaneados.length,

                pendingShipments:

                    paquetesFlexEscaneados.length,

                mercadolibreConfigured:

                    faltantes.length === 0,

                configurationErrors:

                    faltantes

            };


            console.log(
                "📦 DATOS QUE SE ENVIARÁN A EJS:"
            );

            console.log(
                JSON.stringify(
                    datosVista,
                    null,
                    2
                )
            );


            // ------------------------------------------------
            // RENDERIZAR VISTA
            // ------------------------------------------------

            console.log(
                "🎨 Intentando renderizar:"
            );

            console.log(
                "logistica/mercadolibre"
            );


            return res.render(

                "logistica/mercadolibre",

                datosVista,

                (error, html) => {

                    // ----------------------------------------
                    // ERROR REAL DE EJS
                    // ----------------------------------------

                    if (error) {

                        console.error(
                            "=========================================="
                        );

                        console.error(
                            "❌❌❌ ERROR REAL RENDERIZANDO EJS ❌❌❌"
                        );

                        console.error(
                            "=========================================="
                        );

                        console.error(
                            "Mensaje:",
                            error.message
                        );

                        console.error(
                            "Stack:",
                            error.stack
                        );

                        console.error(
                            "=========================================="
                        );


                        return res
                            .status(500)
                            .send(`
                                <!DOCTYPE html>

                                <html lang="es">

                                <head>

                                    <meta charset="UTF-8">

                                    <title>
                                        Error Mercado Libre
                                    </title>

                                </head>

                                <body>

                                    <h1>
                                        Error renderizando Mercado Libre
                                    </h1>

                                    <h2>
                                        Mensaje:
                                    </h2>

                                    <pre>
${error.message}
                                    </pre>

                                    <h2>
                                        Stack:
                                    </h2>

                                    <pre style="white-space: pre-wrap;">
${error.stack}
                                    </pre>

                                </body>

                                </html>
                            `);

                    }


                    // ----------------------------------------
                    // VISTA CORRECTA
                    // ----------------------------------------

                    console.log(
                        "✅ Vista Mercado Libre renderizada correctamente"
                    );


                    return res.send(
                        html
                    );

                }

            );


        } catch (error) {

            console.error(
                "=========================================="
            );

            console.error(
                "❌❌❌ ERROR GENERAL EN MERCADO LIBRE ❌❌❌"
            );

            console.error(
                "=========================================="
            );

            console.error(
                "Mensaje:",
                error.message
            );

            console.error(
                "Stack:",
                error.stack
            );

            console.error(
                "=========================================="
            );


            return res
                .status(500)
                .send(`
                    <h1>
                        Error interno en Mercado Libre
                    </h1>

                    <h2>
                        Mensaje:
                    </h2>

                    <pre style="white-space:pre-wrap;">
${error.message}
                    </pre>

                    <h2>
                        Stack:
                    </h2>

                    <pre style="white-space:pre-wrap;">
${error.stack}
                    </pre>
                `);

        }

    }
);


// ============================================================
// CONECTAR MERCADO LIBRE
// ============================================================

router.get(
    "/conectar",
    isAuthenticated,
    (req, res) => {

        try {

            const faltantes =
                validarConfiguracion();

            if (
                faltantes.length > 0
            ) {

                console.error(
                    "❌ Faltan variables:",
                    faltantes
                );

                return res
                    .status(500)
                    .send(`
                        <h1>
                            Configuración Mercado Libre incompleta
                        </h1>

                        <pre>
${faltantes.join("\n")}
                        </pre>

                        <a href="/panel/logistica/mercadolibre">
                            Volver
                        </a>
                    `);

            }


            if (
                !req.session ||
                !req.session.user
            ) {

                return res
                    .status(401)
                    .send(
                        "Sesión de usuario no disponible."
                    );

            }


            const state =

                `${req.session.user.id}_${Date.now()}_${Math.random()
                    .toString(36)
                    .substring(2, 15)}`;


            req.session.mlState =
                state;


            const url =
                new URL(
                    "https://auth.mercadolibre.com.ar/authorization"
                );


            url.searchParams.set(
                "response_type",
                "code"
            );


            url.searchParams.set(
                "client_id",
                MERCADOLIBRE_CLIENT_ID
            );


            url.searchParams.set(
                "redirect_uri",
                MERCADOLIBRE_REDIRECT_URI
            );


            url.searchParams.set(
                "state",
                state
            );


            console.log(
                "=========================================="
            );

            console.log(
                "🔵 INICIANDO OAUTH MERCADO LIBRE"
            );

            console.log(
                "Usuario:",
                req.session.user.username
            );

            console.log(
                "AppCraft User ID:",
                req.session.user.id
            );

            console.log(
                "Redirect URI:",
                MERCADOLIBRE_REDIRECT_URI
            );

            console.log(
                "=========================================="
            );


            return res.redirect(
                url.toString()
            );


        } catch (error) {

            console.error(
                "❌ ERROR INICIANDO OAUTH:",
                error
            );

            return res
                .status(500)
                .send(`
                    <h1>
                        Error iniciando OAuth
                    </h1>

                    <pre style="white-space:pre-wrap;">
${error.stack || error.message}
                    </pre>
                `);

        }

    }
);


// ============================================================
// CALLBACK OAUTH
// ============================================================

router.get(
    "/callback",
    async (req, res) => {

        try {

            console.log(
                "=========================================="
            );

            console.log(
                "🔵 CALLBACK MERCADO LIBRE"
            );

            console.log(
                "=========================================="
            );


            const {
                code,
                state,
                error,
                error_description
            } = req.query;


            if (error) {

                console.error(
                    "❌ Error OAuth:",
                    error,
                    error_description
                );

                return res
                    .status(400)
                    .send(`
                        <h2>
                            Autorización cancelada
                        </h2>

                        <p>
                            ${error_description || error}
                        </p>

                        <a href="/panel/logistica/mercadolibre">
                            Volver
                        </a>
                    `);

            }


            if (!code) {

                return res
                    .status(400)
                    .send(
                        "No llegó código OAuth desde Mercado Libre."
                    );

            }


            // ------------------------------------------------
            // INTERCAMBIAR CODE POR TOKEN
            // ------------------------------------------------

            console.log(
                "🔄 Intercambiando código OAuth..."
            );


            const response =
                await axios.post(

                    "https://api.mercadolibre.com/oauth/token",

                    new URLSearchParams({

                        grant_type:
                            "authorization_code",

                        client_id:
                            MERCADOLIBRE_CLIENT_ID,

                        client_secret:
                            MERCADOLIBRE_CLIENT_SECRET,

                        code:

                            code,

                        redirect_uri:
                            MERCADOLIBRE_REDIRECT_URI

                    }).toString(),

                    {

                        headers: {

                            "Content-Type":
                                "application/x-www-form-urlencoded"

                        }

                    }

                );


            const data =
                response.data;


            if (
                !data.access_token
            ) {

                throw new Error(
                    "Mercado Libre no devolvió access_token."
                );

            }


            // ------------------------------------------------
            // GUARDAR TOKEN
            // ------------------------------------------------

            guardarTokenUsuario(

                data.user_id,

                data.access_token,

                data.refresh_token

            );


            // ------------------------------------------------
            // GUARDAR EN SESIÓN
            // ------------------------------------------------

            req.session.mercadolibreAccessToken =
                data.access_token;

            req.session.mercadolibreUserId =
                data.user_id;

            req.session.mercadolibreConnected =
                true;


            console.log(
                "=========================================="
            );

            console.log(
                "✅ MERCADO LIBRE CONECTADO"
            );

            console.log(
                "Usuario ML:",
                data.user_id
            );

            console.log(
                "=========================================="
            );


            return res.redirect(
                "/panel/logistica/mercadolibre"
            );


        } catch (error) {

            console.error(
                "=========================================="
            );

            console.error(
                "❌ ERROR CALLBACK MERCADO LIBRE"
            );

            console.error(
                "=========================================="
            );

            console.error(
                "Mensaje:",
                error.message
            );

            console.error(
                "Stack:",
                error.stack
            );


            if (
                error.response
            ) {

                console.error(
                    "HTTP STATUS:",
                    error.response.status
                );

                console.error(
                    "RESPUESTA API:",
                    error.response.data
                );

            }


            return res
                .status(500)
                .send(`
                    <h1>
                        Error conectando Mercado Libre
                    </h1>

                    <h2>
                        Mensaje:
                    </h2>

                    <pre style="white-space:pre-wrap;">
${error.message}
                    </pre>

                    <h2>
                        Detalle:
                    </h2>

                    <pre style="white-space:pre-wrap;">
${error.response?.data
    ? JSON.stringify(
        error.response.data,
        null,
        2
    )
    : error.stack}
                    </pre>

                    <br>

                    <a href="/panel/logistica/mercadolibre">
                        Volver al módulo
                    </a>
                `);

        }

    }
);


// ============================================================
// ESTADO DE CONEXIÓN
// ============================================================

router.get(
    "/estado",
    isAuthenticated,
    (req, res) => {

        try {

            return res.json({

                ok:
                    true,

                conectado:

                    !!req.session
                        ?.mercadolibreAccessToken,

                user:

                    req.session
                        ?.mercadolibreUserId ||

                    null

            });

        } catch (error) {

            console.error(
                "❌ ERROR ESTADO ML:",
                error
            );

            return res
                .status(500)
                .json({

                    ok:
                        false,

                    error:
                        error.message

                });

        }

    }
);


// ============================================================
// SCANNER QR / BARCODE
// ============================================================

router.post(
    "/scan",
    isAuthenticated,
    async (req, res) => {

        try {

            const {
                codigo
            } = req.body;


            if (!codigo) {

                return res
                    .status(400)
                    .json({

                        ok:
                            false,

                        error:
                            "Código vacío"

                    });

            }


            const token =
                obtenerAccessToken(req);


            if (!token) {

                return res
                    .status(401)
                    .json({

                        ok:
                            false,

                        error:
                            "Mercado Libre no conectado"

                    });

            }


            console.log(
                "🔎 Consultando shipment:",
                codigo
            );


            const response =
                await mlGet(

                    `https://api.mercadolibre.com/shipments/${encodeURIComponent(codigo)}`,

                    token

                );


            const paquete =
                transformarShipment(
                    response.data
                );


            if (
                !paqueteExiste(
                    paquete.shipment_id
                )
            ) {

                paquetesFlexEscaneados.push(
                    paquete
                );

            }


            return res.json({

                ok:
                    true,

                paquete

            });


        } catch (error) {

            console.error(
                "❌ ERROR SCANNER ML:",
                error.response?.data ||
                error.message
            );


            return res
                .status(
                    error.response?.status ||
                    500
                )
                .json({

                    ok:
                        false,

                    error:
                        error.response?.data ||
                        error.message

                });

        }

    }
);


// ============================================================
// PROCESAR FLEX HANDSHAKE
// ============================================================

async function procesarFlexHandshake(
    data
) {

    const resource =
        data.resource;

    const userId =
        data.user_id;

    const shipmentId =
        extraerShipmentId(
            resource
        );

    const siteId =
        extraerSiteId(
            resource
        );


    console.log(
        "🚚 FLEX HANDSHAKE",
        {

            userId,

            shipmentId,

            siteId

        }
    );


    if (!shipmentId) {

        return {

            ok:
                false,

            error:
                "No se encontró shipment_id"

        };

    }


    if (
        paqueteExiste(
            shipmentId
        )
    ) {

        return {

            ok:
                true,

            duplicado:
                true

        };

    }


    const accessToken =
        obtenerTokenPorUsuario(
            userId
        );


    if (!accessToken) {

        console.error(
            "❌ No existe token ML para:",
            userId
        );

        return {

            ok:
                false,

            error:
                "No existe token OAuth"

        };

    }


    let assignment =
        null;


    // ------------------------------------------------
    // OBTENER ASSIGNMENT FLEX
    // ------------------------------------------------

    try {

        const response =
            await mlGet(

                `https://api.mercadolibre.com/flex/sites/${siteId}/shipments/${shipmentId}/assignment/v2`,

                accessToken

            );

        assignment =
            response.data;

    } catch (error) {

        console.log(
            "⚠️ No se obtuvo assignment:",
            error.response?.data ||
            error.message
        );

    }


    // ------------------------------------------------
    // OBTENER SHIPMENT
    // ------------------------------------------------

    let shipment;


    try {

        const response =
            await mlGet(

                `https://api.mercadolibre.com/shipments/${shipmentId}`,

                accessToken

            );

        shipment =
            response.data;

    } catch (error) {

        console.error(
            "❌ Error obteniendo shipment:",
            error.response?.data ||
            error.message
        );

        return {

            ok:
                false,

            error:
                "No se pudo obtener shipment"

        };

    }


    const paquete =
        transformarShipment(

            shipment,

            null,

            assignment

        );


    paquete.webhook =
        data;


    if (
        !paqueteExiste(
            paquete.shipment_id
        )
    ) {

        paquetesFlexEscaneados.push(
            paquete
        );

    }


    console.log(
        "✅ FLEX GUARDADO:",
        paquete.shipment_id
    );


    return {

        ok:
            true,

        paquete

    };

}


// ============================================================
// WEBHOOK MERCADO LIBRE
//
// POST:
// /panel/logistica/mercadolibre/webhook
//
// NO lleva autenticación
// ============================================================

router.post(
    "/webhook",
    async (req, res) => {

        try {

            const data =
                req.body || {};


            console.log(
                "=========================================="
            );

            console.log(
                "📡 WEBHOOK MERCADO LIBRE"
            );

            console.log(
                "Fecha:",
                new Date().toISOString()
            );

            console.log(
                JSON.stringify(
                    data,
                    null,
                    2
                )
            );

            console.log(
                "=========================================="
            );


            // ------------------------------------------------
            // RESPONDER RÁPIDO A MERCADO LIBRE
            // ------------------------------------------------

            res.sendStatus(
                200
            );


            // ------------------------------------------------
            // IGNORAR TODO LO QUE NO SEA FLEX
            // ------------------------------------------------

            if (
                data.topic !==
                "flex-handshakes"
            ) {

                console.log(
                    "Webhook ignorado:",
                    data.topic
                );

                return;

            }


            // ------------------------------------------------
            // PROCESAR FLEX
            // ------------------------------------------------

            try {

                const resultado =
                    await procesarFlexHandshake(
                        data
                    );


                console.log(
                    "📦 Resultado procesamiento Flex:",
                    resultado
                );

            } catch (error) {

                console.error(
                    "❌ ERROR PROCESANDO FLEX:",
                    error
                );

            }

        } catch (error) {

            console.error(
                "❌ ERROR WEBHOOK:",
                error
            );


            if (
                !res.headersSent
            ) {

                return res
                    .sendStatus(
                        500
                    );

            }

        }

    }
);


// ============================================================
// LISTAR PAQUETES ESCANEADOS
// ============================================================

router.get(
    "/paquetes-escaneados",
    isAuthenticated,
    (req, res) => {

        try {

            return res.json({

                ok:
                    true,

                total:

                    paquetesFlexEscaneados.length,

                paquetes:

                    paquetesFlexEscaneados

            });

        } catch (error) {

            console.error(
                "❌ ERROR LISTANDO PAQUETES:",
                error
            );

            return res
                .status(500)
                .json({

                    ok:
                        false,

                    error:
                        error.message

                });

        }

    }
);


// ============================================================
// TEST SHIPMENT
// ============================================================

router.get(
    "/test-flex/:id",
    isAuthenticated,
    async (req, res) => {

        try {

            const token =
                obtenerAccessToken(
                    req
                );


            if (!token) {

                return res
                    .status(401)
                    .json({

                        ok:
                            false,

                        error:
                            "Sin conexión Mercado Libre"

                    });

            }


            const response =
                await mlGet(

                    `https://api.mercadolibre.com/shipments/${encodeURIComponent(req.params.id)}`,

                    token

                );


            return res.json({

                ok:
                    true,

                shipment:
                    response.data

            });


        } catch (error) {

            console.error(
                "❌ ERROR TEST SHIPMENT:",
                error.response?.data ||
                error.message
            );


            return res
                .status(
                    error.response?.status ||
                    500
                )
                .json({

                    ok:
                        false,

                    error:
                        error.response?.data ||
                        error.message

                });

        }

    }
);


// ============================================================
// EXPORTAR ROUTER
// ============================================================

module.exports =
    router;
