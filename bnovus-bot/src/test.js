require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { deliver } = require('./deliver');

const DIRS = {
  screenshots: path.join(__dirname, '..', 'screenshots'),
  session: path.join(__dirname, '..', 'session'),
  downloads: path.join(__dirname, '..', 'downloads'),
};

function ensureDirs() {
  Object.values(DIRS).forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });
}

function log(step, msg) {
  const ts = new Date().toLocaleTimeString('es-CL', { hour12: false });
  console.log(`[${ts}] [${step}] ${msg}`);
}

async function screenshot(page, name) {
  const file = path.join(DIRS.screenshots, `${name}_${Date.now()}.png`);
  await page.screenshot({ path: file, fullPage: true });
  log('SCREENSHOT', file);
}

// ─── PASO 1: LOGIN ───────────────────────────────────────────────────────────
async function stepLogin(browser) {
  log('LOGIN', 'Iniciando...');
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(process.env.BNOVUS_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('#UserName', { timeout: 15000 });

  await page.fill('#UserName', process.env.BNOVUS_USER);
  await page.fill('#Password', process.env.BNOVUS_PASS);
  await page.click('#btnSubmit');

  await page.waitForURL(url => !url.toString().includes('/Account/Login'), { timeout: 30000 });
  log('LOGIN', '✅ Login OK — URL: ' + page.url());

  // Cerrar modal si aparece
  await page.waitForTimeout(2000);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  await screenshot(page, '01_post_login');
  log('LOGIN', 'Screenshot guardado. Revisalo antes de continuar.');

  return { context, page };
}

// ─── PASO 2: SYNC AUSENTISMOS ────────────────────────────────────────────────
async function stepSync(page) {
  const SYNC_URL = 'https://login.bnovus.cl/Parametros/Asistencia/AutomaticoRex.aspx';

  // Calcular primer y último día del mes actual
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-based para Date
  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month + 1, 0);

  const pad = n => n.toString().padStart(2, '0');
  const fechaDesde = `${pad(firstDay.getDate())}/${pad(month + 1)}/${year}`;
  const fechaHasta = `${pad(lastDay.getDate())}/${pad(month + 1)}/${year}`;

  log('SYNC', `Rango: ${fechaDesde} → ${fechaHasta}`);
  await page.goto(SYNC_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('#ctl00_MainContent_ddlHolding', { timeout: 15000 });
  log('SYNC', 'Página cargada');

  // Setear fechas directamente en el input y disparar eventos del datepicker
  await page.evaluate(({ desde, hasta }) => {
    const set = (sel, val) => {
      const el = document.querySelector(sel);
      if (!el) throw new Error('Input no encontrado: ' + sel);
      el.value = val;
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new Event('blur', { bubbles: true }));
      if (window.jQuery) jQuery(el).trigger('change');
    };
    set('#ctl00_MainContent_txtFechaInicio', desde);
    set('#ctl00_MainContent_txtFechaFin', hasta);
  }, { desde: fechaDesde, hasta: fechaHasta });
  log('SYNC', 'Fechas establecidas');

  // Asegurar checkbox "Con Limpieza de Datos" marcado
  const isChecked = await page.isChecked('#ctl00_MainContent_cbxLimpieza');
  if (!isChecked) await page.check('#ctl00_MainContent_cbxLimpieza');

  await screenshot(page, '02_sync_antes');

  log('SYNC', 'Haciendo clic en Sincronizar...');
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 120000 }),
    page.click('#ctl00_MainContent_btnSincronizar'),
  ]);

  await screenshot(page, '02_sync_despues');
  log('SYNC', '✅ Sincronización completada');
}

