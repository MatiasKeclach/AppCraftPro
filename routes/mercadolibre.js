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
// FUNCIÓN AUXILIAR
// OBTENER TOKEN DE SESIÓN
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
// FUNCIÓN AUXILIAR
// BUSCAR TEXTO EN TODO EL OBJETO
//
// Sirve para detectar:
// 47586
// 507425
// Ciudad de La Paz
// 3505
//
// aunque Mercado Libre lo devuelva en otro campo.
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
                    String(texto).toLowerCase()
                )
        );

    } catch (error) {

        return false;

    }

}


// ============================================================
// FUNCIÓN AUXILIAR
// DETECTAR SI ES FLEX
// ============================================================

function detectarFlex(
    shipment
) {

    if (!shipment) {

        return false;

    }


    const valores = [

        shipment.logistic_type,

        shipment.shipping_method,

        shipment.shipping_option &&
        shipment.shipping_option.name,

        shipment.shipping_option &&
        shipment.shipping_option.type,

        shipment.mode,

        shipment.status,

        shipment.substatus

    ];


    const texto =
        valores
            .filter(Boolean)
            .join(" ")
            .toLowerCase();


    return (

        texto.includes("flex") ||

        shipment.logistic_type ===
            "self_service" ||

        shipment.logistic_type ===
            "cross_docking"

    );

}


// ============================================================
// FUNCIÓN AUXILIAR
// CONVERTIR SHIPMENT EN FORMATO DE APPCRAFTPRO
// ============================================================

