
// ============================================================
// routes/mercadolibre.js
// APPCRAFTPRO
//
// MERCADO LIBRE + MERCADO ENVÍOS FLEX
//
// OAuth Mercado Libre
// Tokens SQLite
// Webhook Flex
// Scanner shipment
// Dashboard logística
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
// TABLA TOKENS
// ============================================================

try {

    db.prepare(`
        CREATE TABLE IF NOT EXISTS mercadolibre_tokens (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            user_id TEXT UNIQUE NOT NULL,

            access_token TEXT NOT NULL,

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
// CACHE TEMPORAL FLEX
// ============================================================

const paquetesFlexEscaneados = [];


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
// GUARDAR TOKEN
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

            refreshToken || null

        );

        console.log(
            "🔐 Token ML guardado correctamente:",
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
                SELECT
                    access_token

                FROM
                    mercadolibre_tokens

                WHERE
                    user_id = ?

            `).get(
                String(userId)
            );

        return row?.access_token || null;

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

function obtenerAccessToken(
    req
) {

    return (
        req.session
            ?.mercadolibreAccessToken
        || null
    );

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

        paquete =>

            String(
                paquete.shipment_id
            )

            ===

            String(
                shipmentId
            )

    );

}


// ============================================================
// DASHBOARD
// GET /panel/logistica/mercadolibre
// ============================================================

