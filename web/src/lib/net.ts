import { useCallback, useEffect, useRef, useState } from 'react';

/** Conexión WebSocket con reconexión automática. */
export function useSocket(onAbrir: (enviar: (o: object) => void) => void, onMensaje: (m: any) => void) {
  const ws = useRef<WebSocket | null>(null);
  const [conectado, setConectado] = useState(false);
  const hAbrir = useRef(onAbrir); const hMsg = useRef(onMensaje);
  hAbrir.current = onAbrir; hMsg.current = onMensaje;
  const enviar = useCallback((o: object) => { if (ws.current && ws.current.readyState === 1) ws.current.send(JSON.stringify(o)); }, []);

  useEffect(() => {
    let cerrado = false; let intentos = 0; let temporizador: ReturnType<typeof setTimeout>;
    const abrir = () => {
      const s = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws');
      ws.current = s;
      s.onopen = () => { intentos = 0; setConectado(true); hAbrir.current(enviar); };
      s.onmessage = (e) => { try { hMsg.current(JSON.parse(e.data)); } catch (err) { console.error(err); } };
      s.onclose = () => { setConectado(false); if (!cerrado) temporizador = setTimeout(abrir, Math.min(5000, 800 * ++intentos)); };
    };
    abrir();
    return () => { cerrado = true; clearTimeout(temporizador); ws.current?.close(); };
  }, [enviar]);

  return { enviar, conectado };
}

export function guardado<T>(clave: string): T | null {
  try { return JSON.parse(localStorage.getItem(clave) || 'null'); } catch { return null; }
}
export function guardar(clave: string, v: unknown) {
  try { if (v == null) localStorage.removeItem(clave); else localStorage.setItem(clave, JSON.stringify(v)); } catch { /* ignorar */ }
}
