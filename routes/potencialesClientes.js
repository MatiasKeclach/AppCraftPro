const express = require("express");

const router = express.Router();

const db = require("../models/db");


// ==================================================
// DASHBOARD
// ==================================================

router.get("/", (req, res) => {

    try {

        const usuario = req.session.user;

        const total = db.prepare(`
            SELECT COUNT(*) AS total
            FROM potenciales_clientes
        `).get().total;


        const logistica = db.prepare(`
            SELECT COUNT(*) AS total
            FROM potenciales_clientes
            WHERE tipo = 'logistica'
               OR tipo = 'ambos'
        `).get().total;


        const programacion = db.prepare(`
            SELECT COUNT(*) AS total
            FROM potenciales_clientes
            WHERE tipo = 'programacion'
               OR tipo = 'ambos'
        `).get().total;


        const clientes = db.prepare(`
            SELECT COUNT(*) AS total
            FROM potenciales_clientes
            WHERE estado = 'cliente'
        `).get().total;


        const prospectos = db.prepare(`
            SELECT *
            FROM potenciales_clientes
            ORDER BY created_at DESC
            LIMIT 100
        `).all();


        res.render(
            "potenciales-clientes/dashboard",
            {
                usuario,
                total,
                logistica,
                programacion,
                clientes,
                prospectos
            }
        );

    } catch (error) {

        console.error(
            "❌ Error Potenciales Clientes:",
            error
        );

        res.status(500).send(
            "Error cargando Potenciales Clientes"
        );

    }

});


// ==================================================
// CREAR PROSPECTO
// ==================================================

router.post("/crear", (req, res) => {

    try {

        const usuario = req.session.user;

        const {

            tipo,
            nombre,
            empresa,
            categoria,
            mercadolibre_nickname,
            mercadolibre_seller_id,
            mercadolibre_url

        } = req.body;


        if (!nombre) {

            return res.status(400).json({

                success: false,

                error:
                    "El nombre del prospecto es obligatorio"

            });

        }


        const resultado = db.prepare(`

            INSERT INTO potenciales_clientes (

                tipo,
                nombre,
                empresa,
                categoria,
                mercadolibre_nickname,
                mercadolibre_seller_id,
                mercadolibre_url,
                created_by,
                updated_by

            )

            VALUES (

                @tipo,
                @nombre,
                @empresa,
                @categoria,
                @mercadolibre_nickname,
                @mercadolibre_seller_id,
                @mercadolibre_url,
                @created_by,
                @updated_by

            )

        `).run({

            tipo:
                tipo || "ambos",

            nombre,

            empresa:
                empresa || null,

            categoria:
                categoria || null,

            mercadolibre_nickname:
                mercadolibre_nickname || null,

            mercadolibre_seller_id:
                mercadolibre_seller_id || null,

            mercadolibre_url:
                mercadolibre_url || null,

            created_by:
                usuario.id,

            updated_by:
                usuario.id

        });


        res.json({

            success: true,

            id:
                resultado.lastInsertRowid

        });


    } catch (error) {

        console.error(
            "❌ Error creando prospecto:",
            error
        );

        res.status(500).json({

            success: false,

            error:
                "No se pudo crear el prospecto"

        });

    }

});


// ==================================================
// OBTENER PROSPECTOS
// ==================================================

router.get("/api/lista", (req, res) => {

    try {

        const prospectos = db.prepare(`

            SELECT *

            FROM potenciales_clientes

            ORDER BY created_at DESC

        `).all();


        res.json({

            success: true,

            prospectos

        });


    } catch (error) {

        console.error(error);

        res.status(500).json({

            success: false,

            error:
                "Error obteniendo prospectos"

        });

    }

});

// ==================================================
// BUSCAR POTENCIALES CLIENTES
// ==================================================

router.post("/api/buscar", (req, res) => {

    try {

        const usuario = req.session.user;

        const {
            tipo,
            categoria,
            ventas,
            cantidad,
            fuente,
            mercado_lider
        } = req.body;

        const resultado = db.prepare(`

            INSERT INTO potenciales_busquedas (

                tipo,
                categoria,
                criterio_ventas,
                criterio_mercadolider,
                cantidad_solicitada,
                resultados_encontrados,
                usuario_id

            )

            VALUES (

                @tipo,
                @categoria,
                @criterio_ventas,
                @criterio_mercadolider,
                @cantidad_solicitada,
                0,
                @usuario_id

            )

        `).run({

            tipo:
                tipo || "logistica",

            categoria:
                categoria || null,

            criterio_ventas:
                Number(ventas) || 0,

            criterio_mercadolider:
                mercado_lider ? 1 : 0,

            cantidad_solicitada:
                Number(cantidad) || 100,

            usuario_id:
                usuario.id

        });

        res.json({

            success: true,

            busqueda_id:
                resultado.lastInsertRowid,

            mensaje:
                "Búsqueda creada correctamente"

        });

    }
    catch(error) {

        console.error(
            "❌ Error creando búsqueda:",
            error
        );

        res.status(500).json({

            success: false,

            error:
                "No se pudo iniciar la búsqueda"

        });

    }

});

module.exports = router;