const express = require("express");
const router = express.Router();

const db = require("../models/db");
const isAuthenticated = require("../middleware/authMiddleware");

const QRCode = require("qrcode");
const path = require("path");
const fs = require("fs");



// ==============================
// DASHBOARD LOGÍSTICA
// ==============================

router.get("/", isAuthenticated, (req, res) => {

    res.render("logistica/dashboard", {

        username: req.session.user.username,

        role: req.session.user.role

    });

});





// ==============================
// LISTADO DE CLIENTES
// ==============================

router.get("/clientes", isAuthenticated, (req, res) => {


    try {


        const clientes = db.prepare(
            `
            SELECT *
            FROM logistica_clientes
            ORDER BY id DESC
            `
        ).all();



        res.render("logistica/clientes", {

            username: req.session.user.username,

            clientes

        });



    } catch(error){


        console.error("Error cargando clientes:", error);


        res.status(500)
        .send("Error cargando clientes");


    }


});





// ==============================
// CREAR CLIENTE
// ==============================

router.post("/clientes", isAuthenticated, (req,res)=>{


    try {


        const {

            nombre,

            empresa,

            telefono,

            email,

            direccion


        } = req.body;



        db.prepare(
            `
            INSERT INTO logistica_clientes
            (
                nombre,
                empresa,
                telefono,
                email,
                direccion
            )

            VALUES (?, ?, ?, ?, ?)

            `
        ).run(

            nombre,

            empresa,

            telefono,

            email,

            direccion

        );



        res.redirect(
            "/panel/logistica/clientes"
        );



    } catch(error){


        console.error(
            "Error creando cliente:",
            error
        );


        res.status(500)
        .send("Error creando cliente");


    }


});






// ==============================
// FORMULARIO EDITAR CLIENTE
// ==============================

router.get("/clientes/editar/:id", isAuthenticated, (req,res)=>{


    try {


        const cliente = db.prepare(
            `
            SELECT *
            FROM logistica_clientes
            WHERE id = ?
            `
        )
        .get(req.params.id);



        if(!cliente){

            return res
            .status(404)
            .send("Cliente no encontrado");

        }



        res.render(
            "logistica/editarCliente",
            {

                username:req.session.user.username,

                cliente

            }
        );



    } catch(error){


        console.error(error);

        res.status(500)
        .send("Error buscando cliente");


    }


});







// ==============================
// ACTUALIZAR CLIENTE
// ==============================

router.post("/clientes/editar/:id", isAuthenticated,(req,res)=>{


    try {


        const {

            nombre,

            empresa,

            telefono,

            email,

            direccion


        } = req.body;



        db.prepare(
            `
            UPDATE logistica_clientes

            SET

            nombre = ?,

            empresa = ?,

            telefono = ?,

            email = ?,

            direccion = ?,

            updated_at = CURRENT_TIMESTAMP


            WHERE id = ?

            `
        )
        .run(

            nombre,

            empresa,

            telefono,

            email,

            direccion,

            req.params.id

        );



        res.redirect(
            "/panel/logistica/clientes"
        );



    } catch(error){


        console.error(
            "Error actualizando cliente:",
            error
        );


        res.status(500)
        .send("Error actualizando cliente");


    }


});







// ==============================
// ELIMINAR CLIENTE
// ==============================

router.get("/clientes/eliminar/:id", isAuthenticated,(req,res)=>{


    try {


        db.prepare(
            `
            DELETE FROM logistica_clientes

            WHERE id = ?

            `
        )
        .run(req.params.id);



        res.redirect(
            "/panel/logistica/clientes"
        );



    } catch(error){


        console.error(
            "Error eliminando cliente:",
            error
        );


        res.status(500)
        .send("Error eliminando cliente");


    }


});



// ==============================
// COLECTAS DE PAQUETES
// ==============================


// LISTADO DE COLECTAS

router.get("/colectas", isAuthenticated, (req,res)=>{


    try {


        const colectas = db.prepare(`

            SELECT

                logistica_colectas.*,

                logistica_clientes.nombre AS cliente_nombre

            FROM logistica_colectas

            INNER JOIN logistica_clientes

            ON logistica_colectas.cliente_id = logistica_clientes.id

            ORDER BY logistica_colectas.id DESC


        `).all();




        const clientes = db.prepare(`

            SELECT *

            FROM logistica_clientes

            ORDER BY nombre ASC

        `).all();





        res.render("logistica/colectas",{


            username:req.session.user.username,

            role:req.session.user.role,

            colectas,

            clientes


        });




    } catch(error){


        console.error(
            "Error cargando colectas:",
            error
        );


        res.status(500)
        .send("Error cargando colectas");


    }


});







// CREAR COLECTA


router.post("/colectas", isAuthenticated,(req,res)=>{


    try {


        const {


            cliente_id,

            chofer,

            cantidad_paquetes,

            observaciones


        } = req.body;





        db.prepare(`

            INSERT INTO logistica_colectas

            (

                cliente_id,

                chofer,

                cantidad_paquetes,

                observaciones

            )


            VALUES (?,?,?,?)


        `).run(


            cliente_id,

            chofer,

            cantidad_paquetes,

            observaciones


        );




        res.redirect(
            "/panel/logistica/colectas"
        );




    } catch(error){


        console.error(
            "Error creando colecta:",
            error
        );


        res.status(500)
        .send("Error creando colecta");


    }


});

module.exports = router;

// ==============================
// CHOFERES
// ==============================

