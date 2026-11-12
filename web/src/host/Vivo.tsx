import { useEffect, useRef } from 'react';
import { CAMPOS_DE, CAMPOS_ORDEN, COLOR_TIPO, CORTO_ROL, ICON_CAMPO, ICON_TIPO, NOMBRE_ROL, ORDEN, mmss } from '../lib/constants';
import { Aro, Dato, Ic, IcRol, IcTipo, Tarjeta, colorRol, cx, useAhora } from '../lib/ui';
import type { EstadoHost, Mensaje } from '../lib/types';
import { Camion, CargaCamion, useRuta } from '../lib/Camion';
import { ICONO_ESTADO, detalleRonda, estadoValor, msgsDe, rolDe, salidas } from './calc';

interface Props {
  S: EstadoHost; offset: number; selPedido: number | null; setSelPedido: (n: number | null) => void;
  selCelda: string | null; setSelCelda: (k: string | null) => void; abrirDrawer: (rol: string) => void;
}

/* ---------- Franja: reloj, ronda, pedidos y puntaje ---------- */
export function Franja({ S, offset, selPedido, setSelPedido, setSelCelda }: Props) {
  const r = S.ronda; const ahora = useAhora(250);
  if (!r) {
    return (
      <Tarjeta><div className="flex flex-wrap items-center gap-3">
        <h2 className="m-0 flex items-center gap-2 text-xl font-extrabold"><Ic n="bi-hourglass-split" />Esperando jugadores</h2>
        <span className="pill"><Ic n="bi-people" />{S.jugadores.length}</span><span className="muted text-sm">Comparte el código con el equipo</span>
        <div className="w-full"><CargaCamion fraccion={S.jugadores.length / 6} titulo="Cargando el equipo" detalle={`${S.jugadores.length} de 6 en la sala`} /></div>
      </div></Tarjeta>
    );
  }
  if (r.estado === 'preparando') {
    const pr = r.preparacion || { listos: [], requeridos: [] };
    return (
      <Tarjeta><div id="preparando" className="flex flex-wrap items-center gap-3">
        <h2 className="m-0 flex items-center gap-2 text-xl font-extrabold"><Ic n="bi-hourglass-split" />Ronda {r.numero}: esperando &quot;Listo&quot;</h2>
        <span id="listosConteo" className="pill pill-brand text-sm">{pr.listos.filter((id) => pr.requeridos.includes(id)).length} de {pr.requeridos.length}</span>
        <div>{S.jugadores.filter((j) => pr.requeridos.includes(j.id)).map((j) => <span key={j.id} className={cx('dato', pr.listos.includes(j.id) && 'ok')}><Ic n={pr.listos.includes(j.id) ? 'bi-check-circle-fill' : 'bi-hourglass'} />{j.alias}</span>)}</div>
        <div className="w-full"><CargaCamion fraccion={pr.requeridos.length ? pr.listos.filter((id) => pr.requeridos.includes(id)).length / pr.requeridos.length : 0} titulo="Cargando el camión" detalle="Cada persona lista avanza el camión" /></div>
      </div></Tarjeta>
    );
  }
  const det = detalleRonda(S, r.numero); const peds = det ? det.pedidos : [];
  const rest = r.fin - (ahora + offset); const total = r.fin - r.inicio;
  const enviados = peds.filter((p) => p.enviado);
  const puntos = enviados.reduce((s, p) => s + p.puntos, 0);
  let racha = 0; for (let i = enviados.length - 1; i >= 0 && enviados[i].puntos === S.maxPorPedido; i--) racha++;
  return (
    <Tarjeta>
      <div className="flex flex-wrap items-center gap-4">
        {r.estado === 'activa'
          ? <Aro fraccion={rest / total} texto={mmss(rest)} rojo={rest < total * 0.2} />
          : <span className="pill"><Ic n={r.motivo === 'completa' ? 'bi-flag' : 'bi-stop-fill'} />{r.motivo === 'completa' ? 'Completa' : 'Cerrada'}</span>}
        <span className="pill pill-brand text-sm">Ronda {r.numero}<Ic n={r.modo === 'notas' ? 'bi-arrow-right' : 'bi-chat-dots'} /></span>
        {r.modo === 'chat' && <span className="pill pill-ok"><Ic n="bi-chat-dots-fill" />Pueden hablar</span>}
        <div className="flex flex-wrap gap-2" role="group" aria-label="Pedidos">
          {peds.map((p) => {
            const perfecto = p.enviado && p.puntos === S.maxPorPedido;
            const act = r.estado === 'activa' && p.n === r.pedidoActual && !p.enviado;
            const sel = (selPedido || r.pedidoActual) === p.n;
            return (
              <button key={p.n} type="button" aria-label={`Pedido ${p.n}`} onClick={() => { setSelPedido(p.n); setSelCelda(null); }}
                className={cx('bola cursor-pointer', perfecto ? 'ok' : p.enviado ? 'regular' : act ? 'act' : '', sel && 'outline outline-2 outline-offset-2 outline-ink-700')}>
                {perfecto ? <Ic n="bi-check-lg" /> : p.n}
              </button>
            );
          })}
        </div>
        <div className="flex-1" />
        {racha > 1 && <span className="racha"><Ic n="bi-fire" />x{racha}</span>}
        <div className="text-right"><div className="score tabular">{puntos}</div><div className="muted text-xs font-semibold">de {peds.length * S.maxPorPedido}</div></div>
      </div>
    </Tarjeta>
  );
}

