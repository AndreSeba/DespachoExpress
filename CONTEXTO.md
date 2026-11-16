# Despacho Express: contexto del proyecto

Documento para retomar el trabajo en un chat nuevo. Resume qué es el proyecto, las reglas, cómo está hecho, dónde está publicado y qué falta.

## 1. Qué es

Juego cooperativo en tiempo real para un taller de **Liderazgo y Dinámica de Grupos** (caso Nestlé Bolivia, área de Logística y Distribución).

- **Problema que ataca:** la comunicación entre compañeros no es fluida.
- **Idea:** seis eslabones de una cadena de despacho; cada uno conoce una parte del pedido y, si la información se pierde o cambia, el despacho sale mal.
- **Duración:** 30 minutos, 2 rondas, más un formulario de satisfacción anónimo al final.
- **Es la única actividad del taller.**
- **Qué mide:** puntos, datos errados, mensajes y correcciones, ronda contra ronda. Es una simulación con pocas personas y sin grupo de comparación: no prueba una mejora real. Los datos son ficticios.

## 2. Reglas del proyecto (no romper)

- Todo en **español**.
- **Sin emojis**: solo Bootstrap Icons.
- Poco texto y muy visual.
- Los roles se asignan **al azar** y nunca coinciden con el cargo que el jugador declara.
- La comunicación es **entre compañeros**; no se menciona al jefe.
- Se dice **"muelle"**, no "andén" (en pantalla; el identificador interno sigue siendo `anden`).
- Productos solo de **Nestlé y Fagal (Mabel's)**: Nescafé, Nido, Milo, Nesquik, Maggi, Mabel's Rosquitas, Cremositas, Wafer y Surtidas. Conviene confirmar que existen en Bolivia.
- Apodos, no nombres reales. El formulario es anónimo.

Reglas del usuario para el trabajo:
- **Nunca usar `npm` ni `npx`.** Siempre `pnpm` (`pnpm install`, `pnpm add`, `pnpm exec`, `pnpm dlx`, `pnpm run`). No generar `package-lock.json`. No habilitar scripts de instalación de dependencias en general.
- **Commits y PR sin firma de Claude** (nada de `Co-Authored-By`). El autor debe ser AndreSeba, sin aparecer como colaborador de Claude.
- Pedir permiso antes de hacer push, publicar o borrar.

## 3. Cómo se juega

Roles (en orden de la cadena) y datos que conoce cada uno:

| Eslabón | Datos |
|---|---|
| Planificación de despachos | destino, horario |
| Inventarios | producto, cantidad |
| Almacén | muelle |
| Transporte | unidad |
| Seguridad | restricción |
| Operativo | ninguno: arma y envía el despacho |

Con menos de 6 personas, cada una toma varios roles; las que sobran son observadoras. Máximo 14 jugadores.

**Ronda 1, solo hacia adelante:** cada uno ve sus datos 8 segundos y se ocultan; escribe de memoria una nota al siguiente eslabón, **una sola vez por pedido**. No se puede preguntar ni corregir. El Operativo lee la nota que le llega y rellena los 7 datos a mano.

**Ronda 2, conversar y confirmar:** los datos también se ocultan a los 8 segundos. Cada uno publica una nota que **ven todos** (hay un tablero "Notas de todos"), puede **hablar directo** con una persona o con todos, y el Operativo lee el **eco** (repite lo entendido) para que cada dueño corrija.

**Puntaje:** cada dato correcto suma 1; si los 7 están bien, bonus de 3 (máximo 10 por pedido). Por defecto 4 pedidos por ronda y 7 minutos, ajustable en el panel.

**Incidentes: desactivados en el panel** por falta de tiempo en el taller. La lógica sigue en el servidor (`lanzarIncidente` y los textos de producto dañado, refacturación y unidad observada, que son los problemas más comunes del caso real) y se puede reactivar devolviendo el botón "Incidente" a `web/src/host/Host.tsx`.

**Compuerta "Listo":** la ronda no arranca hasta que todos los humanos conectados tocan Listo, o hasta que la facilitadora pulsa "Empezar ya".

**Camión:** en el celular y en el panel, un camión avanza por la ruta a medida que cada eslabón comunica su dato, llega a la meta al enviarse el despacho y sale de nuevo en el pedido siguiente. También es la pantalla de carga de la sala y del "Listo". Al tocarlo suena la bocina.

## 4. Tecnología

- **Servidor:** Node 22, HTTP + WebSocket (`ws`). Un solo proceso, sin base de datos: las salas viven en memoria (se borran tras 6 horas sin actividad).
  - `server.js`: HTTP estático, WebSocket, exportación CSV.
  - `lib/game.js`: lógica del juego (salas, rondas, puntaje, encuesta, snapshot por jugador).
  - `lib/bots.js`: jugadores simulados.
- **Interfaz** (carpeta `web/`): React 19 + TypeScript + Vite + Tailwind 4 + Framer Motion. Dos páginas: jugador (`/`) y panel de la facilitadora (`/host`). Íconos Bootstrap Icons y tipografía Plus Jakarta Sans, todo local (sin CDN, por el CSP). Paleta clara cálida (crema, café, rojo) inspirada en Nestlé y Mabel's, aproximada, no oficial.
  - `web/src/player/`: pantallas del jugador (`App`, `Pantallas`, `Juego`, `Resultado`, `useEfectos`).
  - `web/src/host/`: panel (`Host`, `Vivo`, `Comparar`, `calc`).
  - `web/src/lib/`: componentes y utilidades compartidas (`Camion`, `ui`, `fx`, `net`, `constants`, `types`).
- `public/`: la interfaz anterior (Bootstrap). El servidor la usa solo si no existe `dist/`.
- `demo/index.html`: demo de un solo archivo; conserva el diseño y la ronda 1 antiguos.
- El servidor sirve `dist/` (resultado de `pnpm build`).

Comunicación: el cliente manda mensajes `{t: ...}` por WebSocket (`unirse`, `msg`, `pedido`, `listo`, `encuesta`; del panel: `iniciar`, `empezar`, `bots`, `cerrar`, `reiniciar`, `config`) y recibe `estado` con un snapshot filtrado según quién pregunta (cada jugador solo ve sus datos y los mensajes que le tocan).

## 5. Comandos

```bash
pnpm install            # dependencias
pnpm build              # compila la interfaz a dist/
pnpm start              # servidor en el puerto 3000 (abrir /host)
pnpm dev                # interfaz con recarga en 5173 (con el servidor corriendo)
pnpm typecheck          # revisa tipos
pnpm test               # 23 pruebas de la lógica y los bots
node test/e2e.mjs       # panel + jugador en celular + bots (SHOTS=/ruta guarda capturas)
node test/demo-e2e.mjs  # la demo de un solo archivo
```

## 6. Dónde está publicado

- **Repositorio del juego:** https://github.com/AndreSeba/DespachoExpress (rama `main`; el juego está en la raíz).
- **Repositorio de trabajo:** `conteof` (carpeta `despacho-express/`). La rama local `ds-split` es la que se sube a `DespachoExpress`. Se sube con una copia en un worktree y `git push https://github.com/AndreSeba/DespachoExpress.git ds-split:main`.
- **Producción:** https://despacho-express.onrender.com (servicio `srv-dbp927jbc2fs739gsshg`, plan gratis, autodeploy desde `main`). El plan gratis se duerme: abrir `/host` 5 a 10 minutos antes del taller.
- **Truco importante:** el Build Command de Render **no** corre `pnpm build`, así que `dist/` está **versionado a propósito** en `DespachoExpress`. Cada cambio visual necesita `pnpm build` y subir `dist/` junto con el código. Si se cambia el Build Command en el panel de Render a `pnpm install --frozen-lockfile --prod=false && pnpm build`, ya no hace falta versionar `dist/`. Nada de `corepack enable` en Render (el sistema de archivos es de solo lectura).
- Local: `render.yaml` y `Dockerfile` (dos etapas) ya reflejan el build nuevo.

## 7. Documentos

- `README.md`: resumen, formas de uso, despliegue, pruebas.
- `MANUAL.md` y `MANUAL.pdf`: manual completo con capturas reales (`docs/manual/`). El PDF se genera desde el `.md`.
- `CONTEXTO.md`: este archivo.

## 8. Estado actual

Hecho y en producción: juego multijugador completo, panel de la facilitadora, bots, formulario anónimo con resultados, CSV, interfaz nueva, camión, ronda 1 con datos que se ocultan y nota escrita a mano, ronda 2 con notas de todos y conversación, aviso claro de que ahora sí se puede hablar, productos de Nestlé y Fagal, manual en PDF. Verificado con 23 pruebas y el recorrido completo en navegador (sin errores); en producción solo se comprobó que las páginas cargan.

## 9. Pendientes

- Probar una partida completa en producción.
- Ensayo con 6 personas.
- Actualizar la presentación del equipo y revisar referencias del informe y el nombre de la materia en la portada.
- Cambiar el Build Command y el Health Check Path (`/health`) en el panel de Render.
- Opcionales: ronda de práctica guiada, vista de proyector, pausa, cuenta regresiva, actualizar la demo de un solo archivo.
- Confirmar colores oficiales de la marca (hoy son aproximados) y que los productos existan en Bolivia.

## 10. Cosas que conviene recordar

- Los archivos usan finales de línea CRLF en algunas partes; al editar por script, normalizar.
- Una nota escrita a mano se interpreta en el servidor (`extraerDatos`): un dato mal escrito no se reconoce y se pierde, es parte del aprendizaje.
- El resultado de cada pedido que ve el equipo solo dice qué campos fallaron, nunca el valor real.
- Las capturas del manual salen de `node test/e2e.mjs` con `SHOTS=<carpeta>`.
