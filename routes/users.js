// routes/users.js
const express = require("express");
const router = express.Router();
const db = require("../models/db");
const bcrypt = require("bcrypt");

// Middleware para verificar si el usuario es admin o superadmin
function checkAdmin(req, res, next) {
  if (!req.session.user || !["superadmin", "admin"].includes(req.session.user.role)) {
    return res.status(403).json({ error: "Acceso denegado" });
  }
  next();
}

// ------------------ CRUD Usuarios ------------------ //


// Vista: formulario crear usuario
router.get("/new", checkAdmin, (req, res) => {
  // PASAMOS LA INFO DEL USUARIO LOGUEADO
  res.render("new", {
    user: req.session.user // <- así tu EJS lo recibe
  });
});
// Crear nuevo usuario interno
router.post("/", checkAdmin, async (req, res) => {
  try {
    const { username, password, role } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    const stmt = db.prepare(
      "INSERT INTO users (username, password, role) VALUES (?, ?, ?)"
    );
    const info = stmt.run(username, hashedPassword, role);

    res.json({ message: "Usuario creado correctamente", userId: info.lastInsertRowid });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al crear usuario" });
  }
});

// Obtener lista de usuarios internos
router.get("/", checkAdmin, (req, res) => {
  try {
    const stmt = db.prepare("SELECT id, username, role, status, created_at FROM users");
    const users = stmt.all();
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener usuarios" });
  }
});

// Actualizar usuario
/*router.put("/:id", checkAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { username, password, role, status } = req.body;
    let stmt;

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      stmt = db.prepare(
        "UPDATE users SET username = ?, password = ?, role = ?, status = ? WHERE id = ?"
      );
      stmt.run(username, hashedPassword, role, status, id);
    } else {
      stmt = db.prepare(
        "UPDATE users SET username = ?, role = ?, status = ? WHERE id = ?"
      );
      stmt.run(username, role, status, id);
    }

    res.json({ message: "Usuario actualizado correctamente" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al actualizar usuario" });
  }
});*/
router.put("/:id", checkAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { username, password, role, status } = req.body;
    let stmt;

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      stmt = db.prepare(
        "UPDATE users SET username = ?, password = ?, role = ?, status = ? WHERE id = ?"
      );
      stmt.run(username, hashedPassword, role, status, id);
    } else {
      stmt = db.prepare(
        "UPDATE users SET username = ?, role = ?, status = ? WHERE id = ?"
      );
      stmt.run(username, role, status, id);
    }

    // 🔹 Actualizar la sesión si el usuario editado es el que está logueado
    if (req.session.user && req.session.user.id === Number(id)) {
      req.session.user.username = username;
      req.session.user.role = role;
    }

    res.json({ message: "Usuario actualizado correctamente" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al actualizar usuario" });
  }
});

// Obtener un solo usuario por id
router.get("/:id", checkAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const stmt = db.prepare("SELECT id, username, nombre, apellido, email, role FROM users WHERE id = ?");
    const user = stmt.get(id);
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener usuario" });
  }
});
// Obtener usuario por id
/*router.get("/:id", checkAdmin, (req, res) => {
  try {
    const stmt = db.prepare("SELECT id, username, role FROM users WHERE id = ?");
    const user = stmt.get(req.params.id);

    if (!user) return res.status(404).json({ error: "No encontrado" });

    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener usuario" });
  }
});*/
// Eliminar usuario
router.delete("/:id", checkAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const stmt = db.prepare("DELETE FROM users WHERE id = ?");
    stmt.run(id);
    res.json({ message: "Usuario eliminado correctamente" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al eliminar usuario" });
  }
});

module.exports = router;