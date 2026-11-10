(function () {
  'use strict';
  const { el, chip, mmss, toast, ic, icRol, icTipo, NOMBRE_ROL, ORDEN, ICON_CAMPO } = DX;
  const KEY = 'dx_jugador';
  const $app = document.getElementById('app');
  const $top = document.getElementById('top');
  let sesion = null;
  try { sesion = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { sesion = null; }
  const params = new URLSearchParams(location.search);
  let briefVisto = 0, S = null, offset = 0, rolSel = null, claveAccion = '', accionNodo = null, enviadoLocal = {};
  const dirtySel = {};

  const net = DX.conectar({
    onAbrir() { if (sesion && sesion.token) net.enviar({ t: 'unirse', code: sesion.code, alias: sesion.alias, token: sesion.token }); else pintarUnirse(); },
    onMensaje(m) {
      if (m.t === 'unido') { sesion = { code: m.code, token: m.token, alias: sesion ? sesion.alias : '' }; guardar(); }
      else if (m.t === 'error') {
        if (m.codigo === 'sala') { sesion = null; guardar(); pintarUnirse(m.msg); } else toast(m.msg);
      } else if (m.t === 'estado') { S = m; offset = m.ahora - Date.now(); render(); }
    },
  });
  function guardar() { try { if (sesion) localStorage.setItem(KEY, JSON.stringify(sesion)); else localStorage.removeItem(KEY); } catch { /* ignorar */ } }

  /* ---------- Registro ---------- */
  function pintarUnirse(error) {
    $top.hidden = true; claveAccion = ''; accionNodo = null;
    const code = el('input', { type: 'text', class: 'form-control form-control-lg text-center fw-bold text-uppercase', maxlength: '4', autocomplete: 'off', autocapitalize: 'characters', id: 'codigoIn', 'aria-label': 'Código de sala', value: (params.get('c') || '').toUpperCase(), style: 'letter-spacing:.4rem' });
    const nombre = el('input', { type: 'text', class: 'form-control form-control-lg', maxlength: '20', autocomplete: 'off', id: 'nombreIn', 'aria-label': 'Tu nombre' });
    const puesto = el('select', { class: 'form-select form-select-lg', id: 'puestoIn', 'aria-label': 'Eslabón parecido a tu trabajo' },
      el('option', { value: '' }, 'Ninguno o no estoy seguro'), ...ORDEN.map((r) => el('option', { value: r }, NOMBRE_ROL[r])));
    const b = el('button', { type: 'button', class: 'btn btn-primary btn-lg w-100', id: 'entrarBtn', onclick: () => {
      const c = code.value.trim().toUpperCase(), a = nombre.value.trim();
      if (c.length !== 4 || !a) return toast('Escribe el código de 4 letras y tu nombre.');
      sesion = { code: c, token: null, alias: a };
      net.enviar({ t: 'unirse', code: c, alias: a, puesto: puesto.value });
    } }, ic('bi-box-arrow-in-right', 'me-2'), 'Entrar');
    $app.replaceChildren(
      el('div', { class: 'card bg-brand border-0 mb-3' }, el('div', { class: 'card-body' },
        el('h1', { class: 'h3 mb-1' }, ic('bi-truck', 'me-2'), 'Despacho Express'),
        el('p', { class: 'mb-0 opacity-75' }, 'Código de la pantalla.'))),
      el('div', { class: 'card shadow-sm' }, el('div', { class: 'card-body' },
        el('label', { class: 'form-label fw-semibold', for: 'codigoIn' }, 'Código de sala'), code,
        el('label', { class: 'form-label fw-semibold mt-3', for: 'nombreIn' }, 'Tu nombre o apodo'), nombre,
        el('label', { class: 'form-label fw-semibold mt-3', for: 'puestoIn' }, 'Mi trabajo se parece más a'), puesto,
        el('div', { class: 'form-text mb-3' }, 'Así te toca un rol distinto al tuyo.'), b)),
      error ? el('div', { class: 'alert alert-danger mt-3' }, error) : null);
  }

  /* ---------- Utilidades ---------- */
  const rolesYo = () => (S.yo ? S.yo.roles : []);
  function miRolActivo() {
    const rs = rolesYo(); if (!rs.length) return null;
    if (!rolSel || !rs.includes(rolSel)) rolSel = rs[0];
    return rolSel;
  }
  const pedActual = () => (S.ronda ? S.ronda.pedidoActual : 1);
  const msgsPedido = (tipo, filtro) => (S.mensajes || []).filter((m) => m.pedidoN === pedActual() && (!tipo || m.tipo === tipo) && (!filtro || filtro(m)));
  const chipsDatos = (datos, estado) => Object.entries(datos || {}).map(([c, v]) => chip(c, v, estado));
  const enviarMsg = (obj) => net.enviar({ t: 'msg', ...obj });
  const tarjeta = (titulo, ...kids) => el('div', { class: 'card shadow-sm mb-3' }, el('div', { class: 'card-body' }, titulo ? el('h2', { class: 'h6 text-uppercase text-body-secondary mb-2' }, titulo) : null, ...kids));
  const rolBadge = (rol) => el('span', { class: 'badge text-bg-secondary-subtle border' }, icRol(rol, 'me-1'), NOMBRE_ROL[rol]);

  /* ---------- Render ---------- */
  function render() {
    if (!S || S.tipo !== 'jugador') return;
    $top.hidden = false;
    const rol = miRolActivo();
    const tRol = document.getElementById('tRol'); tRol.replaceChildren();
    if (S.yo.observador) tRol.append(ic('bi-eye', 'me-2'), 'Observador');
    else if (rol) tRol.append(icRol(rol, 'me-2'), NOMBRE_ROL[rol]);
    else tRol.append(ic('bi-hourglass-split', 'me-2'), 'Sala');
    const r = S.ronda;
    document.getElementById('tPed').textContent = r && r.estado === 'activa' ? `R${r.numero} · Pedido ${r.pedidoActual}/${r.pedidosTotal}` : '';
    if (S.fase === 'lobby') return pantallaLobby();
    if (r && r.estado === 'activa' && rol && !S.yo.observador && briefVisto !== r.numero) return pantallaBriefing(r, rol);
    if (r && r.estado === 'activa') return pantallaJuego(r, rol);
    return pantallaResultado();
  }

  function pantallaLobby() {
    claveAccion = ''; accionNodo = null; document.getElementById('tTm').textContent = '';
    $app.replaceChildren(
      el('div', { class: 'card bg-brand border-0 mb-3' }, el('div', { class: 'card-body' },
        el('h2', { class: 'h4' }, ic('bi-hourglass-split', 'me-2'), 'Esperando a que empiece'),
        el('p', { class: 'mb-0 opacity-75' }, `Sala ${S.code}. Entraste como ${S.yo.alias}.`))),
      tarjeta('En la sala', el('div', {}, S.jugadores.map((j) => el('span', { class: 'dato' }, ic(j.bot ? 'bi-robot' : 'bi-person'), j.alias)))));
  }

  function pantallaResultado() {
    claveAccion = ''; accionNodo = null; document.getElementById('tTm').textContent = '';
    const res = S.resumenes[S.resumenes.length - 1];
    const nodos = [el('div', { class: 'card bg-brand border-0 mb-3' }, el('div', { class: 'card-body' },
      el('h2', { class: 'h4' }, ic(S.fase === 'final' ? 'bi-flag' : 'bi-pause-circle', 'me-2'), S.fase === 'final' ? 'Fin del juego' : 'Ronda terminada'),
      el('p', { class: 'mb-0 opacity-75' }, 'Mira la pantalla.')))];
    if (res) {
      nodos.push(tarjeta(`Ronda ${res.numero}`,
        el('div', { class: 'score tabular' }, `${res.puntos}`, el('small', { class: 'fs-5 text-body-secondary' }, `/${res.max}`)),
        el('div', { class: 'progress my-2', role: 'progressbar', 'aria-valuenow': res.puntos, 'aria-valuemin': 0, 'aria-valuemax': res.max }, el('div', { class: 'progress-bar bg-primary', style: `width:${res.puntos / res.max * 100}%` })),
        el('span', { class: 'dato' }, ic('bi-check-circle'), `${res.perfectos} perfectos`), el('span', { class: 'dato' }, ic('bi-envelope'), `${res.mensajes} mensajes`), el('span', { class: 'dato' }, ic('bi-pencil'), `${res.correcciones} correcciones`)));
    }
    if (S.fase === 'final' && S.encuesta) nodos.push(formularioEncuesta());
    $app.replaceChildren(...nodos);
  }

  /* ---------- Formulario de satisfacción (anónimo) ---------- */
  let encNodo = null;
  function formularioEncuesta() {
    const e = S.encuesta;
    if (e.hecha) {
      encNodo = null;
      return tarjeta(null, el('div', { class: 'text-center py-3', id: 'encuestaGracias' }, ic('bi-check-circle-fill', 'fs-1 text-success'),
        el('h2', { class: 'h5 mt-2' }, 'Gracias por responder'), el('p', { class: 'text-body-secondary small mb-0' }, 'Tu respuesta es anónima: no se guarda quién la envió.')));
    }
    if (encNodo) return encNodo;
    const est = { likert: e.items.map(() => 0), abiertas: e.preguntas.map(() => '') };
    const enviar = el('button', { type: 'button', class: 'btn btn-primary btn-lg w-100', id: 'encuestaEnviar', disabled: true, onclick: () => {
      net.enviar({ t: 'encuesta', likert: est.likert, abiertas: est.abiertas });
    } }, ic('bi-send', 'me-2'), 'Enviar formulario');
    const refrescar = () => { enviar.disabled = !est.likert.every((n) => n > 0); };
    const filas = e.items.map((texto, i) => {
      const grupo = el('div', { class: 'btn-group w-100', role: 'group', 'aria-label': texto });
      for (let n = 1; n <= 5; n++) {
        const id = `it${i}_${n}`;
        const radio = el('input', { type: 'radio', class: 'btn-check', name: 'it' + i, id, autocomplete: 'off' });
        radio.addEventListener('change', () => { est.likert[i] = n; refrescar(); });
        grupo.append(radio, el('label', { class: 'btn btn-outline-primary', for: id }, String(n)));
      }
      return el('div', { class: 'mb-3' }, el('div', { class: 'small fw-semibold mb-1' }, `${i + 1}. ${texto}`), grupo);
    });
    const abiertas = e.preguntas.map((q, i) => {
      const ta = el('textarea', { class: 'form-control', rows: '2', maxlength: '300', id: 'ab' + i, 'aria-label': q });
      ta.addEventListener('input', () => { est.abiertas[i] = ta.value; });
      return el('div', { class: 'mb-3' }, el('label', { class: 'form-label small fw-semibold', for: 'ab' + i }, q), ta);
    });
    encNodo = tarjeta('Formulario de satisfacción',
      el('p', { class: 'small text-body-secondary' }, 'Anónimo. 1 = nada de acuerdo, 5 = totalmente de acuerdo.'),
      ...filas, ...abiertas, enviar);
    encNodo.id = 'encuestaCard';
    return encNodo;
  }

  const MISION = { planificacion: 'Sabes el destino y la hora.', inventarios: 'Sabes el producto y la cantidad.', almacen: 'Sabes en qué muelle se carga.', transporte: 'Sabes qué unidad va.', seguridad: 'Sabes la restricción de la carga.', operativo: 'Armas y envías el despacho.' };
  const PASOS = {
    notas: [['bi-ui-checks', 'Marca tus datos'], ['bi-arrow-right-circle', 'Pásalos al siguiente'], ['bi-slash-circle', 'Sin preguntas']],
    chat: [['bi-person-vcard', 'Publica tu tarjeta'], ['bi-megaphone', 'Escucha el eco'], ['bi-pencil', 'Corrige si falla']],
  };

  /** Cadena de eslabones: yo resaltado, completados en verde */
  function cadenaVista(r, rol) {
    const hechos = new Set(msgsPedido(null, (m) => m.tipo !== 'eco').map((m) => m.de));
    const nodos = [];
    ORDEN.forEach((x, i) => {
      if (i) nodos.push(ic('bi-chevron-right', 'text-body-secondary flecha-m'));
      const listo = hechos.has(x);
      nodos.push(el('div', { class: 'eslabon' + (x === rol ? ' yo' : '') + (listo ? ' listo' : ''), title: NOMBRE_ROL[x] }, icRol(x), listo ? ic('bi-check-circle-fill', 'tic') : null));
    });
    return el('div', { class: 'cadena-m', 'aria-label': 'Cadena de despacho' }, nodos);
  }

  function pantallaBriefing(r, rol) {
    claveAccion = ''; accionNodo = null;
    const misRoles = rolesYo();
    const b = el('button', { type: 'button', class: 'btn btn-primary btn-lg w-100', id: 'entendidoBtn', onclick: () => { briefVisto = r.numero; render(); } }, ic('bi-play-fill', 'me-2'), 'Listo');
    $app.replaceChildren(
      el('div', { class: 'card bg-brand border-0 mb-3 text-center' }, el('div', { class: 'card-body py-4' },
        el('div', { class: 'small text-uppercase opacity-75' }, 'Te tocó'),
        el('div', { class: 'display-3 my-2 rol-pop' }, icRol(rol)),
        el('h2', { class: 'h3 mb-1' }, misRoles.length > 1 ? misRoles.map((x) => NOMBRE_ROL[x]).join(' + ') : NOMBRE_ROL[rol]),
        el('p', { class: 'mb-0 opacity-75' }, misRoles.map((x) => MISION[x]).join(' ')))),
      tarjeta(null, cadenaVista(r, rol)),
      tarjeta(`Ronda ${r.numero}`, el('div', { class: 'row g-2 text-center' }, PASOS[r.modo === 'notas' ? 'notas' : 'chat'].map(([i, t], n) =>
        el('div', { class: 'col-4' }, el('div', { class: 'paso-m' }, ic(i, 'fs-3'), el('div', { class: 'small fw-semibold mt-1' }, `${n + 1}. ${t}`)))))),
      b);
  }

  function pantallaJuego(r, rol) {
    const nodos = [];
    (S.alertas || []).filter((a) => a.pedidoN === r.pedidoActual).forEach((a) => {
      nodos.push(el('div', { class: 'alert alert-warning alerta-cambio shadow-sm' }, el('div', { class: 'fw-bold' }, ic('bi-lightning-charge-fill', 'me-1'), 'Cambio de último momento'), el('div', { class: 'small mb-1' }, a.texto), chip(a.campo, a.nuevo, 'nuevo')));
    });
    if (S.yo.observador || !rol) {
      nodos.push(tarjeta('Lo que pasa', el('div', { class: 'list-group list-group-flush' }, ...(S.mensajes || []).slice(-14).reverse().map(filaMensaje))));
      $app.replaceChildren(...nodos); return;
    }
    if (rolesYo().length > 1) {
      nodos.push(el('div', { class: 'btn-group w-100 mb-3', role: 'group', 'aria-label': 'Tus roles' }, rolesYo().map((x) =>
        el('button', { type: 'button', class: 'btn btn-outline-primary' + (x === rol ? ' active' : ''), onclick: () => { rolSel = x; claveAccion = ''; render(); } }, icRol(x, 'me-1'), NOMBRE_ROL[x]))));
    }
    nodos.push(cadenaVista(r, rol));
    const mis = (S.misCampos || []).filter((c) => c.rol === rol);
    nodos.push(tarjeta('Tus datos', mis.length ? el('div', {}, mis.map((c) => chip(c.campo, c.valor, 'lg'))) : el('p', { class: 'text-body-secondary mb-0' }, 'No sabes ningún dato. Dependes del equipo.')));
    const clave = [r.numero, r.pedidoActual, rol, ultimoEcoId(), sigMensajes(r, rol), S.misCampos ? S.misCampos.map((c) => c.valor).join('|') : ''].join(':');
    if (clave !== claveAccion || !accionNodo) { accionNodo = construirAccion(r, rol); claveAccion = clave; }
    nodos.push(accionNodo);
    nodos.push(tarjeta(r.modo === 'notas' ? 'Notas' : 'Mesa de coordinación', el('div', { class: 'list-group list-group-flush' }, ...(S.mensajes || []).filter((m) => m.pedidoN === r.pedidoActual).slice(-10).reverse().map(filaMensaje))));
    $app.replaceChildren(...nodos);
  }

  function filaMensaje(m) {
    return el('div', { class: 'list-group-item px-0 d-flex flex-wrap align-items-center gap-1' }, icTipo(m.tipo), icRol(m.de), ic('bi-arrow-right', 'text-body-secondary'),
      m.a === 'todos' ? ic('bi-people') : icRol(m.a), chipsDatos(m.datos, 't-' + m.tipo), m.texto ? el('span', { class: 'small' }, m.texto) : null);
  }
  const ultimoEco = () => msgsPedido('eco').pop();
  const ultimoEcoId = () => (S.ronda && S.ronda.modo === 'chat' && ultimoEco() ? ultimoEco().id : '');
  function sigMensajes(r, rol) {
    if (r.modo === 'notas') { const p = msgsPedido('nota', (m) => m.a === rol).pop(); return p ? p.id : ''; }
    if (rol === 'operativo') return msgsPedido(null, (m) => m.datos && m.tipo !== 'eco').length;
    return msgsPedido('tarjeta', (m) => m.de === rol).length;
  }

  /* ---------- Acciones ---------- */
  function construirAccion(r, rol) {
    if (r.modo === 'notas') return rol === 'operativo' ? accionOperativo(r, rol, true) : accionNota(r, rol);
    return rol === 'operativo' ? accionOperativo(r, rol, false) : accionTarjeta(r, rol);
  }

  function accionNota(r, rol) {
    const i = ORDEN.indexOf(rol);
    const previa = msgsPedido('nota', (m) => m.a === rol).pop();
    const mis = (S.misCampos || []).filter((c) => c.rol === rol);
    const conocidos = { ...(previa ? previa.datos || {} : {}) };
    mis.forEach((c) => { conocidos[c.campo] = c.valor; });
    const cajas = {}; const lista = el('div', { class: 'list-group mb-3' });
    Object.keys(conocidos).forEach((c) => {
      const cb = el('input', { type: 'checkbox', class: 'form-check-input fs-4 m-0', checked: true, id: 'k_' + c }); cajas[c] = cb;
      lista.append(el('label', { class: 'list-group-item d-flex align-items-center gap-3', for: 'k_' + c }, cb, chip(c, conocidos[c], 'lg')));
    });
    const estado = el('div', { class: 'small text-body-secondary mt-2' }, enviadoLocal[`n${r.numero}:${r.pedidoActual}:${rol}`] ? 'Nota enviada. Puedes reenviarla.' : '');
    const b = el('button', { type: 'button', class: 'btn btn-primary btn-lg w-100', onclick: () => {
      const datos = {}; Object.keys(cajas).forEach((c) => { if (cajas[c].checked) datos[c] = conocidos[c]; });
      if (!Object.keys(datos).length) return toast('Marca al menos un dato.');
      enviarMsg({ como: rol, datos });
      enviadoLocal[`n${r.numero}:${r.pedidoActual}:${rol}`] = true; estado.textContent = 'Nota enviada.';
    } }, ic('bi-envelope-arrow-up', 'me-2'), `Enviar a ${NOMBRE_ROL[ORDEN[i + 1]]}`);
    return tarjeta('Tu nota',
      previa ? el('div', { class: 'mb-3' }, el('div', { class: 'small text-body-secondary mb-1' }, 'Te pasó ', rolBadge(ORDEN[i - 1])), chipsDatos(previa.datos)) : (i > 0 ? el('p', { class: 'text-body-secondary small' }, ic('bi-hourglass-split', 'me-1'), 'Aún no llega nada.') : null),
      lista, b, estado);
  }

  function selectorCampo(c, valor, dirtyKey) {
    if (dirtyKey && dirtySel[dirtyKey] && dirtySel[dirtyKey][c]) valor = dirtySel[dirtyKey][c];
    const s = el('select', { class: 'form-select form-select-lg', 'data-campo': c, 'aria-label': S.campos[c].label });
    if (dirtyKey) s.addEventListener('change', () => { (dirtySel[dirtyKey] = dirtySel[dirtyKey] || {})[c] = s.value; });
    s.append(el('option', { value: '' }, `${S.campos[c].label}…`));
    S.campos[c].opciones.forEach((o) => s.append(el('option', { value: o, selected: o === valor }, o)));
    return s;
  }
  const campoForm = (c, sel) => el('div', { class: 'mb-2' }, el('label', { class: 'form-label fw-semibold mb-1' }, ic(ICON_CAMPO[c], 'me-1'), S.campos[c].label), sel);
  const leerSelects = (raiz) => { const o = {}; raiz.querySelectorAll('select[data-campo]').forEach((s) => { if (s.value) o[s.dataset.campo] = s.value; }); return o; };

  function accionTarjeta(r, rol) {
    const mis = (S.misCampos || []).filter((c) => c.rol === rol);
    const form = el('div', {});
    mis.forEach((c) => form.append(campoForm(c.campo, selectorCampo(c.campo, c.valor))));
    const ya = msgsPedido('tarjeta', (m) => m.de === rol).length > 0;
    const b = el('button', { type: 'button', class: 'btn btn-primary btn-lg w-100', onclick: () => {
      const datos = leerSelects(form);
      if (!Object.keys(datos).length) return toast('Elige tu dato.');
      enviarMsg({ como: rol, a: 'todos', tipo: msgsPedido('tarjeta', (m) => m.de === rol).length ? 'correccion' : 'tarjeta', datos });
    } }, ic('bi-person-vcard', 'me-2'), ya ? 'Actualizar mi tarjeta' : 'Publicar mi tarjeta');
    const nodos = [form, b];
    const eco = ultimoEco();
    if (eco) {
      const filas = mis.map((c) => {
        const visto = eco.datos ? eco.datos[c.campo] : undefined; const bien = visto === c.valor;
        return el('div', { class: 'd-flex align-items-center gap-2 mt-2' }, icTipo('eco'), chip(c.campo, visto || 'sin dato', bien ? 'ok' : 'bad'),
          bien ? ic('bi-check-lg', 'text-success fs-5') : el('button', { class: 'btn btn-outline-primary btn-sm', type: 'button', onclick: () => enviarMsg({ como: rol, a: 'todos', tipo: 'correccion', datos: { [c.campo]: c.valor } }) }, ic('bi-pencil', 'me-1'), `Es ${c.valor}`));
      });
      nodos.push(el('div', { class: 'alert alert-info mt-3 mb-0' }, el('div', { class: 'fw-bold' }, icTipo('eco', 'me-1'), 'Eco del Operativo'), ...filas));
    }
    return tarjeta('Tu tarjeta de traspaso', ...nodos);
  }

  function accionOperativo(r, rol, esNotas) {
    const i = ORDEN.indexOf(rol);
    const form = el('div', {});
    let base = {};
    if (esNotas) { const n = msgsPedido('nota', (m) => m.a === rol).pop(); base = n ? n.datos || {} : {}; }
    else base = DX.valoresComunicados(S.mensajes || [], r.pedidoActual);
    const dk = `${r.numero}:${r.pedidoActual}`;
    DX.CAMPOS_ORDEN.forEach((c) => form.append(campoForm(c, selectorCampo(c, base[c], dk))));
    const acciones = [];
    if (!esNotas) {
      acciones.push(el('button', { class: 'btn btn-outline-primary btn-lg w-100 mb-2', type: 'button', onclick: () => {
        const datos = leerSelects(form); if (!Object.keys(datos).length) return toast('Completa algún dato para leer el eco.');
        enviarMsg({ como: rol, tipo: 'eco', datos });
      } }, icTipo('eco', 'me-2'), 'Leer el eco en voz alta'));
    }
    acciones.push(el('button', { class: 'btn btn-primary btn-lg w-100', type: 'button', onclick: () => {
      const datos = leerSelects(form);
      if (Object.keys(datos).length < DX.CAMPOS_ORDEN.length) return toast('Completa los 7 datos antes de enviar.');
      net.enviar({ t: 'pedido', valores: datos });
    } }, ic('bi-send', 'me-2'), 'Enviar despacho'));
    const recibido = esNotas
      ? (Object.keys(base).length ? el('div', { class: 'mb-3' }, el('div', { class: 'small text-body-secondary mb-1' }, 'Te pasó ', rolBadge(ORDEN[i - 1])), chipsDatos(base)) : el('p', { class: 'text-body-secondary small' }, ic('bi-hourglass-split', 'me-1'), 'Aún no llega nada.'))
      : el('p', { class: 'text-body-secondary small' }, 'Se rellena con las tarjetas del equipo.');
    return tarjeta('Arma el despacho', recibido, form, ...acciones);
  }

  setInterval(() => {
    if (!S || !S.ronda || S.ronda.estado !== 'activa') return;
    document.getElementById('tTm').textContent = mmss(S.ronda.fin - (Date.now() + offset));
  }, 250);
})();
