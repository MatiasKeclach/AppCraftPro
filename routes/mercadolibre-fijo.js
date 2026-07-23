
// ============================================================
// routes/mercadolibre.js
// INTEGRACIÓN MERCADO LIBRE - APPCRAFTPRO
// ============================================================

const express = require("express");
const axios = require("axios");

const router = express.Router();

const isAuthenticated =
    require("../middleware/authMiddleware");


// ============================================================
// CONFIGURACIÓN
// Las credenciales se obtienen desde Render Environment
// ============================================================

const MERCADOLIBRE_CLIENT_ID =
    process.env.MERCADOLIBRE_CLIENT_ID;

const MERCADOLIBRE_CLIENT_SECRET =
    process.env.MERCADOLIBRE_CLIENT_SECRET;

const MERCADOLIBRE_REDIRECT_URI =
    process.env.MERCADOLIBRE_REDIRECT_URI;


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
// DASHBOARD MERCADO LIBRE
//
// URL final:
// /panel/logistica/mercadolibre
//
// Vista:
// views/logistica/mercadolibre.ejs
// ============================================================

router.get(
    "/",
    isAuthenticated,
    async (req, res) => {

        try {

            const faltantes =
                validarConfiguracion();

            const configurado =
                faltantes.length === 0;


            // ------------------------------------------------
            // Renderizar vista
            // ------------------------------------------------

            return res.render(
                "logistica/mercadolibre",
                {

                    username:
                        req.session.user
                            ? req.session.user.username
                            : "Usuario",

                    role:
                        req.session.user
                            ? req.session.user.role
                            : "usuario",

                    // Estado inicial
                    mercadolibreConnected:
                        false,

                    // Estadísticas
                    lastSync:
                        null,

                    totalShipments:
                        0,

                    pendingShipments:
                        0,

                    importedToday:
                        0,

                    // Configuración
                    mercadolibreConfigured:
                        configurado,

                    configurationErrors:
                        faltantes

                }
            );

        } catch (error) {

            console.error(
                "❌ Error cargando módulo Mercado Libre:",
                error
            );

            return res
                .status(500)
                .send(
                    "Error cargando el módulo de Mercado Libre."
                );

        }

    }
);


// ============================================================
// CONECTAR MERCADO LIBRE
//
// URL:
// /panel/logistica/mercadolibre/conectar
// ============================================================

