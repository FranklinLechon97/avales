const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const ExcelJS = require('exceljs');
const pool = require('../db/pool');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const SLA_MINUTOS = parseInt(process.env.SLA_MINUTOS || '30', 10);

// Carpeta donde se guardan los adjuntos, FUERA de /public para que nadie
// pueda descargarlos sin pasar por la ruta protegida (requiere sesión).
const CARPETA_ADJUNTOS = path.join(__dirname, '..', 'uploads', 'avales');
fs.mkdirSync(CARPETA_ADJUNTOS, { recursive: true });

const TIPOS_PERMITIDOS = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

const storageAdjuntos = multer.diskStorage({
  destination: (req, file, cb) => cb(null, CARPETA_ADJUNTOS),
  filename: (req, file, cb) => {
    const sufijo = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `aval${req.params.id}-${sufijo}${ext}`);
  }
});

const uploadAdjunto = multer({
  storage: storageAdjuntos,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    if (!TIPOS_PERMITIDOS.includes(file.mimetype)) {
      return cb(new Error('Tipo de archivo no permitido. Solo imágenes, PDF o Word.'));
    }
    cb(null, true);
  }
});

function generarNumero(id) {
  return 'AVL-' + String(id).padStart(5, '0');
}

/** Compara hora_asignacion con hora_primer_contacto (mismo día) contra el SLA. */
function calcularCumplimiento(horaAsignacion, horaPrimerContacto) {
  if (!horaAsignacion || !horaPrimerContacto) return null;
  const [h1, m1] = horaAsignacion.split(':').map(Number);
  const [h2, m2] = horaPrimerContacto.split(':').map(Number);
  const minutosAsignacion = h1 * 60 + m1;
  const minutosContacto = h2 * 60 + m2;
  const diferencia = minutosContacto - minutosAsignacion;
  if (diferencia < 0) return 'fuera_de_tiempo'; // contacto antes de la asignación: dato inconsistente, se marca fuera de tiempo
  return diferencia <= SLA_MINUTOS ? 'correcto' : 'fuera_de_tiempo';
}

const SELECT_BASE = `
  SELECT a.*,
         u1.nombre AS asesor_nombre,
         u2.nombre AS asignado_por_nombre
  FROM avales a
  LEFT JOIN usuarios u1 ON u1.id = a.asesor_id
  LEFT JOIN usuarios u2 ON u2.id = a.asignado_por
`;

// GET /api/avales -> lista (filtrada por rol y query params)
router.get('/', async (req, res) => {
  const { estado, asesor_id, fecha_desde, fecha_hasta, cumplimiento } = req.query;
  const condiciones = [];
  const valores = [];

  // Un asesor solo puede ver sus propios avales, sin importar qué pida por query.
  if (req.session.usuarioRol === 'asesor') {
    valores.push(req.session.usuarioId);
    condiciones.push(`a.asesor_id = $${valores.length}`);
  } else if (asesor_id) {
    valores.push(asesor_id);
    condiciones.push(`a.asesor_id = $${valores.length}`);
  }

  if (estado) {
    valores.push(estado);
    condiciones.push(`a.estado_negociacion = $${valores.length}`);
  }
  if (cumplimiento) {
    valores.push(cumplimiento);
    condiciones.push(`a.cumplimiento_atencion = $${valores.length}`);
  }
  if (fecha_desde) {
    valores.push(fecha_desde);
    condiciones.push(`a.fecha >= $${valores.length}`);
  }
  if (fecha_hasta) {
    valores.push(fecha_hasta);
    condiciones.push(`a.fecha <= $${valores.length}`);
  }

  const where = condiciones.length ? 'WHERE ' + condiciones.join(' AND ') : '';

  try {
    const resultado = await pool.query(
      `${SELECT_BASE} ${where} ORDER BY a.creado_en DESC`,
      valores
    );
    return res.json({ avales: resultado.rows });
  } catch (err) {
    console.error('Error al listar avales:', err);
    return res.status(500).json({ error: 'No se pudieron obtener los avales.' });
  }
});