// LISTADO DE CHOFERES

router.get("/choferes", isAuthenticated, (req,res)=>{

    try {

        const choferes = db.prepare(`

            SELECT *

            FROM logistica_choferes

            ORDER BY id DESC

        `).all();



        res.render("logistica/choferes",{

            username:req.session.user.username,

            choferes

        });



    } catch(error){

        console.error(
            "Error cargando choferes:",
            error
        );

        res.status(500)
        .send("Error cargando choferes");

    }


});





// CREAR CHOFER


router.post("/choferes", isAuthenticated,(req,res)=>{


    try {


        const {

            nombre,
            telefono,
            vehiculo,
            patente,
            estado

        } = req.body;



        db.prepare(`

            INSERT INTO logistica_choferes

            (

                nombre,
                telefono,
                vehiculo,
                patente,
                estado

            )


            VALUES (?,?,?,?,?)


        `).run(

            nombre,
            telefono,
            vehiculo,
            patente,
            estado || "activo"

        );



        res.redirect(
            "/panel/logistica/choferes"
        );



    } catch(error){


        console.error(
            "Error creando chofer:",
            error
        );


        res.status(500)
        .send("Error creando chofer");


    }


});






// FORMULARIO EDITAR CHOFER


router.get("/choferes/editar/:id", isAuthenticated,(req,res)=>{


    try {


        const chofer = db.prepare(`

            SELECT *

            FROM logistica_choferes

            WHERE id = ?

        `)
        .get(req.params.id);



        if(!chofer){

            return res
            .status(404)
            .send("Chofer no encontrado");

        }



        res.render(
            "logistica/editarChofer",
            {

                username:req.session.user.username,

                chofer

            }
        );



    } catch(error){


        console.error(error);


        res.status(500)
        .send("Error buscando chofer");


    }


});







// ACTUALIZAR CHOFER


router.post("/choferes/editar/:id", isAuthenticated,(req,res)=>{


    try {


        const {

            nombre,
            telefono,
            vehiculo,
            patente,
            estado

        } = req.body;



        db.prepare(`

            UPDATE logistica_choferes

            SET

                nombre=?,
                telefono=?,
                vehiculo=?,
                patente=?,
                estado=?


            WHERE id=?


        `)
        .run(

            nombre,
            telefono,
            vehiculo,
            patente,
            estado,
            req.params.id

        );



        res.redirect(
            "/panel/logistica/choferes"
        );



    } catch(error){


        console.error(error);


        res.status(500)
        .send("Error actualizando chofer");


    }


});







// ELIMINAR CHOFER


router.get("/choferes/eliminar/:id", isAuthenticated,(req,res)=>{


    try {


        db.prepare(`

            DELETE FROM logistica_choferes

            WHERE id=?

        `)
        .run(req.params.id);



        res.redirect(
            "/panel/logistica/choferes"
        );



    } catch(error){


        console.error(error);


        res.status(500)
        .send("Error eliminando chofer");


    }


});

// ==============================
// PAQUETES
// ==============================


// LISTADO DE PAQUETES

router.get("/paquetes", isAuthenticated, (req,res)=>{

    try {


        const paquetes = db.prepare(`

            SELECT 

            logistica_paquetes.*,

            logistica_clientes.nombre AS cliente_nombre

            FROM logistica_paquetes

            INNER JOIN logistica_clientes

            ON logistica_paquetes.cliente_id = logistica_clientes.id

            ORDER BY logistica_paquetes.id DESC


        `).all();



        const clientes = db.prepare(`

            SELECT *

            FROM logistica_clientes

            WHERE estado='activo'

            ORDER BY nombre ASC

        `).all();



        res.render("logistica/paquetes",{


            username:req.session.user.username,

            role:req.session.user.role,

            paquetes,

            clientes


        });



    } catch(error){


        console.error(
            "Error cargando paquetes:",
            error
        );


        res.status(500)
        .send("Error cargando paquetes");


    }


});







// CREAR PAQUETE


router.post("/paquetes", isAuthenticated, async(req,res)=>{


try{


const {

cliente_id,

tipo,

codigo_externo,

descripcion


}=req.body;




// generar código interno

const ultimo = db.prepare(`

SELECT id

FROM logistica_paquetes

ORDER BY id DESC

LIMIT 1

`).get();



let numero = 1;


if(ultimo){

numero = ultimo.id + 1;

}



const codigoInterno =
"PKG-" +
String(numero).padStart(6,"0");




// generar QR

const qrNombre =
codigoInterno + ".png";


const carpetaQR = path.join(
    __dirname,
    "../public/uploads/qr"
);

if (!fs.existsSync(carpetaQR)) {
    fs.mkdirSync(carpetaQR, { recursive: true });
}

const rutaQR = path.join(
    carpetaQR,
    qrNombre
);


await QRCode.toFile(

rutaQR,

codigoInterno

);





// guardar paquete


db.prepare(`

INSERT INTO logistica_paquetes

(

cliente_id,

tipo,

codigo_externo,

codigo_interno,

qr_codigo,

descripcion,

colectado_por

)


VALUES (?,?,?,?,?,?,?)


`).run(


cliente_id,

tipo,

codigo_externo,

codigoInterno,

"/uploads/qr/"+qrNombre,

descripcion,

req.session.user.username


);




res.redirect(
"/panel/logistica/paquetes"
);



}catch(error){


console.error(
"Error creando paquete:",
error
);


res.status(500)
.send("Error creando paquete");


}



});

module.exports = router;