router.get(
    "/conectar",
    isAuthenticated,
    (req, res) => {

        try {

            // ------------------------------------------------
            // Validar variables de entorno
            // ------------------------------------------------

            const faltantes =
                validarConfiguracion();


            if (
                faltantes.length > 0
            ) {

                console.error(
                    "❌ Configuración Mercado Libre incompleta:",
                    faltantes
                );

                return res
                    .status(500)
                    .send(
                        `
                        <!DOCTYPE html>

                        <html lang="es">

                        <head>

                            <meta charset="UTF-8">

                            <meta
                                name="viewport"
                                content="width=device-width, initial-scale=1.0"
                            >

                            <title>
                                Error de configuración
                            </title>

                            <style>

                                body {
                                    margin: 0;
                                    min-height: 100vh;
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;
                                    font-family: Arial, sans-serif;
                                    background: #0f172a;
                                    color: white;
                                }

                                .card {
                                    max-width: 600px;
                                    padding: 40px;
                                    background: #1e293b;
                                    border-radius: 20px;
                                    box-shadow: 0 20px 50px rgba(0,0,0,.3);
                                }

                                h1 {
                                    color: #f87171;
                                }

                                pre {
                                    background: #020617;
                                    padding: 20px;
                                    border-radius: 10px;
                                    color: #fca5a5;
                                }

                                a {
                                    display: inline-block;
                                    margin-top: 20px;
                                    padding: 12px 20px;
                                    background: #3b82f6;
                                    color: white;
                                    text-decoration: none;
                                    border-radius: 10px;
                                }

                            </style>

                        </head>

                        <body>

                            <div class="card">

                                <h1>
                                    ⚠️ Configuración incompleta
                                </h1>

                                <p>
                                    Mercado Libre no está configurado correctamente.
                                </p>

                                <p>
                                    Faltan las siguientes variables:
                                </p>

                                <pre>${faltantes.join("\n")}</pre>

                                <a
                                    href="/panel/logistica/mercadolibre"
                                >
                                    Volver
                                </a>

                            </div>

                        </body>

                        </html>
                        `
                    );

            }


            // ------------------------------------------------
            // Crear STATE seguro
            // ------------------------------------------------

            const state =
                `${req.session.user.id}_${Date.now()}_${Math.random()
                    .toString(36)
                    .substring(2, 15)}`;


            // ------------------------------------------------
            // Guardar información OAuth en sesión
            // ------------------------------------------------

            req.session.mercadolibreOAuthState =
                state;

            req.session.mercadolibreOAuthUserId =
                req.session.user.id;


            // ------------------------------------------------
            // Crear URL OAuth
            // ------------------------------------------------

            const authorizationURL =
                new URL(
                    "https://auth.mercadolibre.com.ar/authorization"
                );


            authorizationURL.searchParams.set(
                "response_type",
                "code"
            );


            authorizationURL.searchParams.set(
                "client_id",
                MERCADOLIBRE_CLIENT_ID
            );


            authorizationURL.searchParams.set(
                "redirect_uri",
                MERCADOLIBRE_REDIRECT_URI
            );


            authorizationURL.searchParams.set(
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
                "👤 Usuario:",
                req.session.user.username
            );

            console.log(
                "🆔 Usuario AppCraftPro:",
                req.session.user.id
            );

            console.log(
                "🔗 Redirect URI:",
                MERCADOLIBRE_REDIRECT_URI
            );

            console.log(
                "=========================================="
            );


            // ------------------------------------------------
            // Redireccionar a Mercado Libre
            // ------------------------------------------------

            return res.redirect(
                authorizationURL.toString()
            );


        } catch (error) {

            console.error(
                "❌ Error iniciando OAuth Mercado Libre:",
                error
            );

            return res
                .status(500)
                .send(
                    "Error iniciando la conexión con Mercado Libre."
                );

        }

    }
);


