const express = require('express');
const pool = require('../db/pool');
const { requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireRole('administrador'));

// GET /api/reportes/resumen -> tarjetas globales
router.get('/resumen', async (req, res) => {
  try {
    const total = await pool.query('SELECT COUNT(*)::int AS total FROM avales');
    const exitosos = await pool.query(
      "SELECT COUNT(*)::int AS total FROM avales WHERE atencion_exitosa = 'SI'"
    );
    const aTiempo = await pool.query(
      "SELECT COUNT(*)::int AS total FROM avales WHERE cumplimiento_atencion = 'correcto'"
    );
    const conRespuesta = await pool.query(
      "SELECT COUNT(*)::int AS total FROM avales WHERE cumplimiento_atencion IS NOT NULL"
    );
    const sinAsignar = await pool.query(
      'SELECT COUNT(*)::int AS total FROM avales WHERE asesor_id IS NULL'
    );
    const pendientes = await pool.query(
      "SELECT COUNT(*)::int AS total FROM avales WHERE fecha_cierre IS NULL"
    );

    const totalN = total.rows[0].total;
    const conRespuestaN = conRespuesta.rows[0].total;

    return res.json({
      total_avales: totalN,
      atenciones_exitosas: exitosos.rows[0].total,
      tasa_exito: totalN ? Number((exitosos.rows[0].total / totalN * 100).toFixed(1)) : 0,
      a_tiempo: aTiempo.rows[0].total,
      tasa_cumplimiento: conRespuestaN ? Number((aTiempo.rows[0].total / conRespuestaN * 100).toFixed(1)) : 0,
      sin_asignar: sinAsignar.rows[0].total,
      pendientes_cierre: pendientes.rows[0].total
    });
  } catch (err) {
    console.error('Error en /reportes/resumen:', err);
    return res.status(500).json({ error: 'No se pudo calcular el resumen.' });
  }
});

// GET /api/reportes/por-asesor -> listado de atención por asesor
router.get('/por-asesor', async (req, res) => {
  try {
    const resultado = await pool.query(`
      SELECT
        u.id AS asesor_id,
        u.nombre AS asesor_nombre,
        COUNT(a.id)::int AS total_asignados,
        COUNT(a.id) FILTER (WHERE a.cumplimiento_atencion = 'correcto')::int AS a_tiempo,
        COUNT(a.id) FILTER (WHERE a.cumplimiento_atencion = 'fuera_de_tiempo')::int AS fuera_de_tiempo,
        COUNT(a.id) FILTER (WHERE a.hora_primer_contacto IS NULL)::int AS sin_contactar,
        COUNT(a.id) FILTER (WHERE a.atencion_exitosa = 'SI')::int AS exitosos,
        COUNT(a.id) FILTER (WHERE a.atencion_exitosa = 'NO')::int AS no_exitosos,
        COUNT(a.id) FILTER (WHERE a.fecha_cierre IS NULL)::int AS pendientes
      FROM usuarios u
      LEFT JOIN avales a ON a.asesor_id = u.id
      WHERE u.rol = 'asesor'
      GROUP BY u.id, u.nombre
      ORDER BY total_asignados DESC, u.nombre
    `);

    const filas = resultado.rows.map((r) => ({
      ...r,
      tasa_exito: r.total_asignados
        ? Number((r.exitosos / r.total_asignados * 100).toFixed(1))
        : 0,
      tasa_cumplimiento: (r.a_tiempo + r.fuera_de_tiempo)
        ? Number((r.a_tiempo / (r.a_tiempo + r.fuera_de_tiempo) * 100).toFixed(1))
        : 0
    }));

    return res.json({ asesores: filas });
  } catch (err) {
    console.error('Error en /reportes/por-asesor:', err);
    return res.status(500).json({ error: 'No se pudo generar el listado por asesor.' });
  }
});

// GET /api/reportes/por-estado -> distribución por estado de negociación
router.get('/por-estado', async (req, res) => {
  try {
    const resultado = await pool.query(`
      SELECT estado_negociacion, COUNT(*)::int AS total
      FROM avales
      GROUP BY estado_negociacion
      ORDER BY total DESC
    `);
    return res.json({ estados: resultado.rows });
  } catch (err) {
    console.error('Error en /reportes/por-estado:', err);
    return res.status(500).json({ error: 'No se pudo generar el reporte por estado.' });
  }
});

module.exports = router;
