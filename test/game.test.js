'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../lib/game');
const { botTick } = require('../lib/bots');

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
function sala6() {
  const salas = new Map();
  const s = G.crearSala(salas, { rondaSeg: 120, pedidos: 3 });
  G.agregarBots(s);
  return s;
}
async function jugarConBots(s) {
  const emit = () => {};
  const opts = { fast: true };
  for (let i = 0; i < 400 && s.actual.estado === 'activa'; i++) { botTick(s, emit, opts); await esperar(15); }
}

test('agregarBots completa 6 jugadores y asigna los 6 roles', () => {
  const s = sala6();
  assert.equal(s.orden.length, 6);
  G.iniciarRonda(s);
  const roles = Object.values(s.jugadores).flatMap((p) => p.roles).sort();
  assert.deepEqual(roles, G.ROLE_IDS.slice().sort());
});

test('con 2 jugadores se reparten los roles entre ambos', () => {
  const s = G.crearSala(new Map());
  G.unirse(s, 'A'); G.unirse(s, 'B');
  G.iniciarRonda(s);
  const total = Object.values(s.jugadores).reduce((n, p) => n + p.roles.length, 0);
  assert.equal(total, 6);
});

test('ronda 1: las notas solo van al siguiente eslabón y validan los datos', () => {
  const s = G.crearSala(new Map(), { pedidos: 2 });
  const humanos = ['A', 'B', 'C', 'D', 'E', 'F'].map((a) => G.unirse(s, a));
  G.iniciarRonda(s);
  const dueno = (rol) => humanos.find((p) => p.roles.includes(rol));
  const m = G.enviarMensaje(s, dueno('planificacion').id, { datos: { destino: G.CAMPOS.destino.opciones[0] } });
  assert.equal(m.a, 'inventarios');
  assert.equal(m.tipo, 'nota');
  assert.throws(() => G.enviarMensaje(s, dueno('operativo').id, { texto: 'hola' }), /último eslabón/);
  assert.throws(() => G.enviarMensaje(s, dueno('almacen').id, { datos: { anden: 'Z9' } }), /inválido/);
  assert.throws(() => G.enviarMensaje(s, dueno('almacen').id, {}), /Escribe/);
});

test('puntaje: 7 aciertos dan 10 puntos con bonus', () => {
  const s = G.crearSala(new Map(), { pedidos: 2 });
  const hs = ['A', 'B', 'C', 'D', 'E', 'F'].map((a) => G.unirse(s, a));
  G.iniciarRonda(s);
  const op = hs.find((p) => p.roles.includes('operativo'));
  const ped = s.actual.pedidos[0];
  const ped0 = G.enviarPedido(s, op.id, { ...ped.real });
  assert.equal(ped0.puntos, G.MAX_POR_PEDIDO);
  assert.equal(s.actual.actualIdx, 1);
  const malos = {}; for (const c of G.CAMPO_IDS) malos[c] = G.CAMPOS[c].opciones.find((o) => o !== s.actual.pedidos[1].real[c]);
  const p1 = G.enviarPedido(s, op.id, malos);
  assert.equal(p1.puntos, 0);
  assert.equal(s.fase, 'entre');
});

test('un incidente cambia el dato real y avisa al dueño', () => {
  const s = sala6();
  G.iniciarRonda(s);
  const antes = { ...s.actual.pedidos[0].real };
  const inc = G.lanzarIncidente(s);
  assert.notEqual(s.actual.pedidos[0].real[inc.campo], antes[inc.campo]);
  assert.equal(s.actual.alertas.length, 1);
});

test('ronda 2 con eco: tipos de mensaje y valoresComunicados', () => {
  const s = G.crearSala(new Map(), { pedidos: 2 });
  const hs = ['A', 'B', 'C', 'D', 'E', 'F'].map((a) => G.unirse(s, a));
  G.iniciarRonda(s); G.cerrarRonda(s, 'manual'); G.iniciarRonda(s);
  const d = (rol) => hs.find((p) => p.roles.includes(rol));
  G.enviarMensaje(s, d('almacen').id, { tipo: 'tarjeta', a: 'todos', datos: { anden: 'Muelle 1' } });
  G.enviarMensaje(s, d('operativo').id, { tipo: 'eco', datos: { anden: 'Muelle 1' } });
  G.enviarMensaje(s, d('almacen').id, { tipo: 'correccion', a: 'todos', datos: { anden: 'Muelle 3' } });
  assert.throws(() => G.enviarMensaje(s, d('almacen').id, { tipo: 'eco', datos: { anden: 'Muelle 1' } }), /Operativo/);
  assert.equal(G.valoresComunicados(s.actual, 1).anden, 'Muelle 3');
  assert.equal(G.resumenRonda(s.actual).ecos, 1);
  assert.equal(G.resumenRonda(s.actual).correcciones, 1);
});

