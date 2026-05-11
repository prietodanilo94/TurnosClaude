const { log, setDateInput, takeScreenshot } = require('./utils');

const SYNC_URL = 'https://login.bnovus.cl/Parametros/Asistencia/AutomaticoRex.aspx';

// Selectores de la página Actualizar Ausentismos
const SEL = {
  empresa: '#ctl00_MainContent_ddlHolding',
  fechaDesde: '#ctl00_MainContent_txtFechaInicio',
  fechaHasta: '#ctl00_MainContent_txtFechaFin',
  limpieza: '#ctl00_MainContent_cbxLimpieza',
  btnSync: '#ctl00_MainContent_btnSincronizar',
  tabla: '#tblErrores',
};

/**
 * Ejecuta la sincronización de Vacaciones, Licencias y Permisos.
 * Navega directamente a la URL (sin depender del sidebar).
 */
async function sync(page, dateConfig) {
  log('SYNC', '=== Iniciando Sincronización de Ausentismos ===');
  log('SYNC', `Rango: ${dateConfig.fechaDesde} → ${dateConfig.fechaHasta}`);

  // Navegar directamente a la página
  await page.goto(SYNC_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector(SEL.empresa, { timeout: 15000 });
  log('SYNC', 'Página cargada');

  // Establecer fechas (primer y último día del mes)
  await setDateInput(page, SEL.fechaDesde, dateConfig.fechaDesde);
  await setDateInput(page, SEL.fechaHasta, dateConfig.fechaHasta);
  log('SYNC', `Fechas establecidas: ${dateConfig.fechaDesde} - ${dateConfig.fechaHasta}`);

  // Asegurar que el checkbox de Limpieza esté marcado
  const isChecked = await page.isChecked(SEL.limpieza);
  if (!isChecked) {
    await page.check(SEL.limpieza);
    log('SYNC', 'Checkbox "Con Limpieza de Datos" activado');
  }

  // Screenshot antes de sincronizar (debug)
  await takeScreenshot(page, 'sync_before_click');

  // Clic en Sincronizar
  log('SYNC', 'Haciendo clic en Sincronizar...');
  await page.click(SEL.btnSync);

  // Esperar a que el proceso termine
  // El botón se deshabilita durante el proceso, esperamos a que se rehabilite
  // o que la tabla muestre resultados
  try {
    // Esperamos a que aparezca algún indicador de finalización
    // Opción 1: El botón vuelve a estar habilitado
    await page.waitForFunction(
      (sel) => {
        const btn = document.querySelector(sel);
        return btn && !btn.disabled;
      },
      SEL.btnSync,
      { timeout: 60000 } // 1 minuto máximo
    );
  } catch {
    // Si el timeout se alcanza, puede que ya haya terminado
    log('SYNC', '⚠️ Timeout esperando botón, verificando estado...');
  }

  // Esperar un poco más para asegurar
  await page.waitForTimeout(3000);

  // Screenshot después de sincronizar
  await takeScreenshot(page, 'sync_after');
  log('SYNC', '✅ Sincronización completada');
}

module.exports = { sync };
