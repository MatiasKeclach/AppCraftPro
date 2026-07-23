// ============================================================
// routes/mercadolibre.js
// INTEGRACIÓN MERCADO LIBRE + LOGÍSTICA APPCRAFTPRO
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
// CONFIGURACIÓN GENERAL
// ============================================================

const ML_API =
    "https://api.mercadolibre.com";


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
// OBTENER TOKEN
// ============================================================

function obtenerAccessToken(req) {

    if (
        !req.session ||
        !req.session.mercadolibreAccessToken
    ) {

        return null;

    }

    return req.session.mercadolibreAccessToken;

}


// ============================================================
// AXIOS AUTORIZADO
// ============================================================

function mlRequest(
    accessToken
) {

    return axios.create({

        baseURL:
            ML_API,

        headers: {

            Authorization:
                `Bearer ${accessToken}`,

            Accept:
                "application/json"

        },

        timeout:
            20000

    });

}


// ============================================================
// DASHBOARD
//
// GET:
// /panel/logistica/mercadolibre
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
                        Boolean(
                            req.session &&
                            req.session.mercadolibreConnected
                        ),

                    lastSync:
                        null,

                    totalShipments:
                        0,

                    pendingShipments:
                        0,

                    importedToday:
                        0,

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
                "🔗 Redirect:",
                MERCADOLIBRE_REDIRECT_URI
            );

            console.log(
                "=========================================="
            );


            return res.redirect(
                authorizationURL.toString()
            );


        } catch (error) {

            console.error(
                "❌ Error iniciando OAuth:",
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
//
// GET:
// /panel/logistica/mercadolibre/callback
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
                        "Mercado Libre no devolvió el código de autorización."
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
                        `
                        <h2>Error de seguridad</h2>

                        <p>
                            La sesión OAuth no coincide.
                        </p>

                        <a href="/panel/logistica/mercadolibre">
                            Volver
                        </a>
                        `
                    );

            }


            const appcraftUserId =
                req.session
                    ? req.session.mercadolibreOAuthUserId
                    : null;


            console.log(
                "🔄 Intercambiando CODE por TOKEN..."
            );


            const tokenResponse =
                await axios.post(

                    `${ML_API}/oauth/token`,

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
                    "Mercado Libre no devolvió Access Token."
                );

            }


            let mercadoLibreUser =
                null;


            try {

                const userResponse =
                    await axios.get(

                        `${ML_API}/users/me`,

                        {

                            headers: {

                                Authorization:
                                    `Bearer ${accessToken}`

                            }

                        }

                    );


                mercadoLibreUser =
                    userResponse.data;


            } catch (error) {

                console.error(
                    "⚠️ Error obteniendo usuario ML:",
                    error.response
                        ? error.response.data
                        : error.message
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


            delete req.session.mercadolibreOAuthState;

            delete req.session.mercadolibreOAuthUserId;


            console.log(
                "=========================================="
            );

            console.log(
                "🎉 MERCADO LIBRE CONECTADO"
            );

            console.log(
                "👤 ML USER:",
                mercadoLibreUserId
            );

            console.log(
                "=========================================="
            );


            return res.redirect(
                "/panel/logistica/mercadolibre?connected=1"
            );


        } catch (error) {

            console.error(
                "❌ ERROR CALLBACK MERCADO LIBRE"
            );

            console.error(
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
                        No se pudo completar la conexión.
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

            const accessToken =
                obtenerAccessToken(req);


            if (
                !accessToken
            ) {

                return res.json({

                    ok:
                        true,

                    conectado:
                        false,

                    cuenta:
                        null

                });

            }


            const api =
                mlRequest(
                    accessToken
                );


            const response =
                await api.get(
                    "/users/me"
                );


            const cuenta =
                response.data;


            req.session.mercadolibreConnected =
                true;

            req.session.mercadolibreAccount =
                cuenta;


            return res.json({

                ok:
                    true,

                conectado:
                    true,

                cuenta: {

                    id:
                        cuenta.id,

                    nickname:
                        cuenta.nickname,

                    firstName:
                        cuenta.first_name,

                    lastName:
                        cuenta.last_name

                }

            });


        } catch (error) {

            console.error(
                "❌ Error estado ML:",
                error.response
                    ? error.response.data
                    : error.message
            );


            return res.json({

                ok:
                    false,

                conectado:
                    false,

                cuenta:
                    null

            });

        }

    }
);


// ============================================================
// OBTENER ÓRDENES RECIENTES
//
// Esta ruta busca las órdenes de la cuenta.
// Luego obtenemos el shipment_id de cada orden.
//
// GET:
// /panel/logistica/mercadolibre/envios-flex
// ============================================================