test('bots juegan las dos rondas completas y se puede exportar el CSV', async () => {
  const s = sala6();
  G.iniciarRonda(s);
  await jugarConBots(s);
  assert.equal(s.actual.estado, 'cerrada');
  assert.equal(s.fase, 'entre');
  assert.equal(G.resumenRonda(s.actual).pedidosEnviados, 3);
  G.iniciarRonda(s);
  await jugarConBots(s);
  assert.equal(s.fase, 'final');
  const csv = G.exportarCSV(s);
  assert.match(csv, /ronda,modo,pedido,campo/);
  assert.equal(s.rondas.length, 2);
  assert.ok(G.resumenRonda(s.rondas[1]).tarjetas >= 5);
});

test('el snapshot del jugador solo muestra sus datos', () => {
  const s = G.crearSala(new Map(), { pedidos: 2 });
  const hs = ['A', 'B', 'C', 'D', 'E', 'F'].map((a) => G.unirse(s, a));
  G.iniciarRonda(s);
  const alm = hs.find((p) => p.roles.includes('almacen'));
  const snap = G.snapshot(s, { tipo: 'jugador', jugadorId: alm.id });
  assert.deepEqual(snap.misCampos.map((c) => c.campo), ['anden']);
  assert.equal(snap.tipo, 'jugador');
  const host = G.snapshot(s, { tipo: 'host' });
  assert.ok(host.detalle[0].pedidos[0].real);
});

test('roles aleatorios: nadie recibe el eslabón de su puesto real (1000 sorteos)', () => {
  const puestos = ['operativo', 'operativo', 'operativo', 'almacen', 'inventarios', 'planificacion'];
  for (let n = 0; n < 1000; n++) {
    const s = G.crearSala(new Map());
    const js = puestos.map((pu, i) => G.unirse(s, 'J' + i, null, { puesto: pu }));
    G.iniciarRonda(s);
    assert.equal(s.restriccionRelajada, false);
    for (const p of js) {
      assert.equal(p.roles.length, 1);
      assert.notEqual(p.roles[0], p.puesto);
    }
    assert.deepEqual(js.flatMap((p) => p.roles).sort(), G.ROLE_IDS.slice().sort());
  }
});

test('roles aleatorios: varían entre partidas', () => {
  const vistos = new Set();
  for (let n = 0; n < 60; n++) {
    const s = G.crearSala(new Map());
    const js = ['A', 'B', 'C', 'D', 'E', 'F'].map((a) => G.unirse(s, a));
    G.iniciarRonda(s);
    vistos.add(js.map((p) => p.roles[0]).join(','));
  }
  assert.ok(vistos.size > 20);
});

test('con pocos jugadores nadie se queda sin rol y se respeta el puesto', () => {
  for (let n = 0; n < 300; n++) {
    const s = G.crearSala(new Map());
    const a = G.unirse(s, 'A', null, { puesto: 'operativo' });
    const b = G.unirse(s, 'B', null, { puesto: 'almacen' });
    const c = G.unirse(s, 'C', null, { puesto: '' });
    G.iniciarRonda(s);
    for (const p of [a, b, c]) assert.ok(p.roles.length >= 1);
    assert.ok(!a.roles.includes('operativo'));
    assert.ok(!b.roles.includes('almacen'));
    assert.equal(a.roles.length + b.roles.length + c.roles.length, 6);
  }
});

