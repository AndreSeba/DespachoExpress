/* Efectos para que el juego se sienta vivo: sonido opcional, vibración, confeti, paquetes que vuelan y avisos.
   Todo usa Bootstrap Icons (sin emojis) y respeta "reducir movimiento". */
(function () {
  'use strict';
  const { el, ic } = DX;
  const quieto = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let sonidoOn = false;
  try { sonidoOn = localStorage.getItem('dx_sonido') === '1'; } catch { /* ignorar */ }
  let audio = null;
  const ctx = () => {
    if (!audio) { try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch { audio = null; } }
    return audio;
  };

  // [frecuencia Hz, duración s, inicio s, forma de onda]
  const SONIDOS = {
    envio: [[660, 0.08, 0], [880, 0.1, 0.07]],
    listo: [[440, 0.1, 0], [660, 0.16, 0.1]],
    tic: [[1200, 0.035, 0]],
    perfecto: [[523, 0.12, 0], [659, 0.12, 0.1], [784, 0.12, 0.2], [1047, 0.3, 0.3]],
    casi: [[523, 0.12, 0], [440, 0.2, 0.12]],
    error: [[220, 0.18, 0, 'sawtooth'], [165, 0.28, 0.15, 'sawtooth']],
    incidente: [[880, 0.1, 0, 'square'], [660, 0.1, 0.14, 'square'], [880, 0.12, 0.28, 'square']],
    arranque: [[440, 0.1, 0], [440, 0.1, 0.25], [440, 0.1, 0.5], [880, 0.35, 0.75]],
    reloj: [[1500, 0.05, 0, 'square']],
  };

  function tono(f, d, t0, forma) {
    const a = ctx(); if (!a) return;
    const o = a.createOscillator(); const g = a.createGain();
    o.type = forma || 'sine'; o.frequency.value = f;
    const t = a.currentTime + t0;
    g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + d + 0.03);
  }

  const fun = (DX.fun = {
    get sonido() { return sonidoOn; },
    alternarSonido() {
      sonidoOn = !sonidoOn;
      try { localStorage.setItem('dx_sonido', sonidoOn ? '1' : '0'); } catch { /* ignorar */ }
      if (sonidoOn) { const a = ctx(); if (a && a.resume) a.resume(); fun.sonar('listo'); }
      return sonidoOn;
    },
    sonar(nombre) { if (!sonidoOn) return; (SONIDOS[nombre] || []).forEach(([f, d, t, forma]) => tono(f, d, t, forma)); },
    vibrar(patron) { try { if (navigator.vibrate) navigator.vibrate(patron); } catch { /* ignorar */ } },

    /** Lluvia de confeti con los colores de la marca. */
    confeti(n = 36) {
      if (quieto) return;
      const colores = ['#E07A2F', '#1F3A5F', '#198754', '#0E9AA7', '#7C4DBA', '#ffc107'];
      const capa = el('div', { class: 'confeti-capa', 'aria-hidden': 'true' });
      document.body.append(capa);
      for (let i = 0; i < n; i++) {
        const p = el('span', { class: 'confeti' });
        const x = Math.random() * 100;
        p.style.cssText = `left:${x}vw;background:${colores[i % colores.length]};width:${6 + Math.random() * 6}px;height:${10 + Math.random() * 8}px`;
        capa.append(p);
        p.animate([
          { transform: 'translate(0,-20px) rotate(0deg)', opacity: 1 },
          { transform: `translate(${(Math.random() - 0.5) * 140}px, ${60 + Math.random() * 40}vh) rotate(${360 + Math.random() * 360}deg)`, opacity: 0.9, offset: 0.85 },
          { transform: `translate(${(Math.random() - 0.5) * 160}px, 105vh) rotate(720deg)`, opacity: 0 },
        ], { duration: 1500 + Math.random() * 1300, delay: Math.random() * 350, easing: 'cubic-bezier(.2,.6,.4,1)', fill: 'forwards' });
      }
      setTimeout(() => capa.remove(), 3600);
    },

    /** Un paquete (icono en círculo) viaja de un elemento a otro. */
    vuelo(desde, hasta, icono, color, retraso = 0) {
      if (quieto || !desde || !hasta) return;
      const a = desde.getBoundingClientRect(); const b = hasta.getBoundingClientRect();
      const p = el('div', { class: 'vuelo', 'aria-hidden': 'true' }, ic(icono));
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
      if (b) { setTimeout(() => hasta.classList && hasta.classList.add('rebote'), 700 + retraso); setTimeout(() => hasta.classList && hasta.classList.remove('rebote'), 1200 + retraso); }
    },

    /** Aviso que cae desde arriba y no bloquea el juego. */
    aviso(nodo, clase, ms = 2600) {
      const prev = document.getElementById('aviso'); if (prev) prev.remove();
      const a = el('div', { id: 'aviso', class: 'aviso ' + (clase || ''), role: 'status' }, nodo);
      document.body.append(a);
      setTimeout(() => { a.classList.add('saliendo'); setTimeout(() => a.remove(), 350); }, ms);
      a.addEventListener('click', () => a.remove());
    },

    /** Texto grande al centro (arranque de ronda). */
    splash(texto, icono) {
      const s = el('div', { class: 'splash', 'aria-hidden': 'true' }, ic(icono || 'bi-lightning-charge-fill', 'splash-ic'), el('div', { class: 'splash-tx' }, texto));
      document.body.append(s); setTimeout(() => s.remove(), 1500);
    },
  });
})();
