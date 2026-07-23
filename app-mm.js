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
// MOTOR DE VISTAS
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

        resave: false,

        saveUninitialized: false,

        cookie: {

            secure:
                process.env.NODE_ENV ===
                "production",

            httpOnly: true,

            sameSite: "lax",

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
    require("./routes/logistica");

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

            res.render(
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

                        superadmin: 0,

                        admin: 0,

                        usuario: 0

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
// LOGIN
// ==================================================

app.get(
    "/",
    (req, res) => {

        res.render(
            "login"
        );

    }
);


// ==================================================
// MANEJO DE RUTAS NO ENCONTRADAS
// ==================================================

app.use(
    (req, res) => {

        // Si es una petición API
        if (
            req.path.startsWith(
                "/api/"
            )
        ) {

            return res
                .status(404)
                .json({

                    ok: false,

                    mensaje:
                        "Ruta API no encontrada."

                });

        }


        // Respuesta HTML
        res
            .status(404)
            .send(
                "Página no encontrada."
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
            "❌ Error global:",
            error
        );


        if (
            res.headersSent
        ) {

            return next(
                error
            );

        }


        if (
            req.path.startsWith(
                "/api/"
            )
        ) {

            return res
                .status(500)
                .json({

                    ok: false,

                    mensaje:
                        "Error interno del servidor."

                });

        }


        res
            .status(500)
            .send(
                "Error interno del servidor."
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

                origin: "*",

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
// No se carga:
//
// services/binanceService.js
//
// No se ejecuta:
//
// startBinanceStream(io)
//
// Esto evita errores relacionados
// con módulos del bot.
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
            `📦 Logística: /panel/logistica`
        );

        console.log(
            `🛒 Mercado Libre: /panel/logistica/mercadolibre`
        );

    }
);