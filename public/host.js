(function () {
  'use strict';
  const { el, mmss, toast, ICON_ROL, ICON_CAMPO, ICON_TIPO, COLOR_TIPO, NOMBRE_ROL, ORDEN, CAMPOS_ORDEN } = DX;
  const KEY = 'dx_host';
  const SVGNS = 'http://www.w3.org/2000/svg';
  const CAMPOS_DE = { atencion: ['destino', 'horario'], planificacion: ['producto', 'cantidad'], almacen: ['anden'], transporte: ['unidad'], seguridad: ['restriccion'], operativo: [] };
  const NX = (i) => 90 + i * 156, NY = 120;

  let S = null, offset = 0, vista = 'vivo', selPedido = null, selCelda = null, sala = null;
  let vistos = new Set(), primera = true, rondaVista = null, auto = false;
  const $ = (id) => document.getElementById(id);
  const actTimers = {};

  /* ---------- Conexión ---------- */
  try { sala = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { sala = null; }
  const net = DX.conectar({
    onAbrir() { $('conn').textContent = '🟢'; if (sala) net.enviar({ t: 'host:entrar', code: sala.code, token: sala.token }); else net.enviar({ t: 'host:crear' }); },
    onCerrar() { $('conn').textContent = '🔴 reconectando…'; },
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
    try { await navigator.clipboard.writeText(urlJugadores()); toast('Enlace copiado'); } catch { toast(urlJugadores()); }
  });
  $('nueva').addEventListener('click', () => { if (confirm('¿Crear una sala nueva? La actual se perderá.')) { sala = null; try { localStorage.removeItem(KEY); } catch { /* ignorar */ } vistos = new Set(); primera = true; enviar('host:crear'); } });
  $('tabVivo').addEventListener('click', () => { vista = 'vivo'; render(); });
  $('tabCmp').addEventListener('click', () => { vista = 'cmp'; render(); });

  /* ---------- Cálculos ---------- */
  const rolDe = (jugadores, rol) => jugadores.find((j) => j.roles.includes(rol));
  const rondaActual = () => (S && S.ronda ? S.ronda.numero : null);
  const detalleRonda = (n) => (S.detalle || []).find((d) => d.numero === n);
  const msgsDe = (n, pedidoN) => (n === rondaActual() ? S.mensajes : []).filter((m) => m.pedidoN === pedidoN);

  /** ¿El valor comunicado coincide con la realidad? ok | stale | bad */
  function estadoValor(valor, campo, ped) {
    if (!ped || !ped.real) return 'vacio';
    if (valor === ped.real[campo]) return 'ok';
    const inc = (ped.incidentes || []).find((x) => x.campo === campo);
    if (inc && valor === inc.anterior) return 'stale';
    return 'bad';
  }
  /** Último valor que salió de cada eslabón, por campo, en un pedido. */
  function salidas(msgs, modo) {
    const out = {}; ORDEN.forEach((r) => { out[r] = {}; });
    for (const m of msgs) {
      if (!m.datos) continue;
      if (m.tipo === 'eco' && m.de !== 'operativo') continue;
      for (const [c, v] of Object.entries(m.datos)) out[m.de][c] = { valor: v, tipo: m.tipo, t: m.t };
    }
    return out;
  }

  /* ---------- Render principal ---------- */
  function render() {
    if (!S || S.tipo !== 'host') return;
    $('codigo').textContent = S.code;
    $('link').textContent = location.host + '/?c=' + S.code;
    pintarEquipo(); pintarControles();
    const hayRondas = S.resumenes.length > 0;
    $('tabCmp').disabled = !hayRondas;
    if (S.fase === 'final' && vista === 'vivo' && !render.yaMostroCmp) { vista = 'cmp'; render.yaMostroCmp = true; }
    if (S.fase === 'lobby') render.yaMostroCmp = false;
    $('tabVivo').classList.toggle('on', vista === 'vivo'); $('tabCmp').classList.toggle('on', vista === 'cmp');
    $('vivo').hidden = vista !== 'vivo'; $('cmp').hidden = vista !== 'cmp';
    if (rondaVista !== rondaActual()) { rondaVista = rondaActual(); selPedido = null; selCelda = null; }
    if (vista === 'vivo') { pintarFranja(); construirCadena(); actualizarCadena(); pintarHeat(); pintarTicker(); detectarEventos(); }
    else pintarComparar();
    if ($('drawer').classList.contains('open') && render.drawerRol) abrirDrawer(render.drawerRol, true);
  }

  /* ---------- Equipo ---------- */
  function pintarEquipo() {
    const cont = $('seats'); cont.replaceChildren();
    ORDEN.forEach((rol) => {
      const j = rolDe(S.jugadores, rol);
      const nodo = el('button', { type: 'button', class: 'seat' + (j ? '' : ' vacio'), 'data-rol': rol, id: 'seat_' + rol, onclick: () => abrirDrawer(rol) },
        j ? el('span', { class: 'dot ' + (j.bot || j.conectado ? 'on' : 'off') }) : null, j && j.bot ? el('span', { class: 'bot' }, '🤖') : null,
        el('div', { class: 'ic' }, ICON_ROL[rol]), el('div', { class: 'rn' }, NOMBRE_ROL[rol]), el('div', { class: 'al' }, j ? j.alias : (S.fase === 'lobby' ? '—' : 'vacío')));
      cont.append(nodo);
    });
    if (S.fase === 'lobby') {
      // Antes de asignar roles, mostrar quién ya entró
      const sinRol = S.jugadores.filter((j) => !j.roles.length);
      if (sinRol.length) {
        cont.replaceChildren(...sinRol.map((j) => el('div', { class: 'seat' }, j.bot ? el('span', { class: 'bot' }, '🤖') : null, el('span', { class: 'dot ' + (j.bot || j.conectado ? 'on' : 'off') }), el('div', { class: 'ic' }, j.bot ? '🤖' : '🙂'), el('div', { class: 'al' }, j.alias))));
      }
    }
  }

  /* ---------- Controles ---------- */
  function boton(txt, cls, fn, extra) { return el('button', { type: 'button', class: 'btn ' + (cls || ''), onclick: fn, ...(extra || {}) }, txt); }
  function pintarControles() {
    const c = $('ctrl'); c.replaceChildren(); const cfg = $('cfg'); cfg.replaceChildren();
    const n = S.jugadores.filter((j) => !j.observador).length;
    if (S.fase === 'lobby') {
      c.append(boton('🤖 Completar con bots', 'ghost', () => enviar('bots')), boton('🧹 Quitar bots', 'ghost', () => enviar('quitarbots')),
        boton('▶ Iniciar ronda 1', n < 2 ? 'off' : '', () => enviar('iniciar'), { 'data-accion': 'iniciar' }));
    } else if (S.fase === 'ronda') {
      c.append(boton('⚡ Incidente', '', () => enviar('incidente'), { 'data-accion': 'incidente' }), boton('⏹ Cerrar ronda', 'danger', () => enviar('cerrar'), { 'data-accion': 'cerrar' }));
      c.append(boton(auto ? '⚡ Auto: sí' : '⚡ Auto: no', 'ghost', () => { auto = !auto; pintarControles(); }));
    } else if (S.fase === 'entre') {
      c.append(boton(`▶ Iniciar ronda ${S.resumenes.length + 1}`, '', () => enviar('iniciar'), { 'data-accion': 'iniciar' }));
    } else if (S.fase === 'final') {
      c.append(boton('↺ Nueva partida', '', () => enviar('reiniciar'), { 'data-accion': 'reiniciar' }));
    }
    if (S.resumenes.length) c.append(el('a', { class: 'btn ghost', href: `/api/export?code=${S.code}&token=${sala ? sala.token : ''}`, download: '' }, '⬇ CSV'));
    if (S.fase === 'lobby' || S.fase === 'entre') {
      const mins = Math.round(S.config.rondaSeg / 60);
      cfg.append(
        el('div', { class: 'stepper' }, el('span', {}, '⏱ Ronda'), boton('−', 'ghost', () => enviar('config', { rondaSeg: Math.max(60, S.config.rondaSeg - 60), pedidos: S.config.pedidos }), { 'aria-label': 'Menos tiempo' }), el('b', {}, mins + ' min'), boton('+', 'ghost', () => enviar('config', { rondaSeg: Math.min(1200, S.config.rondaSeg + 60), pedidos: S.config.pedidos }), { 'aria-label': 'Más tiempo' })),
        el('div', { class: 'stepper' }, el('span', {}, '📋 Pedidos'), boton('−', 'ghost', () => enviar('config', { rondaSeg: S.config.rondaSeg, pedidos: Math.max(1, S.config.pedidos - 1) }), { 'aria-label': 'Menos pedidos' }), el('b', {}, S.config.pedidos), boton('+', 'ghost', () => enviar('config', { rondaSeg: S.config.rondaSeg, pedidos: Math.min(8, S.config.pedidos + 1) }), { 'aria-label': 'Más pedidos' })));
    }
  }

  /* ---------- Franja: reloj, ronda, pedidos, puntaje ---------- */
  function pintarFranja() {
    const f = $('strip'); f.replaceChildren();
    const r = S.ronda;
    if (!r) {
      f.append(el('div', {}, el('h2', {}, '⏳ Esperando jugadores'), el('div', { class: 'flex' }, el('span', { class: 'badgeR' }, `👥 ${S.jugadores.length}`), el('span', { class: 'muted small' }, 'Comparte el código con el equipo'))));
      return;
    }
    const det = detalleRonda(r.numero); const peds = det ? det.pedidos : [];
    const ring = el('div', { class: 'ring' });
    const svg = document.createElementNS(SVGNS, 'svg'); svg.setAttribute('viewBox', '0 0 100 100'); svg.setAttribute('width', '84'); svg.setAttribute('height', '84');
    const bg = document.createElementNS(SVGNS, 'circle'); bg.setAttribute('cx', 50); bg.setAttribute('cy', 50); bg.setAttribute('r', 42); bg.setAttribute('fill', 'none'); bg.setAttribute('stroke', 'var(--line)'); bg.setAttribute('stroke-width', 10);
    const fg = document.createElementNS(SVGNS, 'circle'); fg.id = 'ringFg'; fg.setAttribute('cx', 50); fg.setAttribute('cy', 50); fg.setAttribute('r', 42); fg.setAttribute('fill', 'none'); fg.setAttribute('stroke', 'var(--orange)'); fg.setAttribute('stroke-width', 10); fg.setAttribute('stroke-linecap', 'round'); fg.setAttribute('stroke-dasharray', '263.9'); fg.setAttribute('stroke-dashoffset', '0');
    svg.append(bg, fg); ring.append(svg, el('div', { class: 'tx', id: 'ringTx' }, '--:--'));
    const badge = el('span', { class: 'badgeR' }, `R${r.numero}`, ' ', r.modo === 'notas' ? '➡️' : '💬');
    const dots = el('div', { class: 'pdots', role: 'group', 'aria-label': 'Pedidos' });
    peds.forEach((p) => {
      let cls = 'pd'; let txt = String(p.n);
      if (p.enviado) { cls += p.puntos === S.maxPorPedido ? ' ok' : ' mal'; txt = p.puntos === S.maxPorPedido ? '✓' : String(p.n); }
      else if (r.estado === 'activa' && p.n === r.pedidoActual) cls += ' act';
      if ((selPedido || r.pedidoActual) === p.n) cls += ' sel';
      dots.append(el('button', { type: 'button', class: cls, 'aria-label': `Pedido ${p.n}`, onclick: () => { selPedido = p.n; selCelda = null; render(); } }, txt));
    });
    const puntos = peds.reduce((s, p) => s + (p.enviado ? p.puntos : 0), 0);
    f.append(r.estado === 'activa' ? ring : el('div', { class: 'badgeR' }, r.motivo === 'completa' ? '🏁' : '⏹'), el('div', {}, badge), dots,
      el('div', { class: 'grow' }), el('div', { style: 'text-align:right' }, el('div', { class: 'score' }, `${puntos}`), el('div', { class: 'small muted' }, `/ ${peds.length * S.maxPorPedido}`)));
    actualizarReloj();
  }
  function actualizarReloj() {
    const r = S && S.ronda; const tx = $('ringTx'), fg = $('ringFg');
    if (!r || r.estado !== 'activa' || !tx || !fg) return;
    const rest = r.fin - (Date.now() + offset), total = r.fin - r.inicio;
    tx.textContent = mmss(rest);
    fg.setAttribute('stroke-dashoffset', String(263.9 * (1 - Math.max(0, Math.min(1, rest / total)))));
    fg.setAttribute('stroke', rest < total * 0.2 ? 'var(--bad)' : 'var(--orange)');
  }
  setInterval(actualizarReloj, 250);

  /* ---------- Recorrido (SVG) ---------- */
  function svgEl(tag, attrs, ...kids) {
    const n = document.createElementNS(SVGNS, tag);
    for (const [k, v] of Object.entries(attrs || {})) n.setAttribute(k, v);
    kids.flat().forEach((k) => { if (k != null) n.append(k.nodeType ? k : document.createTextNode(k)); });
    return n;
  }
  function construirCadena() {
    const svg = $('cadena'); if (svg.dataset.listo) return; svg.dataset.listo = '1';
    const defs = svgEl('defs', {}, svgEl('marker', { id: 'flecha', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, svgEl('path', { d: 'M0,0 L10,5 L0,10 z', fill: 'var(--navy2)' })));
    const aristas = svgEl('g', { id: 'gAristas' });
    for (let i = 0; i < 5; i++) aristas.append(svgEl('line', { class: 'arista', x1: NX(i) + 44, y1: NY, x2: NX(i + 1) - 46, y2: NY, 'marker-end': 'url(#flecha)' }));
    const nodos = svgEl('g', { id: 'gNodos' });
    ORDEN.forEach((rol, i) => {
      const g = svgEl('g', { class: 'nodo vacio', 'data-rol': rol, id: 'nodo_' + rol, tabindex: 0, role: 'button', 'aria-label': NOMBRE_ROL[rol] });
      g.append(svgEl('circle', { class: 'base', cx: NX(i), cy: NY, r: 40 }), svgEl('text', { class: 'emo', x: NX(i), y: NY + 2 }, ICON_ROL[rol]),
        svgEl('text', { class: 'nm', x: NX(i), y: NY + 70 }, NOMBRE_ROL[rol]), svgEl('text', { class: 'al', x: NX(i), y: NY + 88, id: 'al_' + rol }, ''));
      CAMPOS_DE[rol].forEach((c, k) => g.append(svgEl('text', { class: 'cv nada', x: NX(i), y: NY + 112 + k * 18, id: `cv_${rol}_${c}` }, '')));
      g.addEventListener('click', () => abrirDrawer(rol)); g.addEventListener('keydown', (e) => { if (e.key === 'Enter') abrirDrawer(rol); });
      nodos.append(g);
    });
    svg.append(defs, aristas, nodos, svgEl('g', { id: 'gCapa' }));
  }
  function actualizarCadena() {
    const r = S.ronda; const pN = selPedido || (r ? r.pedidoActual : 1);
    const det = r ? detalleRonda(r.numero) : null; const ped = det ? det.pedidos.find((p) => p.n === pN) : null;
    const sal = salidas(r ? msgsDe(r.numero, pN) : [], r && r.modo);
    ORDEN.forEach((rol) => {
      const j = rolDe(S.jugadores, rol); const g = $('nodo_' + rol);
      g.classList.toggle('vacio', !j); $('al_' + rol).textContent = j ? (j.alias.length > 14 ? j.alias.slice(0, 13) + '…' : j.alias) : '';
      CAMPOS_DE[rol].forEach((c) => {
        const t = $(`cv_${rol}_${c}`); const real = ped && ped.real ? ped.real[c] : null;
        const out = sal[rol][c]; const est = !real ? 'nada' : !out ? 'nada' : estadoValor(out.valor, c, ped);
        t.setAttribute('class', 'cv ' + est); const v = real || '·';
        t.textContent = `${ICON_CAMPO[c]} ${v.length > 15 ? v.slice(0, 14) + '…' : v}`;
      });
    });
  }
  function pos(rol) { const i = ORDEN.indexOf(rol); return [NX(i), NY]; }
  function marcarActivo(rol) {
    const g = $('nodo_' + rol), s = $('seat_' + rol); if (!g) return;
    g.classList.add('act'); if (s) s.classList.add('act');
    clearTimeout(actTimers[rol]); actTimers[rol] = setTimeout(() => { g.classList.remove('act'); if (s) s.classList.remove('act'); }, 1400);
  }
  function animarMensaje(m) {
    const capa = $('gCapa'); if (!capa) return;
    const color = COLOR_TIPO[m.tipo] || '#666'; const [x1, y1] = pos(m.de);
    marcarActivo(m.de);
    if (m.a === 'todos') {
      const onda = svgEl('circle', { class: 'onda', cx: x1, cy: y1, r: 40, stroke: color }); capa.append(onda); setTimeout(() => onda.remove(), 1100);
      ORDEN.filter((x) => x !== m.de).forEach((x) => marcarActivo(x));
      return;
    }
    const [x2, y2] = pos(m.a);
    const p = svgEl('g', { class: 'paq' }, svgEl('circle', { r: 18, fill: color, opacity: 0.95 }), svgEl('text', {}, ICON_TIPO[m.tipo] || '💬'));
    p.style.transform = `translate(${x1}px,${y1}px)`; capa.append(p);
    const a = p.animate([{ transform: `translate(${x1}px,${y1}px)` }, { transform: `translate(${x2}px,${y2}px)` }], { duration: 900, easing: 'ease-in-out', fill: 'forwards' });
    a.onfinish = () => { marcarActivo(m.a); p.remove(); };
  }
  function animarIncidente(al) {
    const capa = $('gCapa'); if (!capa) return; const [x, y] = pos(al.rol);
    const t = svgEl('text', { class: 'rayo', x, y: y - 30 }, '⚡'); capa.append(t); setTimeout(() => t.remove(), 1200); marcarActivo(al.rol);
  }
  function animarEnvio(info) {
    const capa = $('gCapa'); if (!capa) return; const [x, y] = pos('operativo');
    const t = svgEl('text', { class: 'rayo', x, y: y - 30 }, info.perfecto ? '✅' : '📤'); capa.append(t); setTimeout(() => t.remove(), 1200); marcarActivo('operativo');
  }
  function detectarEventos() {
    if (!S.ronda) return;
    const n = S.ronda.numero; const nuevos = [];
    (S.mensajes || []).forEach((m) => { const k = `${n}:m:${m.id}`; if (!vistos.has(k)) { vistos.add(k); nuevos.push({ ord: m.t, fn: () => animarMensaje(m) }); } });
    (S.alertas || []).forEach((a) => { const k = `${n}:a:${a.id}`; if (!vistos.has(k)) { vistos.add(k); nuevos.push({ ord: a.t, fn: () => animarIncidente(a) }); } });
    const det = detalleRonda(n);
    (det ? det.pedidos : []).forEach((p) => { const k = `${n}:e:${p.n}`; if (p.enviado && !vistos.has(k)) { vistos.add(k); nuevos.push({ ord: p.enviadoAt || Date.now(), fn: () => animarEnvio({ perfecto: p.puntos === S.maxPorPedido }) }); } });
    if (primera) { primera = false; return; }
    nuevos.sort((a, b) => a.ord - b.ord).slice(-8).forEach((e, i) => setTimeout(e.fn, i * 260));
  }

  /* ---------- Mapa de calor: recorrido de cada dato ---------- */
  function pintarHeat() {
    const tabla = $('heat'); tabla.replaceChildren(); const det$ = $('det');
    const r = S.ronda;
    if (!r) { tabla.append(el('tr', {}, el('td', { class: 'muted' }, '—'))); det$.textContent = ''; return; }
    const pN = selPedido || r.pedidoActual; const det = detalleRonda(r.numero); const ped = det ? det.pedidos.find((p) => p.n === pN) : null;
    const sal = salidas(msgsDe(r.numero, pN), r.modo);
    const head = el('tr', {}, el('th', {}, ''), ORDEN.map((rol) => el('th', { title: NOMBRE_ROL[rol] }, ICON_ROL[rol])), el('th', { title: 'Despacho enviado' }, '📤'));
    tabla.append(head);
    CAMPOS_ORDEN.forEach((c) => {
      const fila = el('tr', {}, el('th', { title: S.campos[c].label }, ICON_CAMPO[c]));
      ORDEN.forEach((rol) => {
        const o = sal[rol][c]; const est = !o ? 'vacio' : estadoValor(o.valor, c, ped);
        const marca = est === 'ok' ? '✓' : est === 'bad' ? '✗' : est === 'stale' ? '↺' : '';
        const key = `${rol}:${c}`;
        fila.append(el('td', {}, el('button', { type: 'button', class: `cell ${est}${selCelda === key ? ' sel' : ''}`, 'aria-label': `${NOMBRE_ROL[rol]} · ${S.campos[c].label}`, onclick: () => { selCelda = key; pintarHeat(); } }, marca)));
      });
      const env = ped && ped.enviado ? ped.enviado[c] : null; const okEnv = env == null ? 'vacio' : (ped.correctos && ped.correctos[c] ? 'ok' : 'bad');
      const keyE = `envio:${c}`;
      fila.append(el('td', {}, el('button', { type: 'button', class: `cell ${okEnv}${selCelda === keyE ? ' sel' : ''}`, 'aria-label': `Enviado · ${S.campos[c].label}`, onclick: () => { selCelda = keyE; pintarHeat(); } }, env == null ? '' : okEnv === 'ok' ? '✓' : '✗')));
      tabla.append(fila);
    });
    // detalle de la celda elegida
    det$.replaceChildren();
    if (selCelda) {
      const [quien, c] = selCelda.split(':'); const real = ped && ped.real ? ped.real[c] : null;
      if (quien === 'envio') {
        const env = ped && ped.enviado ? ped.enviado[c] : null;
        det$.append(el('span', { class: 'chip' }, '📤', ' ', env == null ? 'sin enviar' : env), el('span', {}, '→'), el('span', { class: 'chip ok' }, '✔ real', ' ', real || '—'));
      } else {
        const o = sal[quien][c];
        det$.append(el('span', { class: 'chip' }, ICON_ROL[quien]), el('span', { class: 'chip t-' + (o ? o.tipo : '') }, o ? ICON_TIPO[o.tipo] : '∅', ' ', ICON_CAMPO[c], ' ', o ? o.valor : 'nada todavía'), el('span', {}, '→'), el('span', { class: 'chip ok' }, '✔ real', ' ', real || '—'));
      }
    } else det$.append(el('span', { class: 'muted small' }, '👆 Toca una celda · ✓ correcto · ✗ error · ↺ desactualizado'));
  }

  /* ---------- Actividad ---------- */
  function pintarTicker() {
    const t = $('ticker'); t.replaceChildren(); const r = S.ronda; if (!r) return;
    const det = detalleRonda(r.numero); const ev = [];
    (S.mensajes || []).forEach((m) => ev.push({ t: m.t, nodo: () => [el('span', { title: m.tipo }, ICON_TIPO[m.tipo]), el('span', {}, ICON_ROL[m.de]), el('span', { class: 'muted' }, '→'), el('span', {}, m.a === 'todos' ? '👥' : ICON_ROL[m.a]),
      ...Object.entries(m.datos || {}).map(([c, v]) => DX.chip(c, v, '', 't-' + m.tipo)), m.texto ? el('span', { class: 'small' }, m.texto) : null, el('span', { class: 'muted small' }, `P${m.pedidoN}`)] }));
    (S.alertas || []).forEach((a) => ev.push({ t: a.t, nodo: () => [el('span', {}, '⚡'), el('span', {}, ICON_ROL[a.rol]), DX.chip(a.campo, a.nuevo, 'new'), el('span', { class: 'muted small' }, `P${a.pedidoN}`)] }));
    (det ? det.pedidos : []).filter((p) => p.enviado).forEach((p) => ev.push({ t: p.enviadoAt || 0, nodo: () => [el('span', {}, p.puntos === S.maxPorPedido ? '✅' : '📤'), el('span', {}, ICON_ROL.operativo), el('b', {}, `${p.puntos}/${S.maxPorPedido}`), el('span', { class: 'muted small' }, `P${p.n}`)] }));
    ev.sort((a, b) => b.t - a.t).slice(0, 14).forEach((e) => t.append(el('div', { class: 'ev' }, el('span', { class: 't' }, mmss(e.t - r.inicio)), ...e.nodo())));
    if (!ev.length) t.append(el('span', { class: 'muted small' }, '—'));
  }

  /* ---------- Cajón por eslabón ---------- */
  function abrirDrawer(rol, silencioso) {
    const d = $('drawer'); render.drawerRol = rol; d.replaceChildren();
    const j = rolDe(S.jugadores, rol); const r = S.ronda;
    d.append(el('div', { class: 'flex' }, el('h2', { class: 'grow' }, `${ICON_ROL[rol]} ${NOMBRE_ROL[rol]}`), el('button', { class: 'btn ghost', type: 'button', 'aria-label': 'Cerrar', onclick: () => { d.classList.remove('open'); render.drawerRol = null; } }, '✕')),
      el('div', { class: 'flex' }, el('span', { class: 'chip' }, j ? (j.bot ? '🤖' : '🙂') : '∅', ' ', j ? j.alias : 'vacío'), j ? el('span', { class: 'dot ' + (j.bot || j.conectado ? 'on' : 'off') }) : null),
      CAMPOS_DE[rol].length ? el('div', {}, CAMPOS_DE[rol].map((c) => { const det = r ? detalleRonda(r.numero) : null; const ped = det ? det.pedidos.find((p) => p.n === (selPedido || r.pedidoActual)) : null; return DX.chip(c, ped && ped.real ? ped.real[c] : '·'); })) : null);
    const lista = (S.mensajes || []).filter((m) => m.de === rol || m.a === rol || m.a === 'todos').slice(-30).reverse();
    d.append(el('h3', {}, '🕒'), ...lista.map((m) => el('div', { class: 'ev', style: 'padding:4px 0;border-bottom:1px dashed var(--line)' }, el('span', {}, ICON_TIPO[m.tipo]), el('span', {}, ICON_ROL[m.de]), el('span', { class: 'muted' }, '→'), el('span', {}, m.a === 'todos' ? '👥' : ICON_ROL[m.a]), ...Object.entries(m.datos || {}).map(([c, v]) => DX.chip(c, v, '', 't-' + m.tipo)), m.texto ? el('span', { class: 'small' }, m.texto) : null)));
    d.classList.add('open'); if (!silencioso) d.scrollTop = 0;
  }

  /* ---------- Comparar ---------- */
  function pintarComparar() {
    const c = $('cmp'); c.replaceChildren();
    const res = S.resumenes; if (!res.length) { c.append(el('div', { class: 'card muted' }, '—')); return; }
    const cols = el('div', { class: 'cmp' });
    res.forEach((x) => {
      cols.append(el('div', { class: 'card' }, el('div', { class: 'flex' }, el('span', { class: 'badgeR' }, `R${x.numero}`, ' ', x.modo === 'notas' ? '➡️' : '💬'), el('span', { class: 'grow' }), el('span', { class: 'score' }, `${x.puntos}`), el('span', { class: 'muted' }, `/${x.max}`)),
        el('div', { class: 'bar' + (x.numero === 2 ? ' o' : '') }, el('i', { style: `width:${x.puntos / x.max * 100}%` })),
        el('div', { class: 'flex', style: 'margin-top:8px' }, el('span', { class: 'chip' }, `✅ ${x.perfectos}/${x.pedidosTotal}`), el('span', { class: 'chip' }, `✉️ ${x.mensajes}`), el('span', { class: 'chip' }, `✏️ ${x.correcciones}`), el('span', { class: 'chip' }, `⏱ ${mmss(x.duracionSeg * 1000)}`)),
        pedidoMapa(x.numero)));
    });
    c.append(cols);
    if (res.length === 2) {
      const [a, b] = res; const fila = (icono, va, vb, max) => el('div', { class: 'metric' }, el('div', { class: 'lb' }, icono),
        el('div', { class: 'bars' }, el('div', { class: 'bar' }, el('i', { style: `width:${max ? va / max * 100 : 0}%` })), el('div', { class: 'bar o', style: 'margin-top:4px' }, el('i', { style: `width:${max ? vb / max * 100 : 0}%` }))), el('div', { class: 'v' }, `${va}→${vb}`));
      const errA = CAMPOS_ORDEN.reduce((s, k) => s + a.erroresPorCampo[k], 0), errB = CAMPOS_ORDEN.reduce((s, k) => s + b.erroresPorCampo[k], 0);
      const diff = b.puntos - a.puntos;
      c.append(el('div', { class: 'card' }, el('div', { class: 'flex' }, el('h3', { class: 'grow' }, '⚖️ R1 → R2'), el('span', { class: 'chip ' + (diff > 0 ? 'ok' : diff < 0 ? 'bad' : '') }, `${diff > 0 ? '▲' : diff < 0 ? '▼' : '＝'} ${Math.abs(diff)} pts`)),
        fila('🎯', a.puntos, b.puntos, Math.max(a.max, b.max)), fila('✅', a.perfectos, b.perfectos, Math.max(a.pedidosTotal, b.pedidosTotal)), fila('❌', errA, errB, Math.max(errA, errB, 1)), fila('✉️', a.mensajes, b.mensajes, Math.max(a.mensajes, b.mensajes, 1)),
        el('div', { class: 'flex', style: 'margin-top:8px' }, el('span', { class: 'small muted' }, 'Campo más errado:'), ...res.map((x) => { const top = CAMPOS_ORDEN.slice().sort((p, q) => x.erroresPorCampo[q] - x.erroresPorCampo[p])[0]; return el('span', { class: 'chip' }, `R${x.numero}`, ' ', ICON_CAMPO[top], ' ', x.erroresPorCampo[top] ? `×${x.erroresPorCampo[top]}` : '—'); })),
        el('p', { class: 'small muted' }, 'Simulación con pocas personas y sin grupo de comparación: sirve para conversar, no para probar una mejora.')));
    }
  }
  function pedidoMapa(numero) {
    const det = detalleRonda(numero); const t = el('table', { class: 'heat' });
    if (!det) return t;
    t.append(el('tr', {}, el('th', {}, ''), det.pedidos.map((p) => el('th', {}, 'P' + p.n))));
    CAMPOS_ORDEN.forEach((c) => {
      t.append(el('tr', {}, el('th', { title: S.campos[c].label }, ICON_CAMPO[c]), det.pedidos.map((p) => {
        const est = p.enviado ? (p.correctos[c] ? 'ok' : 'bad') : 'vacio';
        const tip = p.enviado ? `${S.campos[c].label}: enviado "${p.enviado[c]}" · real "${p.real[c]}"` : 'sin enviar';
        return el('td', {}, el('span', { class: `cell ${est}`, title: tip, style: 'cursor:default' }, est === 'ok' ? '✓' : est === 'bad' ? '✗' : ''));
      })));
    });
    return t;
  }

  /* ---------- Incidentes automáticos opcionales ---------- */
  setInterval(() => { if (auto && S && S.fase === 'ronda') enviar('incidente'); }, 40000);
})();