// GET /api/avales/exportar/excel -> descarga el listado (respeta los mismos filtros
// que la lista en pantalla). Solo administrador.


/* ============================================================
   SISTEMA DE ASIGNACIÓN DE AVALES DE CRÉDITO
   REPORTE EXCEL - DISEÑO CORPORATIVO PROFESIONAL
   ============================================================ */

router.get('/exportar/excel', requireRole('administrador'), async (req, res) => {

  const {
    estado,
    asesor_id,
    fecha_desde,
    fecha_hasta,
    cumplimiento
  } = req.query;

  const condiciones = [];
  const valores = [];

  // ==========================================================
  // 1. FILTROS
  // ==========================================================

  if (asesor_id) {
    valores.push(asesor_id);
    condiciones.push(`a.asesor_id = $${valores.length}`);
  }

  if (estado) {
    valores.push(estado);
    condiciones.push(`a.estado_negociacion = $${valores.length}`);
  }

  if (cumplimiento) {
    valores.push(cumplimiento);
    condiciones.push(`a.cumplimiento_atencion = $${valores.length}`);
  }

  if (fecha_desde) {
    valores.push(fecha_desde);
    condiciones.push(`a.fecha >= $${valores.length}`);
  }

  if (fecha_hasta) {
    valores.push(fecha_hasta);
    condiciones.push(`a.fecha <= $${valores.length}`);
  }

  const where = condiciones.length
    ? 'WHERE ' + condiciones.join(' AND ')
    : '';

  try {

    // ==========================================================
    // 2. CONSULTAR POSTGRESQL
    // ==========================================================

    const resultado = await pool.query(
      `${SELECT_BASE} ${where} ORDER BY a.creado_en DESC`,
      valores
    );

    const avales = resultado.rows;

    // ==========================================================
    // 3. CREAR LIBRO EXCEL
    // ==========================================================

    const workbook = new ExcelJS.Workbook();

    workbook.creator = 'Sistema de Avales de Crédito';
    workbook.created = new Date();
    workbook.modified = new Date();

    const hoja = workbook.addWorksheet('Reporte de Avales', {

      views: [{
        state: 'frozen',
        xSplit: 2,
        ySplit: 10,
        activeCell: 'C11',
        showGridLines: false
      }],

      pageSetup: {
        paperSize: 9,
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0
      }

    });

    // ==========================================================
    // 4. PALETA DE COLORES CORPORATIVOS
    // ==========================================================

    const COLOR = {

      azulPrincipal: 'FF063B68',
      azulOscuro: 'FF082C4D',
      azulMedio: 'FF075E9D',
      azulClaro: 'FF008DD2',
      celeste: 'FF00C7EF',

      blanco: 'FFFFFFFF',
      texto: 'FF152D45',
      gris: 'FF61768B',

      fondo: 'FFF0F7FD',
      fondoAlterno: 'FFE4F2FC',
      borde: 'FFC9DFEF',

      verde: 'FFD8F7E5',
      verdeTexto: 'FF087A43',

      rojo: 'FFFFDFE3',
      rojoTexto: 'FFB42336',

      amarillo: 'FFFFF0CB',
      amarilloTexto: 'FF986000'

    };

    // ==========================================================
    // 5. CONFIGURACIÓN DE COLUMNAS
    // ==========================================================

    hoja.columns = [

      { key: 'numero', width: 18 },
      { key: 'fecha', width: 17 },
      { key: 'hora_asignacion', width: 21 },
      { key: 'asesor_nombre', width: 29 },
      { key: 'hora_primer_contacto', width: 23 },
      { key: 'cumplimiento_atencion', width: 26 },
      { key: 'cedula', width: 20 },
      { key: 'calificacion_aval', width: 20 },
      { key: 'cliente', width: 34 },
      { key: 'telefono', width: 20 },
      { key: 'gestor_contact_center', width: 28 },
      { key: 'ciudad', width: 22 },
      { key: 'actividad_economica', width: 29 },
      { key: 'observaciones', width: 45 },
      { key: 'monto', width: 21 },
      { key: 'estado_negociacion', width: 26 },
      { key: 'producto', width: 25 },
      { key: 'fecha_cierre', width: 19 },
      { key: 'hora_cierre', width: 20 },
      { key: 'atencion_exitosa', width: 22 }

    ];

    // ==========================================================
    // 6. FUNCIONES DE DISEÑO
    // ==========================================================

    function pintarRango(rango, color) {

      const [inicio, fin] = rango.split(':');

      const celdaInicio = hoja.getCell(inicio);
      const celdaFin = hoja.getCell(fin);

      for (
        let fila = celdaInicio.row;
        fila <= celdaFin.row;
        fila++
      ) {

        for (
          let columna = celdaInicio.col;
          columna <= celdaFin.col;
          columna++
        ) {

          hoja.getCell(fila, columna).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: color }
          };

        }

      }

    }

    function crearTarjeta(rango, texto, colorFondo, colorTexto) {

      pintarRango(rango, colorFondo);
      hoja.mergeCells(rango);

      const referencia = rango.split(':')[0];
      const celda = hoja.getCell(referencia);

      celda.value = texto;

      celda.font = {
        name: 'Aptos',
        size: 12,
        bold: true,
        color: { argb: colorTexto }
      };

      celda.alignment = {
        horizontal: 'center',
        vertical: 'middle',
        wrapText: true
      };

      celda.border = {
        bottom: {
          style: 'medium',
          color: { argb: COLOR.azulClaro }
        }
      };

    }

    // ==========================================================
    // 7. ENCABEZADO PRINCIPAL
    // ==========================================================

    pintarRango('A1:T3', COLOR.azulOscuro);

    hoja.mergeCells('A1:T2');

    const titulo = hoja.getCell('A1');

    titulo.value =
      'SISTEMA DE ASIGNACIÓN DE AVALES DE CRÉDITO';

    titulo.font = {
      name: 'Aptos Display',
      size: 23,
      bold: true,
      color: { argb: COLOR.blanco }
    };

    titulo.alignment = {
      horizontal: 'center',
      vertical: 'middle'
    };

    hoja.getRow(1).height = 29;
    hoja.getRow(2).height = 29;

    hoja.mergeCells('A3:T3');

    const subtitulo = hoja.getCell('A3');

    subtitulo.value =
      'REPORTE GENERAL DE ASIGNACIONES Y SEGUIMIENTO';

    subtitulo.font = {
      name: 'Aptos',
      size: 14,
      bold: true,
      color: { argb: COLOR.blanco }
    };

    subtitulo.alignment = {
      horizontal: 'center',
      vertical: 'middle'
    };

    subtitulo.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: COLOR.azulMedio }
    };

    hoja.getRow(3).height = 38;

    // Línea decorativa corporativa

    pintarRango('A4:T4', COLOR.celeste);
    hoja.getRow(4).height = 5;

    // ==========================================================
    // 8. INDICADORES DEL REPORTE
    // ==========================================================

    const totalMonto = avales.reduce(
      (suma, aval) => suma + (Number(aval.monto) || 0),
      0
    );

    const exitosos = avales.filter(
      a => String(a.atencion_exitosa || '').toUpperCase() === 'SI'
    ).length;

    const fechaGeneracion = new Date().toLocaleDateString(
      'es-EC',
      {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }
    );

    crearTarjeta(
      'A6:E7',
      `FECHA DE GENERACIÓN\n${fechaGeneracion}`,
      COLOR.fondo,
      COLOR.azulOscuro
    );

    crearTarjeta(
      'F6:J7',
      `TOTAL DE AVALES\n${avales.length}`,
      COLOR.azulMedio,
      COLOR.blanco
    );

    crearTarjeta(
      'K6:O7',
      `MONTO TOTAL\n$ ${totalMonto.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })}`,
      COLOR.fondo,
      COLOR.azulOscuro
    );

    crearTarjeta(
      'P6:T7',
      `ATENCIONES EXITOSAS\n${exitosos}`,
      COLOR.azulMedio,
      COLOR.blanco
    );

    hoja.getRow(5).height = 14;
    hoja.getRow(6).height = 27;
    hoja.getRow(7).height = 27;
    hoja.getRow(8).height = 12;

    // ==========================================================
    // 9. FILTROS APLICADOS
    // ==========================================================

    const filtrosTexto = [

      estado ? `Estado: ${estado}` : null,
      asesor_id ? `Asesor ID: ${asesor_id}` : null,
      cumplimiento ? `Cumplimiento: ${cumplimiento}` : null,
      fecha_desde ? `Desde: ${fecha_desde}` : null,
      fecha_hasta ? `Hasta: ${fecha_hasta}` : null

    ].filter(Boolean).join(' | ');

    pintarRango('A9:T9', COLOR.fondoAlterno);

    hoja.mergeCells('A9:T9');

    const celdaFiltros = hoja.getCell('A9');

    celdaFiltros.value =
      `FILTROS APLICADOS: ${filtrosTexto || 'Todos los registros'}`;

    celdaFiltros.font = {
      name: 'Aptos',
      size: 11,
      bold: true,
      color: { argb: COLOR.azulPrincipal }
    };

    celdaFiltros.alignment = {
      vertical: 'middle',
      horizontal: 'left',
      indent: 1
    };

    hoja.getRow(9).height = 30;

    // ==========================================================
    // 10. ENCABEZADOS DE LA TABLA
    // ==========================================================

    const encabezados = [

      'N.º AVAL',
      'FECHA',
      'HORA DE ASIGNACIÓN',
      'ASESOR ASIGNADO',
      'HORA PRIMER CONTACTO',
      'CUMPLIMIENTO DE ATENCIÓN',
      'CÉDULA',
      'CALIFICACIÓN AVAL',
      'CLIENTE',
      'TELÉFONO',
      'GESTOR CONTACT CENTER',
      'CIUDAD',
      'ACTIVIDAD ECONÓMICA',
      'OBSERVACIONES',
      'MONTO',
      'ESTADO NEGOCIACIÓN',
      'PRODUCTO',
      'FECHA CIERRE',
      'HORA DE CIERRE',
      'ATENCIÓN EXITOSA'

    ];

    const filaEncabezado = hoja.getRow(10);

    filaEncabezado.values = encabezados;
    filaEncabezado.height = 48;

    filaEncabezado.eachCell({ includeEmpty: true }, celda => {

      celda.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: COLOR.azulPrincipal }
      };

      celda.font = {
        name: 'Aptos',
        size: 11,
        bold: true,
        color: { argb: COLOR.blanco }
      };

      celda.alignment = {
        horizontal: 'center',
        vertical: 'middle',
        wrapText: true
      };

      celda.border = {

        bottom: {
          style: 'medium',
          color: { argb: COLOR.celeste }
        },

        right: {
          style: 'thin',
          color: { argb: COLOR.azulMedio }
        }

      };

    });

    // ==========================================================
    // 11. FUNCIONES DE FORMATO
    // ==========================================================

    const fmtFecha = fecha => {

      if (!fecha) return '';

      if (typeof fecha === 'string') {
        const coincidencia = fecha.match(/^\d{4}-\d{2}-\d{2}/);
        if (coincidencia) return coincidencia[0];
      }

      const d = new Date(fecha);

      if (Number.isNaN(d.getTime())) return '';

      return [
        d.getFullYear(),
        String(d.getMonth() + 1).padStart(2, '0'),
        String(d.getDate()).padStart(2, '0')
      ].join('-');

    };

    const fmtHora = hora =>
      hora ? String(hora).slice(0, 5) : '';

    const fmtCumplimiento = valor => {

      if (valor === 'correcto') return 'CORRECTO';

      if (valor === 'fuera_de_tiempo') {
        return 'FUERA DE TIEMPO';
      }

      return 'PENDIENTE';

    };

    // ==========================================================
    // 12. INSERTAR REGISTROS
    // ==========================================================

    avales.forEach((a, indice) => {

      const fila = hoja.addRow({

        numero: a.numero,

        fecha: fmtFecha(a.fecha),

        hora_asignacion: fmtHora(a.hora_asignacion),

        asesor_nombre: a.asesor_nombre || 'SIN ASIGNAR',

        hora_primer_contacto: fmtHora(a.hora_primer_contacto),

        cumplimiento_atencion:
          fmtCumplimiento(a.cumplimiento_atencion),

        cedula: a.cedula ? String(a.cedula) : '',

        calificacion_aval: a.calificacion_aval,

        cliente: a.cliente,

        telefono: a.telefono ? String(a.telefono) : '',

        gestor_contact_center: a.gestor_contact_center,

        ciudad: a.ciudad,

        actividad_economica: a.actividad_economica,

        observaciones: a.observaciones,

        monto:
          a.monto == null || a.monto === ''
            ? null
            : Number(a.monto),

        estado_negociacion: a.estado_negociacion,

        producto: a.producto,

        fecha_cierre: fmtFecha(a.fecha_cierre),

        hora_cierre: fmtHora(a.hora_cierre),

        atencion_exitosa: a.atencion_exitosa

      });

      fila.height = 32;

      // ========================================================
      // FORMATO GENERAL DE CADA REGISTRO
      // ========================================================

      fila.eachCell({ includeEmpty: true }, celda => {

        celda.font = {
          name: 'Aptos',
          size: 11,
          color: { argb: COLOR.texto }
        };

        celda.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: {
            argb: indice % 2 === 0
              ? COLOR.blanco
              : COLOR.fondoAlterno
          }
        };

        celda.alignment = {
          vertical: 'middle',
          horizontal: 'left',
          wrapText: true,
          indent: 1
        };

        celda.border = {

          bottom: {
            style: 'thin',
            color: { argb: COLOR.borde }
          },

          right: {
            style: 'hair',
            color: { argb: COLOR.borde }
          }

        };

      });

      // ========================================================
      // NÚMERO DE AVAL DESTACADO
      // ========================================================

      fila.getCell('numero').font = {
        name: 'Aptos',
        size: 11,
        bold: true,
        color: { argb: COLOR.azulPrincipal }
      };

      // ========================================================
      // COLUMNAS CENTRADAS
      // ========================================================

      [
        'fecha',
        'hora_asignacion',
        'hora_primer_contacto',
        'cumplimiento_atencion',
        'calificacion_aval',
        'fecha_cierre',
        'hora_cierre',
        'atencion_exitosa'
      ].forEach(columna => {

        fila.getCell(columna).alignment = {
          horizontal: 'center',
          vertical: 'middle',
          wrapText: true
        };

      });

      // ========================================================
      // CÉDULA Y TELÉFONO COMO TEXTO
      // ========================================================

      fila.getCell('cedula').numFmt = '@';
      fila.getCell('telefono').numFmt = '@';

      // ========================================================
      // MONTO EN DÓLARES
      // ========================================================

      fila.getCell('monto').numFmt = '"$"#,##0.00';

      fila.getCell('monto').font = {
        name: 'Aptos',
        bold: true,
        size: 11,
        color: { argb: COLOR.azulPrincipal }
      };

      // ========================================================
      // CALIFICACIÓN DE AVAL
      // ========================================================

      const celdaCalificacion =
        fila.getCell('calificacion_aval');

      if (
        a.calificacion_aval !== null &&
        a.calificacion_aval !== undefined &&
        a.calificacion_aval !== ''
      ) {

        celdaCalificacion.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFD8ECFF' }
        };

        celdaCalificacion.font = {
          name: 'Aptos',
          bold: true,
          size: 11,
          color: { argb: COLOR.azulPrincipal }
        };

      }

      // ========================================================
      // CUMPLIMIENTO DE ATENCIÓN
      // ========================================================

      const celdaCumplimiento =
        fila.getCell('cumplimiento_atencion');

      if (a.cumplimiento_atencion === 'correcto') {

        celdaCumplimiento.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: COLOR.verde }
        };

        celdaCumplimiento.font = {
          name: 'Aptos',
          bold: true,
          size: 11,
          color: { argb: COLOR.verdeTexto }
        };

      } else if (
        a.cumplimiento_atencion === 'fuera_de_tiempo'
      ) {

        celdaCumplimiento.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: COLOR.rojo }
        };

        celdaCumplimiento.font = {
          name: 'Aptos',
          bold: true,
          size: 11,
          color: { argb: COLOR.rojoTexto }
        };

      } else {

        celdaCumplimiento.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: COLOR.amarillo }
        };

        celdaCumplimiento.font = {
          name: 'Aptos',
          bold: true,
          size: 11,
          color: { argb: COLOR.amarilloTexto }
        };

      }

      // ========================================================
      // ATENCIÓN EXITOSA
      // ========================================================

      const celdaExitosa = fila.getCell('atencion_exitosa');

      const atencion = String(
        a.atencion_exitosa || ''
      ).toUpperCase();

      if (atencion === 'SI') {

        celdaExitosa.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: COLOR.verde }
        };

        celdaExitosa.font = {
          name: 'Aptos',
          bold: true,
          color: { argb: COLOR.verdeTexto }
        };

      } else if (atencion === 'NO') {

        celdaExitosa.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: COLOR.rojo }
        };

        celdaExitosa.font = {
          name: 'Aptos',
          bold: true,
          color: { argb: COLOR.rojoTexto }
        };

      }

      // ========================================================
      // ESTADO DE NEGOCIACIÓN
      // ========================================================

      const celdaEstado =
        fila.getCell('estado_negociacion');

      const estadoActual = String(
        a.estado_negociacion || ''
      ).toUpperCase();

      if (estadoActual === 'PENDIENTE') {

        celdaEstado.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: COLOR.amarillo }
        };

        celdaEstado.font = {
          name: 'Aptos',
          bold: true,
          color: { argb: COLOR.amarilloTexto }
        };

      } else if (
        estadoActual === 'APROBADO' ||
        estadoActual === 'CERRADO'
      ) {

        celdaEstado.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: COLOR.verde }
        };

        celdaEstado.font = {
          name: 'Aptos',
          bold: true,
          color: { argb: COLOR.verdeTexto }
        };

      }

    });

    // ==========================================================
    // 13. FILTROS AUTOMÁTICOS
    // ==========================================================

    hoja.autoFilter = {

      from: {
        row: 10,
        column: 1
      },

      to: {
        row: 10,
        column: 20
      }

    };

    // ==========================================================
    // 14. CONFIGURACIÓN DE IMPRESIÓN
    // ==========================================================

    hoja.pageSetup.margins = {

      left: 0.25,
      right: 0.25,
      top: 0.5,
      bottom: 0.5,
      header: 0.2,
      footer: 0.2

    };

    hoja.headerFooter.oddFooter =
      'Sistema de Avales de Crédito | Página &P de &N';

    hoja.printTitlesRow = '1:10';

    // ==========================================================
    // 15. DESCARGAR ARCHIVO EXCEL
    // ==========================================================

    const nombreArchivo =
      `reporte_avales_${new Date().toISOString().slice(0, 10)}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${nombreArchivo}"`
    );

    await workbook.xlsx.write(res);

    res.end();

  } catch (err) {

    console.error(
      'Error al exportar avales a Excel:',
      err
    );

    if (!res.headersSent) {

      return res.status(500).json({
        error: 'No se pudo generar el archivo Excel.'
      });

    }

    res.end();

  }

});


