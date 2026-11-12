// Efectos: sonido opcional, vibración, confeti, paquetes que vuelan y cuenta de arranque.
// Todo respeta "reducir movimiento" y el sonido empieza apagado.
import { guardado, guardar } from './net';

const quieto = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
let sonidoOn = guardado<number>('dx_sonido') === 1;
let audio: AudioContext | null = null;
const ctx = () => {
  if (!audio) { try { audio = new (window.AudioContext || (window as any).webkitAudioContext)(); } catch { audio = null; } }
  return audio;
};

type Tono = [number, number, number, OscillatorType?];
const SONIDOS: Record<string, Tono[]> = {
  envio: [[660, 0.08, 0], [880, 0.1, 0.07]],
  listo: [[440, 0.1, 0], [660, 0.16, 0.1]],
  tic: [[1200, 0.035, 0]],
  perfecto: [[523, 0.12, 0], [659, 0.12, 0.1], [784, 0.12, 0.2], [1047, 0.3, 0.3]],
  casi: [[523, 0.12, 0], [440, 0.2, 0.12]],
  error: [[220, 0.18, 0, 'sawtooth'], [165, 0.28, 0.15, 'sawtooth']],
  incidente: [[880, 0.1, 0, 'square'], [660, 0.1, 0.14, 'square'], [880, 0.12, 0.28, 'square']],
  arranque: [[440, 0.1, 0], [440, 0.1, 0.25], [440, 0.1, 0.5], [880, 0.35, 0.75]],
  reloj: [[1500, 0.05, 0, 'square']],
  bocina: [[330, 0.12, 0, 'square'], [392, 0.3, 0.12, 'square']],
};
function tono([f, d, t0, forma]: Tono) {
  const a = ctx(); if (!a) return;
  const o = a.createOscillator(); const g = a.createGain();
  o.type = forma || 'sine'; o.frequency.value = f;
  const t = a.currentTime + t0;
  g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + d + 0.03);
}

export const fx = {
  get sonido() { return sonidoOn; },
  alternarSonido() {
    sonidoOn = !sonidoOn; guardar('dx_sonido', sonidoOn ? 1 : 0);
    if (sonidoOn) { const a = ctx(); if (a && a.resume) a.resume(); fx.sonar('listo'); }
    return sonidoOn;
  },
  sonar(nombre: keyof typeof SONIDOS | string) { if (sonidoOn) (SONIDOS[nombre] || []).forEach(tono); },
  vibrar(patron: number | number[]) { try { navigator.vibrate?.(patron); } catch { /* ignorar */ } },

  confeti(n = 36) {
    if (quieto) return;
    const colores = ['#d2232a', '#6b4a2e', '#f2b84b', '#16a36a', '#8a6240', '#e5483f'];
    const capa = document.createElement('div'); capa.className = 'confeti-capa'; capa.setAttribute('aria-hidden', 'true');
    document.body.append(capa);
    for (let i = 0; i < n; i++) {
      const p = document.createElement('span'); p.className = 'confeti';
      p.style.cssText = `left:${Math.random() * 100}vw;background:${colores[i % colores.length]};width:${6 + Math.random() * 6}px;height:${10 + Math.random() * 8}px`;
      capa.append(p);
      p.animate([
        { transform: 'translate(0,-20px) rotate(0deg)', opacity: 1 },
        { transform: `translate(${(Math.random() - 0.5) * 140}px, ${60 + Math.random() * 40}vh) rotate(${360 + Math.random() * 360}deg)`, opacity: 0.9, offset: 0.85 },
        { transform: `translate(${(Math.random() - 0.5) * 160}px, 105vh) rotate(720deg)`, opacity: 0 },
      ], { duration: 1500 + Math.random() * 1300, delay: Math.random() * 350, easing: 'cubic-bezier(.2,.6,.4,1)', fill: 'forwards' });
    }
    setTimeout(() => capa.remove(), 3600);
  },

  /** Un paquete viaja de un elemento a otro. */
  vuelo(desde: Element | null, hasta: Element | null, icono: string, color?: string, retraso = 0) {
    if (quieto || !desde || !hasta) return;
    const a = desde.getBoundingClientRect(); const b = hasta.getBoundingClientRect();
    const p = document.createElement('div'); p.className = 'vuelo'; p.setAttribute('aria-hidden', 'true');
    p.innerHTML = `<i class="bi ${icono}"></i>`;
    p.style.left = `${a.left + a.width / 2}px`; p.style.top = `${a.top + a.height / 2}px`; p.style.background = color || '#E07A2F';
    document.body.append(p);
    const dx = b.left + b.width / 2 - (a.left + a.width / 2); const dy = b.top + b.height / 2 - (a.top + a.height / 2);
    const an = p.animate([
      { transform: 'translate(-50%,-50%) scale(.5)', opacity: 0 },
      { transform: 'translate(-50%,-50%) scale(1.15)', opacity: 1, offset: 0.15 },
      { transform: `translate(calc(-50% + ${dx / 2}px), calc(-50% + ${dy / 2 - 36}px)) scale(1.25)`, opacity: 1, offset: 0.55 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.7)`, opacity: 0.1 },
    ], { duration: 760, delay: retraso, easing: 'ease-in-out', fill: 'both' });
    an.onfinish = () => p.remove();
    setTimeout(() => hasta.classList.add('rebote'), 700 + retraso);
    setTimeout(() => hasta.classList.remove('rebote'), 1200 + retraso);
  },

  /** Cuenta de arranque a pantalla completa. */
  splash(texto: string, icono = 'bi-lightning-charge-fill') {
    const s = document.createElement('div'); s.className = 'splash'; s.setAttribute('aria-hidden', 'true');
    s.innerHTML = `<div style="text-align:center"><i class="bi ${icono}" style="font-size:5rem;color:#f0954f"></i><div style="font-size:2.6rem;font-weight:800;letter-spacing:-.02em;margin-top:.5rem"></div></div>`;
    (s.querySelector('div > div') as HTMLElement).textContent = texto;
    document.body.append(s); setTimeout(() => s.remove(), 1500);
  },
};
