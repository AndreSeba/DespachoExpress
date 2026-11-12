import { useState } from 'react';
import { motion } from 'framer-motion';
import { MISION, NOMBRE_ROL, ORDEN, PASOS, REGLA } from '../lib/constants';
import { fx } from '../lib/fx';
import { Hero, Ic, IcRol, Tarjeta, colorRol, toast } from '../lib/ui';
import { Cadena, Paso, type Ctx } from './util';
import { CargaCamion } from '../lib/Camion';
import type { EstadoJugador } from '../lib/types';

export function Unirse({ error, onEntrar }: { error?: string; onEntrar: (code: string, alias: string, puesto: string) => void }) {
  const [code, setCode] = useState((new URLSearchParams(location.search).get('c') || '').toUpperCase().slice(0, 4));
  const [alias, setAlias] = useState('');
  const [puesto, setPuesto] = useState('');
  const entrar = () => {
    const c = code.trim().toUpperCase(), a = alias.trim();
    if (c.length !== 4 || !a) return toast('Escribe el código de 4 letras y tu nombre.');
    onEntrar(c, a, puesto);
  };
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4 py-8">
      <Hero className="text-center">
        <motion.div initial={{ scale: 0.5, rotate: -10, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: 'spring', damping: 11 }} className="mx-auto mb-3 grid size-20 place-items-center rounded-3xl bg-white/15 text-4xl backdrop-blur"><Ic n="bi-truck" /></motion.div>
        <h1 className="m-0 text-3xl font-extrabold tracking-tight">Despacho Express</h1>
        <p className="m-0 mt-1 text-white/70">Juego en equipo. Entra con el código de la pantalla.</p>
      </Hero>
      <motion.form initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="panel space-y-4 p-5" onSubmit={(e) => { e.preventDefault(); entrar(); }}>
        <div>
          <label className="label" htmlFor="codigoIn">Código de sala</label>
          <input id="codigoIn" className="input text-center text-2xl font-extrabold uppercase" style={{ letterSpacing: '.5rem' }} maxLength={4} autoComplete="off" autoCapitalize="characters" aria-label="Código de sala" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
        </div>
        <div>
          <label className="label" htmlFor="nombreIn">Tu nombre o apodo</label>
          <input id="nombreIn" className="input" maxLength={20} autoComplete="off" aria-label="Tu nombre" value={alias} onChange={(e) => setAlias(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="puestoIn">Mi trabajo se parece más a</label>
          <select id="puestoIn" className="input" aria-label="Eslabón parecido a tu trabajo" value={puesto} onChange={(e) => setPuesto(e.target.value)}>
            <option value="">Ninguno o no estoy seguro</option>
            {ORDEN.map((r) => <option key={r} value={r}>{NOMBRE_ROL[r]}</option>)}
          </select>
          <p className="muted m-0 mt-1.5 text-xs">Así te toca un rol distinto al tuyo.</p>
        </div>
        <button id="entrarBtn" type="submit" className="btn btn-primary btn-lg btn-block"><Ic n="bi-box-arrow-in-right" />Entrar</button>
      </motion.form>
      {error && <div className="rounded-2xl bg-bad/15 p-3 text-sm font-semibold text-bad" role="alert">{error}</div>}
    </div>
  );
}

export function Lobby({ S }: { S: EstadoJugador }) {
  return (
    <div className="space-y-3">
      <Hero>
        <h2 className="m-0 flex items-center gap-2 text-2xl font-extrabold"><Ic n="bi-hourglass-split" />Esperando a que empiece</h2>
        <p className="m-0 mt-1 text-white/70">Sala {S.code}. Entraste como {S.yo.alias}.</p>
      </Hero>
      <CargaCamion fraccion={S.jugadores.length / 6} titulo="Cargando el equipo" detalle={`${S.jugadores.length} de 6 en la sala`} />
      <Tarjeta icono="bi-people" titulo={`En la sala (${S.jugadores.length})`}>
        <div className="flex flex-wrap">
          {S.jugadores.map((j) => (
            <motion.span key={j.id} layout initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="dato"><Ic n={j.bot ? 'bi-robot' : 'bi-person-fill'} />{j.alias}</motion.span>
          ))}
        </div>
      </Tarjeta>
    </div>
  );
}

export function Espera({ numero }: { numero: number }) {
  return (
    <Hero><h2 className="m-0 flex items-center gap-2 text-2xl font-extrabold"><Ic n="bi-eye" />Ronda {numero} por empezar</h2><p className="m-0 mt-1 text-white/70">Esperando al equipo.</p></Hero>
  );
}

export function Briefing({ c }: { c: Ctx }) {
  const { S, rol, roles } = c; const r = S.ronda!;
  const pr = r.preparacion || { listos: [], requeridos: [] };
  const yaListo = pr.listos.includes(S.yo.id);
  const nListos = pr.listos.filter((id) => pr.requeridos.includes(id)).length;
  const k = r.modo === 'notas' ? 'notas' : 'chat';
  return (
    <div className="space-y-3">
      <Hero className="text-center">
        <div className="text-xs font-bold uppercase tracking-widest text-white/70">Te tocó</div>
        <motion.div initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', damping: 10 }} className="mx-auto my-3 grid size-24 place-items-center rounded-[2rem] text-5xl text-white shadow-2xl" style={{ background: colorRol(rol) }}><IcRol rol={rol} /></motion.div>
        <h2 className="m-0 text-2xl font-extrabold">{roles.length > 1 ? roles.map((x) => NOMBRE_ROL[x]).join(' + ') : NOMBRE_ROL[rol]}</h2>
        <p className="m-0 mt-1 text-white/75">{roles.map((x) => MISION[x]).join(' ')}</p>
      </Hero>
      <section className="panel px-3 py-3"><Cadena S={S} rol={rol} /></section>
      {k === 'chat' && (
        <motion.section initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex items-start gap-3 rounded-3xl border-2 border-brand-400 bg-[color-mix(in_oklab,var(--color-brand-500)_9%,var(--surface))] p-4" id="avisoHablar">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-500 text-2xl text-white shadow-lg"><Ic n="bi-chat-dots-fill" /></span>
          <div>
            <div className="text-lg font-extrabold leading-tight">Ahora sí pueden hablar</div>
            <p className="m-0 mt-1 text-sm">En la ronda 1 no se podía preguntar. Ahora pregunten, confirmen y corrijan entre ustedes. Escriban a <b>todos</b> o <b>solo a una persona</b>.</p>
          </div>
        </motion.section>
      )}
      <Tarjeta icono="bi-signpost-split" titulo={k === 'notas' ? 'Así se juega esta ronda' : 'Ahora cambia la forma de comunicarse'}>
        <ul className="m-0 list-none space-y-2.5 p-0">
          {REGLA[k].map(([i, t]) => <li key={t} className="flex items-center gap-3"><span className="titulo-ic shrink-0"><Ic n={i} /></span><span className="font-medium">{t}</span></li>)}
        </ul>
      </Tarjeta>
      <Tarjeta icono="bi-flag" titulo={`Ronda ${r.numero}`}>
        <div className="grid grid-cols-3 gap-2">{PASOS[k].map(([i, t], n) => <Paso key={t} icono={i} texto={t} n={n + 1} />)}</div>
      </Tarjeta>
      {yaListo ? (
        <CargaCamion id="esperandoListos" fraccion={pr.requeridos.length ? nListos / pr.requeridos.length : 0} titulo="Esperando al equipo" detalle={`Esperando al equipo: ${nListos} de ${pr.requeridos.length}`} />
      ) : (
        <button id="entendidoBtn" type="button" className="btn btn-primary btn-lg btn-block" onClick={() => { fx.sonar('listo'); fx.vibrar(40); c.enviar({ t: 'listo' }); }}><Ic n="bi-play-fill" />Listo</button>
      )}
    </div>
  );
}
