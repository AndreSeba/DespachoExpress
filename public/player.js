(function () {
  'use strict';
  const { el, chip, mmss, toast, ICON_ROL, ICON_CAMPO, ICON_TIPO, NOMBRE_ROL, ORDEN } = DX;
  const KEY = 'dx_jugador';
  const $app = document.getElementById('app');
  const $top = document.getElementById('top');
  let sesion = null;
  try { sesion = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { sesion = null; }
  const params = new URLSearchParams(location.search);
  let S = null, offset = 0, rolSel = null, claveAccion = '', enviadoLocal = {};
  const dirtySel = {};
  const refs = {};

  const net = DX.conectar({
    onAbrir() { if (sesion) net.enviar({ t: 'unirse', code: sesion.code, alias: sesion.alias, token: sesion.token }); else pintarUnirse(); },
    onMensaje(m) {
      if (m.t === 'unido') { sesion = { code: m.code, token: m.token, alias: sesion ? sesion.alias : '' }; guardar(); }
      else if (m.t === 'error') {
        if (m.codigo === 'sala') { sesion = null; guardar(); pintarUnirse(m.msg); } else toast(m.msg);
      } else if (m.t === 'estado') { S = m; offset = m.ahora - Date.now(); render(); }
    },
  });
  function guardar() { try { if (sesion) localStorage.setItem(KEY, JSON.stringify(sesion)); else localStorage.removeItem(KEY); } catch { /* ignorar */ } }

  /* ---------- Unirse ---------- */
  function pintarUnirse(error) {
    $top.hidden = true; claveAccion = '';
    const code = el('input', { type: 'text', maxlength: '4', inputmode: 'text', autocapitalize: 'characters', autocomplete: 'off', 'aria-label': 'Código de sala', value: (params.get('c') || '').toUpperCase(), style: 'text-transform:uppercase;letter-spacing:6px;text-align:center;font-weight:900;font-size:1.4rem' });
    const alias = el('input', { type: 'text', maxlength: '20', autocomplete: 'off', 'aria-label': 'Tu apodo', placeholder: 'Tu apodo' });
    const b = el('button', { class: 'btn block', type: 'button', onclick: () => {
      const c = code.value.trim().toUpperCase(), a = alias.value.trim();
      if (c.length !== 4 || !a) return toast('Escribe el código de 4 letras y tu apodo.');
      sesion = { code: c, token: null, alias: a };
      net.enviar({ t: 'unirse', code: c, alias: a });
    } }, '🚀 Entrar');
    $app.replaceChildren(
      el('div', { class: 'hero' }, el('h1', {}, '🚚 Despacho Express'), el('p', {}, 'Escribe el código que ves en la pantalla de la facilitadora.')),
      el('label', { class: 'f' }, el('span', {}, 'Código de sala'), code),
      el('label', { class: 'f' }, el('span', {}, 'Apodo (no uses tu nombre real)'), alias), b,
      error ? el('p', { class: 'small', style: 'color:var(--bad)' }, error) : null);
  }

  /* ---------- Utilidades ---------- */
  const nombre = (r) => NOMBRE_ROL[r] || r;
  const rolesYo = () => (S.yo ? S.yo.roles : []);
  function miRolActivo() {
    const rs = rolesYo();
    if (!rs.length) return null;
    if (!rolSel || !rs.includes(rolSel)) rolSel = rs[0];
    return rolSel;
  }
  const pedActual = () => (S.ronda ? S.ronda.pedidoActual : 1);
  function msgsPedido(tipo, filtro) {
    return (S.mensajes || []).filter((m) => m.pedidoN === pedActual() && (!tipo || m.tipo === tipo) && (!filtro || filtro(m)));
  }
  function chipsDatos(datos, estado) { return Object.entries(datos || {}).map(([c, v]) => chip(c, v, estado)); }
  function enviarMsg(obj) { net.enviar({ t: 'msg', ...obj }); }

  /* ---------- Render principal ---------- */
  function render() {
    if (!S || S.tipo !== 'jugador') return;
    $top.hidden = false;
    const rol = miRolActivo();
    document.getElementById('tRol').textContent = S.yo.observador ? '👀 Observador' : rol ? `${ICON_ROL[rol]} ${nombre(rol)}` : '⏳ Sala';
    const r = S.ronda;
    document.getElementById('tPed').textContent = r && r.estado === 'activa' ? `Ronda ${r.numero} · Pedido ${r.pedidoActual}/${r.pedidosTotal}` : '';
    if (S.fase === 'lobby') return pantallaLobby();
    if (r && r.estado === 'activa') return pantallaJuego(r, rol);
    return pantallaResultado();
  }

  function pantallaLobby() {
    claveAccion = '';
    document.getElementById('tTm').textContent = '';
    $app.replaceChildren(
      el('div', { class: 'hero' }, el('h2', {}, '⏳ Esperando a que empiece'), el('p', {}, `Sala ${S.code} · Eres ${S.yo.alias}`)),
      el('div', { class: 'card' }, el('h3', {}, 'En la sala'), el('div', { class: 'datos' }, S.jugadores.map((j) => el('span', { class: 'chip' }, j.bot ? '🤖' : '🙂', ' ', j.alias)))));
  }

  function pantallaResultado() {
    claveAccion = '';
    document.getElementById('tTm').textContent = '';
    const res = S.resumenes[S.resumenes.length - 1];
    const nodos = [el('div', { class: 'hero' }, el('h2', {}, S.fase === 'final' ? '🏁 Fin del juego' : '⏸ Ronda terminada'), el('p', {}, 'Mira la pantalla de la facilitadora.'))];
    if (res) {
      nodos.push(el('div', { class: 'card' }, el('h3', {}, `Ronda ${res.numero}`),
        el('div', { class: 'score' }, `${res.puntos}/${res.max}`), el('div', { class: 'bar' }, el('i', { style: `width:${res.puntos / res.max * 100}%` })),
        el('div', { class: 'datos', style: 'margin-top:8px' }, el('span', { class: 'chip' }, `✅ ${res.perfectos} perfectos`), el('span', { class: 'chip' }, `✉️ ${res.mensajes} mensajes`), el('span', { class: 'chip' }, `✏️ ${res.correcciones} correcciones`))));
    }
    $app.replaceChildren(...nodos);
  }

  function pantallaJuego(r, rol) {
    const nodos = [];
    // alertas de incidente para mis roles
    (S.alertas || []).filter((a) => a.pedidoN === r.pedidoActual).forEach((a) => {
      nodos.push(el('div', { class: 'alerta' }, el('b', {}, '⚡ Cambio: '), `${a.texto} `, chip(a.campo, a.nuevo, 'new')));
    });
    if (S.yo.observador || !rol) {
      nodos.push(el('div', { class: 'card feed' }, el('h3', {}, '👀 Lo que pasa'), ...(S.mensajes || []).slice(-14).reverse().map(filaMensaje)));
      $app.replaceChildren(...nodos); return;
    }
    // selector de rol si tengo varios
    if (rolesYo().length > 1) {
      nodos.push(el('div', { class: 'tabs' }, rolesYo().map((x) => el('button', { type: 'button', class: x === rol ? 'on' : '', onclick: () => { rolSel = x; claveAccion = ''; render(); } }, ICON_ROL[x], ' ', nombre(x)))));
    }
    // mis datos
    const mis = (S.misCampos || []).filter((c) => c.rol === rol);
    nodos.push(el('div', { class: 'card' }, el('h3', {}, 'Tus datos'),
      mis.length ? el('div', { class: 'datos' }, mis.map((c) => chip(c.campo, c.valor, 'big'))) : el('p', { class: 'muted' }, 'No conoces datos por tu cuenta: dependes de tus compañeros.')));
    // acción: se reconstruye solo si cambia la clave
    const clave = [r.numero, r.pedidoActual, rol, ultimoEcoId(), sigMensajes(r, rol), S.misCampos ? S.misCampos.map((c) => c.valor).join('|') : ''].join(':');
    if (clave !== claveAccion || !refs.accion) { refs.accion = construirAccion(r, rol); claveAccion = clave; }
    nodos.push(refs.accion);
    nodos.push(el('div', { class: 'card feed' }, el('h3', {}, r.modo === 'notas' ? '✉️ Notas recibidas' : '💬 Mesa'), ...(S.mensajes || []).filter((m) => m.pedidoN === r.pedidoActual).slice(-10).reverse().map(filaMensaje)));
    $app.replaceChildren(...nodos);
  }

  function filaMensaje(m) {
    return el('div', { class: 'm' }, el('span', {}, ICON_TIPO[m.tipo] || '💬'), el('span', {}, `${ICON_ROL[m.de]}`), el('span', { class: 'muted' }, '→'),
      el('span', {}, m.a === 'todos' ? '👥' : ICON_ROL[m.a]), chipsDatos(m.datos, 't-' + m.tipo), m.texto ? el('span', { class: 'small' }, m.texto) : null);
  }
  function sigMensajes(r, rol) {
    if (r.modo === 'notas') { const p = msgsPedido('nota', (m) => m.a === rol).pop(); return p ? p.id : ''; }
    if (rol === 'operativo') return msgsPedido(null, (m) => m.datos && m.tipo !== 'eco').length;
    return msgsPedido('tarjeta', (m) => m.de === rol).length;
  }
  const ultimoEco = () => msgsPedido('eco').pop();
  const ultimoEcoId = () => (S.ronda && S.ronda.modo === 'chat' && ultimoEco() ? ultimoEco().id : '');

  /* ---------- Acciones por ronda y rol ---------- */
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
    const cajas = {}; const lista = el('div', {});
    Object.keys(conocidos).forEach((c) => {
      const cb = el('input', { type: 'checkbox', checked: true, id: 'k_' + c }); cajas[c] = cb;
      lista.append(el('label', { class: 'check', for: 'k_' + c }, cb, chip(c, conocidos[c])));
    });
    const estado = el('div', { class: 'small muted' }, enviadoLocal[`n${r.numero}:${r.pedidoActual}:${rol}`] ? '✔ Nota enviada. Puedes reenviarla.' : '');
    const b = el('button', { class: 'btn block', type: 'button', onclick: () => {
      const datos = {}; Object.keys(cajas).forEach((c) => { if (cajas[c].checked) datos[c] = conocidos[c]; });
      if (!Object.keys(datos).length) return toast('Marca al menos un dato.');
      enviarMsg({ como: rol, datos });
      enviadoLocal[`n${r.numero}:${r.pedidoActual}:${rol}`] = true; estado.textContent = '✔ Nota enviada.';
    } }, `✉️ Enviar a ${ICON_ROL[ORDEN[i + 1]]} ${nombre(ORDEN[i + 1])}`);
    return el('div', { class: 'card' }, el('h3', {}, 'Tu nota'),
      previa ? el('div', { class: 'datos' }, el('span', { class: 'chip' }, `${ICON_ROL[ORDEN[i - 1]]} te pasó:`), chipsDatos(previa.datos)) : (i > 0 ? el('p', { class: 'muted small' }, '⏳ Aún no recibes nada.') : null),
      lista, b, estado);
  }

  function selectorCampo(c, valor, dirtyKey) {
    if (dirtyKey && dirtySel[dirtyKey] && dirtySel[dirtyKey][c]) valor = dirtySel[dirtyKey][c];
    const s = el('select', { 'data-campo': c, 'aria-label': S.campos[c].label });
    if (dirtyKey) s.addEventListener('change', () => { (dirtySel[dirtyKey] = dirtySel[dirtyKey] || {})[c] = s.value; });
    s.append(el('option', { value: '' }, `${DX.ICON_CAMPO[c]} ${S.campos[c].label}…`));
    S.campos[c].opciones.forEach((o) => s.append(el('option', { value: o, selected: o === valor }, o)));
    return s;
  }
  const leerSelects = (raiz) => { const o = {}; raiz.querySelectorAll('select[data-campo]').forEach((s) => { if (s.value) o[s.dataset.campo] = s.value; }); return o; };

  function accionTarjeta(r, rol) {
    const mis = (S.misCampos || []).filter((c) => c.rol === rol);
    const form = el('div', {});
    mis.forEach((c) => form.append(el('label', { class: 'f' }, el('span', {}, `${DX.ICON_CAMPO[c.campo]} ${S.campos[c.campo].label}`), selectorCampo(c.campo, c.valor))));
    const ya = msgsPedido('tarjeta', (m) => m.de === rol).length > 0;
    const b = el('button', { class: 'btn block', type: 'button', onclick: () => {
      const datos = leerSelects(form);
      if (!Object.keys(datos).length) return toast('Elige tu dato.');
      enviarMsg({ como: rol, a: 'todos', tipo: msgsPedido('tarjeta', (m) => m.de === rol).length ? 'correccion' : 'tarjeta', datos });
    } }, ya ? '🪪 Actualizar mi tarjeta' : '🪪 Publicar mi tarjeta');
    const nodos = [el('h3', {}, 'Tu tarjeta de traspaso'), form, b];
    // eco del operativo: ¿está bien mi dato?
    const eco = ultimoEco();
    if (eco) {
      const filas = mis.map((c) => {
        const visto = eco.datos ? eco.datos[c.campo] : undefined;
        const bien = visto === c.valor;
        return el('div', { class: 'flex', style: 'margin-top:6px' },
          el('span', {}, '🔊'), chip(c.campo, visto || '—', bien ? 'ok' : 'bad'),
          bien ? el('span', {}, '✔') : el('button', { class: 'btn', type: 'button', onclick: () => enviarMsg({ como: rol, a: 'todos', tipo: 'correccion', datos: { [c.campo]: c.valor } }) }, `✏️ Es ${c.valor}`));
      });
      nodos.push(el('div', { class: 'alerta', style: 'background:var(--tint);border-color:var(--c-eco);color:inherit' }, el('b', {}, '🔊 Eco del Operativo'), ...filas));
    }
    return el('div', { class: 'card' }, nodos);
  }

  function accionOperativo(r, rol, esNotas) {
    const i = ORDEN.indexOf(rol);
    const form = el('div', {});
    let base = {};
    if (esNotas) { const n = msgsPedido('nota', (m) => m.a === rol).pop(); base = n ? n.datos || {} : {}; }
    else base = DX.valoresComunicados(S.mensajes || [], r.pedidoActual);
    const dk = `${r.numero}:${r.pedidoActual}`;
    DX.CAMPOS_ORDEN.forEach((c) => form.append(el('label', { class: 'f' }, el('span', {}, `${DX.ICON_CAMPO[c]} ${S.campos[c].label}`), selectorCampo(c, base[c], dk))));
    const acciones = [];
    if (!esNotas) {
      acciones.push(el('button', { class: 'btn block ghost', type: 'button', style: 'margin-bottom:8px', onclick: () => {
        const datos = leerSelects(form); if (!Object.keys(datos).length) return toast('Completa algún dato para leer el eco.');
        enviarMsg({ como: rol, tipo: 'eco', datos });
      } }, '🔊 Leer el eco en voz alta'));
    }
    acciones.push(el('button', { class: 'btn block', type: 'button', onclick: () => {
      const datos = leerSelects(form);
      if (Object.keys(datos).length < DX.CAMPOS_ORDEN.length) return toast('Completa los 7 datos antes de enviar.');
      net.enviar({ t: 'pedido', valores: datos });
    } }, '📤 Enviar despacho'));
    const recibido = esNotas
      ? (base && Object.keys(base).length ? el('div', { class: 'datos' }, el('span', { class: 'chip' }, `${ICON_ROL[ORDEN[i - 1]]} te pasó:`), chipsDatos(base)) : el('p', { class: 'muted small' }, '⏳ Aún no recibes nada.'))
      : el('p', { class: 'muted small' }, 'Los datos se rellenan con las tarjetas de tus compañeros.');
    return el('div', { class: 'card' }, el('h3', {}, 'Arma el despacho'), recibido, form, ...acciones);
  }

  /* ---------- Reloj ---------- */
  setInterval(() => {
    if (!S || !S.ronda || S.ronda.estado !== 'activa') return;
    document.getElementById('tTm').textContent = '⏱ ' + mmss(S.ronda.fin - (Date.now() + offset));
  }, 250);
})();
