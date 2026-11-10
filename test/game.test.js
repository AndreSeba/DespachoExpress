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
  const m = G.enviarMensaje(s, dueno('atencion').id, { datos: { destino: G.CAMPOS.destino.opciones[0] } });
  assert.equal(m.a, 'planificacion');
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
  G.enviarMensaje(s, d('almacen').id, { tipo: 'tarjeta', a: 'todos', datos: { anden: 'A1' } });
  G.enviarMensaje(s, d('operativo').id, { tipo: 'eco', datos: { anden: 'A1' } });
  G.enviarMensaje(s, d('almacen').id, { tipo: 'correccion', a: 'todos', datos: { anden: 'A3' } });
  assert.throws(() => G.enviarMensaje(s, d('almacen').id, { tipo: 'eco', datos: { anden: 'A1' } }), /Operativo/);
  assert.equal(G.valoresComunicados(s.actual, 1).anden, 'A3');
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
  const puestos = ['operativo', 'operativo', 'operativo', 'almacen', 'planificacion', 'atencion'];
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
