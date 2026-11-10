
const express = require('express');
const PDFDocument = require('pdfkit');
const pool = require('../db/pool');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);
router.use(requireRole('administrador'));

// =============================================
// GENERAR PDF DE USUARIOS
// =============================================

router.get('/usuarios/pdf', async (req, res) => {

  try {

    const resultado = await pool.query(`
      SELECT nombre, email, rol, activo
      FROM usuarios
      ORDER BY nombre ASC
    `);

    const usuarios = resultado.rows;

    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: 40
    });

    res.setHeader('Content-Type', 'application/pdf');

    res.setHeader(
      'Content-Disposition',
      'attachment; filename="reporte_usuarios.pdf"'
    );

    doc.pipe(res);

    // TÍTULO
    doc.rect(0, 0, doc.page.width, 100)
      .fill('#073B63');

    doc.fillColor('#FFFFFF')
      .font('Helvetica-Bold')
      .fontSize(18)
      .text(
        'SISTEMA DE ASIGNACIÓN DE AVALES DE CRÉDITO',
        40, 25,
        { align: 'center' }
      );

    doc.fontSize(12)
      .text(
        'REPORTE GENERAL DE USUARIOS',
        40, 60,
        { align: 'center' }
      );

    // INFORMACIÓN
    doc.fillColor('#073B63')
      .fontSize(10)
      .text(
        `Fecha: ${new Date().toLocaleDateString('es-EC')}`,
        40, 120
      );

    doc.text(
      `Total de usuarios: ${usuarios.length}`,
      620, 120
    );

    // ENCABEZADOS
    const columnas = [
      { titulo: 'NOMBRE', x: 45, ancho: 170 },
      { titulo: 'CORREO', x: 215, ancho: 300 },
      { titulo: 'PERFIL', x: 515, ancho: 140 },
      { titulo: 'ESTADO', x: 655, ancho: 130 }
    ];

    function dibujarEncabezado(y) {

      doc.rect(40, y, 750, 32)
        .fill('#087FA8');

      columnas.forEach(col => {

        doc.fillColor('#FFFFFF')
          .font('Helvetica-Bold')
          .fontSize(9)
          .text(
            col.titulo,
            col.x,
            y + 10,
            { width: col.ancho - 10 }
          );

      });

    }

    let y = 165;

    dibujarEncabezado(y);

    y += 32;

    // REGISTROS
    usuarios.forEach((usuario, indice) => {

      if (y + 34 > doc.page.height - 45) {
        doc.addPage();
        y = 50;
        dibujarEncabezado(y);
        y += 32;
      }

      doc.rect(40, y, 750, 34)
        .fill(
          indice % 2 === 0
            ? '#FFFFFF'
            : '#EAF4FA'
        );

      const datos = [
        usuario.nombre || '',
        usuario.email || '',
        usuario.rol || '',
        usuario.activo ? 'Activo' : 'Inactivo'
      ];

      columnas.forEach((col, i) => {

        doc.fillColor('#173A55')
          .font('Helvetica')
          .fontSize(9)
          .text(
            String(datos[i]),
            col.x,
            y + 11,
            {
              width: col.ancho - 12,
              height: 16,
              ellipsis: true
            }
          );

      });

      y += 34;

    });

    doc.end();

  } catch (error) {

    console.error('Error al generar PDF:', error);

    if (!res.headersSent) {
      return res.status(500).json({
        error: 'No se pudo generar el PDF'
      });
    }

    res.end();

  }

});

module.exports = router;
