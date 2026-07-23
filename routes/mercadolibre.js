const express = require("express");
const axios = require("axios");

const router = express.Router();

const isAuthenticated =
    require("../middleware/authMiddleware");


// ============================================================
// CONFIGURACIÓN MERCADO LIBRE
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
// ============================================================

router.get(
    "/",
    isAuthenticated,
    async (req, res) => {

        try {

            res.render(
                "logistica/mercadolibre/dashboard",
                {

                    username:
                        req.session.user.username,

                    role:
                        req.session.user.role,

                    mercadolibreConnected:
                        false,

                    lastSync:
                        null,

                    totalShipments:
                        0,

                    pendingShipments:
                        0,

                    importedToday:
                        0

                }
            );

        } catch (error) {

            console.error(
                "❌ Error cargando dashboard Mercado Libre:",
                error
            );

            res
                .status(500)
                .send(
                    "Error cargando el módulo de Mercado Libre."
                );

        }

    }
);


// ============================================================
// INICIAR CONEXIÓN CON MERCADO LIBRE
// ============================================================

router.get(
    "/conectar",
    isAuthenticated,
    (req, res) => {

        try {

            const faltantes =
                validarConfiguracion();


            if (faltantes.length > 0) {

                console.error(
                    "❌ Faltan variables de entorno:",
                    faltantes
                );

                return res
                    .status(500)
                    .send(
                        `
                        <h2>Error de configuración</h2>
                        <p>Faltan variables de entorno:</p>
                        <pre>${faltantes.join("\n")}</pre>
                        `
                    );

            }


            // ==================================================
            // GENERAR STATE DE SEGURIDAD
            // ==================================================

            const state =
                `${req.session.user.id}_${Date.now()}_${Math.random()
                    .toString(36)
                    .substring(2)}`;


            // Guardar state en la sesión
            // para validar el callback

            req.session.mercadolibreOAuthState =
                state;


            // Guardar usuario que inició
            // la conexión

            req.session.mercadolibreOAuthUserId =
                req.session.user.id;


            // ==================================================
            // URL DE AUTORIZACIÓN
            // ==================================================

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
                "🔵 Iniciando conexión OAuth con Mercado Libre"
            );


            console.log(
                "👤 Usuario AppCraftPro:",
                req.session.user.username
            );


            console.log(
                "🔗 Redirect URI:",
                MERCADOLIBRE_REDIRECT_URI
            );


            res.redirect(
                authorizationURL.toString()
            );


        } catch (error) {

            console.error(
                "❌ Error iniciando OAuth Mercado Libre:",
                error
            );


            res
                .status(500)
                .send(
                    "Error iniciando la conexión con Mercado Libre."
                );

        }

    }
);


// ============================================================
// CALLBACK OAUTH MERCADO LIBRE
// ============================================================

