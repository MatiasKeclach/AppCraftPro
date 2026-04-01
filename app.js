const express = require("express");
const session = require("express-session");
const path = require("path");
const isAuthenticated = require("./middleware/authMiddleware");

// DB
const db = require("./models/db");
require("./models/initDB");

const app = express();
const PORT = process.env.PORT || 3000;

// ------------------ Motor de vistas ------------------ //
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// ------------------ Middlewares ------------------ //
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(
  session({
    secret: "appcraft_secret_key",
    resave: false,
    saveUninitialized: true,
  })
);

// ------------------ Archivos públicos ------------------ //
app.use(express.static(path.join(__dirname, "public")));

// ------------------ Rutas ------------------ //
const userRoutes = require("./routes/users");
const authRoutes = require("./routes/auth");

// Vistas usuarios (panel)
app.use("/panel/users", userRoutes);

// Auth
app.use("/auth", authRoutes);

// ------------------ Panel ------------------ //
app.get("/panel", isAuthenticated, (req, res) => {
  const fs = require("fs");

  try {
    const apps = db.prepare("SELECT * FROM apps").all();
    const usuarios = db.prepare("SELECT * FROM users").all();

    const totalPorRol = {
      superadmin: usuarios.filter(u => u.role === "superadmin").length,
      admin: usuarios.filter(u => u.role === "admin").length,
      usuario: usuarios.filter(u => u.role === "usuario").length
    };

    const plantillas = fs.existsSync("./templates")
      ? fs.readdirSync("./templates").filter(f =>
         `fs.lstatSync(./templates/${f}).isDirectory()`
        )
      : [];

    res.render("panel", {
      username: req.session.user.username,
      role: req.session.user.role,
      apps,
      usuarios,
      plantillas,
      totalPorRol
    });

  } catch (err) {
    console.error("Error cargando panel:", err);
    res.render("panel", {
      username: req.session.user.username,
      role: req.session.user.role,
      apps: [],
      usuarios: [],
      plantillas: [],
      totalPorRol: { superadmin: 0, admin: 0, usuario: 0 }
    });
  }
});

// ------------------ Panel Framework ------------------ //
app.get("/panel/framework", isAuthenticated, (req, res) => {
  // Renderizamos la vista del framework
  res.render("framework", {
    user: req.session.user, // info del usuario logueado
    username: req.session.user.username,
    role: req.session.user.role
  });
});

// ------------------ Login ------------------ //
app.get("/", (req, res) => {
  res.render("login");
});

// ------------------ Server ------------------ //
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});