router.get(
    "/envios-flex",
    isAuthenticated,
    async (req, res) => {

        try {

            const accessToken =
                obtenerAccessToken(req);


            if (
                !accessToken
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


            const api =
                mlRequest(
                    accessToken
                );


            console.log(
                "=========================================="
            );

            console.log(
                "📦 CONSULTANDO ÓRDENES MERCADO LIBRE"
            );

            console.log(
                "=========================================="
            );


            // ------------------------------------------------
            // Buscar órdenes recientes
            // ------------------------------------------------

            const ordersResponse =
                await api.get(
                    "/orders/search",
                    {

                        params: {

                            seller:
                                req.session.mercadolibreUserId,

                            sort:
                                "date_desc",

                            limit:
                                50

                        }

                    }
                );


            const orders =
                ordersResponse.data.results ||
                [];


            console.log(
                "📦 Órdenes encontradas:",
                orders.length
            );


            const envios =
                [];


            // ------------------------------------------------
            // Recorrer órdenes
            // ------------------------------------------------

            for (
                const order of orders
            ) {

                try {

                    const shippingId =
                        order.shipping
                            ? order.shipping.id
                            : null;


                    if (
                        !shippingId
                    ) {

                        continue;

                    }


                    let shipping =
                        null;


                    try {

                        const shippingResponse =
                            await api.get(

                                `/shipments/${shippingId}`

                            );


                        shipping =
                            shippingResponse.data;


                    } catch (
                        shippingError
                    ) {

                        console.error(

                            "⚠️ Error consultando shipment:",
                            shippingId,

                            shippingError.response
                                ? shippingError.response.data
                                : shippingError.message

                        );

                        continue;

                    }


                    if (
                        !shipping
                    ) {

                        continue;

                    }


                    // ------------------------------------------------
                    // Datos del envío
                    // ------------------------------------------------

                    const receiver =
                        shipping.receiver_address ||
                        {};


                    const receiverName =
                        receiver.receiver_name ||
                        shipping.receiver_name ||
                        "";


                    const streetName =
                        receiver.street_name ||
                        "";


                    const streetNumber =
                        receiver.street_number ||
                        "";


                    const direccion =
                        `${streetName} ${streetNumber}`.trim();


                    const localidad =
                        receiver.city
                            ? receiver.city.name
                            : "";


                    const codigo =
                        shipping.tracking_number ||
                        shipping.id ||
                        order.id;


                    const estado =
                        shipping.status ||
                        order.status ||
                        "pendiente";


                    // ------------------------------------------------
                    // Intentar identificar Flex
                    // ------------------------------------------------

                    const logisticType =
                        shipping.logistic_type ||
                        "";


                    const isFlex =
                        logisticType
                            .toLowerCase()
                            .includes("self_service") ||
                        logisticType
                            .toLowerCase()
                            .includes("flex");


                    envios.push({

                        id:
                            shipping.id,

                        order_id:
                            order.id,

                        codigo:
                            codigo,

                        shipment_id:
                            shipping.id,

                        destinatario:
                            receiverName,

                        direccion:
                            direccion,

                        localidad:
                            localidad,

                        telefono:
                            receiver.receiver_phone ||
                            "",

                        estado:
                            estado,

                        logistic_type:
                            logisticType,

                        es_flex:
                            isFlex,

                        fecha:
                            order.date_created ||
                            null,

                        raw:
                            {

                                order:
                                    order,

                                shipping:
                                    shipping

                            }

                    });


                } catch (
                    orderError
                ) {

                    console.error(
                        "⚠️ Error procesando orden:",
                        orderError.message
                    );

                }

            }


            console.log(
                "📦 Envíos procesados:",
                envios.length
            );


            const enviosFlex =
                envios.filter(
                    envio =>
                        envio.es_flex
                );


            console.log(
                "🚚 Posibles envíos Flex:",
                enviosFlex.length
            );


            return res.json({

                ok:
                    true,

                conectado:
                    true,

                total:
                    envios.length,

                totalFlex:
                    enviosFlex.length,

                envios:
                    envios,

                mensaje:
                    `${envios.length} envíos encontrados.`

            });


        } catch (error) {

            console.error(
                "❌ Error consultando envíos:",
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
                        "Error consultando los envíos de Mercado Libre.",

                    detalle:
                        error.response
                            ? error.response.data
                            : error.message

                });

        }

    }
);


// ============================================================
// SINCRONIZAR
//
// POST:
// /panel/logistica/mercadolibre/sincronizar
// ============================================================

