import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { CAMPOS_ORDEN, ICON_CAMPO, NOMBRE_ROL, ORDEN } from '../lib/constants';
import { fx } from '../lib/fx';
import { Dato, Ic, IcRol, IcTipo, Tarjeta, cx, toast, useAhora, colorRol } from '../lib/ui';
import { Cadena, DatosDe, FilaMensaje, RolBadge, msgsPedido, rachaAhora, volar, type Ctx } from './util';
import type { EstadoJugador } from '../lib/types';
import { useRuta } from '../lib/Camion';

/* ---------- Marcador: un círculo por pedido, racha y puntos ---------- */
function Marcador({ S }: { S: EstadoJugador }) {
  const r = S.ronda!; const h = S.hechos || [];
  const racha = rachaAhora(h); const pts = h.reduce((s, x) => s + x.puntos, 0);
  return (
    <div className="panel flex items-center gap-3 px-4 py-3" id="marcador">
      <div className="flex flex-1 flex-wrap gap-1.5">
        {Array.from({ length: r.pedidosTotal }, (_, i) => i + 1).map((n) => {
          const x = h.find((y) => y.n === n);
          const cls = x ? (x.perfecto ? 'ok' : 'regular') : n === r.pedidoActual ? 'act' : '';
          return <span key={n} className={cx('bola', cls)} title={`Pedido ${n}`}>{x ? <Ic n={x.perfecto ? 'bi-check-lg' : 'bi-exclamation-lg'} /> : n}</span>;
        })}
      </div>
      {racha > 1 && <span className="racha"><Ic n="bi-fire" />x{racha}</span>}
      <span className="tabular flex items-center gap-1.5 text-xl font-extrabold"><Ic n="bi-trophy-fill" className="text-brand-500" />{pts}</span>
    </div>
  );
}

/* ---------- Tus datos: en la ronda 1 se ven unos segundos y se ocultan ---------- */
function Memoriza({ S, mis, offset }: { S: EstadoJugador; mis: NonNullable<EstadoJugador['misCampos']>; offset: number }) {
  const r = S.ronda!; const total = (r.verSeg || 8) * 1000;
  const ahora = useAhora(250);
  const resta = r.pedidoDesde + total - (ahora + offset);
  const inicial = useRef(Math.max(0, r.pedidoDesde + total - (Date.now() + offset)));
  if (resta <= 0) {
    return <Tarjeta icono="bi-eye-slash" titulo="Datos ocultos"><p className="muted m-0">Escríbelos de memoria en tu nota.</p></Tarjeta>;
  }
  return (
    <Tarjeta icono="bi-eye" titulo="Memoriza tus datos">
      <div>{mis.map((c) => <Dato key={c.campo} campo={c.campo} valor={c.valor} grande />)}</div>
      <div className="ver-barra" aria-hidden="true">
        <div className="ver-barra-i" style={{ width: `${Math.min(100, (inicial.current / total) * 100)}%`, animationDuration: `${inicial.current}ms` }} />
      </div>
    </Tarjeta>
  );
}

function DatosTarjeta({ c, offset }: { c: Ctx; offset: number }) {
  const { S, rol } = c; const r = S.ronda!;
  const mis = (S.misCampos || []).filter((x) => x.rol === rol);
  if (!mis.length) return <Tarjeta icono="bi-card-checklist" titulo="Tus datos"><p className="muted m-0">No sabes ningún dato. Dependes del equipo.</p></Tarjeta>;
  return <Memoriza key={`${r.numero}:${r.pedidoActual}:${rol}`} S={S} mis={mis} offset={offset} />;
}