// ─── PASO 3: RECALCULAR ASISTENCIA ───────────────────────────────────────────
async function stepRecalculate(page) {
  const RECALC_URL = 'https://login.bnovus.cl/Parametros/Asistencia/RecalcularAsistencias.aspx';

  const now = new Date();
  const year = now.getFullYear().toString();
  const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                      'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const monthName = monthNames[now.getMonth()];

  log('RECALC', `Año: ${year} | Mes: ${monthName}`);
  await page.goto(RECALC_URL, { waitUntil: 'networkidle', timeout: 60000 });

  // SlimSelect helper: abre el dropdown ss-main y hace click en la opción exacta
  const ssPick = async (selectId, optionText) => {
    const container = page.locator(`#${selectId} + div.ss-main`);
    await container.click();
    await page.waitForTimeout(400);
    await container.locator('div.ss-option').filter({ hasText: new RegExp(`^${optionText}$`) }).click();
    await page.waitForTimeout(300);
    log('RECALC', `"${selectId}" → "${optionText}" OK`);
  };

  // === Año: jQuery trigger puebla cboMes, SlimSelect visual actualiza la UI ===
  await page.evaluate((y) => {
    const opt = Array.from(document.querySelector('#cboAnio').options).find(o => o.text.trim() === y);
    if (opt) jQuery('#cboAnio').val(opt.value).trigger('change');
  }, year);
  await page.waitForFunction(() => (document.querySelector('#cboMes')?.options.length ?? 0) > 1, { timeout: 15000 });
  await ssPick('cboAnio', year);

  // === Mes: SlimSelect visual (cboDesc se puebla via handler de cboAnio) ===
  await ssPick('cboMes', monthName);
  await page.waitForTimeout(1000); // dar tiempo a que cboDesc cargue

  await screenshot(page, '03_recalc_antes');

  // Capturar "Fecha Terminado" actual antes de recalcular
  const fechaAntes = await page.evaluate(() => {
    const rows = document.querySelectorAll('table tbody tr');
    for (const row of rows) {
      const cells = row.querySelectorAll('td');
      if (cells.length >= 3) return cells[2].innerText.trim(); // columna Fecha Terminado
    }
    return '';
  });
  log('RECALC', `Fecha Terminado antes: "${fechaAntes}"`);

  // Scroll al botón y click
  log('RECALC', 'Buscando botón Recalcular...');
  const btnRecalcular = page.getByRole('button', { name: 'Recalcular' });
  await btnRecalcular.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await screenshot(page, '03_recalc_btn_visible');
  log('RECALC', 'Haciendo clic en Recalcular...');
  await btnRecalcular.click();
  await page.waitForTimeout(2000);
  await screenshot(page, '03_recalc_post_click');

  // Polling: esperar hasta que "Fecha Terminado" cambie a una hora de HOY
  log('RECALC', 'Polling cada 15s hasta que el proceso termine (máx 15 min)...');
  const hoy = new Date();
  const fechaHoyStr = `${String(hoy.getDate()).padStart(2,'0')}-${String(hoy.getMonth()+1).padStart(2,'0')}-${hoy.getFullYear()}`;
  const MAX_WAIT = 15 * 60 * 1000;
  const startTime = Date.now();

  while (Date.now() - startTime < MAX_WAIT) {
    await page.waitForTimeout(15000);

    const fechaActual = await page.evaluate(() => {
      const rows = document.querySelectorAll('table tbody tr');
      for (const row of rows) {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 3) return cells[2].innerText.trim();
      }
      return '';
    });

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    log('RECALC', `[${elapsed}s] Fecha Terminado: "${fechaActual}"`);

    if (fechaActual && fechaActual !== fechaAntes && fechaActual.includes(fechaHoyStr)) {
      log('RECALC', '✅ Proceso completado detectado');
      break;
    }
  }

  if (Date.now() - startTime >= MAX_WAIT) {
    log('RECALC', '⚠️ Timeout 15 min alcanzado — continuando de todas formas');
  }

  await page.waitForTimeout(2000);

  await screenshot(page, '03_recalc_despues');
  log('RECALC', '✅ Recálculo completado');
}

// ─── PASO 4: DESCARGAR REPORTE DIARIO ───────────────────────────────────────
async function stepReport(context, page) {
  const REPORT_URL = 'https://login.bnovus.cl/Parametros/Asistencia/Reportes/ReporteMensual.aspx';

  const dismissModal = async () => {
    try {
      const btn = page.locator('#ctl00_btnAceptarNotificacionDT');
      if (await btn.isVisible({ timeout: 2000 })) { await btn.click(); await page.waitForTimeout(400); }
    } catch (_) {}
    try {
      const jg = page.locator('#jGrowl');
      if (await jg.isVisible({ timeout: 1000 })) { await jg.click({ force: true }); await page.waitForTimeout(400); }
    } catch (_) {}
  };

  log('REPORT', 'Navegando a Reporte Mensual...');
  await page.goto(REPORT_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);
  await dismissModal();

  // Seleccionar radio "Rango" (auto-completa Fecha Desde y Hasta con hoy)
  log('REPORT', 'Seleccionando Rango...');
  await page.evaluate(() => {
    const r = document.querySelector('#rbFiltroRango');
    if (r) {
      r.checked = true;
      r.dispatchEvent(new Event('change', { bubbles: true }));
      r.dispatchEvent(new Event('click', { bubbles: true }));
      if (window.jQuery) jQuery(r).trigger('change').trigger('click');
    }
  });
  await page.waitForTimeout(1500);
  await dismissModal();
  await screenshot(page, '04_report_rango');

  // Buscar
  log('REPORT', 'Buscando...');
  await page.evaluate(() => { const b = document.querySelector('#btnBuscar'); if (b && !b.disabled) b.click(); });

  // Esperar que Exportar a Excel se habilite (máx 2 min)
  log('REPORT', 'Esperando resultados...');
  await page.waitForFunction(
    () => { const b = document.querySelector('#btnExportarExcel'); return b && !b.disabled; },
    null,
    { timeout: 120000 }
  );
  await screenshot(page, '04_report_resultados');
  log('REPORT', 'Resultados listos');

  // Exportar a Excel
  log('REPORT', 'Exportando a Excel...');
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 60000 }),
    page.locator('#btnExportarExcel').click(),
  ]);

  const savePath = path.join(DIRS.downloads, `reporte_${Date.now()}.xlsx`);
  await download.saveAs(savePath);
  log('REPORT', `✅ Reporte descargado: ${savePath}`);

  return savePath;
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
async function main() {
  ensureDirs();
  const browser = await chromium.launch({ headless: process.env.HEADLESS !== 'false' });

  try {
    const { context, page } = await stepLogin(browser);
    await context.storageState({ path: path.join(DIRS.session, 'state.json') });
    log('MAIN', '✅ Paso 1 OK');

    await stepSync(page);
    log('MAIN', '✅ Paso 2 OK — esperando 20s antes de recalcular...');
    await page.waitForTimeout(20000);

    await stepRecalculate(page);
    log('MAIN', '✅ Paso 3 OK');

    const reportPath = await stepReport(context, page);
    log('MAIN', `✅ Paso 4 OK — archivo: ${reportPath}`);

    await deliver(reportPath, process.env.N8N_WEBHOOK_URL);
    log('MAIN', '✅ Paso 5 OK');

    // Mantener browser abierto 5s para revisar
    await page.waitForTimeout(5000);

  } finally {
    await browser.close();
  }
}

main().catch(err => { console.error('ERROR:', err.message); process.exit(1); });
