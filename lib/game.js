'use strict';
/**
 * Lógica pura de "Despacho Express" (sin red ni disco).
 * Todo el estado vive en memoria dentro de un objeto `room`.
 */
const crypto = require('crypto');

// ---------- Datos del juego ----------
const ROLES = [
  { id: 'planificacion', nombre: 'Planificación de despachos', campos: ['destino', 'horario'],
    desc: 'Primer eslabón: consolidas los requerimientos de los clientes. Sabes a dónde va el pedido y a qué hora debe salir.' },
  { id: 'inventarios', nombre: 'Inventarios', campos: ['producto', 'cantidad'],
    desc: 'Sabes qué producto y qué cantidad hay disponible para el pedido.' },
  { id: 'almacen', nombre: 'Almacén', campos: ['anden'],
    desc: 'Sabes en qué muelle se carga el pedido.' },
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
  producto: { label: 'Producto', opciones: ['Nescafé', 'Nido', 'Milo', 'Nesquik', 'Maggi', 'Mabel\'s Rosquitas', 'Mabel\'s Cremositas', 'Mabel\'s Wafer', 'Mabel\'s Surtidas'] },
  cantidad: { label: 'Cantidad (cajas)', opciones: ['40', '60', '80', '120', '200'] },
  anden: { label: 'Muelle de carga', opciones: ['Muelle 1', 'Muelle 2', 'Muelle 3', 'Muelle 4'] },
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
  { campo: 'anden', texto: 'Mantenimiento: cambia el muelle de carga.' },
  { campo: 'restriccion', texto: 'Inspección de seguridad: cambia la restricción de la carga.' },
  { campo: 'destino', texto: 'El cliente cambia el punto de entrega.' },
  { campo: 'cantidad', texto: 'Planificación corrige la cantidad del pedido.' },
];

const ENCUESTA_ITEMS = [
  'Las instrucciones del juego fueron claras.',
  'El juego fue pertinente para mi trabajo.',
  'El juego me ayudó a ver cómo se pierde y se confirma la información.',
  'Los facilitadores explicaron adecuadamente.',
  'El tiempo destinado fue adecuado.',
  'Puedo aplicar lo vivido en situaciones reales.',
  'Se respetaron todas las opiniones durante el taller.',
  'El taller cumplió mis expectativas.',
];
const ENCUESTA_ABIERTAS = [
  '¿Qué fue lo más útil del taller?',
  '¿Qué aspecto debería mejorarse?',
  '¿Qué aprendizaje considera que podrá aplicar en su contexto?',
];

const DEFAULT_CONFIG = { rondaSeg: 420, pedidos: 4 };
const LIMITES = { notas: 140, chat: 200, eco: 120, alias: 20, jugadoresMax: 14, abierta: 300 };
const PUNTOS_BONUS = 3;
const VER_SEG = 8; // ronda 1: segundos que se ven los datos antes de ocultarse
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
    encuesta: { respuestas: [], hechos: new Set() },
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