// DELETE /api/avales/:id -> solo administrador
router.delete('/:id', requireRole('administrador'), async (req, res) => {
  try {
    const resultado = await pool.query('DELETE FROM avales WHERE id = $1 RETURNING id', [req.params.id]);
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Aval no encontrado.' });
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error('Error al eliminar aval:', err);
    return res.status(500).json({ error: 'No se pudo eliminar el aval.' });
  }
});

// POST /api/avales/:id/adjunto -> sube (o reemplaza) el archivo adjunto de un aval.
// Administrador: cualquier aval. Asesor: solo el suyo.
router.post('/:id/adjunto', uploadAdjunto.single('archivo'), async (req, res, next) => {
  try {
    const actual = await pool.query('SELECT * FROM avales WHERE id = $1', [req.params.id]);
    if (actual.rows.length === 0) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(404).json({ error: 'Aval no encontrado.' });
    }
    const aval = actual.rows[0];

    if (req.session.usuarioRol === 'asesor' && aval.asesor_id !== req.session.usuarioId) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(403).json({ error: 'No tienes acceso a este aval.' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió ningún archivo.' });
    }

    // Borra el adjunto anterior del disco, si existía, antes de guardar el nuevo.
    if (aval.adjunto_nombre_archivo) {
      fs.unlink(path.join(CARPETA_ADJUNTOS, aval.adjunto_nombre_archivo), () => {});
    }

    const resultado = await pool.query(
      `UPDATE avales SET
         adjunto_nombre_original = $1,
         adjunto_nombre_archivo = $2,
         adjunto_mime = $3,
         adjunto_subido_en = NOW(),
         actualizado_en = NOW()
       WHERE id = $4 RETURNING *`,
      [req.file.originalname, req.file.filename, req.file.mimetype, req.params.id]
    );

    return res.status(201).json({ aval: resultado.rows[0] });
  } catch (err) {
    next(err);
  }
});

