// ============================================================
// APPCRAFTPRO
// app.js
// ============================================================

const express = require("express");
const session = require("express-session");
const path = require("path");
const http = require("http");

const { Server } = require("socket.io");

const isAuthenticated =
    require("./middleware/authMiddleware");

// ============================================================
// BASE DE DATOS
// ============================================================

const db =
    require("./models/db");

require("./models/initDB");

// ============================================================
// APLICACIÓN
// ============================================================

const app =
    express();

const PORT =
    process.env.PORT || 3000;

// ============================================================
// MOTOR DE VISTAS
// ============================================================

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

// ============================================================
// MIDDLEWARES
// ============================================================

app.use(
    express.json({
        limit: "10mb"
    })
);

app.use(
    express.urlencoded({
        extended: true,
        limit: "10mb"
    })
);

// ============================================================
// SESIONES
// ============================================================

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

// ============================================================
// ARCHIVOS PÚBLICOS
// ============================================================

app.use(
    express.static(
        path.join(
            __dirname,
            "public"
        )
    )
);

// ============================================================
// RUTAS
// ============================================================

// ============================================================
// AUTENTICACIÓN
// ============================================================

const authRoutes =
    require("./routes/auth");

app.use(
    "/auth",
    authRoutes
);

// ============================================================
// USUARIOS
// ============================================================

const userRoutes =
    require("./routes/users");

app.use(
    "/panel/users",
    userRoutes
);

// ============================================================
// LOGÍSTICA
// ============================================================

const logisticaRoutes =
    require("./routes/logistica-fijo");

app.use(
    "/panel/logistica",
    logisticaRoutes
);

// ============================================================
// MERCADO LIBRE
// ============================================================
//
// IMPORTANTE:
//
// Archivo:
// routes/mercadolibre.js
//
// Vista:
// views/logistica/mercadolibre.ejs
//
// URL:
//
// /panel/logistica/mercadolibre
//
// ============================================================

const mercadoLibreRoutes =
    require("./routes/mercadolibre");

app.use(
    "/panel/logistica/mercadolibre",
    mercadoLibreRoutes
);

console.log(
    "🛒 Mercado Libre registrado correctamente:"
);

console.log(
    "   GET  /panel/logistica/mercadolibre"
);

console.log(
    "   GET  /panel/logistica/mercadolibre/conectar"
);

console.log(
    "   GET  /panel/logistica/mercadolibre/callback"
);

console.log(
    "   GET  /panel/logistica/mercadolibre/estado"
);

console.log(
    "   POST /panel/logistica/mercadolibre/sincronizar"
);

console.log(
    "   POST /panel/logistica/mercadolibre/webhook"
);

// ============================================================
// PANEL PRINCIPAL
// ============================================================

app.get(
    "/panel",
    isAuthenticated,
    (req, res) => {

        const fs =
            require("fs");

        try {

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

                        superadmin: 0,

                        admin: 0,

                        usuario: 0

                    }

                }
            );

        }

    }
);

// ============================================================
// FRAMEWORK
// ============================================================

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

// ============================================================
// LOGIN
// ============================================================
//
// "/" y "/login" muestran la misma vista.
//
// Esto soluciona:
//
// GET /login
//
// ============================================================

app.get(
    ["/", "/login"],
    (req, res) => {

        return res.render(
            "login"
        );

    }
);

// ============================================================
// HEALTH CHECK
// ============================================================

app.get(
    "/health",
    (req, res) => {

        return res.json({

            ok:
                true,

            app:
                "AppCraftPro",

            status:
                "online"

        });

    }
);

// ============================================================
// 404
// ============================================================

app.use(
    (req, res) => {

        console.error(
            "❌ RUTA NO ENCONTRADA:",
            req.method,
            req.originalUrl
        );

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
                            font-family: Arial, sans-serif;
                            background: #0f172a;
                            color: white;
                            min-height: 100vh;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            margin: 0;
                        }

                        .card {
                            text-align: center;
                            padding: 40px;
                            background: #1e293b;
                            border-radius: 20px;
                            max-width: 500px;
                        }

                        h1 {
                            margin-top: 0;
                        }

                        a {
                            display: inline-block;
                            margin-top: 20px;
                            padding: 12px 20px;
                            background: #2563eb;
                            color: white;
                            text-decoration: none;
                            border-radius: 10px;
                        }

                    </style>

                </head>

                <body>

                    <div class="card">

                        <h1>
                            Página no encontrada
                        </h1>

                        <p>
                            Ruta:
                            ${req.method}
                            ${req.originalUrl}
                        </p>

                        <a href="/panel">
                            Volver al panel
                        </a>

                    </div>

                </body>

                </html>
                `
            );

    }
);

// ============================================================
// MANEJO GLOBAL DE ERRORES
// ============================================================

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

        return res
            .status(500)
            .send(
                "Error interno del servidor."
            );

    }
);

// ============================================================
// SERVIDOR HTTP
// ============================================================

const server =
    http.createServer(
        app
    );

// ============================================================
// SOCKET.IO
// ============================================================

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

// ============================================================
// SOCKET.IO CONNECTION
// ============================================================

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

// ============================================================
// INICIAR SERVIDOR
// ============================================================

server.listen(
    PORT,
    () => {

        console.log(
            "============================================"
        );

        console.log(
            "🚀 APPCRAFTPRO INICIADO"
        );

        console.log(
            "============================================"
        );

        console.log(
            `🚀 Puerto: ${PORT}`
        );

        console.log(
            "🔐 Login:"
        );

        console.log(
            "   /"
        );

        console.log(
            "   /login"
        );

        console.log(
            "📦 Logística:"
        );

        console.log(
            "   /panel/logistica"
        );

        console.log(
            "🛒 Mercado Libre:"
        );

        console.log(
            "   /panel/logistica/mercadolibre"
        );

        console.log(
            "============================================"
        );

    }
);