router.get(
    "/",
    isAuthenticated,
    async (req, res) => {

        try {

            const faltantes =
                validarConfiguracion();

            const conectado =
                !!req.session
                    ?.mercadolibreAccessToken;

            console.log(
                "=========================================="
            );

            console.log(
                "🟢 DASHBOARD MERCADO LIBRE"
            );

            console.log(
                "URL:",
                req.originalUrl
            );

            console.log(
                "Usuario:",
                req.session?.user?.username
            );

            console.log(
                "ML conectado:",
                conectado
            );

            console.log(
                "=========================================="
            );


            const datosVista = {

                username:
                    req.session?.user?.username ||
                    "Usuario",

                role:
                    req.session?.user?.role ||
                    "usuario",

                mercadolibreConnected:
                    conectado,

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


            return res.render(

                "logistica/mercadolibre",

                datosVista

            );

        } catch (error) {

            console.error(
                "❌ ERROR DASHBOARD MERCADO LIBRE:",
                error
            );

            return res
                .status(500)
                .send(`
                    <h1>
                        Error interno en Mercado Libre
                    </h1>

                    <pre style="white-space:pre-wrap;">
${error.stack || error.message}
                    </pre>
                `);

        }

    }
);


// ============================================================
// CONECTAR MERCADO LIBRE
//
// GET:
// /panel/logistica/mercadolibre/conectar
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
                    "❌ Faltan variables Mercado Libre:",
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


            // ------------------------------------------------
            // GENERAR STATE
            // ------------------------------------------------

            const state =

                `${req.session.user.id}_${Date.now()}_${Math.random()
                    .toString(36)
                    .substring(2, 15)}`;


            req.session.mlState =
                state;


            // ------------------------------------------------
            // CREAR URL OAUTH
            // ------------------------------------------------

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
                "Usuario AppCraftPro:",
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
                "State:",
                state
            );

            console.log(
                "URL OAuth:",
                url.toString()
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
//
// Mercado Libre vuelve aquí:
//
// /panel/logistica/mercadolibre/callback?code=XXX&state=XXX
//
// IMPORTANTE:
// Esta ruta NO lleva isAuthenticated.
// ============================================================

router.get(
    "/callback",
    async (req, res) => {

        console.log(
            "=========================================="
        );

        console.log(
            "🔵 CALLBACK OAUTH MERCADO LIBRE"
        );

        console.log(
            "URL:",
            req.originalUrl
        );

        console.log(
            "Query:",
            req.query
        );

        console.log(
            "Session ID:",
            req.sessionID
        );

        console.log(
            "=========================================="
        );


        try {

            const {
                code,
                state,
                error,
                error_description
            } = req.query;


            // ------------------------------------------------
            // ERROR DEVUELTO POR MERCADO LIBRE
            // ------------------------------------------------

            if (error) {

                console.error(
                    "❌ OAuth cancelado:",
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

                        <br>

                        <a href="/panel/logistica/mercadolibre">
                            Volver al módulo
                        </a>
                    `);

            }


            // ------------------------------------------------
            // VALIDAR CODE
            // ------------------------------------------------

            if (!code) {

                return res
                    .status(400)
                    .send(`
                        <h2>
                            Error de autorización
                        </h2>

                        <p>
                            No llegó el código OAuth desde Mercado Libre.
                        </p>

                        <a href="/panel/logistica/mercadolibre">
                            Volver
                        </a>
                    `);

            }


            // ------------------------------------------------
            // VALIDAR STATE
            // ------------------------------------------------

            if (
                state &&
                req.session?.mlState &&
                state !== req.session.mlState
            ) {

                console.error(
                    "❌ STATE OAuth inválido"
                );

                console.error(
                    "Esperado:",
                    req.session.mlState
                );

                console.error(
                    "Recibido:",
                    state
                );

                return res
                    .status(400)
                    .send(`
                        <h2>
                            Error de seguridad OAuth
                        </h2>

                        <p>
                            El estado de autorización no coincide.
                        </p>

                        <a href="/panel/logistica/mercadolibre">
                            Volver
                        </a>
                    `);

            }


            // ------------------------------------------------
            // INTERCAMBIAR CODE POR TOKEN
            // ------------------------------------------------

            console.log(
                "🔄 Intercambiando código OAuth por token..."
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
                                "application/x-www-form-urlencoded",

                            "Accept":
                                "application/json"

                        },

                        timeout:
                            20000

                    }

                );


            const data =
                response.data;


            console.log(
                "📥 Respuesta OAuth recibida"
            );

            console.log(
                "User ID ML:",
                data.user_id
            );

            console.log(
                "Tiene access token:",
                !!data.access_token
            );

            console.log(
                "Tiene refresh token:",
                !!data.refresh_token
            );


            if (
                !data.access_token
            ) {

                throw new Error(
                    "Mercado Libre no devolvió access_token."
                );

            }


            if (
                !data.user_id
            ) {

                throw new Error(
                    "Mercado Libre no devolvió user_id."
                );

            }


            // ------------------------------------------------
            // GUARDAR TOKEN EN SQLITE
            // ------------------------------------------------

            const tokenGuardado =
                guardarTokenUsuario(

                    data.user_id,

                    data.access_token,

                    data.refresh_token

                );


            if (
                !tokenGuardado
            ) {

                throw new Error(
                    "No se pudo guardar el token de Mercado Libre."
                );

            }


            // ------------------------------------------------
            // GUARDAR TOKEN EN SESIÓN
            // ------------------------------------------------

            req.session.mercadolibreAccessToken =
                data.access_token;

            req.session.mercadolibreUserId =
                data.user_id;

            req.session.mercadolibreConnected =
                true;


            // ------------------------------------------------
            // ELIMINAR STATE USADO
            // ------------------------------------------------

            delete req.session.mlState;


            console.log(
                "=========================================="
            );

            console.log(
                "✅ MERCADO LIBRE CONECTADO CORRECTAMENTE"
            );

            console.log(
                "Usuario ML:",
                data.user_id
            );

            console.log(
                "Session ID:",
                req.sessionID
            );

            console.log(
                "=========================================="
            );


            // ------------------------------------------------
            // GUARDAR SESIÓN ANTES DE REDIRIGIR
            //
            // ESTO ES IMPORTANTE.
            //
            // Evita que Render redirija al dashboard
            // antes de que la sesión haya sido persistida.
            // ------------------------------------------------

            return req.session.save(
                (sessionError) => {

                    if (
                        sessionError
                    ) {

                        console.error(
                            "❌ ERROR GUARDANDO SESIÓN:",
                            sessionError
                        );

                        return res
                            .status(500)
                            .send(`
                                <h1>
                                    Mercado Libre autorizado
                                </h1>

                                <p>
                                    La cuenta fue autorizada,
                                    pero no se pudo guardar
                                    la sesión.
                                </p>

                                <pre style="white-space:pre-wrap;">
${sessionError.message}
                                </pre>
                            `);

                    }


                    console.log(
                        "💾 Sesión guardada correctamente."
                    );


                    console.log(
                        "➡️ Redirigiendo al panel..."
                    );


                    return res.redirect(
                        "/panel/logistica/mercadolibre"
                    );

                }
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
${
    error.response?.data
        ? JSON.stringify(
            error.response.data,
            null,
            2
        )
        : error.stack
}
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
//
// GET:
// /panel/logistica/mercadolibre/estado
// ============================================================

router.get(
    "/estado",
    isAuthenticated,
    async (req, res) => {

        try {

            const conectado =
                !!req.session
                    ?.mercadolibreAccessToken;


            let cuenta =
                null;


            // ------------------------------------------------
            // OBTENER INFORMACIÓN DE LA CUENTA
            // ------------------------------------------------

            if (
                conectado
            ) {

                try {

                    const response =
                        await mlGet(

                            "https://api.mercadolibre.com/users/me",

                            req.session
                                .mercadolibreAccessToken

                        );


                    const usuario =
                        response.data;


                    cuenta = {

                        id:
                            usuario.id,

                        nickname:
                            usuario.nickname || "",

                        firstName:
                            usuario.first_name || "",

                        lastName:
                            usuario.last_name || ""

                    };

                } catch (error) {

                    console.error(
                        "⚠️ No se pudo obtener usuario ML:",
                        error.response?.data ||
                        error.message
                    );

                }

            }


            return res.json({

                ok:
                    true,

                conectado,

                user:

                    req.session
                        ?.mercadolibreUserId ||

                    null,

                cuenta,

                totalShipments:

                    paquetesFlexEscaneados.length,

                pendingShipments:

                    paquetesFlexEscaneados.length,

                importedToday:

                    paquetesFlexEscaneados.length,

                lastSync:

                    null,

                envios:

                    paquetesFlexEscaneados

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

                    conectado:
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


            // Responder inmediatamente
            res.sendStatus(
                200
            );


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