// Traduce los errores de multer (tipo no permitido, archivo muy grande) a JSON legible.
router.use('/:id/adjunto', (err, req, res, next) => {
  if (req.file) fs.unlink(req.file.path, () => {});
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'El archivo supera el límite de 10 MB.' });
  }
  if (err) {
    return res.status(400).json({ error: err.message || 'No se pudo subir el archivo.' });
  }
  next();
});

// GET /api/avales/:id/adjunto -> descarga/visualiza el archivo adjunto.
router.get('/:id/adjunto', async (req, res) => {
  try {
    const resultado = await pool.query(
      'SELECT asesor_id, adjunto_nombre_original, adjunto_nombre_archivo, adjunto_mime FROM avales WHERE id = $1',
      [req.params.id]
    );
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Aval no encontrado.' });
    }
    const aval = resultado.rows[0];

    if (req.session.usuarioRol === 'asesor' && aval.asesor_id !== req.session.usuarioId) {
      return res.status(403).json({ error: 'No tienes acceso a este aval.' });
    }
    if (!aval.adjunto_nombre_archivo) {
      return res.status(404).json({ error: 'Este aval no tiene ningún adjunto.' });
    }

    const rutaArchivo = path.join(CARPETA_ADJUNTOS, aval.adjunto_nombre_archivo);
    if (!fs.existsSync(rutaArchivo)) {
      return res.status(404).json({ error: 'El archivo ya no existe en el servidor.' });
    }

    res.setHeader('Content-Type', aval.adjunto_mime || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${aval.adjunto_nombre_original}"`);
    fs.createReadStream(rutaArchivo).pipe(res);
  } catch (err) {
    console.error('Error al descargar adjunto:', err);
    return res.status(500).json({ error: 'No se pudo obtener el adjunto.' });
  }
});

