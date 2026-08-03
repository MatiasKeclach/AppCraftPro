
const express = require("express");
const session = require("express-session");
const path = require("path");
const isAuthenticated = require("./middleware/authMiddleware");

// ------------------ Base de datos ------------------ //

const db = require("./models/db");
require("./models/initDB");


// ------------------ Aplicación ------------------ //

const app = express();

const PORT = process.env.PORT || 3000;


// ------------------ Motor de vistas ------------------ //

app.set("view engine", "ejs");

app.set(
  "views",
  path.join(__dirname, "views")
);


// ------------------ Middlewares ------------------ //

app.use(
  express.urlencoded({
    extended: true
  })
);

app.use(
  express.json()
);


// ------------------ Sesiones ------------------ //

app.use(
  session({
    secret: "appcraft_secret_key",
    resave: false,
    saveUninitialized: true
  })
);


// ------------------ Archivos públicos ------------------ //

app.use(
  express.static(
    path.join(__dirname, "public")
  )
);


// ==================================================
// RUTAS
// ==================================================


// ------------------ Rutas de usuarios ------------------ //

const userRoutes = require("./routes/users");

app.use(
  "/panel/users",
  userRoutes
);


// ------------------ Rutas de autenticación ------------------ //

const authRoutes = require("./routes/auth");

app.use(
  "/auth",
  authRoutes
);

const logisticaRoutes = require("./routes/logistica-fijo");

app.use("/panel/users", userRoutes);

app.use("/auth", authRoutes);

app.use("/panel/logistica", logisticaRoutes);

// ==================================================
// MERCADO LIBRE
// ==================================================

const mercadoLibreRoutes =
  require("./routes/mercadolibre-fijo");

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

    const fs = require("fs");

    try {

      // Obtener aplicaciones
      const apps = db
        .prepare("SELECT * FROM apps")
        .all();


      // Obtener usuarios
      const usuarios = db
        .prepare("SELECT * FROM users")
        .all();


      // Contar usuarios por rol
      const totalPorRol = {

        superadmin: usuarios.filter(
          u => u.role === "superadmin"
        ).length,

        admin: usuarios.filter(
          u => u.role === "admin"
        ).length,

        usuario: usuarios.filter(
          u => u.role === "usuario"
        ).length

      };


      // Obtener plantillas
      let plantillas = [];

      if (
        fs.existsSync("./templates")
      ) {

        plantillas = fs
          .readdirSync("./templates")
          .filter(file => {

            try {

              return fs
                .lstatSync(
                  `./templates/${file}`
                )
                .isDirectory();

            } catch (error) {

              return false;

            }

          });

      }


      // Renderizar panel
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


    } catch (err) {

      console.error(
        "❌ Error cargando panel:",
        err
      );


      // Renderizar panel vacío
      // si ocurre algún error

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
// LOGÍSTICA
// ==================================================
//
// Esta ruta será utilizada por la tarjeta
// "Logística" del panel.
//
// Más adelante vamos a crear el módulo:
//
// /panel/logistica
//
// y dentro:
//
// Fleet Scanner
// Gestión de paquetes
// Clientes
// Choferes
// Colectas
// Consultas
//
// ==================================================

/*app.get(
  "/panel/logistica",
  isAuthenticated,
  (req, res) => {

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
);*/

app.get("/panel/logistica", isAuthenticated, (req, res) => {
  res.render("logistica/dashboard", {
    username: req.session.user.username,
    role: req.session.user.role
  });
});


// ==================================================
// LOGIN
// ==================================================

app.get(
  "/",
  (req, res) => {

    res.render("login");

  }
);


// ==================================================
// SERVIDOR HTTP
// ==================================================

const http = require("http");

const {
  Server
} = require("socket.io");


const server =
  http.createServer(app);


// ==================================================
// SOCKET.IO
// ==================================================

const io =
  new Server(
    server,
    {

      cors: {

        origin: "*"

      }

    }
  );


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
// services/binanceService.js
//
// No se ejecuta:
// startBinanceStream(io)
//
// Esto evita que Render falle por:
//
// Cannot find module '../bot/engine'
//
// Más adelante podemos volver a activar
// Trading sin afectar Logística.
//
// ==================================================


// ==================================================
// INICIAR SERVIDOR
// ==================================================

server.listen(
  PORT,
  () => {

    console.log(
      `🚀 Servidor corriendo en el puerto ${PORT}`
    );

  }
);

