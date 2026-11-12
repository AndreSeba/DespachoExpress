import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ICON_CAMPO, NOMBRE_ROL, ROL_DE_CAMPO } from '../lib/constants';
import { fx } from '../lib/fx';
import { Hero, Ic, IcRol, Tarjeta, cx } from '../lib/ui';
import { rachaMax } from './util';
import type { EstadoJugador } from '../lib/types';

function Recorrido({ S }: { S: EstadoJugador }) {
  const res = S.resumenes[S.resumenes.length - 1];
  const h = S.hechos || [];
  const notas = res.modo === 'notas';
  const antes = S.resumenes[S.resumenes.length - 2];
  const dif = antes ? res.puntos - antes.puntos : null;
  return (
    <Tarjeta icono="bi-diagram-3" titulo="Dónde se perdió información">
      {h.length ? h.map((x) => (
        <div key={x.n} className="flex items-center gap-3 border-b border-[var(--line)] py-2.5 last:border-0">
          <span className={cx('bola', x.perfecto ? 'ok' : 'regular')}><Ic n={x.perfecto ? 'bi-check-lg' : 'bi-exclamation-lg'} /></span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold">Pedido {x.n}</div>
            {x.perfecto ? <div className="muted text-xs">Todo llegó bien</div> : (
              <div className="mt-1 flex flex-wrap">
                {x.errores.map((c) => (
                  <span key={c} className="dato bad" title={NOMBRE_ROL[ROL_DE_CAMPO[c]]} style={{ fontSize: '.75rem', padding: '.2rem .55rem' }}><Ic n={ICON_CAMPO[c]} />{S.campos[c].label.split(' (')[0]}</span>
                ))}
              </div>
            )}
          </div>
          <span className="tabular text-lg font-extrabold">{x.puntos}/{S.maxPorPedido}</span>
        </div>
      )) : <p className="muted m-0">No se envió ningún pedido.</p>}
      <div className="mt-3 rounded-2xl bg-[color-mix(in_oklab,#0E9AA7_14%,var(--surface))] p-3 text-sm">
        <div className="flex items-center gap-1.5 font-semibold"><Ic n="bi-lightbulb" />{notas ? 'Sin retorno, los errores se arrastran hasta el final.' : 'Con eco y correcciones, los errores se detectan antes de despachar.'}</div>
        {dif !== null && <div className="mt-1 font-extrabold">{dif >= 0 ? '+' : ''}{dif} puntos frente a la ronda anterior</div>}
        <div className="muted mt-1">Es una simulación con datos ficticios: no prueba una mejora real.</div>
      </div>
    </Tarjeta>
  );
}

function Logros({ S }: { S: EstadoJugador }) {
  const res = S.resumenes[S.resumenes.length - 1];
  const h = S.hechos || [];
  const frac = res.max ? res.puntos / res.max : 0;
  const n = frac >= 0.95 ? 3 : frac >= 0.7 ? 2 : frac >= 0.4 ? 1 : 0;
  const total = S.ronda ? S.ronda.pedidosTotal : 0; const rm = rachaMax(h);
  const ins: [string, string][] = [];
  if (total && res.perfectos === total) ins.push(['bi-trophy-fill', 'Todo perfecto']);
  if (rm >= 2) ins.push(['bi-fire', `Racha de ${rm}`]);
  if (res.correcciones > 0) ins.push(['bi-pencil-fill', `${res.correcciones} ${res.correcciones === 1 ? 'corrección' : 'correcciones'} a tiempo`]);
  const antes = S.resumenes[S.resumenes.length - 2];
  if (antes && res.puntos > antes.puntos) ins.push(['bi-graph-up-arrow', 'Más puntos que la ronda anterior']);
  if (!ins.length) ins.push(['bi-lightbulb', 'A practicar el eco']);
  const hecho = useRef('');
  useEffect(() => {
    const clave = `${res.numero}:${S.fase}`;
    if (n >= 2 && hecho.current !== clave) { hecho.current = clave; const t = setTimeout(() => { fx.confeti(60); fx.sonar('perfecto'); fx.vibrar([80, 40, 80]); }, 400); return () => clearTimeout(t); }
  });
  return (
    <Tarjeta icono="bi-award" titulo="Logros">
      <div className="mb-3 flex justify-center gap-2" aria-label={`${n} de 3 estrellas`}>
        {[1, 2, 3].map((i) => <span key={i} className={cx('estrella', i <= n && 'on')} style={{ animationDelay: `${0.2 + i * 0.25}s` }}><Ic n={i <= n ? 'bi-star-fill' : 'bi-star'} /></span>)}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {ins.map(([i, t], k) => <span key={t} className="insignia" style={{ animationDelay: `${1 + k * 0.2}s` }}><Ic n={i} />{t}</span>)}
      </div>
    </Tarjeta>
  );
}

