
const express = require("express");
const session = require("express-session");
const path = require("path");
const http = require("http");

const {
    Server
} = require("socket.io");

const isAuthenticated =
    require("./middleware/authMiddleware");


// ==================================================
// BASE DE DATOS
// ==================================================

const db =
    require("./models/db");

require("./models/initDB");


// ==================================================
// APLICACIÓN
// ==================================================

const app =
    express();

const PORT =
    process.env.PORT || 3000;


// ==================================================
// MOTOR DE VISTAS EJS
// ==================================================

app.set(
    "view engine",
    "ejs"
);

app.set(
    "views",
    path.join(
        __dirname,
        "views"
    )
);


// ==================================================
// MIDDLEWARES
// ==================================================

// JSON
app.use(
    express.json({
        limit: "10mb"
    })
);


// FORMULARIOS
app.use(
    express.urlencoded({
        extended: true,
        limit: "10mb"
    })
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
            false,

        cookie: {

            secure:
                process.env.NODE_ENV ===
                "production",

            httpOnly:
                true,

            sameSite:
                "lax",

            maxAge:
                1000 *
                60 *
                60 *
                24 *
                7

        }

    })
);


// ==================================================
// ARCHIVOS PÚBLICOS
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


// --------------------------------------------------
// USUARIOS
// --------------------------------------------------

const userRoutes =
    require("./routes/users");

app.use(
    "/panel/users",
    userRoutes
);


// --------------------------------------------------
// AUTENTICACIÓN
// --------------------------------------------------

const authRoutes =
    require("./routes/auth");

app.use(
    "/auth",
    authRoutes
);


// --------------------------------------------------
// LOGÍSTICA
// --------------------------------------------------

const logisticaRoutes =
    require("./routes/logistica-fijo");

app.use(
    "/panel/logistica",
    logisticaRoutes
);


// --------------------------------------------------
// MERCADO LIBRE
// --------------------------------------------------

const mercadoLibreRoutes =
    require("./routes/mercadolibre");

app.use(
    "/panel/logistica/mercadolibre",
    mercadoLibreRoutes
);


// ==================================================
// LOGIN
// ==================================================

// Ruta principal
// https://appcraftpro.onrender.com/

app.get(
    "/",
    (req, res) => {

        res.render(
            "login"
        );

    }
);


// Ruta alternativa
// https://appcraftpro.onrender.com/login

app.get(
    "/login",
    (req, res) => {

        res.render(
            "login"
        );

    }
);


// ==================================================
// PANEL PRINCIPAL
// ==================================================

