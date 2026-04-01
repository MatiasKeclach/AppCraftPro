// middleware/authMiddleware.js
function isAuthenticated(req, res, next) {
  if (req.session && req.session.user) {
    next(); // deja pasar la ruta
  } else {
    res.redirect("/login"); // redirige al login si no está logueado
  }
}

module.exports = isAuthenticated;