function unirse(sala, alias, token, opts = {}) {
  sala.actividad = Date.now();
  if (token && !opts.bot) {
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
  const puesto = ROLE_BY_ID[opts.puesto] ? opts.puesto : '';
  const p = { id: 'j' + n, token: rid(12), alias: nombre, puesto, roles: [], observador: false, conectado: true, unido: Date.now(), bot: !!opts.bot };
  // Si ya hay partida en curso, entra como observador.
  if (sala.fase !== 'lobby') p.observador = true;
  sala.jugadores[p.id] = p;
  sala.orden.push(p.id);
  return p;
}

const NOMBRES_BOT = ['Bot Ana', 'Bot Beto', 'Bot Carla', 'Bot Diego', 'Bot Elisa', 'Bot Fito'];
function agregarBots(sala) {
  if (sala.fase !== 'lobby') throw fail('Los bots solo se agregan antes de empezar.');
  const humanos = sala.orden.filter((id) => !sala.jugadores[id].bot).length;
  const bots = sala.orden.filter((id) => sala.jugadores[id].bot).length;
  const faltan = Math.max(0, 6 - humanos - bots);
  for (let i = 0; i < faltan; i++) unirse(sala, NOMBRES_BOT[(bots + i) % NOMBRES_BOT.length], null, { bot: true });
  return faltan;
}
function quitarBots(sala) {
  if (sala.fase !== 'lobby') throw fail('Los bots solo se quitan antes de empezar.');
  for (const id of sala.orden.slice()) {
    if (sala.jugadores[id].bot) { delete sala.jugadores[id]; sala.orden = sala.orden.filter((x) => x !== id); }
  }
}

/**
 * Asigna los 6 eslabones de forma aleatoria y sin que nadie reciba el eslabón
 * que se parece a su puesto real. Con menos de 6 personas, cada una toma varios eslabones
 * (nadie se queda sin rol). Si las restricciones fueran imposibles, se relajan y se avisa.
 */
function aleatorio() { return crypto.randomInt(1e9) / 1e9; }

function asignarRoles(sala) {
  const ids = shuffle(aleatorio, sala.orden.filter((id) => !sala.jugadores[id].observador));
  if (ids.length < 2) throw fail('Se necesitan al menos 2 jugadores para empezar.');
  ids.forEach((id) => { sala.jugadores[id].roles = []; });
  const activos = ids.slice(0, 6);
  ids.slice(6).forEach((id) => { sala.jugadores[id].observador = true; });
  const cap = Math.ceil(ROLE_IDS.length / activos.length);

  const resolver = (respetarPuesto) => {
    const orden = shuffle(aleatorio, ROLE_IDS);
    const conteo = Object.fromEntries(activos.map((id) => [id, 0]));
    const asign = {};
    const buscar = (k) => {
      if (k === orden.length) return activos.every((id) => conteo[id] > 0);
      const rol = orden[k];
      const cand = shuffle(aleatorio, activos.filter((id) => conteo[id] < cap && !(respetarPuesto && sala.jugadores[id].puesto === rol)));
      for (const id of cand) {
        conteo[id]++; asign[rol] = id;
        if (buscar(k + 1)) return true;
        conteo[id]--; delete asign[rol];
      }
      return false;
    };
    return buscar(0) ? asign : null;
  };

  let asign = resolver(true);
  sala.restriccionRelajada = false;
  if (!asign) { asign = resolver(false); sala.restriccionRelajada = true; }
  for (const rol of ROLE_IDS) sala.jugadores[asign[rol]].roles.push(rol);
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

function iniciarRonda(sala, opts = {}) {
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
    listos: new Set(),
    pedidos: generarPedidos(sala, numero),
    actualIdx: 0,
    pedidoT0: ahora,
    mensajes: [],
    alertas: [],
    seq: 0,
  };
  sala.rondas.push(r);
  sala.actual = r;
  sala.botFlags = new Set();
  sala.fase = 'ronda';
  if (opts.compuerta && humanosRequeridos(sala).length) {
    r.estado = 'preparando'; // el reloj arranca cuando todos tocan "Listo"
    r.fin = null;
  }
  return r;
}

/** Jugadores humanos conectados que deben tocar "Listo" antes de que corra el reloj */
function humanosRequeridos(sala) {
  return Object.values(sala.jugadores).filter((p) => !p.bot && !p.observador && p.roles.length && p.conectado);
}

function activarRonda(sala) {
  const r = sala.actual;
  if (!r || r.estado !== 'preparando') return false;
  const ahora = Date.now();
  r.estado = 'activa';
  r.inicio = ahora; r.pedidoT0 = ahora;
  r.fin = ahora + sala.config.rondaSeg * 1000;
  sala.actividad = ahora;
  return true;
}

/** Activa la ronda si ya están listos todos los requeridos. Devuelve true si arrancó. */
function comprobarListos(sala) {
  const r = sala.actual;
  if (!r || r.estado !== 'preparando') return false;
  const req = humanosRequeridos(sala);
  if (req.every((p) => r.listos.has(p.id))) return activarRonda(sala);
  return false;
}

function marcarListo(sala, jugadorId) {
  const r = sala.actual;
  if (!r || r.estado !== 'preparando') return false;
  jugadorPorId(sala, jugadorId);
  r.listos.add(jugadorId);
  return comprobarListos(sala);
}

/** El facilitador arranca sin esperar a los que faltan */
function empezarYa(sala) {
  return activarRonda(sala);
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
  sala.encuesta = { respuestas: [], hechos: new Set() };
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

const TIPOS_CHAT = ['tarjeta', 'eco', 'correccion', 'msg'];

const norm = (x) => String(x).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/['`’]/g, '');
/** Datos que una nota escrita a mano menciona (para el panel y los bots). Un dato mal escrito no se reconoce. */
function extraerDatos(texto) {
  const t = norm(texto || ''); const out = {};
  for (const c of CAMPO_IDS) {
    for (const o of CAMPOS[c].opciones) {
      const re = new RegExp('(^|[^a-z0-9])' + norm(o).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z0-9]|$)');
      if (re.test(t)) { out[c] = o; break; }
    }
  }
  return Object.keys(out).length ? out : null;
}
/** Texto de una nota hecha por un bot. */
const textoNota = (datos) => Object.entries(datos || {}).map(([c, v]) => `${CAMPOS[c].label}: ${v}`).join('. ');

function validarDatos(datos) {
  if (datos == null) return null;
  if (typeof datos !== 'object' || Array.isArray(datos)) throw fail('Datos inválidos.');
  const out = {};
  for (const [c, v] of Object.entries(datos)) {
    if (!CAMPOS[c]) throw fail('Campo desconocido.');
    if (!CAMPOS[c].opciones.includes(v)) throw fail(`Valor inválido para "${CAMPOS[c].label}".`);
    out[c] = v;
  }
  return Object.keys(out).length ? out : null;
}

function enviarMensaje(sala, jugadorId, { como, a, texto, datos, tipo }) {
  const r = rondaActiva(sala);
  const p = jugadorPorId(sala, jugadorId);
  if (p.observador || !p.roles.length) throw fail('Los observadores no envían mensajes.');
  const rol = como || p.roles[0];
  if (!p.roles.includes(rol)) throw fail('No tienes ese rol.');
  const t = limpiarTexto(texto, r.modo === 'notas' ? LIMITES.notas : LIMITES.chat);
  let d = validarDatos(datos);
  if (!t && !d) throw fail('Escribe un mensaje o elige datos para enviar.');
  let destino, tp;
  if (r.modo === 'notas') {
    const i = ROLE_IDS.indexOf(rol);
    if (i === ROLE_IDS.length - 1) throw fail('El último eslabón no envía notas.');
    destino = ROLE_IDS[i + 1];
    tp = 'nota';
    const pedN = Math.min(r.actualIdx + 1, r.pedidos.length);
    if (r.mensajes.some((x) => x.tipo === 'nota' && x.de === rol && x.pedidoN === pedN)) throw fail('Ya enviaste tu nota de este pedido.');
    if (!d && t) d = extraerDatos(t);
  } else {
    tp = TIPOS_CHAT.includes(tipo) ? tipo : (d ? 'tarjeta' : 'msg');
    if (!d && t && (tp === 'tarjeta' || tp === 'correccion')) d = extraerDatos(t);
    if (tp === 'eco' && rol !== 'operativo') throw fail('Solo el Operativo lee el eco.');
    destino = a === 'todos' || tp === 'eco' ? 'todos' : a;
    if (destino !== 'todos' && !ROLE_BY_ID[destino]) throw fail('Destinatario inválido.');
    if (destino === rol) throw fail('No puedes escribirte a ti mismo.');
  }
  const m = {
    id: 'm' + (++r.seq), tipo: tp, de: rol, a: destino, texto: t, datos: d,
    pedidoN: Math.min(r.actualIdx + 1, r.pedidos.length), t: Date.now(),
  };
  r.mensajes.push(m);
  sala.actividad = Date.now();
  return m;
}

/** Último valor comunicado por campo en un pedido (excluye el eco). Sirve a los bots y al panel. */
function valoresComunicados(r, pedidoN) {
  const out = {};
  for (const m of r.mensajes) {
    if (m.pedidoN !== pedidoN || !m.datos || m.tipo === 'eco') continue;
    for (const [c, v] of Object.entries(m.datos)) out[c] = v;
  }
  return out;
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
  r.pedidoT0 = Date.now();
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

// ---------- Formulario de satisfacción (anónimo) ----------
/** No se guarda quién dio cada respuesta: solo un registro de quién ya respondió, para evitar duplicados. */
function enviarEncuesta(sala, jugadorId, { likert, abiertas }) {
  if (sala.fase !== 'final') throw fail('El formulario se abre cuando termina el juego.');
  const p = jugadorPorId(sala, jugadorId);
  if (p.bot) throw fail('Los bots no responden el formulario.');
  if (sala.encuesta.hechos.has(p.id)) throw fail('Ya enviaste el formulario. ¡Gracias!');
  if (!Array.isArray(likert) || likert.length !== ENCUESTA_ITEMS.length || !likert.every((n) => Number.isInteger(n) && n >= 1 && n <= 5)) {
    throw fail('Responde las 8 afirmaciones con una nota de 1 a 5.');
  }
  const ab = ENCUESTA_ABIERTAS.map((_, i) => limpiarTexto(Array.isArray(abiertas) ? abiertas[i] : '', LIMITES.abierta));
  sala.encuesta.respuestas.push({ likert: likert.slice(), abiertas: ab });
  sala.encuesta.hechos.add(p.id);
  sala.actividad = Date.now();
}

function resumenEncuesta(sala) {
  const rs = sala.encuesta.respuestas;
  const total = Object.values(sala.jugadores).filter((p) => !p.bot).length;
  return {
    respondieron: rs.length,
    total,
    items: ENCUESTA_ITEMS.map((texto, i) => {
      const dist = [0, 0, 0, 0, 0];
      let suma = 0;
      for (const r of rs) { dist[r.likert[i] - 1]++; suma += r.likert[i]; }
      return { texto, n: rs.length, promedio: rs.length ? Math.round((suma / rs.length) * 100) / 100 : null, dist };
    }),
    abiertas: ENCUESTA_ABIERTAS.map((pregunta, i) => ({
      pregunta,
      // ordenadas alfabéticamente para no revelar el orden en que respondió cada persona
      respuestas: rs.map((r) => r.abiertas[i]).filter(Boolean).sort((a, b) => a.localeCompare(b, 'es')),
    })),
  };
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
    notas: r.mensajes.filter((m) => m.tipo === 'nota').length,
    tarjetas: r.mensajes.filter((m) => m.tipo === 'tarjeta').length,
    ecos: r.mensajes.filter((m) => m.tipo === 'eco').length,
    correcciones: r.mensajes.filter((m) => m.tipo === 'correccion').length,
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
  filas.push(['resumen', 'ronda', 'puntos', 'maximo', 'pedidos_enviados', 'pedidos_perfectos', 'mensajes', 'correcciones_por_eco', 'incidentes', 'duracion_seg']);
  for (const r of sala.rondas) {
    const s = resumenRonda(r);
    filas.push(['', s.numero, s.puntos, s.max, s.pedidosEnviados, s.perfectos, s.mensajes, s.correcciones, s.incidentes, s.duracionSeg]);
  }
  const enc = resumenEncuesta(sala);
  if (enc.respondieron) {
    filas.push([]);
    filas.push(['formulario_satisfaccion', 'afirmacion', 'promedio', 'respuestas', 'nota_1', 'nota_2', 'nota_3', 'nota_4', 'nota_5']);
    for (const it of enc.items) filas.push(['', it.texto, it.promedio, it.n, ...it.dist]);
    filas.push([]);
    filas.push(['respuestas_abiertas', 'pregunta', 'respuesta']);
    for (const a of enc.abiertas) for (const r of a.respuestas) filas.push(['', a.pregunta, r]);
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
      return { id: p.id, alias: p.alias, puesto: p.puesto, roles: p.roles, observador: p.observador, conectado: p.conectado, bot: p.bot };
    }),
    resumenes: sala.rondas.map(resumenRonda),
    maxPorPedido: MAX_POR_PEDIDO,
    restriccionRelajada: !!sala.restriccionRelajada,
  };

  const encuestaHost = (sala.fase === 'final' || sala.encuesta.respuestas.length) ? resumenEncuesta(sala) : null;
  const rondaInfo = r && {
    numero: r.numero, modo: r.modo, estado: r.estado, inicio: r.inicio, fin: r.fin,
    pedidoActual: Math.min(r.actualIdx + 1, r.pedidos.length), pedidosTotal: r.pedidos.length,
    motivo: r.motivo, pedidoDesde: r.pedidoT0, verSeg: VER_SEG,
    // Eslabones que ya comunicaron algo en el pedido actual (mueve el camión de la ruta)
    progreso: ROLE_IDS.filter((x) => r.mensajes.some((m) => m.pedidoN === Math.min(r.actualIdx + 1, r.pedidos.length) && m.de === x && m.tipo !== 'eco')),
    preparacion: r.estado === 'preparando' ? { listos: [...r.listos], requeridos: humanosRequeridos(sala).map((p) => p.id) } : null,
  };

  if (esHost) {
    return {
      ...base, tipo: 'host',
      ronda: rondaInfo,
      detalle: sala.rondas.map((x) => ({
        numero: x.numero,
        pedidos: x.pedidos.map((p) => ({
          n: p.n, real: x.estado === 'activa' && p.n > x.actualIdx + 1 ? null : p.real, original: p.original,
          enviado: p.enviado, correctos: p.correctos, puntos: p.puntos, incidentes: p.incidentes, enviadoAt: p.enviadoAt,
        })),
      })),
      mensajes: r ? r.mensajes : [],
      alertas: r ? r.alertas : [],
      encuesta: encuestaHost,
    };
  }

  const p = jugadorPorId(sala, ctx.jugadorId);
  const yo = { id: p.id, alias: p.alias, puesto: p.puesto, roles: p.roles, observador: p.observador };
  const out = { ...base, tipo: 'jugador', yo, ronda: rondaInfo };
  if (sala.fase === 'final' && !p.bot) out.encuesta = { hecha: sala.encuesta.hechos.has(p.id), items: ENCUESTA_ITEMS, preguntas: ENCUESTA_ABIERTAS };
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
    // Resultado de cada pedido ya enviado: lo ve todo el equipo al instante, sin revelar valores reales
    out.hechos = r.pedidos.filter((x) => x.enviado).map((x) => ({ n: x.n, puntos: x.puntos, perfecto: x.puntos === MAX_POR_PEDIDO, errores: CAMPO_IDS.filter((c) => !x.correctos[c]) }));
    const ultimo = r.estado === 'cerrada' ? resumenRonda(r) : null;
    if (ultimo) out.resultadoRonda = ultimo;
  }
  return out;
}

module.exports = {
  ROLES, ROLE_IDS, VER_SEG, extraerDatos, textoNota, CAMPOS, CAMPO_IDS, INCIDENTES, LIMITES, MAX_POR_PEDIDO, DEFAULT_CONFIG,
  crearSala, configurar, unirse, agregarBots, quitarBots, valoresComunicados, iniciarRonda, marcarListo, comprobarListos, empezarYa, cerrarRonda, reiniciar, verificarTiempo,
  enviarMensaje, enviarPedido, lanzarIncidente, enviarEncuesta, resumenEncuesta, ENCUESTA_ITEMS, ENCUESTA_ABIERTAS,
  snapshot, resumenRonda, exportarCSV,
};
