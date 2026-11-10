# Despacho Express

Juego cooperativo para practicar la comunicación **entre compañeros** en una cadena de despacho
(Planificación de despachos → Inventarios → Almacén → Transporte → Seguridad → Operativo).

## Definición
- **Problema que ataca:** la comunicación entre compañeros no es fluida (hallazgo preliminar del equipo).
- **Duración:** 30 minutos, 2 rondas.
 1. **Ronda 1, solo hacia adelante:** notas en una sola dirección, sin poder preguntar.
 2. **Ronda 2, conversar y confirmar:** tarjeta de traspaso (qué, cuándo, quién, riesgo, confirmación) y *eco* (repetir lo entendido).
- **Qué se llevan:** la tarjeta de traspaso, la regla del eco y un compromiso personal.
- **Qué mide:** puntos, datos errados, mensajes y correcciones por eco, ronda contra ronda.
- **Límites:** simulación con pocas personas y sin grupo de comparación. La tarjeta y el eco son propuestas de diseño del equipo; los casos son ficticios.

## Tres formas de usarlo
| Forma | Qué es | Cómo |
|---|---|---|
| **Demo en HTML** | Un solo archivo; juegas solo con compañeros simulados. | Abre `demo/index.html` en el navegador o súbelo a un hosting estático. |
| **Sistema multijugador** | Cada participante en su celular y la facilitadora en el panel. | `npm install` y `npm start`; luego abre `/host`. |
| **Multijugador con bots** | Para probar el panel sin 6 personas. | En el panel, botón *Completar con bots*. |

## Panel de la facilitadora (`/host`)
Pensado para mirar y tocar, con poco texto:
- **Código de sala** grande; al tocarlo se copia el enlace para los jugadores.
- **Equipo:** 6 tarjetas de rol con el apodo, si es persona o bot, y si está conectado. Tocar un rol abre su historial.
- **Recorrido en vivo:** la cadena de 6 eslabones con paquetes que viajan cuando alguien envía una nota (), tarjeta (), eco () o corrección (). Cada eslabón muestra su dato en verde (correcto), amarillo (desactualizado) o rojo (errado). Los incidentes destellan en el dueño del dato.
- **Reloj, ronda y pedidos:** anillo de tiempo, puntos y un círculo por pedido (verde si es perfecto, naranja si tiene errores, pulsando el actual). Tocar un círculo inspecciona ese pedido.
- **Recorrido de cada dato:** cuadrícula de 7 datos por 6 eslabones y el envío final; / / ↺ para ver dónde se perdió o cambió cada dato.
- **Actividad:** línea de tiempo con iconos.
- **Comparar:** ronda 1 frente a ronda 2 con barras, mapas de aciertos por pedido y el campo más errado.
- **Controles:** ▶ iniciar ronda, incidente (o automático), ⏹ cerrar, ↺ nueva partida, ⬇ CSV, y ajustes de duración y número de pedidos.

## Cómo se juega (jugadores, desde el celular)
1. Abren el enlace o escriben el código de 4 letras y un apodo (no el nombre real).
2. Reciben un rol y solo ven su parte del pedido.
3. **Ronda 1:** eligen qué datos pasar en una nota al siguiente eslabón. El operativo arma el despacho.
4. **Ronda 2:** publican su tarjeta; el operativo lee el eco y cada dueño corrige lo que esté mal.
- Con menos de 6 personas, cada una toma varios roles; las que sobran entran como observadoras.

## Despliegue
**Local (sin internet, por WiFi):** en la laptop, `npm install && npm start`. Los celulares abren `http://IP-DE-LA-LAPTOP:3000`.

**En línea (Render, plan gratis):** crear un *Web Service* con estos valores (o usar `render.yaml`):
- Root Directory: `despacho-express`
- Build Command: `npm install` · Start Command: `npm start` · Health check: `/health`

Avisos del plan gratis: el servicio se duerme tras un rato sin uso y tarda cerca de un minuto en despertar (ábrelo antes de empezar), y las salas viven en memoria, así que se pierden si se reinicia. No se guarda nada en disco; al terminar, descarga el CSV.

## Privacidad
Apodos, no nombres reales. Nada se guarda en el servidor salvo la partida en memoria. Las salas se borran tras 6 horas sin actividad.

## Pruebas
- `npm test`: lógica del juego y bots.
- `node test/e2e.mjs`: panel + jugador humano en celular + bots, con capturas (`SHOTS=/ruta`).
- `node test/demo-e2e.mjs`: la demo de un solo archivo en un celular simulado.
