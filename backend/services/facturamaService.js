const axios = require("axios");
const { poolPromise, sql } = require('../config/db');

const baseURL = process.env.FACTURAMA_BASE_URL;

// Credenciales de la cuenta principal desde .env
const auth = Buffer.from(`${process.env.FACTURAMA_USER}:${process.env.FACTURAMA_PASSWORD}`).toString('base64');

const isSandboxEnvironment = () => /sandbox/i.test(baseURL || '');

const cleanValue = (value) => {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
};

// Mapea texto completo de régimen fiscal SAT → código numérico de 3 dígitos
const normalizeFiscalRegime = (value) => {
  if (!value) return null;
  const str = String(value).trim();
  // Si ya es código numérico (ej: "601", "612") lo devuelve tal cual
  if (/^\d{3}$/.test(str)) return str;
  // Mapa de textos comunes → códigos
  const map = {
    'general de ley personas morales': '601',
    'régimen general de ley personas morales': '601',
    'personas morales con fines no lucrativos': '603',
    'sueldos y salarios e ingresos asimilados a salarios': '605',
    'arrendamiento': '606',
    'régimen de enajenación o adquisición de bienes': '607',
    'demás ingresos': '608',
    'consolidación': '609',
    'residentes en el extranjero sin establecimiento permanente en méxico': '610',
    'ingresos por dividendos': '611',
    'personas físicas con actividades empresariales y profesionales': '612',
    'ingresos por intereses': '614',
    'régimen de los ingresos por obtención de premios': '615',
    'sin obligaciones fiscales': '616',
    'sociedades cooperativas de producción': '620',
    'incorporación fiscal': '621',
    'actividades agrícolas, ganaderas, silvícolas y pesqueras': '622',
    'opcional para grupos de sociedades': '623',
    'coordinados': '624',
    'régimen de actividades empresariales con ingresos a través de plataformas tecnológicas': '625',
    'régimen simplificado de confianza': '626',
  };
  const key = str.toLowerCase();
  for (const [text, code] of Object.entries(map)) {
    if (key.includes(text)) return code;
  }
  // Si no se reconoce, intentar extraer 3 dígitos del principio
  const match = str.match(/\b(\d{3})\b/);
  return match ? match[1] : null;
};

const normalizeReceiver = (receiver = {}, options = {}) => {
  const fallbackEmail = cleanValue(options.fallbackEmail);

  const normalized = {
    Rfc: cleanValue(receiver.Rfc || receiver.RFC),
    Name: cleanValue(receiver.Name || receiver.Nombre),
    CfdiUse: cleanValue(receiver.CfdiUse || receiver.UsoCfdi) || 'G03',
    Email: cleanValue(receiver.Email) || fallbackEmail,
    FiscalRegime: normalizeFiscalRegime(receiver.FiscalRegime || receiver.RegimenFiscal),
    TaxZipCode: cleanValue(receiver.TaxZipCode || receiver.CodigoPostal) || null,
  };

  const missingFields = [];
  if (!normalized.Rfc) missingFields.push('Rfc');
  if (!normalized.Name) missingFields.push('Name');
  if (!normalized.FiscalRegime) missingFields.push('FiscalRegime');
  if (!normalized.TaxZipCode) missingFields.push('TaxZipCode');

  if (missingFields.length === 0) {
    return normalized;
  }

  throw new Error(`El receptor no está completo para facturar. Faltan: ${missingFields.join(', ')}`);
};

// ─── Headers reutilizables ────────────────────────────────────────────
const jsonHeaders = (authBase64) => ({
  Authorization: `Basic ${authBase64 || auth}`,
  'Content-Type': 'application/json',
});
const basicHeaders = (authBase64) => ({
  Authorization: `Basic ${authBase64 || auth}`,
});

