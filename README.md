# Despacho Express

Juego cooperativo para practicar la comunicación **entre compañeros** en una cadena de despacho
(atención al cliente → planificación → almacén → transporte → seguridad → operativo).

## Definición
- **Problema que ataca:** la comunicación entre compañeros no es fluida (hallazgo preliminar del equipo).
- **Duración:** 30 minutos, 2 rondas.
  1. **Ronda 1, solo hacia adelante:** notas en una sola dirección, sin poder preguntar.
  2. **Ronda 2, conversar y confirmar:** tarjeta de traspaso (qué, cuándo, quién, riesgo, confirmación) y *eco* (repetir lo entendido).
- **Qué se llevan:** la tarjeta de traspaso, la regla del eco y un compromiso personal.
- **Qué mide:** puntos, datos errados, datos perdidos en la cadena y correcciones por eco, ronda contra ronda.
- **Límites:** es una simulación con pocas personas y sin grupo de comparación. La tarjeta y el eco son propuestas de diseño del equipo; los casos son ficticios.

## Demo en HTML (lista para usar)
`demo/index.html` es un solo archivo, sin instalación ni servidor. Se juega solo, con compañeros simulados, y es responsive para celular.

- **Probarla:** abre `demo/index.html` en el navegador (o súbela a cualquier hosting estático: GitHub Pages, Netlify Drop, etc.).
- **Parámetros útiles:** `?seed=123` (partida reproducible) y `?fast=1` (sin pausas, para pruebas).
- **Prueba automática (celular simulado):** `npm install` y luego `node test/demo-e2e.mjs`.

## Versión multijugador (en construcción)
`server.js` y `lib/game.js` contienen la lógica y el servidor WebSocket para que cada participante juegue desde su celular
con un código de sala. Aún falta la interfaz de jugador y de facilitadora, y las pruebas.
