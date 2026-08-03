// ============================================================
// routes/mercadolibre.js
// MERCADO LIBRE + MERCADO ENVÍOS FLEX
// APPCRAFTPRO
//
// IMPORTANTE:
// Este archivo recibe notificaciones "flex-handshakes"
// cuando un paquete Flex es escaneado por primera vez.
//
// FLUJO:
//
// APP MERCADO ENVÍOS FLEX
//       ↓
// ESCANEO DEL PAQUETE
//       ↓
// MERCADO LIBRE
//       ↓
// flex-handshakes
//       ↓
// /webhook
//       ↓
// shipment_id
//       ↓
// /flex/sites/MLA/shipments/{id}/assignment/v2
//       ↓
// /shipments/{id}
//       ↓
// PAQUETE ESCANEADO EN APPCRAFTPRO
//
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
// CONFIGURACIÓN FLEX
// ============================================================

const MERCADOLIBRE_SITE_ID =
    process.env.MERCADOLIBRE_SITE_ID || "MLA";


// ============================================================
// ALMACÉN TEMPORAL DE PAQUETES ESCANEADOS
//
// IMPORTANTE:
//
// Esto es TEMPORAL para probar la integración.
//
// Cuando comprobemos que los webhooks llegan correctamente,
// lo conectamos a tu SQLite/Supabase.
//
// Mientras Render esté funcionando, los datos quedan en
// memoria. Si Render reinicia, se pierden.
//
// ============================================================

const paquetesFlexEscaneados = [];


// ============================================================
// EVITAR DUPLICADOS
// ============================================================

function paqueteYaExiste(
    shipmentId
) {

    return paquetesFlexEscaneados.some(

        paquete =>

            String(
                paquete.shipment_id
            ) === String(
                shipmentId
            )

    );

}


// ============================================================
// OBTENER ACCESS TOKEN DE SESIÓN
// ============================================================

function obtenerAccessToken(
    req
) {

    if (

        !req.session ||

        !req.session.mercadolibreAccessToken

    ) {

        return null;

    }


    return req.session.mercadolibreAccessToken;

}


// ============================================================
// VALIDAR CONFIGURACIÓN
// ============================================================

function validarConfiguracion() {

    const faltantes = [];


    if (
        !MERCADOLIBRE_CLIENT_ID
    ) {

        faltantes.push(
            "MERCADOLIBRE_CLIENT_ID"
        );

    }


    if (
        !MERCADOLIBRE_CLIENT_SECRET
    ) {

        faltantes.push(
            "MERCADOLIBRE_CLIENT_SECRET"
        );

    }


    if (
        !MERCADOLIBRE_REDIRECT_URI
    ) {

        faltantes.push(
            "MERCADOLIBRE_REDIRECT_URI"
        );

    }


    return faltantes;

}


// ============================================================
// PETICIÓN GET A MERCADO LIBRE
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
// OBTENER SHIPMENT ID DESDE RESOURCE
//
// Ejemplo:
//
// /flex/sites/MLA/shipments/407323124706/assignment/v1
//
// Devuelve:
//
// 407323124706
//
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


    if (

        !match ||

        !match[1]

    ) {

        return null;

    }


    return match[1];

}


// ============================================================
// EXTRAER SITE ID
//
// Ejemplo:
//
// /flex/sites/MLA/shipments/123/assignment/v1
//
// Devuelve:
//
// MLA
//
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


    if (

        !match ||

        !match[1]

    ) {

        return MERCADOLIBRE_SITE_ID;

    }


    return match[1];

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


    const logisticType =

        shipment.logistic_type || "";


    const shippingOption =

        shipment.shipping_option || {};


    const texto =

        [

            logisticType,

            shippingOption.name,

            shippingOption.type,

            shipment.mode

        ]

            .filter(Boolean)

            .join(" ")

            .toLowerCase();


    return (

        texto.includes("flex") ||

        logisticType === "self_service"

    );

}


// ============================================================
// TRANSFORMAR SHIPMENT
// ============================================================

