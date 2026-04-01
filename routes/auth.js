const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const db = require("../models/db"); // tu instancia de Better-SQLite3

router.post("/login", (req, res) => {
  const { username, password } = req.body;

  try {
    // Consultar usuario
    const stmt = db.prepare("SELECT * FROM users WHERE username = ?");
    const user = stmt.get(username); // get() devuelve un objeto o undefined

    if (!user) {
      console.log("Usuario no encontrado:", username);
      return res.render("login", { error: "Error en el login" });
    }

    // Comparar contraseña
    const valid = bcrypt.compareSync(password, user.password);
    if (!valid) {
      return res.render("login", { error: "Error en el login" });
    } 

    // 🌟 Guardar la sesión del usuario
req.session.user = {
  id: user.id,
  username: user.username,
  role: user.role
};

    // 🌟 Para test: mostramos en consola
    console.log(`✅ Login exitoso para ${user.username}, rol: ${user.role}`);

    // Por ahora, mensaje simple, luego redirigir a panel
   return res.redirect("/panel");

  } catch (err) {
    console.error("Error al hacer login:", err);
    return res.render("login", { error: "Error en el login" });
  }
});

// Ruta de logout
router.get("/logout", (req, res) => {
  // Destruye la sesión activa
  req.session.destroy(err => {
    if (err) {
      console.error("Error al cerrar sesión:", err);
      return res.status(500).send("Error al cerrar sesión");
    }

    // Redirige al login
    res.redirect("/");
  });
});

module.exports = router;