/* ---------- Recorrido en vivo: la cadena con paquetes que viajan ---------- */
export function Cadena({ S, selPedido, abrirDrawer }: Props) {
  const cont = useRef<HTMLDivElement>(null);
  const vistos = useRef(new Set<string>()); const primera = useRef(true); const codigo = useRef('');
  const r = S.ronda; const pN = selPedido || (r ? r.pedidoActual : 1);
  const det = r ? detalleRonda(S, r.numero) : null; const ped = det ? det.pedidos.find((p) => p.n === pN) : null;
  const sal = salidas(r ? msgsDe(S, r.numero, pN) : []);
  const enviadosN = det ? det.pedidos.filter((p) => p.enviado).length : 0;
  const ruta = useRuta(r ? r.numero : undefined, enviadosN, r ? r.progreso : []);

  useEffect(() => {
    const c = cont.current; if (!c) return;
    if (codigo.current !== S.code) { codigo.current = S.code; vistos.current = new Set(); primera.current = true; }
    if (!S.ronda) return;
    const centro = (rol: string): [number, number] => {
      const a = c.getBoundingClientRect(); const b = c.querySelector(`[data-nodo-ic="${rol}"]`)!.getBoundingClientRect();
      return [b.left - a.left + b.width / 2, b.top - a.top + b.height / 2];
    };
    const activar = (rol: string) => {
      const g = c.querySelector(`[data-nodo="${rol}"]`); const s = document.getElementById('seat_' + rol);
      g?.classList.add('act'); s?.classList.add('act');
      setTimeout(() => { g?.classList.remove('act'); s?.classList.remove('act'); }, 1400);
    };
    const animar = (m: Mensaje) => {
      const color = COLOR_TIPO[m.tipo] || '#666'; const [x1, y1] = centro(m.de); activar(m.de);
      if (m.a === 'todos') {
        const onda = document.createElement('div'); onda.className = 'onda'; onda.style.cssText = `left:${x1}px;top:${y1}px;border-color:${color}`; c.append(onda); setTimeout(() => onda.remove(), 1100);
        ORDEN.filter((x) => x !== m.de).forEach(activar); return;
      }
      const [x2, y2] = centro(m.a);
      const p = document.createElement('div'); p.className = 'paquete'; p.style.cssText = `left:0;top:0;background:${color}`; p.innerHTML = `<i class="bi ${ICON_TIPO[m.tipo] || 'bi-chat-dots'}"></i>`; c.append(p);
      const an = p.animate([{ transform: `translate(${x1}px,${y1}px)` }, { transform: `translate(${x2}px,${y2}px)` }], { duration: 900, easing: 'ease-in-out', fill: 'forwards' });
      an.onfinish = () => { activar(m.a); p.remove(); };
    };
    const destello = (rol: string, icono: string) => {
      const [x, y] = centro(rol); const t = document.createElement('div'); t.className = 'rayo'; t.style.cssText = `left:${x}px;top:${y}px`; t.innerHTML = `<i class="bi ${icono}"></i>`; c.append(t); setTimeout(() => t.remove(), 1200); activar(rol);
    };
    const n = S.ronda.numero; const nuevos: { ord: number; fn: () => void }[] = [];
    S.mensajes.forEach((m) => { const k = `${n}:m:${m.id}`; if (!vistos.current.has(k)) { vistos.current.add(k); nuevos.push({ ord: m.t, fn: () => animar(m) }); } });
    S.alertas.forEach((a) => { const k = `${n}:a:${a.id}`; if (!vistos.current.has(k)) { vistos.current.add(k); nuevos.push({ ord: a.t, fn: () => destello(a.rol, 'bi-lightning-charge-fill') }); } });
    const dd = detalleRonda(S, n);
    (dd ? dd.pedidos : []).forEach((p) => { const k = `${n}:e:${p.n}`; if (p.enviado && !vistos.current.has(k)) { vistos.current.add(k); nuevos.push({ ord: p.enviadoAt || Date.now(), fn: () => destello('operativo', p.puntos === S.maxPorPedido ? 'bi-check-circle-fill' : 'bi-send-fill') }); } });
    if (primera.current) { primera.current = false; return; }
    nuevos.sort((a, b) => a.ord - b.ord).slice(-8).forEach((e, i) => setTimeout(e.fn, i * 260));
  }, [S]);

  return (
    <Tarjeta icono="bi-diagram-3" titulo="Recorrido en vivo">
      <div ref={cont} className="relative" role="group" aria-label="Recorrido de la información entre los eslabones">
        {r && <div className="mb-1"><Camion fraccion={ruta.fraccion} llegando={ruta.llegando} activo={r.estado === 'activa'} etiqueta={`Pedido ${enviadosN} entregado`} /></div>}
        <div className="grid grid-cols-6 items-start gap-1">
        {ORDEN.map((rol) => {
          const j = rolDe(S.jugadores, rol);
          return (
            <button key={rol} type="button" data-nodo={rol} aria-label={NOMBRE_ROL[rol]} onClick={() => abrirDrawer(rol)} className={cx('nodo', !j && 'vacio')} style={{ ['--c' as string]: colorRol(rol) }}>
              <div className="nodo-ic" data-nodo-ic={rol}><IcRol rol={rol} /></div>
              <div className="text-xs font-extrabold">{CORTO_ROL(rol)}</div>
              <div className="muted max-w-full truncate text-[11px] font-semibold">{j ? j.alias : ' '}</div>
              {CAMPOS_DE[rol].map((c) => {
                const real = ped && ped.real ? ped.real[c] : null; const out = sal[rol][c];
                const est = !real || !out ? 'nada' : estadoValor(out.valor, c, ped);
                return <span key={c} title={real || ''} className={cx('cv', est !== 'nada' && est)}><Ic n={ICON_CAMPO[c]} />{real || '·'}</span>;
              })}
            </button>
          );
        })}
        </div>
      </div>
      <div className="muted mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold">
        {(['nota', 'tarjeta', 'eco', 'correccion'] as const).map((t) => <span key={t}><IcTipo tipo={t} className="mr-1" />{t === 'correccion' ? 'corrección' : t}</span>)}
        <span><Ic n="bi-lightning-charge-fill" className="mr-1 text-brand-500" />incidente</span>
      </div>
    </Tarjeta>
  );
}

