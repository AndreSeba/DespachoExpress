(function () {
  'use strict';
  const { el, mmss, toast, ic, icRol, icTipo, chip, ICON_ROL, ICON_CAMPO, ICON_TIPO, COLOR_TIPO, NOMBRE_ROL, ORDEN, CAMPOS_ORDEN, CAMPOS_DE } = DX;
  const KEY = 'dx_host';
  const SVGNS = 'http://www.w3.org/2000/svg';

  let S = null, offset = 0, vista = 'vivo', selPedido = null, selCelda = null, sala = null;
  let vistos = new Set(), primera = true, rondaVista = null, auto = false, drawerRol = null, yaMostroCmp = false;
  const $ = (id) => document.getElementById(id);
  const actTimers = {};
  const nombreCorto = (rol) => NOMBRE_ROL[rol].split(' ')[0];

  /* ---------- Conexión ---------- */
  try { sala = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { sala = null; }
  const conexion = (ok) => { $('conn').replaceChildren(ic(ok ? 'bi-circle-fill text-success' : 'bi-circle-fill text-danger', 'me-1'), ok ? 'Conectado' : 'Reconectando'); };
  const net = DX.conectar({
    onAbrir() { conexion(true); if (sala) net.enviar({ t: 'host:entrar', code: sala.code, token: sala.token }); else net.enviar({ t: 'host:crear' }); },
    onCerrar() { conexion(false); },
    onMensaje(m) {
      if (m.t === 'creada') { sala = { code: m.code, token: m.token }; try { localStorage.setItem(KEY, JSON.stringify(sala)); } catch { /* ignorar */ } }
      else if (m.t === 'error') {
        if (m.codigo === 'sala') { sala = null; try { localStorage.removeItem(KEY); } catch { /* ignorar */ } net.enviar({ t: 'host:crear' }); } else toast(m.msg);
      } else if (m.t === 'estado') { S = m; offset = m.ahora - Date.now(); render(); }
    },
  });
  const enviar = (t, extra) => net.enviar({ t, ...(extra || {}) });

  /* ---------- Cabecera ---------- */
  const urlJugadores = () => `${location.origin}/?c=${S ? S.code : ''}`;
  $('codigo').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(urlJugadores()); toast('Enlace copiado', 'success'); } catch { toast(urlJugadores(), 'secondary'); }
  });
  const modalNueva = new bootstrap.Modal($('modalNueva'));
  $('nueva').addEventListener('click', () => modalNueva.show());
  $('confirmaNueva').addEventListener('click', () => {
    modalNueva.hide(); sala = null; try { localStorage.removeItem(KEY); } catch { /* ignorar */ }
    vistos = new Set(); primera = true; yaMostroCmp = false; enviar('host:crear');
  });
  $('tabVivo').addEventListener('click', () => { vista = 'vivo'; render(); });
  $('tabCmp').addEventListener('click', () => { vista = 'cmp'; render(); });
  const drawerEl = $('drawer');
  const drawer = new bootstrap.Offcanvas(drawerEl);
  drawerEl.addEventListener('hidden.bs.offcanvas', () => { drawerRol = null; });

  /* ---------- Cálculos ---------- */
  const rolDe = (jugadores, rol) => jugadores.find((j) => j.roles.includes(rol));
  const rondaActual = () => (S && S.ronda ? S.ronda.numero : null);
  const detalleRonda = (n) => (S.detalle || []).find((d) => d.numero === n);
  const msgsDe = (n, pedidoN) => (n === rondaActual() ? S.mensajes : []).filter((m) => m.pedidoN === pedidoN);

  function estadoValor(valor, campo, ped) {
    if (!ped || !ped.real) return 'vacio';
    if (valor === ped.real[campo]) return 'ok';
    const inc = (ped.incidentes || []).find((x) => x.campo === campo);
    if (inc && valor === inc.anterior) return 'stale';
    return 'bad';
  }
  function salidas(msgs) {
    const out = {}; ORDEN.forEach((r) => { out[r] = {}; });
    for (const m of msgs) {
      if (!m.datos) continue;
      for (const [c, v] of Object.entries(m.datos)) out[m.de][c] = { valor: v, tipo: m.tipo, t: m.t };
    }
    return out;
  }
  const ICONO_ESTADO = { ok: 'bi-check-lg', bad: 'bi-x-lg', stale: 'bi-arrow-counterclockwise' };

  /* ---------- Render principal ---------- */
  function render() {
    if (!S || S.tipo !== 'host') return;
    $('codigo').textContent = S.code;
    $('link').textContent = location.host + '/?c=' + S.code;
    pintarEquipo(); pintarControles();
    $('tabCmp').disabled = S.resumenes.length === 0;
    if (S.fase === 'final' && vista === 'vivo' && !yaMostroCmp) { vista = 'cmp'; yaMostroCmp = true; }
    if (S.fase === 'lobby') yaMostroCmp = false;
    $('tabVivo').classList.toggle('active', vista === 'vivo'); $('tabCmp').classList.toggle('active', vista === 'cmp');
    $('vivo').hidden = vista !== 'vivo'; $('cmp').hidden = vista !== 'cmp';
    if (rondaVista !== rondaActual()) { rondaVista = rondaActual(); selPedido = null; selCelda = null; }
    if (vista === 'vivo') { pintarFranja(); construirCadena(); actualizarCadena(); pintarHeat(); pintarTicker(); detectarEventos(); }
    else pintarComparar();
    if (drawerRol) abrirDrawer(drawerRol, true);
  }

  /* ---------- Equipo ---------- */
  function pintarEquipo() {
    const cont = $('seats'); cont.replaceChildren();
    const sinRol = S.jugadores.filter((j) => !j.roles.length);
    if (S.fase === 'lobby') {
      if (!sinRol.length) { cont.append(el('div', { class: 'col-12 text-body-secondary small' }, ic('bi-hourglass-split', 'me-1'), 'Esperando jugadores. Comparte el código o completa con bots.')); return; }
      sinRol.forEach((j) => cont.append(el('div', { class: 'col-6' }, el('div', { class: 'card seat p-2 border' },
        ic('bi-circle-fill ' + (j.bot || j.conectado ? 'text-success' : 'text-danger'), 'conex'), j.bot ? ic('bi-robot', 'bot-ic') : null,
        ic(j.bot ? 'bi-robot' : 'bi-person', 'fs-3'), el('div', { class: 'small fw-semibold text-truncate' }, j.alias),
        j.puesto ? el('div', { class: 'small text-body-secondary text-truncate' }, 'trabajo: ', NOMBRE_ROL[j.puesto].split(' ')[0]) : null))));
      return;
    }
    ORDEN.forEach((rol) => {
      const j = rolDe(S.jugadores, rol);
      cont.append(el('div', { class: 'col-6' }, el('button', { type: 'button', class: 'card seat p-2 border w-100 bg-body' + (j ? '' : ' vacio'), id: 'seat_' + rol, 'data-rol': rol, onclick: () => abrirDrawer(rol) },
        j ? ic('bi-circle-fill ' + (j.bot || j.conectado ? 'text-success' : 'text-danger'), 'conex') : null, j && j.bot ? ic('bi-robot', 'bot-ic') : null,
        icRol(rol, 'fs-3 text-brand'), el('div', { class: 'small fw-semibold' }, nombreCorto(rol)), el('div', { class: 'small text-body-secondary text-truncate' }, j ? j.alias : 'vacío'))));
    });
  }

  /* ---------- Controles ---------- */
  const boton = (icono, txt, cls, fn, extra) => el('button', { type: 'button', class: 'btn ' + cls, onclick: fn, ...(extra || {}) }, ic(icono, 'me-2'), txt);
  function pintarControles() {
    const c = $('ctrl'); c.replaceChildren(); const cfg = $('cfg'); cfg.replaceChildren();
    const n = S.jugadores.filter((j) => !j.observador).length;
    if (S.fase === 'lobby') {
      c.append(boton('bi-play-fill', 'Iniciar ronda 1', 'btn-primary btn-lg' + (n < 2 ? ' disabled' : ''), () => enviar('iniciar'), { 'data-accion': 'iniciar' }),
        boton('bi-robot', 'Completar con bots', 'btn-outline-secondary', () => enviar('bots'), { 'data-accion': 'bots' }),
        boton('bi-trash3', 'Quitar bots', 'btn-outline-secondary', () => enviar('quitarbots')));
      if (S.restriccionRelajada) c.append(el('div', { class: 'alert alert-warning small mb-0' }, 'Los puestos declarados no permitieron evitar todos los cruces.'));
    } else if (S.fase === 'ronda') {
      c.append(boton('bi-lightning-charge-fill', 'Incidente', 'btn-primary btn-lg', () => enviar('incidente'), { 'data-accion': 'incidente' }),
        boton('bi-stop-fill', 'Cerrar ronda', 'btn-danger', () => enviar('cerrar'), { 'data-accion': 'cerrar' }),
        boton(auto ? 'bi-toggle-on' : 'bi-toggle-off', auto ? 'Incidentes automáticos: sí' : 'Incidentes automáticos: no', 'btn-outline-secondary', () => { auto = !auto; pintarControles(); }));
    } else if (S.fase === 'entre') {
      c.append(boton('bi-play-fill', `Iniciar ronda ${S.resumenes.length + 1}`, 'btn-primary btn-lg', () => enviar('iniciar'), { 'data-accion': 'iniciar' }));
    } else if (S.fase === 'final') {
      c.append(boton('bi-arrow-repeat', 'Nueva partida', 'btn-primary btn-lg', () => enviar('reiniciar'), { 'data-accion': 'reiniciar' }));
    }
    if (S.resumenes.length) c.append(el('a', { class: 'btn btn-outline-secondary', href: `/api/export?code=${S.code}&token=${sala ? sala.token : ''}`, download: '' }, ic('bi-download', 'me-2'), 'Descargar CSV'));
    if (S.fase === 'lobby' || S.fase === 'entre') {
      const mins = Math.round(S.config.rondaSeg / 60);
      const stepper = (icono, etiqueta, valor, menos, mas, ariaM, ariaP) => el('div', { class: 'd-flex align-items-center justify-content-between mb-2' },
        el('span', { class: 'fw-semibold' }, ic(icono, 'me-1'), etiqueta),
        el('div', { class: 'btn-group btn-group-sm', role: 'group' }, el('button', { type: 'button', class: 'btn btn-outline-secondary', 'aria-label': ariaM, onclick: menos }, ic('bi-dash-lg')), el('span', { class: 'btn btn-outline-secondary disabled text-body fw-bold', style: 'min-width:64px' }, valor), el('button', { type: 'button', class: 'btn btn-outline-secondary', 'aria-label': ariaP, onclick: mas }, ic('bi-plus-lg'))));
      cfg.append(
        stepper('bi-stopwatch', 'Ronda', `${mins} min`, () => enviar('config', { rondaSeg: Math.max(60, S.config.rondaSeg - 60), pedidos: S.config.pedidos }), () => enviar('config', { rondaSeg: Math.min(1200, S.config.rondaSeg + 60), pedidos: S.config.pedidos }), 'Menos tiempo', 'Más tiempo'),
        stepper('bi-card-checklist', 'Pedidos', String(S.config.pedidos), () => enviar('config', { rondaSeg: S.config.rondaSeg, pedidos: Math.max(1, S.config.pedidos - 1) }), () => enviar('config', { rondaSeg: S.config.rondaSeg, pedidos: Math.min(8, S.config.pedidos + 1) }), 'Menos pedidos', 'Más pedidos'));
    }
  }

  /* ---------- Franja: reloj, ronda, pedidos, puntaje ---------- */
  function pintarFranja() {
    const f = $('strip'); f.replaceChildren();
    const r = S.ronda;
    if (!r) {
      f.append(el('div', {}, el('h2', { class: 'h5 mb-1' }, ic('bi-hourglass-split', 'me-2'), 'Esperando jugadores'),
        el('span', { class: 'badge text-bg-secondary' }, ic('bi-people', 'me-1'), S.jugadores.length), el('span', { class: 'text-body-secondary small ms-2' }, 'Comparte el código con el equipo')));
      return;
    }
    const det = detalleRonda(r.numero); const peds = det ? det.pedidos : [];
    const ring = el('div', { class: 'ring' });
    const svg = document.createElementNS(SVGNS, 'svg'); svg.setAttribute('viewBox', '0 0 100 100'); svg.setAttribute('width', '84'); svg.setAttribute('height', '84'); svg.setAttribute('aria-hidden', 'true');
    const mk = (id, color) => { const c = document.createElementNS(SVGNS, 'circle'); if (id) c.id = id; c.setAttribute('cx', 50); c.setAttribute('cy', 50); c.setAttribute('r', 42); c.setAttribute('fill', 'none'); c.setAttribute('stroke', color); c.setAttribute('stroke-width', 10); return c; };
    const bg = mk(null, 'var(--bs-border-color)'); const fg = mk('ringFg', '#E07A2F'); fg.setAttribute('stroke-linecap', 'round'); fg.setAttribute('stroke-dasharray', '263.9'); fg.setAttribute('stroke-dashoffset', '0');
    svg.append(bg, fg); ring.append(svg, el('div', { class: 'tx tabular', id: 'ringTx' }, '--:--'));
    const badge = el('span', { class: 'badge text-bg-primary fs-6' }, `Ronda ${r.numero}`, ic(r.modo === 'notas' ? 'bi-arrow-right' : 'bi-chat-dots', 'ms-2'));
    const dots = el('div', { class: 'd-flex flex-wrap gap-2', role: 'group', 'aria-label': 'Pedidos' });
    peds.forEach((p) => {
      let cls = 'btn pd btn-outline-secondary'; let cont = String(p.n);
      if (p.enviado) { const perfecto = p.puntos === S.maxPorPedido; cls = 'btn pd ' + (perfecto ? 'btn-success' : 'btn-warning'); if (perfecto) cont = ic('bi-check-lg'); }
      else if (r.estado === 'activa' && p.n === r.pedidoActual) cls += ' act';
      if ((selPedido || r.pedidoActual) === p.n) cls += ' sel';
      dots.append(el('button', { type: 'button', class: cls, 'aria-label': `Pedido ${p.n}`, onclick: () => { selPedido = p.n; selCelda = null; render(); } }, cont));
    });
    const puntos = peds.reduce((s, p) => s + (p.enviado ? p.puntos : 0), 0);
    f.append(r.estado === 'activa' ? ring : el('span', { class: 'badge text-bg-secondary fs-6' }, ic(r.motivo === 'completa' ? 'bi-flag' : 'bi-stop-fill', 'me-1'), r.motivo === 'completa' ? 'Completa' : 'Cerrada'),
      badge, dots, el('div', { class: 'flex-grow-1' }),
      el('div', { class: 'text-end' }, el('div', { class: 'score tabular' }, String(puntos)), el('div', { class: 'small text-body-secondary' }, `de ${peds.length * S.maxPorPedido}`)));
    actualizarReloj();
  }
  function actualizarReloj() {
    const r = S && S.ronda; const tx = $('ringTx'), fg = $('ringFg');
    if (!r || r.estado !== 'activa' || !tx || !fg) return;
    const rest = r.fin - (Date.now() + offset), total = r.fin - r.inicio;
    tx.textContent = mmss(rest);
    fg.setAttribute('stroke-dashoffset', String(263.9 * (1 - Math.max(0, Math.min(1, rest / total)))));
    fg.setAttribute('stroke', rest < total * 0.2 ? '#dc3545' : '#E07A2F');
  }
  setInterval(actualizarReloj, 250);

  /* ---------- Recorrido (HTML + iconos) ---------- */
  function construirCadena() {
    const cont = $('cadena'); if (cont.dataset.listo) return; cont.dataset.listo = '1';
    ORDEN.forEach((rol, i) => {
      const nodo = el('button', { type: 'button', class: 'nodo vacio', id: 'nodo_' + rol, 'data-rol': rol, 'aria-label': NOMBRE_ROL[rol], onclick: () => abrirDrawer(rol) },
        el('div', { class: 'nodo-ic' }, icRol(rol)), el('div', { class: 'nm d-none d-sm-block' }, nombreCorto(rol)), el('div', { class: 'al', id: 'al_' + rol }, ''),
        ...CAMPOS_DE[rol].map((c) => el('span', { class: 'cv nada', id: `cv_${rol}_${c}` })));
      cont.append(nodo);
      if (i < ORDEN.length - 1) cont.append(ic('bi-chevron-right', 'flecha'));
    });
  }
  function actualizarCadena() {
    const r = S.ronda; const pN = selPedido || (r ? r.pedidoActual : 1);
    const det = r ? detalleRonda(r.numero) : null; const ped = det ? det.pedidos.find((p) => p.n === pN) : null;
    const sal = salidas(r ? msgsDe(r.numero, pN) : []);
    ORDEN.forEach((rol) => {
      const j = rolDe(S.jugadores, rol); const g = $('nodo_' + rol);
      g.classList.toggle('vacio', !j); $('al_' + rol).textContent = j ? j.alias : '';
      CAMPOS_DE[rol].forEach((c) => {
        const t = $(`cv_${rol}_${c}`); const real = ped && ped.real ? ped.real[c] : null;
        const out = sal[rol][c]; const est = !real || !out ? 'nada' : estadoValor(out.valor, c, ped);
        t.className = 'cv ' + est; t.replaceChildren(ic(ICON_CAMPO[c], 'me-1'), real || '·');
      });
    });
  }
  function centro(rol) {
    const cont = $('cadena').getBoundingClientRect(); const b = $('nodo_' + rol).querySelector('.nodo-ic').getBoundingClientRect();
    return [b.left - cont.left + b.width / 2, b.top - cont.top + b.height / 2];
  }
  function marcarActivo(rol) {
    const g = $('nodo_' + rol), s = $('seat_' + rol); if (!g) return;
    g.classList.add('act'); if (s) s.classList.add('act');
    clearTimeout(actTimers[rol]); actTimers[rol] = setTimeout(() => { g.classList.remove('act'); if (s) s.classList.remove('act'); }, 1400);
  }
  function animarMensaje(m) {
    const cont = $('cadena'); if (!cont.dataset.listo) return;
    const color = COLOR_TIPO[m.tipo] || '#666'; const [x1, y1] = centro(m.de);
    marcarActivo(m.de);
    if (m.a === 'todos') {
      const onda = el('div', { class: 'onda', style: `left:${x1}px;top:${y1}px;border-color:${color}` }); cont.append(onda); setTimeout(() => onda.remove(), 1100);
      ORDEN.filter((x) => x !== m.de).forEach((x) => marcarActivo(x)); return;
    }
    const [x2, y2] = centro(m.a);
    const p = el('div', { class: 'paquete', style: `left:0;top:0;background:${color}` }, ic(ICON_TIPO[m.tipo] || 'bi-chat-dots')); cont.append(p);
    const a = p.animate([{ transform: `translate(${x1}px,${y1}px)` }, { transform: `translate(${x2}px,${y2}px)` }], { duration: 900, easing: 'ease-in-out', fill: 'forwards' });
    a.onfinish = () => { marcarActivo(m.a); p.remove(); };
  }
  function destello(rol, icono) {
    const cont = $('cadena'); if (!cont.dataset.listo) return; const [x, y] = centro(rol);
    const t = el('div', { class: 'rayo', style: `left:${x}px;top:${y}px` }, ic(icono)); cont.append(t); setTimeout(() => t.remove(), 1200); marcarActivo(rol);
  }
  function detectarEventos() {
    if (!S.ronda) return;
    const n = S.ronda.numero; const nuevos = [];
    (S.mensajes || []).forEach((m) => { const k = `${n}:m:${m.id}`; if (!vistos.has(k)) { vistos.add(k); nuevos.push({ ord: m.t, fn: () => animarMensaje(m) }); } });
    (S.alertas || []).forEach((a) => { const k = `${n}:a:${a.id}`; if (!vistos.has(k)) { vistos.add(k); nuevos.push({ ord: a.t, fn: () => destello(a.rol, 'bi-lightning-charge-fill') }); } });
    const det = detalleRonda(n);
    (det ? det.pedidos : []).forEach((p) => { const k = `${n}:e:${p.n}`; if (p.enviado && !vistos.has(k)) { vistos.add(k); nuevos.push({ ord: p.enviadoAt || Date.now(), fn: () => destello('operativo', p.puntos === S.maxPorPedido ? 'bi-check-circle-fill' : 'bi-send-fill') }); } });
    if (primera) { primera = false; return; }
    nuevos.sort((a, b) => a.ord - b.ord).slice(-8).forEach((e, i) => setTimeout(e.fn, i * 260));
  }

  /* ---------- Recorrido de cada dato ---------- */
  function celda(est, key, etiqueta, fijo) {
    const b = el('button', { type: 'button', class: `cell ${est === 'vacio' ? '' : est}${selCelda === key ? ' sel' : ''}${fijo ? ' fijo' : ''}`, 'aria-label': etiqueta }, ICONO_ESTADO[est] ? ic(ICONO_ESTADO[est]) : null);
    if (!fijo) b.addEventListener('click', () => { selCelda = key; pintarHeat(); });
    return el('td', {}, b);
  }
  function pintarHeat() {
    const tabla = $('heat'); tabla.replaceChildren(); const det$ = $('det'); det$.replaceChildren();
    const r = S.ronda;
    if (!r) { tabla.append(el('tr', {}, el('td', { class: 'text-body-secondary small' }, 'Aún no hay datos.'))); return; }
    const pN = selPedido || r.pedidoActual; const det = detalleRonda(r.numero); const ped = det ? det.pedidos.find((p) => p.n === pN) : null;
    const sal = salidas(msgsDe(r.numero, pN));
    tabla.append(el('tr', {}, el('th', {}, ''), ORDEN.map((rol) => el('th', { title: NOMBRE_ROL[rol] }, icRol(rol))), el('th', { title: 'Despacho enviado' }, ic('bi-send'))));
    CAMPOS_ORDEN.forEach((c) => {
      const fila = el('tr', {}, el('th', { title: S.campos[c].label }, ic(ICON_CAMPO[c])));
      ORDEN.forEach((rol) => { const o = sal[rol][c]; fila.append(celda(!o ? 'vacio' : estadoValor(o.valor, c, ped), `${rol}:${c}`, `${NOMBRE_ROL[rol]}, ${S.campos[c].label}`)); });
      const env = ped && ped.enviado ? ped.enviado[c] : null;
      fila.append(celda(env == null ? 'vacio' : (ped.correctos && ped.correctos[c] ? 'ok' : 'bad'), `envio:${c}`, `Enviado, ${S.campos[c].label}`));
      tabla.append(fila);
    });
    if (selCelda) {
      const [quien, c] = selCelda.split(':'); const real = ped && ped.real ? ped.real[c] : null;
      if (quien === 'envio') {
        const env = ped && ped.enviado ? ped.enviado[c] : null;
        det$.append(el('span', { class: 'dato' }, ic('bi-send'), env == null ? 'sin enviar' : env), ic('bi-arrow-right', 'mx-1'), chip(c, real || '—', 'ok'), el('span', { class: 'small text-body-secondary ms-1' }, 'valor real'));
      } else {
        const o = sal[quien][c];
        det$.append(el('span', { class: 'dato' }, icRol(quien), NOMBRE_ROL[quien].split(' ')[0]), o ? el('span', { class: 'dato t-' + o.tipo }, icTipo(o.tipo), ic(ICON_CAMPO[c]), o.valor) : el('span', { class: 'dato' }, ic('bi-slash-circle'), 'nada todavía'), ic('bi-arrow-right', 'mx-1'), chip(c, real || '—', 'ok'), el('span', { class: 'small text-body-secondary ms-1' }, 'valor real'));
      }
    } else det$.append(el('span', { class: 'small text-body-secondary' }, ic('bi-hand-index', 'me-1'), 'Toca una celda. Verde: correcto. Rojo: error. Amarillo: dato desactualizado.'));
  }

  /* ---------- Actividad ---------- */
  function pintarTicker() {
    const t = $('ticker'); t.replaceChildren(); const r = S.ronda; if (!r) return;
    const det = detalleRonda(r.numero); const ev = [];
    (S.mensajes || []).forEach((m) => ev.push({ t: m.t, nodo: () => [icTipo(m.tipo), icRol(m.de), ic('bi-arrow-right', 'text-body-secondary'), m.a === 'todos' ? ic('bi-people') : icRol(m.a),
      ...Object.entries(m.datos || {}).map(([c, v]) => chip(c, v, 't-' + m.tipo)), m.texto ? el('span', { class: 'small' }, m.texto) : null, el('span', { class: 'badge text-bg-light border' }, `P${m.pedidoN}`)] }));
    (S.alertas || []).forEach((a) => ev.push({ t: a.t, nodo: () => [ic('bi-lightning-charge-fill', 'text-primary'), icRol(a.rol), chip(a.campo, a.nuevo, 'nuevo'), el('span', { class: 'badge text-bg-light border' }, `P${a.pedidoN}`)] }));
    (det ? det.pedidos : []).filter((p) => p.enviado).forEach((p) => ev.push({ t: p.enviadoAt || 0, nodo: () => [ic(p.puntos === S.maxPorPedido ? 'bi-check-circle-fill text-success' : 'bi-send-fill text-warning'), icRol('operativo'), el('b', {}, `${p.puntos}/${S.maxPorPedido}`), el('span', { class: 'badge text-bg-light border' }, `P${p.n}`)] }));
    ev.sort((a, b) => b.t - a.t).slice(0, 14).forEach((e) => t.append(el('div', { class: 'ev d-flex align-items-center flex-wrap gap-1 py-1 border-bottom' }, el('span', { class: 't tabular' }, mmss(e.t - r.inicio)), ...e.nodo())));
    if (!ev.length) t.append(el('span', { class: 'text-body-secondary small' }, 'Sin actividad todavía.'));
  }

  /* ---------- Panel lateral por eslabón ---------- */
  function abrirDrawer(rol, silencioso) {
    drawerRol = rol;
    const j = rolDe(S.jugadores, rol); const r = S.ronda;
    $('drawerTitulo').replaceChildren(icRol(rol, 'me-2'), NOMBRE_ROL[rol]);
    const body = $('drawerBody'); body.replaceChildren();
    body.append(el('div', { class: 'd-flex align-items-center gap-2 mb-2' }, el('span', { class: 'dato' }, ic(j ? (j.bot ? 'bi-robot' : 'bi-person') : 'bi-slash-circle'), j ? j.alias : 'vacío'),
      j ? ic('bi-circle-fill ' + (j.bot || j.conectado ? 'text-success' : 'text-danger'), 'small') : null),
      j && j.puesto ? el('div', { class: 'small text-body-secondary mb-2' }, 'Su trabajo real se parece a: ', el('span', { class: 'dato' }, icRol(j.puesto), NOMBRE_ROL[j.puesto])) : null);
    if (CAMPOS_DE[rol].length) {
      const det = r ? detalleRonda(r.numero) : null; const ped = det ? det.pedidos.find((p) => p.n === (selPedido || r.pedidoActual)) : null;
      body.append(el('div', { class: 'mb-3' }, CAMPOS_DE[rol].map((c) => chip(c, ped && ped.real ? ped.real[c] : '·', 'lg'))));
    }
    const lista = (S.mensajes || []).filter((m) => m.de === rol || m.a === rol || m.a === 'todos').slice(-30).reverse();
    body.append(el('h3', { class: 'h6 text-uppercase text-body-secondary' }, ic('bi-clock-history', 'me-1'), 'Mensajes'),
      el('div', { class: 'list-group list-group-flush' }, lista.length ? lista.map((m) => el('div', { class: 'list-group-item px-0 d-flex flex-wrap align-items-center gap-1' }, icTipo(m.tipo), icRol(m.de), ic('bi-arrow-right', 'text-body-secondary'), m.a === 'todos' ? ic('bi-people') : icRol(m.a), Object.entries(m.datos || {}).map(([c, v]) => chip(c, v, 't-' + m.tipo)), m.texto ? el('span', { class: 'small' }, m.texto) : null))
        : [el('div', { class: 'text-body-secondary small' }, 'Sin mensajes todavía.')]));
    if (!silencioso) drawer.show();
  }

  /* ---------- Comparar ---------- */
  function pintarComparar() {
    const c = $('cmp'); c.replaceChildren();
    const res = S.resumenes; if (!res.length) { c.append(el('div', { class: 'card card-body text-body-secondary' }, 'Aún no hay rondas terminadas.')); return; }
    const fila = el('div', { class: 'row g-3 mb-3' });
    res.forEach((x) => {
      fila.append(el('div', { class: 'col-md-6' }, el('div', { class: 'card shadow-sm h-100' }, el('div', { class: 'card-body' },
        el('div', { class: 'd-flex align-items-center gap-2 mb-2' }, el('span', { class: 'badge fs-6 ' + (x.numero === 1 ? 'text-bg-secondary' : 'text-bg-primary') }, `Ronda ${x.numero}`, ic(x.modo === 'notas' ? 'bi-arrow-right' : 'bi-chat-dots', 'ms-2')), el('span', { class: 'flex-grow-1' }), el('span', { class: 'score tabular' }, String(x.puntos)), el('span', { class: 'text-body-secondary' }, `/${x.max}`)),
        el('div', { class: 'progress mb-2', role: 'progressbar', 'aria-valuenow': x.puntos, 'aria-valuemin': 0, 'aria-valuemax': x.max }, el('div', { class: 'progress-bar ' + (x.numero === 1 ? 'bg-secondary' : 'bg-primary'), style: `width:${x.puntos / x.max * 100}%` })),
        el('div', { class: 'mb-2' }, el('span', { class: 'dato' }, ic('bi-check-circle'), `${x.perfectos}/${x.pedidosTotal}`), el('span', { class: 'dato' }, ic('bi-envelope'), String(x.mensajes)), el('span', { class: 'dato' }, ic('bi-pencil'), String(x.correcciones)), el('span', { class: 'dato' }, ic('bi-stopwatch'), mmss(x.duracionSeg * 1000))),
        pedidoMapa(x.numero)))));
    });
    c.append(fila);
    if (res.length === 2) {
      const [a, b] = res; const diff = b.puntos - a.puntos;
      const errA = CAMPOS_ORDEN.reduce((s, k) => s + a.erroresPorCampo[k], 0), errB = CAMPOS_ORDEN.reduce((s, k) => s + b.erroresPorCampo[k], 0);
      const metrica = (icono, titulo, va, vb, max) => el('div', { class: 'metric d-flex align-items-center gap-3 mb-2' }, ic(icono, 'fs-4 text-body-secondary'), el('span', { class: 'visually-hidden' }, titulo),
        el('div', { class: 'bars' }, el('div', { class: 'progress mb-1', style: 'height:12px' }, el('div', { class: 'progress-bar bg-secondary', style: `width:${max ? va / max * 100 : 0}%` })), el('div', { class: 'progress', style: 'height:12px' }, el('div', { class: 'progress-bar bg-primary', style: `width:${max ? vb / max * 100 : 0}%` }))),
        el('div', { class: 'fw-bold tabular text-end', style: 'min-width:64px' }, `${va} a ${vb}`));
      c.append(el('div', { class: 'card shadow-sm mb-3' }, el('div', { class: 'card-body' },
        el('div', { class: 'd-flex align-items-center mb-2' }, el('h2', { class: 'h6 text-uppercase text-body-secondary flex-grow-1 mb-0' }, ic('bi-arrow-left-right', 'me-1'), 'Ronda 1 frente a ronda 2'),
          el('span', { class: 'badge ' + (diff > 0 ? 'text-bg-success' : diff < 0 ? 'text-bg-danger' : 'text-bg-secondary') }, ic(diff > 0 ? 'bi-arrow-up' : diff < 0 ? 'bi-arrow-down' : 'bi-dash', 'me-1'), `${Math.abs(diff)} puntos`)),
        metrica('bi-bullseye', 'Puntos', a.puntos, b.puntos, Math.max(a.max, b.max)), metrica('bi-check-circle', 'Despachos perfectos', a.perfectos, b.perfectos, Math.max(a.pedidosTotal, b.pedidosTotal)),
        metrica('bi-x-circle', 'Datos errados', errA, errB, Math.max(errA, errB, 1)), metrica('bi-envelope', 'Mensajes', a.mensajes, b.mensajes, Math.max(a.mensajes, b.mensajes, 1)),
        el('div', { class: 'd-flex align-items-center flex-wrap gap-1 mt-2' }, el('span', { class: 'small text-body-secondary' }, 'Dato más errado:'),
          ...res.map((x) => { const top = CAMPOS_ORDEN.slice().sort((p, q) => x.erroresPorCampo[q] - x.erroresPorCampo[p])[0]; return el('span', { class: 'dato' }, `R${x.numero}`, ic(ICON_CAMPO[top]), x.erroresPorCampo[top] ? `x${x.erroresPorCampo[top]}` : 'sin errores'); })),
        el('p', { class: 'small text-body-secondary mt-3 mb-0' }, 'Simulación con pocas personas y sin grupo de comparación: sirve para conversar, no para probar una mejora.'))));
    }
  }
  function pedidoMapa(numero) {
    const det = detalleRonda(numero); const t = el('table', { class: 'heat' });
    if (!det) return t;
    t.append(el('tr', {}, el('th', {}, ''), det.pedidos.map((p) => el('th', {}, 'P' + p.n))));
    CAMPOS_ORDEN.forEach((c) => {
      t.append(el('tr', {}, el('th', { title: S.campos[c].label }, ic(ICON_CAMPO[c])), det.pedidos.map((p) => {
        const est = p.enviado ? (p.correctos[c] ? 'ok' : 'bad') : 'vacio';
        const tip = p.enviado ? `${S.campos[c].label}: enviado "${p.enviado[c]}", real "${p.real[c]}"` : 'sin enviar';
        return el('td', {}, el('span', { class: `cell fijo ${est === 'vacio' ? '' : est}`, title: tip }, ICONO_ESTADO[est] ? ic(ICONO_ESTADO[est]) : null));
      })));
    });
    return el('div', { class: 'table-responsive' }, t);
  }

  setInterval(() => { if (auto && S && S.fase === 'ronda') enviar('incidente'); }, 40000);
})();