/* ---------- Selectores ---------- */
function Selector({ S, campo, valor, onCambio }: { S: EstadoJugador; campo: string; valor: string; onCambio: (v: string) => void }) {
  const def = S.campos[campo];
  return (
    <div className="mb-3">
      <label className="label" htmlFor={'sel_' + campo}><Ic n={ICON_CAMPO[campo]} className="mr-1" />{def.label}</label>
      <select id={'sel_' + campo} className="input" data-campo={campo} aria-label={def.label} value={valor} onChange={(e) => onCambio(e.target.value)}>
        <option value="">{def.label}…</option>
        {def.opciones.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

/* ---------- Ronda 1: nota escrita a mano, una sola vez ---------- */
function AccionNota({ c, borradores }: { c: Ctx; borradores: React.MutableRefObject<Record<string, string>> }) {
  const { S, rol } = c; const r = S.ronda!;
  const i = ORDEN.indexOf(rol as never); const sig = ORDEN[i + 1];
  const previa = msgsPedido(S, 'nota', (m) => m.a === rol).pop();
  const mia = msgsPedido(S, 'nota', (m) => m.de === rol).pop();
  const k = `n${r.numero}:${r.pedidoActual}:${rol}`;
  const [texto, setTexto] = useState(borradores.current[k] || '');
  const [bloq, setBloq] = useState(false);
  const recibido = previa ? (
    <div className="mb-4">
      <div className="muted mb-1 flex items-center gap-1.5 text-xs font-semibold">Te pasó <RolBadge rol={ORDEN[i - 1]} /></div>
      <div className="nota-papel">{previa.texto || <DatosDe datos={previa.datos} />}</div>
    </div>
  ) : i > 0 ? <p className="muted mb-3 flex items-center gap-1.5 text-sm"><Ic n="bi-hourglass-split" />Aún no llega nada.</p> : null;
  if (mia) {
    return (
      <Tarjeta icono="bi-envelope-check" titulo="Tu nota">
        {recibido}
        <div className="nota-papel enviada">{mia.texto}</div>
        <div className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-ok"><Ic n="bi-check-circle-fill" />Enviada a {NOMBRE_ROL[sig]}. Solo se envía una vez.</div>
      </Tarjeta>
    );
  }
  const enviar = () => {
    const t = texto.trim();
    if (!t) return toast('Escribe tu nota.');
    setBloq(true); setTimeout(() => setBloq(false), 1500);
    c.enviarMsg({ como: rol, texto: t }); volar(rol, sig, 'nota'); fx.sonar('envio'); fx.vibrar(30);
  };
  return (
    <Tarjeta icono="bi-pencil-square" titulo="Escribe tu nota">
      {recibido}
      <textarea id="notaTxt" className="input resize-none" rows={4} maxLength={140} placeholder="Escribe tus datos y lo que te llegó" aria-label="Tu nota" value={texto}
        onChange={(e) => { setTexto(e.target.value); borradores.current[k] = e.target.value; }} />
      <div className="muted mb-3 mt-1 text-right text-xs">{texto.length}/140</div>
      <button type="button" className="btn btn-primary btn-lg btn-block" disabled={bloq} onClick={enviar}><Ic n="bi-envelope-arrow-up" />Enviar a {NOMBRE_ROL[sig]}</button>
      <div className="muted mt-3 flex items-center gap-1.5 text-xs"><Ic n="bi-info-circle" />Solo se envía una vez.</div>
    </Tarjeta>
  );
}

/* ---------- Ronda 2: nota para todos, eco y corrección ---------- */
function AccionNotaChat({ c, borradores }: { c: Ctx; borradores: React.MutableRefObject<Record<string, string>> }) {
  const { S, rol } = c; const r = S.ronda!;
  const mis = (S.misCampos || []).filter((x) => x.rol === rol);
  const k = `c${r.numero}:${r.pedidoActual}:${rol}`;
  const [texto, setTexto] = useState(borradores.current[k] || '');
  const [bloq, setBloq] = useState(false);
  const ya = msgsPedido(S, null, (m) => m.de === rol && (m.tipo === 'tarjeta' || m.tipo === 'correccion')).length > 0;
  const eco = msgsPedido(S, 'eco').pop();
  const publicar = () => {
    const t = texto.trim();
    if (!t) return toast('Escribe tu nota.');
    setBloq(true); setTimeout(() => setBloq(false), 1200);
    const tipo = ya ? 'correccion' : 'tarjeta';
    c.enviarMsg({ como: rol, a: 'todos', tipo, texto: t }); volar(rol, 'operativo', tipo); fx.sonar('envio'); fx.vibrar(30);
  };
  return (
    <Tarjeta icono="bi-person-vcard" titulo="Tu nota para todos">
      <textarea id="notaTxt" className="input resize-none" rows={3} maxLength={200} placeholder="Escribe tus datos para que todos los vean" aria-label="Tu nota para todos" value={texto}
        onChange={(e) => { setTexto(e.target.value); borradores.current[k] = e.target.value; }} />
      <div className="muted mb-3 mt-1 text-right text-xs">{texto.length}/200</div>
      <button type="button" className="btn btn-primary btn-lg btn-block" disabled={bloq} onClick={publicar}><Ic n="bi-person-vcard" />{ya ? 'Actualizar mi nota' : 'Publicar mi nota'}</button>
      <div className="muted mt-3 flex items-center gap-1.5 text-xs"><Ic n="bi-info-circle" />Todos pueden ver tu nota. Puedes actualizarla cuando quieras.</div>
      {eco && mis.length > 0 && (
        <div className="mt-4 rounded-2xl border border-[color-mix(in_oklab,#7C4DBA_45%,var(--line))] bg-[color-mix(in_oklab,#7C4DBA_10%,var(--surface))] p-3">
          <div className="mb-1 flex items-center gap-1.5 font-extrabold" style={{ color: '#7C4DBA' }}><IcTipo tipo="eco" />Eco del Operativo</div>
          {mis.map((x) => {
            const visto = eco.datos ? eco.datos[x.campo] : undefined; const bien = visto === x.valor;
            return (
              <div key={x.campo} className="mt-2 flex flex-wrap items-center gap-2">
                <Dato campo={x.campo} valor={visto || 'sin dato'} estado={bien ? 'ok' : 'bad'} />
                {bien ? <Ic n="bi-check-lg" className="text-xl text-ok" /> : (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => { c.enviarMsg({ como: rol, a: 'todos', tipo: 'correccion', texto: `${x.label}: ${x.valor}`, datos: { [x.campo]: x.valor } }); volar(rol, 'operativo', 'correccion'); fx.sonar('envio'); fx.vibrar(30); }}><Ic n="bi-pencil" />Corregir {x.label.split(' (')[0].toLowerCase()}</button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Tarjeta>
  );
}

/* ---------- Ronda 2: las notas de todos, a la mano ---------- */
function NotasDeTodos({ S, rol }: { S: EstadoJugador; rol: string }) {
  const ultima = (r: string) => msgsPedido(S, null, (m) => m.de === r && (m.tipo === 'tarjeta' || m.tipo === 'correccion')).pop();
  return (
    <Tarjeta id="notasTodos" icono="bi-journal-text" titulo="Notas de todos">
      <div className="space-y-2">
        {ORDEN.filter((x) => x !== 'operativo').map((x) => {
          const m = ultima(x);
          return (
            <motion.div key={x + (m ? m.id : '')} initial={{ opacity: 0.4, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className={cx('flex items-start gap-3 rounded-2xl border p-2.5', x === rol ? 'border-brand-400 bg-[color-mix(in_oklab,var(--color-brand-500)_6%,var(--surface))]' : 'border-[var(--line)] bg-[var(--surface-2)]')}>
              <span className="grid size-9 shrink-0 place-items-center rounded-xl text-white" style={{ background: colorRol(x) }}><IcRol rol={x} /></span>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-extrabold">{NOMBRE_ROL[x]}{x === rol && <span className="pill pill-brand ml-1.5">tú</span>}{m && m.tipo === 'correccion' && <span className="pill ml-1.5"><Ic n="bi-pencil" />actualizada</span>}</div>
                {m ? <div className="mt-0.5 break-words text-sm">{m.texto || <DatosDe datos={m.datos} />}</div> : <div className="muted mt-0.5 text-sm">Aún sin nota</div>}
              </div>
            </motion.div>
          );
        })}
      </div>
    </Tarjeta>
  );
}

/* ---------- Ronda 2: hablar directo con alguien o con todos ---------- */
function Conversacion({ c }: { c: Ctx }) {
  const { S, rol, roles } = c;
  const [para, setPara] = useState('todos');
  const [texto, setTexto] = useState('');
  const fin = useRef<HTMLDivElement>(null);
  const charla = msgsPedido(S, 'msg');
  useEffect(() => { fin.current?.scrollIntoView({ block: 'nearest' }); }, [charla.length]);
  const enviar = () => {
    const t = texto.trim(); if (!t) return;
    c.enviarMsg({ como: rol, a: para, tipo: 'msg', texto: t });
    if (para !== 'todos') volar(rol, para, 'msg'); fx.sonar('envio'); fx.vibrar(20); setTexto('');
  };
  const otros = ORDEN.filter((x) => !roles.includes(x));
  return (
    <Tarjeta id="conversacion" icono="bi-chat-dots" titulo="Hablar con el equipo">
      <p className="muted m-0 mb-2 text-sm">Aquí sí puedes preguntar, confirmar y corregir. Elige si le escribes a todos o solo a una persona.</p>
      <div className="max-h-64 min-h-16 space-y-2 overflow-y-auto rounded-2xl bg-[var(--surface-2)] p-2.5" aria-live="polite">
        {charla.length ? charla.map((m) => {
          const mio = roles.includes(m.de);
          return (
            <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={cx('flex flex-col', mio ? 'items-end' : 'items-start')}>
              <div className="muted mb-0.5 flex items-center gap-1 text-[11px] font-bold"><IcRol rol={m.de} />{mio ? 'Tú' : NOMBRE_ROL[m.de]}<Ic n="bi-arrow-right" />{m.a === 'todos' ? 'todos' : <><Ic n="bi-lock-fill" />{roles.includes(m.a) ? 'tú' : NOMBRE_ROL[m.a]}</>}</div>
              <div className={cx('max-w-[88%] break-words rounded-2xl px-3 py-2 text-sm', mio ? 'rounded-br-md bg-brand-500 text-white' : 'rounded-bl-md border border-[var(--line)] bg-[var(--surface)]')}>{m.texto}</div>
            </motion.div>
          );
        }) : <p className="muted m-0 text-sm">Nadie ha escrito todavía. Pregunta lo que necesites.</p>}
        <div ref={fin} />
      </div>
      <form className="mt-3 flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); enviar(); }}>
        <select id="chatPara" className="input" aria-label="Para quién" value={para} onChange={(e) => setPara(e.target.value)}>
          <option value="todos">Para todos</option>
          {otros.map((x) => <option key={x} value={x}>Solo para {NOMBRE_ROL[x]}</option>)}
        </select>
        <div className="flex gap-2">
          <input id="chatTxt" className="input min-w-0 flex-1" maxLength={200} autoComplete="off" placeholder="Escribe un mensaje" aria-label="Mensaje" value={texto} onChange={(e) => setTexto(e.target.value)} />
          <button id="chatEnviar" type="submit" className="btn btn-primary" aria-label="Enviar mensaje"><Ic n="bi-send-fill" /></button>
        </div>
      </form>
    </Tarjeta>
  );
}

/* ---------- Operativo: arma y envía el despacho ---------- */
function AccionOperativo({ c, esNotas }: { c: Ctx; esNotas: boolean }) {
  const { S, rol } = c; const r = S.ronda!;
  const i = ORDEN.indexOf(rol as never);
  const [dirty, setDirty] = useState<Record<string, string>>({});
  const base: Record<string, string> = {};
  if (!esNotas) for (const m of S.mensajes || []) { if (m.pedidoN === r.pedidoActual && m.datos && m.tipo !== 'eco') Object.assign(base, m.datos); }
  const valor = (k: string) => dirty[k] ?? base[k] ?? '';
  const datos = () => { const o: Record<string, string> = {}; CAMPOS_ORDEN.forEach((k) => { if (valor(k)) o[k] = valor(k); }); return o; };
  const notaIn = esNotas ? msgsPedido(S, 'nota', (m) => m.a === rol).pop() : null;
  const leerEco = () => {
    const d = datos(); if (!Object.keys(d).length) return toast('Completa algún dato para leer el eco.');
    c.enviarMsg({ como: rol, tipo: 'eco', datos: d });
    ORDEN.filter((x) => x !== rol).forEach((x, k) => volar(rol, x, 'eco', k * 110)); fx.sonar('envio'); fx.vibrar(30);
  };
  const despachar = () => {
    const d = datos();
    if (Object.keys(d).length < CAMPOS_ORDEN.length) return toast('Completa los 7 datos antes de enviar.');
    c.enviar({ t: 'pedido', valores: d }); fx.sonar('envio'); fx.vibrar(40);
  };
  return (
    <Tarjeta icono="bi-send-check" titulo="Arma el despacho">
      {esNotas ? (notaIn ? (
        <div className="mb-4"><div className="muted mb-1 flex items-center gap-1.5 text-xs font-semibold">Te pasó <RolBadge rol={ORDEN[i - 1]} /></div>
          <div className="nota-papel">{notaIn.texto || <DatosDe datos={notaIn.datos} />}</div></div>
      ) : <p className="muted mb-3 flex items-center gap-1.5 text-sm"><Ic n="bi-hourglass-split" />Aún no llega nada.</p>)
        : <p className="muted mb-3 text-sm">Se rellena con las tarjetas del equipo.</p>}
      {CAMPOS_ORDEN.map((k) => <Selector key={k} S={S} campo={k} valor={valor(k)} onCambio={(v) => setDirty((o) => ({ ...o, [k]: v }))} />)}
      {!esNotas && <button type="button" className="btn btn-ghost btn-lg btn-block mb-2" onClick={leerEco}><IcTipo tipo="eco" />Leer el eco en voz alta</button>}
      <button type="button" className="btn btn-primary btn-lg btn-block" onClick={despachar}><Ic n="bi-send" />Enviar despacho</button>
    </Tarjeta>
  );
}

/* ---------- Pantalla de juego ---------- */
export function Juego({ c, offset, borradores }: { c: Ctx; offset: number; borradores: React.MutableRefObject<Record<string, string>> }) {
  const { S, rol, roles } = c; const r = S.ronda!;
  const ruta = useRuta(r.numero, (S.hechos || []).length, r.progreso);
  const [avisoCharla, setAvisoCharla] = useState(true);
  const alertas = (S.alertas || []).filter((a) => a.pedidoN === r.pedidoActual);
  const tablero = alertas.map((a) => (
    <div key={a.id} data-alerta className="rounded-2xl border-2 border-warn bg-[color-mix(in_oklab,#f5a524_16%,var(--surface))] p-4 shadow-lg">
      <div className="flex items-center gap-2 font-extrabold"><Ic n="bi-lightning-charge-fill" className="text-warn" />Cambio de último momento</div>
      <div className="my-1 text-sm">{a.texto}</div><Dato campo={a.campo} valor={a.nuevo} estado="nuevo" />
    </div>
  ));
  if (S.yo.observador || !rol) {
    return (
      <div className="space-y-3">{tablero}
        <Tarjeta icono="bi-activity" titulo="Lo que pasa">{(S.mensajes || []).slice(-14).reverse().map((m) => <FilaMensaje key={m.id} m={m} />)}</Tarjeta>
      </div>
    );
  }
  const notas = r.modo === 'notas';
  const accion = notas ? (rol === 'operativo' ? <AccionOperativo key={`${r.numero}:${r.pedidoActual}`} c={c} esNotas /> : <AccionNota key={`${r.numero}:${r.pedidoActual}:${rol}`} c={c} borradores={borradores} />)
    : (rol === 'operativo' ? <AccionOperativo key={`${r.numero}:${r.pedidoActual}`} c={c} esNotas={false} />
      : <AccionNotaChat key={`${r.numero}:${r.pedidoActual}:${rol}`} c={c} borradores={borradores} />);
  const mesa = (S.mensajes || []).filter((m) => m.pedidoN === r.pedidoActual).slice(-10).reverse();
  const Mesa = (
      <Tarjeta icono="bi-envelope-paper" titulo="Notas">
        {mesa.length ? mesa.map((m) => <motion.div key={m.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}><FilaMensaje m={m} /></motion.div>) : <p className="muted m-0 text-sm">Sin mensajes todavía.</p>}
      </Tarjeta>
  );
  return (
    <div className="space-y-3">
      {tablero}
      {!notas && avisoCharla && (
        <motion.section initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex items-center gap-3 rounded-2xl border-2 border-brand-400 bg-[color-mix(in_oklab,var(--color-brand-500)_9%,var(--surface))] p-3" id="avisoHablar">
          <Ic n="bi-chat-dots-fill" className="text-2xl text-brand-500" />
          <div className="min-w-0 flex-1 text-sm"><b>Ahora sí pueden hablar.</b> Pregunten y confirmen entre ustedes, con todos o con una sola persona.</div>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => document.getElementById('conversacion')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>Ir al chat</button>
          <button type="button" className="btn btn-ghost btn-sm" aria-label="Cerrar aviso" onClick={() => setAvisoCharla(false)}><Ic n="bi-x-lg" /></button>
        </motion.section>
      )}
      {roles.length > 1 && (
        <div className="panel flex gap-1 p-1.5" role="group" aria-label="Tus roles">
          {roles.map((x) => (
            <button key={x} type="button" onClick={() => c.elegirRol(x)} className={cx('btn btn-sm flex-1', x === rol ? 'btn-navy' : 'btn-ghost border-transparent')} style={x === rol ? { background: colorRol(x) } : undefined}><IcRol rol={x} />{NOMBRE_ROL[x].split(' ')[0]}</button>
          ))}
        </div>
      )}
      <Marcador S={S} />
      <section className="panel px-3 pb-2 pt-3"><Cadena S={S} rol={rol} ruta={{ ...ruta, etiqueta: `Pedido ${(S.hechos || []).length} entregado` }} /></section>
      <DatosTarjeta c={c} offset={offset} />
      {notas ? <>{accion}{Mesa}</> : <>
        <NotasDeTodos S={S} rol={rol} />
        {accion}
        <Conversacion c={c} />
      </>}
    </div>
  );
}