// DELETE /api/avales/:id/adjunto -> elimina el adjunto de un aval.
router.delete('/:id/adjunto', async (req, res) => {
  try {
    const actual = await pool.query('SELECT * FROM avales WHERE id = $1', [req.params.id]);
    if (actual.rows.length === 0) {
      return res.status(404).json({ error: 'Aval no encontrado.' });
    }
    const aval = actual.rows[0];

    if (req.session.usuarioRol === 'asesor' && aval.asesor_id !== req.session.usuarioId) {
      return res.status(403).json({ error: 'No tienes acceso a este aval.' });
    }

    if (aval.adjunto_nombre_archivo) {
      fs.unlink(path.join(CARPETA_ADJUNTOS, aval.adjunto_nombre_archivo), () => {});
    }

    const resultado = await pool.query(
      `UPDATE avales SET
         adjunto_nombre_original = NULL,
         adjunto_nombre_archivo = NULL,
         adjunto_mime = NULL,
         adjunto_subido_en = NULL,
         actualizado_en = NOW()
       WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    return res.json({ aval: resultado.rows[0] });
  } catch (err) {
    console.error('Error al eliminar adjunto:', err);
    return res.status(500).json({ error: 'No se pudo eliminar el adjunto.' });
  }
});

module.exports = router;
