# Despacho Express

Juego cooperativo para practicar la comunicación **entre compañeros** en una cadena de despacho
(Planificación de despachos → Inventarios → Almacén → Transporte → Seguridad → Operativo).

## Definición
- **Problema que ataca:** la comunicación entre compañeros no es fluida (hallazgo preliminar del equipo).
- **Duración:** 30 minutos, 2 rondas.
 1. **Ronda 1, solo hacia adelante:** cada uno ve sus datos 8 segundos y se ocultan; escribe de memoria una nota al siguiente (una sola vez por pedido), sin poder preguntar.
 2. **Ronda 2, conversar y confirmar:** los datos también se ven unos segundos; cada uno publica una nota que todos ven, puede hablar directo con alguien o con todos, y el *eco* (repetir lo entendido) permite corregir.
- **Qué se llevan:** la tarjeta de traspaso, la regla del eco y un compromiso personal.
- **Qué mide:** puntos, datos errados, mensajes y correcciones por eco, ronda contra ronda.
- **Límites:** simulación con pocas personas y sin grupo de comparación. La tarjeta y el eco son propuestas de diseño del equipo; los casos son ficticios.

## Tres formas de usarlo
| Forma | Qué es | Cómo |
|---|---|---|
| **Demo en HTML** | Un solo archivo; juegas solo con compañeros simulados. | Abre `demo/index.html` en el navegador o súbelo a un hosting estático. |
| **Sistema multijugador** | Cada participante en su celular y la facilitadora en el panel. | `pnpm install`, `pnpm build` y `pnpm start`; luego abre `/host`. |
| **Multijugador con bots** | Para probar el panel sin 6 personas. | En el panel, botón *Completar con bots*. |

## Panel de la facilitadora (`/host`)
Pensado para mirar y tocar, con poco texto:
- **Código de sala** grande; al tocarlo se copia el enlace para los jugadores.
- **Equipo:** 6 tarjetas de rol con el apodo, si es persona o bot, y si está conectado. Tocar un rol abre su historial.
- **Recorrido en vivo:** la cadena de 6 eslabones con paquetes que viajan cuando alguien envía una nota (), tarjeta (), eco () o corrección (). Cada eslabón muestra su dato en verde (correcto), amarillo (desactualizado) o rojo (errado). Los incidentes destellan en el dueño del dato.
- **Reloj, ronda y pedidos:** anillo de tiempo, puntos y un círculo por pedido (verde si es perfecto, naranja si tiene errores, pulsando el actual). Tocar un círculo inspecciona ese pedido.
- **Recorrido de cada dato:** cuadrícula de 7 datos por 6 eslabones y el envío final; / / ↺ para ver dónde se perdió o cambió cada dato.
- **Actividad:** línea de tiempo con iconos.
- **Formulario de satisfacción:** cuando termina el juego, el panel muestra cuántos respondieron, el promedio y la distribución de cada afirmación (barras de colores) y las respuestas abiertas, sin identificar a nadie.
- **Comparar:** ronda 1 frente a ronda 2 con barras, mapas de aciertos por pedido y el campo más errado.
- **Controles:** ▶ iniciar ronda, incidente (o automático), ⏹ cerrar, ↺ nueva partida, ⬇ CSV, y ajustes de duración y número de pedidos.

## Para que sea divertido (jugadores)
- **Resultado al instante:** cada pedido enviado avisa a todo el equipo con sus puntos, la racha de pedidos perfectos y qué dato falló (sin revelar el valor real).
- **Marcador vivo:** un círculo por pedido, racha y puntos.
- **Paquetes que vuelan** entre eslabones cuando alguien envía una nota, tarjeta o eco.
- **Reloj con urgencia:** barra de tiempo y latido en el último minuto.
- **Camión que sigue el recorrido:** en el celular y en el panel, un camión avanza por la ruta a medida que cada eslabón comunica su dato, llega a la meta al enviarse el despacho y sale de nuevo en el pedido siguiente. También sirve de pantalla de carga: avanza con cada persona que entra a la sala y con cada una que toca "Listo". Al tocarlo suena la bocina.
- **Cuenta de arranque, confeti y vibración** en el celular. El sonido está apagado por defecto (botón de altavoz arriba).
- **Al terminar la ronda:** hasta 3 estrellas e insignias (todo perfecto, racha, correcciones a tiempo, más puntos que la ronda anterior). Son un juego: no prueban una mejora real.

## Formulario de satisfacción (anónimo)
Al terminar el juego, cada participante responde desde su celular 8 afirmaciones (escala de 1 a 5) y 3 preguntas abiertas.
- No se guarda quién dio cada respuesta, solo un registro de quién ya respondió para evitar duplicados.
- Las respuestas abiertas se muestran en orden alfabético, para no revelar el orden en que llegaron.
- Los bots no responden. Los resultados se incluyen en el CSV, sin nombres.

## Cómo se juega (jugadores, desde el celular)
1. Abren el enlace o escriben el código de 4 letras y un apodo (no el nombre real).
2. Reciben un rol y solo ven su parte del pedido.
3. **Ronda 1:** memorizan sus datos (8 segundos), escriben una nota al siguiente eslabón y la envían una sola vez. El operativo lee la nota y arma el despacho.
4. **Ronda 2:** memorizan sus datos (8 segundos), publican su nota (la ven todos), conversan por mensajes directos o para todos, y el operativo lee el eco para que cada dueño corrija lo que esté mal.
- Con menos de 6 personas, cada una toma varios roles; las que sobran entran como observadoras.

## Despliegue
**Local (sin internet, por WiFi):** en la laptop, `pnpm install && pnpm build && pnpm start`. Los celulares abren `http://IP-DE-LA-LAPTOP:3000`.

**En línea (Render, plan gratis):** crear un *Web Service* con estos valores (o usar `render.yaml`):
- Root Directory: `despacho-express` (solo si el repositorio tiene el juego dentro de esa carpeta)
- Build Command: `pnpm install --frozen-lockfile --prod=false && pnpm build` · Start Command: `node server.js` · Health check: `/health`

Avisos del plan gratis: el servicio se duerme tras un rato sin uso y tarda cerca de un minuto en despertar (ábrelo antes de empezar), y las salas viven en memoria, así que se pierden si se reinicia. No se guarda nada en disco; al terminar, descarga el CSV.

## Privacidad
Apodos, no nombres reales. Nada se guarda en el servidor salvo la partida en memoria. Las salas se borran tras 6 horas sin actividad.

## Tecnología
- **Interfaz:** React 19 + TypeScript + Vite + Tailwind CSS 4 + Framer Motion, en `web/`. Dos páginas: jugador (`/`) y panel (`/host`). Íconos de Bootstrap Icons, tipografía Plus Jakarta Sans (todo local, sin CDN).
- **Servidor:** Node 22 con `ws` (`server.js`, `lib/`). Sirve la interfaz compilada de `dist/`; si no existe, sirve la versión anterior de `public/`.
- **Desarrollo:** `pnpm start` (servidor en 3000) y, en otra terminal, `pnpm dev` (interfaz con recarga en 5173, enlazada al servidor). `pnpm typecheck` revisa los tipos.

## Pruebas
- `pnpm test`: lógica del juego y bots.
- `node test/e2e.mjs`: panel + jugador humano en celular + bots, con capturas (`SHOTS=/ruta`).
- `node test/demo-e2e.mjs`: la demo de un solo archivo en un celular simulado.