/* ---------- Recorrido de cada dato ---------- */
export function Heat({ S, selPedido, selCelda, setSelCelda }: Props) {
  const r = S.ronda;
  if (!r) return <Tarjeta icono="bi-search" titulo="Recorrido de cada dato"><p className="muted m-0 text-sm">Aún no hay datos.</p></Tarjeta>;
  const pN = selPedido || r.pedidoActual; const det = detalleRonda(S, r.numero); const ped = det ? det.pedidos.find((p) => p.n === pN) : null;
  const sal = salidas(msgsDe(S, r.numero, pN));
  const real = (c: string) => (ped && ped.real ? ped.real[c] : null);
  let detalle;
  if (selCelda) {
    const [quien, c] = selCelda.split(':');
    if (quien === 'envio') {
      const env = ped && ped.enviado ? ped.enviado[c] : null;
      detalle = <><span className="dato"><Ic n="bi-send" />{env == null ? 'sin enviar' : env}</span><Ic n="bi-arrow-right" className="mx-1" /><Dato campo={c} valor={real(c) || '—'} estado="ok" /><span className="muted ml-1 text-xs">valor real</span></>;
    } else {
      const o = sal[quien][c];
      detalle = <><span className="dato"><IcRol rol={quien} />{CORTO_ROL(quien)}</span>{o ? <span className="dato"><IcTipo tipo={o.tipo} /><Ic n={ICON_CAMPO[c]} />{o.valor}</span> : <span className="dato"><Ic n="bi-slash-circle" />nada todavía</span>}<Ic n="bi-arrow-right" className="mx-1" /><Dato campo={c} valor={real(c) || '—'} estado="ok" /><span className="muted ml-1 text-xs">valor real</span></>;
    }
  } else detalle = <span className="muted text-xs"><Ic n="bi-hand-index" className="mr-1" />Toca una celda. Verde: correcto. Rojo: error. Amarillo: dato desactualizado.</span>;
  return (
    <Tarjeta icono="bi-search" titulo="Recorrido de cada dato">
      <div className="overflow-x-auto">
        <table className="border-separate" style={{ borderSpacing: '.3rem' }}>
          <thead><tr><th />{ORDEN.map((rol) => <th key={rol} title={NOMBRE_ROL[rol]} className="muted"><IcRol rol={rol} /></th>)}<th title="Despacho enviado" className="muted"><Ic n="bi-send" /></th></tr></thead>
          <tbody>
            {CAMPOS_ORDEN.map((c) => (
              <tr key={c}>
                <th title={S.campos[c].label} className="muted pr-2"><Ic n={ICON_CAMPO[c]} /></th>
                {ORDEN.map((rol) => { const o = sal[rol][c]; const est = !o ? 'vacio' : estadoValor(o.valor, c, ped); const k = `${rol}:${c}`; return <td key={rol}><button type="button" aria-label={`${NOMBRE_ROL[rol]}, ${S.campos[c].label}`} onClick={() => setSelCelda(k)} className={cx('cell', est !== 'vacio' && est, selCelda === k && 'sel')}>{ICONO_ESTADO[est] && <Ic n={ICONO_ESTADO[est]} />}</button></td>; })}
                {(() => { const env = ped && ped.enviado ? ped.enviado[c] : null; const est = env == null ? 'vacio' : ped!.correctos && ped!.correctos[c] ? 'ok' : 'bad'; const k = `envio:${c}`; return <td><button type="button" aria-label={`Enviado, ${S.campos[c].label}`} onClick={() => setSelCelda(k)} className={cx('cell', est !== 'vacio' && est, selCelda === k && 'sel')}>{ICONO_ESTADO[est] && <Ic n={ICONO_ESTADO[est]} />}</button></td>; })()}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex min-h-9 flex-wrap items-center">{detalle}</div>
    </Tarjeta>
  );
}

/* ---------- Actividad ---------- */
export function Ticker({ S }: { S: EstadoHost }) {
  const r = S.ronda;
  const ev: { t: number; k: string; nodo: React.ReactNode }[] = [];
  if (r) {
    const det = detalleRonda(S, r.numero);
    S.mensajes.forEach((m) => ev.push({ t: m.t, k: m.id, nodo: <>
      <IcTipo tipo={m.tipo} /><IcRol rol={m.de} /><Ic n="bi-arrow-right" className="muted" />{m.a === 'todos' ? <Ic n="bi-people" /> : <IcRol rol={m.a} />}
      {Object.entries(m.datos || {}).map(([c, v]) => <Dato key={c} campo={c} valor={v} estado={'t-' + m.tipo} />)}
      {m.texto && <span className="text-sm">{m.texto}</span>}<span className="pill">P{m.pedidoN}</span></> }));
    S.alertas.forEach((a) => ev.push({ t: a.t, k: a.id, nodo: <><Ic n="bi-lightning-charge-fill" className="text-brand-500" /><IcRol rol={a.rol} /><Dato campo={a.campo} valor={a.nuevo} estado="nuevo" /><span className="pill">P{a.pedidoN}</span></> }));
    (det ? det.pedidos : []).filter((p) => p.enviado).forEach((p) => ev.push({ t: p.enviadoAt || 0, k: 'p' + p.n, nodo: <><Ic n={p.puntos === S.maxPorPedido ? 'bi-check-circle-fill text-ok' : 'bi-send-fill text-warn'} /><IcRol rol="operativo" /><b>{p.puntos}/{S.maxPorPedido}</b><span className="pill">P{p.n}</span></> }));
  }
  ev.sort((a, b) => b.t - a.t);
  return (
    <Tarjeta icono="bi-clock-history" titulo="Actividad">
      {ev.length && r ? ev.slice(0, 14).map((e) => (
        <div key={e.k} className="flex flex-wrap items-center gap-1.5 border-b border-[var(--line)] py-1.5 last:border-0"><span className="tabular muted w-12 shrink-0 text-xs font-bold">{mmss(e.t - r.inicio)}</span>{e.nodo}</div>
      )) : <span className="muted text-sm">Sin actividad todavía.</span>}
    </Tarjeta>
  );
}
