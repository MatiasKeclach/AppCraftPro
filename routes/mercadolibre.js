// ============================================================
// routes/mercadolibre.js
// APPCRAFTPRO
//
// MERCADO LIBRE + MERCADO ENVÍOS FLEX
//
// VERSION CORREGIDA
//
// - OAuth Mercado Libre
// - Tokens SQLite
// - Webhook Flex
// - Scanner shipment
// - Preparado para logística
// ============================================================


const express = require("express");
const axios = require("axios");

const router = express.Router();

const isAuthenticated =
    require("../middleware/authMiddleware");

const db =
    require("../models/db");


// ============================================================
// CONFIGURACION MERCADO LIBRE
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


}
catch(error){


    console.error(
        "❌ Error creando tabla ML:",
        error
    );


}



// ============================================================
// CACHE TEMPORAL PAQUETES
//
// Después se conecta con logistica_paquetes
// ============================================================


const paquetesFlexEscaneados = [];




// ============================================================
// GUARDAR TOKEN
// ============================================================


function guardarTokenUsuario(
    userId,
    accessToken,
    refreshToken
){


    try{


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

                access_token = excluded.access_token,

                refresh_token = excluded.refresh_token,

                updated_at =
                    CURRENT_TIMESTAMP


        `)
        .run(
            String(userId),
            accessToken,
            refreshToken
        );



        console.log(
            "🔐 Token ML guardado:",
            userId
        );


    }
    catch(error){


        console.error(
            "❌ Error guardando token:",
            error
        );


    }


}



// ============================================================
// OBTENER TOKEN POR USER ID
// ============================================================


function obtenerTokenPorUsuario(
    userId
){


    try{


        const row =
            db.prepare(`

                SELECT access_token

                FROM mercadolibre_tokens

                WHERE user_id = ?

            `)
            .get(
                String(userId)
            );



        if(!row){

            return null;

        }



        return row.access_token;



    }
    catch(error){


        console.error(
            "❌ Error buscando token:",
            error
        );


        return null;


    }


}




// ============================================================
// TOKEN SESION
// ============================================================


function obtenerAccessToken(req){


    if(
        req.session &&
        req.session.mercadolibreAccessToken
    ){

        return req.session.mercadolibreAccessToken;

    }


    return null;


}




// ============================================================
// VALIDAR VARIABLES
// ============================================================


function validarConfiguracion(){


    const faltantes = [];



    if(!MERCADOLIBRE_CLIENT_ID){

        faltantes.push(
            "MERCADOLIBRE_CLIENT_ID"
        );

    }



    if(!MERCADOLIBRE_CLIENT_SECRET){

        faltantes.push(
            "MERCADOLIBRE_CLIENT_SECRET"
        );

    }



    if(!MERCADOLIBRE_REDIRECT_URI){

        faltantes.push(
            "MERCADOLIBRE_REDIRECT_URI"
        );

    }



    return faltantes;


}




// ============================================================
// PETICION GET MERCADO LIBRE
// ============================================================


async function mlGet(
    url,
    accessToken,
    params={}
){


    return axios.get(
        url,
        {

            params,

            headers:{

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
){


    if(
        !resource ||
        typeof resource !== "string"
    ){

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
// EXTRAER SITE
// ============================================================


function extraerSiteId(
    resource
){


    if(
        !resource ||
        typeof resource !== "string"
    ){

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
){


    if(!shipment){

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

        shipment.logistic_type === "self_service"

    );


}

// ============================================================
// TRANSFORMAR SHIPMENT
// ============================================================

function transformarShipment(
    shipment,
    order = null,
    assignment = null
){

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
            shipment.tracking_number || "",



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

            receiver.receiver_phone || "",



        estado:

            shipment.status ||
            "unknown",



        logistic_type:

            shipment.logistic_type || "",



        es_flex:

            detectarFlex(
                shipment
            ),



        driver_id:

            assignment?.driver_id ||
            null,



        fecha:

            shipment.date_created ||

            new Date()
            .toISOString(),



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
){

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
// ============================================================

router.get(
    "/",
    isAuthenticated,
    (req,res)=>{


        const faltantes =
            validarConfiguracion();



        res.render(
            "logistica/mercadolibre",
            {

                username:
                    req.session.user.username,


                role:
                    req.session.user.role,


                mercadolibreConnected:

                    !!req.session.mercadolibreAccessToken,


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

            }
        );


    }
);




// ============================================================
// CONECTAR MERCADO LIBRE
// ============================================================

router.get(
    "/conectar",
    isAuthenticated,
    (req,res)=>{


        const faltantes =
            validarConfiguracion();



        if(
            faltantes.length
        ){

            return res
            .status(500)
            .send(
                `Faltan variables:\n${faltantes.join("\n")}`
            );

        }



        const state =
            Date.now()
            +
            "_"
            +
            Math.random()
            .toString(36);



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



        res.redirect(
            url.toString()
        );


    }
);




// ============================================================
// CALLBACK OAUTH
// ============================================================

router.get(
    "/callback",
    async(req,res)=>{


        try{


            const {
                code
            } = req.query;



            if(!code){

                return res
                .status(400)
                .send(
                    "No llegó código OAuth"
                );

            }




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

                        code,

                        redirect_uri:
                            MERCADOLIBRE_REDIRECT_URI

                    })
                    .toString(),


                    {

                        headers:{

                            "Content-Type":
                            "application/x-www-form-urlencoded"

                        }

                    }

                );



            const data =
                response.data;



            guardarTokenUsuario(

                data.user_id,

                data.access_token,

                data.refresh_token

            );



            req.session.mercadolibreAccessToken =
                data.access_token;



            req.session.mercadolibreUserId =
                data.user_id;



            console.log(
                "✅ Mercado Libre conectado:",
                data.user_id
            );



            res.redirect(
                "/panel/logistica/mercadolibre"
            );



        }
        catch(error){


            console.error(

                "❌ ERROR CALLBACK ML",

                error.response?.data ||
                error.message

            );



            res
            .status(500)
            .send(
                "Error conectando Mercado Libre"
            );


        }


    }
);




// ============================================================
// ESTADO CONEXION
// ============================================================

router.get(
    "/estado",
    isAuthenticated,
    (req,res)=>{


        res.json({

            ok:true,


            conectado:

                !!req.session.mercadolibreAccessToken,


            user:

                req.session.mercadolibreUserId || null

        });


    }
);




// ============================================================
// SCANNER QR / BARCODE
// ============================================================

router.post(
    "/scan",
    isAuthenticated,
    async(req,res)=>{


        try{


            const {
                codigo
            } = req.body;



            if(!codigo){

                return res
                .status(400)
                .json({

                    ok:false,

                    error:
                    "Código vacío"

                });

            }



            const token =
                obtenerAccessToken(req);



            if(!token){

                return res
                .status(401)
                .json({

                    ok:false,

                    error:
                    "Mercado Libre no conectado"

                });

            }




            const response =
                await mlGet(

                    `https://api.mercadolibre.com/shipments/${codigo}`,

                    token

                );



            const paquete =
                transformarShipment(
                    response.data
                );



            if(
                !paqueteExiste(
                    paquete.shipment_id
                )
            ){

                paquetesFlexEscaneados.push(
                    paquete
                );

            }



            res.json({

                ok:true,

                paquete

            });



        }
        catch(error){


            console.error(

                "❌ ERROR SCANNER",

                error.response?.data ||
                error.message

            );



            res
            .status(500)
            .json({

                ok:false,

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

async function procesarFlexHandshake(data){

    const resource =
        data.resource;


    const userId =
        data.user_id;


    const shipmentId =
        extraerShipmentId(resource);


    const siteId =
        extraerSiteId(resource);



    console.log(
        "🚚 FLEX HANDSHAKE",
        {
            userId,
            shipmentId,
            siteId
        }
    );



    if(!shipmentId){

        return {

            ok:false,

            error:
            "No se encontró shipment_id"

        };

    }




    if(
        paqueteExiste(
            shipmentId
        )
    ){

        return {

            ok:true,

            duplicado:true

        };

    }




    // ========================================================
    // TOKEN DEL USUARIO
    // ========================================================

    const accessToken =
        obtenerTokenPorUsuario(
            userId
        );



    if(!accessToken){

        console.error(

            "❌ No existe token ML para:",

            userId

        );


        return {

            ok:false,

            error:
            "No existe token OAuth"

        };

    }




    let assignment =
        null;




    // ========================================================
    // OBTENER ASSIGNMENT FLEX
    // ========================================================

    try{


        const response =
            await mlGet(

                `https://api.mercadolibre.com/flex/sites/${siteId}/shipments/${shipmentId}/assignment/v2`,

                accessToken

            );



        assignment =
            response.data;


    }
    catch(error){


        console.log(

            "⚠️ No se obtuvo assignment",

            error.response?.data ||
            error.message

        );


    }





    // ========================================================
    // OBTENER SHIPMENT
    // ========================================================


    let shipment;



    try{


        const response =
            await mlGet(

                `https://api.mercadolibre.com/shipments/${shipmentId}`,

                accessToken

            );



        shipment =
            response.data;



    }
    catch(error){


        console.error(

            "❌ Error shipment",

            error.response?.data ||
            error.message

        );



        return {

            ok:false,

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




    paquetesFlexEscaneados.push(
        paquete
    );



    console.log(

        "✅ FLEX GUARDADO",

        paquete.shipment_id

    );



    return {

        ok:true,

        paquete

    };


}






// ============================================================
// WEBHOOK MERCADO LIBRE
//
// URL:
//
// POST
// /panel/logistica/mercadolibre/webhook
//
// IMPORTANTE:
// NO lleva login
// ============================================================


router.post(
    "/webhook",
    async(req,res)=>{


        try{


            const data =
                req.body || {};



            console.log(
                "================================"
            );


            console.log(
                "📡 WEBHOOK MERCADO LIBRE"
            );


            console.log(
                JSON.stringify(
                    data,
                    null,
                    2
                )
            );


            console.log(
                "================================"
            );



            // Respondemos rápido

            res.sendStatus(
                200
            );




            // Solo Flex

            if(
                data.topic !==
                "flex-handshakes"
            ){


                console.log(

                    "Webhook ignorado:",

                    data.topic

                );


                return;


            }




            await procesarFlexHandshake(
                data
            );



        }
        catch(error){


            console.error(

                "❌ ERROR WEBHOOK",

                error

            );



            if(!res.headersSent){

                res.sendStatus(
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
    (req,res)=>{


        res.json({

            ok:true,


            total:

                paquetesFlexEscaneados.length,


            paquetes:

                paquetesFlexEscaneados


        });


    }
);






// ============================================================
// TEST SHIPMENT
// ============================================================


router.get(
    "/test-flex/:id",
    isAuthenticated,
    async(req,res)=>{


        try{


            const token =
                obtenerAccessToken(req);



            if(!token){

                return res
                .status(401)
                .json({

                    ok:false,

                    error:
                    "Sin conexión Mercado Libre"

                });

            }



            const response =
                await mlGet(

                    `https://api.mercadolibre.com/shipments/${req.params.id}`,

                    token

                );



            res.json({

                ok:true,

                shipment:
                    response.data

            });



        }
        catch(error){


            res
            .status(500)
            .json({

                ok:false,

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