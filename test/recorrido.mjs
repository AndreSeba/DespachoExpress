// Partida de prueba con 6 jugadores (uno por rol) y la facilitadora, para mostrar qué ve y hace cada rol.
// Uso: SHOTS=/ruta node test/recorrido.mjs   (guarda capturas y manifiesto.json)
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const { server } = require('../server.js');
const OUT = process.env.SHOTS || './recorrido';
fs.mkdirSync(OUT, { recursive: true });

const ORDEN = ['planificacion', 'inventarios', 'almacen', 'transporte', 'seguridad', 'operativo'];
const NOMBRE = { planificacion: 'Planificación de despachos', inventarios: 'Inventarios', almacen: 'Almacén', transporte: 'Transporte', seguridad: 'Seguridad', operativo: 'Operativo' };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const manifiesto = [];

await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}`;
const browser = await chromium.launch();

// ---- Facilitadora
const hctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const host = await hctx.newPage();
await host.goto(base + '/host');
await host.waitForFunction(() => /^[A-Z]{4}$/.test(document.getElementById('codigo')?.textContent || ''));
const code = await host.locator('#codigo').textContent();
await host.click('[aria-label="Menos pedidos"]'); await host.click('[aria-label="Menos pedidos"]'); // 2 pedidos por ronda

async function fotoPanel(nombre, titulo, texto) {
  const archivo = `${nombre}.png`;
  await host.screenshot({ path: `${OUT}/${archivo}` });
  manifiesto.push({ rol: 'panel', titulo, texto, archivo });
}

// ---- Seis jugadores
const pages = [];
for (let i = 0; i < 6; i++) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const p = await ctx.newPage();
  await p.goto(`${base}/?c=${code}`);
  await p.addStyleTag({ content: 'header.sticky{position:static!important}' });
  await p.fill('#nombreIn', `Jugador ${i + 1}`);
  await p.click('#entrarBtn');
  await p.waitForSelector('text=Esperando a que empiece');
  pages.push(p);
}
await host.waitForTimeout(500);
await fotoPanel('panel-01-sala', 'La sala con los 6 jugadores', 'La facilitadora ve quién entró. Los roles se reparten al azar al empezar.');

await host.click('[data-accion="iniciar"]');
await Promise.all(pages.map((p) => p.waitForSelector('#entendidoBtn')));
const porRol = {};
for (const p of pages) {
  const t = (await p.locator('#tRol').textContent()).trim();
  const rol = ORDEN.find((r) => t.includes(NOMBRE[r]));
  porRol[rol] = p;
}
console.log('roles:', Object.keys(porRol).join(', '));

/** Captura una franja de la pantalla del jugador desde el elemento indicado. */
async function foto(rol, nombre, selector, titulo, texto, alto = 700, conAviso = false) {
  const p = porRol[rol];
  await p.evaluate((ocultar) => {
    document.querySelectorAll('.splash,.confeti-capa').forEach((e) => e.remove()); // los crea fx.ts, no React
    let st = document.getElementById('oculta-aviso');
    if (!st) { st = document.createElement('style'); st.id = 'oculta-aviso'; document.head.append(st); }
    st.textContent = ocultar ? '.aviso{display:none!important}' : '';
    window.scrollTo(0, 0);
  }, !conAviso);
  let y = 0;
  if (selector) { const b = await p.locator(selector).first().boundingBox(); if (b) y = Math.max(0, b.y - 80); }
  const archivo = `${rol}-${nombre}.png`;
  await p.screenshot({ path: `${OUT}/${archivo}`, fullPage: true, clip: { x: 0, y, width: 390, height: alto } });
  manifiesto.push({ rol, titulo, texto, archivo });
}

// ---- Pantalla previa de la ronda 1
for (const rol of ORDEN) await foto(rol, 'r1-0-previa', null, 'Antes de empezar', 'Aparece el rol que te tocó, la cadena y las reglas de la ronda. Tocas "Listo".', 900);
await host.waitForSelector('#preparando');
await fotoPanel('panel-02-listo', 'Esperando que todos toquen "Listo"', 'El camión avanza con cada persona lista. Si hace falta, la facilitadora pulsa "Empezar ya".');
await Promise.all(ORDEN.map((r) => porRol[r].click('#entendidoBtn')));
await host.waitForSelector('#ringTx');

const valoresDe = async (rol) => porRol[rol].locator('section:has-text("Memoriza tus datos") .dato').allInnerTexts();
const optionTexts = async (rol, campo) => porRol[rol].locator(`select[data-campo="${campo}"] option`).allInnerTexts();

async function pedidoRonda1(n) {
  await Promise.all(ORDEN.slice(0, 5).map((r) => porRol[r].waitForSelector(`section:has-text("Memoriza tus datos")`)));
  const datos = {};
  for (const r of ORDEN.slice(0, 5)) datos[r] = (await valoresDe(r)).map((t) => t.trim());
  if (n === 1) {
    for (const r of ORDEN.slice(0, 5)) await foto(r, 'r1-1-memoriza', 'section:has-text("Memoriza tus datos")', 'Ronda 1: memoriza tus datos', `Ves tus datos ${'8'} segundos (${datos[r].join(', ')}). Una barra muestra cuánto queda.`);
    await foto('operativo', 'r1-1-espera', 'section:has-text("Arma el despacho")', 'Ronda 1: esperas la nota', 'El Operativo no tiene datos propios: espera la nota del último eslabón.');
  }
  await espera(8800);
  if (n === 1) for (const r of ORDEN.slice(0, 5)) await foto(r, 'r1-2-oculto', 'section:has-text("Datos ocultos")', 'Ronda 1: los datos se ocultan', 'Ya no se ven. Hay que escribirlos de memoria en la nota para el siguiente eslabón.');
  let acumulado = '';
  for (let i = 0; i < 5; i++) {
    const rol = ORDEN[i]; const p = porRol[rol];
    if (i > 0) await p.waitForSelector('section:has-text("Escribe tu nota") .nota-papel');
    let propios = datos[rol].join(', ');
    if (n === 2 && rol === 'almacen') propios = (await optionTexts('operativo', 'anden')).slice(1).filter((t) => t !== datos[rol][0])[0]; // se equivoca a propósito
    const nota = [acumulado, propios].filter(Boolean).join(', ');
    acumulado = nota;
    await p.fill('#notaTxt', nota);
    if (n === 1) await foto(rol, 'r1-3-nota', 'section:has-text("Escribe tu nota")', 'Ronda 1: escribes tu nota', i === 0 ? 'Escribes tus datos de memoria y la envías al siguiente eslabón.' : 'Arriba ves la nota que te pasó el eslabón anterior. Agregas tus datos y la envías. Solo se envía una vez.', 800);
    await p.click('button:has-text("Enviar a")');
    await p.waitForSelector('text=Solo se envía una vez.', { timeout: 5000 }).catch(() => {});
    if (n === 1 && i === 2) { await espera(700); await fotoPanel('panel-03-r1-camion', 'Ronda 1 en vivo', 'El camión avanza un tramo por cada eslabón que ya envió su nota. Los paquetes viajan entre eslabones.'); }
    if (n === 1) { await espera(400); await foto(rol, 'r1-4-enviada', 'section:has-text("Tu nota")', 'Ronda 1: nota enviada', 'La nota queda enviada y ya no se puede cambiar ni reenviar en este pedido.', 800); }
  }
  const op = porRol.operativo;
  await op.waitForSelector('section:has-text("Arma el despacho") .nota-papel');
  const notaFinal = (await op.locator('section:has-text("Arma el despacho") .nota-papel').first().innerText()).toLowerCase();
  for (const campo of ['producto', 'cantidad', 'anden', 'unidad', 'restriccion', 'destino', 'horario']) {
    const opts = (await optionTexts('operativo', campo)).slice(1);
    const hallada = opts.find((o) => notaFinal.includes(o.toLowerCase())) || opts[0];
    await op.selectOption(`select[data-campo="${campo}"]`, hallada);
  }
  if (n === 1) await foto('operativo', 'r1-5-despacho', 'section:has-text("Arma el despacho")', 'Ronda 1: el Operativo arma el despacho', 'Lee la nota que le llegó y elige a mano los 7 datos. Si falta uno o está mal escrito, se pierde puntaje.', 1500);
  await op.click('button:has-text("Enviar despacho")');
  if (n === 1) { await porRol.seguridad.waitForSelector('.aviso', { state: 'attached' }); await foto('seguridad', 'r1-6-resultado', null, 'Ronda 1: resultado del pedido', 'Todo el equipo ve al instante los puntos del pedido y qué datos fallaron, sin ver los valores reales.', 360, true); await fotoPanel('panel-04-r1-resultado', 'Un pedido entregado', 'El camión llega a la meta ("Pedido 1 entregado") y el panel marca el pedido en verde o amarillo.'); }
}
await pedidoRonda1(1);
await porRol.operativo.waitForFunction(() => /Pedido 2\/2/.test(document.getElementById('tPed')?.textContent || ''));
await pedidoRonda1(2);

await host.waitForSelector('[data-accion="iniciar"]', { timeout: 60000 });
await espera(500);
for (const rol of ['seguridad']) await foto(rol, 'r1-7-fin', null, 'Fin de la ronda 1', 'Resultado, "dónde se perdió información" y logros. El camino de cada dato se ve en el panel.', 1500);
await fotoPanel('panel-05-entre-rondas', 'Entre rondas', 'La facilitadora revisa cómo se perdió la información y empieza la ronda 2.');

// ---- Ronda 2
await host.click('[data-accion="iniciar"]');
await Promise.all(pages.map((p) => p.waitForSelector('#entendidoBtn')));
await foto('almacen', 'r2-0-previa', '#avisoHablar', 'Ronda 2: ahora sí pueden hablar', 'La pantalla previa avisa que cambia la forma de comunicarse: pueden preguntar, confirmar y corregir.', 800);
await Promise.all(ORDEN.map((r) => porRol[r].click('#entendidoBtn')));
await host.waitForSelector('#ringTx');

async function pedidoRonda2(n) {
  await Promise.all(ORDEN.slice(0, 5).map((r) => porRol[r].waitForSelector('section:has-text("Memoriza tus datos")')));
  const datos = {};
  for (const r of ORDEN.slice(0, 5)) datos[r] = (await valoresDe(r)).map((t) => t.trim());
  if (n === 1) await foto('transporte', 'r2-1-memoriza', '#avisoHablar', 'Ronda 2: tus datos y el aviso para hablar', 'Los datos también se ven 8 segundos. Arriba, un aviso recuerda que ahora sí se puede hablar, con un botón para ir al chat.', 900);
  await espera(8800);
  // Almacén se equivoca a propósito en el primer pedido
  let muelleMalo = null;
  if (n === 1) { const o = (await optionTexts('operativo', 'anden')).slice(1).filter((t) => t !== datos.almacen[0]); muelleMalo = o[0]; }
  for (let i = 0; i < 5; i++) {
    const rol = ORDEN[i];
    const texto = rol === 'almacen' && muelleMalo ? `Mi muelle es ${muelleMalo}` : `Mis datos: ${datos[rol].join(', ')}`;
    await porRol[rol].fill('#notaTxt', texto);
    await porRol[rol].click('button:has-text("Publicar mi nota")');
    await espera(250);
  }
  if (n === 1) {
    await espera(600);
    await foto('seguridad', 'r2-2-notas', '#notasTodos', 'Ronda 2: las notas de todos, a la mano', 'Cada eslabón publica una nota que ven todos. Se actualiza en vivo y marca cuál es la tuya.', 900);
    await foto('seguridad', 'r2-3-nota', 'section:has-text("Tu nota para todos")', 'Ronda 2: tu nota para todos', 'Escribes tus datos; puedes actualizar la nota cuando quieras.', 800);
    // conversación directa
    const t = porRol.transporte;
    await t.selectOption('#chatPara', 'almacen'); await t.fill('#chatTxt', '¿Seguro que ese es el muelle?'); await t.click('#chatEnviar');
    await espera(500);
    await porRol.almacen.fill('#chatTxt', 'Déjame confirmarlo con el equipo.'); await porRol.almacen.click('#chatEnviar');
    await espera(700);
    await foto('almacen', 'r2-4-chat', '#conversacion', 'Ronda 2: hablar con el equipo', 'Mensajes directos a una persona (candado) o para todos. Aquí Transporte le pregunta a Almacén y este responde.', 1000);
    await fotoPanel('panel-06-r2-notas', 'Ronda 2 en vivo', 'El panel muestra los datos que dijo cada eslabón contra el valor real: el muelle de Almacén sale en rojo.');
  }
  const op = porRol.operativo;
  await espera(500);
  if (n === 1) await foto('operativo', 'r2-5-despacho', 'section:has-text("Arma el despacho")', 'Ronda 2: el Operativo arma el despacho', 'Los datos se rellenan con las notas del equipo. Puede cambiarlos a mano antes de repetir y confirmar.', 1500);
  await op.click('button:has-text("Repetir y confirmar")');
  await espera(900);
  if (n === 1) {
    await foto('almacen', 'r2-6-eco', 'text=El Operativo repite y confirma', 'Ronda 2: repetir y confirmar, y la corrección', 'El Operativo repite y confirma en voz alta lo que entendió. Si no coincide con tu dato, aparece "Corregir …".', 800);
    await porRol.almacen.click('button:has-text("Corregir")');
    await espera(900);
  }
  await foto('operativo', n === 1 ? 'r2-7-corregido' : 'r2-8-eco-p2', 'section:has-text("Arma el despacho")', n === 1 ? 'Ronda 2: dato corregido' : 'Ronda 2: segundo pedido', n === 1 ? 'La corrección actualiza el dato en el formulario del Operativo antes de enviar el despacho.' : 'Con la práctica, los datos llegan bien a la primera.', 1500);
  await op.click('button:has-text("Enviar despacho")');
  await espera(900);
}
await pedidoRonda2(1);
await porRol.operativo.waitForFunction(() => /Pedido 2\/2/.test(document.getElementById('tPed')?.textContent || ''));
await pedidoRonda2(2);

await host.waitForSelector('[data-accion="reiniciar"]', { timeout: 60000 });
await espera(1200);
await foto('operativo', 'r2-9-fin', null, 'Fin del juego', 'Resultado, estrellas e insignias, y el formulario de satisfacción anónimo.', 1700);
await fotoPanel('panel-07-comparar', 'Comparar rondas', 'Al final, la facilitadora compara la ronda 1 con la ronda 2 para conversar.');
fs.writeFileSync(`${OUT}/manifiesto.json`, JSON.stringify(manifiesto, null, 1));
await browser.close(); server.close();
console.log('listo:', manifiesto.length, 'capturas');
process.exit(0);
