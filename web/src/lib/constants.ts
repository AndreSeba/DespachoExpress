// Datos del juego que comparten jugador y panel. Íconos: solo Bootstrap Icons (sin emojis).
export const ORDEN = ['planificacion', 'inventarios', 'almacen', 'transporte', 'seguridad', 'operativo'] as const;
export type Rol = (typeof ORDEN)[number];
export type Campo = 'producto' | 'cantidad' | 'anden' | 'unidad' | 'restriccion' | 'destino' | 'horario';
export type Tipo = 'nota' | 'tarjeta' | 'eco' | 'correccion' | 'msg';

export const ICON_ROL: Record<string, string> = { planificacion: 'bi-calendar-check', inventarios: 'bi-boxes', almacen: 'bi-box-seam', transporte: 'bi-truck', seguridad: 'bi-shield-check', operativo: 'bi-clipboard-check' };
export const ICON_CAMPO: Record<string, string> = { producto: 'bi-bag', cantidad: 'bi-123', anden: 'bi-building', unidad: 'bi-truck-front', restriccion: 'bi-exclamation-triangle', destino: 'bi-geo-alt', horario: 'bi-clock' };
export const ICON_TIPO: Record<string, string> = { nota: 'bi-envelope', tarjeta: 'bi-person-vcard', eco: 'bi-megaphone', correccion: 'bi-pencil', msg: 'bi-chat-dots' };
export const COLOR_TIPO: Record<string, string> = { nota: '#2B6CB0', tarjeta: '#0E9AA7', eco: '#7C4DBA', correccion: '#E07A2F', msg: '#6B7B8C' };
export const COLOR_ROL: Record<string, string> = { planificacion: '#2f7fd0', inventarios: '#7c5cd6', almacen: '#d98a14', transporte: '#17a075', seguridad: '#d94668', operativo: '#e07a2f' };
export const NOMBRE_ROL: Record<string, string> = { planificacion: 'Planificación de despachos', inventarios: 'Inventarios', almacen: 'Almacén', transporte: 'Transporte', seguridad: 'Seguridad', operativo: 'Operativo' };
export const CORTO_ROL = (r: string) => NOMBRE_ROL[r].split(' ')[0];
export const CAMPOS_ORDEN: Campo[] = ['producto', 'cantidad', 'anden', 'unidad', 'restriccion', 'destino', 'horario'];
export const CAMPOS_DE: Record<string, Campo[]> = { planificacion: ['destino', 'horario'], inventarios: ['producto', 'cantidad'], almacen: ['anden'], transporte: ['unidad'], seguridad: ['restriccion'], operativo: [] };
export const ROL_DE_CAMPO: Record<string, Rol> = { destino: 'planificacion', horario: 'planificacion', producto: 'inventarios', cantidad: 'inventarios', anden: 'almacen', unidad: 'transporte', restriccion: 'seguridad' };

export const MISION: Record<string, string> = {
  planificacion: 'Sabes el destino y la hora.', inventarios: 'Sabes el producto y la cantidad.', almacen: 'Sabes en qué muelle se carga.',
  transporte: 'Sabes qué unidad va.', seguridad: 'Sabes la restricción de la carga.', operativo: 'Armas y envías el despacho.',
};

export const REGLA = {
  notas: [['bi-eye', 'Ves tus datos unos segundos y se ocultan'], ['bi-pencil-square', 'Escribes una nota de memoria, una sola vez'], ['bi-slash-circle', 'No se puede preguntar ni corregir']],
  chat: [['bi-chat-dots-fill', 'Ahora sí pueden hablar: con una persona o con todos'], ['bi-eye', 'Ves tus datos unos segundos y se ocultan'], ['bi-journal-text', 'Escribes tu nota y ves las notas de todos'], ['bi-megaphone', 'El Operativo lee el eco y se corrige a tiempo']],
} as const;
export const PASOS = {
  notas: [['bi-eye', 'Memoriza tus datos'], ['bi-pencil-square', 'Escribe tu nota'], ['bi-slash-circle', 'Una vez, sin preguntas']],
  chat: [['bi-eye', 'Memoriza tus datos'], ['bi-journal-text', 'Publica tu nota'], ['bi-chat-dots', 'Habla, pregunta y corrige']],
} as const;

export const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
};