const asPdfBuffer = (rawData) => {
  if (Buffer.isBuffer(rawData)) {
    const text = rawData.toString('utf8').trim();
    if (text.startsWith('{') || text.startsWith('[')) {
      try {
        const parsed = JSON.parse(text);
        if (parsed && parsed.Content) {
          return Buffer.from(parsed.Content, 'base64');
        }
      } catch (err) {
      }
    }
    return rawData;
  }

  if (rawData && typeof rawData === 'object' && rawData.Content) {
    return Buffer.from(rawData.Content, 'base64');
  }

  if (typeof rawData === 'string') {
    const text = rawData.trim();
    if (text.startsWith('{') || text.startsWith('[')) {
      try {
        const parsed = JSON.parse(text);
        if (parsed && parsed.Content) {
          return Buffer.from(parsed.Content, 'base64');
        }
      } catch (err) {
      }
    }
    return Buffer.from(text, 'base64');
  }

  return Buffer.from(rawData || []);
};

// ─── Obtener datos fiscales del emisor desde BD ──────────────────────
const getEmisorData = async (companyId) => {
  try {
    const pool = await poolPromise;

    // Detectar columnas existentes en la tabla ERP_COMPANY para evitar errores
    const colsRes = await pool.request()
      .input('tableName', sql.VarChar(128), 'ERP_COMPANY')
      .query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = @tableName`);

    const existingCols = (colsRes.recordset || []).map(r => String(r.COLUMN_NAME).toLowerCase());

    const required = ['RFC', 'LegalName', 'FiscalRegime', 'TaxZipCode', 'CsdCargado', 'Email'];
    const optional = ['FacturamaUser', 'FacturamaPassword', 'CsdPassword'];

    // Construir lista de columnas a seleccionar: requeridas si existen, más opcionales si existen
    const selectCols = [];
    for (const c of required) {
      if (existingCols.includes(c.toLowerCase())) selectCols.push(c);
    }
    for (const c of optional) {
      if (existingCols.includes(c.toLowerCase())) selectCols.push(c);
    }

    // Si por alguna razón no encontramos las columnas esperadas, usar SELECT * como fallback
    const selectClause = selectCols.length > 0 ? selectCols.join(', ') : '*';

    const result = await pool.request()
      .input('Company_Id', sql.Int, companyId)
      .query(`SELECT ${selectClause} FROM ERP_COMPANY WHERE Company_Id = @Company_Id`);

    if (result.recordset.length === 0) {
      throw new Error('Empresa no encontrada');
    }

    const company = result.recordset[0];

    return {
      Rfc: company.RFC,
      Name: company.LegalName,
      FiscalRegime: company.FiscalRegime,
      TaxZipCode: company.TaxZipCode,
      CsdCargado: company.CsdCargado,
      Email: company.Email,
      FacturamaUser: company.FacturamaUser || null,
      FacturamaPassword: company.FacturamaPassword || null,
      CsdPassword: company.CsdPassword || null,
    };
  } catch (error) {
    console.error('Error obteniendo datos del emisor:', error);
    throw error;
  }
};

const getCompanyFacturacionStatus = async (companyId) => {
  const emisor = await getEmisorData(companyId);
  const missingFields = [];
  const warnings = [];

  if (!cleanValue(emisor.Rfc)) missingFields.push('RFC');
  if (!cleanValue(emisor.Name)) missingFields.push('LegalName');
  if (!cleanValue(emisor.FiscalRegime)) missingFields.push('FiscalRegime');
  if (!cleanValue(emisor.TaxZipCode)) missingFields.push('TaxZipCode');
  if (!emisor.CsdCargado) warnings.push('La empresa no tiene CSD marcado como cargado en ERP_COMPANY');

  return {
    companyId: Number(companyId),
    sandbox: isSandboxEnvironment(),
    canInvoice: missingFields.length === 0,
    missingFields,
    warnings,
    emisor,
  };
};

const buildFacturaPayload = async (cfdiData, companyId) => {
  const status = await getCompanyFacturacionStatus(companyId);

  if (!status.canInvoice) {
    throw new Error(`La empresa no está lista para facturar. Faltan: ${status.missingFields.join(', ')}`);
  }

  const emisor = status.emisor;
  const receptor = normalizeReceiver(cfdiData.Receptor || {}, {
    fallbackEmail: emisor.Email,
  });

  // Folio autogenerado: timestamp para garantizar unicidad
  const folio = cleanValue(cfdiData.Folio) || String(Date.now()).slice(-8);

  return {
    Issuer: {
      Rfc: emisor.Rfc,
      Name: emisor.Name,
      FiscalRegime: normalizeFiscalRegime(emisor.FiscalRegime) || emisor.FiscalRegime,
    },
    Folio: folio,
    CfdiType: cfdiData.CfdiType || 'I',
    NameId: cleanValue(cfdiData.NameId) || '1',
    ExpeditionPlace: cleanValue(cfdiData.ExpeditionPlace) || emisor.TaxZipCode,
    // Determinar método y forma de pago. Para CFDI (4.0) cuando el método es PPD
    // (Pago en parcialidades o diferido) la FormaPago debe ser '99' (Por definir).
    PaymentMethod: cleanValue(cfdiData.MetodoPago || cfdiData.PaymentMethod) || 'PUE',
    PaymentForm: (function() {
      const pm = (cleanValue(cfdiData.MetodoPago || cfdiData.PaymentMethod) || 'PUE').toUpperCase();
      const pfIncoming = cleanValue(cfdiData.FormaPago || cfdiData.PaymentForm);
      // Si el método es PPD, Facturama/SAT requieren FormaPago = '99'
      if (pm === 'PPD') {
        if (pfIncoming && pfIncoming !== '99') {
          console.warn('[Facturama] Ajustando PaymentForm a "99" debido a PaymentMethod=PPD (entrada:', pfIncoming, ')');
        }
        return '99';
      }
      // Si no es PPD, usar la forma proporcionada o default a '01'
      return pfIncoming || '01';
    })(),
    Currency: cleanValue(cfdiData.Moneda || cfdiData.Currency) || 'MXN',
    Receiver: receptor,
    Items: (cfdiData.Conceptos || cfdiData.Items || []).map((item) => {
      const traslados = (item.Impuestos && item.Impuestos.Traslados) || item.Taxes || [];
      const iva = traslados[0];

      const subtotal = Number(item.Importe || item.Subtotal || 0);
      const ivaTotal = iva ? Number(iva.Importe || iva.Total || 0) : 0;
      const ivaBase  = iva ? Number(iva.Base || subtotal) : subtotal;
      const ivaRate  = iva ? Number(iva.TasaOCuota || iva.Rate || 0.16) : 0.16;
      // Recalcular IVA si viene en 0 (seguridad)
      const ivaImporte = ivaTotal > 0 ? ivaTotal : parseFloat((ivaBase * ivaRate).toFixed(2));
      const totalItem  = parseFloat((subtotal + ivaImporte).toFixed(2));

      return {
        ProductCode: item.ClaveProdServ || item.ProductCode || '01010101',
        UnitCode: item.ClaveUnidad || item.UnitCode || 'E48',
        Unit: item.Unidad || item.Unit || 'Pieza',
        Description: item.Descripcion || item.Description,
        Quantity: Number(item.Cantidad || item.Quantity || 0),
        UnitPrice: Number(item.ValorUnitario || item.UnitPrice || 0),
        Subtotal: subtotal,
        TaxObject: '02',   // CFDI 4.0: '02' = Sí objeto de impuesto
        Total: totalItem,
        Taxes: iva
          ? [
              {
                Name: 'IVA',
                IsRetention: false,
                Base: ivaBase,
                Rate: ivaRate,
                Total: ivaImporte,
                Type: 'Federal',
              },
            ]
          : [],
      };
    }),
  };
};

// ══════════════════════════════════════════════════════════════════════
//  API MULTIEMISOR:  POST /2/cfdis
//  Se usa una sola cuenta de Facturama para timbrar como cualquiera
//  de las 3 empresas. El RFC del Issuer en el body indica quién emite.
//  Previamente, cada empresa debe tener su CSD subido vía POST /api/csd
// ══════════════════════════════════════════════════════════════════════

/**
 * Timbrar CFDI usando API Multiemisor (/2/cfdis)
 * @param {Object} cfdiBody - Body completo del CFDI (Issuer, Receiver, Items, etc.)
 * @returns {Object} Respuesta de Facturama con UUID, Id, Serie, Folio, etc.
 */
exports.timbrarMultiemisor = async (cfdiBody, options = {}) => {
  try {
    console.log('[Facturama Multi] Timbrando CFDI para RFC:', cfdiBody.Issuer?.Rfc);
    // Intentar corregir el Nombre del emisor consultando CSDs en Facturama
    let usedAuthForTimbrado = options.authBase64 || null; // which credentials we'll use to timbrar
    try {
      const issuerRfc = String(cfdiBody.Issuer?.Rfc || '').toUpperCase();
      let csds = [];
      if (issuerRfc) {
        // 1) intentar con las credenciales proporcionadas (por-company)
        try {
          csds = await exports.listarCSDs(options.authBase64 || null);
        } catch (e) {
          console.warn('[Facturama Multi] listarCSDs con credenciales por-company falló:', e?.message || e);
          csds = [];
        }

        let csd = Array.isArray(csds)
          ? csds.find(c => String((c.Rfc || c.rfc || '')).toUpperCase() === issuerRfc)
          : null;

        // 2) Si no se encontró, intentar con la cuenta global (master)
        if (!csd) {
          try {
            const globalCsds = await exports.listarCSDs(null);
            csd = Array.isArray(globalCsds)
              ? globalCsds.find(c => String((c.Rfc || c.rfc || '')).toUpperCase() === issuerRfc)
              : null;
            if (csd) {
              // fallback: usar la cuenta global para timbrado
              usedAuthForTimbrado = null;
              console.log('[Facturama Multi] CSD encontrado en cuenta global. Usando cuenta global para timbrado.');
            }
          } catch (e) {
            console.warn('[Facturama Multi] listarCSDs con cuenta global falló:', e?.message || e);
          }
        }

        if (csd) {
          const possibleNames = [csd.Name, csd.LegalName, csd.RazonSocial, csd.name, csd.legalName, csd.razonSocial].filter(Boolean);
          const officialName = possibleNames.length ? possibleNames[0] : null;
          if (officialName && String(cfdiBody.Issuer.Name).trim() !== String(officialName).trim()) {
            console.log('[Facturama Multi] Reemplazando Issuer.Name por valor registrado en Facturama:', officialName);
            cfdiBody.Issuer.Name = officialName;
          }
        }
      }
    } catch (lookupErr) {
      console.warn('[Facturama Multi] No se pudo consultar CSDs para corregir Issuer.Name:', lookupErr?.message || lookupErr);
    }

    console.log('[Facturama Multi] Body:', JSON.stringify(cfdiBody, null, 2));

    const headers = jsonHeaders(usedAuthForTimbrado);
    const response = await axios.post(
      `${baseURL}/api-lite/3/cfdis`,
      cfdiBody,
      { headers }
    );

    console.log('[Facturama Multi] RESPONSE:');
    console.log(JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    const errData = error.response?.data || error.message || error;
    console.error('[Facturama Multi] Error:', errData);

    // Si el error es por CSD no encontrado, intentar reintentar usando la cuenta global (cuenta master)
    try {
      const message = String((errData && (errData.Message || errData.message)) || errData).toLowerCase();
      if (message.includes('csd') || message.includes('no se encuentra el csd') || message.includes('no se encontro el csd') || message.includes('cno se encuentra el csd')) {
        // Solo reintentar si NO se usó ya la cuenta global
        if (options.authBase64) {
          console.warn('[Facturama Multi] Error por CSD no encontrado. Reintentando timbrado usando cuenta global (fallback).');
          try {
            const headersGlobal = jsonHeaders(null);
            const responseRetry = await axios.post(`${baseURL}/api-lite/3/cfdis`, cfdiBody, { headers: headersGlobal });
            console.log('[Facturama Multi] Retry with global account succeeded');
            console.log(JSON.stringify(responseRetry.data, null, 2));
            return responseRetry.data;
          } catch (retryErr) {
            console.error('[Facturama Multi] Reintento con cuenta global falló:', retryErr.response?.data || retryErr.message || retryErr);
            // caerá al throw final
          }
        }
      }
    } catch (inspectErr) {
      console.warn('[Facturama Multi] No fue posible inspeccionar el error para fallback CSD:', inspectErr?.message || inspectErr);
    }

    // Lanzar el error original (o el objeto de respuesta si existe)
    throw errData;
  }
};

/**
 * Timbrar factura legacy (API normal /api/Cfdi) - se mantiene por compatibilidad
 */
exports.timbrarFactura = async (factura, options = {}) => {
  try {
    const response = await axios.post(
      `${baseURL}/api/Cfdi`,
      factura,
      { headers: jsonHeaders(options.authBase64) }
    );

    console.log("FACTURAMA RESPONSE:");
    console.log(JSON.stringify(response.data, null, 2));

    return response.data;
  } catch (error) {
    console.error("Error Facturama:", error.response?.data || error.message);
    throw error.response?.data || error;
  }
};

// ─── Descargar PDF (Multiemisor: /cfdi/pdf/issuedLite/{id}) ──────────
exports.descargarPDF = async (cfdiId) => {
  try {
    console.log('Descargando PDF para CFDI ID:', cfdiId);
    // Intentar primero con endpoint issuedLite (respuesta JSON con Content base64)
    try {
      const response = await axios.get(
        `${baseURL}/cfdi/pdf/issuedLite/${cfdiId}`,
        {
          headers: basicHeaders(),
          responseType: 'arraybuffer'
        }
      );
      const pdfBuffer = asPdfBuffer(response.data);
      console.log('PDF descargado (issuedLite), tamaño:', pdfBuffer.length);
      return pdfBuffer;
    } catch (issuedLiteErr) {
      // Fallback 1: endpoint legacy api-lite (si aplica)
      console.log('Fallback a api-lite para PDF');
      const response = await axios.get(
        `${baseURL}/api-lite/cfdi/pdf/issuedLite/${cfdiId}`,
        {
          headers: basicHeaders(),
          responseType: 'arraybuffer'
        }
      );
      const pdfBuffer = asPdfBuffer(response.data);
      console.log('PDF descargado (api-lite), tamaño:', pdfBuffer.length);
      return pdfBuffer;
    }
  } catch (error) {
    console.error("Error descargando PDF:", error.response?.data || error.message);
    if (error.response?.data) {
      const errorText = Buffer.from(error.response.data).toString('utf8');
      console.error("Error detallado:", errorText);
    }
    throw error.response?.data || error;
  }
};

// ─── Descargar XML (Multiemisor) - probar múltiples endpoints y detectar XML vs JSON
exports.descargarXML = async (cfdiId) => {
  const endpoints = [
    `${baseURL}/cfdi/xml/issuedLite/${cfdiId}`,
    `${baseURL}/cfdi/xml/issued/${cfdiId}`,
    `${baseURL}/api-lite/cfdi/xml/issuedLite/${cfdiId}`,
    `${baseURL}/api-lite/cfdi/xml/issued/${cfdiId}`,
    `${baseURL}/api-lite/3/cfdis/${cfdiId}/xml`,
    `${baseURL}/api/Cfdi/${cfdiId}/xml`,
  ];

  let lastErr = null;

  for (const url of endpoints) {
    try {
      console.log('[Facturama Multi] Intentando descargar XML desde:', url);
      const resp = await axios.get(url, {
        headers: basicHeaders(),
        responseType: 'arraybuffer'
      });

      const buf = resp.data;
      // Detectar si la respuesta es XML (empieza por '<') o JSON de error
      const text = Buffer.from(buf).toString('utf8').trim();
      if (text.startsWith('<')) {
        console.log('[Facturama Multi] XML descargado desde:', url);
        return buf;
      }

      // Si viene JSON, intentar parsear. Algunos endpoints devuelven un objeto
      // con Content (base64) y metadatos (ContentType: 'xml').
      try {
        const parsed = JSON.parse(text);
        console.warn('[Facturama Multi] Respuesta JSON al solicitar XML:', parsed);
        // Si la respuesta incluye Content en base64 y es tipo xml, decodificar y devolver
        if (parsed && parsed.Content) {
          const encoding = (parsed.ContentEncoding || '').toLowerCase();
          const contentType = (parsed.ContentType || '').toLowerCase();
          if (encoding === 'base64') {
            const decoded = Buffer.from(parsed.Content, 'base64');
            // Si ContentType sugiere xml, devolvemos el buffer
            if (contentType === 'xml' || contentType === 'application/xml' || contentType === 'text/xml' || text.trim().startsWith('<')) {
              console.log('[Facturama Multi] Decodificado XML desde respuesta JSON (Content)');
              return decoded;
            }
            // Si no se puede asegurar tipo, igual devolver el buffer
            return decoded;
          }
        }
        lastErr = parsed;
        // continuar probando otros endpoints
        continue;
      } catch (parseErr) {
        // No es XML ni JSON legible -> devolver buffer
        return buf;
      }
    } catch (err) {
      console.warn('[Facturama Multi] Error en endpoint', url, err.response?.data || err.message || err);
      lastErr = err.response?.data || err;
      // seguir probando
    }
  }

  // Si llegamos aquí, no obtuvimos XML válido
  console.error('[Facturama Multi] No se pudo descargar XML. Último error:', lastErr);
  throw lastErr || { Message: 'No se pudo descargar XML desde Facturama' };
};

// ─── Cancelar CFDI Multiemisor ───────────────────────────────────────
// Cancela usando el Id interno de Facturama (FacturamaId). NO usar UUID.
exports.cancelarCFDI = async (facturamaId, motivo = '02', folioSustitucion = null) => {
  const isSandbox = /sandbox/i.test(String(baseURL || ''));
  const params = { motive: motivo };
  if (folioSustitucion) params.uuidReplacement = folioSustitucion;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const maxRetries = 3;

  if (!facturamaId) {
    throw new Error('Se requiere el FacturamaId para cancelar (no pases el UUID).');
  }

  // Endpoints a usar (GET para validar existencia, DELETE para cancelar)
  const getEndpoints = [
    `${baseURL}/api-lite/cfdis/${facturamaId}`,
    `${baseURL}/api-lite/3/cfdis/${facturamaId}`,
    `${baseURL}/api/Cfdi/${facturamaId}`
  ];

  const deleteEndpoints = [
    `${baseURL}/api-lite/cfdis/${facturamaId}`,
    `${baseURL}/api-lite/3/cfdis/${facturamaId}`,
    `${baseURL}/api/Cfdi/${facturamaId}`
  ];

  const isTransientError = (err) => {
    if (!err) return false;
    const status = err?.response?.status;
    if (!isNaN(status)) {
      if (status === 429) return true; // rate limit
      if (status >= 500 && status < 600) return true; // server errors
    }
    const msg = String(err?.response?.data?.Message || err?.response?.data || err?.message || '').toLowerCase();
    return /intentar|más tarde|mas tarde|try again|temporar|timeout|timed out|rate limit/.test(msg);
  };

  // 1) GET previo: comprobar existencia
  let metadata = null;
  for (const url of getEndpoints) {
    try {
      console.log('[Facturama Multi] GET comprobación CFDI:', url);
      const resp = await axios.get(url, { headers: basicHeaders(), timeout: 20000 });
      metadata = resp.data;
      console.log('[Facturama Multi] CFDI encontrado en Facturama:', { id: facturamaId, info: (metadata?.Uuid || metadata?.Id) });
      break;
    } catch (err) {
      const status = err?.response?.status;
      const data = err?.response?.data;
      if (status === 404) {
        console.warn('[Facturama Multi] GET 404: CFDI no encontrado en:', url);
        // si estamos en sandbox puede ser esperado; no devolver error todavía
        if (isSandbox) {
          console.warn('[Facturama Multi] Entorno sandbox: recurso no persistido posiblemente. Procederemos a intentar DELETE en caso de que la API lo acepte.');
          metadata = null;
          break;
        }
        throw { Message: `CFDI no encontrado en Facturama para id: ${facturamaId}`, Details: data };
      }

      if (isTransientError(err)) {
        console.warn('[Facturama Multi] GET transitorio, reintentando en 500ms...', err.response?.data || err.message);
        await sleep(500);
        continue;
      }

      console.error('[Facturama Multi] Error GET comprobación:', err.response?.data || err.message || err);
      // seguir probando siguientes endpoints
    }
  }

  // 2) Intentar DELETE con reintentos y fallback entre endpoints
  let lastErr = null;
  for (const url of deleteEndpoints) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[Facturama Multi] DELETE intento ${attempt}/${maxRetries} -> ${url} params=${JSON.stringify(params)}`);
        const resp = await axios.delete(url, { headers: basicHeaders(), params, timeout: 20000 });
        console.log('[Facturama Multi] DELETE OK:', { url, status: resp.status, data: resp.data });
        return resp.data;
      } catch (err) {
        lastErr = err;
        const status = err?.response?.status;
        const data = err?.response?.data;

        // 404 -> no existe
        if (status === 404) {
          console.error('[Facturama Multi] DELETE 404: CFDI no encontrado para id:', facturamaId, 'URL:', url);
          if (isSandbox) {
            console.warn('[Facturama Multi] Sandbox: tratar como no crítico y devolver resultado informativo.');
            return { Message: 'CFDI not found in Facturama (sandbox). Nothing to cancel.', Details: data };
          }
          throw { Message: `CFDI no encontrado en Facturama para id: ${facturamaId}`, Details: data };
        }

        // Si es transitorio -> backoff y reintento
        if (isTransientError(err) && attempt < maxRetries) {
          const delay = 500 * Math.pow(2, attempt - 1);
          console.warn(`[Facturama Multi] Error transitorio en DELETE. Reintentando en ${delay}ms...`, data || err.message);
          await sleep(delay);
          continue;
        }

        // Si el mensaje de Facturama es explícito, propagar
        if (data && (data.Message || data.message)) {
          console.error('[Facturama Multi] Facturama message al borrar:', data);
          throw data;
        }

        // No reintentable -> break para intentar siguiente endpoint
        console.error('[Facturama Multi] Error DELETE no recuperable en URL:', url, data || err.message || err);
        break;
      }
    }
  }

  console.error('[Facturama Multi] Reintentos agotados o no se pudo cancelar CFDI. Último error:', lastErr?.response?.data || lastErr?.message || lastErr);
  throw lastErr || { Message: 'No se pudo cancelar el CFDI en Facturama' };
};