router.get(
    "/callback",
    async (req, res) => {

        try {

            console.log(
                "================================================="
            );

            console.log(
                "🔵 CALLBACK MERCADO LIBRE RECIBIDO"
            );

            console.log(
                "================================================="
            );


            console.log(
                "Query recibida:",
                req.query
            );


            // ==================================================
            // OBTENER DATOS
            // ==================================================

            const {
                code,
                state,
                error,
                error_description
            } = req.query;


            // ==================================================
            // VALIDAR ERROR DE MERCADO LIBRE
            // ==================================================

            if (error) {

                console.error(
                    "❌ Mercado Libre rechazó la autorización"
                );

                console.error(
                    "Error:",
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
                        Mercado Libre rechazó o canceló la autorización.
                        </p>

                        <p>
                        ${error_description || error}
                        </p>

                        <br>

                        <a href="/panel/logistica/mercadolibre">
                        Volver a Mercado Libre
                        </a>
                        `
                    );

            }


            // ==================================================
            // VALIDAR CODE
            // ==================================================

            if (!code) {

                console.error(
                    "❌ No se recibió código OAuth."
                );


                return res
                    .status(400)
                    .send(
                        "No se recibió el código de autorización de Mercado Libre."
                    );

            }


            // ==================================================
            // VALIDAR STATE
            // ==================================================

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
                    "❌ State OAuth inválido."
                );


                console.error(
                    "State recibido:",
                    state
                );


                console.error(
                    "State guardado:",
                    savedState
                );


                return res
                    .status(403)
                    .send(
                        `
                        <h2>Error de seguridad</h2>

                        <p>
                        El estado de autorización de Mercado Libre no coincide.
                        </p>

                        <p>
                        Volvé a iniciar la conexión desde AppCraftPro.
                        </p>
                        `
                    );

            }


            // ==================================================
            // OBTENER USUARIO DE APPCRAFTPRO
            // ==================================================

            const appcraftUserId =
                req.session
                    ? req.session.mercadolibreOAuthUserId
                    : null;


            // ==================================================
            // LIMPIAR DATOS TEMPORALES
            // ==================================================

            if (req.session) {

                delete req.session
                    .mercadolibreOAuthState;

                delete req.session
                    .mercadolibreOAuthUserId;

            }


            // ==================================================
            // VALIDAR CONFIGURACIÓN
            // ==================================================

            const faltantes =
                validarConfiguracion();


            if (faltantes.length > 0) {

                console.error(
                    "❌ Faltan variables de entorno:",
                    faltantes
                );


                return res
                    .status(500)
                    .send(
                        "Mercado Libre no está configurado correctamente en Render."
                    );

            }


            // ==================================================
            // INTERCAMBIAR CODE POR ACCESS TOKEN
            // ==================================================

            console.log(
                "🔄 Intercambiando código OAuth por tokens..."
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


            // ==================================================
            // DATOS RECIBIDOS
            // ==================================================

            const accessToken =
                tokenData.access_token;

            const refreshToken =
                tokenData.refresh_token;

            const userId =
                tokenData.user_id;

            const expiresIn =
                tokenData.expires_in;

            const tokenType =
                tokenData.token_type;


            console.log(
                "✅ Access Token recibido."
            );


            console.log(
                "👤 Mercado Libre User ID:",
                userId
            );


            console.log(
                "⏱️ Expira en:",
                expiresIn,
                "segundos"
            );


            // ==================================================
            // VALIDAR TOKEN
            // ==================================================

            if (!accessToken) {

                console.error(
                    "❌ Mercado Libre no devolvió Access Token."
                );


                return res
                    .status(500)
                    .send(
                        "Mercado Libre no devolvió un Access Token válido."
                    );

            }


            // ==================================================
            // OBTENER INFORMACIÓN DEL USUARIO
            // ==================================================

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
                    "✅ Cuenta Mercado Libre identificada:"
                );


                console.log(
                    "Nombre:",
                    mercadoLibreUser.nickname
                );


                console.log(
                    "User ID:",
                    mercadoLibreUser.id
                );


            } catch (userError) {

                console.error(
                    "⚠️ No se pudo obtener información del usuario Mercado Libre:"
                );


                console.error(
                    userError.response
                        ? userError.response.data
                        : userError.message
                );

            }


            // ==================================================
            // IMPORTANTE
            // ==================================================
            //
            // En este punto ya tenemos:
            //
            // accessToken
            // refreshToken
            // userId
            // expiresIn
            // tokenType
            // mercadoLibreUser
            // appcraftUserId
            //
            // El próximo paso es guardar estos datos
            // en la base de datos.
            //
            // ==================================================


            console.log(
                "================================================="
            );

            console.log(
                "🎉 MERCADO LIBRE AUTORIZADO CORRECTAMENTE"
            );

            console.log(
                "================================================="
            );


            // ==================================================
            // RESPUESTA TEMPORAL
            // ==================================================

            return res.send(
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
                        Mercado Libre conectado
                    </title>

                    <style>

                        body {

                            margin: 0;

                            min-height: 100vh;

                            display: flex;

                            align-items: center;

                            justify-content: center;

                            font-family:
                                Arial,
                                sans-serif;

                            background:
                                #f1f5f9;

                        }

                        .card {

                            background:
                                white;

                            padding:
                                40px;

                            border-radius:
                                20px;

                            box-shadow:
                                0 20px 50px
                                rgba(0,0,0,.12);

                            text-align:
                                center;

                            max-width:
                                500px;

                        }

                        .icon {

                            font-size:
                                60px;

                            margin-bottom:
                                20px;

                        }

                        h1 {

                            color:
                                #0f172a;

                        }

                        p {

                            color:
                                #64748b;

                            line-height:
                                1.6;

                        }

                        a {

                            display:
                                inline-block;

                            margin-top:
                                20px;

                            padding:
                                12px 24px;

                            background:
                                #2563eb;

                            color:
                                white;

                            text-decoration:
                                none;

                            border-radius:
                                10px;

                        }

                    </style>

                </head>

                <body>

                    <div class="card">

                        <div class="icon">
                            ✅
                        </div>

                        <h1>
                            Mercado Libre conectado
                        </h1>

                        <p>
                            La autorización se completó correctamente.
                        </p>

                        <p>
                            La cuenta de Mercado Libre fue autorizada
                            para utilizar la integración logística.
                        </p>

                        <a
                            href="/panel/logistica/mercadolibre"
                        >
                            Ir al módulo Mercado Libre
                        </a>

                    </div>

                </body>

                </html>
                `
            );


        } catch (error) {

            console.error(
                "================================================="
            );

            console.error(
                "❌ ERROR CALLBACK MERCADO LIBRE"
            );

            console.error(
                "================================================="
            );


            if (
                error.response
            ) {

                console.error(
                    "Status:",
                    error.response.status
                );


                console.error(
                    "Data:",
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
                    Ocurrió un error al obtener la autorización.
                    </p>

                    <p>
                    Revisá los logs de Render para obtener más información.
                    </p>

                    <br>

                    <a href="/panel/logistica/mercadolibre">
                    Volver
                    </a>
                    `
                );

        }

    }
);


// ============================================================
// WEBHOOK MERCADO LIBRE
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
                "Headers:",
                req.headers
            );


            console.log(
                "Body:",
                req.body
            );


            // ==================================================
            // RESPONDER RÁPIDAMENTE
            // ==================================================

            res.sendStatus(
                200
            );


            // ==================================================
            // PROCESAMIENTO
            // ==================================================
            //
            // Después acá vamos a detectar:
            //
            // orders
            // shipments
            // messages
            // etc.
            //
            // Y cuando llegue una actualización
            // de un envío Flex, podremos consultar
            // automáticamente los datos.
            //
            // ==================================================


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
// ESTADO DE CONEXIÓN
// ============================================================

router.get(
    "/estado",
    isAuthenticated,
    async (req, res) => {

        try {

            // ==================================================
            // TEMPORAL
            // ==================================================
            //
            // Después consultaremos la base de datos
            // para saber si el usuario tiene una cuenta
            // Mercado Libre conectada.
            //
            // ==================================================

            return res.json({

                ok:
                    true,

                conectado:
                    false,

                mensaje:
                    "La cuenta de Mercado Libre todavía no está registrada en la base de datos."

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

                    mensaje:
                        "Error consultando el estado de Mercado Libre."

                });

        }

    }
);


// ============================================================
// SINCRONIZAR ENVÍOS
// ============================================================

router.post(
    "/sincronizar",
    isAuthenticated,
    async (req, res) => {

        try {

            console.log(
                "🔄 Solicitud de sincronización Mercado Libre"
            );


            // ==================================================
            // PRÓXIMO PASO
            // ==================================================
            //
            // Acá llamaremos a:
            //
            // mercadolibreService
            //
            // para:
            //
            // 1. Obtener Access Token
            //
            // 2. Consultar envíos
            //
            // 3. Obtener paquetes Flex
            //
            // 4. Evitar duplicados
            //
            // 5. Mostrar paquetes nuevos
            //
            // 6. Permitir clasificarlos por cliente
            //
            // 7. Importarlos a logistica_paquetes
            //
            // ==================================================


            return res.json({

                ok:
                    true,

                mensaje:
                    "La sincronización será implementada con el servicio de Mercado Libre."

            });


        } catch (error) {

            console.error(
                "❌ Error sincronizando Mercado Libre:",
                error
            );


            return res
                .status(500)
                .json({

                    ok:
                        false,

                    mensaje:
                        "Error sincronizando envíos de Mercado Libre."

                });

        }

    }
);


// ============================================================
// EXPORTAR ROUTER
// ============================================================

module.exports =
    router;