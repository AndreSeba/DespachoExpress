import { ORDEN } from '../lib/constants';
import type { EstadoHost, Jugador, Mensaje, PedidoDetalle } from '../lib/types';

export type Estado = 'vacio' | 'ok' | 'bad' | 'stale';
export const ICONO_ESTADO: Record<string, string> = { ok: 'bi-check-lg', bad: 'bi-x-lg', stale: 'bi-arrow-counterclockwise' };

export const rolDe = (jugadores: Jugador[], rol: string) => jugadores.find((j) => j.roles.includes(rol));
export const detalleRonda = (S: EstadoHost, n: number) => (S.detalle || []).find((d) => d.numero === n);
export const msgsDe = (S: EstadoHost, n: number, pedidoN: number) => (S.ronda && n === S.ronda.numero ? S.mensajes : []).filter((m) => m.pedidoN === pedidoN);

/** Compara lo que dijo un eslabón con el valor real. 'stale' = el dato de antes de un incidente. */
export function estadoValor(valor: string, campo: string, ped?: PedidoDetalle | null): Estado {
  if (!ped || !ped.real) return 'vacio';
  if (valor === ped.real[campo]) return 'ok';
  const inc = (ped.incidentes || []).find((x) => x.campo === campo);
  if (inc && valor === inc.anterior) return 'stale';
  return 'bad';
}

export type Salidas = Record<string, Record<string, { valor: string; tipo: string; t: number }>>;
export function salidas(msgs: Mensaje[]): Salidas {
  const out: Salidas = {}; ORDEN.forEach((r) => { out[r] = {}; });
  for (const m of msgs) {
    if (!m.datos) continue;
    for (const [c, v] of Object.entries(m.datos)) out[m.de][c] = { valor: v, tipo: m.tipo, t: m.t };
  }
  return out;
}
