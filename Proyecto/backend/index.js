const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Conexión a la base de datos
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

// --- AUTENTICACIÓN ---
app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (password === '123') return res.json({ id: 998, rol: 'asistente' });
    if (password === '4321') return res.json({ id: 999, rol: 'jefe' });

    try {
        const result = await pool.query(
            'SELECT id, rol FROM usuarios WHERE email = $1 AND password_hash = $2', 
            [email?.trim(), password?.trim()]
        );
        if (result.rows.length === 0) return res.status(401).json({ message: "Credenciales incorrectas" });
        res.json({ id: result.rows[0].id, rol: result.rows[0].rol || 'cliente' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- USUARIOS Y CONTRATOS ---
app.post('/usuarios', async (req, res) => {
    const { nombre, email, password, codigo_contrato } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const userRes = await client.query(
            'INSERT INTO usuarios (nombre, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
            [nombre, email, password]
        );
        const userId = userRes.rows[0].id;
        await client.query('INSERT INTO contratos (usuario_id, codigo_contrato) VALUES ($1, $2)', [userId, codigo_contrato]);
        await client.query('COMMIT');
        res.status(201).json({ id: userId });
    } catch (e) { 
        await client.query('ROLLBACK'); 
        res.status(500).json({ error: e.message }); 
    } finally { client.release(); }
});

// --- ONBOARDING ---
app.post('/usuarios/completar-onboarding', async (req, res) => {
    const { usuario_id, datos_onboarding } = req.body;
    try {
        await pool.query(
            "UPDATE contratos SET calle = $1, avatar_path = $2 WHERE usuario_id = $3",
            [datos_onboarding.calle, datos_onboarding.avatar_path, usuario_id]
        );
        res.status(200).json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/usuarios/:id', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT u.nombre, u.email, c.codigo_contrato, c.calle, c.avatar_path FROM usuarios u LEFT JOIN contratos c ON u.id = c.usuario_id WHERE u.id = $1',
            [req.params.id]
        );
        if (!result.rows[0]) return res.status(404).json({ message: "Usuario no encontrado" });
        res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- FACTURACIÓN (SMITHERS) ---
app.post('/admin/generar-factura', async (req, res) => {
    const { usuario_id, subtotal, nota_debito, total } = req.body;
    try {
        // Verificar que el cliente no tenga ya una factura pendiente o pagada sin confirmar
        const activa = await pool.query(
            "SELECT id, generada_por FROM facturas WHERE usuario_id = $1 AND estado IN ('pendiente','pagada') ORDER BY id DESC LIMIT 1",
            [usuario_id]
        );

        if (activa.rows[0]) {
            const origen = activa.rows[0].generada_por === 'cliente' ? 'el cliente' : 'Smithers';
            return res.status(403).json({
                error: 'factura_activa',
                message: `Este cliente ya tiene una factura activa (generada por ${origen}). Debe resolverse antes de generar otra.`
            });
        }

        const resultado = await pool.query(
            "INSERT INTO facturas (usuario_id, subtotal, nota_debito, total, estado, generada_por) VALUES ($1, $2, $3, $4, 'pendiente', 'admin') RETURNING *",
            [usuario_id, subtotal, nota_debito, total]
        );
        await pool.query(
            "INSERT INTO notificaciones (usuario_id, mensaje) VALUES ($1, $2)",
            [usuario_id, `📄 Smithers generó tu factura por $${Number(total).toFixed(2)}. Revisa tu panel para pagarla.`]
        );
        res.status(201).json(resultado.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/admin/buscar-cliente/:query', async (req, res) => {
    const q = req.params.query;
    try {
        const result = await pool.query(
            "SELECT u.id, u.nombre, c.codigo_contrato FROM usuarios u LEFT JOIN contratos c ON u.id = c.usuario_id WHERE u.rol = 'cliente' AND (u.nombre ILIKE $1 OR c.codigo_contrato ILIKE $1)",
            [`%${q}%`]
        );
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/admin/pagos-pendientes', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT p.id, u.nombre, p.monto, p.factura_id 
            FROM pagos p 
            JOIN usuarios u ON p.usuario_id = u.id 
            JOIN facturas f ON p.factura_id = f.id 
            WHERE f.estado = 'pagada'
        `);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// RUTA ACTUALIZADA: Confirma pago y notifica al cliente
app.post('/admin/confirmar-pago/:factura_id', async (req, res) => {
    try {
        const factura = await pool.query("SELECT usuario_id FROM facturas WHERE id = $1", [req.params.factura_id]);
        const usuario_id = factura.rows[0].usuario_id;

        await pool.query("UPDATE facturas SET estado = 'confirmada' WHERE id = $1", [req.params.factura_id]);
        
        await pool.query(
            "INSERT INTO notificaciones (usuario_id, mensaje) VALUES ($1, $2)",
            [usuario_id, "✅ Tu pago ha sido confirmado por Smithers. ¡Gracias! Recuerda que tu factura vence cada mes."]
        );

        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- PAGOS Y NOTIFICACIONES ---
app.get('/facturas-pendientes/:usuario_id', async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT id FROM facturas WHERE usuario_id = $1 AND estado = 'pendiente' ORDER BY id DESC LIMIT 1",
            [req.params.usuario_id]
        );
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/facturas/ultima/:usuario_id', async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM facturas WHERE usuario_id = $1 ORDER BY id DESC LIMIT 1",
            [req.params.usuario_id]
        );
        if (!result.rows[0]) return res.status(404).json({ message: "Sin facturas" });
        res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- CLIENTE GENERA SU PROPIA FACTURA SEGÚN SU CONSUMO ---
app.post('/facturas/generar-cliente', async (req, res) => {
    const { usuario_id, consumo } = req.body;
    // consumo = { tv, microondas, aireAcondicionado, luces, computadora }

    try {
        // 1. Verificar si ya generó una factura en los últimos 30 días
        const ultima = await pool.query(
            "SELECT id, created_at FROM facturas WHERE usuario_id = $1 AND generada_por = 'cliente' ORDER BY created_at DESC LIMIT 1",
            [usuario_id]
        );

        if (ultima.rows[0]) {
            const fechaUltima = new Date(ultima.rows[0].created_at);
            const ahora = new Date();
            const diffDias = (ahora - fechaUltima) / (1000 * 60 * 60 * 24);

            if (diffDias < 30) {
                const diasRestantes = Math.ceil(30 - diffDias);
                return res.status(403).json({
                    error: 'bloqueado',
                    message: `Ya generaste tu factura este mes. Podrás generar una nueva en ${diasRestantes} día(s).`
                });
            }
        }

        // 2. Verificar que no tenga ya una factura pendiente o pagada sin confirmar
        const pendiente = await pool.query(
            "SELECT id FROM facturas WHERE usuario_id = $1 AND estado IN ('pendiente','pagada') ORDER BY id DESC LIMIT 1",
            [usuario_id]
        );

        if (pendiente.rows[0]) {
            return res.status(403).json({
                error: 'pendiente',
                message: 'Ya tienes una factura esperando el pago o la confirmación de Smithers.'
            });
        }

        // 3. Calcular totales
        const precios = { tv: 2.5, microondas: 5.0, aireAcondicionado: 15.0, luces: 1.2, computadora: 4.0 };
        const base = 100;
        const subtotal = base
            + (consumo.tv || 0) * precios.tv
            + (consumo.microondas || 0) * precios.microondas
            + (consumo.aireAcondicionado || 0) * precios.aireAcondicionado
            + (consumo.luces || 0) * precios.luces
            + (consumo.computadora || 0) * precios.computadora;

        const notaDebito = subtotal > 300 ? subtotal * 0.15 : 0;
        const total = subtotal + notaDebito;

        // 4. Insertar factura
        const resultado = await pool.query(
            `INSERT INTO facturas 
                (usuario_id, subtotal, nota_debito, total, estado, generada_por,
                 consumo_tv, consumo_microondas, consumo_aire, consumo_luces, consumo_computadora) 
             VALUES ($1,$2,$3,$4,'pendiente','cliente',$5,$6,$7,$8,$9) 
             RETURNING *`,
            [usuario_id, subtotal, notaDebito, total,
             consumo.tv || 0, consumo.microondas || 0, consumo.aireAcondicionado || 0, consumo.luces || 0, consumo.computadora || 0]
        );

        // 5. Notificar a Smithers (usuario_id 998) que hay una nueva factura pendiente de pago
        await pool.query(
            'INSERT INTO notificaciones (usuario_id, mensaje) VALUES ($1, $2)',
            [998, `El cliente #${usuario_id} generó una nueva factura por $${total.toFixed(2)}.`]
        );

        res.json(resultado.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/pagar', async (req, res) => {
    const { usuario_id, factura_id, monto } = req.body;
    try {
        await pool.query('INSERT INTO pagos (usuario_id, factura_id, monto) VALUES ($1, $2, $3)', [usuario_id, factura_id, monto]);
        await pool.query("UPDATE facturas SET estado = 'pagada' WHERE id = $1", [factura_id]);
        await pool.query('INSERT INTO notificaciones (usuario_id, mensaje) VALUES (998, $1)', [`Pago de $${monto} recibido del cliente ${usuario_id}.`]);
        res.json({ message: "Pago en revisión." });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/notificaciones/:usuario_id', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM notificaciones WHERE usuario_id = $1 ORDER BY id DESC', [req.params.usuario_id]);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/notificaciones/marcar-leidas/:usuario_id', async (req, res) => {
    try {
        await pool.query('UPDATE notificaciones SET leido = TRUE WHERE usuario_id = $1', [req.params.usuario_id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- DASHBOARD BURNS (ADMINISTRADOR) ---
app.get('/admin/dashboard', async (req, res) => {
    try {
        const usuariosCount = await pool.query(
            "SELECT COUNT(*) FROM usuarios WHERE rol = 'cliente'"
        );
        const facturasCount = await pool.query(
            "SELECT COUNT(*) FROM facturas"
        );

        const ingresosMes = await pool.query(`
            SELECT TO_CHAR(created_at, 'DD/MM') AS dia, SUM(total) AS monto
            FROM facturas
            WHERE estado = 'confirmada'
              AND date_trunc('month', created_at) = date_trunc('month', CURRENT_DATE)
            GROUP BY dia, date_trunc('day', created_at)
            ORDER BY date_trunc('day', created_at)
        `);

        const estados = await pool.query(`
            SELECT estado, COUNT(*) AS cantidad
            FROM facturas
            GROUP BY estado
        `);

        let pendiente = 0, pagada = 0, confirmada = 0;
        estados.rows.forEach(r => {
            if (r.estado === 'pendiente') pendiente = parseInt(r.cantidad);
            if (r.estado === 'pagada') pagada = parseInt(r.cantidad);
            if (r.estado === 'confirmada') confirmada = parseInt(r.cantidad);
        });

        res.json({
            usuariosRegistrados: parseInt(usuariosCount.rows[0].count),
            facturasRealizadas: parseInt(facturasCount.rows[0].count),
            ingresosMes: ingresosMes.rows.map(r => ({ dia: r.dia, monto: parseFloat(r.monto) })),
            estadosPago: { confirmada, pagada, pendiente }
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- LISTA DE CLIENTES (ADMINISTRADOR) ---
app.get('/admin/clientes', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                u.id, u.nombre, u.email,
                c.calle, c.codigo_contrato,
                f.id AS factura_id, f.total, f.estado AS estado_factura
            FROM usuarios u
            LEFT JOIN contratos c ON c.usuario_id = u.id
            LEFT JOIN LATERAL (
                SELECT id, total, estado, created_at
                FROM facturas WHERE usuario_id = u.id
                ORDER BY created_at DESC LIMIT 1
            ) f ON true
            WHERE u.rol = 'cliente'
            ORDER BY u.id
        `);

        const clientes = result.rows.map(r => {
            let estado = 'sin_factura';
            if (r.estado_factura === 'pendiente') estado = 'no_pagado';
            if (r.estado_factura === 'pagada') estado = 'pend_confirmar';
            if (r.estado_factura === 'confirmada') estado = 'pagado';

            return {
                id: r.id, nombre: r.nombre, email: r.email,
                calle: r.calle || 'Sin calle asignada',
                codigo_contrato: r.codigo_contrato,
                factura_id: r.factura_id, total: r.total, estado
            };
        });

        res.json(clientes);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

const PORT = 3000;
app.listen(PORT, () => console.log(`🚀 Servidor Burns Energy activo en puerto ${PORT}`));
// =====================================================================
// VERIFICACIÓN POR CORREO (Nodemailer + Gmail)
// =====================================================================
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    tls: {
        rejectUnauthorized: false
    }
});

const generarCodigo = () => Math.floor(100000 + Math.random() * 900000).toString();

const htmlRegistro = (nombre, codigo) => [
    '<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;background:#0d0b1a;color:#fff;padding:30px;border-radius:10px;">',
    '<h2 style="color:#00f5d4;">BURNS ENERGY</h2>',
    '<p>Hola <b>' + nombre + '</b>, tu codigo de verificacion es:</p>',
    '<div style="font-size:36px;font-weight:bold;letter-spacing:10px;text-align:center;color:#00f5d4;padding:20px;background:#1a1a2e;border-radius:8px;margin:20px 0;">' + codigo + '</div>',
    '<p style="color:#888;">Este codigo expira en 10 minutos.</p>',
    '<p style="color:#888;">Si no solicitaste este codigo, ignora este correo.</p>',
    '</div>'
].join('');

const htmlRecuperacion = (nombre, codigo) => [
    '<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;background:#0d0b1a;color:#fff;padding:30px;border-radius:10px;">',
    '<h2 style="color:#ff9f1c;">BURNS ENERGY - Recuperacion</h2>',
    '<p>Hola <b>' + nombre + '</b>, tu codigo para restablecer la contrasena es:</p>',
    '<div style="font-size:36px;font-weight:bold;letter-spacing:10px;text-align:center;color:#ff9f1c;padding:20px;background:#1a1a2e;border-radius:8px;margin:20px 0;">' + codigo + '</div>',
    '<p style="color:#888;">Este codigo expira en 10 minutos.</p>',
    '<p style="color:#888;">Si no solicitaste este cambio, ignora este correo.</p>',
    '</div>'
].join('');

// --- ENVIAR CÓDIGO AL REGISTRARSE ---
app.post('/auth/enviar-codigo-registro', async (req, res) => {
    const { email, nombre } = req.body;
    try {
        const existe = await pool.query('SELECT id FROM usuarios WHERE email = $1', [email]);
        if (existe.rows[0]) return res.status(400).json({ error: 'Este correo ya esta registrado.' });

        const codigo = generarCodigo();
        const expira = new Date(Date.now() + 10 * 60 * 1000);

        await pool.query('DELETE FROM codigos_verificacion WHERE email = $1', [email]);
        await pool.query(
            'INSERT INTO codigos_verificacion (email, codigo, expira_at, tipo) VALUES ($1, $2, $3, $4)',
            [email, codigo, expira, 'registro']
        );

        await transporter.sendMail({
            from: '"Burns Energy" <' + process.env.EMAIL_USER + '>',
            to: email,
            subject: 'Codigo de verificacion - Burns Energy',
            html: htmlRegistro(nombre, codigo)
        });

        res.json({ success: true, message: 'Codigo enviado al correo.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al enviar el correo.' });
    }
});

// --- VERIFICAR CÓDIGO DE REGISTRO ---
app.post('/auth/verificar-codigo', async (req, res) => {
    const { email, codigo } = req.body;
    try {
        const result = await pool.query(
            "SELECT * FROM codigos_verificacion WHERE email = $1 AND codigo = $2 AND tipo = 'registro' AND usado = FALSE",
            [email, codigo]
        );
        const reg = result.rows[0];
        if (!reg) return res.status(400).json({ error: 'Codigo incorrecto o ya usado.' });
        if (new Date() > new Date(reg.expira_at)) return res.status(400).json({ error: 'El codigo expiro. Solicita uno nuevo.' });

        await pool.query('UPDATE codigos_verificacion SET usado = TRUE WHERE id = $1', [reg.id]);
        res.json({ success: true, verified: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- ENVIAR CÓDIGO PARA RECUPERAR CONTRASEÑA ---
app.post('/auth/recuperar-password', async (req, res) => {
    const { email } = req.body;
    try {
        const usuario = await pool.query('SELECT id, nombre FROM usuarios WHERE email = $1', [email]);
        if (!usuario.rows[0]) return res.status(404).json({ error: 'No existe una cuenta con ese correo.' });

        const codigo = generarCodigo();
        const expira = new Date(Date.now() + 10 * 60 * 1000);

        await pool.query('DELETE FROM codigos_verificacion WHERE email = $1', [email]);
        await pool.query(
            'INSERT INTO codigos_verificacion (email, codigo, expira_at, tipo) VALUES ($1, $2, $3, $4)',
            [email, codigo, expira, 'recuperacion']
        );

        await transporter.sendMail({
            from: '"Burns Energy" <' + process.env.EMAIL_USER + '>',
            to: email,
            subject: 'Recuperacion de contrasena - Burns Energy',
            html: htmlRecuperacion(usuario.rows[0].nombre, codigo)
        });

        res.json({ success: true, message: 'Codigo de recuperacion enviado.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al enviar el correo.' });
    }
});

// --- VERIFICAR CÓDIGO Y CAMBIAR CONTRASEÑA ---
app.post('/auth/verificar-codigo-recuperacion', async (req, res) => {
    const { email, codigo } = req.body;
    try {
        const result = await pool.query(
            "SELECT * FROM codigos_verificacion WHERE email = $1 AND codigo = $2 AND tipo = 'recuperacion' AND usado = FALSE",
            [email, codigo]
        );
        const reg = result.rows[0];
        if (!reg) return res.status(400).json({ error: 'Codigo incorrecto o ya usado.' });
        if (new Date() > new Date(reg.expira_at)) return res.status(400).json({ error: 'El codigo expiro. Solicita uno nuevo.' });
        res.json({ success: true, verified: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/auth/cambiar-password', async (req, res) => {
    const { email, codigo, nueva_password } = req.body;
    try {
        const result = await pool.query(
            "SELECT * FROM codigos_verificacion WHERE email = $1 AND codigo = $2 AND tipo = 'recuperacion' AND usado = FALSE",
            [email, codigo]
        );
        const reg = result.rows[0];
        if (!reg) return res.status(400).json({ error: 'Codigo incorrecto o ya usado.' });
        if (new Date() > new Date(reg.expira_at)) return res.status(400).json({ error: 'El codigo expiro. Solicita uno nuevo.' });

        await pool.query('UPDATE usuarios SET password_hash = $1 WHERE email = $2', [nueva_password, email]);
        await pool.query('UPDATE codigos_verificacion SET usado = TRUE WHERE id = $1', [reg.id]);

        res.json({ success: true, message: 'Contrasena actualizada correctamente.' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});