function transformarShipment(
    shipment,
    order = null
) {

    const receiver =
        shipment &&
        shipment.receiver_address
            ? shipment.receiver_address
            : {};


    const shippingOption =
        shipment &&
        shipment.shipping_option
            ? shipment.shipping_option
            : {};


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

        "";


    const city =

        receiver.city ||

        receiver.city_name ||

        receiver.municipality ||

        receiver.state ||

        "";


    const receiverName =

        receiver.receiver_name ||

        receiver.name ||

        receiver.receiver ||

        (
            buyer.nickname ||
            ""
        );


    const trackingNumber =

        shipment.tracking_number ||

        shipment.tracking_id ||

        shipment.tracking ||

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

        // --------------------------------------------
        // IDENTIFICADORES
        // --------------------------------------------

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
                ? order.pack_id ||
                  null
                : null,

        // --------------------------------------------
        // CÓDIGOS
        // --------------------------------------------

        codigo:

            trackingNumber ||

            shipment.id ||

            "",

        tracking_number:
            trackingNumber,

        // --------------------------------------------
        // DESTINATARIO
        // --------------------------------------------

        destinatario:
            receiverName,

        // --------------------------------------------
        // DIRECCIÓN
        // --------------------------------------------

        direccion:
            addressLine,

        localidad:
            city,

        // --------------------------------------------
        // ESTADO
        // --------------------------------------------

        estado:

            shipment.status ||

            shipment.substatus ||

            (
                order
                    ? order.status
                    : "pendiente"
            ),

        // --------------------------------------------
        // LOGÍSTICA
        // --------------------------------------------

        logistic_type:
            logisticType,

        es_flex:
            esFlex,

        // --------------------------------------------
        // FECHA
        // --------------------------------------------

        fecha:

            shipment.date_created ||

            (
                order
                    ? order.date_created
                    : null
            ),

        // --------------------------------------------
        // INFORMACIÓN ORIGINAL
        // --------------------------------------------

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

                        <a
                            href="/panel/logistica/mercadolibre"
                        >
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

                        <a
                            href="/panel/logistica/mercadolibre"
                        >
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

                "=========================================="

            );


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

                .send(`

                    <h2>
                        Error conectando Mercado Libre
                    </h2>

                    <p>
                        ${error.message}
                    </p>

                    <a
                        href="/panel/logistica/mercadolibre"
                    >
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
// SINCRONIZAR
//
// ESTA RUTA BUSCA MÁS ÓRDENES QUE ANTES
// Y CONSULTA LOS SHIPMENTS UNO POR UNO.
//
// TAMBIÉN BUSCA:
// 47586
// 507425
// CIUDAD DE LA PAZ
// 3505
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


            console.log(
                "=========================================="
            );


            console.log(
                "🔎 INICIANDO BÚSQUEDA FLEX"
            );


            console.log(
                "👤 Usuario ML:",
                userId
            );


            console.log(
                "🔍 Buscando referencias:"
            );


            console.log(
                "47586 / 507425 / Ciudad de La Paz 3505"
            );


            console.log(
                "=========================================="
            );


            // ==================================================
            // BUSCAR MÁS ÓRDENES
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

                ordersResponse.data.results ||

                [];


            console.log(

                "📦 Órdenes recibidas:",

                orders.length

            );


            const envios = [];

            const encontrados = [];


            // ==================================================
            // PROCESAR CADA ORDEN
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


                console.log(

                    "------------------------------------------"

                );


                console.log(

                    "🧾 ORDER:",

                    order.id

                );


                console.log(

                    "🚚 SHIPMENT:",

                    shipmentId

                );


                if (
                    !shipmentId
                ) {

                    console.log(

                        "⚠️ Orden sin shipment"

                    );

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


                    const envio =

                        transformarShipment(

                            shipment,

                            order

                        );


                    envios.push(

                        envio

                    );


                    // ==================================================
                    // BUSCAR NUESTRO PAQUETE
                    // ==================================================

                    const coincide =

                        objetoContieneTexto(

                            shipment,

                            [

                                "47586",

                                "507425",

                                "ciudad de la paz",

                                "3505"

                            ]

                        ) ||

                        objetoContieneTexto(

                            order,

                            [

                                "47586",

                                "507425",

                                "ciudad de la paz",

                                "3505"

                            ]

                        );


                    if (
                        coincide
                    ) {

                        encontrados.push(

                            envio

                        );


                        console.log(

                            "🎯🎯🎯 PAQUETE POSIBLEMENTE ENCONTRADO"

                        );


                        console.log(

                            JSON.stringify(

                                envio,

                                null,

                                2

                            )

                        );

                    }


                    console.log(

                        "Shipment:",

                        shipment.id

                    );


                    console.log(

                        "Tracking:",

                        shipment.tracking_number

                    );


                    console.log(

                        "Logistic:",

                        shipment.logistic_type

                    );


                    console.log(

                        "Flex:",

                        envio.es_flex

                    );


                    console.log(

                        "Dirección:",

                        envio.direccion

                    );


                } catch (
                    shipmentError
                ) {

                    console.error(

                        "❌ Error consultando shipment:",

                        shipmentId

                    );


                    console.error(

                        shipmentError.response

                            ? shipmentError.response.data

                            : shipmentError.message

                    );

                }

            }


            // ==================================================
            // FLEX
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

                "🎯 COINCIDENCIAS:",

                encontrados.length

            );


            console.log(

                "=========================================="

            );


            // ==================================================
            // RESULTADO
            //
            // SI ENCONTRAMOS COINCIDENCIA:
            // MOSTRAMOS ESA.
            //
            // SI NO:
            // MOSTRAMOS FLEX.
            //
            // SI NO HAY FLEX:
            // MOSTRAMOS TODOS.
            // ==================================================

            let resultadoFinal = [];


            if (
                encontrados.length > 0
            ) {

                resultadoFinal =

                    encontrados;

            } else if (
                enviosFlex.length > 0
            ) {

                resultadoFinal =

                    enviosFlex;

            } else {

                resultadoFinal =

                    envios;

            }


            return res.json({

                ok:
                    true,

                conectado:
                    true,

                mensaje:

                    encontrados.length > 0

                        ? `🎯 Se encontró una posible coincidencia con el paquete buscado.`

                        : resultadoFinal.length > 0

                            ? `Se encontraron ${resultadoFinal.length} envíos.`
                            
                            : "No se encontraron envíos en las órdenes consultadas.",

                totalShipments:

                    resultadoFinal.length,

                totalOrdenesConsultadas:

                    orders.length,

                totalEnviosConsultados:

                    envios.length,

                totalFlex:

                    enviosFlex.length,

                coincidencias:

                    encontrados.length,

                pendingShipments:

                    resultadoFinal.filter(

                        envio =>

                            envio.estado ===
                                "pending" ||

                            envio.estado ===
                                "pendiente"

                    ).length,

                importedToday:
                    0,

                envios:

                    resultadoFinal,

                coincidenciasDetalle:

                    encontrados

            });


        } catch (error) {

            console.error(

                "❌ ERROR SINCRONIZANDO FLEX:",

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
// DIAGNÓSTICO
//
// URL:
//
// GET
// /panel/logistica/mercadolibre/diagnostico
//
// ESTA RUTA NO LA USA EL FRONT.
// LA USAMOS PARA VER QUÉ DEVUELVE MERCADO LIBRE.
//
// BUSCA DIRECTAMENTE:
// 47586
// 507425
// CIUDAD DE LA PAZ
// 3505
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

                "🧪 DIAGNÓSTICO MERCADO LIBRE"

            );


            console.log(

                "Usuario:",

                userId

            );


            console.log(

                "=========================================="

            );


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

                ordersResponse.data.results ||

                [];


            const resultados = [];


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


                    const coincide =

                        objetoContieneTexto(

                            shipment,

                            [

                                "47586",

                                "507425",

                                "ciudad de la paz",

                                "3505"

                            ]

                        ) ||

                        objetoContieneTexto(

                            order,

                            [

                                "47586",

                                "507425",

                                "ciudad de la paz",

                                "3505"

                            ]

                        );


                    if (
                        coincide
                    ) {

                        resultados.push({

                            order_id:

                                order.id,

                            shipment_id:

                                shipment.id,

                            tracking_number:

                                shipment.tracking_number ||

                                null,

                            logistic_type:

                                shipment.logistic_type ||

                                null,

                            status:

                                shipment.status ||

                                null,

                            receiver_address:

                                shipment.receiver_address ||

                                null,

                            shipment:

                                shipment,

                            order:

                                order

                        });

                    }

                } catch (
                    error
                ) {

                    console.error(

                        "Error diagnóstico shipment:",

                        shipmentId,

                        error.message

                    );

                }

            }


            return res.json({

                ok:
                    true,

                usuarioMercadoLibre:

                    userId,

                ordenesConsultadas:

                    orders.length,

                coincidencias:

                    resultados.length,

                resultados:

                    resultados

            });


        } catch (error) {

            console.error(

                "❌ Error diagnóstico:",

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
// ============================================================

router.post(
    "/webhook",
    async (
        req,
        res
    ) => {

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


            return res.sendStatus(
                200
            );


        } catch (error) {

            console.error(

                "❌ Error webhook:",

                error

            );


            return res.sendStatus(
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