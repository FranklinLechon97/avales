(function () {
  let asesores = [];

  // ---------- Utilidades ----------
  function esc(str) {
    if (str === null || str === undefined) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function fmtFecha(f) {
    if (!f) return '—';
    const d = new Date(f);
    return d.toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
  }

  function fmtHora(h) {
    return h ? h.slice(0, 5) : '—';
  }

  function fmtMonto(m) {
    if (m === null || m === undefined || m === '') return '—';
    return Number(m).toLocaleString('es-EC', { style: 'currency', currency: 'USD' });
  }

  function showMsg(el, text, tipo) {
    el.textContent = text;
    el.className = 'msg show ' + tipo;
    setTimeout(() => { el.className = 'msg'; }, 5000);
  }

  function barraClase(pct) {
    if (pct >= 70) return '';
    if (pct >= 40) return 'mid';
    return 'low';
  }

  // ---------- Sesión ----------
  async function cargarSesion() {
    const res = await fetch('/api/auth/sesion', { headers: { Accept: 'application/json' } });
    const data = await res.json();
    if (!data.autenticado) { window.location.href = '/login.html'; return; }
    if (data.usuario.rol !== 'administrador') { window.location.href = '/asesor.html'; return; }
    document.getElementById('whoName').textContent = data.usuario.nombre;
  }

  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login.html';
  });

  // ---------- Pestañas ----------
  document.getElementById('tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-panel]');
    if (!btn) return;
    [...document.querySelectorAll('#tabs button')].forEach(b => b.classList.toggle('active', b === btn));
    [...document.querySelectorAll('.panel')].forEach(p => p.classList.toggle('active', p.id === btn.dataset.panel));
    if (btn.dataset.panel === 'panelReportes') cargarReportes();
    if (btn.dataset.panel === 'panelUsuarios') cargarUsuarios();
  });

  // ---------- Asesores (para los selectores) ----------
  async function cargarAsesores() {
    const res = await fetch('/api/usuarios?rol=asesor', { headers: { Accept: 'application/json' } });
    if (!res.ok) return;
    const data = await res.json();
    asesores = data.usuarios.filter(u => u.activo);

    const opciones = asesores.map(a => `<option value="${a.id}">${esc(a.nombre)}</option>`).join('');
    document.getElementById('asesor_id').innerHTML = '<option value="">Sin asignar</option>' + opciones;
    document.getElementById('editAsesor').innerHTML = '<option value="">Sin asignar</option>' + opciones;
    document.getElementById('fAsesor').innerHTML = '<option value="">Todos</option>' + opciones;
  }

  // ---------- Lista de avales ----------
  function construirQuery() {
    const params = new URLSearchParams();
    const asesor = document.getElementById('fAsesor').value;
    const estado = document.getElementById('fEstado').value;
    const cumpl = document.getElementById('fCumplimiento').value;
    const desde = document.getElementById('fDesde').value;
    const hasta = document.getElementById('fHasta').value;
    if (asesor) params.set('asesor_id', asesor);
    if (estado) params.set('estado', estado);
    if (cumpl) params.set('cumplimiento', cumpl);
    if (desde) params.set('fecha_desde', desde);
    if (hasta) params.set('fecha_hasta', hasta);
    const q = params.toString();
    return q ? '?' + q : '';
  }

  async function cargarAvales() {
    const cuerpo = document.getElementById('cuerpoAvales');
    cuerpo.innerHTML = '<tr><td colspan="19"><div class="loading">Cargando avales…</div></td></tr>';
    try {
      const res = await fetch('/api/avales' + construirQuery(), { headers: { Accept: 'application/json' } });
      if (res.status === 401) { window.location.href = '/login.html'; return; }
      const data = await res.json();
      renderAvales(data.avales || []);
    } catch (err) {
      cuerpo.innerHTML = '<tr><td colspan="19"><div class="empty">No se pudieron cargar los avales.</div></td></tr>';
    }
  }

  function badgeCumplimiento(c) {
    if (c === 'correcto') return '<span class="badge ok">Correcto</span>';
    if (c === 'fuera_de_tiempo') return '<span class="badge bad">Fuera de tiempo</span>';
    return '<span class="badge neutral">Sin contactar</span>';
  }

  function badgeExitosa(v) {
    if (v === 'SI') return '<span class="badge ok">SI</span>';
    if (v === 'NO') return '<span class="badge bad">NO</span>';
    return '<span class="badge neutral">—</span>';
  }

  function renderAvales(avales) {
    const cuerpo = document.getElementById('cuerpoAvales');
    if (avales.length === 0) {
      cuerpo.innerHTML = '<tr><td colspan="19"><div class="empty">No hay avales que coincidan con el filtro.</div></td></tr>';
      return;
    }
    cuerpo.innerHTML = avales.map(a => `
      <tr>
        <td class="mono">${esc(a.numero)}</td>
        <td>${fmtFecha(a.fecha)}</td>
        <td class="mono">${fmtHora(a.hora_asignacion)}</td>
        <td>${a.asesor_nombre ? esc(a.asesor_nombre) : '<span class="badge warn">Sin asignar</span>'}</td>
        <td class="mono">${fmtHora(a.hora_primer_contacto)}</td>
        <td>${badgeCumplimiento(a.cumplimiento_atencion)}</td>
        <td class="mono">${esc(a.cedula)}</td>
        <td class="num">${a.calificacion_aval ?? '—'}</td>
        <td>${esc(a.cliente)}</td>
        <td class="mono">${esc(a.telefono)}</td>
        <td>${esc(a.ciudad)}</td>
        <td>${esc(a.actividad_economica)}</td>
        <td class="num">${fmtMonto(a.monto)}</td>
        <td><span class="badge info">${esc(a.estado_negociacion)}</span></td>
        <td>${esc(a.producto)}</td>
        <td>${fmtFecha(a.fecha_cierre)}</td>
        <td>${badgeExitosa(a.atencion_exitosa)}</td>
        <td>${a.adjunto_nombre_archivo
          ? `<a href="/api/avales/${a.id}/adjunto" target="_blank" class="badge info" style="text-decoration:none;">Ver</a>`
          : '<span class="badge neutral">—</span>'}</td>
        <td style="white-space:nowrap;">
          <button class="btn-sm" onclick="window.__editarAval(${a.id})">Editar</button>
          <button class="btn-ghost" onclick="window.__eliminarAval(${a.id})">Eliminar</button>
        </td>
      </tr>
    `).join('');
  }

  document.getElementById('btnFiltrar').addEventListener('click', cargarAvales);
  document.getElementById('btnLimpiar').addEventListener('click', () => {
    ['fAsesor', 'fEstado', 'fCumplimiento', 'fDesde', 'fHasta'].forEach(id => { document.getElementById(id).value = ''; });
    cargarAvales();
  });

  document.getElementById('btnExportarExcel').addEventListener('click', () => {
    // Navegación directa (no fetch): así el navegador maneja la descarga del
    // archivo solo, y la cookie de sesión viaja igual porque es mismo origen.
    window.location.href = '/api/avales/exportar/excel' + construirQuery();
  });

  // ---------- Crear aval ----------
  document.getElementById('formAval').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('formMsg');
    const payload = {
      fecha: document.getElementById('fecha').value || null,
      hora_asignacion: document.getElementById('hora_asignacion').value,
      asesor_id: document.getElementById('asesor_id').value || null,
      cedula: document.getElementById('cedula').value.trim(),
      calificacion_aval: document.getElementById('calificacion_aval').value || null,
      cliente: document.getElementById('cliente').value.trim(),
      telefono: document.getElementById('telefono').value.trim(),
      gestor_contact_center: document.getElementById('gestor_contact_center').value.trim(),
      ciudad: document.getElementById('ciudad').value.trim(),
      actividad_economica: document.getElementById('actividad_economica').value || null,
      monto: document.getElementById('monto').value || null,
      producto: document.getElementById('producto').value || null,
      estado_negociacion: document.getElementById('estado_negociacion').value,
      observaciones: document.getElementById('observaciones').value.trim()
    };

    if (!payload.hora_asignacion || !payload.cedula || !payload.cliente) {
      showMsg(msg, 'Hora de asignación, cédula y cliente son obligatorios.', 'error');
      return;
    }

    try {
      const res = await fetch('/api/avales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) { showMsg(msg, data.error || 'No se pudo registrar.', 'error'); return; }
      showMsg(msg, 'Aval ' + data.aval.numero + ' registrado correctamente.', 'ok');
      e.target.reset();
      cargarAvales();
    } catch (err) {
      showMsg(msg, 'Error de conexión con el servidor.', 'error');
    }
  });

  // ---------- Modal de edición / asignación ----------
  const modalBg = document.getElementById('modalBg');

  window.__editarAval = async function (id) {
    try {
      const res = await fetch('/api/avales/' + id, { headers: { Accept: 'application/json' } });
      const data = await res.json();
      if (!res.ok) return;
      const a = data.aval;
      document.getElementById('editId').value = a.id;
      document.getElementById('modalTitulo').textContent = 'Aval ' + a.numero + ' — ' + a.cliente;
      document.getElementById('editAsesor').value = a.asesor_id || '';
      document.getElementById('editHoraContacto').value = a.hora_primer_contacto ? a.hora_primer_contacto.slice(0, 5) : '';
      document.getElementById('editEstado').value = a.estado_negociacion || 'PENDIENTE';
      document.getElementById('editFechaCierre').value = a.fecha_cierre ? a.fecha_cierre.slice(0, 10) : '';
      document.getElementById('editHoraCierre').value = a.hora_cierre ? a.hora_cierre.slice(0, 5) : '';
      document.getElementById('editExitosa').value = a.atencion_exitosa || '';
      document.getElementById('editMonto').value = a.monto || '';
      document.getElementById('editObservaciones').value = a.observaciones || '';
      modalBg.classList.add('show');
    } catch (err) { /* silencio */ }
  };

  document.getElementById('btnCancelarModal').addEventListener('click', () => modalBg.classList.remove('show'));
  modalBg.addEventListener('click', (e) => { if (e.target === modalBg) modalBg.classList.remove('show'); });

  document.getElementById('formEditar').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('editId').value;
    const msg = document.getElementById('editMsg');
    const asesorId = document.getElementById('editAsesor').value;

    try {
      // 1) Asignación de asesor (endpoint dedicado)
      if (asesorId) {
        await fetch('/api/avales/' + id + '/asignar', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ asesor_id: Number(asesorId) })
        });
      }

      // 2) Resto de campos
      const res = await fetch('/api/avales/' + id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          hora_primer_contacto: document.getElementById('editHoraContacto').value || null,
          estado_negociacion: document.getElementById('editEstado').value,
          fecha_cierre: document.getElementById('editFechaCierre').value || null,
          hora_cierre: document.getElementById('editHoraCierre').value || null,
          atencion_exitosa: document.getElementById('editExitosa').value || null,
          monto: document.getElementById('editMonto').value || null,
          observaciones: document.getElementById('editObservaciones').value.trim()
        })
      });
      const data = await res.json();
      if (!res.ok) { showMsg(msg, data.error || 'No se pudo guardar.', 'error'); return; }
      modalBg.classList.remove('show');
      cargarAvales();
    } catch (err) {
      showMsg(msg, 'Error de conexión con el servidor.', 'error');
    }
  });

  window.__eliminarAval = async function (id) {
    if (!confirm('¿Eliminar este aval? Esta acción no se puede deshacer.')) return;
    await fetch('/api/avales/' + id, { method: 'DELETE', headers: { Accept: 'application/json' } });
    cargarAvales();
  };

  // ---------- Reportes ----------
  async function cargarReportes() {
    // Resumen
    try {
      const res = await fetch('/api/reportes/resumen', { headers: { Accept: 'application/json' } });
      const r = await res.json();
      document.getElementById('statsResumen').innerHTML = `
        <div class="stat"><div class="num">${r.total_avales}</div><div class="lbl">Avales registrados</div></div>
        <div class="stat accent-ok"><div class="num">${r.atenciones_exitosas}</div><div class="lbl">Atenciones exitosas</div></div>
        <div class="stat accent-ok"><div class="num">${r.tasa_exito}%</div><div class="lbl">Tasa de éxito</div></div>
        <div class="stat accent-teal"><div class="num">${r.a_tiempo}</div><div class="lbl">Contactados a tiempo</div></div>
        <div class="stat accent-teal"><div class="num">${r.tasa_cumplimiento}%</div><div class="lbl">Cumplimiento de SLA</div></div>
        <div class="stat accent-amber"><div class="num">${r.sin_asignar}</div><div class="lbl">Sin asignar</div></div>
        <div class="stat accent-danger"><div class="num">${r.pendientes_cierre}</div><div class="lbl">Pendientes de cierre</div></div>
      `;
    } catch (err) {
      document.getElementById('statsResumen').innerHTML = '<div class="empty" style="grid-column:1/-1;">No se pudieron cargar las estadísticas.</div>';
    }

    // Por asesor
    try {
      const res = await fetch('/api/reportes/por-asesor', { headers: { Accept: 'application/json' } });
      const data = await res.json();
      const cuerpo = document.getElementById('cuerpoPorAsesor');
      if (!data.asesores || data.asesores.length === 0) {
        cuerpo.innerHTML = '<tr><td colspan="10"><div class="empty">No hay asesores registrados.</div></td></tr>';
      } else {
        cuerpo.innerHTML = data.asesores.map(a => `
          <tr>
            <td><b>${esc(a.asesor_nombre)}</b></td>
            <td class="num">${a.total_asignados}</td>
            <td class="num">${a.a_tiempo}</td>
            <td class="num">${a.fuera_de_tiempo}</td>
            <td class="num">${a.sin_contactar}</td>
            <td>
              <div style="display:flex; align-items:center; gap:8px;">
                <div class="bar ${barraClase(a.tasa_cumplimiento)}" style="flex:1;"><span style="width:${a.tasa_cumplimiento}%"></span></div>
                <span class="mono" style="font-size:0.78rem;">${a.tasa_cumplimiento}%</span>
              </div>
            </td>
            <td class="num">${a.exitosos}</td>
            <td class="num">${a.no_exitosos}</td>
            <td class="num">${a.pendientes}</td>
            <td>
              <div style="display:flex; align-items:center; gap:8px;">
                <div class="bar ${barraClase(a.tasa_exito)}" style="flex:1;"><span style="width:${a.tasa_exito}%"></span></div>
                <span class="mono" style="font-size:0.78rem;">${a.tasa_exito}%</span>
              </div>
            </td>
          </tr>
        `).join('');
      }
    } catch (err) { /* silencio */ }

    // Por estado
    try {
      const res = await fetch('/api/reportes/por-estado', { headers: { Accept: 'application/json' } });
      const data = await res.json();
      const cuerpo = document.getElementById('cuerpoPorEstado');
      const total = (data.estados || []).reduce((s, e) => s + e.total, 0);
      if (!data.estados || data.estados.length === 0) {
        cuerpo.innerHTML = '<tr><td colspan="3"><div class="empty">Sin datos.</div></td></tr>';
      } else {
        cuerpo.innerHTML = data.estados.map(e => {
          const pct = total ? Number((e.total / total * 100).toFixed(1)) : 0;
          return `
            <tr>
              <td><span class="badge info">${esc(e.estado_negociacion)}</span></td>
              <td class="num">${e.total}</td>
              <td>
                <div style="display:flex; align-items:center; gap:8px;">
                  <div class="bar" style="flex:1;"><span style="width:${pct}%; background:var(--teal);"></span></div>
                  <span class="mono" style="font-size:0.78rem;">${pct}%</span>
                </div>
              </td>
            </tr>`;
        }).join('');
      }
    } catch (err) { /* silencio */ }
  }

  document.getElementById('btnRefrescarReportes').addEventListener('click', cargarReportes);

  // ---------- Usuarios ----------
  async function cargarUsuarios() {
    const cuerpo = document.getElementById('cuerpoUsuarios');
    try {
      const res = await fetch('/api/usuarios', { headers: { Accept: 'application/json' } });
      const data = await res.json();
      if (!data.usuarios || data.usuarios.length === 0) {
        cuerpo.innerHTML = '<tr><td colspan="5"><div class="empty">Sin usuarios.</div></td></tr>';
        return;
      }
      cuerpo.innerHTML = data.usuarios.map(u => `
        <tr>
          <td><b>${esc(u.nombre)}</b></td>
          <td class="mono">${esc(u.email)}</td>
          <td><span class="badge ${u.rol === 'administrador' ? 'warn' : 'info'}">${u.rol}</span></td>
          <td>${u.activo ? '<span class="badge ok">Activo</span>' : '<span class="badge bad">Inactivo</span>'}</td>
          <td style="white-space:nowrap;">
            <button class="btn-sm" onclick="window.__cambiarRol(${u.id}, '${u.rol === 'administrador' ? 'asesor' : 'administrador'}')">
              Cambiar a ${u.rol === 'administrador' ? 'asesor' : 'admin'}
            </button>
            <button class="btn-ghost" onclick="window.__toggleActivo(${u.id}, ${!u.activo})">
              ${u.activo ? 'Desactivar' : 'Activar'}
            </button>
          </td>
        </tr>
      `).join('');
    } catch (err) {
      cuerpo.innerHTML = '<tr><td colspan="5"><div class="empty">No se pudieron cargar los usuarios.</div></td></tr>';
    }
  }

  window.__cambiarRol = async function (id, rol) {
    await fetch('/api/usuarios/' + id + '/rol', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ rol })
    });
    cargarUsuarios();
    cargarAsesores();
  };

  window.__toggleActivo = async function (id, activo) {
    await fetch('/api/usuarios/' + id + '/activo', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ activo })
    });
    cargarUsuarios();
    cargarAsesores();
  };

  document.getElementById('formUsuario').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('usuarioMsg');
    const payload = {
      nombre: document.getElementById('uNombre').value.trim(),
      email: document.getElementById('uEmail').value.trim(),
      password: document.getElementById('uPassword').value,
      rol: document.getElementById('uRol').value
    };
    if (!payload.nombre || !payload.email || !payload.password) {
      showMsg(msg, 'Completa todos los campos.', 'error');
      return;
    }
    try {
      const res = await fetch('/api/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) { showMsg(msg, data.error || 'No se pudo crear.', 'error'); return; }
      showMsg(msg, 'Usuario creado correctamente.', 'ok');
      e.target.reset();
      cargarUsuarios();
      cargarAsesores();
    } catch (err) {
      showMsg(msg, 'Error de conexión con el servidor.', 'error');
    }
  });

  // ======================================================
  // GENERAR PDF - LISTADO GENERAL DE USUARIOS
  // ======================================================

  async function generarPDFUsuarios() {

    try {

      const respuesta = await fetch(
        '/api/reportes/usuarios/pdf',
        {
          method: 'GET',
          credentials: 'same-origin'
        }
      );

      if (!respuesta.ok) {
        throw new Error('No se pudo generar el PDF');
      }

      const archivo = await respuesta.blob();

      const url = window.URL.createObjectURL(archivo);

      const enlace = document.createElement('a');

      enlace.href = url;

      enlace.download = 'reporte_usuarios.pdf';

      document.body.appendChild(enlace);

      enlace.click();

      enlace.remove();

      setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 1000);

    } catch (error) {

      console.error('Error al generar PDF:', error);

      alert('No se pudo generar el reporte PDF de usuarios.');

    }

  }

  // Permitir ejecutar desde el botón HTML
  window.generarPDFUsuarios = generarPDFUsuarios;

  // ---------- Arranque ----------
  cargarSesion().then(() => {
    cargarAsesores().then(cargarAvales);
  });
})();

