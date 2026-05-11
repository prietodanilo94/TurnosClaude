const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const { log } = require('./utils');

/**
 * Envía el archivo Excel al webhook de n8n vía HTTP POST.
 * Después de entrega exitosa, limpia el archivo local.
 */
async function deliver(filePath, webhookUrl) {
  log('DELIVER', '=== Iniciando Entrega a n8n ===');
  log('DELIVER', `Archivo: ${filePath}`);
  log('DELIVER', `Webhook: ${webhookUrl}`);

  // Verificar que el archivo existe
  if (!fs.existsSync(filePath)) {
    throw new Error(`Archivo no encontrado: ${filePath}`);
  }

  const fileSize = fs.statSync(filePath).size;
  log('DELIVER', `Tamaño: ${(fileSize / 1024).toFixed(1)} KB`);

  // Construir FormData
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath), {
    filename: path.basename(filePath),
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  // Agregar metadata
  form.append('source', 'bnovus-bot');
  form.append('timestamp', new Date().toISOString());
  form.append('filename', path.basename(filePath));

  try {
    const response = await axios.post(webhookUrl, form, {
      headers: {
        ...form.getHeaders(),
      },
      timeout: 30000, // 30 segundos
      maxContentLength: 50 * 1024 * 1024, // 50 MB max
    });

    log('DELIVER', `✅ Entrega exitosa — HTTP ${response.status}`);
    log('DELIVER', `   Respuesta: ${JSON.stringify(response.data).substring(0, 200)}`);

    // Limpiar archivo descargado
    fs.unlinkSync(filePath);
    log('DELIVER', `Archivo local eliminado: ${filePath}`);

    return response.data;
  } catch (err) {
    log('DELIVER', `❌ Error en entrega: ${err.message}`);
    if (err.response) {
      log('DELIVER', `   HTTP ${err.response.status}: ${JSON.stringify(err.response.data).substring(0, 200)}`);
    }
    // NO eliminamos el archivo en caso de error para reintento manual
    log('DELIVER', `   Archivo conservado para reintento: ${filePath}`);
    throw err;
  }
}

module.exports = { deliver };
