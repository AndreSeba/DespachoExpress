import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { COLOR_TIPO, ICON_TIPO, ORDEN, NOMBRE_ROL, type Rol } from '../lib/constants';
import type { EstadoJugador, Mensaje } from '../lib/types';
import { Dato, Ic, IcRol, IcTipo, colorRol, cx } from '../lib/ui';
import { fx } from '../lib/fx';
import { Camion } from '../lib/Camion';

export interface Ctx {
  S: EstadoJugador;
  rol: string;
  roles: string[];
  enviar: (o: object) => void;
  enviarMsg: (o: object) => void;
  elegirRol: (r: string) => void;
}

export const rachaAhora = (h: { perfecto: boolean }[]) => { let n = 0; for (let i = h.length - 1; i >= 0 && h[i].perfecto; i--) n++; return n; };
export const rachaMax = (h: { perfecto: boolean }[]) => { let m = 0, n = 0; h.forEach((x) => { n = x.perfecto ? n + 1 : 0; m = Math.max(m, n); }); return m; };

export const pedActual = (S: EstadoJugador) => (S.ronda ? S.ronda.pedidoActual : 1);
export const msgsPedido = (S: EstadoJugador, tipo?: string | null, filtro?: (m: Mensaje) => boolean) =>
  (S.mensajes || []).filter((m) => m.pedidoN === pedActual(S) && (!tipo || m.tipo === tipo) && (!filtro || filtro(m)));

export const eslabonDe = (rol: string) => document.querySelector(`[data-eslabon="${rol}"]`);
export const volar = (de: string, a: string, tipo: string, retraso = 0) =>
  fx.vuelo(eslabonDe(de), eslabonDe(a), ICON_TIPO[tipo] || 'bi-envelope', COLOR_TIPO[tipo], retraso);

export function RolBadge({ rol }: { rol: string }) {
  return <span className="pill"><IcRol rol={rol} />{NOMBRE_ROL[rol]}</span>;
}

export function DatosDe({ datos, estado }: { datos: Record<string, string> | null | undefined; estado?: string }) {
  return <>{Object.entries(datos || {}).map(([c, v]) => <Dato key={c} campo={c} valor={v} estado={estado} />)}</>;
}

/** Cadena de eslabones: yo resaltado, completados en verde. Con `ruta`, un camión recorre el camino. */
export function Cadena({ S, rol, ruta }: { S: EstadoJugador; rol: string; ruta?: { fraccion: number; llegando: boolean; etiqueta?: string } }) {
  const hechos = new Set(S.ronda?.estado === 'activa' ? msgsPedido(S, null, (m) => m.tipo !== 'eco').map((m) => m.de) : []);
  return (
    <div aria-label="Cadena de despacho" role="group">
      {ruta && <Camion fraccion={ruta.fraccion} llegando={ruta.llegando} etiqueta={ruta.etiqueta} activo={S.ronda?.estado === 'activa'} />}
      <div className="grid grid-cols-6 py-1">
        {ORDEN.map((x) => (
          <div key={x} className="flex justify-center">
            <motion.div layout data-eslabon={x} title={NOMBRE_ROL[x]} className={cx('eslabon', x === rol && 'yo', hechos.has(x as Rol) && 'listo')} style={{ ['--c' as string]: colorRol(x) }}>
              <IcRol rol={x} />
              {hechos.has(x as Rol) && <Ic n="bi-check-circle-fill" className="tic" />}
            </motion.div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function FilaMensaje({ m }: { m: Mensaje }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-[var(--line)] py-2 last:border-0">
      <IcTipo tipo={m.tipo} className="text-[var(--muted)]" /><IcRol rol={m.de} /><Ic n="bi-arrow-right" className="muted" />
      {m.a === 'todos' ? <Ic n="bi-people" /> : <IcRol rol={m.a} />}
      {!(m.tipo === 'nota' && m.texto) && <DatosDe datos={m.datos} estado={'t-' + m.tipo} />}
      {m.texto && <span className="text-sm">{m.texto}</span>}
    </div>
  );
}

export function Paso({ icono, texto, n }: { icono: string; texto: string; n: number }) {
  return (
    <div className="panel-soft flex flex-col items-center gap-1 p-3 text-center">
      <Ic n={icono} className="text-2xl text-brand-500" />
      <div className="text-xs font-bold leading-tight">{n}. {texto}</div>
    </div>
  );
}

export const Seccion = ({ children }: { children: ReactNode }) => <div className="space-y-3">{children}</div>;
