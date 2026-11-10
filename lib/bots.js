'use strict';
/**
 * Bots de "Despacho Express": jugadores simulados que ocupan los roles vacíos.
 * Sirven para probar el panel de la facilitadora y para practicar sin tener 6 personas.
 * Su comportamiento (omitir, cambiar o dejar desactualizado un dato) son parámetros del ejercicio, no datos reales.
 */
const G = require('./game');
const { CAMPOS, CAMPO_IDS, ROLE_IDS, ROLES } = G;

const PARAM = {
  r1: { omitir: 0.25, cambiar: 0.10 },
  r2: { cambiar: 0.10, desactualizado: 0.6, reaccion: 0.6, correccion: 0.8 },
};

function pick(arr, rng) { return arr[Math.floor(rng() * arr.length)]; }
function otro(c, v, rng) { return pick(CAMPOS[c].opciones.filter((o) => o !== v), rng); }

function botTick(sala, emit, opts = {}) {
  const r = sala.actual;
  if (!r || r.estado !== 'activa') return;
  const ped = r.pedidos[r.actualIdx];
  if (!ped) return;
  const rng = opts.rng || Math.random;
  const delay = (min, max) => (opts.fast ? 5 : min + rng() * (max - min));
  const flags = (sala.botFlags = sala.botFlags || new Set());
  const pedN = r.actualIdx + 1;
  const base = `r${r.numero}p${pedN}`;
  const jugadores = Object.values(sala.jugadores);
  const bots = jugadores.filter((p) => p.bot && p.roles.length);
  const hayHumanoNoOperativo = jugadores.some((p) => !p.bot && p.roles.some((x) => x !== 'operativo'));

  const programar = (key, ms, fn) => {
    if (flags.has(key)) return;
    flags.add(key);
    setTimeout(() => {
      const rr = sala.actual;
      if (!rr || rr !== r || rr.estado !== 'activa' || rr.actualIdx + 1 !== pedN) return;
      try { fn(); } catch (e) { /* una acción de bot inválida se ignora */ }
      emit();
      botTick(sala, emit, opts);
    }, ms);
  };

  const armarValores = (datos) => {
    const out = {};
    for (const c of CAMPO_IDS) out[c] = datos[c] != null ? datos[c] : pick(CAMPOS[c].opciones, rng);
    return out;
  };

  if (r.modo === 'notas') {
    for (const p of bots) {
      for (const rol of p.roles) {
        const i = ROLE_IDS.indexOf(rol);
        if (rol === 'operativo') {
          const nota = r.mensajes.filter((m) => m.pedidoN === pedN && m.tipo === 'nota' && m.a === 'operativo').pop();
          if (nota) programar(`${base}:${rol}:envio`, delay(900, 1800), () => G.enviarPedido(sala, p.id, armarValores(nota.datos || {})));
        } else {
          const previa = i === 0 ? null : r.mensajes.filter((m) => m.pedidoN === pedN && m.tipo === 'nota' && m.de === ROLE_IDS[i - 1] && m.a === rol).pop();
          if (i === 0 || previa) {
            programar(`${base}:${rol}:nota`, delay(700, 1600), () => {
              const entrante = previa ? (previa.datos || {}) : {};
              const out = {};
              for (const c of Object.keys(entrante)) {
                const x = rng();
                if (x < PARAM.r1.omitir) continue;
                out[c] = x < PARAM.r1.omitir + PARAM.r1.cambiar ? otro(c, entrante[c], rng) : entrante[c];
              }
              for (const c of ROLES[i].campos) out[c] = ped.real[c];
              G.enviarMensaje(sala, p.id, { como: rol, datos: out });
            });
          }
        }
      }
    }
    return;
  }

  // Ronda 2: conversar y confirmar
  const noOperativos = ROLE_IDS.filter((x) => x !== 'operativo');
  for (const p of bots) {
    for (const rol of p.roles) {
      if (rol === 'operativo') continue;
      const i = ROLE_IDS.indexOf(rol);
      programar(`${base}:${rol}:tarjeta`, delay(500, 1800), () => {
        const datos = {};
        for (const c of ROLES[i].campos) {
          const inc = ped.incidentes.find((x) => x.campo === c);
          if (inc && rng() < PARAM.r2.desactualizado) datos[c] = inc.anterior;
          else if (rng() < PARAM.r2.cambiar) datos[c] = otro(c, ped.real[c], rng);
          else datos[c] = ped.real[c];
        }
        G.enviarMensaje(sala, p.id, { como: rol, a: 'todos', tipo: 'tarjeta', datos });
      });
      // reacciona a incidentes de su dato
      for (const al of r.alertas.filter((x) => x.pedidoN === pedN && x.rol === rol)) {
        if (!flags.has(`${base}:${al.id}:reac`)) {
          if (rng() < PARAM.r2.reaccion) {
            programar(`${base}:${al.id}:reac`, delay(800, 2000), () => G.enviarMensaje(sala, p.id, { como: rol, a: 'todos', tipo: 'correccion', datos: { [al.campo]: ped.real[al.campo] } }));
          } else flags.add(`${base}:${al.id}:reac`);
        }
      }
    }
  }

  const eco = r.mensajes.filter((m) => m.pedidoN === pedN && m.tipo === 'eco').pop();
  for (const p of bots) {
    if (!p.roles.includes('operativo')) continue;
    const publicaron = noOperativos.filter((rl) => r.mensajes.some((m) => m.pedidoN === pedN && m.de === rl && m.tipo === 'tarjeta'));
    const tarde = Date.now() - (r.pedidoT0 || r.inicio) > 25000;
    if (publicaron.length === noOperativos.length || tarde) {
      programar(`${base}:eco`, delay(900, 1600), () => G.enviarMensaje(sala, p.id, { como: 'operativo', tipo: 'eco', datos: G.valoresComunicados(r, pedN) }));
    }
    if (eco) {
      programar(`${base}:envio`, (opts.fast ? 20 : (hayHumanoNoOperativo ? 12000 : 3000)) + delay(0, 600), () => G.enviarPedido(sala, p.id, armarValores(G.valoresComunicados(r, pedN))));
    }
  }
  if (eco) {
    for (const p of bots) {
      for (const rol of p.roles) {
        if (rol === 'operativo') continue;
        for (const c of ROLES[ROLE_IDS.indexOf(rol)].campos) {
          if (eco.datos && eco.datos[c] === ped.real[c]) continue;
          if (flags.has(`${base}:${rol}:${c}:corr`)) continue;
          if (rng() < PARAM.r2.correccion) {
            programar(`${base}:${rol}:${c}:corr`, delay(600, 1600), () => G.enviarMensaje(sala, p.id, { como: rol, a: 'todos', tipo: 'correccion', datos: { [c]: ped.real[c] } }));
          } else flags.add(`${base}:${rol}:${c}:corr`);
        }
      }
    }
  }
}

module.exports = { botTick, PARAM };
