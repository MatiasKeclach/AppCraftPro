// ============================================================
// routes/mercadolibre.js
// MERCADO LIBRE + MERCADO ENVÍOS FLEX
// APPCRAFTPRO
// ============================================================

const express = require("express");
const axios = require("axios");

const router = express.Router();

const isAuthenticated =
    require("../middleware/authMiddleware");


// ============================================================
// CONFIGURACIÓN
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
// DASHBOARD
// ============================================================

router.get(
    "/",
    isAuthenticated,
    async (req, res) => {

        try {

            const faltantes =
                validarConfiguracion();

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

                    mercadolibreConnected:
                        req.session.mercadolibreConnected === true,

                    lastSync:
                        null,

                    totalShipments:
                        0,

                    pendingShipments:
                        0,

                    importedToday:
                        0,

                    mercadolibreConfigured:
                        faltantes.length === 0,

                    configurationErrors:
                        faltantes

                }
            );

        } catch (error) {

            console.error(
                "❌ Error cargando Mercado Libre:",
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

                return res
                    .status(500)
                    .send(
                        `
                        <h2>Configuración incompleta</h2>

                        <p>
                        Faltan:
                        </p>

                        <pre>
${faltantes.join("\n")}
                        </pre>

                        <a href="/panel/logistica/mercadolibre">
                            Volver
                        </a>
                        `
                    );

            }


            const state =
                `${req.session.user.id}_${Date.now()}_${Math.random()
                    .toString(36)
                    .substring(2, 15)}`;


            req.session.mercadolibreOAuthState =
                state;

            req.session.mercadolibreOAuthUserId =
                req.session.user.id;


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


            return res.redirect(
                authorizationURL.toString()
            );


        } catch (error) {

            console.error(
                "❌ Error OAuth:",
                error
            );

            return res
                .status(500)
                .send(
                    "Error iniciando conexión con Mercado Libre."
                );

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

            const {
                code,
                state,
                error,
                error_description
            } = req.query;


            if (
                error
            ) {

                return res
                    .status(400)
                    .send(
                        `
                        <h2>Autorización cancelada</h2>

                        <p>
                        ${error_description || error}
                        </p>

                        <a href="/panel/logistica/mercadolibre">
                        Volver
                        </a>
                        `
                    );

            }


            if (
                !code
            ) {

                return res
                    .status(400)
                    .send(
                        "Mercado Libre no devolvió código de autorización."
                    );

            }


            const savedState =
                req.session
                    ? req.session.mercadolibreOAuthState
                    : null;


            if (
                !state ||
                !savedState ||
                state !== savedState
            ) {

                return res
                    .status(403)
                    .send(
                        "Estado OAuth inválido."
                    );

            }


            const appcraftUserId =
                req.session
                    ? req.session.mercadolibreOAuthUserId
                    : null;


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


            if (
                !accessToken
            ) {

                throw new Error(
                    "No se recibió Access Token."
                );

            }


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

            } catch (
                userError
            ) {

                console.error(
                    "Error obteniendo usuario ML:",
                    userError.message
                );

            }


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


            delete req.session
                .mercadolibreOAuthState;

            delete req.session
                .mercadolibreOAuthUserId;


            return res.redirect(
                "/panel/logistica/mercadolibre?connected=1"
            );


        } catch (error) {

            console.error(
                "❌ ERROR CALLBACK ML:",
                error.response
                    ? error.response.data
                    : error.message
            );

            return res
                .status(500)
                .send(
                    `
                    <h2>Error conectando Mercado Libre</h2>

                    <p>
                    ${error.message}
                    </p>

                    <a href="/panel/logistica/mercadolibre">
                    Volver
                    </a>
                    `
                );

        }

    }
);


// ============================================================
// ESTADO
// ============================================================

