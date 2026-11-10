// Prueba de extremo a extremo de la demo HTML en un viewport de celular.
// Uso: node test/demo-e2e.mjs
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const file = 'file://' + path.join(__dirname, '..', 'demo', 'index.html');
const OUT = process.env.SHOTS || '/tmp';

async function jugar(browser, rolId, seed, shots) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await ctx.newPage();
  const errores = [];
  page.on('pageerror', (e) => errores.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errores.push('console: ' + m.text()); });
  await page.goto(`${file}?fast=1&seed=${seed}`);
  await page.click(`[data-rol="${rolId}"]`);
  if (shots) await page.screenshot({ path: `${OUT}/demo-${rolId}-01-intro.png`, fullPage: true });
  await page.click('[data-primary]');
  let pasos = 0, n = 0;
  while (pasos++ < 200) {
    const final = await page.locator('text=Ronda 1 frente a ronda 2').count();
    if (final) break;
    // completa selects vacíos
    const selects = page.locator('select[data-campo]');
    const cuantos = await selects.count();
    for (let i = 0; i < cuantos; i++) {
      const s = selects.nth(i);
      if ((await s.inputValue()) === '') await s.selectOption({ index: 1 });
    }
    const boton = page.locator('[data-primary]:not([disabled])').first();
    await boton.waitFor({ state: 'visible', timeout: 5000 });
    if (shots && n < 12) { await page.screenshot({ path: `${OUT}/demo-${rolId}-${String(++n + 1).padStart(2, '0')}.png`, fullPage: true }); }
    await boton.click();
  }
  const texto = await page.locator('main').innerText();
  if (shots) await page.screenshot({ path: `${OUT}/demo-${rolId}-final.png`, fullPage: true });
  // sin scroll horizontal
  const desborda = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  await ctx.close();
  return { rolId, final: /Ronda 1 frente a ronda 2/.test(texto), desborda, errores, pasos };
}

const browser = await chromium.launch();
const roles = ['atencion', 'planificacion', 'almacen', 'transporte', 'seguridad', 'operativo'];
let ok = true;
for (const [i, r] of roles.entries()) {
  const res = await jugar(browser, r, 100 + i, r === 'transporte' || r === 'operativo');
  console.log(JSON.stringify(res));
  if (!res.final || res.desborda || res.errores.length) ok = false;
}
await browser.close();
console.log(ok ? 'TODO OK' : 'HAY FALLOS');
process.exit(ok ? 0 : 1);
