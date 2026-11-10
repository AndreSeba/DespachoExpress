'use strict';
/**
 * Lógica pura de "Despacho Express" (sin red ni disco).
 * Todo el estado vive en memoria dentro de un objeto `room`.
 */
const crypto = require('crypto');

// ---------- Datos del juego ----------
const ROLES = [
  { id: 'atencion', nombre: 'Atención al cliente', campos: ['destino', 'horario'],
    desc: 'Eres el primer eslabón: conoces a qué cliente va el pedido y a qué hora debe salir.' },
  { id: 'planificacion', nombre: 'Planificación', campos: ['producto', 'cantidad'],
    desc: 'Defines qué producto y qué cantidad se despacha.' },
  { id: 'almacen', nombre: 'Almacén', campos: ['anden'],
    desc: 'Sabes en qué andén se carga el pedido.' },
  { id: 'transporte', nombre: 'Transporte', campos: ['unidad'],
    desc: 'Sabes qué unidad de transporte lleva el pedido.' },
  { id: 'seguridad', nombre: 'Seguridad', campos: ['restriccion'],
    desc: 'Conoces la restricción de seguridad de la carga.' },
  { id: 'operativo', nombre: 'Operativo', campos: [],
    desc: 'Eres el último eslabón: debes armar y enviar el despacho completo con lo que te cuenten.' },
];
const ROLE_IDS = ROLES.map((r) => r.id);
const ROLE_BY_ID = Object.fromEntries(ROLES.map((r) => [r.id, r]));

const CAMPOS = {
  producto: { label: 'Producto', opciones: ['Café soluble', 'Galletas', 'Leche en polvo', 'Cereal', 'Chocolate en barra', 'Bebida láctea'] },
  cantidad: { label: 'Cantidad (cajas)', opciones: ['40', '60', '80', '120', '200'] },
  anden: { label: 'Andén de carga', opciones: ['A1', 'A2', 'A3', 'A4'] },
  unidad: { label: 'Unidad de transporte', opciones: ['Camión 1', 'Camión 2', 'Camión 3', 'Camión 4'] },
  restriccion: { label: 'Restricción', opciones: ['Sin restricción', 'No apilar', 'Mantener fresco', 'Requiere precinto'] },
  destino: { label: 'Destino', opciones: ['Supermercado Norte', 'Tienda Equipetrol', 'Distribuidor Plan 3000', 'Cliente Cochabamba', 'Cliente La Paz'] },
  horario: { label: 'Hora de salida', opciones: ['06:30', '08:00', '09:30', '11:00', '13:30', '15:00'] },
};
const CAMPO_IDS = Object.keys(CAMPOS);
const CAMPO_DUENO = {};
for (const r of ROLES) for (const c of r.campos) CAMPO_DUENO[c] = r.id;

const INCIDENTES = [
  { campo: 'unidad', texto: 'Paro de transporte: la unidad asignada ya no está disponible.' },
  { campo: 'horario', texto: 'El cliente adelanta o atrasa su pedido.' },
  { campo: 'anden', texto: 'Mantenimiento: cambia el andén de carga.' },
  { campo: 'restriccion', texto: 'Inspección de seguridad: cambia la restricción de la carga.' },
  { campo: 'destino', texto: 'El cliente cambia el punto de entrega.' },
  { campo: 'cantidad', texto: 'Planificación corrige la cantidad del pedido.' },
];

const DEFAULT_CONFIG = { rondaSeg: 420, pedidos: 4 };
const LIMITES = { notas: 140, chat: 200, eco: 120, alias: 20, jugadoresMax: 14 };
const PUNTOS_BONUS = 3;
const MAX_POR_PEDIDO = CAMPO_IDS.length + PUNTOS_BONUS;

