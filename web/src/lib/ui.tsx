import { useEffect, useState, type ReactNode, type CSSProperties } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { COLOR_ROL, ICON_CAMPO, ICON_ROL, ICON_TIPO } from './constants';

export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ');

export function Ic({ n, className, style }: { n: string; className?: string; style?: CSSProperties }) {
  return <i className={cx('bi', n, className)} style={style} aria-hidden="true" />;
}
export const IcRol = ({ rol, className }: { rol: string; className?: string }) => <Ic n={ICON_ROL[rol] || 'bi-person'} className={className} />;
export const IcTipo = ({ tipo, className }: { tipo: string; className?: string }) => <Ic n={ICON_TIPO[tipo] || 'bi-chat-dots'} className={className} />;
export const colorRol = (rol: string) => COLOR_ROL[rol] || '#2f7fd0';

/** Dato del pedido: icono del campo + valor. */
export function Dato({ campo, valor, estado, grande }: { campo: string; valor: ReactNode; estado?: string; grande?: boolean }) {
  return <span className={cx('dato', grande && 'dato-lg', estado)}><Ic n={ICON_CAMPO[campo] || 'bi-dot'} />{valor}</span>;
}

/** Tarjeta con título e icono. */
export function Tarjeta({ icono, titulo, children, className, id }: { icono?: string; titulo?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  return (
    <motion.section id={id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: 'easeOut' }} className={cx('panel p-4', className)}>
      {titulo && <h2 className="titulo-card"><span className="titulo-ic">{icono && <Ic n={icono} />}</span>{titulo}</h2>}
      {children}
    </motion.section>
  );
}

export function Hero({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cx('hero p-5', className)}>{children}</section>;
}

/** Aro de progreso (reloj del panel). */
export function Aro({ fraccion, texto, rojo, tam = 92 }: { fraccion: number; texto: string; rojo?: boolean; tam?: number }) {
  const r = 42; const c = 2 * Math.PI * r;
  return (
    <div className="relative grid place-items-center" style={{ width: tam, height: tam }}>
      <svg viewBox="0 0 100 100" width={tam} height={tam} aria-hidden="true" className="-rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--line)" strokeWidth="9" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={rojo ? '#d2232a' : '#8a6240'} strokeWidth="9" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(1, fraccion)))} style={{ transition: 'stroke-dashoffset .3s linear, stroke .3s' }} />
      </svg>
      <div id="ringTx" className="tabular absolute text-lg font-extrabold">{texto}</div>
    </div>
  );
}

/** Reloj que se actualiza cada `ms` milisegundos. */
export function useAhora(ms = 250) {
  const [t, setT] = useState(() => Date.now());
  useEffect(() => { const i = setInterval(() => setT(Date.now()), ms); return () => clearInterval(i); }, [ms]);
  return t;
}

/* ---------- Avisos (toast) ---------- */
type Aviso = { id: number; msg: string; tipo: 'error' | 'ok' | 'info' };
let avisoSeq = 0; const oyentes = new Set<(a: Aviso) => void>();
export const toast = (msg: string, tipo: Aviso['tipo'] = 'error') => { const a = { id: ++avisoSeq, msg, tipo }; oyentes.forEach((f) => f(a)); };
export function Avisos() {
  const [lista, setLista] = useState<Aviso[]>([]);
  useEffect(() => {
    const f = (a: Aviso) => { setLista((l) => [...l.slice(-2), a]); setTimeout(() => setLista((l) => l.filter((x) => x.id !== a.id)), 3600); };
    oyentes.add(f); return () => { oyentes.delete(f); };
  }, []);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }} role="status" aria-live="polite">
      <AnimatePresence>
        {lista.map((a) => (
          <motion.div key={a.id} initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10 }}
            className={cx('pointer-events-auto flex max-w-md items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white shadow-xl', a.tipo === 'error' ? 'bg-bad' : a.tipo === 'ok' ? 'bg-ok' : 'bg-ink-700')}>
            <Ic n={a.tipo === 'error' ? 'bi-exclamation-circle-fill' : a.tipo === 'ok' ? 'bi-check-circle-fill' : 'bi-info-circle-fill'} />{a.msg}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/** Ventana de confirmación. */
export function Modal({ abierto, titulo, children, onCerrar }: { abierto: boolean; titulo: string; children: ReactNode; onCerrar: () => void }) {
  useEffect(() => { if (!abierto) return; const f = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); }; window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f); }, [abierto, onCerrar]);
  return (
    <AnimatePresence>
      {abierto && (
        <motion.div className="fixed inset-0 z-[80] grid place-items-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onCerrar} />
          <motion.div role="dialog" aria-modal="true" aria-label={titulo} initial={{ scale: 0.92, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95 }} className="panel relative w-full max-w-md p-6">
            <h2 className="mb-2 text-xl font-extrabold">{titulo}</h2>{children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Panel lateral. */
export function Lateral({ abierto, titulo, children, onCerrar }: { abierto: boolean; titulo: ReactNode; children: ReactNode; onCerrar: () => void }) {
  return (
    <AnimatePresence>
      {abierto && (
        <motion.div className="fixed inset-0 z-[70]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/45" onClick={onCerrar} />
          <motion.aside initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 320 }}
            className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-[var(--line)] bg-[var(--surface)] shadow-2xl" role="dialog" aria-label="Detalle del eslabón">
            <header className="flex items-center justify-between gap-3 border-b border-[var(--line)] p-4"><h2 className="text-lg font-extrabold">{titulo}</h2>
              <button type="button" className="btn btn-ghost btn-sm" onClick={onCerrar} aria-label="Cerrar"><Ic n="bi-x-lg" /></button></header>
            <div className="flex-1 overflow-y-auto p-4">{children}</div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
