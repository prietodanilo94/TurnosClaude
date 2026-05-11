const path = require('path');
const fs = require('fs');

/**
 * Parsea argumentos CLI opcionales: --month=4 --year=2026
 */
function parseArgs() {
  const args = {};
  process.argv.slice(2).forEach(arg => {
    if (arg.startsWith('--')) {
      const [key, val] = arg.replace('--', '').split('=');
      args[key] = val;
    }
  });
  return args;
}

/**
 * Calcula todas las fechas necesarias para el flujo.
 * Por defecto usa el mes actual. Acepta override vía parámetros.
 */
function getDateConfig(overrideYear, overrideMonth) {
  const now = new Date();
  const year = overrideYear ? parseInt(overrideYear) : now.getFullYear();
  const month = overrideMonth ? parseInt(overrideMonth) : now.getMonth() + 1;

  const lastDay = new Date(year, month, 0).getDate(); // último día del mes
  const pad = n => n.toString().padStart(2, '0');

  return {
    year,
    month,
    fechaDesde: `01/${pad(month)}/${year}`,
    fechaHasta: `${pad(lastDay)}/${pad(month)}/${year}`,
    yearStr: year.toString(),
    monthStr: pad(month),
  };
}

/**
 * Logger con timestamp y etiqueta de paso
 */
function log(step, msg) {
  const ts = new Date().toLocaleTimeString('es-CL', { hour12: false });
  console.log(`[${ts}] [${step}] ${msg}`);
}

/**
 * Directorios del proyecto
 */
const DIRS = {
  root: path.join(__dirname, '..'),
  session: path.join(__dirname, '..', 'session'),
  downloads: path.join(__dirname, '..', 'downloads'),
  screenshots: path.join(__dirname, '..', 'screenshots'),
};

/**
 * Crea directorios necesarios si no existen
 */
function ensureDirs() {
  [DIRS.session, DIRS.downloads, DIRS.screenshots].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

/**
 * Guarda un screenshot con nombre descriptivo (debug/errores)
 */
async function takeScreenshot(page, name) {
  const file = path.join(DIRS.screenshots, `${name}_${Date.now()}.png`);
  await page.screenshot({ path: file, fullPage: true });
  log('SCREENSHOT', `Guardado: ${file}`);
  return file;
}

/**
 * Establece el valor de un input de fecha (compatible con datepicker jQuery)
 */
async function setDateInput(page, selector, value) {
  await page.evaluate(({ sel, val }) => {
    const input = document.querySelector(sel);
    if (!input) throw new Error(`Input no encontrado: ${sel}`);
    // Limpia y establece valor
    input.value = val;
    // Dispara eventos para datepicker/jQuery
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new Event('blur', { bubbles: true }));
    if (window.jQuery) {
      jQuery(input).trigger('change');
    }
  }, { sel: selector, val: value });
}

/**
 * Selecciona una opción en un Select2 dropdown
 * Funciona manipulando el <select> nativo y disparando el evento Select2
 */
async function setSelect2(page, selectSelector, value) {
  await page.evaluate(({ sel, val }) => {
    const select = document.querySelector(sel);
    if (!select) throw new Error(`Select no encontrado: ${sel}`);
    select.value = val;
    // Disparar eventos para Select2 + ASP.NET
    if (window.jQuery) {
      jQuery(select).val(val).trigger('change');
    } else {
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, { sel: selectSelector, val: value });
}

/**
 * Obtiene la última opción disponible de un <select>
 */
async function getLastSelectOption(page, selectSelector) {
  return await page.evaluate((sel) => {
    const select = document.querySelector(sel);
    if (!select) throw new Error(`Select no encontrado: ${sel}`);
    const options = Array.from(select.options).filter(o => o.value && o.value !== '');
    if (options.length === 0) throw new Error(`No hay opciones en: ${sel}`);
    return options[options.length - 1].value;
  }, selectSelector);
}

module.exports = {
  parseArgs,
  getDateConfig,
  log,
  DIRS,
  ensureDirs,
  takeScreenshot,
  setDateInput,
  setSelect2,
  getLastSelectOption,
};