// ============================================================
// CALLBACK OAUTH
//
// URL completa:
// /panel/logistica/mercadolibre/callback
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


            // ------------------------------------------------
            // Mercado Libre devolvió un error
            // ------------------------------------------------

            if (
                error
            ) {

                console.error(
                    "❌ Error OAuth Mercado Libre:",
                    error
                );

                console.error(
                    "Descripción:",
                    error_description
                );


                return res
                    .status(400)
                    .send(
                        `
                        <h2>Autorización cancelada</h2>

                        <p>
                            ${error_description || error}
                        </p>

                        <a href="/panel/logistica/mercadolibre">
                            Volver a Mercado Libre
                        </a>
                        `
                    );

            }


            // ------------------------------------------------
            // Validar código
            // ------------------------------------------------

            if (
                !code
            ) {

                return res
                    .status(400)
                    .send(
                        `
                        <h2>Error de autorización</h2>

                        <p>
                            Mercado Libre no devolvió el código de autorización.
                        </p>

                        <a href="/panel/logistica/mercadolibre">
                            Volver
                        </a>
                        `
                    );

            }


            // ------------------------------------------------
            // Validar STATE
            // ------------------------------------------------

            const savedState =
                req.session
                    ? req.session.mercadolibreOAuthState
                    : null;


            if (
                !state ||
                !savedState ||
                state !== savedState
            ) {

                console.error(
                    "❌ STATE OAuth inválido"
                );

                console.error(
                    "Recibido:",
                    state
                );

                console.error(
                    "Guardado:",
                    savedState
                );


                return res
                    .status(403)
                    .send(
                        `
                        <h2>Error de seguridad</h2>

                        <p>
                            La sesión de autorización no coincide.
                        </p>

                        <p>
                            Volvé a iniciar la conexión desde AppCraftPro.
                        </p>

                        <a href="/panel/logistica/mercadolibre">
                            Volver
                        </a>
                        `
                    );

            }


            // ------------------------------------------------
            // Usuario de AppCraftPro
            // ------------------------------------------------

            const appcraftUserId =
                req.session
                    ? req.session.mercadolibreOAuthUserId
                    : null;


            // ------------------------------------------------
            // Intercambiar CODE por TOKEN
            // ------------------------------------------------

            console.log(
                "🔄 Intercambiando código OAuth..."
            );


            const tokenResponse =
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


            const tokenData =
                tokenResponse.data;


            const accessToken =
                tokenData.access_token;

            const refreshToken =
                tokenData.refresh_token;

            const mercadoLibreUserId =
                tokenData.user_id;

            const expiresIn =
                tokenData.expires_in;


            // ------------------------------------------------
            // Validar Access Token
            // ------------------------------------------------

            if (
                !accessToken
            ) {

                throw new Error(
                    "Mercado Libre no devolvió Access Token."
                );

            }


            console.log(
                "✅ Access Token recibido"
            );

            console.log(
                "👤 Mercado Libre User ID:",
                mercadoLibreUserId
            );


            // ------------------------------------------------
            // Obtener información de la cuenta
            // ------------------------------------------------

            let mercadoLibreUser =
                null;


            try {

                const userResponse =
                    await axios.get(

                        "https://api.mercadolibre.com/users/me",

                        {

                            headers: {

                                Authorization:
                                    `Bearer ${accessToken}`

                            }

                        }

                    );


                mercadoLibreUser =
                    userResponse.data;


                console.log(
                    "✅ Cuenta Mercado Libre:",
                    mercadoLibreUser.nickname
                );


            } catch (userError) {

                console.error(
                    "⚠️ No se pudo consultar users/me:",
                    userError.response
                        ? userError.response.data
                        : userError.message
                );

            }


            // ------------------------------------------------
            // Guardar conexión temporalmente en sesión
            //
            // IMPORTANTE:
            // Esto permite que el dashboard sepa que está
            // conectado mientras terminamos la persistencia
            // definitiva en SQLite.
            // ------------------------------------------------

            if (
                req.session
            ) {

                req.session.mercadolibreConnected =
                    true;

                req.session.mercadolibreAccessToken =
                    accessToken;

                req.session.mercadolibreRefreshToken =
                    refreshToken;

                req.session.mercadolibreUserId =
                    mercadoLibreUserId;

                req.session.mercadolibreExpiresIn =
                    expiresIn;

                req.session.mercadolibreAccount =
                    mercadoLibreUser;

                req.session.mercadolibreAppcraftUserId =
                    appcraftUserId;


                // Limpiar OAuth temporal
                delete req.session
                    .mercadolibreOAuthState;

                delete req.session
                    .mercadolibreOAuthUserId;

            }


            console.log(
                "=========================================="
            );

            console.log(
                "🎉 MERCADO LIBRE CONECTADO"
            );

            console.log(
                "=========================================="
            );


            // ------------------------------------------------
            // Volver al dashboard
            // ------------------------------------------------

            return res.redirect(
                "/panel/logistica/mercadolibre?connected=1"
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


            if (
                error.response
            ) {

                console.error(
                    "HTTP Status:",
                    error.response.status
                );

                console.error(
                    "Respuesta:",
                    error.response.data
                );

            } else {

                console.error(
                    error.message
                );

            }


            return res
                .status(500)
                .send(
                    `
                    <h2>Error conectando Mercado Libre</h2>

                    <p>
                        No se pudo completar la conexión con Mercado Libre.
                    </p>

                    <p>
                        Revisá los logs de Render para obtener el detalle.
                    </p>

                    <a href="/panel/logistica/mercadolibre">
                        Volver al módulo
                    </a>
                    `
                );

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
                req.session &&
                req.session.mercadolibreConnected === true;


            const cuenta =
                req.session
                    ? req.session.mercadolibreAccount
                    : null;


            return res.json({

                ok:
                    true,

                conectado,

                cuenta:
                    cuenta
                        ? {

                            id:
                                cuenta.id,

                            nickname:
                                cuenta.nickname,

                            firstName:
                                cuenta.first_name,

                            lastName:
                                cuenta.last_name

                        }
                        : null

            });


        } catch (error) {

            console.error(
                "❌ Error consultando estado Mercado Libre:",
                error
            );


            return res
                .status(500)
                .json({

                    ok:
                        false,

                    conectado:
                        false,

                    mensaje:
                        "Error consultando el estado de Mercado Libre."

                });

        }

    }
);


