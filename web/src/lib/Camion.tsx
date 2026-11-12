import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ORDEN } from './constants';
import { fx } from './fx';
import { Ic, cx } from './ui';

/** Avance del camión: un quinto de la ruta por cada eslabón que ya comunicó en el pedido actual.
 *  Al enviarse el despacho, llega a la meta y luego vuelve a salir para el pedido siguiente. */
export function useRuta(numero: number | undefined, enviados: number, progreso: string[] = []) {
  const prev = useRef({ num: numero, env: enviados });
  const [llegando, setLlegando] = useState(false);
  useEffect(() => {
    const p = prev.current;
    prev.current = { num: numero, env: enviados };
    if (p.num === numero && enviados > p.env) {
      setLlegando(true);
      const t = setTimeout(() => setLlegando(false), 1800);
      return () => clearTimeout(t);
    }
  }, [numero, enviados]);
  const n = ORDEN.slice(0, 5).filter((r) => progreso.includes(r)).length;
  return { fraccion: llegando ? 1 : n / 5, llegando };
}

/** Carretera con el camión. Se alinea con seis columnas iguales (una por eslabón). */
export function Camion({ fraccion, llegando, activo = true, etiqueta }: { fraccion: number; llegando?: boolean; activo?: boolean; etiqueta?: string }) {
  const [bocina, setBocina] = useState(0);
  const f = Math.max(0, Math.min(1, fraccion));
  const x = ((0.5 + 5 * f) / 6) * 100; // centro de la columna donde está el camión
  const tocar = () => { setBocina((b) => b + 1); fx.sonar('bocina'); fx.vibrar([40, 30, 80]); };
  return (
    <div className="relative h-14 select-none" role="img" aria-label={`Ruta del pedido: ${Math.round(f * 100)} por ciento`} data-camion>
      <div className="absolute top-[2.35rem] h-2 rounded-full bg-[var(--line)]" style={{ left: '8.333%', right: '8.333%' }} />
      <div className={cx('calle absolute top-[2.35rem] h-2 overflow-hidden rounded-full', activo && !llegando && f < 1 && 'moviendo')} style={{ left: '8.333%', right: '8.333%' }} aria-hidden="true" />
      <motion.div className="absolute top-[2.35rem] h-2 rounded-full bg-gradient-to-r from-brand-300 to-brand-500" style={{ left: '8.333%' }} initial={false} animate={{ width: `${f * 83.333}%` }} transition={{ type: 'spring', stiffness: 60, damping: 16 }} />
      <motion.button
        type="button" onClick={tocar} aria-label="Tocar la bocina" title="Bocina"
        className={cx('camion absolute top-0 -translate-x-1/2 cursor-pointer border-0 bg-transparent p-0', activo && !llegando && f < 1 && 'rodando')}
        initial={false} animate={{ left: `${x}%` }} transition={{ type: 'spring', stiffness: 55, damping: 15 }}
      >
        <motion.span key={bocina} initial={{ scale: 1 }} animate={bocina ? { scale: [1, 1.25, 0.95, 1.1, 1], rotate: [0, -6, 5, -3, 0] } : undefined} transition={{ duration: 0.5 }} className="block">
          <Ic n="bi-truck" className="text-[2.1rem] text-brand-500 drop-shadow-[0_6px_6px_rgba(120,40,20,.35)]" />
        </motion.span>
        {bocina > 0 && <motion.span key={'b' + bocina} initial={{ opacity: 1, y: 0, x: 10 }} animate={{ opacity: 0, y: -16, x: 18 }} transition={{ duration: 0.9 }} className="absolute -top-3 left-full whitespace-nowrap rounded-full bg-white px-2 py-0.5 text-[11px] font-extrabold text-brand-600 shadow">¡Pi, pi!</motion.span>}
      </motion.button>
      {llegando && (
        <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="absolute left-[8.333%] top-0 flex items-center gap-1.5 rounded-full bg-ok px-3 py-1 text-xs font-extrabold text-white shadow-lg">
          <Ic n="bi-check-circle-fill" />{etiqueta || 'Entregado'}
        </motion.div>
      )}
    </div>
  );
}

/** Pantalla de carga: el camión avanza con cada persona lista. */
export function CargaCamion({ fraccion, titulo, detalle, id }: { fraccion: number; titulo: string; detalle?: string; id?: string }) {
  const f = Math.max(0, Math.min(1, fraccion));
  return (
    <div id={id} className="panel p-5 text-center">
      <div className="mb-1 text-lg font-extrabold">{titulo}</div>
      <div className="relative mx-auto my-3 h-14 max-w-md" role="progressbar" aria-valuenow={Math.round(f * 100)} aria-valuemin={0} aria-valuemax={100}>
        <div className="absolute inset-x-7 top-[2.35rem] h-2 rounded-full bg-[var(--line)]" />
        <div className={cx('calle absolute inset-x-7 top-[2.35rem] h-2 overflow-hidden rounded-full', f < 1 && 'moviendo')} aria-hidden="true" />
        <motion.div className="absolute left-7 top-[2.35rem] h-2 rounded-full bg-gradient-to-r from-brand-300 to-brand-500" initial={false} animate={{ width: `calc(${f} * (100% - 3.5rem))` }} transition={{ type: 'spring', stiffness: 60, damping: 16 }} />
        <motion.div className={cx('camion absolute top-0 -translate-x-1/2', f < 1 && 'rodando')} initial={false} animate={{ left: `calc(1.75rem + ${f} * (100% - 3.5rem))` }} transition={{ type: 'spring', stiffness: 55, damping: 15 }}>
          <Ic n="bi-truck" className="text-[2.1rem] text-brand-500 drop-shadow-[0_6px_6px_rgba(120,40,20,.35)]" />
        </motion.div>
        <Ic n="bi-flag-fill" className="absolute right-0 top-[1.4rem] text-xl text-ink-700" />
      </div>
      {detalle && <div className="muted text-sm font-semibold">{detalle}</div>}
    </div>
  );
}
