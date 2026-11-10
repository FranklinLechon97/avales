(function () {
  let misAvales = [];

  function esc(str) {
    if (str === null || str === undefined) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
  function fmtFecha(f) {
    if (!f) return '—';
    return new Date(f).toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
  }
  function fmtHora(h) { return h ? h.slice(0, 5) : '—'; }
  function fmtMonto(m) {
    if (m === null || m === undefined || m === '') return '—';
    return Number(m).toLocaleString('es-EC', { style: 'currency', currency: 'USD' });
  }
  function showMsg(el, text, tipo) {
    el.textContent = text;
    el.className = 'msg show ' + tipo;
    setTimeout(() => { el.className = 'msg'; }, 5000);
  }

  // ---------- Sesión ----------
  async function cargarSesion() {
    const res = await fetch('/api/auth/sesion', { headers: { Accept: 'application/json' } });
    const data = await res.json();
    if (!data.autenticado) { window.location.href = '/login.html'; return; }
    document.getElementById('whoName').textContent = data.usuario.nombre;
  }

  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login.html';
  });

  // ---------- Avales ----------
  function construirQuery() {
    const params = new URLSearchParams();
    const estado = document.getElementById('fEstado').value;
    const cumpl = document.getElementById('fCumplimiento').value;
    if (estado) params.set('estado', estado);
    if (cumpl) params.set('cumplimiento', cumpl);
    const q = params.toString();
    return q ? '?' + q : '';
  }

  async function cargarAvales() {
    const cuerpo = document.getElementById('cuerpoAvales');
    cuerpo.innerHTML = '<tr><td colspan="18"><div class="loading">Cargando tus avales…</div></td></tr>';
    try {
      // El backend ya limita automáticamente los resultados al asesor de la sesión.
      const res = await fetch('/api/avales' + construirQuery(), { headers: { Accept: 'application/json' } });
      if (res.status === 401) { window.location.href = '/login.html'; return; }
      const data = await res.json();
      misAvales = data.avales || [];
      render();
      renderStats();
    } catch (err) {
      cuerpo.innerHTML = '<tr><td colspan="18"><div class="empty">No se pudieron cargar tus avales.</div></td></tr>';
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

  function renderStats() {
    const total = misAvales.length;
    const sinContactar = misAvales.filter(a => !a.hora_primer_contacto).length;
    const aTiempo = misAvales.filter(a => a.cumplimiento_atencion === 'correcto').length;
    const conContacto = misAvales.filter(a => a.cumplimiento_atencion).length;
    const exitosos = misAvales.filter(a => a.atencion_exitosa === 'SI').length;
    const pendientes = misAvales.filter(a => !a.fecha_cierre).length;
    const cumplimiento = conContacto ? Math.round(aTiempo / conContacto * 100) : 0;

    document.getElementById('misStats').innerHTML = `
      <div class="stat"><div class="num">${total}</div><div class="lbl">Avales asignados</div></div>
      <div class="stat accent-danger"><div class="num">${sinContactar}</div><div class="lbl">Sin contactar</div></div>
      <div class="stat accent-teal"><div class="num">${cumplimiento}%</div><div class="lbl">Cumplimiento de SLA</div></div>
      <div class="stat accent-ok"><div class="num">${exitosos}</div><div class="lbl">Atenciones exitosas</div></div>
      <div class="stat accent-amber"><div class="num">${pendientes}</div><div class="lbl">Pendientes de cierre</div></div>
    `;
  }

  function render() {
    const cuerpo = document.getElementById('cuerpoAvales');
    if (misAvales.length === 0) {
      cuerpo.innerHTML = '<tr><td colspan="18"><div class="empty">No tienes avales asignados por el momento.</div></td></tr>';
      return;
    }
    cuerpo.innerHTML = misAvales.map(a => `
      <tr>
        <td class="mono">${esc(a.numero)}</td>
        <td>${fmtFecha(a.fecha)}</td>
        <td class="mono">${fmtHora(a.hora_asignacion)}</td>
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
        <td style="white-space:nowrap;">
          ${a.adjunto_nombre_archivo
            ? `<a href="/api/avales/${a.id}/adjunto" target="_blank" class="badge info" style="text-decoration:none;">Ver</a>
               <button class="btn-ghost" style="padding:3px 8px; font-size:0.72rem;" onclick="window.__subirAdjunto(${a.id})">Cambiar</button>`
            : `<button class="btn-ghost" style="padding:3px 8px; font-size:0.72rem;" onclick="window.__subirAdjunto(${a.id})">Subir</button>`}
        </td>
        <td><button class="btn-sm" onclick="window.__gestionar(${a.id})">Registrar gestión</button></td>
      </tr>
    `).join('');
  }

  document.getElementById('btnFiltrar').addEventListener('click', cargarAvales);
  document.getElementById('btnLimpiar').addEventListener('click', () => {
    document.getElementById('fEstado').value = '';
    document.getElementById('fCumplimiento').value = '';
    cargarAvales();
  });

  // ---------- Modal de gestión ----------
  const modalBg = document.getElementById('modalBg');

  window.__gestionar = function (id) {
    const a = misAvales.find(x => x.id === id);
    if (!a) return;
    document.getElementById('editId').value = a.id;
    document.getElementById('modalTitulo').textContent = a.numero + ' — ' + a.cliente;
    document.getElementById('infoHoraAsignacion').textContent = fmtHora(a.hora_asignacion);
    document.getElementById('editHoraContacto').value = a.hora_primer_contacto ? a.hora_primer_contacto.slice(0, 5) : '';
    document.getElementById('editEstado').value = a.estado_negociacion || 'PENDIENTE';
    document.getElementById('editProducto').value = a.producto || '';
    document.getElementById('editMonto').value = a.monto || '';
    document.getElementById('editFechaCierre').value = a.fecha_cierre ? a.fecha_cierre.slice(0, 10) : '';
    document.getElementById('editHoraCierre').value = a.hora_cierre ? a.hora_cierre.slice(0, 5) : '';
    document.getElementById('editExitosa').value = a.atencion_exitosa || '';
    document.getElementById('editObservaciones').value = a.observaciones || '';
    modalBg.classList.add('show');
  };

  document.getElementById('btnCancelarModal').addEventListener('click', () => modalBg.classList.remove('show'));
  modalBg.addEventListener('click', (e) => { if (e.target === modalBg) modalBg.classList.remove('show'); });

  document.getElementById('formGestion').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('editId').value;
    const msg = document.getElementById('editMsg');

    try {
      const res = await fetch('/api/avales/' + id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          hora_primer_contacto: document.getElementById('editHoraContacto').value || null,
          estado_negociacion: document.getElementById('editEstado').value,
          producto: document.getElementById('editProducto').value || null,
          monto: document.getElementById('editMonto').value || null,
          fecha_cierre: document.getElementById('editFechaCierre').value || null,
          hora_cierre: document.getElementById('editHoraCierre').value || null,
          atencion_exitosa: document.getElementById('editExitosa').value || null,
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

  // ---------- Nuevo aval (creado por el propio asesor) ----------
  const modalNuevoBg = document.getElementById('modalNuevoBg');

  document.getElementById('btnNuevoAval').addEventListener('click', () => {
    document.getElementById('formNuevoAval').reset();
    document.getElementById('nuevoAvalMsg').className = 'msg';
    modalNuevoBg.classList.add('show');
  });
  document.getElementById('btnCancelarNuevo').addEventListener('click', () => modalNuevoBg.classList.remove('show'));
  modalNuevoBg.addEventListener('click', (e) => { if (e.target === modalNuevoBg) modalNuevoBg.classList.remove('show'); });

  document.getElementById('formNuevoAval').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('nuevoAvalMsg');

    const payload = {
      fecha: document.getElementById('nFecha').value || null,
      hora_asignacion: document.getElementById('nHoraAsignacion').value,
      cedula: document.getElementById('nCedula').value.trim(),
      calificacion_aval: document.getElementById('nCalificacion').value || null,
      cliente: document.getElementById('nCliente').value.trim(),
      telefono: document.getElementById('nTelefono').value.trim(),
      ciudad: document.getElementById('nCiudad').value.trim(),
      actividad_economica: document.getElementById('nActividad').value || null,
      producto: document.getElementById('nProducto').value || null,
      gestor_contact_center: document.getElementById('nGestor').value.trim(),
      observaciones: document.getElementById('nObservaciones').value.trim()
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
      if (!res.ok) { showMsg(msg, data.error || 'No se pudo registrar el aval.', 'error'); return; }
      modalNuevoBg.classList.remove('show');
      cargarAvales();
    } catch (err) {
      showMsg(msg, 'Error de conexión con el servidor.', 'error');
    }
  });

  // ---------- Adjuntos ----------
  const inputAdjunto = document.getElementById('inputAdjunto');
  let avalIdParaAdjunto = null;

  window.__subirAdjunto = function (id) {
    avalIdParaAdjunto = id;
    inputAdjunto.value = ''; // permite volver a elegir el mismo archivo si hace falta
    inputAdjunto.click();
  };

  inputAdjunto.addEventListener('change', async () => {
    const archivo = inputAdjunto.files[0];
    if (!archivo || !avalIdParaAdjunto) return;

    const permitidos = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!permitidos.includes(archivo.type)) {
      alert('Solo se permiten imágenes, PDF o Word.');
      return;
    }
    if (archivo.size > 10 * 1024 * 1024) {
      alert('El archivo supera el límite de 10 MB.');
      return;
    }

    const formData = new FormData();
    formData.append('archivo', archivo);

    try {
      const res = await fetch('/api/avales/' + avalIdParaAdjunto + '/adjunto', {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: formData
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'No se pudo subir el archivo.');
        return;
      }
      cargarAvales();
    } catch (err) {
      alert('Error de conexión con el servidor.');
    }
  });

  // ---------- Arranque ----------
  cargarSesion().then(cargarAvales);
})();
