const express = require("express");
const router = express.Router();
const db = require("../models/db");
const isAuthenticated = require("../middleware/authMiddleware");


// Dashboard logística
router.get("/", isAuthenticated, (req, res) => {

    res.render("logistica/dashboard", {
        username: req.session.user.username,
        role: req.session.user.role
    });

});


// Listado de clientes
router.get("/clientes", isAuthenticated, (req, res) => {

    try {

        const clientes = db.prepare(
            "SELECT * FROM logistica_clientes ORDER BY id DESC"
        ).all();


        res.render("logistica/clientes", {
            username: req.session.user.username,
            clientes
        });


    } catch(error){

        console.error(error);
        res.status(500).send("Error cargando clientes");

    }

});


// Crear cliente
router.post("/clientes", isAuthenticated, (req,res)=>{

    const {
        nombre,
        empresa,
        telefono,
        email,
        direccion
    } = req.body;


    db.prepare(`
        INSERT INTO logistica_clientes
        (nombre, empresa, telefono, email, direccion)
        VALUES (?, ?, ?, ?, ?)
    `).run(
        nombre,
        empresa,
        telefono,
        email,
        direccion
    );


    res.redirect("/panel/logistica/clientes");

});


module.exports = router;