function transformarShipment(

    shipment,

    order = null,

    assignment = null,

    webhookData = null

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

        "";


    const city =

        receiver.city ||

        receiver.city_name ||

        receiver.municipality ||

        receiver.neighborhood ||

        receiver.state ||

        "";


    let destinatario =

        receiver.receiver_name ||

        receiver.name ||

        receiver.receiver ||

        "";


    if (

        !destinatario &&

        buyer.first_name

    ) {

        destinatario =

            `${buyer.first_name} ${buyer.last_name || ""}`

                .trim();

    }


    if (

        !destinatario &&

        buyer.nickname

    ) {

        destinatario =

            buyer.nickname;

    }


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

                ? (
                    order.pack_id ||

                    null
                )

                : null,


        // --------------------------------------------
        // CÓDIGO
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

            destinatario,


        // --------------------------------------------
        // DIRECCIÓN
        // --------------------------------------------

        direccion:

            addressLine,


        localidad:

            city,


        // --------------------------------------------
        // TELÉFONO
        // --------------------------------------------

        telefono:

            receiver.receiver_phone ||

            receiver.phone ||

            (
                buyer.phone
                    ? (
                        buyer.phone.area_code || ""
                    ) +
                    (
                        buyer.phone.number || ""
                    )
                    : ""
            ) ||


            "",


        // --------------------------------------------
        // ESTADO
        // --------------------------------------------

        estado:

            shipment.status ||

            shipment.substatus ||

            "shipped",


        // --------------------------------------------
        // FLEX
        // --------------------------------------------

        logistic_type:

            logisticType,


        es_flex:

            detectarFlex(
                shipment
            ),


        // --------------------------------------------
        // DRIVER
        // --------------------------------------------

        driver_id:

            assignment &&

            assignment.driver_id

                ? assignment.driver_id

                : null,


        // --------------------------------------------
        // FECHA
        // --------------------------------------------

        fecha:

            shipment.date_created ||

            new Date()
                .toISOString(),


        // --------------------------------------------
        // ORIGEN
        // --------------------------------------------

        origen:

            "flex-handshakes",


        // --------------------------------------------
        // DATOS WEBHOOK
        // --------------------------------------------

        webhook:

            webhookData || null,


        // --------------------------------------------
        // DATOS ORIGINALES
        // --------------------------------------------

        raw:

            shipment,


        order_raw:

            order,


        assignment_raw:

            assignment

    };

}


// ============================================================
// PROCESAR FLEX HANDSHAKE
//
// Este es el corazón de la integración.
//
// Mercado Libre envía:
//
// {
//   topic: "flex-handshakes",
//   resource:
//     "/flex/sites/MLA/shipments/123/assignment/v1",
//   user_id: 123456
// }
//
// Nosotros:
//
// 1. Extraemos shipment_id
// 2. Buscamos access_token del usuario
// 3. Consultamos assignment/v2
// 4. Consultamos shipment
// 5. Guardamos paquete
//
// ============================================================

