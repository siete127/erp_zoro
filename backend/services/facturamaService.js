const axios = require("axios");
const { poolPromise, sql } = require('../config/db');

const baseURL = process.env.FACTURAMA_BASE_URL;

// Credenciales de la cuenta principal desde .env
const auth = Buffer.from(`${process.env.FACTURAMA_USER}:${process.env.FACTURAMA_PASSWORD}`).toString('base64');

// ─── Headers reutilizables ────────────────────────────────────────────
const jsonHeaders = () => ({
  Authorization: `Basic ${auth}`,
  'Content-Type': 'application/json',
});
const basicHeaders = () => ({
  Authorization: `Basic ${auth}`,
});

// ─── Obtener datos fiscales del emisor desde BD ──────────────────────
const getEmisorData = async (companyId) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('Company_Id', sql.Int, companyId)
      .query(`
        SELECT RFC, LegalName, FiscalRegime, TaxZipCode, CsdCargado, Email
        FROM ERP_COMPANY
        WHERE Company_Id = @Company_Id
      `);
    
    if (result.recordset.length === 0) {
      throw new Error('Empresa no encontrada');
    }
    
    const company = result.recordset[0];
    
    return {
      Rfc: company.RFC,
      Name: company.LegalName,
      FiscalRegime: company.FiscalRegime || '601',
      TaxZipCode: company.TaxZipCode || '64000',
      CsdCargado: company.CsdCargado,
      Email: company.Email
    };
  } catch (error) {
    console.error('Error obteniendo datos del emisor:', error);
    throw error;
  }
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
exports.timbrarMultiemisor = async (cfdiBody) => {
  try {
    console.log('[Facturama Multi] Timbrando CFDI para RFC:', cfdiBody.Issuer?.Rfc);
    console.log('[Facturama Multi] Body:', JSON.stringify(cfdiBody, null, 2));

    const response = await axios.post(
      `${baseURL}/2/cfdis`,
      cfdiBody,
      { headers: jsonHeaders() }
    );

    console.log('[Facturama Multi] RESPONSE:');
    console.log(JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error('[Facturama Multi] Error:', error.response?.data || error.message);
    throw error.response?.data || error;
  }
};

/**
 * Timbrar factura legacy (API normal /api/Cfdi) - se mantiene por compatibilidad
 */
exports.timbrarFactura = async (factura) => {
  try {
    const response = await axios.post(
      `${baseURL}/api/Cfdi`,
      factura,
      { headers: jsonHeaders() }
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
    // Intentar primero con la API multiemisor
    try {
      const response = await axios.get(
        `${baseURL}/cfdi/pdf/issuedLite/${cfdiId}`,
        {
          headers: basicHeaders(),
          responseType: 'arraybuffer'
        }
      );
      console.log('PDF descargado (multiemisor), tamaño:', response.data.length);
      return response.data;
    } catch (multiErr) {
      // Fallback a API normal
      console.log('Fallback a API normal para PDF');
      const response = await axios.get(
        `${baseURL}/api/cfdi`,
        {
          params: { cfdiType: 'issued', cfdiId: cfdiId, format: 'pdf' },
          headers: basicHeaders(),
          responseType: 'arraybuffer'
        }
      );
      console.log('PDF descargado (normal), tamaño:', response.data.length);
      return response.data;
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

// ─── Descargar XML (Multiemisor: /api/Cfdi/xml/issuedLite/{id}) ──────
exports.descargarXML = async (cfdiId) => {
  try {
    // Intentar primero con la API multiemisor
    try {
      const response = await axios.get(
        `${baseURL}/api/Cfdi/xml/issuedLite/${cfdiId}`,
        {
          headers: basicHeaders(),
          responseType: 'arraybuffer'
        }
      );
      return response.data;
    } catch (multiErr) {
      // Fallback a API normal
      const response = await axios.get(
        `${baseURL}/api/Cfdi/${cfdiId}/xml`,
        {
          headers: basicHeaders(),
          responseType: 'arraybuffer'
        }
      );
      return response.data;
    }
  } catch (error) {
    console.error("Error descargando XML:", error.response?.data || error.message);
    throw error.response?.data || error;
  }
};

// ─── Cancelar CFDI Multiemisor ───────────────────────────────────────
exports.cancelarCFDI = async (cfdiId, motivo = '02', folioSustitucion = null) => {
  try {
    console.log('[Facturama Multi] Cancelando CFDI:', cfdiId);
    const url = `${baseURL}/2/cfdis/${cfdiId}`;
    const params = { motive: motivo };
    if (folioSustitucion) params.uuidReplacement = folioSustitucion;

    const response = await axios.delete(url, {
      params,
      headers: basicHeaders()
    });
    return response.data;
  } catch (error) {
    console.error('[Facturama Multi] Error cancelando:', error.response?.data || error.message);
    throw error.response?.data || error;
  }
};

// ─── Subir CSD de una empresa ────────────────────────────────────────
exports.subirCSD = async (cerBase64, keyBase64, passwordCsd, rfc) => {
  try {
    console.log('[Facturama Multi] Subiendo CSD para RFC:', rfc);
    const csdData = {
      Certificate: cerBase64,
      PrivateKey: keyBase64,
      PrivateKeyPassword: passwordCsd,
      Rfc: rfc
    };

    const response = await axios.post(
      `${baseURL}/api/multiemisor/csd`,
      csdData,
      { headers: jsonHeaders() }
    );

    console.log('[Facturama Multi] CSD subido:', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error('[Facturama Multi] Error subiendo CSD:', error.response?.data || error.message);
    throw error.response?.data || error;
  }
};

// ─── Listar CSDs cargados ────────────────────────────────────────────
exports.listarCSDs = async () => {
  try {
    const response = await axios.get(
      `${baseURL}/api/multiemisor/csd`,
      { headers: basicHeaders() }
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
      `${baseURL}/api/multiemisor/csd/${rfc}`,
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
exports.crearFactura = async (cfdiData, companyId) => {
  const emisor = await getEmisorData(companyId);

  if (!emisor.CsdCargado) {
    console.warn(`[Facturama Multi] ADVERTENCIA: CSD no marcado como cargado para empresa ${companyId} (${emisor.Rfc}). Se intentará timbrar de todas formas.`);
  }
  
  const factura = {
    Issuer: {
      Rfc: emisor.Rfc,
      Name: emisor.Name,
      FiscalRegime: emisor.FiscalRegime,
    },
    CfdiType: "I",
    NameId: "1",
    ExpeditionPlace: emisor.TaxZipCode,
    PaymentForm: cfdiData.FormaPago || "01",
    PaymentMethod: cfdiData.MetodoPago || "PUE",
    Currency: cfdiData.Moneda || "MXN",
    Receiver: {
      Rfc: cfdiData.Receptor.Rfc,
      Name: cfdiData.Receptor.Nombre,
      CfdiUse: cfdiData.Receptor.UsoCfdi,
      Email: cfdiData.Receptor.Email || emisor.Email || "renteria27lr@gmail.com",
      FiscalRegime: cfdiData.Receptor.FiscalRegime || "616",
      TaxZipCode: cfdiData.Receptor.TaxZipCode || "64000",
    },
    Items: (cfdiData.Conceptos || []).map((item) => {
      const traslados = (item.Impuestos && item.Impuestos.Traslados) || [];
      const iva = traslados[0];

      return {
        ProductCode: item.ClaveProdServ || "01010101",
        UnitCode: item.ClaveUnidad || "E48",
        Unit: item.Unidad || "Pieza",
        Description: item.Descripcion,
        Quantity: item.Cantidad,
        UnitPrice: item.ValorUnitario,
        Subtotal: item.Importe,
        Taxes: iva
          ? [
              {
                Name: "IVA",
                IsRetention: false,
                Base: iva.Base,
                Rate: Number(iva.TasaOCuota || 0.16),
                Total: iva.Importe,
                Type: "Federal",
              },
            ]
          : [],
      };
    }),
  };

  // Usar API multiemisor
  return exports.timbrarMultiemisor(factura);
};

// ─── Crear Nota de Crédito Multiemisor ───────────────────────────────
exports.crearNotaCredito = async (cfdiData) => {
  return exports.timbrarMultiemisor(cfdiData);
};

// ─── Crear Complemento de Pago Multiemisor ───────────────────────────
exports.crearComplementoPago = async (cfdiData) => {
  return exports.timbrarMultiemisor(cfdiData);
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
exports.getAuthHeaders = jsonHeaders;
exports.getBasicHeaders = basicHeaders;