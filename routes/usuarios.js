const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../db/pool');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

// Todas las rutas de este archivo son solo para administradores.
router.use(requireRole('administrador'));

// GET /api/usuarios?rol=asesor -> lista de usuarios (para el selector de asignación)
router.get('/', async (req, res) => {
  const { rol } = req.query;
  try {
    let resultado;
    if (rol && ['administrador', 'asesor'].includes(rol)) {
      resultado = await pool.query(
        'SELECT id, nombre, email, rol, activo, creado_en FROM usuarios WHERE rol = $1 ORDER BY nombre',
        [rol]
      );
    } else {
      resultado = await pool.query(
        'SELECT id, nombre, email, rol, activo, creado_en FROM usuarios ORDER BY nombre'
      );
    }
    return res.json({ usuarios: resultado.rows });
  } catch (err) {
    console.error('Error al listar usuarios:', err);
    return res.status(500).json({ error: 'No se pudieron obtener los usuarios.' });
  }
});

// POST /api/usuarios -> crear usuario (asesor o administrador) directamente
router.post('/', async (req, res) => {
  const { nombre, email, password, rol } = req.body;

  if (!nombre || !email || !password || !rol) {
    return res.status(400).json({ error: 'Nombre, email, contraseña y rol son obligatorios.' });
  }
  if (!['administrador', 'asesor'].includes(rol)) {
    return res.status(400).json({ error: 'Rol inválido.' });
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
       VALUES ($1, $2, $3, $4)
       RETURNING id, nombre, email, rol, activo, creado_en`,
      [nombre, email, hash, rol]
    );

    return res.status(201).json({ usuario: resultado.rows[0] });
  } catch (err) {
    console.error('Error al crear usuario:', err);
    return res.status(500).json({ error: 'No se pudo crear el usuario.' });
  }
});

// PATCH /api/usuarios/:id/rol -> cambiar rol
router.patch('/:id/rol', async (req, res) => {
  const { rol } = req.body;
  if (!['administrador', 'asesor'].includes(rol)) {
    return res.status(400).json({ error: 'Rol inválido.' });
  }
  try {
    const resultado = await pool.query(
      'UPDATE usuarios SET rol = $1 WHERE id = $2 RETURNING id, nombre, email, rol',
      [rol, req.params.id]
    );
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }
    return res.json({ usuario: resultado.rows[0] });
  } catch (err) {
    console.error('Error al cambiar rol:', err);
    return res.status(500).json({ error: 'No se pudo cambiar el rol.' });
  }
});

// PATCH /api/usuarios/:id/activo -> activar/desactivar cuenta
router.patch('/:id/activo', async (req, res) => {
  const { activo } = req.body;
  try {
    const resultado = await pool.query(
      'UPDATE usuarios SET activo = $1 WHERE id = $2 RETURNING id, nombre, email, rol, activo',
      [Boolean(activo), req.params.id]
    );
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }
    return res.json({ usuario: resultado.rows[0] });
  } catch (err) {
    console.error('Error al cambiar estado del usuario:', err);
    return res.status(500).json({ error: 'No se pudo actualizar el usuario.' });
  }
});

module.exports = router;
