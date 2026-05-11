const path = require('path');
const fs = require('fs');
const { log, DIRS, takeScreenshot } = require('./utils');

const SESSION_FILE = path.join(DIRS.session, 'state.json');

/**
 * Inicia sesión en Bnovus o restaura una sesión existente.
 * Retorna { context, page } listo para usar.
 */
async function login(browser, config) {
  const { BNOVUS_URL, BNOVUS_USER, BNOVUS_PASS } = config;

  // Intentar restaurar sesión
  if (fs.existsSync(SESSION_FILE)) {
    log('AUTH', 'Intentando restaurar sesión guardada...');
    try {
      const context = await browser.newContext({
        storageState: SESSION_FILE,
      });
      const page = await context.newPage();

      // Verificar que la sesión siga activa
      await page.goto(BNOVUS_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);

      const currentUrl = page.url();
      // Si NO redirigió al login, la sesión es válida
      if (!currentUrl.includes('/Account/Login')) {
        log('AUTH', '✅ Sesión restaurada exitosamente');
        await closeModal(page);
        return { context, page };
      }

      log('AUTH', '⚠️ Sesión expirada, haciendo login fresco...');
      await page.close();
      await context.close();
    } catch (err) {
      log('AUTH', `⚠️ Error restaurando sesión: ${err.message}`);
    }
  }

  // Login fresco
  log('AUTH', 'Iniciando login fresco...');
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(BNOVUS_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('#UserName', { timeout: 15000 });

  // Llenar credenciales
  await page.fill('#UserName', BNOVUS_USER);
  await page.fill('#Password', BNOVUS_PASS);
  log('AUTH', 'Credenciales ingresadas, enviando login...');

  // Click en INICIAR SESIÓN
  await page.click('#btnSubmit');

  // Esperar a que redirija fuera del login
  await page.waitForURL(url => !url.toString().includes('/Account/Login'), {
    timeout: 30000,
  });
  log('AUTH', '✅ Login exitoso');

  // Cerrar modal Rex+ si aparece
  await closeModal(page);

  // Guardar sesión
  await context.storageState({ path: SESSION_FILE });
  log('AUTH', `Sesión guardada en ${SESSION_FILE}`);

  return { context, page };
}

/**
 * Cierra el modal Rex+ que aparece después del login
 */
async function closeModal(page) {
  try {
    // Esperar un momento a que aparezca el modal
    await page.waitForTimeout(2000);

    // Intentar cerrar con Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Si hay un botón de cerrar visible, hacer clic
    const closeBtn = page.locator('.modal .close, .modal-header .close, [data-dismiss="modal"]').first();
    if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await closeBtn.click();
      log('AUTH', 'Modal Rex+ cerrado');
    }
  } catch {
    // Si no hay modal, no pasa nada
  }
}

/**
 * Guarda el estado de sesión actual
 */
async function saveSession(context) {
  await context.storageState({ path: SESSION_FILE });
  log('AUTH', 'Sesión actualizada');
}

module.exports = { login, saveSession };
