const path = require('path');
const { log, setDateInput, takeScreenshot, DIRS } = require('./utils');

const REPORT_URL = 'https://login.bnovus.cl/Parametros/Asistencia/Reportes/ReporteMensual.aspx';

// Selectores
const SEL = {
  radioRango: '#rbFiltroRango',
  radioCorte: '#rbFiltroCorte',
  fechaDesde: '#txtFechaDesde',
  fechaHasta: '#txtFechaHasta',
  btnBuscar: '#btnBuscar',
  btnExportExcel: '#btnExportarExcel',
};

/**
 * Descarga el Reporte Mensual de Asistencias en formato Excel.
 * Retorna la ruta del archivo descargado.
 */
async function downloadReport(page, dateConfig) {
  log('REPORT', '=== Iniciando Descarga de Reporte Mensual ===');

  // Navegar directamente
  await page.goto(REPORT_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector(SEL.radioRango, { timeout: 15000 });
  log('REPORT', 'Página cargada');

  // Seleccionar "Rango" como tipo de búsqueda
  await page.click(SEL.radioRango);
  await page.waitForTimeout(1000);
  log('REPORT', 'Tipo de búsqueda: Rango seleccionado');

  // Establecer fechas
  await setDateInput(page, SEL.fechaDesde, dateConfig.fechaDesde);
  await setDateInput(page, SEL.fechaHasta, dateConfig.fechaHasta);
  log('REPORT', `Fechas: ${dateConfig.fechaDesde} → ${dateConfig.fechaHasta}`);

  // Screenshot antes de buscar
  await takeScreenshot(page, 'report_before_search');

  // Click en Buscar
  log('REPORT', 'Buscando datos...');
  await page.click(SEL.btnBuscar);

  // Esperar a que carguen los resultados
  // El botón de exportar se habilita cuando hay datos
  try {
    await page.waitForFunction(
      (sel) => {
        const btn = document.querySelector(sel);
        return btn && !btn.disabled;
      },
      SEL.btnExportExcel,
      { timeout: 120000 } // 2 minutos para cargar datos
    );
    log('REPORT', 'Datos cargados, botón exportar disponible');
  } catch {
    // Puede que el botón ya esté habilitado desde el inicio
    // Verificar si hay datos en la tabla
    log('REPORT', '⚠️ Timeout esperando botón exportar, verificando datos...');
  }

  // Esperar un poco para estabilizar
  await page.waitForTimeout(3000);
  await takeScreenshot(page, 'report_after_search');

  // === DESCARGAR EXCEL ===
  log('REPORT', 'Iniciando descarga de Excel...');

  // Configurar la interceptación de descarga ANTES de hacer clic
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 60000 }),
    page.click(SEL.btnExportExcel),
  ]);

  // Guardar el archivo
  const suggestedName = download.suggestedFilename() || `reporte_asistencia_${dateConfig.year}_${dateConfig.monthStr}.xlsx`;
  const filePath = path.join(DIRS.downloads, suggestedName);
  await download.saveAs(filePath);

  log('REPORT', `✅ Reporte descargado: ${filePath}`);
  log('REPORT', `   Nombre: ${suggestedName}`);

  return filePath;
}

module.exports = { downloadReport };
