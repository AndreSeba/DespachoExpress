// Forma del estado que manda el servidor (ver lib/game.js, snapshot).
export interface Jugador { id: string; alias: string; puesto?: string; roles: string[]; observador: boolean; conectado: boolean; bot: boolean }
export interface Mensaje { id: string; tipo: string; de: string; a: string; texto: string; datos: Record<string, string> | null; pedidoN: number; t: number }
export interface Alerta { id: string; rol: string; campo: string; anterior?: string; nuevo: string; texto: string; pedidoN: number; t: number }
export interface Ronda {
  numero: number; modo: 'notas' | 'chat'; estado: 'preparando' | 'activa' | 'cerrada'; inicio: number; fin: number;
  pedidoActual: number; pedidosTotal: number; motivo?: string; pedidoDesde: number; verSeg: number; progreso: string[];
  preparacion: { listos: string[]; requeridos: string[] } | null;
}
export interface Resumen {
  numero: number; modo: string; puntos: number; max: number; pedidosEnviados: number; pedidosTotal: number; perfectos: number;
  mensajes: number; correcciones: number; incidentes: number; duracionSeg: number; erroresPorCampo: Record<string, number>;
}
export interface Hecho { n: number; puntos: number; perfecto: boolean; errores: string[] }
export interface PedidoDetalle {
  n: number; real: Record<string, string> | null; original: Record<string, string>; enviado: Record<string, string> | null;
  correctos: Record<string, boolean> | null; puntos: number; incidentes?: { campo: string; anterior: string }[]; enviadoAt?: number;
}
export interface EncuestaHost {
  total: number; respondieron: number;
  items: { texto: string; n: number; promedio: number | null; dist: number[] }[];
  abiertas: { pregunta: string; respuestas: string[] }[];
}
export interface Base {
  code: string; fase: 'lobby' | 'ronda' | 'entre' | 'final'; config: { rondaSeg: number; pedidos: number }; ahora: number;
  campos: Record<string, { label: string; opciones: string[] }>; jugadores: Jugador[]; resumenes: Resumen[]; maxPorPedido: number;
  restriccionRelajada: boolean; ronda: Ronda | null;
}
export interface EstadoJugador extends Base {
  tipo: 'jugador';
  yo: { id: string; alias: string; puesto?: string; roles: string[]; observador: boolean };
  misCampos?: { rol: string; campo: string; label: string; valor: string }[];
  mensajes?: Mensaje[]; alertas?: Alerta[]; hechos?: Hecho[];
  encuesta?: { hecha: boolean; items: string[]; preguntas: string[] };
}
export interface EstadoHost extends Base {
  tipo: 'host';
  detalle: { numero: number; pedidos: PedidoDetalle[] }[];
  mensajes: Mensaje[]; alertas: Alerta[]; encuesta: EncuestaHost | null;
}