test('si el puesto hace imposible la restricción, se relaja y se avisa', () => {
  // Dos jugadores que declaran "Operativo": nadie puede tomar ese eslabón sin romper la regla.
  const s = G.crearSala(new Map());
  G.unirse(s, 'A', null, { puesto: 'operativo' });
  G.unirse(s, 'B', null, { puesto: 'operativo' });
  G.iniciarRonda(s);
  assert.equal(s.restriccionRelajada, true);
  assert.equal(Object.values(s.jugadores).reduce((n, p) => n + p.roles.length, 0), 6);
  // Con un tercer jugador sin puesto sí hay solución y no se relaja.
  const t = G.crearSala(new Map());
  G.unirse(t, 'A', null, { puesto: 'operativo' });
  G.unirse(t, 'B', null, { puesto: 'operativo' });
  G.unirse(t, 'C', null, {});
  G.iniciarRonda(t);
  assert.equal(t.restriccionRelajada, false);
  assert.ok(Object.values(t.jugadores).find((p) => p.alias === 'C').roles.includes('operativo'));
});

function salaFinal() {
  const s = G.crearSala(new Map(), { pedidos: 1 });
  const hs = ['A', 'B', 'C', 'D', 'E', 'F'].map((a) => G.unirse(s, a));
  G.iniciarRonda(s); G.cerrarRonda(s, 'manual'); G.iniciarRonda(s); G.cerrarRonda(s, 'manual');
  return { s, hs };
}

test('formulario: solo se abre al final y valida las respuestas', () => {
  const s = G.crearSala(new Map());
  const a = G.unirse(s, 'A');
  assert.throws(() => G.enviarEncuesta(s, a.id, { likert: [5, 5, 5, 5, 5, 5, 5, 5], abiertas: [] }), /cuando termina/);
  const { s: f, hs } = salaFinal();
  assert.equal(f.fase, 'final');
  assert.throws(() => G.enviarEncuesta(f, hs[0].id, { likert: [5, 5, 5], abiertas: [] }), /8 afirmaciones/);
  assert.throws(() => G.enviarEncuesta(f, hs[0].id, { likert: [5, 5, 5, 5, 5, 5, 5, 6], abiertas: [] }), /8 afirmaciones/);
  G.enviarEncuesta(f, hs[0].id, { likert: [5, 4, 3, 2, 1, 5, 4, 3], abiertas: ['Muy útil', '', 'Confirmar datos'] });
  assert.throws(() => G.enviarEncuesta(f, hs[0].id, { likert: [5, 5, 5, 5, 5, 5, 5, 5], abiertas: [] }), /Ya enviaste/);
});

test('formulario: promedios, distribución y anonimato en el resumen y el CSV', () => {
  const { s, hs } = salaFinal();
  G.enviarEncuesta(s, hs[0].id, { likert: [5, 5, 5, 5, 5, 5, 5, 5], abiertas: ['Zeta útil', 'Más tiempo', ''] });
  G.enviarEncuesta(s, hs[1].id, { likert: [3, 3, 3, 3, 3, 3, 3, 3], abiertas: ['Alfa útil', '', ''] });
  const r = G.resumenEncuesta(s);
  assert.equal(r.respondieron, 2);
  assert.equal(r.total, 6);
  assert.equal(r.items[0].promedio, 4);
  assert.deepEqual(r.items[0].dist, [0, 0, 1, 0, 1]);
  assert.deepEqual(r.abiertas[0].respuestas, ['Alfa útil', 'Zeta útil']); // orden alfabético, no por llegada
  assert.ok(!JSON.stringify(r).includes(hs[0].id), 'no debe aparecer ningún identificador de jugador');
  const csv = G.exportarCSV(s);
  assert.match(csv, /formulario_satisfaccion/);
  assert.match(csv, /respuestas_abiertas/);
  assert.ok(!csv.includes(hs[0].token));
  const snapJ = G.snapshot(s, { tipo: 'jugador', jugadorId: hs[0].id });
  assert.equal(snapJ.encuesta.hecha, true);
  assert.equal(G.snapshot(s, { tipo: 'jugador', jugadorId: hs[2].id }).encuesta.hecha, false);
  assert.equal(G.snapshot(s, { tipo: 'host' }).encuesta.respondieron, 2);
});