async function procesarFlexHandshake(

    webhookData

) {

    console.log(
        "=========================================="
    );


    console.log(
        "🚚 PROCESANDO FLEX HANDSHAKE"
    );


    console.log(
        "=========================================="
    );


    const resource =

        webhookData.resource;


    const userId =

        webhookData.user_id;


    const shipmentId =

        extraerShipmentId(
            resource
        );


    const siteId =

        extraerSiteId(
            resource
        );


    console.log(

        "📡 Resource:",

        resource

    );


    console.log(

        "👤 User ID:",

        userId

    );


    console.log(

        "📦 Shipment ID:",

        shipmentId

    );


    console.log(

        "🌎 Site:",

        siteId

    );


    if (
        !shipmentId
    ) {

        console.error(

            "❌ No se pudo extraer shipment_id."

        );


        return {

            ok:

                false,


            error:

                "No se pudo extraer shipment_id."

        };

    }


    // ========================================================
    // EVITAR DUPLICADOS
    // ========================================================

    if (

        paqueteYaExiste(
            shipmentId
        )

    ) {

        console.log(

            "ℹ️ El paquete ya estaba registrado:",

            shipmentId

        );


        return {

            ok:

                true,


            duplicado:

                true,


            shipment_id:

                shipmentId

        };

    }


    // ========================================================
    // BUSCAR ACCESS TOKEN
    //
    // IMPORTANTE:
    //
    // El webhook no tiene sesión de navegador.
    //
    // Por ahora buscamos tokens disponibles en una estructura
    // temporal.
    //
    // Para producción debemos guardar los tokens por user_id
    // en base de datos.
    //
    // ========================================================

    const accessToken =

        obtenerTokenPorUsuario(
            userId
        );


    if (
        !accessToken
    ) {

        console.error(

            "❌ NO HAY ACCESS TOKEN PARA EL USER ID:",

            userId

        );


        console.error(

            "⚠️ El webhook llegó correctamente,",

            "pero no podemos consultar shipment.",

            "Hay que guardar el OAuth token asociado al user_id."

        );


        // Guardamos el evento igualmente

        const paquetePendiente = {

            shipment_id:

                shipmentId,


            user_id:

                userId,


            site_id:

                siteId,


            resource:

                resource,


            estado:

                "webhook_recibido_sin_token",


            fecha:

                new Date()
                    .toISOString(),


            webhook:

                webhookData

        };


        paquetesFlexEscaneados.push(

            paquetePendiente

        );


        return {

            ok:

                false,


            pendiente:

                true,


            motivo:

                "Webhook recibido pero no hay access token guardado.",


            shipment_id:

                shipmentId

        };

    }


    // ========================================================
    // OBTENER ASSIGNMENT
    //
    // Primero intentamos v2.
    //
    // Si falla 404, probamos v1 porque el webhook puede
    // entregar un resource antiguo con assignment/v1.
    //
    // ========================================================

    let assignment = null;


    try {

        const assignmentResponse =

            await mlGet(

                `https://api.mercadolibre.com/flex/sites/${siteId}/shipments/${shipmentId}/assignment/v2`,

                accessToken

            );


        assignment =

            assignmentResponse.data;


        console.log(

            "🚚 Assignment obtenido:",

            JSON.stringify(

                assignment,

                null,

                2

            )

        );

    } catch (
        assignmentError
    ) {

        console.error(

            "⚠️ Error assignment/v2:",

            assignmentError.response

                ? assignmentError.response.data

                : assignmentError.message

        );


        try {

            const assignmentV1Response =

                await mlGet(

                    `https://api.mercadolibre.com/flex/sites/${siteId}/shipments/${shipmentId}/assignment/v1`,

                    accessToken

                );


            assignment =

                assignmentV1Response.data;


            console.log(

                "🚚 Assignment v1 obtenido:",

                JSON.stringify(

                    assignment,

                    null,

                    2

                )

            );

        } catch (
            assignmentV1Error
        ) {

            console.error(

                "⚠️ No se pudo obtener assignment v1/v2."

            );

        }

    }


    // ========================================================
    // OBTENER SHIPMENT
    // ========================================================

    let shipment = null;


    try {

        const shipmentResponse =

            await mlGet(

                `https://api.mercadolibre.com/shipments/${shipmentId}`,

                accessToken

            );


        shipment =

            shipmentResponse.data;


        console.log(

            "📦 Shipment obtenido correctamente."

        );

    } catch (
        shipmentError
    ) {

        console.error(

            "❌ Error obteniendo shipment:",

            shipmentError.response

                ? shipmentError.response.data

                : shipmentError.message

        );


        return {

            ok:

                false,


            error:

                "No se pudo obtener el shipment.",


            shipment_id:

                shipmentId

        };

    }


    // ========================================================
    // OBTENER ORDEN
    //
    // Intentamos obtener order_id desde shipment si existe.
    //
    // ========================================================

    let order = null;


    const orderId =

        shipment.order_id ||


        shipment.order_ids &&

        shipment.order_ids[0] ||


        null;


    if (
        orderId
    ) {

        try {

            const orderResponse =

                await mlGet(

                    `https://api.mercadolibre.com/orders/${orderId}`,

                    accessToken

                );


            order =

                orderResponse.data;

        } catch (
            orderError
        ) {

            console.error(

                "⚠️ No se pudo obtener la orden:",

                orderError.response

                    ? orderError.response.data

                    : orderError.message

            );

        }

    }


    // ========================================================
    // TRANSFORMAR
    // ========================================================

    const paquete =

        transformarShipment(

            shipment,

            order,

            assignment,

            webhookData

        );


    // ========================================================
    // GUARDAR
    // ========================================================

    paquetesFlexEscaneados.push(

        paquete

    );


    console.log(
        "=========================================="
    );


    console.log(

        "✅ PAQUETE FLEX ESCANEADO REGISTRADO"

    );


    console.log(

        "📦 Shipment:",

        paquete.shipment_id

    );


    console.log(

        "🔢 Tracking:",

        paquete.tracking_number

    );


    console.log(

        "👤 Destinatario:",

        paquete.destinatario

    );


    console.log(

        "📍 Dirección:",

        paquete.direccion

    );


    console.log(

        "🏙️ Localidad:",

        paquete.localidad

    );


    console.log(

        "🚚 Driver:",

        paquete.driver_id

    );


    console.log(
        "=========================================="
    );


    return {

        ok:

            true,


        paquete:

            paquete

    };

}