// ---------- Utilidades ----------
function rid(bytes = 6) { return crypto.randomBytes(bytes).toString('hex'); }

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function seedFrom(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function shuffle(rng, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function limpiarTexto(t, max) {
  return String(t == null ? '' : t).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}
function fail(msg) { const e = new Error(msg); e.publico = true; return e; }

const LETRAS = 'ABCDEFGHJKMNPQRSTUVWXYZ';
function generarCodigo(existentes) {
  for (let i = 0; i < 200; i++) {
    let c = '';
    for (let k = 0; k < 4; k++) c += LETRAS[crypto.randomInt(LETRAS.length)];
    if (!existentes.has(c)) return c;
  }
  throw fail('No se pudo generar un código de sala.');
}

// ---------- Salas ----------
function crearSala(salas, config = {}) {
  const code = generarCodigo(salas);
  const sala = {
    code,
    hostToken: rid(16),
    creada: Date.now(),
    actividad: Date.now(),
    config: normalizarConfig(config),
    fase: 'lobby', // lobby | ronda | entre | final
    jugadores: {},
    orden: [],
    rondas: [],
    actual: null,
    seqJugador: 0,
  };
  salas.set(code, sala);
  return sala;
}

function normalizarConfig(c = {}) {
  const rondaSeg = Math.min(1200, Math.max(60, parseInt(c.rondaSeg, 10) || DEFAULT_CONFIG.rondaSeg));
  const pedidos = Math.min(8, Math.max(1, parseInt(c.pedidos, 10) || DEFAULT_CONFIG.pedidos));
  return { rondaSeg, pedidos };
}

function configurar(sala, c) {
  if (sala.fase !== 'lobby' && sala.fase !== 'entre') throw fail('Solo se puede cambiar la configuración entre rondas.');
  sala.config = normalizarConfig({ ...sala.config, ...c });
}

function unirse(sala, alias, token) {
  sala.actividad = Date.now();
  if (token) {
    const existente = Object.values(sala.jugadores).find((p) => p.token === token);
    if (existente) { existente.conectado = true; return existente; }
  }
  if (Object.keys(sala.jugadores).length >= LIMITES.jugadoresMax) throw fail('La sala está llena.');
  const limpio = limpiarTexto(alias, LIMITES.alias);
  if (!limpio) throw fail('Escribe un apodo para entrar.');
  const n = ++sala.seqJugador;
  const base = limpio;
  let nombre = base;
  const usados = new Set(Object.values(sala.jugadores).map((p) => p.alias.toLowerCase()));
  let k = 2;
  while (usados.has(nombre.toLowerCase())) nombre = `${base} ${k++}`;
  const p = { id: 'j' + n, token: rid(12), alias: nombre, roles: [], observador: false, conectado: true, unido: Date.now() };
  // Si ya hay partida en curso, entra como observador.
  if (sala.fase !== 'lobby') p.observador = true;
  sala.jugadores[p.id] = p;
  sala.orden.push(p.id);
  return p;
}

function asignarRoles(sala) {
  const rng = mulberry32(seedFrom(sala.code + ':roles:' + sala.creada));
  const ids = shuffle(rng, sala.orden.filter((id) => !sala.jugadores[id].observador));
  if (ids.length < 2) throw fail('Se necesitan al menos 2 jugadores para empezar.');
  ids.forEach((id) => { sala.jugadores[id].roles = []; });
  const activos = ids.slice(0, 6);
  ids.slice(6).forEach((id) => { sala.jugadores[id].observador = true; });
  ROLE_IDS.forEach((rol, i) => { sala.jugadores[activos[i % activos.length]].roles.push(rol); });
}

function generarPedidos(sala, numero) {
  const rng = mulberry32(seedFrom(`${sala.code}:${sala.creada}:ronda${numero}`));
  const pedidos = [];
  for (let n = 1; n <= sala.config.pedidos; n++) {
    const original = {};
    for (const c of CAMPO_IDS) original[c] = pick(rng, CAMPOS[c].opciones);
    pedidos.push({ n, original, real: { ...original }, incidentes: [], enviado: null, correctos: null, puntos: 0, enviadoAt: null });
  }
  return pedidos;
}

function iniciarRonda(sala) {
  sala.actividad = Date.now();
  if (sala.fase === 'lobby') {
    asignarRoles(sala);
  } else if (sala.fase !== 'entre') {
    throw fail('No se puede iniciar una ronda en este momento.');
  }
  const numero = sala.rondas.length + 1;
  const ahora = Date.now();
  const r = {
    numero,
    modo: numero === 1 ? 'notas' : 'chat',
    inicio: ahora,
    fin: ahora + sala.config.rondaSeg * 1000,
    cerradaEn: null,
    motivo: null,
    estado: 'activa',
    pedidos: generarPedidos(sala, numero),
    actualIdx: 0,
    mensajes: [],
    alertas: [],
    seq: 0,
  };
  sala.rondas.push(r);
  sala.actual = r;
  sala.fase = 'ronda';
  return r;
}

function verificarTiempo(sala) {
  const r = sala.actual;
  if (r && r.estado === 'activa' && Date.now() >= r.fin) cerrarRonda(sala, 'tiempo');
}

function cerrarRonda(sala, motivo) {
  const r = sala.actual;
  if (!r || r.estado !== 'activa') return;
  r.estado = 'cerrada';
  r.cerradaEn = Math.min(Date.now(), r.fin);
  r.motivo = motivo || 'manual';
  sala.fase = r.numero >= 2 ? 'final' : 'entre';
  sala.actividad = Date.now();
}

function reiniciar(sala) {
  sala.rondas = [];
  sala.actual = null;
  sala.fase = 'lobby';
  sala.creada = Date.now();
  for (const p of Object.values(sala.jugadores)) { p.roles = []; p.observador = false; }
  sala.actividad = Date.now();
}

// ---------- Acciones de juego ----------
function jugadorPorId(sala, id) {
  const p = sala.jugadores[id];
  if (!p) throw fail('Jugador no encontrado.');
  return p;
}

function rondaActiva(sala) {
  verificarTiempo(sala);
  const r = sala.actual;
  if (!r || r.estado !== 'activa') throw fail('No hay una ronda activa.');
  return r;
}

function enviarMensaje(sala, jugadorId, { como, a, texto, requiereEco }) {
  const r = rondaActiva(sala);
  const p = jugadorPorId(sala, jugadorId);
  if (p.observador || !p.roles.length) throw fail('Los observadores no envían mensajes.');
  const rol = como || p.roles[0];
  if (!p.roles.includes(rol)) throw fail('No tienes ese rol.');
  const max = r.modo === 'notas' ? LIMITES.notas : LIMITES.chat;
  const t = limpiarTexto(texto, max);
  if (!t) throw fail('Escribe un mensaje.');
  let destino;
  if (r.modo === 'notas') {
    const i = ROLE_IDS.indexOf(rol);
    if (i === ROLE_IDS.length - 1) throw fail('El último eslabón no envía notas.');
    destino = ROLE_IDS[i + 1];
  } else {
    destino = a === 'todos' ? 'todos' : a;
    if (destino !== 'todos' && !ROLE_BY_ID[destino]) throw fail('Destinatario inválido.');
    if (destino === rol) throw fail('No puedes escribirte a ti mismo.');
  }
  const m = {
    id: 'm' + (++r.seq), de: rol, a: destino, texto: t, t: Date.now(),
    requiereEco: r.modo === 'chat' && !!requiereEco && destino !== 'todos',
    ecos: [],
  };
  r.mensajes.push(m);
  sala.actividad = Date.now();
  return m;
}

function confirmarEco(sala, jugadorId, { mensajeId, texto }) {
  const r = rondaActiva(sala);
  const p = jugadorPorId(sala, jugadorId);
  if (r.modo !== 'chat') throw fail('La confirmación solo existe en la ronda 2.');
  const m = r.mensajes.find((x) => x.id === mensajeId);
  if (!m || !m.requiereEco) throw fail('Ese mensaje no pide confirmación.');
  if (!p.roles.includes(m.a)) throw fail('Ese mensaje no es para ti.');
  const t = limpiarTexto(texto, LIMITES.eco);
  if (!t) throw fail('Repite con tus palabras lo que entendiste.');
  if (m.ecos.some((e) => e.por === m.a)) throw fail('Ya confirmaste este mensaje.');
  m.ecos.push({ por: m.a, texto: t, t: Date.now() });
  sala.actividad = Date.now();
  return m;
}

function enviarPedido(sala, jugadorId, valores) {
  const r = rondaActiva(sala);
  const p = jugadorPorId(sala, jugadorId);
  if (!p.roles.includes('operativo')) throw fail('Solo el Operativo envía el despacho.');
  const ped = r.pedidos[r.actualIdx];
  if (!ped) throw fail('No quedan pedidos.');
  const enviado = {};
  for (const c of CAMPO_IDS) {
    const v = valores && valores[c];
    if (!CAMPOS[c].opciones.includes(v)) throw fail(`Completa el campo "${CAMPOS[c].label}".`);
    enviado[c] = v;
  }
  const correctos = {};
  let ok = 0;
  for (const c of CAMPO_IDS) { correctos[c] = enviado[c] === ped.real[c]; if (correctos[c]) ok++; }
  ped.enviado = enviado;
  ped.correctos = correctos;
  ped.puntos = ok + (ok === CAMPO_IDS.length ? PUNTOS_BONUS : 0);
  ped.enviadoAt = Date.now();
  r.actualIdx++;
  sala.actividad = Date.now();
  if (r.actualIdx >= r.pedidos.length) cerrarRonda(sala, 'completa');
  return ped;
}

function lanzarIncidente(sala) {
  const r = rondaActiva(sala);
  const ped = r.pedidos[r.actualIdx];
  if (!ped) throw fail('No hay un pedido en curso.');
  const usados = new Set(ped.incidentes.map((i) => i.campo));
  const libres = INCIDENTES.filter((i) => !usados.has(i.campo));
  if (!libres.length) throw fail('Este pedido ya tuvo todos los incidentes.');
  const rng = mulberry32(seedFrom(`${sala.code}:${r.numero}:${ped.n}:${ped.incidentes.length}:${Date.now()}`));
  const inc = pick(rng, libres);
  const anterior = ped.real[inc.campo];
  const nuevo = pick(rng, CAMPOS[inc.campo].opciones.filter((o) => o !== anterior));
  ped.real[inc.campo] = nuevo;
  const registro = { campo: inc.campo, texto: inc.texto, anterior, nuevo, t: Date.now() };
  ped.incidentes.push(registro);
  r.alertas.push({ id: 'a' + (++r.seq), rol: CAMPO_DUENO[inc.campo], pedidoN: ped.n, ...registro });
  sala.actividad = Date.now();
  return registro;
}

// ---------- Resumen y exportación ----------
function resumenRonda(r) {
  const enviados = r.pedidos.filter((p) => p.enviado);
  const puntos = enviados.reduce((s, p) => s + p.puntos, 0);
  const perfectos = enviados.filter((p) => p.puntos === MAX_POR_PEDIDO).length;
  const errores = {};
  for (const c of CAMPO_IDS) errores[c] = enviados.filter((p) => !p.correctos[c]).length;
  const hasta = r.cerradaEn || Date.now();
  return {
    numero: r.numero, modo: r.modo, estado: r.estado, motivo: r.motivo,
    puntos, max: r.pedidos.length * MAX_POR_PEDIDO,
    pedidosTotal: r.pedidos.length, pedidosEnviados: enviados.length, perfectos,
    mensajes: r.mensajes.length,
    ecosPedidos: r.mensajes.filter((m) => m.requiereEco).length,
    ecosConfirmados: r.mensajes.reduce((s, m) => s + m.ecos.length, 0),
    incidentes: r.pedidos.reduce((s, p) => s + p.incidentes.length, 0),
    erroresPorCampo: errores,
    duracionSeg: Math.round((hasta - r.inicio) / 1000),
  };
}

function csvEscape(v) {
  const s = String(v == null ? '' : v);
  return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function exportarCSV(sala) {
  const filas = [['ronda', 'modo', 'pedido', 'campo', 'valor_real', 'valor_enviado', 'correcto', 'puntos_pedido']];
  for (const r of sala.rondas) {
    for (const p of r.pedidos) {
      for (const c of CAMPO_IDS) {
        filas.push([r.numero, r.modo === 'notas' ? 'notas (solo hacia adelante)' : 'chat con confirmación', p.n, CAMPOS[c].label,
          p.real[c], p.enviado ? p.enviado[c] : '(sin enviar)', p.enviado ? (p.correctos[c] ? 'sí' : 'no') : 'no', p.puntos]);
      }
    }
  }
  filas.push([]);
  filas.push(['resumen', 'ronda', 'puntos', 'maximo', 'pedidos_enviados', 'pedidos_perfectos', 'mensajes', 'confirmaciones', 'incidentes', 'duracion_seg']);
  for (const r of sala.rondas) {
    const s = resumenRonda(r);
    filas.push(['', s.numero, s.puntos, s.max, s.pedidosEnviados, s.perfectos, s.mensajes, s.ecosConfirmados, s.incidentes, s.duracionSeg]);
  }
  return '﻿' + filas.map((f) => f.map(csvEscape).join(',')).join('\r\n');
}

// ---------- Instantáneas por cliente ----------
function visibleParaJugador(m, p) {
  return p.roles.includes(m.de) || m.a === 'todos' || p.roles.includes(m.a);
}

function snapshot(sala, ctx) {
  verificarTiempo(sala);
  const r = sala.actual;
  const esHost = ctx.tipo === 'host';
  const base = {
    code: sala.code,
    fase: sala.fase,
    config: sala.config,
    ahora: Date.now(),
    roles: ROLES.map(({ id, nombre }) => ({ id, nombre })),
    campos: CAMPOS,
    jugadores: sala.orden.map((id) => {
      const p = sala.jugadores[id];
      return { id: p.id, alias: p.alias, roles: p.roles, observador: p.observador, conectado: p.conectado };
    }),
    resumenes: sala.rondas.map(resumenRonda),
    maxPorPedido: MAX_POR_PEDIDO,
  };

  const rondaInfo = r && {
    numero: r.numero, modo: r.modo, estado: r.estado, inicio: r.inicio, fin: r.fin,
    pedidoActual: Math.min(r.actualIdx + 1, r.pedidos.length), pedidosTotal: r.pedidos.length,
    motivo: r.motivo,
  };

  if (esHost) {
    return {
      ...base, tipo: 'host',
      ronda: rondaInfo,
      detalle: sala.rondas.map((x) => ({
        numero: x.numero,
        pedidos: x.pedidos.map((p) => ({
          n: p.n, real: x.estado === 'activa' && p.n > x.actualIdx + 1 ? null : p.real, original: p.original,
          enviado: p.enviado, correctos: p.correctos, puntos: p.puntos, incidentes: p.incidentes,
        })),
      })),
      mensajes: r ? r.mensajes : [],
      alertas: r ? r.alertas : [],
    };
  }

  const p = jugadorPorId(sala, ctx.jugadorId);
  const yo = { id: p.id, alias: p.alias, roles: p.roles, observador: p.observador };
  const out = { ...base, tipo: 'jugador', yo, ronda: rondaInfo };
  if (r) {
    const ped = r.pedidos[r.actualIdx];
    if (r.estado === 'activa' && ped && !p.observador) {
      out.misCampos = [];
      for (const rol of p.roles) {
        for (const c of ROLE_BY_ID[rol].campos) out.misCampos.push({ rol, campo: c, label: CAMPOS[c].label, valor: ped.real[c] });
      }
      out.esOperativo = p.roles.includes('operativo');
    }
    out.mensajes = r.mensajes.filter((m) => p.observador || visibleParaJugador(m, p));
    out.alertas = r.alertas.filter((a) => p.observador || p.roles.includes(a.rol));
    const ultimo = r.estado === 'cerrada' ? resumenRonda(r) : null;
    if (ultimo) out.resultadoRonda = ultimo;
  }
  return out;
}

module.exports = {
  ROLES, ROLE_IDS, CAMPOS, CAMPO_IDS, INCIDENTES, LIMITES, MAX_POR_PEDIDO, DEFAULT_CONFIG,
  crearSala, configurar, unirse, iniciarRonda, cerrarRonda, reiniciar, verificarTiempo,
  enviarMensaje, confirmarEco, enviarPedido, lanzarIncidente,
  snapshot, resumenRonda, exportarCSV,
};
