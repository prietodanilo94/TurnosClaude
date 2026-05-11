const { log, setSelect2, getLastSelectOption, takeScreenshot } = require('./utils');

const RECALC_URL = 'https://login.bnovus.cl/Parametros/Asistencia/RecalcularAsistencias.aspx';

// Selectores
const SEL = {
  selectAnio: '#ctl00_MainContent_ddlAnioRecalcular',
  selectMes: '#ctl00_MainContent_ddlMesRecalcular',
  btnRecalcular: '#btnActualizar',
  tablaProgreso: '#tablaAsistenciaActualizada',
  // Select2 containers (para interacción visual si selectOption falla)
  s2Anio: '#s2id_ctl00_MainContent_ddlAnioRecalcular',
  s2Mes: '#s2id_ctl00_MainContent_ddlMesRecalcular',
};

/**
 * Recalcula la asistencia del mes.
 * Selecciona el año actual y el último mes disponible.
 * Espera hasta que el porcentaje de avance llegue a 100%.
 */
async function recalculate(page, dateConfig) {
  log('RECALC', '=== Iniciando Recálculo de Asistencias ===');

  // Navegar directamente
  await page.goto(RECALC_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector(SEL.selectAnio, { state: 'attached', timeout: 15000 });
  log('RECALC', 'Página cargada');

  // Esperar a que Select2 se inicialice
  await page.waitForTimeout(2000);

  // === Seleccionar AÑO ===
  // Intentar con selectOption primero (más confiable)
  try {
    await page.selectOption(SEL.selectAnio, dateConfig.yearStr);
    // Disparar el evento de Select2 para que actualice la UI y los meses
    await page.evaluate((sel) => {
      if (window.jQuery) {
        jQuery(sel).trigger('change');
      }
    }, SEL.selectAnio);
    log('RECALC', `Año seleccionado: ${dateConfig.yearStr}`);
  } catch (err) {
    log('RECALC', `⚠️ selectOption falló para año, intentando Select2 visual...`);
    await selectViaSelect2(page, SEL.s2Anio, dateConfig.yearStr);
  }

  // Esperar a que los meses se actualicen tras cambiar el año
  await page.waitForTimeout(2000);

  // === Seleccionar MES (último disponible) ===
  try {
    const lastMonth = await getLastSelectOption(page, SEL.selectMes);
    await page.selectOption(SEL.selectMes, lastMonth);
    await page.evaluate((sel) => {
      if (window.jQuery) {
        jQuery(sel).trigger('change');
      }
    }, SEL.selectMes);
    log('RECALC', `Mes seleccionado: ${lastMonth} (último disponible)`);
  } catch (err) {
    log('RECALC', `⚠️ selectOption falló para mes: ${err.message}`);
    // Fallback: intentar con el mes de dateConfig
    await selectViaSelect2(page, SEL.s2Mes, dateConfig.monthStr);
  }

  await page.waitForTimeout(1000);

  // Screenshot antes de recalcular
  await takeScreenshot(page, 'recalc_before');

  // === Click en RECALCULAR ===
  log('RECALC', 'Haciendo clic en Recalcular...');
  await page.click(SEL.btnRecalcular);

  // === Esperar progreso hasta 100% ===
  log('RECALC', 'Esperando que el recálculo termine (puede tomar hasta 5-10 min)...');

  const startTime = Date.now();
  const MAX_WAIT = 10 * 60 * 1000; // 10 minutos máximo

  // Polling del porcentaje de avance
  while (Date.now() - startTime < MAX_WAIT) {
    await page.waitForTimeout(5000); // Revisar cada 5 segundos

    const progress = await page.evaluate(() => {
      const table = document.querySelector('#tablaAsistenciaActualizada');
      if (!table) return null;
      const firstRow = table.querySelector('tbody tr:first-child');
      if (!firstRow) return null;
      const cells = firstRow.querySelectorAll('td');
      // La columna de Porcentaje Avance es la 7ª (índice 6)
      // Pero puede variar, buscar la que contenga un %
      for (const cell of cells) {
        const text = cell.textContent.trim();
        if (text.includes('%')) return text;
      }
      return null;
    });

    if (progress) {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      log('RECALC', `Progreso: ${progress} (${elapsed}s transcurridos)`);

      if (progress.includes('100')) {
        log('RECALC', '✅ Recálculo completado al 100%');
        break;
      }
    }
  }

  if (Date.now() - startTime >= MAX_WAIT) {
    await takeScreenshot(page, 'recalc_timeout');
    throw new Error('Timeout: El recálculo no terminó en 10 minutos');
  }

  await takeScreenshot(page, 'recalc_after');
  log('RECALC', '✅ Recálculo finalizado exitosamente');
}

/**
 * Fallback: interactúa con Select2 visualmente (clic en container → buscar → clic en opción)
 */
async function selectViaSelect2(page, s2ContainerSelector, value) {
  // Click en el container Select2 para abrir el dropdown
  await page.click(s2ContainerSelector);
  await page.waitForTimeout(500);

  // Buscar en la caja de búsqueda de Select2
  const searchInput = page.locator('.select2-search input, .select2-input').first();
  if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    await searchInput.fill(value);
    await page.waitForTimeout(500);
  }

  // Click en el resultado que contenga el valor
  const result = page.locator(`.select2-results li`).filter({ hasText: value }).first();
  await result.click({ timeout: 5000 });
  log('RECALC', `Select2 visual: seleccionado "${value}"`);
}

module.exports = { recalculate };
