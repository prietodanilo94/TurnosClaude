require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { chromium } = require('playwright');
const { parseArgs, getDateConfig, log, ensureDirs, takeScreenshot } = require('./utils');
const { login, saveSession } = require('./auth');
const { sync } = require('./sync');
const { recalculate } = require('./recalculate');
const { downloadReport } = require('./report');
const { deliver } = require('./deliver');

async function main() {
  const startTime = Date.now();
  log('MAIN', '========================================');
  log('MAIN', '  BNOVUS BOT — Inicio de ejecución');
  log('MAIN', '========================================');

  // Crear directorios necesarios
  ensureDirs();

  // Parsear argumentos CLI opcionales
  const args = parseArgs();
  const dateConfig = getDateConfig(args.year, args.month);
  log('MAIN', `Configuración de fechas:`);
  log('MAIN', `  Año: ${dateConfig.year} | Mes: ${dateConfig.month}`);
  log('MAIN', `  Desde: ${dateConfig.fechaDesde} | Hasta: ${dateConfig.fechaHasta}`);

  // Configuración
  const config = {
    BNOVUS_URL: process.env.BNOVUS_URL,
    BNOVUS_USER: process.env.BNOVUS_USER,
    BNOVUS_PASS: process.env.BNOVUS_PASS,
    N8N_WEBHOOK_URL: process.env.N8N_WEBHOOK_URL,
    HEADLESS: process.env.HEADLESS !== 'false',
  };

  log('MAIN', `Modo: ${config.HEADLESS ? 'HEADLESS (invisible)' : 'HEADED (visible)'}`);

  let browser;
  let context;

  try {
    // === PASO 0: Lanzar navegador ===
    browser = await chromium.launch({
      headless: config.HEADLESS,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    log('MAIN', 'Navegador iniciado');

    // === PASO 1: Login ===
    const session = await login(browser, config);
    context = session.context;
    const page = session.page;

    // === PASO 2: Sincronización de Ausentismos ===
    await sync(page, dateConfig);

    // === PASO 3: Recálculo de Asistencia ===
    await recalculate(page, dateConfig);

    // === PASO 4: Descargar Reporte ===
    const filePath = await downloadReport(page, dateConfig);

    // === PASO 5: Entregar a n8n ===
    await deliver(filePath, config.N8N_WEBHOOK_URL);

    // === PASO 6: Guardar sesión actualizada ===
    await saveSession(context);

    // === Resumen final ===
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    log('MAIN', '========================================');
    log('MAIN', `  ✅ EJECUCIÓN COMPLETADA (${elapsed}s)`);
    log('MAIN', '========================================');

  } catch (err) {
    log('MAIN', `❌ ERROR FATAL: ${err.message}`);
    log('MAIN', err.stack);

    // Intentar capturar screenshot de error
    try {
      if (browser) {
        const pages = browser.contexts().flatMap(c => c.pages());
        if (pages.length > 0) {
          await takeScreenshot(pages[0], 'error_fatal');
        }
      }
    } catch {
      // Ignore screenshot errors
    }

    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
      log('MAIN', 'Navegador cerrado');
    }
  }

  process.exit(0);
}

// Ejecutar
main();
