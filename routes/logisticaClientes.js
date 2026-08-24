const express = require("express");
const router = express.Router();

const db = require("../models/db");
const isAuthenticated = require("../middleware/authMiddleware");

// ============================================================
// LOGÍSTICA - CLIENTES INDEPENDIENTE
// ============================================================


// ============================================================
// LISTADO DE CLIENTES
// GET /panel/logistica-clientes
// ============================================================

router.get("/", isAuthenticated, (req, res) => {

    try {

        const clientes = db.prepare(`
            SELECT
                id,
                nombre,
                empresa,
                telefono,
                email,
                direccion,
                estado
            FROM logistica_clientes
            ORDER BY id DESC
        `).all();


        res.render("logistica/clientes-nuevo", {

            username:
                req.session?.user?.username ||
                "Usuario",

            clientes

        });


    } catch (error) {

        console.error(
            "❌ Error cargando clientes independientes:",
            error
        );

        res.status(500).send(
            "Error cargando clientes."
        );

    }

});


// ============================================================
// CREAR CLIENTE
// POST /panel/logistica-clientes/crear
// ============================================================

router.post("/crear", isAuthenticated, (req, res) => {

    try {

        const nombre =
            String(req.body.nombre || "").trim();

        const empresa =
            String(req.body.empresa || "").trim();

        const telefono =
            String(req.body.telefono || "").trim();

        const email =
            String(req.body.email || "").trim();

        const direccion =
            String(req.body.direccion || "").trim();


        // ----------------------------------------------------
        // VALIDACIÓN
        // ----------------------------------------------------

        if (!nombre) {

            return res.status(400).send(`
                <script>
                    alert("El nombre del cliente es obligatorio.");
                    window.location.href =
                        "/panel/logistica-clientes";
                </script>
            `);

        }


        // ----------------------------------------------------
        // INSERTAR
        // ----------------------------------------------------

        const resultado = db.prepare(`
            INSERT INTO logistica_clientes
            (
                nombre,
                empresa,
                telefono,
                email,
                direccion,
                estado
            )
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(

            nombre,
            empresa,
            telefono,
            email,
            direccion,
            "activo"

        );


        console.log(
            "✅ CLIENTE CREADO:",
            resultado.lastInsertRowid,
            nombre
        );


        // ----------------------------------------------------
        // VOLVER AL LISTADO
        // ----------------------------------------------------

        return res.redirect(
            "/panel/logistica-clientes"
        );


    } catch (error) {

        console.error(
            "❌ ERROR CREANDO CLIENTE:",
            error
        );


        return res.status(500).send(`
            <script>
                alert("Error creando cliente: ${String(
                    error.message
                ).replace(/'/g, "\\'")}");
                window.location.href =
                    "/panel/logistica-clientes";
            </script>
        `);

    }

});


// ============================================================
// ELIMINAR CLIENTE
// GET /panel/logistica-clientes/eliminar/:id
// ============================================================

router.get(
    "/eliminar/:id",
    isAuthenticated,
    (req, res) => {

        try {

            const id =
                Number(req.params.id);


            if (!Number.isInteger(id)) {

                return res.status(400).send(
                    "ID de cliente inválido."
                );

            }


            const cliente =
                db.prepare(`
                    SELECT id, nombre
                    FROM logistica_clientes
                    WHERE id = ?
                `).get(id);


            if (!cliente) {

                return res.status(404).send(`
                    <script>
                        alert("Cliente no encontrado.");
                        window.location.href =
                            "/panel/logistica-clientes";
                    </script>
                `);

            }


            // ------------------------------------------------
            // ELIMINACIÓN
            // ------------------------------------------------

            db.prepare(`
                DELETE FROM logistica_clientes
                WHERE id = ?
            `).run(id);


            console.log(
                "🗑️ CLIENTE ELIMINADO:",
                cliente.id,
                cliente.nombre
            );


            return res.redirect(
                "/panel/logistica-clientes"
            );


        } catch (error) {

            console.error(
                "❌ ERROR ELIMINANDO CLIENTE:",
                error
            );


            return res.status(500).send(`
                <script>
                    alert("No se pudo eliminar el cliente.");
                    window.location.href =
                        "/panel/logistica-clientes";
                </script>
            `);

        }

    }
);


// ============================================================
// EXPORTAR
// ============================================================

module.exports = router;