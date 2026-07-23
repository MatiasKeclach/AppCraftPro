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
// OBTENER ACCESS TOKEN
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
// FUNCIÓN PARA HACER PETICIONES A MERCADO LIBRE
// ============================================================

async function mlGet(
    url,
    accessToken,
    params = {}
) {

    return await axios.get(
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
// BUSCAR TEXTO EN OBJETO COMPLETO
// ============================================================

function objetoContieneTexto(
    objeto,
    textos
) {

    try {

        const textoCompleto =
            JSON.stringify(
                objeto
            ).toLowerCase();


        return textos.some(
            texto =>

                textoCompleto.includes(
                    String(texto)
                        .toLowerCase()
                )

        );

    } catch (
        error
    ) {

        return false;

    }

}


// ============================================================
// DETECTAR FLEX
// ============================================================

function detectarFlex(
    shipment
) {

    if (
        !shipment
    ) {

        return false;

    }


    const valores = [

        shipment.logistic_type,

        shipment.shipping_method,

        shipment.mode,

        shipment.status,

        shipment.substatus,

        shipment.shipping_option &&
        shipment.shipping_option.name,

        shipment.shipping_option &&
        shipment.shipping_option.type

    ];


    const texto =

        valores
            .filter(Boolean)
            .join(" ")
            .toLowerCase();


    return (

        texto.includes("flex") ||

        shipment.logistic_type ===
            "self_service"

    );

}


// ============================================================
// TRANSFORMAR SHIPMENT
// ============================================================

function transformarShipment(
    shipment,
    order = null
) {

    shipment =
        shipment || {};


    const receiver =

        shipment.receiver_address ||

        {};


    const shippingOption =

        shipment.shipping_option ||

        {};


    const buyer =

        order &&
        order.buyer

            ? order.buyer

            : {};


    const addressLine =

        receiver.address_line ||

        receiver.address ||

        receiver.street_name ||

        receiver.street_address ||

        (
            receiver.street_name
                ? `${receiver.street_name} ${receiver.street_number || ""}`
                : ""
        ) ||

        "";


    const city =

        receiver.city ||

        receiver.city_name ||

        receiver.municipality ||

        receiver.neighborhood ||

        receiver.state ||

        "";


    const receiverName =

        receiver.receiver_name ||

        receiver.name ||

        receiver.receiver ||

        (
            buyer.first_name
                ? `${buyer.first_name} ${buyer.last_name || ""}`
                : ""
        ) ||

        buyer.nickname ||

        "";


    const trackingNumber =

        shipment.tracking_number ||

        shipment.tracking_id ||

        shipment.tracking ||

        shipment.id ||

        "";


    const logisticType =

        shipment.logistic_type ||

        shippingOption.name ||

        shippingOption.type ||

        "";


    const esFlex =

        detectarFlex(
            shipment
        );


    return {

        id:

            shipment.id ||

            null,


        shipment_id:

            shipment.id ||

            null,


        order_id:

            order

                ? order.id

                : null,


        pack_id:

            order

                ? (
                    order.pack_id ||
                    null
                )

                : null,


        codigo:

            trackingNumber ||


            shipment.id ||


            "",


        tracking_number:

            trackingNumber,


        destinatario:

            receiverName,


        direccion:

            addressLine,


        localidad:

            city,


        telefono:

            receiver.receiver_phone ||

            receiver.phone ||

            (
                order &&
                order.buyer &&
                order.buyer.phone
                    ? (
                        order.buyer.phone.area_code || ""
                    ) +
                    (
                        order.buyer.phone.number || ""
                    )
                    : ""
            ) ||


            "",


        estado:

            shipment.status ||

            shipment.substatus ||

            (
                order
                    ? order.status
                    : "pendiente"
            ),


        logistic_type:

            logisticType,


        es_flex:

            esFlex,


        fecha:

            shipment.date_created ||

            (
                order
                    ? order.date_created
                    : null
            ),


        origen:

            "mercadolibre",


        raw:

            shipment,


        order_raw:

            order

    };

}


// ============================================================
// DASHBOARD
// ============================================================

router.get(
    "/",
    isAuthenticated,
    async (
        req,
        res
    ) => {

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

                        !!(
                            req.session &&
                            req.session.mercadolibreAccessToken
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

                        faltantes.length === 0,


                    configurationErrors:

                        faltantes

                }

            );

        } catch (
            error
        ) {

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
    (
        req,
        res
    ) => {

        try {

            const faltantes =

                validarConfiguracion();


            if (
                faltantes.length > 0
            ) {

                return res

                    .status(500)

                    .send(`

                        <h2>
                            Configuración incompleta
                        </h2>

                        <p>
                            Faltan las siguientes variables:
                        </p>

                        <pre>
${faltantes.join("\n")}
                        </pre>

                        <a href="/panel/logistica/mercadolibre">
                            Volver
                        </a>

                    `);

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

        } catch (
            error
        ) {

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
// ============================================================

router.get(
    "/callback",
    async (
        req,
        res
    ) => {

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


            console.log(

                "🔄 Intercambiando código por token..."

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

                    await mlGet(

                        "https://api.mercadolibre.com/users/me",

                        accessToken

                    );


                mercadoLibreUser =

                    userResponse.data;


            } catch (
                userError
            ) {

                console.error(

                    "⚠️ Error obteniendo usuario ML:",

                    userError.response

                        ? userError.response.data

                        : userError.message

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


            console.log(

                "=========================================="

            );


            console.log(

                "✅ MERCADO LIBRE CONECTADO"

            );


            console.log(

                "👤 USER ID:",

                mercadoLibreUserId

            );


            console.log(

                "👤 NICKNAME:",

                mercadoLibreUser
                    ? mercadoLibreUser.nickname
                    : "N/A"

            );


            console.log(

                "=========================================="

            );


            return res.redirect(

                "/panel/logistica/mercadolibre?connected=1"

            );

        } catch (
            error
        ) {

            console.error(

                "❌ ERROR CALLBACK ML:",

                error.response

                    ? error.response.data

                    : error.message

            );


            return res

                .status(500)

                .send(`

                    <h2>
                        Error conectando Mercado Libre
                    </h2>

                    <p>
                        ${error.message}
                    </p>

                    <a href="/panel/logistica/mercadolibre">
                        Volver
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
    async (
        req,
        res
    ) => {

        try {

            const accessToken =

                obtenerAccessToken(
                    req
                );


            const cuenta =

                req.session

                    ? req.session.mercadolibreAccount

                    : null;


            return res.json({

                ok:

                    true,


                conectado:

                    !!accessToken,


                usuarioMercadoLibre:

                    req.session

                        ? req.session.mercadolibreUserId

                        : null,


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

        } catch (
            error
        ) {

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
// SINCRONIZAR
// ============================================================

router.post(
    "/sincronizar",
    isAuthenticated,
    async (
        req,
        res
    ) => {

        try {

            const accessToken =

                obtenerAccessToken(
                    req
                );


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


            const userId =

                req.session.mercadolibreUserId;


            if (
                !userId
            ) {

                return res

                    .status(400)

                    .json({

                        ok:

                            false,


                        mensaje:

                            "No se encontró el ID de usuario de Mercado Libre."

                    });

            }


            console.log(
                "=========================================="
            );


            console.log(
                "🔎 INICIANDO SINCRONIZACIÓN"
            );


            console.log(
                "👤 Usuario ML:",
                userId
            );


            console.log(
                "=========================================="
            );


            // ==================================================
            // OBTENER ÓRDENES
            // ==================================================

            const ordersResponse =

                await mlGet(

                    "https://api.mercadolibre.com/orders/search",

                    accessToken,

                    {

                        seller:

                            userId,


                        sort:

                            "date_desc",


                        limit:

                            50

                    }

                );


            const orders =

                ordersResponse.data.results || [];


            console.log(

                "📦 Órdenes recibidas:",

                orders.length

            );


            const envios = [];


            const errores = [];


            // ==================================================
            // PROCESAR ÓRDENES
            // ==================================================

            for (
                const order of orders
            ) {

                if (
                    !order
                ) {

                    continue;

                }


                const shipmentId =

                    order.shipping &&

                    order.shipping.id;


                if (
                    !shipmentId
                ) {

                    continue;

                }


                console.log(

                    "🔎 Consultando shipment:",

                    shipmentId

                );


                try {

                    const shipmentResponse =

                        await mlGet(

                            `https://api.mercadolibre.com/shipments/${shipmentId}`,

                            accessToken

                        );


                    const shipment =

                        shipmentResponse.data;


                    const envio =

                        transformarShipment(

                            shipment,

                            order

                        );


                    envios.push(

                        envio

                    );


                    console.log(

                        "📦 Shipment:",

                        shipment.id

                    );


                    console.log(

                        "🚚 Logistic:",

                        shipment.logistic_type

                    );


                    console.log(

                        "📍 Dirección:",

                        envio.direccion

                    );


                    console.log(

                        "👤 Destinatario:",

                        envio.destinatario

                    );


                } catch (
                    shipmentError
                ) {

                    const detalle =

                        shipmentError.response

                            ? shipmentError.response.data

                            : shipmentError.message;


                    errores.push({

                        shipment_id:

                            shipmentId,


                        error:

                            detalle

                    });


                    console.error(

                        "❌ Error consultando shipment:",

                        shipmentId,

                        detalle

                    );

                }

            }


            // ==================================================
            // FILTRAR FLEX
            // ==================================================

            const enviosFlex =

                envios.filter(

                    envio =>

                        envio.es_flex

                );


            console.log(

                "=========================================="
            );


            console.log(

                "📦 TOTAL ENVÍOS:",

                envios.length

            );


            console.log(

                "🚚 TOTAL FLEX:",

                enviosFlex.length

            );


            console.log(

                "❌ ERRORES:",

                errores.length

            );


            console.log(

                "=========================================="
            );


            // ==================================================
            // IMPORTANTE
            //
            // DEVOLVEMOS TODOS LOS ENVÍOS RECIBIDOS.
            //
            // NO FILTRAMOS POR "FLEX" PARA EVITAR QUE
            // DESAPAREZCAN ENVÍOS VÁLIDOS POR UNA
            // DETECCIÓN INCORRECTA DEL logistic_type.
            // ==================================================

            const resultadoFinal =

                envios;


            return res.json({

                ok:

                    true,


                conectado:

                    true,


                mensaje:

                    resultadoFinal.length > 0

                        ? `Se encontraron ${resultadoFinal.length} envíos.`

                        : "La API de Mercado Libre no devolvió envíos en las órdenes consultadas.",


                totalShipments:

                    resultadoFinal.length,


                totalOrdenesConsultadas:

                    orders.length,


                totalEnviosConsultados:

                    envios.length,


                totalFlex:

                    enviosFlex.length,


                errores:

                    errores.length,


                pendingShipments:

                    resultadoFinal.filter(

                        envio =>

                            envio.estado === "pending" ||

                            envio.estado === "pendiente"

                    ).length,


                importedToday:

                    0,


                envios:

                    resultadoFinal,


                erroresDetalle:

                    errores

            });

        } catch (
            error
        ) {

            console.error(

                "❌ ERROR SINCRONIZANDO:",

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
// DIAGNÓSTICO COMPLETO
//
// URL:
//
// /panel/logistica/mercadolibre/diagnostico
//
// ESTA RUTA DEVUELVE:
//
// - USUARIO ML
// - ÓRDENES
// - SHIPMENTS
// - TRACKING
// - LOGISTIC TYPE
// - DIRECCIÓN
// - DESTINATARIO
// - DATOS COMPLETOS
//
// IMPORTANTE:
// USAR DESPUÉS DE ESCANEAR UN PAQUETE.
// ============================================================

router.get(
    "/diagnostico",
    isAuthenticated,
    async (
        req,
        res
    ) => {

        try {

            const accessToken =

                obtenerAccessToken(
                    req
                );


            if (
                !accessToken
            ) {

                return res

                    .status(401)

                    .json({

                        ok:

                            false,


                        mensaje:

                            "Mercado Libre no está conectado."

                    });

            }


            const userId =

                req.session.mercadolibreUserId;


            console.log(

                "=========================================="

            );


            console.log(

                "🧪 DIAGNÓSTICO COMPLETO MERCADO LIBRE"

            );


            console.log(

                "👤 Usuario:",

                userId

            );


            console.log(

                "=========================================="

            );


            const ordersResponse =

                await mlGet(

                    "https://api.mercadolibre.com/orders/search",

                    accessToken,

                    {

                        seller:

                            userId,


                        sort:

                            "date_desc",


                        limit:

                            50

                    }

                );


            const orders =

                ordersResponse.data.results || [];


            const resultados = [];


            const errores = [];


            for (
                const order of orders
            ) {

                if (
                    !order
                ) {

                    continue;

                }


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

                        await mlGet(

                            `https://api.mercadolibre.com/shipments/${shipmentId}`,

                            accessToken

                        );


                    const shipment =

                        shipmentResponse.data;


                    const envio =

                        transformarShipment(

                            shipment,

                            order

                        );


                    resultados.push({

                        envio:

                            envio,


                        shipment:

                            shipment,


                        order:

                            order

                    });


                } catch (
                    error
                ) {

                    errores.push({

                        shipment_id:

                            shipmentId,


                        error:

                            error.response

                                ? error.response.data

                                : error.message

                    });

                }

            }


            return res.json({

                ok:

                    true,


                fechaConsulta:

                    new Date()
                        .toISOString(),


                usuarioMercadoLibre:

                    userId,


                ordenesConsultadas:

                    orders.length,


                shipmentsEncontrados:

                    resultados.length,


                errores:

                    errores.length,


                resultados:

                    resultados,


                erroresDetalle:

                    errores

            });

        } catch (
            error
        ) {

            console.error(

                "❌ ERROR DIAGNÓSTICO:",

                error.response

                    ? error.response.data

                    : error.message

            );


            return res

                .status(500)

                .json({

                    ok:

                        false,


                    mensaje:

                        "Error ejecutando diagnóstico.",


                    detalle:

                        error.response

                            ? error.response.data

                            : error.message

                });

        }

    }

);


// ============================================================
// WEBHOOK MERCADO LIBRE
//
// IMPORTANTE:
//
// Mercado Libre puede notificar eventos relacionados
// con recursos de la cuenta.
//
// Guardamos el evento recibido en consola y respondemos
// inmediatamente 200.
//
// Luego podemos usar el resource recibido para consultar
// la información actualizada.
// ============================================================

router.post(
    "/webhook",
    async (
        req,
        res
    ) => {

        try {

            console.log(

                "=========================================="

            );


            console.log(

                "📡 WEBHOOK MERCADO LIBRE RECIBIDO"

            );


            console.log(

                "📅 Fecha:",

                new Date().toISOString()

            );


            console.log(

                "📦 Body:",

                JSON.stringify(

                    req.body,

                    null,

                    2

                )

            );


            console.log(

                "=========================================="

            );


            // ==================================================
            // RESPONDER RÁPIDO A MERCADO LIBRE
            // ==================================================

            res.sendStatus(
                200
            );


            // ==================================================
            // DATOS DEL EVENTO
            // ==================================================

            const body =

                req.body || {};


            const resource =

                body.resource ||


                body._id ||


                null;


            const topic =

                body.topic ||


                null;


            const userId =

                body.user_id ||


                null;


            console.log(

                "🔔 Topic:",

                topic

            );


            console.log(

                "🔗 Resource:",

                resource

            );


            console.log(

                "👤 User ID:",

                userId

            );


            // ==================================================
            // NOTA:
            //
            // Acá posteriormente podemos consultar el resource
            // con el Access Token correspondiente al usuario.
            //
            // No se puede usar el Access Token de la sesión
            // porque el webhook es una petición independiente.
            // ==================================================

        } catch (
            error
        ) {

            console.error(

                "❌ ERROR WEBHOOK:",

                error

            );


            if (
                !res.headersSent
            ) {

                return res.sendStatus(
                    500
                );

            }

        }

    }

);


// ============================================================
// EXPORTAR ROUTER
// ============================================================

module.exports =

    router;