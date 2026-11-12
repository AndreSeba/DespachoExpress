import { useEffect, useRef } from 'react';
import type { EstadoJugador, Hecho } from '../lib/types';
import { fx } from '../lib/fx';
import { rachaAhora, volar } from './util';

/** Detecta cambios del estado y dispara efectos. No celebra la primera carga ni una reconexión. */
export function useEfectos(S: EstadoJugador | null, rol: string | null, onPedido: (x: Hecho, racha: number) => void) {
  const prev = useRef({ listo: false, num: 0, est: '', hechos: {} as Record<number, number>, msgs: new Set<string>(), alertas: new Set<string>() });
  const cb = useRef(onPedido); cb.current = onPedido;

  useEffect(() => {
    const p = prev.current;
    const r = S && S.ronda;
    if (!S || !r) { p.est = ''; return; }
    const h = S.hechos || [];
    const clave = `${r.numero}:${r.estado}`;
    const arranque = () => { if (r.modo === 'chat') fx.splash('Ahora pueden hablar', 'bi-chat-dots-fill'); else fx.splash('A despachar'); fx.sonar('arranque'); fx.vibrar([60, 40, 60]); };
    if (!p.listo || p.num !== r.numero) {
      const primera = !p.listo;
      p.listo = true; p.num = r.numero; p.hechos[r.numero] = h.length;
      p.msgs = new Set((S.mensajes || []).map((m) => m.id)); p.alertas = new Set((S.alertas || []).map((a) => a.id));
      if (!primera && r.estado === 'activa') arranque();
      p.est = clave; return;
    }
    if (clave !== p.est) { if (r.estado === 'activa') arranque(); p.est = clave; }
    const antes = p.hechos[r.numero] || 0;
    if (h.length > antes) {
      const x = h[h.length - 1]; const racha = rachaAhora(h);
      cb.current(x, racha);
      if (x.perfecto) { fx.sonar('perfecto'); fx.vibrar([80, 40, 80, 40, 160]); fx.confeti(racha > 1 ? 60 : 36); }
      else { fx.sonar(x.puntos >= 5 ? 'casi' : 'error'); fx.vibrar(240); }
    }
    p.hechos[r.numero] = h.length;

    const mios = new Set(S.yo.roles);
    const nuevos = (S.mensajes || []).filter((m) => !p.msgs.has(m.id)); nuevos.forEach((m) => p.msgs.add(m.id));
    let k = 0;
    nuevos.filter((m) => !mios.has(m.de)).slice(-3).forEach((m) => {
      const hacia = m.a === 'todos' ? rol : (mios.has(m.a) ? m.a : null);
      if (r.estado === 'activa' && rol && hacia) { volar(m.de, hacia, m.tipo, k++ * 180); fx.sonar('tic'); fx.vibrar(25); }
    });
    const nuevasA = (S.alertas || []).filter((a) => !p.alertas.has(a.id)); nuevasA.forEach((a) => p.alertas.add(a.id));
    if (nuevasA.length) {
      fx.sonar('incidente'); fx.vibrar([180, 70, 180]);
      requestAnimationFrame(() => { const al = document.querySelectorAll('[data-alerta]'); const u = al[al.length - 1]; if (u) { u.classList.remove('sacude'); void (u as HTMLElement).offsetWidth; u.classList.add('sacude'); } });
    }
  }, [S, rol]);
}
