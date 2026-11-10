const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../db/pool');

const router = express.Router();

// POST /api/auth/registro  { nombre, email, password }
// El autorregistro siempre crea cuentas con rol "asesor".
// Un administrador puede luego promover a alguien desde /api/usuarios.
router.post('/registro', async (req, res) => {
  const { nombre, email, password } = req.body;

  if (!nombre || !email || !password) {
    return res.status(400).json({ error: 'Nombre, email y contraseña son obligatorios.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
  }

  try {
    const existente = await pool.query('SELECT id FROM usuarios WHERE email = $1', [email]);
    if (existente.rows.length > 0) {
      return res.status(409).json({ error: 'Ya existe una cuenta con ese email.' });
    }

    const hash = await bcrypt.hash(password, 10);
    const resultado = await pool.query(
      `INSERT INTO usuarios (nombre, email, password_hash, rol)
       VALUES ($1, $2, $3, 'asesor')
       RETURNING id, nombre, email, rol`,
      [nombre, email, hash]
    );

    const usuario = resultado.rows[0];
    req.session.usuarioId = usuario.id;
    req.session.usuarioNombre = usuario.nombre;
    req.session.usuarioRol = usuario.rol;

    return res.status(201).json({ usuario });
  } catch (err) {
    console.error('Error en /registro:', err);
    return res.status(500).json({ error: 'Error al crear la cuenta.' });
  }
});

// POST /api/auth/login  { email, password }
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña son obligatorios.' });
  }

  try {
    const resultado = await pool.query(
      'SELECT id, nombre, email, password_hash, rol, activo FROM usuarios WHERE email = $1',
      [email]
    );

    if (resultado.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    const usuario = resultado.rows[0];

    if (!usuario.activo) {
      return res.status(403).json({ error: 'Esta cuenta está deshabilitada. Contacta a un administrador.' });
    }

    const coincide = await bcrypt.compare(password, usuario.password_hash);
    if (!coincide) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    req.session.usuarioId = usuario.id;
    req.session.usuarioNombre = usuario.nombre;
    req.session.usuarioRol = usuario.rol;

    return res.json({ usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol } });
  } catch (err) {
    console.error('Error en /login:', err);
    return res.status(500).json({ error: 'Error al iniciar sesión.' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error al cerrar sesión:', err);
      return res.status(500).json({ error: 'No se pudo cerrar sesión.' });
    }
    res.clearCookie('connect.sid');
    return res.json({ ok: true });
  });
});

// GET /api/auth/sesion
router.get('/sesion', (req, res) => {
  if (req.session && req.session.usuarioId) {
    return res.json({
      autenticado: true,
      usuario: {
        id: req.session.usuarioId,
        nombre: req.session.usuarioNombre,
        rol: req.session.usuarioRol
      }
    });
  }
  return res.json({ autenticado: false });
});

module.exports = router;
