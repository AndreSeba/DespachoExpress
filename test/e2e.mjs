// Prueba de extremo a extremo: panel de la facilitadora + un jugador humano en celular + bots.
// Uso: node test/e2e.mjs   (SHOTS=/ruta para guardar capturas)
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const { server } = require('../server.js');
const OUT = process.env.SHOTS || '/tmp';

await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}`;
const browser = await chromium.launch();
const errores = [];
const vigila = (page, n) => {
  page.on('pageerror', (e) => errores.push(`${n} pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errores.push(`${n} console: ${m.text()}`); });
};
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- Panel (escritorio)
const hctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const host = await hctx.newPage(); vigila(host, 'host');
await host.goto(base + '/host');
await host.waitForFunction(() => /^[A-Z]{4}$/.test(document.getElementById('codigo').textContent));
const code = await host.locator('#codigo').textContent();
console.log('sala', code);

// ---- Jugador humano (celular)
const pctx = await browser.newContext({ ...devices['iPhone 13'] });
const jug = await pctx.newPage(); vigila(jug, 'jugador');
await jug.goto(`${base}/?c=${code}`);
await jug.fill('#nombreIn', 'Camila');
await jug.selectOption('#puestoIn', 'operativo');
await jug.click('#entrarBtn');
await jug.waitForSelector('text=Esperando a que empiece');

// ---- Facilitadora completa con bots e inicia
await host.click('text=Completar con bots');
await host.waitForFunction(() => document.querySelectorAll('#seats .seat').length >= 6);
await host.screenshot({ path: `${OUT}/panel-01-lobby.png` });
await host.click('[data-accion="iniciar"]');
await host.waitForSelector('#ringTx');
const rolJugador = await jug.locator('#tRol').textContent();
console.log('rol de Camila:', rolJugador);
if (/Operativo/.test(rolJugador)) { errores.push('Camila declaró Operativo y recibió Operativo'); }

// ---- Camila juega como humano según su rol (ronda 1: pasa nota; operativo: arma despacho)
async function jugarHumano(modo) {
  const hasta = Date.now() + 70000; let acciones = 0;
  while (Date.now() < hasta) {
    const fase = await jug.locator('main').innerText();
    if (await jug.locator('#entendidoBtn').count()) { await jug.click('#entendidoBtn'); continue; }
    if (/Ronda terminada|Fin del juego/.test(fase)) break;
    const sel = jug.locator('select[data-campo]');
    const n = await sel.count();
    for (let i = 0; i < n; i++) { const s = sel.nth(i); if ((await s.inputValue()) === '') await s.selectOption({ index: 1 }); }
    const enviarNota = jug.locator('button:has-text("Enviar a")');
    const tarjeta = jug.locator('button:has-text("Publicar mi tarjeta")');
    const despacho = jug.locator('button:has-text("Enviar despacho")');
    const eco = jug.locator('button:has-text("Leer el eco")');
    if (await enviarNota.count() && (await jug.locator('input[type=checkbox]').count())) { await enviarNota.first().click(); acciones++; }
    else if (await tarjeta.count()) { await tarjeta.first().click(); acciones++; await espera(500); }
    else if (await despacho.count()) { if (modo === 2 && await eco.count()) { await eco.first().click(); await espera(300); } await despacho.first().click(); acciones++; }
    await espera(1200);
  }
  return acciones;
}
let sacoCaptura = false;
await jug.waitForSelector('#entendidoBtn');
await jug.screenshot({ path: `${OUT}/jugador-00-briefing.png`, fullPage: true });
const jugando = jugarHumano(1);
// Captura en mitad de la ronda con paquetes en movimiento
await espera(9000);
await host.screenshot({ path: `${OUT}/panel-02-ronda1-en-vivo.png` });
await host.click('[data-accion="incidente"]').catch(() => {});
await espera(500);
await host.screenshot({ path: `${OUT}/panel-03-incidente.png` });
await jug.screenshot({ path: `${OUT}/jugador-01-ronda1.png`, fullPage: true });
await jugando;
await host.waitForSelector('[data-accion="iniciar"]', { timeout: 80000 });
await host.screenshot({ path: `${OUT}/panel-04-entre-rondas.png` });

// ---- Ronda 2
await host.click('[data-accion="iniciar"]');
await host.waitForSelector('#ringTx');
const j2 = jugarHumano(2);
await espera(12000);
await host.screenshot({ path: `${OUT}/panel-05-ronda2-en-vivo.png` });
await jug.screenshot({ path: `${OUT}/jugador-02-ronda2.png`, fullPage: true });
await j2;
await host.waitForSelector('[data-accion="reiniciar"]', { timeout: 90000 });
await espera(500);
await host.screenshot({ path: `${OUT}/panel-06-comparar.png`, fullPage: true });
await jug.screenshot({ path: `${OUT}/jugador-03-fin.png`, fullPage: true });

// ---- Formulario de satisfacción (anónimo)
await jug.waitForSelector('#encuestaCard');
for (let i = 0; i < 8; i++) await jug.click(`label[for="it${i}_${(i % 5) + 1}"]`);
await jug.fill('#ab0', 'Muy útil el eco');
await jug.screenshot({ path: `${OUT}/jugador-04-formulario.png`, fullPage: true });
await jug.click('#encuestaEnviar');
await jug.waitForSelector('#encuestaGracias');
await host.waitForFunction(() => /1 de 1/.test(document.getElementById('encuestaConteo')?.textContent || ''));
await host.screenshot({ path: `${OUT}/panel-07-formulario.png`, fullPage: true });
const csv = await (await fetch(`${base}/api/export?code=${code}&token=${await host.evaluate(() => JSON.parse(localStorage.getItem('dx_host')).token)}`)).text();
console.log('CSV líneas:', csv.split('\n').length);
const desborda = await host.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
await browser.close(); server.close();
console.log('errores:', JSON.stringify(errores));
const anonimo = csv.includes('formulario_satisfaccion') && csv.includes('Muy útil el eco') && !csv.includes('Camila');
console.log('CSV con formulario y sin nombres:', anonimo);
const ok = errores.length === 0 && csv.includes('ronda,modo') && !desborda && anonimo;
console.log(ok ? 'TODO OK' : 'HAY FALLOS');
process.exit(ok ? 0 : 1);