router.post(
    "/sincronizar",
    isAuthenticated,
    async (req, res) => {

        try {

            const accessToken =
                obtenerAccessToken(req);


            if (
                !accessToken
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


            const api =
                mlRequest(
                    accessToken
                );


            const userResponse =
                await api.get(
                    "/users/me"
                );


            const cuenta =
                userResponse.data;


            // ------------------------------------------------
            // Obtener envíos
            // ------------------------------------------------

            const ordersResponse =
                await api.get(
                    "/orders/search",
                    {

                        params: {

                            seller:
                                cuenta.id,

                            sort:
                                "date_desc",

                            limit:
                                50

                        }

                    }
                );


            const orders =
                ordersResponse.data.results ||
                [];


            const envios =
                [];


            for (
                const order of orders
            ) {

                const shippingId =
                    order.shipping
                        ? order.shipping.id
                        : null;


                if (
                    !shippingId
                ) {

                    continue;

                }


                try {

                    const shippingResponse =
                        await api.get(

                            `/shipments/${shippingId}`

                        );


                    const shipping =
                        shippingResponse.data;


                    const receiver =
                        shipping.receiver_address ||
                        {};


                    envios.push({

                        id:
                            shipping.id,

                        order_id:
                            order.id,

                        codigo:
                            shipping.tracking_number ||
                            shipping.id,

                        destinatario:
                            receiver.receiver_name ||
                            "",

                        direccion:
                            `${receiver.street_name || ""} ${receiver.street_number || ""}`.trim(),

                        localidad:
                            receiver.city
                                ? receiver.city.name
                                : "",

                        telefono:
                            receiver.receiver_phone ||
                            "",

                        estado:
                            shipping.status ||
                            order.status ||
                            "pendiente",

                        logistic_type:
                            shipping.logistic_type ||
                            "",

                        fecha:
                            order.date_created ||
                            null

                    });


                } catch (
                    shipmentError
                ) {

                    console.error(

                        "⚠️ Error shipment:",
                        shippingId,

                        shipmentError.message

                    );

                }

            }


            return res.json({

                ok:
                    true,

                mensaje:
                    `${envios.length} envíos encontrados correctamente.`,

                cuenta: {

                    id:
                        cuenta.id,

                    nickname:
                        cuenta.nickname

                },

                totalShipments:
                    envios.length,

                pendingShipments:
                    envios.filter(
                        envio =>
                            envio.estado === "pending"
                    ).length,

                importedToday:
                    0,

                lastSync:
                    new Date(),

                envios:
                    envios

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
                            "La sesión de Mercado Libre expiró. Volvé a conectar la cuenta."

                    });

            }


            return res
                .status(500)
                .json({

                    ok:
                        false,

                    mensaje:
                        "Error sincronizando Mercado Libre.",

                    detalle:
                        error.response
                            ? error.response.data
                            : error.message

                });

        }

    }
);


// ============================================================
// ASIGNAR PAQUETES A COLECTA
//
// POST:
// /panel/logistica/mercadolibre/asignar-colecta
//
// Body esperado:
//
// {
//     "clienteId": 123,
//     "paquetes": [
//         {
//             "id": 123,
//             "codigo": "ML123"
//         }
//     ]
// }
//
// ============================================================

router.post(
    "/asignar-colecta",
    isAuthenticated,
    async (req, res) => {

        try {

            const {
                clienteId,
                paquetes
            } = req.body;


            if (
                !clienteId
            ) {

                return res
                    .status(400)
                    .json({

                        ok:
                            false,

                        mensaje:
                            "Debe seleccionar un cliente o colecta."

                    });

            }


            if (
                !Array.isArray(paquetes) ||
                paquetes.length === 0
            ) {

                return res
                    .status(400)
                    .json({

                        ok:
                            false,

                        mensaje:
                            "No hay paquetes seleccionados."

                    });

            }


            console.log(
                "=========================================="
            );

            console.log(
                "📦 ASIGNANDO PAQUETES"
            );

            console.log(
                "👤 Cliente:",
                clienteId
            );

            console.log(
                "📦 Cantidad:",
                paquetes.length
            );

            console.log(
                "=========================================="
            );


            /*
            =====================================================
            IMPORTANTE

            ACÁ TENEMOS QUE CONECTAR CON TU BASE DE DATOS.

            EJEMPLO:

            for (const paquete of paquetes) {

                INSERT INTO paquetes (...)

            }

            =====================================================
            */


            return res.json({

                ok:
                    true,

                mensaje:
                    `${paquetes.length} paquetes asignados correctamente.`,

                cantidad:
                    paquetes.length,

                clienteId:
                    clienteId

            });


        } catch (error) {

            console.error(
                "❌ Error asignando paquetes:",
                error
            );


            return res
                .status(500)
                .json({

                    ok:
                        false,

                    mensaje:
                        "Error asignando paquetes."

                });

        }

    }
);


// ============================================================
// WEBHOOK
//
// POST:
// /panel/logistica/mercadolibre/webhook
// ============================================================

router.post(
    "/webhook",
    async (req, res) => {

        try {

            console.log(
                "📡 WEBHOOK MERCADO LIBRE"
            );

            console.log(
                "Fecha:",
                new Date().toISOString()
            );

            console.log(
                "Body:",
                req.body
            );


            return res
                .sendStatus(
                    200
                );


        } catch (error) {

            console.error(
                "❌ Error webhook:",
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
// EXPORTAR
// ============================================================

module.exports =
    router;