// ============================================================
// SINCRONIZAR ENVÍOS
//
// POST:
// /panel/logistica/mercadolibre/sincronizar
// ============================================================

router.post(
    "/sincronizar",
    isAuthenticated,
    async (req, res) => {

        try {

            // ------------------------------------------------
            // Verificar conexión
            // ------------------------------------------------

            if (
                !req.session ||
                !req.session.mercadolibreAccessToken
            ) {

                return res
                    .status(401)
                    .json({

                        ok:
                            false,

                        conectado:
                            false,

                        mensaje:
                            "La cuenta de Mercado Libre no está conectada."

                    });

            }


            const accessToken =
                req.session.mercadolibreAccessToken;


            console.log(
                "🔄 Sincronizando Mercado Libre..."
            );


            // ------------------------------------------------
            // Ejemplo de consulta de usuario
            // ------------------------------------------------

            const userResponse =
                await axios.get(

                    "https://api.mercadolibre.com/users/me",

                    {

                        headers: {

                            Authorization:
                                `Bearer ${accessToken}`

                        }

                    }

                );


            const cuenta =
                userResponse.data;


            console.log(
                "✅ Cuenta sincronizada:",
                cuenta.nickname
            );


            // ------------------------------------------------
            // TODO:
            //
            // Acá agregaremos la consulta real de:
            //
            // - shipments
            // - orders
            // - envíos Flex
            // - paquetes
            // - duplicados
            // - importación a logística
            //
            // ------------------------------------------------


            return res.json({

                ok:
                    true,

                mensaje:
                    "Conexión con Mercado Libre verificada correctamente.",

                cuenta: {

                    id:
                        cuenta.id,

                    nickname:
                        cuenta.nickname

                },

                totalShipments:
                    0,

                pendingShipments:
                    0,

                importedToday:
                    0

            });


        } catch (error) {

            console.error(
                "❌ Error sincronizando Mercado Libre:",
                error.response
                    ? error.response.data
                    : error.message
            );


            // ------------------------------------------------
            // Token vencido o inválido
            // ------------------------------------------------

            if (
                error.response &&
                (
                    error.response.status === 401 ||
                    error.response.status === 403
                )
            ) {

                if (
                    req.session
                ) {

                    req.session.mercadolibreConnected =
                        false;

                    delete req.session
                        .mercadolibreAccessToken;

                }


                return res
                    .status(401)
                    .json({

                        ok:
                            false,

                        conectado:
                            false,

                        mensaje:
                            "La sesión de Mercado Libre expiró. Volvé a conectar la cuenta."

                    });

            }


            return res
                .status(500)
                .json({

                    ok:
                        false,

                    mensaje:
                        "Error sincronizando Mercado Libre."

                });

        }

    }
);


// ============================================================
// WEBHOOK MERCADO LIBRE
//
// URL:
// /panel/logistica/mercadolibre/webhook
// ============================================================

router.post(
    "/webhook",
    async (req, res) => {

        try {

            console.log(
                "📡 WEBHOOK MERCADO LIBRE RECIBIDO"
            );

            console.log(
                "Fecha:",
                new Date().toISOString()
            );

            console.log(
                "Body:",
                req.body
            );


            // Mercado Libre necesita una respuesta rápida
            return res
                .sendStatus(
                    200
                );


        } catch (error) {

            console.error(
                "❌ Error procesando webhook Mercado Libre:",
                error
            );


            return res
                .sendStatus(
                    500
                );

        }

    }
);


// ============================================================
// EXPORTAR ROUTER
// ============================================================

module.exports =
    router;