function Encuesta({ S, enviar }: { S: EstadoJugador; enviar: (o: object) => void }) {
  const e = S.encuesta!;
  const [likert, setLikert] = useState<number[]>(() => e.items.map(() => 0));
  const [abiertas, setAbiertas] = useState<string[]>(() => e.preguntas.map(() => ''));
  if (e.hecha) {
    return (
      <Tarjeta><div id="encuestaGracias" className="py-4 text-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 8 }} className="text-6xl text-ok"><Ic n="bi-check-circle-fill" /></motion.div>
        <h2 className="mb-1 mt-2 text-xl font-extrabold">Gracias por responder</h2><p className="muted m-0 text-sm">Tu respuesta es anónima: no se guarda quién la envió.</p>
      </div></Tarjeta>
    );
  }
  return (
    <Tarjeta id="encuestaCard" icono="bi-clipboard-check" titulo="Formulario de satisfacción">
      <p className="muted mt-0 text-sm">Anónimo. 1 = nada de acuerdo, 5 = totalmente de acuerdo.</p>
      {e.items.map((texto, i) => (
        <div key={i} className="mb-4">
          <div className="mb-1.5 text-sm font-bold">{i + 1}. {texto}</div>
          <div className="grid grid-cols-5 gap-1.5" role="group" aria-label={texto}>
            {[1, 2, 3, 4, 5].map((n) => (
              <span key={n}>
                <input type="radio" className="peer sr-only" name={'it' + i} id={`it${i}_${n}`} autoComplete="off" onChange={() => setLikert((l) => l.map((v, k) => (k === i ? n : v)))} />
                <label htmlFor={`it${i}_${n}`} className="block cursor-pointer rounded-xl border-[1.5px] border-[var(--line)] bg-[var(--surface-2)] py-2.5 text-center font-extrabold transition peer-checked:border-brand-500 peer-checked:bg-brand-500 peer-checked:text-white peer-focus-visible:ring-4 peer-focus-visible:ring-brand-500/30">{n}</label>
              </span>
            ))}
          </div>
        </div>
      ))}
      {e.preguntas.map((q, i) => (
        <div key={i} className="mb-4">
          <label className="mb-1.5 block text-sm font-bold" htmlFor={'ab' + i}>{q}</label>
          <textarea id={'ab' + i} className="input resize-none" rows={2} maxLength={300} value={abiertas[i]} onChange={(ev) => setAbiertas((a) => a.map((v, k) => (k === i ? ev.target.value : v)))} />
        </div>
      ))}
      <button id="encuestaEnviar" type="button" className="btn btn-primary btn-lg btn-block" disabled={!likert.every((n) => n > 0)} onClick={() => enviar({ t: 'encuesta', likert, abiertas })}><Ic n="bi-send" />Enviar formulario</button>
    </Tarjeta>
  );
}

export function Resultado({ S, enviar }: { S: EstadoJugador; enviar: (o: object) => void }) {
  const res = S.resumenes[S.resumenes.length - 1];
  const final = S.fase === 'final';
  return (
    <div className="space-y-3">
      <Hero>
        <h2 className="m-0 flex items-center gap-2 text-2xl font-extrabold"><Ic n={final ? 'bi-flag-fill' : 'bi-pause-circle'} />{final ? 'Fin del juego' : 'Ronda terminada'}</h2>
        <p className="m-0 mt-1 text-white/70">Mira la pantalla.</p>
      </Hero>
      {res && (
        <Tarjeta icono="bi-flag" titulo={`Ronda ${res.numero}`}>
          <div className="tabular flex items-baseline gap-1"><span className="score">{res.puntos}</span><span className="muted text-xl font-bold">/{res.max}</span></div>
          <div className="my-3 h-3 overflow-hidden rounded-full bg-[var(--line)]" role="progressbar" aria-valuenow={res.puntos} aria-valuemin={0} aria-valuemax={res.max}>
            <motion.div className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600" initial={{ width: 0 }} animate={{ width: `${(res.puntos / res.max) * 100}%` }} transition={{ duration: 0.9, ease: 'easeOut' }} />
          </div>
          <div className="flex flex-wrap">
            <span className="dato"><Ic n="bi-check-circle" />{res.perfectos} perfectos</span>
            <span className="dato"><Ic n="bi-envelope" />{res.mensajes} mensajes</span>
            <span className="dato"><Ic n="bi-pencil" />{res.correcciones} correcciones</span>
          </div>
        </Tarjeta>
      )}
      {res && <Recorrido S={S} />}
      {res && <Logros S={S} />}
      {final && S.encuesta && <Encuesta S={S} enviar={enviar} />}
    </div>
  );
}

