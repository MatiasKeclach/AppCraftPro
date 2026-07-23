
// ============================================================
// APPCRAFTPRO
// app.js
// ============================================================

const express = require("express");
const session = require("express-session");
const path = require("path");
const http = require("http");

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
// MOTOR DE VISTAS EJS
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
    express.urlencoded({
        extended: true
    })
);

app.use(
    express.json()
);


// ============================================================
// SESIONES
// ============================================================
//
// IMPORTANTE:
// Se mantiene tu configuración actual
// para no modificar el funcionamiento del login.
//

app.use(
    session({

        secret:
            "appcraft_secret_key",

        resave:
            false,

        saveUninitialized:
            true

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
// ============================================================
// RUTAS
// ============================================================
// ============================================================


// ============================================================
// USUARIOS
// ============================================================

const userRoutes =
    require("./routes/users");

app.use(
    "/panel/users",
    userRoutes
);

console.log(
    "✅ Rutas de usuarios registradas:"
);

console.log(
    "   /panel/users"
);


// ============================================================
// AUTENTICACIÓN
// ============================================================
//
// NO SE MODIFICA EL LOGIN
//
// GET  /
// POST /auth/login
//
// ============================================================

const authRoutes =
    require("./routes/auth");

app.use(
    "/auth",
    authRoutes
);

console.log(
    "✅ Rutas de autenticación registradas:"
);

console.log(
    "   /auth"
);


// ============================================================
// MERCADO LIBRE
// ============================================================
//
// IMPORTANTE:
//
// Mercado Libre se registra ANTES de Logística.
//
// URL BASE:
//
// /panel/logistica/mercadolibre
//
// Archivo:
//
// routes/mercadolibre.js
//
// ============================================================

console.log(
    "============================================================"
);

console.log(
    "🛒 CARGANDO MÓDULO MERCADO LIBRE..."
);

console.log(
    "============================================================"
);


try {

    const mercadoLibreRoutes =
        require("./routes/mercadolibre-fijo");


    app.use(
        "/panel/logistica/mercadolibre",
        mercadoLibreRoutes
    );


    console.log(
        "✅ Mercado Libre cargado correctamente"
    );

    console.log(
        "🛒 Ruta principal:"
    );

    console.log(
        "   GET /panel/logistica/mercadolibre"
    );

    console.log(
        "🔗 Conectar:"
    );

    console.log(
        "   GET /panel/logistica/mercadolibre/conectar"
    );

    console.log(
        "🔄 Callback:"
    );

    console.log(
        "   GET /panel/logistica/mercadolibre/callback"
    );

    console.log(
        "📡 Estado:"
    );

    console.log(
        "   GET /panel/logistica/mercadolibre/estado"
    );

    console.log(
        "🔄 Sincronizar:"
    );

    console.log(
        "   POST /panel/logistica/mercadolibre/sincronizar"
    );

    console.log(
        "📡 Webhook:"
    );

    console.log(
        "   POST /panel/logistica/mercadolibre/webhook"
    );

} catch (error) {

    console.error(
        "❌ ERROR CARGANDO routes/mercadolibre.js"
    );

    console.error(
        error
    );

}


// ============================================================
// LOGÍSTICA
// ============================================================
//
// IMPORTANTE:
//
// Se registra DESPUÉS de Mercado Libre.
//
// URL BASE:
//
// /panel/logistica
//
// ============================================================

const logisticaRoutes =
    require("./routes/logistica-fijo");


app.use(
    "/panel/logistica",
    logisticaRoutes
);


console.log(
    "✅ Rutas de logística registradas:"
);

console.log(
    "   /panel/logistica"
);


// ============================================================
// LOG DE RUTAS PRINCIPALES
// ============================================================

console.log(
    "============================================================"
);

console.log(
    "📋 RESUMEN DE RUTAS"
);

console.log(
    "============================================================"
);

console.log(
    "🔐 Login:"
);

console.log(
    "   GET /"
);

console.log(
    "   POST /auth/login"
);

console.log(
    "👥 Usuarios:"
);

console.log(
    "   /panel/users"
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
    "============================================================"
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

            // ------------------------------------------------
            // OBTENER APLICACIONES
            // ------------------------------------------------

            const apps =
                db
                    .prepare(
                        "SELECT * FROM apps"
                    )
                    .all();


            // ------------------------------------------------
            // OBTENER USUARIOS
            // ------------------------------------------------

            const usuarios =
                db
                    .prepare(
                        "SELECT * FROM users"
                    )
                    .all();


            // ------------------------------------------------
            // CONTAR USUARIOS POR ROL
            // ------------------------------------------------

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


            // ------------------------------------------------
            // OBTENER PLANTILLAS
            // ------------------------------------------------

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


            // ------------------------------------------------
            // RENDERIZAR PANEL
            // ------------------------------------------------

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


// ============================================================
// APPCRAFT FRAMEWORK
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
// RUTA DIRECTA DE LOGÍSTICA
// ============================================================
//
// Esta ruta mantiene tu funcionamiento actual.
//
// GET:
//
// /panel/logistica
//
// ============================================================

app.get(
    "/panel/logistica",
    isAuthenticated,
    (req, res) => {

        console.log(
            "📦 Acceso al panel principal de Logística"
        );

        console.log(
            "👤 Usuario:",
            req.session.user
                ? req.session.user.username
                : "Sin usuario"
        );


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


// ============================================================
// LOGIN
// ============================================================
//
// IMPORTANTE:
//
// NO SE MODIFICA.
//
// GET /
//
// Renderiza:
//
// views/login.ejs
//
// ============================================================

app.get(
    "/",
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
// RUTA 404
// ============================================================

app.use(
    (req, res) => {

        console.error(
            "❌ RUTA NO ENCONTRADA:"
        );

        console.error(
            "Método:",
            req.method
        );

        console.error(
            "URL:",
            req.originalUrl
        );


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
                            background: #f4f6f9;
                            font-family: Arial, sans-serif;
                        }

                        .card {
                            background: white;
                            padding: 40px;
                            border-radius: 15px;
                            box-shadow: 0 10px 30px rgba(0,0,0,.1);
                            text-align: center;
                            max-width: 500px;
                        }

                        h1 {
                            color: #1e293b;
                        }

                        p {
                            color: #64748b;
                        }

                        a {
                            display: inline-block;
                            margin-top: 20px;
                            padding: 12px 20px;
                            background: #2563eb;
                            color: white;
                            text-decoration: none;
                            border-radius: 8px;
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
            "❌ ERROR GLOBAL DEL SERVIDOR:"
        );

        console.error(
            error
        );


        if (
            res.headersSent
        ) {

            return next(
                error
            );

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

const {
    Server
} = require("socket.io");


const io =
    new Server(
        server,
        {

            cors: {

                origin:
                    "*"

            }

        }
    );


// ============================================================
// SOCKET.IO - CONEXIONES
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
// BINANCE / TRADING
// ============================================================
//
// TEMPORALMENTE DESACTIVADO.
//
// NO SE MODIFICA.
//
// ============================================================


// ============================================================
// INICIAR SERVIDOR
// ============================================================

server.listen(
    PORT,
    () => {

        console.log(
            "============================================================"
        );

        console.log(
            "🚀 APPCRAFTPRO INICIADO CORRECTAMENTE"
        );

        console.log(
            "============================================================"
        );

        console.log(
            `🚀 Puerto: ${PORT}`
        );

        console.log(
            `🌐 Entorno: ${process.env.NODE_ENV || "development"}`
        );

        console.log(
            "📦 Logística:"
        );

        console.log(
            "   http://localhost:" +
            PORT +
            "/panel/logistica"
        );

        console.log(
            "🛒 Mercado Libre:"
        );

        console.log(
            "   http://localhost:" +
            PORT +
            "/panel/logistica/mercadolibre"
        );

        console.log(
            "🔐 Login:"
        );

        console.log(
            "   http://localhost:" +
            PORT +
            "/"
        );

        console.log(
            "============================================================"
        );

    }
);

