// ==================================================
// APPCRAFTPRO
// app.js
// Versión corregida
// ==================================================

const express = require("express");
const session = require("express-session");
const path = require("path");
const http = require("http");

const { Server } = require("socket.io");

const isAuthenticated = require("./middleware/authMiddleware");


// ==================================================
// BASE DE DATOS
// ==================================================

const db = require("./models/db");

require("./models/initDB");


// ==================================================
// APP
// ==================================================

const app = express();

const PORT =
    process.env.PORT || 3000;


// ==================================================
// MOTOR EJS
// ==================================================

app.set(
    "view engine",
    "ejs"
);

app.set(
    "views",
    path.join(__dirname, "views")
);


// ==================================================
// MIDDLEWARES
// ==================================================

app.use(
    express.urlencoded({
        extended: true
    })
);


app.use(
    express.json()
);


// ==================================================
// SESIONES
// ==================================================

app.use(
    session({

        secret:
            process.env.SESSION_SECRET ||
            "appcraft_secret_key",

        resave:
            false,

        saveUninitialized:
            false

    })
);


// ==================================================
// ARCHIVOS PUBLICOS
// ==================================================

app.use(
    express.static(
        path.join(
            __dirname,
            "public"
        )
    )
);


// ==================================================
// RUTAS
// ==================================================


// ------------------------------
// USUARIOS
// ------------------------------

const userRoutes =
    require("./routes/users");


app.use(
    "/panel/users",
    userRoutes
);



// ------------------------------
// AUTH
// ------------------------------

const authRoutes =
    require("./routes/auth");


app.use(
    "/auth",
    authRoutes
);



// ------------------------------
// LOGISTICA
// ------------------------------

const logisticaRoutes =
    require("./routes/logistica-fijo");


app.use(
    "/panel/logistica",
    logisticaRoutes
);



// ------------------------------
// MERCADO LIBRE
// ------------------------------

// ==================================================
// MERCADO LIBRE CON DETECCIÓN DE ERRORES
// ==================================================

try {

    console.log("🔄 Cargando módulo Mercado Libre...");

    const mercadoLibreRoutes =
        require("./routes/mercadolibre-anterior.js");


    app.use(
        "/panel/logistica/mercadolibre",
        mercadoLibreRoutes
    );


    console.log("✅ Mercado Libre cargado correctamente");


} catch(error) {

    console.error(
        "=========================================="
    );

    console.error(
        "❌ ERROR CARGANDO mercadolibre.js"
    );

    console.error(
        error.stack
    );

    console.error(
        "=========================================="
    );

}



// ==================================================
// PANEL PRINCIPAL
// ==================================================

app.get(
    "/panel",
    isAuthenticated,
    (req, res)=>{


        try {


            const fs =
                require("fs");


            const apps =
                db
                .prepare(
                    "SELECT * FROM apps"
                )
                .all();



            const usuarios =
                db
                .prepare(
                    "SELECT * FROM users"
                )
                .all();



            const totalPorRol = {

                superadmin:
                    usuarios.filter(
                        u =>
                        u.role === "superadmin"
                    ).length,


                admin:
                    usuarios.filter(
                        u =>
                        u.role === "admin"
                    ).length,


                usuario:
                    usuarios.filter(
                        u =>
                        u.role === "usuario"
                    ).length

            };



            let plantillas = [];



            const templatesPath =
                path.join(
                    __dirname,
                    "templates"
                );



            if(
                fs.existsSync(
                    templatesPath
                )
            ){


                plantillas =
                    fs
                    .readdirSync(
                        templatesPath
                    )
                    .filter(
                        file=>{

                            try{

                                return fs
                                .lstatSync(
                                    path.join(
                                        templatesPath,
                                        file
                                    )
                                )
                                .isDirectory();


                            }catch(e){

                                return false;

                            }

                        }
                    );

            }



            res.render(
                "panel",
                {

                    username:
                        req.session.user.username,


                    role:
                        req.session.user.role,


                    apps,


                    usuarios,


                    plantillas,


                    totalPorRol

                }
            );


        }
        catch(error){


            console.error(
                "❌ Error panel:",
                error
            );


            res.status(500)
            .send(
                "Error cargando panel"
            );


        }


    }
);



// ==================================================
// FRAMEWORK
// ==================================================

app.get(
    "/panel/framework",
    isAuthenticated,
    (req,res)=>{


        res.render(
            "framework",
            {

                user:
                    req.session.user,


                username:
                    req.session.user.username,


                role:
                    req.session.user.role

            }
        );


    }
);



// ==================================================
// LOGISTICA DASHBOARD
// ==================================================

app.get(
    "/panel/logistica",
    isAuthenticated,
    (req,res)=>{


        res.render(
            "logistica/dashboard",
            {

                username:
                    req.session.user.username,


                role:
                    req.session.user.role

            }
        );


    }
);



// ==================================================
// LOGIN
// ==================================================

app.get(
    "/",
    (req,res)=>{

        res.render(
            "login"
        );

    }
);



// ==================================================
// SOCKET.IO
// ==================================================

const server =
    http.createServer(app);



const io =
    new Server(
        server,
        {

            cors:{
                origin:"*"
            }

        }
    );



io.on(
    "connection",
    socket=>{


        console.log(
            "⚡ Cliente conectado:",
            socket.id
        );



        socket.on(
            "disconnect",
            ()=>{


                console.log(
                    "❌ Cliente desconectado:",
                    socket.id
                );


            }
        );


    }
);



// ==================================================
// MANEJO GLOBAL DE ERRORES
// ==================================================

app.use(
    (err,req,res,next)=>{


        console.error(
            "ERROR GLOBAL:",
            err
        );


        res
        .status(500)
        .send(
            "Error interno del servidor"
        );


    }
);



// ==================================================
// INICIAR SERVIDOR
// ==================================================

server.listen(
    PORT,
    ()=>{


        console.log(
            `🚀 Servidor corriendo en puerto ${PORT}`
        );


    }
);