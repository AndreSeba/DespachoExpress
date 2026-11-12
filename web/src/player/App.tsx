import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { NOMBRE_ROL, mmss } from '../lib/constants';
import { fx } from '../lib/fx';
import { guardado, guardar, useSocket } from '../lib/net';
import { Avisos, Ic, IcRol, cx, toast, useAhora, colorRol } from '../lib/ui';
import type { EstadoJugador, Hecho } from '../lib/types';
import { Briefing, Espera, Lobby, Unirse } from './Pantallas';
import { Juego } from './Juego';
import { Resultado } from './Resultado';
import { useEfectos } from './useEfectos';
import type { Ctx } from './util';

const KEY = 'dx_jugador';
interface Sesion { code: string; token: string | null; alias: string }

export default function App() {
  const [S, setS] = useState<EstadoJugador | null>(null);
  const [offset, setOffset] = useState(0);
  const [errorUnirse, setErrorUnirse] = useState<string | undefined>();
  const [rolSel, setRolSel] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ x: Hecho; racha: number; id: number } | null>(null);
  const [sonido, setSonido] = useState(fx.sonido);
  const sesion = useRef<Sesion | null>(guardado<Sesion>(KEY));
  const borradores = useRef<Record<string, string>>({});
  const [, forzar] = useState(0);

  const { enviar } = useSocket(
    (send) => { const s = sesion.current; if (s && s.token) send({ t: 'unirse', code: s.code, alias: s.alias, token: s.token }); else forzar((n) => n + 1); },
    (m) => {
      if (m.t === 'unido') { sesion.current = { code: m.code, token: m.token, alias: sesion.current ? sesion.current.alias : '' }; guardar(KEY, sesion.current); }
      else if (m.t === 'error') {
        if (m.codigo === 'sala') { sesion.current = null; guardar(KEY, null); setS(null); setErrorUnirse(m.msg); } else toast(m.msg);
      } else if (m.t === 'estado') { setS(m as EstadoJugador); setOffset(m.ahora - Date.now()); setErrorUnirse(undefined); }
    },
  );

  const roles = S?.yo?.roles ?? [];
  const rol = roles.length ? (rolSel && roles.includes(rolSel) ? rolSel : roles[0]) : null;
  useEfectos(S, rol, (x, racha) => setAviso({ x, racha, id: Date.now() }));
  const numeroRonda = S?.ronda?.numero;
  useEffect(() => { setAviso(null); }, [numeroRonda]);
  useEffect(() => { if (!aviso) return; const t = setTimeout(() => setAviso(null), 3400); return () => clearTimeout(t); }, [aviso]);

  const enviarMsg = useCallback((o: object) => enviar({ t: 'msg', ...o }), [enviar]);
  const ahora = useAhora(250);

  if (!S || S.tipo !== 'jugador') {
    return (
      <>
        {sesion.current?.token && !errorUnirse
          ? <div className="grid min-h-dvh place-items-center"><div className="muted flex items-center gap-2 font-semibold"><Ic n="bi-arrow-repeat" className="animate-spin" />Conectando…</div></div>
          : <Unirse error={errorUnirse} onEntrar={(code, alias, puesto) => { sesion.current = { code, token: null, alias }; setErrorUnirse(undefined); enviar({ t: 'unirse', code, alias, puesto }); }} />}
        <Avisos />
      </>
    );
  }

  const r = S.ronda;
  const activa = r?.estado === 'activa';
  const ms = activa ? r!.fin - (ahora + offset) : 0; const seg = Math.ceil(ms / 1000);
  const total = r ? Math.max(1, r.fin - r.inicio) : 1;
  const ctx: Ctx | null = rol ? { S, rol, roles, enviar, enviarMsg, elegirRol: setRolSel } : null;

  let pantalla;
  if (S.fase === 'lobby') pantalla = <Lobby S={S} />;
  else if (r && r.estado === 'preparando') pantalla = ctx && !S.yo.observador ? <Briefing c={ctx} /> : <Espera numero={r.numero} />;
  else if (r && r.estado === 'activa') pantalla = <Juego c={ctx ?? { S, rol: '', roles, enviar, enviarMsg, elegirRol: setRolSel }} offset={offset} borradores={borradores} />;
  else pantalla = <Resultado S={S} enviar={enviar} />;

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 text-white shadow-lg" style={{ paddingTop: 'env(safe-area-inset-top)', background: 'linear-gradient(180deg, var(--color-ink-700), var(--color-ink-900))' }}>
        <div className="mx-auto flex max-w-md items-center justify-between gap-2 px-4 py-2.5">
          <div id="tRol" className="flex min-w-0 items-center gap-2 truncate font-extrabold">
            {S.yo.observador ? <><Ic n="bi-eye" />Observador</> : rol ? <><span className="grid size-7 shrink-0 place-items-center rounded-lg text-sm" style={{ background: colorRol(rol) }}><IcRol rol={rol} /></span>{NOMBRE_ROL[rol]}</> : <><Ic n="bi-hourglass-split" />Sala</>}
          </div>
          <div id="tPed" className="shrink-0 text-xs font-semibold text-white/75">{activa ? `R${r!.numero} · Pedido ${r!.pedidoActual}/${r!.pedidosTotal}` : ''}</div>
          <div className="flex shrink-0 items-center gap-1">
            <div id="tTm" className={cx('tabular text-xl font-extrabold', activa && seg <= 60 && seg > 10 && 'urgente', activa && seg <= 10 && 'critico')}>{activa ? mmss(ms) : ''}</div>
            <button id="sonidoBtn" type="button" className="btn btn-sm btn-light !border-0 !bg-transparent" aria-pressed={sonido} aria-label={sonido ? 'Quitar sonido' : 'Poner sonido'} onClick={() => setSonido(fx.alternarSonido())}>
              <Ic n={sonido ? 'bi-volume-up-fill' : 'bi-volume-mute'} />
            </button>
          </div>
        </div>
        <div id="barraT" aria-hidden="true" className={cx('h-1 origin-left transition-[width] duration-300 ease-linear', activa && seg <= 60 ? 'bg-bad' : 'bg-[#f2b84b]')} style={{ width: activa ? `${Math.max(0, Math.min(100, (ms / total) * 100))}%` : 0 }} />
      </header>

      <TickSonoro activa={activa} seg={seg} />
      <AnimatePresence>
        {aviso && (
          <motion.button type="button" key={aviso.id} className={cx('aviso text-left', aviso.x.perfecto ? 'ok' : 'mal')} onClick={() => setAviso(null)} initial={false}>
            <span className="flex items-center gap-3">
              <span className="ic"><Ic n={aviso.x.perfecto ? 'bi-patch-check-fill' : 'bi-exclamation-diamond-fill'} /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-extrabold">Pedido {aviso.x.n}: {aviso.x.puntos}/{S.maxPorPedido}</span>
                {aviso.x.perfecto
                  ? <span className="block text-sm font-semibold">{aviso.racha > 1 ? <><Ic n="bi-fire" className="mr-1" />Racha de {aviso.racha}</> : 'Perfecto'}</span>
                  : <span className="mt-1 flex flex-wrap gap-1">{aviso.x.errores.map((c) => <span key={c} className="rounded-full bg-black/15 px-2 py-0.5 text-xs font-bold">{S.campos[c].label}</span>)}</span>}
              </span>
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      <main className="mx-auto max-w-md px-4 pb-12 pt-4" aria-live="polite">{pantalla}</main>
      <Avisos />
    </div>
  );
}

/** Tic de reloj en los últimos 10 segundos. */
function TickSonoro({ activa, seg }: { activa: boolean; seg: number }) {
  const ultimo = useRef(0);
  useEffect(() => {
    if (activa && seg <= 10 && seg > 0 && seg !== ultimo.current) { ultimo.current = seg; fx.sonar('reloj'); fx.vibrar(20); }
  }, [activa, seg]);
  return null;
}