test('formulario: los bots no responden y reiniciar lo borra', () => {
  const s = G.crearSala(new Map(), { pedidos: 1 });
  G.unirse(s, 'A'); G.agregarBots(s);
  G.iniciarRonda(s); G.cerrarRonda(s, 'manual'); G.iniciarRonda(s); G.cerrarRonda(s, 'manual');
  const bot = Object.values(s.jugadores).find((p) => p.bot);
  assert.throws(() => G.enviarEncuesta(s, bot.id, { likert: [5, 5, 5, 5, 5, 5, 5, 5], abiertas: [] }), /bots/);
  assert.equal(G.resumenEncuesta(s).total, 1);
  const humano = Object.values(s.jugadores).find((p) => !p.bot);
  G.enviarEncuesta(s, humano.id, { likert: [4, 4, 4, 4, 4, 4, 4, 4], abiertas: [] });
  G.reiniciar(s);
  assert.equal(G.resumenEncuesta(s).respondieron, 0);
});

test('compuerta: el reloj no corre hasta que todos los humanos tocan Listo', () => {
  const s = G.crearSala(new Map(), { rondaSeg: 120, pedidos: 3 });
  const a = G.unirse(s, 'Ana'); const b = G.unirse(s, 'Beto');
  G.agregarBots(s);
  const r = G.iniciarRonda(s, { compuerta: true });
  assert.equal(r.estado, 'preparando');
  assert.equal(r.fin, null);
  assert.throws(() => G.enviarMensaje(s, a.id, { como: s.jugadores[a.id].roles[0], datos: {} }));
  assert.equal(G.marcarListo(s, a.id), false);
  assert.equal(r.estado, 'preparando');
  assert.equal(G.marcarListo(s, b.id), true);
  assert.equal(r.estado, 'activa');
  assert.ok(r.fin > Date.now() + 100000);
});

test('compuerta: empezarYa arranca sin esperar y sin humanos arranca de inmediato', () => {
  const s = G.crearSala(new Map(), { rondaSeg: 60, pedidos: 2 });
  G.unirse(s, 'Ana'); G.unirse(s, 'Beto');
  const r = G.iniciarRonda(s, { compuerta: true });
  assert.equal(r.estado, 'preparando');
  assert.equal(G.empezarYa(s), true);
  assert.equal(r.estado, 'activa');
  const t = G.crearSala(new Map(), { rondaSeg: 60, pedidos: 2 });
  G.agregarBots(t);
  assert.equal(G.iniciarRonda(t, { compuerta: true }).estado, 'activa');
});

test('compuerta: si un humano pendiente se desconecta, la ronda arranca', () => {
  const s = G.crearSala(new Map(), { rondaSeg: 60, pedidos: 2 });
  const a = G.unirse(s, 'Ana'); const b = G.unirse(s, 'Beto');
  const r = G.iniciarRonda(s, { compuerta: true });
  G.marcarListo(s, a.id);
  s.jugadores[b.id].conectado = false;
  assert.equal(G.comprobarListos(s), true);
  assert.equal(r.estado, 'activa');
});

test('hechos: el equipo ve el resultado de cada pedido enviado sin los valores reales', () => {
  const s = G.crearSala(new Map(), { rondaSeg: 60, pedidos: 3 });
  const humanos = ['A', 'B', 'C', 'D', 'E', 'F'].map((a) => G.unirse(s, a));
  G.iniciarRonda(s);
  const op = humanos.find((p) => p.roles.includes('operativo'));
  const otro = humanos.find((p) => p !== op);
  assert.deepEqual(G.snapshot(s, { tipo: 'jugador', jugadorId: otro.id }).hechos, []);
  const ped = s.actual.pedidos[0];
  const valores = { ...ped.real };
  const real = ped.real.producto;
  valores.producto = G.CAMPOS.producto.opciones.find((o) => o !== real);
  G.enviarPedido(s, op.id, valores);
  const h = G.snapshot(s, { tipo: 'jugador', jugadorId: otro.id }).hechos;
  assert.equal(h.length, 1);
  assert.equal(h[0].perfecto, false);
  assert.deepEqual(h[0].errores, ['producto']);
  assert.equal(h[0].puntos, 6);
  assert.ok(!Object.values(h[0]).includes(real));
});

