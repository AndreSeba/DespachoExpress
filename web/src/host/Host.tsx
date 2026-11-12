import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { CAMPOS_DE, CORTO_ROL, NOMBRE_ROL, ORDEN } from '../lib/constants';
import { guardado, guardar, useSocket } from '../lib/net';
import { Avisos, Dato, Ic, IcRol, IcTipo, Lateral, Modal, colorRol, cx, toast } from '../lib/ui';
import type { EstadoHost } from '../lib/types';
import { detalleRonda, rolDe } from './calc';
import { Comparar } from './Comparar';
import { Cadena, Franja, Heat, Ticker } from './Vivo';

const KEY = 'dx_host';
interface Sala { code: string; token: string }

function Boton({ icono, children, clase, onClick, accion, deshabilitado }: { icono: string; children: React.ReactNode; clase: string; onClick: () => void; accion?: string; deshabilitado?: boolean }) {
  return <button type="button" className={cx('btn', clase, deshabilitado && 'disabled')} onClick={onClick} data-accion={accion}><Ic n={icono} />{children}</button>;
}

export default function Host() {
  const [S, setS] = useState<EstadoHost | null>(null);
  const [offset, setOffset] = useState(0);
  const [vista, setVista] = useState<'vivo' | 'cmp'>('vivo');
  const [selPedido, setSelPedido] = useState<number | null>(null);
  const [selCelda, setSelCelda] = useState<string | null>(null);
  const [auto, setAuto] = useState(false);
  const [drawerRol, setDrawerRol] = useState<string | null>(null);
  const [modalNueva, setModalNueva] = useState(false);
  const sala = useRef<Sala | null>(guardado<Sala>(KEY));
  const yaMostroCmp = useRef(false);

  const { enviar: enviarRaw, conectado } = useSocket(
    (send) => { if (sala.current) send({ t: 'host:entrar', code: sala.current.code, token: sala.current.token }); else send({ t: 'host:crear' }); },
    (m) => {
      if (m.t === 'creada') { sala.current = { code: m.code, token: m.token }; guardar(KEY, sala.current); }
      else if (m.t === 'error') {
        if (m.codigo === 'sala') { sala.current = null; guardar(KEY, null); enviarRef.current({ t: 'host:crear' }); } else toast(m.msg);
      } else if (m.t === 'estado') { setS(m as EstadoHost); setOffset(m.ahora - Date.now()); }
    },
  );
  const enviarRef = useRef(enviarRaw); enviarRef.current = enviarRaw;
  const enviar = (t: string, extra?: object) => enviarRaw({ t, ...(extra || {}) });

  const rondaN = S?.ronda ? S.ronda.numero : null;
  useEffect(() => { setSelPedido(null); setSelCelda(null); }, [rondaN]);
  useEffect(() => {
    if (!S) return;
    if (S.fase === 'final' && !yaMostroCmp.current) { setVista('cmp'); yaMostroCmp.current = true; }
    if (S.fase === 'lobby') yaMostroCmp.current = false;
  }, [S?.fase]);
  const faseRonda = S?.fase;
  useEffect(() => {
    if (!auto || faseRonda !== 'ronda') return;
    const i = setInterval(() => enviarRef.current({ t: 'incidente' }), 40000);
    return () => clearInterval(i);
  }, [auto, faseRonda]);

  if (!S || S.tipo !== 'host') {
    return <div className="grid min-h-dvh place-items-center"><div className="muted flex items-center gap-2 font-semibold"><Ic n="bi-arrow-repeat" className="animate-spin" />Conectando…</div><Avisos /></div>;
  }

  const url = `${location.origin}/?c=${S.code}`;
  const copiar = async () => { try { await navigator.clipboard.writeText(url); toast('Enlace copiado', 'ok'); } catch { toast(url, 'info'); } };
  const nJug = S.jugadores.filter((j) => !j.observador).length;
  const sinRol = S.jugadores.filter((j) => !j.roles.length);
  const cfg = S.config;
  const cambiarCfg = (rondaSeg: number, pedidos: number) => enviar('config', { rondaSeg, pedidos });
  const mins = Math.round(cfg.rondaSeg / 60);

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 text-white shadow-lg" style={{ background: 'linear-gradient(180deg, var(--color-ink-700), var(--color-ink-900))' }}>
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-4 px-5 py-3">
          <div className="flex items-center gap-2.5 text-lg font-extrabold"><span className="grid size-9 place-items-center rounded-xl bg-brand-500"><Ic n="bi-truck" /></span>Despacho Express</div>
          <button id="codigo" type="button" onClick={copiar} title="Copiar el enlace para los jugadores" aria-label="Código de sala" className="rounded-xl bg-white px-4 py-1.5 font-extrabold text-ink-900 shadow-lg" style={{ letterSpacing: '.5rem', fontSize: '1.4rem' }}>{S.code}</button>
          <span className="hidden text-sm text-white/65 md:inline" id="link">{location.host + '/?c=' + S.code}</span>
          <span className="flex-1" />
          <span id="conn" className="flex items-center gap-1.5 text-sm font-semibold"><Ic n="bi-circle-fill" className={cx('text-[10px]', conectado ? 'text-emerald-400' : 'text-red-400')} />{conectado ? 'Conectado' : 'Reconectando'}</span>
          <button id="nueva" type="button" className="btn btn-light btn-sm" onClick={() => setModalNueva(true)}><Ic n="bi-plus-lg" />Sala nueva</button>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1500px] gap-4 p-4 lg:grid-cols-[20rem_minmax(0,1fr)] lg:p-5">
        <aside className="space-y-4">
          <section className="panel p-4">
            <h2 className="titulo-sec"><Ic n="bi-people" />Equipo</h2>
            <div id="seats" className="grid grid-cols-2 gap-2">
              {S.fase === 'lobby' ? (
                sinRol.length ? sinRol.map((j) => (
                  <div key={j.id} className="seat panel-soft relative p-2.5">
                    <Ic n="bi-circle-fill" className={cx('absolute right-2 top-2 text-[8px]', j.bot || j.conectado ? 'text-ok' : 'text-bad')} />
                    <Ic n={j.bot ? 'bi-robot' : 'bi-person-fill'} className="text-2xl text-brand-500" />
                    <div className="truncate text-sm font-bold">{j.alias}</div>
                    {j.puesto && <div className="muted truncate text-xs">trabajo: {CORTO_ROL(j.puesto)}</div>}
                  </div>
                )) : <div className="muted col-span-2 flex items-center gap-1.5 text-sm"><Ic n="bi-hourglass-split" />Esperando jugadores. Comparte el código o completa con bots.</div>
              ) : ORDEN.map((rol) => {
                const j = rolDe(S.jugadores, rol);
                return (
                  <button key={rol} id={'seat_' + rol} type="button" data-rol={rol} onClick={() => setDrawerRol(rol)} className={cx('seat panel-soft relative p-2.5 text-left transition hover:-translate-y-0.5', !j && 'opacity-45')} style={{ ['--c' as string]: colorRol(rol) }}>
                    {j && <Ic n="bi-circle-fill" className={cx('absolute right-2 top-2 text-[8px]', j.bot || j.conectado ? 'text-ok' : 'text-bad')} />}
                    <span className="mb-1 grid size-9 place-items-center rounded-xl text-lg text-white" style={{ background: colorRol(rol) }}><IcRol rol={rol} /></span>
                    <div className="text-sm font-extrabold">{CORTO_ROL(rol)}</div>
                    <div className="muted flex items-center gap-1 truncate text-xs">{j?.bot && <Ic n="bi-robot" />}{j ? j.alias : 'vacío'}</div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="panel space-y-2 p-4">
            {S.fase === 'lobby' && <>
              <Boton icono="bi-play-fill" clase={cx('btn-primary btn-lg btn-block', nJug < 2 && 'disabled')} accion="iniciar" onClick={() => enviar('iniciar')}>Iniciar ronda 1</Boton>
              <Boton icono="bi-robot" clase="btn-ghost btn-block" accion="bots" onClick={() => enviar('bots')}>Completar con bots</Boton>
              <Boton icono="bi-trash3" clase="btn-ghost btn-block" onClick={() => enviar('quitarbots')}>Quitar bots</Boton>
              {S.restriccionRelajada && <div className="rounded-xl bg-warn/20 p-2.5 text-xs font-semibold">Los puestos declarados no permitieron evitar todos los cruces.</div>}
            </>}
            {S.fase === 'ronda' && S.ronda?.estado === 'preparando' && <>
              <Boton icono="bi-skip-forward-fill" clase="btn-primary btn-lg btn-block" accion="empezar" onClick={() => enviar('empezar')}>Empezar ya</Boton>
              <Boton icono="bi-stop-fill" clase="btn-ghost btn-block" onClick={() => enviar('reiniciar')}>Cancelar</Boton>
            </>}
            {S.fase === 'ronda' && S.ronda?.estado !== 'preparando' && <>
              <Boton icono="bi-lightning-charge-fill" clase="btn-primary btn-lg btn-block" accion="incidente" onClick={() => enviar('incidente')}>Incidente</Boton>
              <Boton icono="bi-stop-fill" clase="btn-danger btn-block" accion="cerrar" onClick={() => enviar('cerrar')}>Cerrar ronda</Boton>
              <Boton icono={auto ? 'bi-toggle-on' : 'bi-toggle-off'} clase="btn-ghost btn-block" onClick={() => setAuto(!auto)}>{auto ? 'Incidentes automáticos: sí' : 'Incidentes automáticos: no'}</Boton>
            </>}
            {S.fase === 'entre' && <Boton icono="bi-play-fill" clase="btn-primary btn-lg btn-block" accion="iniciar" onClick={() => enviar('iniciar')}>Iniciar ronda {S.resumenes.length + 1}</Boton>}
            {S.fase === 'final' && <>
              <Boton icono="bi-arrow-repeat" clase="btn-primary btn-lg btn-block" accion="reiniciar" onClick={() => enviar('reiniciar')}>Nueva partida</Boton>
              {S.encuesta && <div className="muted flex items-center justify-center gap-1.5 text-center text-sm"><Ic n="bi-clipboard-check" />Formulario: {S.encuesta.respondieron} de {S.encuesta.total}</div>}
            </>}
            {S.resumenes.length > 0 && <a className="btn btn-ghost btn-block" href={`/api/export?code=${S.code}&token=${sala.current ? sala.current.token : ''}`} download><Ic n="bi-download" />Descargar CSV</a>}
            {(S.fase === 'lobby' || S.fase === 'entre') && (
              <div className="space-y-2 border-t border-[var(--line)] pt-3">
                {([['bi-stopwatch', 'Ronda', `${mins} min`, () => cambiarCfg(Math.max(60, cfg.rondaSeg - 60), cfg.pedidos), () => cambiarCfg(Math.min(1200, cfg.rondaSeg + 60), cfg.pedidos), 'Menos tiempo', 'Más tiempo'],
                  ['bi-card-checklist', 'Pedidos', String(cfg.pedidos), () => cambiarCfg(cfg.rondaSeg, Math.max(1, cfg.pedidos - 1)), () => cambiarCfg(cfg.rondaSeg, Math.min(8, cfg.pedidos + 1)), 'Menos pedidos', 'Más pedidos']] as const).map(([ic, et, val, menos, mas, am, ap]) => (
                  <div key={et} className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-sm font-bold"><Ic n={ic} />{et}</span>
                    <div className="flex items-center gap-1">
                      <button type="button" className="btn btn-ghost btn-sm" aria-label={am} onClick={menos}><Ic n="bi-dash-lg" /></button>
                      <span className="tabular w-16 text-center font-extrabold">{val}</span>
                      <button type="button" className="btn btn-ghost btn-sm" aria-label={ap} onClick={mas}><Ic n="bi-plus-lg" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </aside>

        <section className="min-w-0 space-y-4">
          <div className="panel inline-flex gap-1 p-1.5" role="tablist">
            <button id="tabVivo" role="tab" type="button" aria-selected={vista === 'vivo'} onClick={() => setVista('vivo')} className={cx('btn btn-sm', vista === 'vivo' ? 'btn-navy' : 'btn-ghost !border-transparent !bg-transparent')}><Ic n="bi-broadcast" />En vivo</button>
            <button id="tabCmp" role="tab" type="button" aria-selected={vista === 'cmp'} disabled={S.resumenes.length === 0} onClick={() => setVista('cmp')} className={cx('btn btn-sm', vista === 'cmp' ? 'btn-navy' : 'btn-ghost !border-transparent !bg-transparent')}><Ic n="bi-bar-chart-line" />Comparar</button>
          </div>
          {vista === 'vivo' ? (
            <motion.div key="vivo" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              {(() => { const p = { S, offset, selPedido, setSelPedido, selCelda, setSelCelda, abrirDrawer: setDrawerRol }; return <>
                <Franja {...p} /><Cadena {...p} /><Heat {...p} /><Ticker S={S} /></>; })()}
            </motion.div>
          ) : <motion.div key="cmp" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><Comparar S={S} /></motion.div>}
        </section>
      </div>

      <Lateral abierto={!!drawerRol} onCerrar={() => setDrawerRol(null)} titulo={drawerRol ? <span className="flex items-center gap-2"><IcRol rol={drawerRol} />{NOMBRE_ROL[drawerRol]}</span> : ''}>
        {drawerRol && <DetalleRol S={S} rol={drawerRol} selPedido={selPedido} />}
      </Lateral>

      <Modal abierto={modalNueva} titulo="Sala nueva" onCerrar={() => setModalNueva(false)}>
        <p className="muted mt-0">La sala actual y su partida se perderán. Descarga el CSV antes si lo necesitas.</p>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={() => setModalNueva(false)}>Cancelar</button>
          <button id="confirmaNueva" type="button" className="btn btn-primary" onClick={() => { setModalNueva(false); sala.current = null; guardar(KEY, null); yaMostroCmp.current = false; enviar('host:crear'); }}>Crear sala nueva</button>
        </div>
      </Modal>
      <Avisos />
    </div>
  );
}

function DetalleRol({ S, rol, selPedido }: { S: EstadoHost; rol: string; selPedido: number | null }) {
  const j = rolDe(S.jugadores, rol); const r = S.ronda;
  const det = r ? detalleRonda(S, r.numero) : null; const ped = det ? det.pedidos.find((p) => p.n === (selPedido || r!.pedidoActual)) : null;
  const lista = S.mensajes.filter((m) => m.de === rol || m.a === rol || m.a === 'todos').slice(-30).reverse();
  return (
    <div>
      <div className="mb-3 flex items-center gap-2"><span className="dato"><Ic n={j ? (j.bot ? 'bi-robot' : 'bi-person-fill') : 'bi-slash-circle'} />{j ? j.alias : 'vacío'}</span>{j && <Ic n="bi-circle-fill" className={cx('text-[9px]', j.bot || j.conectado ? 'text-ok' : 'text-bad')} />}</div>
      {j?.puesto && <div className="muted mb-3 text-sm">Su trabajo real se parece a: <span className="dato"><IcRol rol={j.puesto} />{NOMBRE_ROL[j.puesto]}</span></div>}
      {CAMPOS_DE[rol].length > 0 && <div className="mb-4">{CAMPOS_DE[rol].map((c) => <Dato key={c} campo={c} valor={ped && ped.real ? ped.real[c] : '·'} grande />)}</div>}
      <h3 className="titulo-sec"><Ic n="bi-clock-history" />Mensajes</h3>
      {lista.length ? lista.map((m) => (
        <div key={m.id} className="flex flex-wrap items-center gap-1.5 border-b border-[var(--line)] py-2 last:border-0">
          <IcTipo tipo={m.tipo} /><IcRol rol={m.de} /><Ic n="bi-arrow-right" className="muted" />{m.a === 'todos' ? <Ic n="bi-people" /> : <IcRol rol={m.a} />}
          {Object.entries(m.datos || {}).map(([c, v]) => <Dato key={c} campo={c} valor={v} estado={'t-' + m.tipo} />)}{m.texto && <span className="text-sm">{m.texto}</span>}
        </div>
      )) : <div className="muted text-sm">Sin mensajes todavía.</div>}
    </div>
  );
}