router.get(
    "/estado",
    isAuthenticated,
    async (req, res) => {

        try {

            const conectado =
                !!(
                    req.session &&
                    req.session.mercadolibreAccessToken
                );


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

            return res
                .status(500)
                .json({

                    ok:
                        false,

                    conectado:
                        false,

                    mensaje:
                        "Error consultando conexión."

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
                            "Mercado Libre no está conectado."

                    });

            }


            const accessToken =
                req.session.mercadolibreAccessToken;


            const userId =
                req.session.mercadolibreUserId;


            console.log(
                "======================================"
            );

            console.log(
                "🔄 SINCRONIZACIÓN MERCADO LIBRE"
            );

            console.log(
                "👤 Usuario:",
                userId
            );

            console.log(
                "======================================"
            );


            // ==================================================
            // BUSCAR ÓRDENES RECIENTES
            // ==================================================

            const ordersResponse =
                await axios.get(

                    "https://api.mercadolibre.com/orders/search",

                    {

                        params: {

                            seller:
                                userId,

                            sort:
                                "date_desc",

                            limit:
                                50

                        },

                        headers: {

                            Authorization:
                                `Bearer ${accessToken}`

                        }

                    }

                );


            const orders =
                ordersResponse.data.results || [];


            console.log(
                "📦 Órdenes encontradas:",
                orders.length
            );


            const envios =
                [];


            // ==================================================
            // PROCESAR ÓRDENES
            // ==================================================

            for (
                const order of orders
            ) {

                const shipmentId =
                    order.shipping &&
                    order.shipping.id;


                if (
                    !shipmentId
                ) {

                    continue;

                }


                try {

                    const shipmentResponse =
                        await axios.get(

                            `https://api.mercadolibre.com/shipments/${shipmentId}`,

                            {

                                headers: {

                                    Authorization:
                                        `Bearer ${accessToken}`

                                }

                            }

                        );


                    const shipment =
                        shipmentResponse.data;


                    const receiver =
                        shipment.receiver_address ||
                        {};


                    const shippingOption =
                        shipment.shipping_option ||
                        {};


                    const logisticType =
                        shipment.logistic_type ||
                        shippingOption.name ||
                        "";


                    const esFlex =
                        logisticType
                            .toString()
                            .toLowerCase()
                            .includes("flex");


                    envios.push({

                        id:
                            shipment.id,

                        shipment_id:
                            shipment.id,

                        order_id:
                            order.id,

                        codigo:
                            shipment.tracking_number ||
                            shipment.id,

                        tracking_number:
                            shipment.tracking_number ||
                            "",

                        destinatario:
                            receiver.receiver_name ||
                            receiver.name ||
                            order.buyer
                                ? (
                                    order.buyer.nickname ||
                                    ""
                                )
                                : "",

                        direccion:
                            receiver.address_line ||
                            receiver.address ||
                            "",

                        localidad:
                            receiver.city ||
                            "",

                        estado:
                            shipment.status ||
                            order.status ||
                            "pendiente",

                        logistic_type:
                            logisticType,

                        es_flex:
                            esFlex,

                        fecha:
                            order.date_created ||
                            null,

                        raw:
                            shipment

                    });


                } catch (
                    shipmentError
                ) {

                    console.error(

                        "Error consultando shipment",
                        shipmentId,

                        shipmentError.response
                            ? shipmentError.response.data
                            : shipmentError.message

                    );

                }

            }


            // ==================================================
            // SOLO FLEX
            // ==================================================

            const enviosFlex =
                envios.filter(
                    envio =>
                        envio.es_flex
                );


            console.log(
                "🚚 Envíos Flex encontrados:",
                enviosFlex.length
            );


            // ==================================================
            // SI NO DETECTA FLEX
            // DEVOLVEMOS TODOS PARA DIAGNÓSTICO
            // ==================================================

            const resultadoFinal =
                enviosFlex.length > 0
                    ? enviosFlex
                    : envios;


            return res.json({

                ok:
                    true,

                conectado:
                    true,

                mensaje:
                    resultadoFinal.length > 0
                        ? `Se encontraron ${resultadoFinal.length} envíos.`
                        : "No se encontraron envíos.",

                totalShipments:
                    resultadoFinal.length,

                pendingShipments:
                    resultadoFinal.filter(
                        envio =>
                            envio.estado === "pending" ||
                            envio.estado === "pendiente"
                    ).length,

                importedToday:
                    0,

                envios:
                    resultadoFinal

            });


        } catch (error) {

            console.error(
                "❌ Error sincronizando:",
                error.response
                    ? error.response.data
                    : error.message
            );


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
                            "La sesión de Mercado Libre expiró."

                    });

            }


            return res
                .status(500)
                .json({

                    ok:
                        false,

                    mensaje:
                        "Error sincronizando envíos.",

                    detalle:
                        error.response
                            ? error.response.data
                            : error.message

                });

        }

    }
);


// ============================================================
// WEBHOOK
// ============================================================

router.post(
    "/webhook",
    async (req, res) => {

        console.log(
            "📡 WEBHOOK MERCADO LIBRE"
        );

        console.log(
            new Date().toISOString()
        );

        console.log(
            req.body
        );

        return res.sendStatus(200);

    }
);


// ============================================================
// EXPORTAR
// ============================================================

module.exports =
    router;