test('ronda 1: la nota escrita se envía una sola vez por pedido y reconoce los datos que menciona', () => {
  const s = G.crearSala(new Map(), { pedidos: 2 });
  const hs = ['A', 'B', 'C', 'D', 'E', 'F'].map((a) => G.unirse(s, a));
  G.iniciarRonda(s);
  const dueno = (rol) => hs.find((p) => p.roles.includes(rol));
  const m = G.enviarMensaje(s, dueno('almacen').id, { texto: 'Camión 3, muelle 2 y 08:00' });
  assert.equal(m.texto, 'Camión 3, muelle 2 y 08:00');
  assert.deepEqual(m.datos, { anden: 'Muelle 2', unidad: 'Camión 3', horario: '08:00' });
  assert.throws(() => G.enviarMensaje(s, dueno('almacen').id, { texto: 'otra vez' }), /una sola vez|Ya enviaste/);
  const sinDatos = G.enviarMensaje(s, dueno('planificacion').id, { texto: 'no me acuerdo' });
  assert.equal(sinDatos.datos, null);
  const op = dueno('operativo');
  G.enviarPedido(s, op.id, { ...s.actual.pedidos[0].real });
  assert.doesNotThrow(() => G.enviarMensaje(s, dueno('almacen').id, { texto: 'pedido nuevo' }));
});

test('ronda 1: el estado trae cuándo empezó el pedido y cuántos segundos se ven los datos', () => {
  const s = G.crearSala(new Map(), { pedidos: 2 });
  const hs = ['A', 'B', 'C', 'D', 'E', 'F'].map((a) => G.unirse(s, a));
  G.iniciarRonda(s);
  const snap = G.snapshot(s, { tipo: 'jugador', jugadorId: hs[0].id });
  assert.equal(snap.ronda.verSeg, G.VER_SEG);
  assert.ok(snap.ronda.pedidoDesde > 0);
});

test('ruta: el estado dice qué eslabones ya comunicaron en el pedido actual', () => {
  const s = G.crearSala(new Map(), { pedidos: 2 });
  const hs = ['A', 'B', 'C', 'D', 'E', 'F'].map((a) => G.unirse(s, a));
  G.iniciarRonda(s);
  const dueno = (rol) => hs.find((p) => p.roles.includes(rol));
  const ver = () => G.snapshot(s, { tipo: 'jugador', jugadorId: hs[0].id }).ronda.progreso;
  assert.deepEqual(ver(), []);
  G.enviarMensaje(s, dueno('planificacion').id, { texto: 'Cliente La Paz a las 08:00' });
  G.enviarMensaje(s, dueno('inventarios').id, { texto: 'Nido 60' });
  assert.deepEqual(ver(), ['planificacion', 'inventarios']);
  G.enviarPedido(s, dueno('operativo').id, { ...s.actual.pedidos[0].real });
  assert.deepEqual(ver(), []);
});

test('ronda 2: se puede hablar directo, las notas son de todos y los mensajes directos son privados', () => {
  const s = G.crearSala(new Map(), { pedidos: 2 });
  const hs = ['A', 'B', 'C', 'D', 'E', 'F'].map((a) => G.unirse(s, a));
  G.iniciarRonda(s); G.cerrarRonda(s, 'manual'); G.iniciarRonda(s);
  assert.equal(s.actual.modo, 'chat');
  const dueno = (rol) => hs.find((p) => p.roles.includes(rol));
  const nota = G.enviarMensaje(s, dueno('almacen').id, { a: 'todos', tipo: 'tarjeta', texto: 'Mi muelle es Muelle 3' });
  assert.deepEqual(nota.datos, { anden: 'Muelle 3' });
  G.enviarMensaje(s, dueno('almacen').id, { a: 'todos', tipo: 'tarjeta', texto: 'Mejor Muelle 2' });
  G.enviarMensaje(s, dueno('transporte').id, { a: 'seguridad', tipo: 'msg', texto: 'Oye, ¿qué restricción tiene?' });
  const ve = (rol) => G.snapshot(s, { tipo: 'jugador', jugadorId: dueno(rol).id }).mensajes.map((m) => m.texto);
  assert.ok(ve('inventarios').includes('Mejor Muelle 2'), 'la nota de todos la ve cualquiera');
  assert.ok(ve('seguridad').includes('Oye, ¿qué restricción tiene?'), 'el destinatario ve el mensaje directo');
  assert.ok(!ve('inventarios').includes('Oye, ¿qué restricción tiene?'), 'un tercero no ve el mensaje directo');
});