// ─── Subir CSD de una empresa ────────────────────────────────────────
// Subir CSD: ahora acepta un parámetro opcional `authBase64` para subir el CSD
// a una cuenta específica (útil para cuentas por-empresa).
exports.subirCSD = async (cerBase64, keyBase64, passwordCsd, rfc, authBase64 = null) => {
  try {
    console.log('[Facturama Multi] Subiendo CSD para RFC:', rfc, 'using auth:', authBase64 ? '[per-account]' : '[global]');
    const csdData = {
      Certificate: cerBase64,
      PrivateKey: keyBase64,
      PrivateKeyPassword: passwordCsd,
      Rfc: rfc
    };

    const response = await axios.post(
      `${baseURL}/api-lite/csds`,
      csdData,
      { headers: jsonHeaders(authBase64) }
    );

    console.log('[Facturama Multi] CSD subido:', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error('[Facturama Multi] Error subiendo CSD:', error.response?.data || error.message);
    throw error.response?.data || error;
  }
};

// ─── Listar CSDs cargados ────────────────────────────────────────────
exports.listarCSDs = async (authBase64) => {
  try {
    // Log which username we'll use for the lookup (no passwords in logs)
    try {
      const ab = authBase64 || auth;
      const decoded = Buffer.from(ab, 'base64').toString('utf8');
      const uname = decoded.split(':')[0] || 'unknown';
      console.log('[Facturama Multi] listarCSDs usando credencial:', uname);
    } catch (e) {
      // ignore logging errors
    }
    const response = await axios.get(
      `${baseURL}/api-lite/csds`,
      { headers: basicHeaders(authBase64) }
    );
    return response.data || [];
  } catch (error) {
    console.error('[Facturama Multi] Error listando CSDs:', error.response?.data || error.message);
    throw error.response?.data || error;
  }
};

// ─── Eliminar CSD ───────────────────────────────────────────────────
exports.eliminarCSD = async (rfc) => {
  try {
    const response = await axios.delete(
      `${baseURL}/api-lite/csds/${rfc}`,
      { headers: basicHeaders() }
    );
    return response.data;
  } catch (error) {
    console.error('[Facturama Multi] Error eliminando CSD:', error.response?.data || error.message);
    throw error.response?.data || error;
  }
};

// ══════════════════════════════════════════════════════════════════════
//  FUNCIÓN PRINCIPAL: Crear Factura Multiemisor
//  Recibe los datos CFDI y el companyId, arma el body y timbra
// ══════════════════════════════════════════════════════════════════════
exports.crearFactura = async (cfdiData, companyId, options = {}) => {
  const factura = await buildFacturaPayload(cfdiData, companyId);

  if (!(await getCompanyFacturacionStatus(companyId)).emisor.CsdCargado) {
    console.warn(`[Facturama Multi] ADVERTENCIA: CSD no marcado como cargado para empresa ${companyId}. Se intentará timbrar de todas formas.`);
  }

  // Intentar usar credenciales Facturama específicas de la empresa si están en BD
  try {
    const emisor = await getEmisorData(companyId);
    if (emisor && emisor.FacturamaUser && emisor.FacturamaPassword) {
      try {
        const authBase64 = Buffer.from(`${String(emisor.FacturamaUser)}:${String(emisor.FacturamaPassword)}`).toString('base64');
        console.log('[Facturama Multi] Usando credenciales Facturama por-empresa para timbrado, Company_Id:', companyId);
        return await exports.timbrarMultiemisor(factura, Object.assign({}, options, { authBase64 }));
      } catch (e) {
        console.warn('[Facturama Multi] Timbrado con credenciales por-empresa falló, caeremos a comportamiento normal:', e?.message || e);
      }
    }
  } catch (e) {
    console.warn('[Facturama Multi] No fue posible obtener credenciales por-empresa:', e?.message || e);
  }

  return exports.timbrarMultiemisor(factura, options);
};

// ─── Crear Nota de Crédito Multiemisor ───────────────────────────────
exports.crearNotaCredito = async (cfdiData, options = {}) => {
  return exports.timbrarMultiemisor(cfdiData, options);
};

// ─── Crear Complemento de Pago Multiemisor ───────────────────────────
exports.crearComplementoPago = async (cfdiData, options = {}) => {
  return exports.timbrarMultiemisor(cfdiData, options);
};

// ─── Consultar estatus de CFDI en el SAT ─────────────────────────────
exports.consultarEstatusSAT = async (rfc, uuid) => {
  try {
    const response = await axios.get(
      `${baseURL}/api/Cfdi/status`,
      {
        params: { rfcEmisor: rfc, uuid },
        headers: basicHeaders()
      }
    );
    return response.data;
  } catch (error) {
    console.error('[Facturama] Error consultando SAT:', error.response?.data || error.message);
    throw error.response?.data || error;
  }
};

// ─── Catálogos SAT ───────────────────────────────────────────────────
exports.searchProductsOrServices = async (keyword) => {
  try {
    const response = await axios.get(
      `${baseURL}/Catalogs/ProductsOrServices`,
      {
        params: { keyword },
        headers: basicHeaders(),
      }
    );
    return response.data || [];
  } catch (error) {
    console.error("Error Facturama ProductsOrServices:", error.response?.data || error.message);
    throw error.response?.data || error;
  }
};

exports.searchUnits = async (keyword) => {
  try {
    const response = await axios.get(
      `${baseURL}/Catalogs/Units`,
      {
        params: { keyword },
        headers: basicHeaders(),
      }
    );
    return response.data || [];
  } catch (error) {
    console.error("Error Facturama Units:", error.response?.data || error.message);
    throw error.response?.data || error;
  }
};

// Exportar helper para que lo usen otros módulos
exports.getEmisorData = getEmisorData;
exports.getCompanyFacturacionStatus = getCompanyFacturacionStatus;
exports.buildFacturaPayload = buildFacturaPayload;
exports.getAuthHeaders = jsonHeaders;
exports.getBasicHeaders = basicHeaders;