// ============================================================
// TOKENS TEMPORALES
//
// IMPORTANTE:
//
// Un webhook no tiene sesión de navegador.
//
// Guardamos el token OAuth asociado al user_id.
//
// ESTO FUNCIONA PARA LA PRUEBA MIENTRAS EL SERVIDOR
// ESTÉ ACTIVO.
//
// Después hay que llevar esto a la base de datos.
//
// ============================================================

const tokensMercadoLibre = new Map();


function guardarTokenUsuario(

    userId,

    accessToken,

    refreshToken = null

) {

    if (

        !userId ||

        !accessToken

    ) {

        return;

    }


    tokensMercadoLibre.set(

        String(userId),

        {

            accessToken:

                accessToken,


            refreshToken:

                refreshToken,


            actualizado:

                new Date()
                    .toISOString()

        }

    );


    console.log(

        "🔐 Token guardado para usuario ML:",

        userId

    );

}


function obtenerTokenPorUsuario(

    userId

) {

    if (
        !userId
    ) {

        return null;

    }


    const datos =

        tokensMercadoLibre.get(

            String(userId)

        );


    if (
        !datos
    ) {

        return null;

    }


    return datos.accessToken;

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

                        paquetesFlexEscaneados.length,


                    pendingShipments:

                        paquetesFlexEscaneados.length,


                    importedToday:

                        paquetesFlexEscaneados.length,


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

                "❌ Error dashboard ML:",

                error

            );


            return res

                .status(500)

                .send(

                    "Error cargando Mercado Libre."

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
                            Faltan:
                        </p>

                        <pre>
${faltantes.join("\n")}
                        </pre>

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

                "❌ Error OAuth:",

                error

            );


            return res

                .status(500)

                .send(

                    "Error iniciando conexión."

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

                    .send(

                        error_description ||

                        error

                    );

            }


            if (
                !code
            ) {

                return res

                    .status(400)

                    .send(

                        "No se recibió código OAuth."

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
                errorUser
            ) {

                console.error(

                    "⚠️ Error /users/me:",

                    errorUser.response

                        ? errorUser.response.data

                        : errorUser.message

                );

            }


            // =================================================
            // GUARDAR TOKEN PARA WEBHOOK
            // =================================================

            guardarTokenUsuario(

                mercadoLibreUserId,

                accessToken,

                refreshToken

            );


            // =================================================
            // GUARDAR SESIÓN
            // =================================================

            req.session.mercadolibreConnected =

                true;


            req.session.mercadolibreAccessToken =

                accessToken;


            req.session.mercadolibreRefreshToken =

                refreshToken;


            req.session.mercadolibreUserId =

                mercadoLibreUserId;


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

        } catch (
            error
        ) {

            console.error(

                "❌ ERROR CALLBACK:",

                error.response

                    ? error.response.data

                    : error.message

            );


            return res

                .status(500)

                .send(

                    "Error conectando Mercado Libre."

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

        } catch (
            error
        ) {

            return res

                .status(500)

                .json({

                    ok:

                        false

                });

        }

    }

);


// ============================================================
// VER PAQUETES ESCANEADOS
//
// ESTA ES LA RUTA QUE TIENE QUE CONSULTAR EL FRONT.
//
// ============================================================

router.get(

    "/paquetes-escaneados",

    isAuthenticated,

    (

        req,

        res

    ) => {

        try {

            return res.json({

                ok:

                    true,


                total:

                    paquetesFlexEscaneados.length,


                paquetes:

                    paquetesFlexEscaneados

            });

        } catch (
            error
        ) {

            console.error(

                "❌ Error paquetes escaneados:",

                error

            );


            return res

                .status(500)

                .json({

                    ok:

                        false,


                    mensaje:

                        "Error obteniendo paquetes escaneados."

                });

        }

    }

);