app.get(
    "/panel",
    isAuthenticated,
    (req, res) => {

        const fs =
            require("fs");

        try {

            // ------------------------------------------
            // OBTENER APLICACIONES
            // ------------------------------------------

            const apps =
                db
                    .prepare(
                        "SELECT * FROM apps"
                    )
                    .all();


            // ------------------------------------------
            // OBTENER USUARIOS
            // ------------------------------------------

            const usuarios =
                db
                    .prepare(
                        "SELECT * FROM users"
                    )
                    .all();


            // ------------------------------------------
            // CONTAR USUARIOS POR ROL
            // ------------------------------------------

            const totalPorRol = {

                superadmin:
                    usuarios.filter(
                        u =>
                            u.role ===
                            "superadmin"
                    ).length,

                admin:
                    usuarios.filter(
                        u =>
                            u.role ===
                            "admin"
                    ).length,

                usuario:
                    usuarios.filter(
                        u =>
                            u.role ===
                            "usuario"
                    ).length

            };


            // ------------------------------------------
            // OBTENER PLANTILLAS
            // ------------------------------------------

            let plantillas =
                [];


            const templatesPath =
                path.join(
                    __dirname,
                    "templates"
                );


            if (
                fs.existsSync(
                    templatesPath
                )
            ) {

                plantillas =
                    fs
                        .readdirSync(
                            templatesPath
                        )
                        .filter(
                            file => {

                                try {

                                    return fs
                                        .lstatSync(
                                            path.join(
                                                templatesPath,
                                                file
                                            )
                                        )
                                        .isDirectory();

                                } catch (
                                    error
                                ) {

                                    return false;

                                }

                            }
                        );

            }


            // ------------------------------------------
            // RENDER PANEL
            // ------------------------------------------

            return res.render(
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


        } catch (
            error
        ) {

            console.error(
                "❌ Error cargando panel:",
                error
            );


            // ------------------------------------------
            // PANEL DE EMERGENCIA
            // ------------------------------------------

            return res.render(
                "panel",
                {

                    username:
                        req.session.user.username,

                    role:
                        req.session.user.role,

                    apps: [],

                    usuarios: [],

                    plantillas: [],

                    totalPorRol: {

                        superadmin:
                            0,

                        admin:
                            0,

                        usuario:
                            0

                    }

                }
            );

        }

    }
);


// ==================================================
// APPCRAFT FRAMEWORK
// ==================================================

app.get(
    "/panel/framework",
    isAuthenticated,
    (req, res) => {

        return res.render(
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
// RUTA DIRECTA DE LOGÍSTICA
// ==================================================
//
// Esta ruta NO interfiere con routes/logistica.js
// porque el router también está montado en:
// /panel/logistica
//
// La dejamos solamente como acceso directo
// al dashboard principal de logística.
//

app.get(
    "/panel/logistica",
    isAuthenticated,
    (req, res) => {

        return res.render(
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
// MANEJO DE RUTAS NO ENCONTRADAS
// ==================================================

app.use(
    (req, res) => {

        console.error(
            "❌ Ruta no encontrada:",
            req.method,
            req.originalUrl
        );


        // ------------------------------------------
        // API
        // ------------------------------------------

        if (
            req.path.startsWith(
                "/api/"
            )
        ) {

            return res
                .status(404)
                .json({

                    ok:
                        false,

                    mensaje:
                        "Ruta API no encontrada."

                });

        }


        // ------------------------------------------
        // HTML
        // ------------------------------------------

        return res
            .status(404)
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
                        Página no encontrada
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

                        .box {

                            text-align: center;

                            padding: 40px;

                        }

                        h1 {

                            font-size: 70px;

                            margin: 0;

                        }

                        p {

                            color: #94a3b8;

                        }

                        a {

                            display: inline-block;

                            margin-top: 20px;

                            padding: 12px 24px;

                            background: #2563eb;

                            color: white;

                            text-decoration: none;

                            border-radius: 10px;

                        }

                    </style>

                </head>

                <body>

                    <div class="box">

                        <h1>
                            404
                        </h1>

                        <h2>
                            Página no encontrada
                        </h2>

                        <p>
                            La dirección que intentaste abrir no existe.
                        </p>

                        <a href="/">
                            Volver al inicio
                        </a>

                    </div>

                </body>

                </html>
                `
            );

    }
);


// ==================================================
// MANEJO GLOBAL DE ERRORES
// ==================================================

app.use(
    (
        error,
        req,
        res,
        next
    ) => {

        console.error(
            "❌ ERROR GLOBAL:",
            error
        );


        if (
            res.headersSent
        ) {

            return next(
                error
            );

        }


        // ------------------------------------------
        // ERROR API
        // ------------------------------------------

        if (
            req.path.startsWith(
                "/api/"
            )
        ) {

            return res
                .status(500)
                .json({

                    ok:
                        false,

                    mensaje:
                        "Error interno del servidor."

                });

        }


        // ------------------------------------------
        // ERROR HTML
        // ------------------------------------------

        return res
            .status(500)
            .send(
                `
                <h1>Error interno del servidor</h1>

                <p>
                    Ocurrió un error inesperado.
                </p>

                <a href="/">
                    Volver al inicio
                </a>
                `
            );

    }
);


// ==================================================
// SERVIDOR HTTP
// ==================================================

const server =
    http.createServer(
        app
    );


// ==================================================
// SOCKET.IO
// ==================================================

const io =
    new Server(
        server,
        {

            cors: {

                origin:
                    "*",

                methods: [
                    "GET",
                    "POST"
                ]

            }

        }
    );


// ==================================================
// CONEXIONES SOCKET.IO
// ==================================================

io.on(
    "connection",
    (socket) => {

        console.log(
            "⚡ Cliente conectado:",
            socket.id
        );


        socket.on(
            "disconnect",
            () => {

                console.log(
                    "❌ Cliente desconectado:",
                    socket.id
                );

            }
        );

    }
);


// ==================================================
// BINANCE / TRADING
// ==================================================
//
// TEMPORALMENTE DESACTIVADO.
//
// ==================================================


// ==================================================
// INICIAR SERVIDOR
// ==================================================

server.listen(
    PORT,
    () => {

        console.log(
            `🚀 AppCraftPro corriendo en puerto ${PORT}`
        );

        console.log(
            `🔐 Login: /`
        );

        console.log(
            `🔐 Login alternativo: /login`
        );

        console.log(
            `📊 Panel: /panel`
        );

        console.log(
            `📦 Logística: /panel/logistica`
        );

        console.log(
            `🛒 Mercado Libre: /panel/logistica/mercadolibre`
        );

    }
);

