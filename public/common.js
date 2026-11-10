(function () {
  'use strict';
  const DX = (window.DX = {});
  // Íconos de Bootstrap Icons (sin emojis)
  DX.ICON_ROL = { planificacion: 'bi-calendar-check', inventarios: 'bi-boxes', almacen: 'bi-box-seam', transporte: 'bi-truck', seguridad: 'bi-shield-check', operativo: 'bi-clipboard-check' };
  DX.ICON_CAMPO = { producto: 'bi-bag', cantidad: 'bi-123', anden: 'bi-building', unidad: 'bi-truck-front', restriccion: 'bi-exclamation-triangle', destino: 'bi-geo-alt', horario: 'bi-clock' };
  DX.ICON_TIPO = { nota: 'bi-envelope', tarjeta: 'bi-person-vcard', eco: 'bi-megaphone', correccion: 'bi-pencil', msg: 'bi-chat-dots' };
  DX.COLOR_TIPO = { nota: '#2B6CB0', tarjeta: '#0E9AA7', eco: '#7C4DBA', correccion: '#E07A2F', msg: '#6B7B8C' };
  DX.NOMBRE_ROL = { planificacion: 'Planificación de despachos', inventarios: 'Inventarios', almacen: 'Almacén', transporte: 'Transporte', seguridad: 'Seguridad', operativo: 'Operativo' };
  DX.ORDEN = ['planificacion', 'inventarios', 'almacen', 'transporte', 'seguridad', 'operativo'];
  DX.CAMPOS_ORDEN = ['producto', 'cantidad', 'anden', 'unidad', 'restriccion', 'destino', 'horario'];
  DX.CAMPOS_DE = { planificacion: ['destino', 'horario'], inventarios: ['producto', 'cantidad'], almacen: ['anden'], transporte: ['unidad'], seguridad: ['restriccion'], operativo: [] };

  // Tema claro/oscuro según el dispositivo
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const tema = () => { document.documentElement.setAttribute('data-bs-theme', mq.matches ? 'dark' : 'light'); };
  tema(); mq.addEventListener && mq.addEventListener('change', tema);

  DX.el = function (tag, props, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (k === 'class') n.className = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else if (v === true) n.setAttribute(k, '');
      else if (v !== false && v != null) n.setAttribute(k, v);
    }
    for (const k of kids.flat()) { if (k == null || k === false) continue; n.append(k.nodeType ? k : document.createTextNode(k)); }
    return n;
  };
  const el = DX.el;
  DX.ic = (cls, extra) => el('i', { class: `bi ${cls}${extra ? ' ' + extra : ''}`, 'aria-hidden': 'true' });
  DX.icRol = (rol, extra) => DX.ic(DX.ICON_ROL[rol] || 'bi-person', extra);
  DX.icTipo = (tipo, extra) => DX.ic(DX.ICON_TIPO[tipo] || 'bi-chat-dots', `ic-${tipo}${extra ? ' ' + extra : ''}`);
  DX.mmss = function (ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  };
  /** Insignia de un dato: icono del campo + valor. estado: ok | bad | stale | nuevo | lg | t-<tipo> */
  DX.chip = function (campo, valor, estado) {
    return el('span', { class: 'dato ' + (estado || '') }, DX.ic(DX.ICON_CAMPO[campo] || 'bi-dot'), valor);
  };
  DX.toast = function (msg, tipo) {
    let cont = document.getElementById('toasts');
    if (!cont) { cont = el('div', { id: 'toasts', class: 'toast-container position-fixed bottom-0 start-50 translate-middle-x p-3', style: 'z-index:2000' }); document.body.append(cont); }
    const t = el('div', { class: `toast align-items-center text-bg-${tipo || 'danger'} border-0`, role: 'alert', 'aria-live': 'assertive' },
      el('div', { class: 'd-flex' }, el('div', { class: 'toast-body' }, msg), el('button', { type: 'button', class: 'btn-close btn-close-white me-2 m-auto', 'data-bs-dismiss': 'toast', 'aria-label': 'Cerrar' })));
    cont.append(t);
    const inst = new bootstrap.Toast(t, { delay: 3500 }); t.addEventListener('hidden.bs.toast', () => t.remove()); inst.show();
  };
  DX.conectar = function (h) {
    let ws, intentos = 0, cerrado = false;
    const api = { enviar(obj) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj)); } };
    function abrir() {
      const url = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
      ws = new WebSocket(url);
      ws.onopen = () => { intentos = 0; h.onAbrir && h.onAbrir(); };
      ws.onmessage = (e) => { try { h.onMensaje(JSON.parse(e.data)); } catch (err) { console.error(err); } };
      ws.onclose = () => { if (cerrado) return; h.onCerrar && h.onCerrar(); setTimeout(abrir, Math.min(5000, 800 * ++intentos)); };
    }
    abrir();
    api.cerrar = () => { cerrado = true; ws.close(); };
    return api;
  };
  DX.valoresComunicados = function (mensajes, pedidoN) {
    const out = {};
    for (const m of mensajes) { if (m.pedidoN !== pedidoN || !m.datos || m.tipo === 'eco') continue; Object.assign(out, m.datos); }
    return out;
  };
})();
