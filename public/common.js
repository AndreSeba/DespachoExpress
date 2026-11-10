(function () {
  'use strict';
  const DX = (window.DX = {});
  DX.ICON_ROL = { atencion: '📞', planificacion: '🗓️', almacen: '📦', transporte: '🚚', seguridad: '🦺', operativo: '📋' };
  DX.ICON_CAMPO = { producto: '🛒', cantidad: '🔢', anden: '🏗️', unidad: '🚚', restriccion: '⚠️', destino: '📍', horario: '⏰' };
  DX.ICON_TIPO = { nota: '✉️', tarjeta: '🪪', eco: '🔊', correccion: '✏️', msg: '💬' };
  DX.COLOR_TIPO = { nota: '#2B6CB0', tarjeta: '#0E9AA7', eco: '#7C4DBA', correccion: '#E07A2F', msg: '#6B7B8C' };
  DX.NOMBRE_ROL = { atencion: 'Atención', planificacion: 'Planificación', almacen: 'Almacén', transporte: 'Transporte', seguridad: 'Seguridad', operativo: 'Operativo' };
  DX.ORDEN = ['atencion', 'planificacion', 'almacen', 'transporte', 'seguridad', 'operativo'];
  DX.CAMPOS_ORDEN = ['producto', 'cantidad', 'anden', 'unidad', 'restriccion', 'destino', 'horario'];

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
  DX.mmss = function (ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  };
  DX.chip = function (campo, valor, estado, extra) {
    return DX.el('span', { class: 'chip ' + (estado || '') + ' ' + (extra || '') }, DX.ICON_CAMPO[campo] || '', ' ', valor);
  };
  DX.toast = function (msg) {
    const t = DX.el('div', { class: 'toast', role: 'alert' }, msg);
    document.body.append(t); setTimeout(() => t.remove(), 3500);
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
  /** Último valor comunicado por campo (sin contar el eco) en un pedido. */
  DX.valoresComunicados = function (mensajes, pedidoN) {
    const out = {};
    for (const m of mensajes) { if (m.pedidoN !== pedidoN || !m.datos || m.tipo === 'eco') continue; Object.assign(out, m.datos); }
    return out;
  };
})();
