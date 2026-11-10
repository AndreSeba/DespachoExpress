'use strict';
/**
 * Servidor de "Despacho Express": HTTP estático + WebSocket.
 * Un solo proceso, sin base de datos: las salas viven en memoria.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const { WebSocketServer } = require('ws');
const G = require('./lib/game');
const { botTick } = require('./lib/bots');

const PORT = parseInt(process.env.PORT, 10) || 3000;
const PUBLIC = path.join(__dirname, 'public');
const MAX_SALAS = 100;
const SALA_INACTIVA_MS = 6 * 60 * 60 * 1000;

const salas = new Map();
const clientes = new Map(); // ws -> { sala, tipo, jugadorId }
const timers = new Map(); // code -> timeout

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

function cabecerasBase(extra = {}) {
  return {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy': "default-src 'self'; connect-src 'self' ws: wss:; img-src 'self' data:; font-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-ancestors 'none'",
    ...extra,
  };
}

const server = http.createServer((req, res) => {
  let url;
  try { url = new URL(req.url, 'http://localhost'); } catch { res.writeHead(400); return res.end(); }

  if (url.pathname === '/health') {
    res.writeHead(200, cabecerasBase({ 'Content-Type': 'application/json' }));
    return res.end(JSON.stringify({ ok: true, salas: salas.size }));
  }

  if (url.pathname === '/api/export') {
    const sala = salas.get((url.searchParams.get('code') || '').toUpperCase());
    if (!sala || sala.hostToken !== url.searchParams.get('token')) {
      res.writeHead(403, cabecerasBase({ 'Content-Type': 'text/plain; charset=utf-8' }));
      return res.end('No autorizado');
    }
    res.writeHead(200, cabecerasBase({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="despacho-express-${sala.code}.csv"`,
      'Cache-Control': 'no-store',
    }));
    return res.end(G.exportarCSV(sala));
  }

  let rel = decodeURIComponent(url.pathname);
  if (rel === '/') rel = '/index.html';
  if (rel === '/host') rel = '/host.html';
  const file = path.normalize(path.join(PUBLIC, rel));
  if (!file.startsWith(PUBLIC + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, cabecerasBase({ 'Content-Type': 'text/plain; charset=utf-8' })); return res.end('No encontrado'); }
    res.writeHead(200, cabecerasBase({
      'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    }));
    res.end(data);
  });
});

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 8 * 1024 });

function enviar(ws, obj) {
  if (ws.readyState === 1) ws.send(JSON.stringify(obj));
}

function difundir(sala) {
  for (const [ws, ctx] of clientes) {
    if (ctx.sala !== sala) continue;
    try {
      enviar(ws, { t: 'estado', ...G.snapshot(sala, ctx) });
    } catch (e) {
      enviar(ws, { t: 'error', msg: 'No se pudo actualizar el estado.' });
    }
  }
}

function tickBots(sala) { botTick(sala, () => difundir(sala)); }

function programarCierre(sala) {
  clearTimeout(timers.get(sala.code));
  const r = sala.actual;
  if (!r || r.estado !== 'activa') return;
  const t = setTimeout(() => {
    G.cerrarRonda(sala, 'tiempo');
    difundir(sala);
  }, Math.max(0, r.fin - Date.now()) + 50);
  timers.set(sala.code, t);
}

function actualizarConexion(sala, jugadorId) {
  const sigue = [...clientes.values()].some((c) => c.sala === sala && c.jugadorId === jugadorId);
  if (sala.jugadores[jugadorId]) sala.jugadores[jugadorId].conectado = sigue;
}

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  let tokens = 20; let ultimo = Date.now();

  ws.on('message', (raw) => {
    const ahora = Date.now();
    tokens = Math.min(20, tokens + (ahora - ultimo) / 500); ultimo = ahora;
    if (tokens < 1) return enviar(ws, { t: 'error', msg: 'Vas muy rápido. Espera un momento.' });
    tokens -= 1;

    let m;
    try { m = JSON.parse(raw.toString()); } catch { return; }
    if (!m || typeof m.t !== 'string') return;
    const ctx = clientes.get(ws);

    try {
      switch (m.t) {
        case 'host:crear': {
          if (salas.size >= MAX_SALAS) throw Object.assign(new Error('Hay demasiadas salas activas. Intenta más tarde.'), { publico: true });
          const sala = G.crearSala(salas, m.config);
          clientes.set(ws, { sala, tipo: 'host' });
          enviar(ws, { t: 'creada', code: sala.code, token: sala.hostToken });
          return difundir(sala);
        }
        case 'host:entrar': {
          const sala = salas.get(String(m.code || '').toUpperCase());
          if (!sala || sala.hostToken !== m.token) throw Object.assign(new Error('La sala ya no existe.'), { publico: true, codigo: 'sala' });
          clientes.set(ws, { sala, tipo: 'host' });
          enviar(ws, { t: 'creada', code: sala.code, token: sala.hostToken });
          return difundir(sala);
        }
        case 'unirse': {
          const sala = salas.get(String(m.code || '').toUpperCase().trim());
          if (!sala) throw Object.assign(new Error('No encontramos esa sala. Revisa el código.'), { publico: true, codigo: 'sala' });
          const p = G.unirse(sala, m.alias, m.token, { puesto: m.puesto });
          clientes.set(ws, { sala, tipo: 'jugador', jugadorId: p.id });
          enviar(ws, { t: 'unido', code: sala.code, token: p.token, jugadorId: p.id });
          return difundir(sala);
        }
        default:
      }

      if (!ctx) throw Object.assign(new Error('Primero entra a una sala.'), { publico: true });
      const sala = ctx.sala;

      if (ctx.tipo === 'host') {
        switch (m.t) {
          case 'config': G.configurar(sala, m); break;
          case 'iniciar': G.iniciarRonda(sala); programarCierre(sala); break;
          case 'bots': G.agregarBots(sala); break;
          case 'quitarbots': G.quitarBots(sala); break;
          case 'incidente': G.lanzarIncidente(sala); break;
          case 'cerrar': G.cerrarRonda(sala, 'manual'); clearTimeout(timers.get(sala.code)); break;
          case 'reiniciar': G.reiniciar(sala); clearTimeout(timers.get(sala.code)); break;
          default: return;
        }
      } else {
        switch (m.t) {
          case 'msg': G.enviarMensaje(sala, ctx.jugadorId, m); break;
          case 'pedido': G.enviarPedido(sala, ctx.jugadorId, m.valores); break;
          default: return;
        }
        if (sala.actual && sala.actual.estado === 'cerrada') clearTimeout(timers.get(sala.code));
      }
      difundir(sala);
      tickBots(sala);
    } catch (e) {
      if (e && e.publico) enviar(ws, { t: 'error', msg: e.message, codigo: e.codigo });
      else { console.error('Error interno:', e); enviar(ws, { t: 'error', msg: 'Ocurrió un error inesperado.' }); }
    }
  });

  ws.on('close', () => {
    const ctx = clientes.get(ws);
    clientes.delete(ws);
    if (ctx && ctx.tipo === 'jugador') {
      actualizarConexion(ctx.sala, ctx.jugadorId);
      difundir(ctx.sala);
    }
  });
});

// Los bots reevalúan cada segundo (por ejemplo, para el tiempo de espera del eco)
setInterval(() => { for (const sala of salas.values()) if (sala.actual && sala.actual.estado === 'activa') tickBots(sala); }, 1000).unref();

// Latido y limpieza
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false; try { ws.ping(); } catch { /* ignorar */ }
  }
}, 30000).unref();

setInterval(() => {
  const limite = Date.now() - SALA_INACTIVA_MS;
  for (const [code, sala] of salas) {
    if (sala.actividad < limite) { salas.delete(code); clearTimeout(timers.get(code)); timers.delete(code); }
  }
}, 10 * 60 * 1000).unref();

if (require.main === module) {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Despacho Express escuchando en el puerto ${PORT}`);
  });
}

module.exports = { server, salas };
