import { motion } from 'framer-motion';
import { CAMPOS_ORDEN, ICON_CAMPO, mmss } from '../lib/constants';
import { Ic, Tarjeta, cx } from '../lib/ui';
import type { EstadoHost } from '../lib/types';
import { ICONO_ESTADO, detalleRonda } from './calc';

function PedidoMapa({ S, numero }: { S: EstadoHost; numero: number }) {
  const det = detalleRonda(S, numero); if (!det) return null;
  return (
    <div className="overflow-x-auto">
      <table className="border-separate" style={{ borderSpacing: '.3rem' }}>
        <thead><tr><th />{det.pedidos.map((p) => <th key={p.n} className="muted text-xs">P{p.n}</th>)}</tr></thead>
        <tbody>
          {CAMPOS_ORDEN.map((c) => (
            <tr key={c}>
              <th title={S.campos[c].label} className="muted pr-2"><Ic n={ICON_CAMPO[c]} /></th>
              {det.pedidos.map((p) => {
                const est = p.enviado ? (p.correctos && p.correctos[c] ? 'ok' : 'bad') : 'vacio';
                const tip = p.enviado ? `${S.campos[c].label}: enviado "${p.enviado[c]}", real "${p.real ? p.real[c] : ''}"` : 'sin enviar';
                return <td key={p.n}><span title={tip} className={cx('cell fijo', est !== 'vacio' && est)}>{ICONO_ESTADO[est] && <Ic n={ICONO_ESTADO[est]} />}</span></td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const COLORES_NOTA = ['bg-bad', 'bg-warn', 'bg-slate-400', 'bg-sky-500', 'bg-ok'];

function Metrica({ icono, titulo, a, b, max }: { icono: string; titulo: string; a: number; b: number; max: number }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <Ic n={icono} className="muted w-6 text-xl" /><span className="sr-only">{titulo}</span>
      <div className="flex-1 space-y-1.5">
        <div className="h-3 overflow-hidden rounded-full bg-[var(--line)]"><motion.div className="h-full rounded-full bg-slate-400" initial={{ width: 0 }} animate={{ width: `${max ? (a / max) * 100 : 0}%` }} /></div>
        <div className="h-3 overflow-hidden rounded-full bg-[var(--line)]"><motion.div className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600" initial={{ width: 0 }} animate={{ width: `${max ? (b / max) * 100 : 0}%` }} /></div>
      </div>
      <div className="tabular w-16 text-right font-extrabold">{a} a {b}</div>
    </div>
  );
}

function Encuesta({ S }: { S: EstadoHost }) {
  const e = S.encuesta; if (!e) return null;
  const pct = e.total ? Math.round((e.respondieron / e.total) * 100) : 0;
  return (
    <Tarjeta id="encuestaPanel" icono="bi-clipboard-check" titulo={<span className="flex flex-1 items-center gap-3">Formulario de satisfacción<span id="encuestaConteo" className="pill pill-brand">{e.respondieron} de {e.total}</span></span>}>
      <div className="mb-4 h-2 overflow-hidden rounded-full bg-[var(--line)]" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><div className="h-full bg-brand-500" style={{ width: `${pct}%` }} /></div>
      {e.respondieron ? (
        <div>
          {e.items.map((it, i) => (
            <div key={i} className="mb-4">
              <div className="flex justify-between gap-3 text-sm"><span>{i + 1}. {it.texto}</span><b className="tabular">{it.promedio == null ? '—' : it.promedio.toLocaleString('es', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}</b></div>
              <div className="mt-1.5 flex h-4 overflow-hidden rounded-full bg-[var(--line)]" role="img" aria-label={`Distribución de notas de la afirmación ${i + 1}`}>
                {it.dist.map((n, k) => (n ? <div key={k} className={cx('grid place-items-center text-[10px] font-extrabold text-white', COLORES_NOTA[k])} style={{ width: `${it.n ? (n / it.n) * 100 : 0}%` }} title={`Nota ${k + 1}: ${n}`}>{k + 1}</div> : null))}
              </div>
            </div>
          ))}
          <p className="muted mb-3 text-xs">Escala de 1 (muy en desacuerdo) a 5 (muy de acuerdo). Las respuestas son anónimas.</p>
          {e.abiertas.map((a) => (
            <details key={a.pregunta} className="mb-2"><summary className="cursor-pointer text-sm font-bold">{a.pregunta} ({a.respuestas.length})</summary>
              {a.respuestas.length ? <ul className="mt-2 text-sm">{a.respuestas.map((r, i) => <li key={i}>{r}</li>)}</ul> : <div className="muted mt-1 text-sm">Sin respuestas.</div>}</details>
          ))}
        </div>
      ) : <p className="muted m-0 flex items-center gap-1.5 text-sm"><Ic n="bi-hourglass-split" />Esperando respuestas de los participantes.</p>}
    </Tarjeta>
  );
}

export function Comparar({ S }: { S: EstadoHost }) {
  const res = S.resumenes;
  if (!res.length) return <Tarjeta><span className="muted">Aún no hay rondas terminadas.</span></Tarjeta>;
  const [a, b] = res;
  const err = (x: typeof a) => CAMPOS_ORDEN.reduce((s, k) => s + x.erroresPorCampo[k], 0);
  const diff = b ? b.puntos - a.puntos : 0;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {res.map((x) => (
          <Tarjeta key={x.numero}>
            <div className="mb-3 flex items-center gap-2">
              <span className={cx('pill text-sm', x.numero === 1 ? '' : 'pill-brand')}>Ronda {x.numero}<Ic n={x.modo === 'notas' ? 'bi-arrow-right' : 'bi-chat-dots'} /></span>
              <span className="flex-1" /><span className="score tabular">{x.puntos}</span><span className="muted text-lg font-bold">/{x.max}</span>
            </div>
            <div className="mb-3 h-3 overflow-hidden rounded-full bg-[var(--line)]" role="progressbar" aria-valuenow={x.puntos} aria-valuemin={0} aria-valuemax={x.max}>
              <motion.div className={cx('h-full rounded-full', x.numero === 1 ? 'bg-slate-400' : 'bg-gradient-to-r from-brand-400 to-brand-600')} initial={{ width: 0 }} animate={{ width: `${(x.puntos / x.max) * 100}%` }} />
            </div>
            <div className="mb-3 flex flex-wrap">
              <span className="dato"><Ic n="bi-check-circle" />{x.perfectos}/{x.pedidosTotal}</span><span className="dato"><Ic n="bi-envelope" />{x.mensajes}</span>
              <span className="dato"><Ic n="bi-pencil" />{x.correcciones}</span><span className="dato"><Ic n="bi-stopwatch" />{mmss(x.duracionSeg * 1000)}</span>
            </div>
            <PedidoMapa S={S} numero={x.numero} />
          </Tarjeta>
        ))}
      </div>
      {res.length === 2 && (
        <Tarjeta icono="bi-arrow-left-right" titulo={<span className="flex flex-1 items-center justify-between gap-3">Ronda 1 frente a ronda 2<span className={cx('pill', diff > 0 ? 'pill-ok' : diff < 0 ? 'pill-bad' : '')}><Ic n={diff > 0 ? 'bi-arrow-up' : diff < 0 ? 'bi-arrow-down' : 'bi-dash'} />{Math.abs(diff)} puntos</span></span>}>
          <Metrica icono="bi-bullseye" titulo="Puntos" a={a.puntos} b={b.puntos} max={Math.max(a.max, b.max)} />
          <Metrica icono="bi-check-circle" titulo="Despachos perfectos" a={a.perfectos} b={b.perfectos} max={Math.max(a.pedidosTotal, b.pedidosTotal)} />
          <Metrica icono="bi-x-circle" titulo="Datos errados" a={err(a)} b={err(b)} max={Math.max(err(a), err(b), 1)} />
          <Metrica icono="bi-envelope" titulo="Mensajes" a={a.mensajes} b={b.mensajes} max={Math.max(a.mensajes, b.mensajes, 1)} />
          <div className="mt-3 flex flex-wrap items-center gap-1.5"><span className="muted text-sm">Dato más errado:</span>
            {res.map((x) => { const top = CAMPOS_ORDEN.slice().sort((p, q) => x.erroresPorCampo[q] - x.erroresPorCampo[p])[0]; return <span key={x.numero} className="dato">R{x.numero}<Ic n={ICON_CAMPO[top]} />{x.erroresPorCampo[top] ? `x${x.erroresPorCampo[top]}` : 'sin errores'}</span>; })}
          </div>
          <p className="muted mb-0 mt-3 text-xs">Simulación con pocas personas y sin grupo de comparación: sirve para conversar, no para probar una mejora.</p>
        </Tarjeta>
      )}
      <Encuesta S={S} />
    </div>
  );
}