// ============================================================
// SINCRONIZAR
//
// AHORA CONSULTA LOS PAQUETES RECIBIDOS POR FLEX-HANDSHAKES.
//
// YA NO DEPENDE DE /orders/search PARA DETECTAR ESCANEOS.
//
// ============================================================

router.post(

    "/sincronizar",

    isAuthenticated,

    async (

        req,

        res

    ) => {

        try {

            return res.json({

                ok:

                    true,


                conectado:

                    !!obtenerAccessToken(
                        req
                    ),


                mensaje:

                    paquetesFlexEscaneados.length > 0

                        ? `Hay ${paquetesFlexEscaneados.length} paquetes Flex escaneados.`

                        : "Todavía no se recibió ningún paquete escaneado desde Mercado Envíos Flex.",


                totalShipments:

                    paquetesFlexEscaneados.length,


                totalFlex:

                    paquetesFlexEscaneados.length,


                pendingShipments:

                    paquetesFlexEscaneados.filter(

                        paquete =>

                            paquete.estado ===
                                "pending" ||

                            paquete.estado ===
                                "pendiente"

                    ).length,


                envios:

                    paquetesFlexEscaneados

            });

        } catch (
            error
        ) {

            console.error(

                "❌ Error sincronizando:",

                error

            );


            return res

                .status(500)

                .json({

                    ok:

                        false,


                    mensaje:

                        "Error sincronizando paquetes."

                });

        }

    }

);


// ============================================================
// DIAGNÓSTICO FLEX
//
// Permite probar manualmente un shipment.
//
// URL:
//
// GET
// /panel/logistica/mercadolibre/test-flex/SHIPMENT_ID
//
// ============================================================

router.get(

    "/test-flex/:shipmentId",

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

                            "No hay conexión OAuth."

                    });

            }


            const shipmentId =

                req.params.shipmentId;


            const shipmentResponse =

                await mlGet(

                    `https://api.mercadolibre.com/shipments/${shipmentId}`,

                    accessToken

                );


            let assignment =

                null;


            try {

                const assignmentResponse =

                    await mlGet(

                        `https://api.mercadolibre.com/flex/sites/${MERCADOLIBRE_SITE_ID}/shipments/${shipmentId}/assignment/v2`,

                        accessToken

                    );


                assignment =

                    assignmentResponse.data;

            } catch (
                assignmentError
            ) {

                console.error(

                    "Error assignment:",

                    assignmentError.response

                        ? assignmentError.response.data

                        : assignmentError.message

                );

            }


            return res.json({

                ok:

                    true,


                shipment:

                    shipmentResponse.data,


                assignment:

                    assignment

            });

        } catch (
            error
        ) {

            return res

                .status(

                    error.response

                        ? error.response.status

                        : 500

                )

                .json({

                    ok:

                        false,


                    mensaje:

                        "Error consultando shipment.",


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
// ESTA RUTA ES PÚBLICA.
//
// NO PUEDE TENER isAuthenticated.
//
// Mercado Libre debe poder acceder directamente.
//
// ============================================================

router.post(

    "/webhook",

    async (

        req,

        res

    ) => {

        try {

            const body =

                req.body || {};


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

                "📌 Topic:",

                body.topic

            );


            console.log(

                "🔗 Resource:",

                body.resource

            );


            console.log(

                "👤 User ID:",

                body.user_id

            );


            console.log(

                "📦 Body:",

                JSON.stringify(

                    body,

                    null,

                    2

                )

            );


            console.log(

                "=========================================="

            );


            // =================================================
            // RESPONDER RÁPIDO A MERCADO LIBRE
            // =================================================

            res.sendStatus(
                200
            );


            // =================================================
            // SOLO PROCESAR FLEX-HANDSHAKES
            // =================================================

            if (

                body.topic !==
                    "flex-handshakes"

            ) {

                console.log(

                    "ℹ️ Webhook ignorado. Topic:",

                    body.topic

                );


                return;

            }


            // =================================================
            // PROCESAR ASÍNCRONAMENTE
            // =================================================

            try {

                const resultado =

                    await procesarFlexHandshake(

                        body

                    );


                console.log(

                    "📊 Resultado procesamiento:",

                    JSON.stringify(

                        resultado,

                        null,

                        2

                    )

                );

            } catch (
                processingError
            ) {

                console.error(

                    "❌ Error procesando Flex Handshake:",

                    processingError

                );

            }

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