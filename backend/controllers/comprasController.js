/**
 * comprasController.js
 * Módulo de Compras:
 *   - CRUD de Órdenes de Compra (cabecera + detalle)
 *   - Doble autorización
 *   - Registro directo con factura (compra sin OC)
 *   - PDF de Orden de Compra
 */
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const XLSX = require('xlsx');
const { pool, sql } = require('../config/db');
const pdfService = require('../services/comprasPdfService');
const { updateAverageCostFromReceipt } = require('../services/inventoryValuationService');

const DEFAULT_IVA_RATE = 16.0;
const PROVEEDOR_NOMBRE_SQL = "COALESCE(NULLIF(cl.CommercialName, ''), cl.LegalName)";

/* ─────────────────────────────────────────────────────
   UTILIDADES
───────────────────────────────────────────────────── */
async function getNextNumeroOC(companyId) {
  const r = await pool.request()
    .input('Company_Id', sql.Int, companyId)
    .query(`
      SELECT COUNT(*) AS Total
      FROM ERP_COMPRA_ORDEN
      WHERE Company_Id = @Company_Id
    `);
  const seq = (r.recordset[0].Total || 0) + 1;
  return `OC-${String(companyId).padStart(3, '0')}-${String(seq).padStart(5, '0')}`;
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function parseNumericValue(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  let raw = String(value || '').trim();
  if (!raw) return 0;

  raw = raw.replace(/[^\d,.-]/g, '');
  if (!raw) return 0;

  const lastComma = raw.lastIndexOf(',');
  const lastDot = raw.lastIndexOf('.');

  if (lastComma > -1 && lastDot > -1) {
    raw = lastComma > lastDot
      ? raw.replace(/\./g, '').replace(',', '.')
      : raw.replace(/,/g, '');
  } else if (lastComma > -1) {
    const commaCount = (raw.match(/,/g) || []).length;
    raw = commaCount === 1 ? raw.replace(',', '.') : raw.replace(/,/g, '');
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function tokenize(value) {
  return normalizeText(value)
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length > 2);
}

const SHEET_FIELD_ALIASES = {
  codigo: ['codigo', 'clave', 'sku', 'item', 'articulo', 'producto', 'material', 'codigoproveedor'],
  descripcion: ['descripcion', 'concepto', 'producto descripcion', 'articulo descripcion', 'nombre', 'material descripcion', 'descripcion material'],
  cantidad: ['cantidad', 'cant', 'qty', 'unidades', 'kgs', 'kg', 'cantidad facturada'],
  precio: ['precio', 'precio unitario', 'costo', 'costo unitario', 'unit price', 'importe unitario', 'valor unitario'],
  iva: ['iva', 'iva%', 'impuesto', 'tasa iva', 'porcentaje iva'],
};

function detectSheetFields(headerRow) {
  const normalizedHeaders = headerRow.map((header) => normalizeText(header));
  const mapping = {};

  Object.entries(SHEET_FIELD_ALIASES).forEach(([field, aliases]) => {
    const index = normalizedHeaders.findIndex((header) => aliases.includes(header));
    if (index >= 0) mapping[field] = index;
  });

  return mapping;
}

function extractRowsFromSupplierSheet(fileBuffer) {
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];

  const sheet = workbook.Sheets[firstSheetName];
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: false, raw: false });
  if (!matrix.length) return [];

  let bestHeaderIndex = 0;
  let bestScore = -1;

  matrix.slice(0, 10).forEach((row, index) => {
    const mapping = detectSheetFields(row);
    const score = Object.keys(mapping).length;
    if (score > bestScore) {
      bestScore = score;
      bestHeaderIndex = index;
    }
  });

  const headerRow = matrix[bestHeaderIndex] || [];
  const mapping = detectSheetFields(headerRow);

  return matrix
    .slice(bestHeaderIndex + 1)
    .map((row, index) => {
      const codigo = mapping.codigo !== undefined ? row[mapping.codigo] : '';
      const descripcion = mapping.descripcion !== undefined ? row[mapping.descripcion] : '';
      const cantidad = mapping.cantidad !== undefined ? parseNumericValue(row[mapping.cantidad]) : 0;
      const precio = mapping.precio !== undefined ? parseNumericValue(row[mapping.precio]) : 0;
      const iva = mapping.iva !== undefined ? parseNumericValue(row[mapping.iva]) : DEFAULT_IVA_RATE;

      return {
        rowNumber: bestHeaderIndex + index + 2,
        codigo: String(codigo || '').trim(),
        descripcion: String(descripcion || '').trim(),
        cantidad: cantidad || 0,
        precio: precio || 0,
        iva: iva || DEFAULT_IVA_RATE,
      };
    })
    .filter((row) => row.codigo || row.descripcion || row.cantidad > 0 || row.precio > 0);
}

function isNumericToken(token) {
  return /^[-$]?[\d.,]+%?$/.test(String(token || '').trim());
}

/* =============================================================
   PDF PARSERS — SAT CFDI INVOICE FORMATS
   FORMAT A — ADHEMPA (GAD...)      : single dense row
   FORMAT B — QUIMICA UNIVALIX (QUN...): qty+zeros+code / desc / unit
   FORMAT C — SMURFIT (SCP...)      : decimal-qty block + multi-line desc + price
   FALLBACK  — generic heuristic
============================================================= */

const NOISE_PATTERNS = [
  /subtotal/i,
  /^total$/i,
  /importe total/i,
  /folio fiscal/i,
  /fecha.*certif/i,
  /metodo de pago/i,
  /forma de pago/i,
  /cadena original/i,
  /sello digital/i,
  /numero de serie/i,
  /uso del cfdi/i,
  /regimen fiscal/i,
  /tipo comprobante/i,
  /lugar de expedicion/i,
  /^r\.f\.c\./i,
  /^rfc:/i,
  /domicilio fiscal/i,
  /^serie:/i,
  /^folio:/i,
  /^fecha y hora/i,
  /observaciones/i,
  /favor de pagar/i,
  /transferencia bancaria/i,
  /^impuesto:/i,
  /^descripci/i,
  /^cantidadunidad/i,
  /^clav[e]/i,
  /^sat$/i,
  /^unidad$/i,
  /\|\|\|1\.1\|/,
];

function isNoiseLine(line) {
  const n = normalizeText(line);
  if (n.length < 2) return true;
  // UUID line
  if (/^[0-9a-f]{8}-[0-9a-f]{4}/i.test(line)) return true;
  // long certificate serial
  if (/^\d{17,}$/.test(n.replace(/\s/g, ''))) return true;
  return NOISE_PATTERNS.some((re) => re.test(line));
}

/**
 * FORMAT C — Smurfit Cartón y Papel de México (SCP900125TT8)
 * Each item block:
 *   Line 0: "<qty><SAT_unit_code><SAT_prod_code>TO"  e.g. "1.16414122100TO"
 *   Lines 1-N: description parts                    e.g. "BOBINA LINER ENCOLADO SCPM"
 *   Then: "$unit_price$total"                        e.g. "$10,500.00$12,222.00"
 */
function parseSmurfitBlocks(lines) {
  // Block start: decimal number + 7+ digits + optional unit abbrev
  const BLOCK_START = /^(\d+\.\d+)\d{7,}(?:TO|KG|LT|PZ|UN)?$/i;
  // Price line: two dollar amounts fused e.g. "$10,500.00$12,222.00"
  const PRICE_LINE  = /^\$([\d,]+\.\d{2})\$([\d,]+\.\d{2})$/;

  const results = [];
  let i = 0;
  while (i < lines.length) {
    const m = BLOCK_START.exec(lines[i]);
    if (m) {
      const qty = parseFloat(m[1]);
      const descParts = [];
      let precio = 0;
      let j = i + 1;
      while (j < lines.length && j < i + 10) {
        const stripped = lines[j].replace(/\s/g, '');
        const pm = PRICE_LINE.exec(stripped);
        if (pm) {
          precio = parseNumericValue(pm[1]); // unit price
          j++;
          break;
        }
        if (BLOCK_START.test(lines[j])) break;
        if (!isNoiseLine(lines[j]) && lines[j].length > 2) {
          descParts.push(lines[j].trim());
        }
        j++;
      }
      const descripcion = descParts.join(' ').trim();
      if (descripcion && qty > 0) {
        results.push({
          rowNumber: i + 1,
          codigo: '',
          descripcion,
          cantidad: qty,
          precio,
          iva: DEFAULT_IVA_RATE,
        });
      }
      i = j;
    } else {
      i++;
    }
  }
  return results;
}

/**
 * FORMAT B — Quimica Univalix (QUN050509178)
 * Each item:
 *   Line 0: "<qty>000...<supplier_code>"  e.g. "100.00005089-2511-360"
 *   Line 1: "<prod_code><desc>0.00<unit_price><importe>"  e.g. "UNIVM 50890.0015.00001,500.00"
 *   Line 2: unit abbreviation  e.g. "KG" or "5 CUB"
 */
function parseUnivalixBlocks(lines) {
  // Line 0 pattern: number + 3+ zeros (padding) + alphanumeric code
  const ROW_START = /^(\d+(?:\.\d+)?)0{3,}[\w-]+/;

  const results = [];
  let i = 0;
  while (i < lines.length) {
    if (ROW_START.test(lines[i])) {
      const qtyMatch = lines[i].match(/^(\d+(?:\.\d+)?)/);
      const qty = qtyMatch ? parseFloat(qtyMatch[1]) : 0;

      // Supplier code at end of line after zero-padding
      const codeMatch = lines[i].match(/0{3,}([\w-]+)$/);
      const codigoProveedor = codeMatch ? codeMatch[1] : '';

      const descLine = (lines[i + 1] || '').trim();
      if (descLine) {
        // Split on whitespace, isolate trailing numeric tokens
        const parts = descLine.split(/\s+/);
        let descEnd = parts.length;
        for (let k = parts.length - 1; k >= 1; k--) {
          if (!isNumericToken(parts[k])) {
            descEnd = k + 1;
            break;
          }
        }
        const descripcion = parts.slice(0, descEnd).join(' ').trim() || descLine;
        const numericValues = parts
          .slice(descEnd)
          .map(parseNumericValue)
          .filter((v) => v > 0);
        // unit price = second-to-last number; importe = last
        const precio = numericValues.length >= 2
          ? numericValues[numericValues.length - 2]
          : (numericValues[0] || 0);

        results.push({
          rowNumber: i + 1,
          codigo: codigoProveedor,
          descripcion,
          cantidad: qty > 0 ? qty : 1,
          precio,
          iva: DEFAULT_IVA_RATE,
        });
      }
      i += 3;
    } else {
      i++;
    }
  }
  return results;
}

/**
 * FORMAT A — Adhempa / GRUPO ADHEMPA (GAD0307043D4)
 * Dense single line: "5,500PC 3020PC 30200.009.00000049,500.00KGMKG31201610"
 * qty + alpha-num code + misc numbers + total_price + unit letters
 */
function parseAdhempaBlocks(lines) {
  // Pattern: number (qty) + uppercase letters + digits (code) + ... + last price dd,ddd.dd + uppercase tail
  const DENSE = /^([\d,]+(?:\.\d+)?)([A-Z]{1,5}\s*\d{1,5}(?:\s*[A-Z]{0,5}\s*\d{0,5})*)(.*?)([\d,]+\.\d{2})[A-Z]/;
  const results = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = DENSE.exec(line);
    if (m) {
      const qty = parseNumericValue(m[1]);
      const codigo = m[2].replace(/\s+/g, ' ').trim();
      const totalPrice = parseNumericValue(m[4]);
      if (qty > 0 && totalPrice > 0) {
        results.push({
          rowNumber: i + 1,
          codigo,
          descripcion: codigo,
          cantidad: qty,
          precio: Math.round((totalPrice / qty) * 100) / 100,
          iva: DEFAULT_IVA_RATE,
        });
      }
    }
  }
  return results;
}

/**
 * GENERIC FALLBACK — simple line-by-line heuristic
 */
function parseGenericPdfLines(lines) {
  const results = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isNoiseLine(line)) continue;
    const tokens = line.split(/\s+/);
    const nums = tokens
      .filter(isNumericToken)
      .map(parseNumericValue)
      .filter((v) => v > 0 && v < 1e9);
    const textTokens = tokens.filter(
      (t) => !isNumericToken(t) && t.length > 2 && /[a-zA-Z]/.test(t),
    );
    if (nums.length < 1 || textTokens.length < 1) continue;
    if (nums.length === 1 && nums[0] > 10000) continue;
    const qty = nums[0];
    const precio = nums.length >= 2 ? nums[nums.length - 1] : 0;
    const descripcion = textTokens.join(' ').trim();
    const codeCandidate = tokens[0];
    const codigo = /^[A-Z0-9][\w-]{1,20}$/.test(codeCandidate) ? codeCandidate : '';
    if (descripcion) {
      results.push({
        rowNumber: i + 1,
        codigo,
        descripcion,
        cantidad: qty > 0 ? qty : 1,
        precio,
        iva: DEFAULT_IVA_RATE,
      });
    }
  }
  return results;
}

/**
 * Master PDF extractor: detects format and routes to the right parser.
 */
async function extractRowsFromSupplierPdf(fileBuffer) {
  const pdfData = await pdfParse(fileBuffer);
  const lines = String(pdfData.text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // FORMAT C signature: lines like "1.16414122100TO" (decimal + 7+ digits + TO/KG)
  const smurfitSig = lines.filter((l) => /^\d+\.\d+\d{7,}(?:TO|KG|LT|PZ|UN)?$/i.test(l));
  if (smurfitSig.length >= 2) {
    const rows = parseSmurfitBlocks(lines);
    if (rows.length > 0) return rows;
  }

  // FORMAT B signature: lines like "100.00005089-2511-360"
  const univalixSig = lines.filter((l) => /^\d+(?:\.\d+)?0{3,}[\w-]/.test(l));
  if (univalixSig.length >= 1) {
    const rows = parseUnivalixBlocks(lines);
    if (rows.length > 0) return rows;
  }

  // FORMAT A signature: line starting with digits+commas then uppercase letter
  const adhempaSig = lines.filter((l) => /^[\d,]+[A-Z]/.test(l) && l.length > 20);
  if (adhempaSig.length >= 1) {
    const rows = parseAdhempaBlocks(lines);
    if (rows.length > 0) return rows;
  }

  // GENERIC FALLBACK
  return parseGenericPdfLines(lines);
}


async function extractRowsFromSupplierDocument(fileBuffer, extension) {
  if (extension === '.pdf') {
    return extractRowsFromSupplierPdf(fileBuffer);
  }

  return extractRowsFromSupplierSheet(fileBuffer);
}

function buildMateriaPrimaIndex(rows) {
  return rows.map((row) => ({
    ...row,
    codigoNorm: normalizeText(row.Codigo),
    nombreNorm: normalizeText(row.Nombre),
    descripcionNorm: normalizeText(row.Descripcion),
    tokens: Array.from(new Set([
      ...tokenize(row.Codigo),
      ...tokenize(row.Nombre),
      ...tokenize(row.Descripcion),
    ])),
  }));
}

function findBestMateriaPrimaMatch(sourceRow, materiaPrimaIndex) {
  const codigoNorm = normalizeText(sourceRow.codigo);
  const descripcionNorm = normalizeText(sourceRow.descripcion);
  const sourceTokens = Array.from(new Set([
    ...tokenize(sourceRow.codigo),
    ...tokenize(sourceRow.descripcion),
  ]));

  let best = null;

  for (const materiaPrima of materiaPrimaIndex) {
    let score = 0;

    if (codigoNorm && materiaPrima.codigoNorm === codigoNorm) score += 120;
    if (codigoNorm && materiaPrima.codigoNorm && (materiaPrima.codigoNorm.includes(codigoNorm) || codigoNorm.includes(materiaPrima.codigoNorm))) score += 45;
    if (descripcionNorm && materiaPrima.nombreNorm === descripcionNorm) score += 100;
    if (descripcionNorm && materiaPrima.descripcionNorm === descripcionNorm) score += 85;
    if (descripcionNorm && materiaPrima.nombreNorm && (descripcionNorm.includes(materiaPrima.nombreNorm) || materiaPrima.nombreNorm.includes(descripcionNorm))) score += 55;
    if (descripcionNorm && materiaPrima.descripcionNorm && (descripcionNorm.includes(materiaPrima.descripcionNorm) || materiaPrima.descripcionNorm.includes(descripcionNorm))) score += 40;

    const tokenMatches = sourceTokens.filter((token) => materiaPrima.tokens.includes(token)).length;
    score += tokenMatches * 12;

    if (!best || score > best.score) {
      best = { materiaPrima, score };
    }
  }

  if (!best || best.score < 36) return null;

  return {
    ...best.materiaPrima,
    confidence: Math.min(100, Math.round((best.score / 120) * 100)),
  };
}

/* ─────────────────────────────────────────────────────
   10.1 ANALIZAR HOJA DE PROVEEDOR PARA REGISTRO DIRECTO
   POST /api/compras/registro-directo/analizar-hoja
   form-data: hojaProveedor
───────────────────────────────────────────────────── */
exports.analizarHojaProveedorRegistroDirecto = async (req, res) => {
  try {
    await pool.connect();

    if (!req.files || !req.files.hojaProveedor) {
      return res.status(400).json({ success: false, message: 'Debe cargar el archivo en el campo hojaProveedor' });
    }

    const hojaProveedor = req.files.hojaProveedor;
    const extension = path.extname(hojaProveedor.name || '').toLowerCase();
    const allowedExtensions = ['.xlsx', '.xls', '.csv', '.pdf'];

    if (!allowedExtensions.includes(extension)) {
      return res.status(400).json({ success: false, message: 'Solo se permiten archivos Excel, CSV o PDF (.xlsx, .xls, .csv, .pdf)' });
    }

    const sourceRows = await extractRowsFromSupplierDocument(hojaProveedor.data, extension);
    if (!sourceRows.length) {
      return res.status(400).json({ success: false, message: 'No se detectaron renglones utilizables en el archivo del proveedor' });
    }

    const materiaPrimaResult = await pool.request().query(`
      SELECT MateriaPrima_Id, Codigo, Nombre, Descripcion, CostoUnitario, Moneda
      FROM ERP_MATERIA_PRIMA
      WHERE ISNULL(Activo, 1) = 1
      ORDER BY Nombre
    `);

    const materiaPrimaIndex = buildMateriaPrimaIndex(materiaPrimaResult.recordset || []);

    const items = sourceRows.map((row) => {
      const match = findBestMateriaPrimaMatch(row, materiaPrimaIndex);
      const precioCompra = row.precio > 0 ? row.precio : Number(match?.CostoUnitario || 0);

      if (match) {
        return {
          Tipo: 'mp',
          MateriaPrima_Id: match.MateriaPrima_Id,
          Producto_Id: '',
          Descripcion: match.Nombre || row.descripcion || row.codigo,
          Cantidad: row.cantidad > 0 ? row.cantidad : 1,
          PrecioCompra: precioCompra,
          IVA: row.iva || DEFAULT_IVA_RATE,
          ReferenciaProveedor: row.codigo || '',
          DescripcionProveedor: row.descripcion || '',
          MatchNombre: match.Nombre,
          MatchCodigo: match.Codigo,
          MatchConfidence: match.confidence,
          RowNumber: row.rowNumber,
        };
      }

      return {
        Tipo: 'otro',
        MateriaPrima_Id: '',
        Producto_Id: '',
        Descripcion: row.descripcion || row.codigo || `Renglón ${row.rowNumber}`,
        Cantidad: row.cantidad > 0 ? row.cantidad : 1,
        PrecioCompra: precioCompra,
        IVA: row.iva || DEFAULT_IVA_RATE,
        ReferenciaProveedor: row.codigo || '',
        DescripcionProveedor: row.descripcion || '',
        MatchConfidence: 0,
        RowNumber: row.rowNumber,
      };
    });

    const materiasLigadas = items.filter((item) => item.Tipo === 'mp').length;

    return res.json({
      success: true,
      data: {
        items,
        resumen: {
          archivo: hojaProveedor.name,
          lineasDetectadas: items.length,
          materiasLigadas,
          lineasPendientes: items.length - materiasLigadas,
        },
      },
    });
  } catch (err) {
    console.error('compras.analizarHojaProveedorRegistroDirecto', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/* ─────────────────────────────────────────────────────
   1. LISTAR ÓRDENES DE COMPRA
   GET /api/compras/ordenes
───────────────────────────────────────────────────── */
exports.listOrdenes = async (req, res) => {
  try {
    await pool.connect();
    const { Company_Id, Estatus } = req.query;
    const request = pool.request();
    let where = 'WHERE 1=1';

    if (Company_Id) {
      where += ' AND oc.Company_Id = @Company_Id';
      request.input('Company_Id', sql.Int, Number(Company_Id));
    }
    if (Estatus) {
      where += ' AND oc.Estatus = @Estatus';
      request.input('Estatus', sql.NVarChar(30), Estatus);
    }

    const result = await request.query(`
      SELECT
        oc.OC_Id,
        oc.NumeroOC,
        oc.Company_Id,
        c.NameCompany AS Empresa,
        oc.Proveedor_Id,
        ${PROVEEDOR_NOMBRE_SQL} AS Proveedor,
        oc.FechaOC,
        oc.FechaRequerida,
        oc.Moneda,
        oc.Subtotal,
        oc.IVA,
        oc.Total,
        oc.Estatus,
        oc.RequiereDobleAutorizacion,
        oc.FacturaReferencia,
        oc.FacturaArchivoUrl,
        oc.Observaciones,
        oc.CreatedBy,
        oc.CreatedAt,
        oc.UpdatedAt,
        (SELECT COUNT(*) FROM ERP_COMPRA_AUTORIZACION a WHERE a.OC_Id = oc.OC_Id AND a.Aprobado = 1) AS AutorizacionesOtorgadas
      FROM ERP_COMPRA_ORDEN oc
      LEFT JOIN ERP_COMPANY   c  ON oc.Company_Id   = c.Company_Id
      LEFT JOIN ERP_CLIENT    cl ON oc.Proveedor_Id = cl.Client_Id
      ${where}
      ORDER BY oc.CreatedAt DESC
    `);

    return res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error('compras.listOrdenes', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/* ─────────────────────────────────────────────────────
   2. OBTENER ORDEN DE COMPRA (con detalle y autorizaciones)
   GET /api/compras/ordenes/:id
───────────────────────────────────────────────────── */
exports.getOrden = async (req, res) => {
  try {
    await pool.connect();
    const id = Number(req.params.id);
    const request = pool.request().input('OC_Id', sql.Int, id);

    const cabResult = await request.query(`
      SELECT
        oc.*,
        c.NameCompany  AS Empresa,
        ${PROVEEDOR_NOMBRE_SQL} AS Proveedor,
        cl.RFC         AS ProveedorRFC,
        contact.Email  AS ProveedorEmail
      FROM ERP_COMPRA_ORDEN oc
      LEFT JOIN ERP_COMPANY c  ON oc.Company_Id   = c.Company_Id
      LEFT JOIN ERP_CLIENT  cl ON oc.Proveedor_Id = cl.Client_Id
      OUTER APPLY (
        SELECT TOP 1 cc.Email
        FROM ERP_CLIENTCONTACTS cc
        WHERE cc.Client_Id = cl.Client_Id
        ORDER BY cc.IsPrimary DESC, cc.Contact_Id ASC
      ) contact
      WHERE oc.OC_Id = @OC_Id
    `);
    if (!cabResult.recordset.length) {
      return res.status(404).json({ success: false, message: 'Orden de compra no encontrada' });
    }

    const detResult = await pool.request().input('OC_Id', sql.Int, id).query(`
      SELECT
        d.*,
        COALESCE(p.SKU, '')        AS ProductoSKU,
        COALESCE(p.Nombre, '')     AS ProductoNombre,
        COALESCE(mp.Nombre, '')    AS MateriaPrimaNombre
      FROM ERP_COMPRA_ORDEN_DETALLE d
      LEFT JOIN ERP_PRODUCTOS    p  ON d.Producto_Id     = p.Producto_Id
      LEFT JOIN ERP_MATERIA_PRIMA mp ON d.MateriaPrima_Id = mp.MateriaPrima_Id
      WHERE d.OC_Id = @OC_Id
    `);

    const authResult = await pool.request().input('OC_Id', sql.Int, id).query(`
      SELECT
        a.*,
        LTRIM(ISNULL(u.Name, '') + ' ' + ISNULL(u.Lastname, '')) AS AutorizadoPor
      FROM ERP_COMPRA_AUTORIZACION a
      LEFT JOIN ERP_USERS u ON a.User_Id = u.User_Id
      WHERE a.OC_Id = @OC_Id
      ORDER BY a.Nivel
    `);

    return res.json({
      success: true,
      data: {
        ...cabResult.recordset[0],
        detalle: detResult.recordset,
        autorizaciones: authResult.recordset
      }
    });
  } catch (err) {
    console.error('compras.getOrden', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/* ─────────────────────────────────────────────────────
   3. CREAR ORDEN DE COMPRA
   POST /api/compras/ordenes
   Body: { Company_Id, Proveedor_Id, FechaRequerida, Moneda,
           RequiereDobleAutorizacion, Observaciones, items[] }
   items: [{ Producto_Id|MateriaPrima_Id, Descripcion,
             Cantidad, PrecioCompra, IVA }]
───────────────────────────────────────────────────── */
exports.crearOrden = async (req, res) => {
  try {
    await pool.connect();
    const b = req.body || {};
    const items = b.items || [];
    if (!items.length) {
      return res.status(400).json({ success: false, message: 'La orden debe tener al menos un producto' });
    }

    const numeroOC = await getNextNumeroOC(b.Company_Id);

    // Calcular totales
    let subtotal = 0;
    let totalIVA = 0;
    for (const it of items) {
      const sub = Number(it.Cantidad) * Number(it.PrecioCompra);
      const iva = sub * (Number(it.IVA ?? DEFAULT_IVA_RATE) / 100);
      subtotal += sub;
      totalIVA += iva;
    }
    const total = subtotal + totalIVA;

    const createdBy = req.user?.Nombre || req.user?.username || 'Sistema';

    // Insertar cabecera
    const cabRequest = pool.request()
      .input('NumeroOC',                sql.NVarChar(50),   numeroOC)
      .input('Company_Id',              sql.Int,            Number(b.Company_Id))
      .input('Proveedor_Id',            sql.Int,            Number(b.Proveedor_Id))
      .input('FechaRequerida',          sql.DateTime,       b.FechaRequerida ? new Date(b.FechaRequerida) : null)
      .input('Moneda',                  sql.NVarChar(3),    b.Moneda || 'MXN')
      .input('Subtotal',                sql.Decimal(18,2),  subtotal)
      .input('IVA',                     sql.Decimal(18,2),  totalIVA)
      .input('Total',                   sql.Decimal(18,2),  total)
      .input('RequiereDobleAutorizacion', sql.Bit,          b.RequiereDobleAutorizacion !== false ? 1 : 0)
      .input('FacturaReferencia',       sql.NVarChar(100),  b.FacturaReferencia || null)
      .input('Observaciones',           sql.NVarChar(1000), b.Observaciones || null)
      .input('CreatedBy',               sql.NVarChar(100),  createdBy);

    const cabResult = await cabRequest.query(`
      INSERT INTO ERP_COMPRA_ORDEN
        (NumeroOC, Company_Id, Proveedor_Id, FechaRequerida, Moneda, Subtotal, IVA, Total,
         Estatus, RequiereDobleAutorizacion, FacturaReferencia, Observaciones, CreatedBy)
      VALUES
        (@NumeroOC, @Company_Id, @Proveedor_Id, @FechaRequerida, @Moneda, @Subtotal, @IVA, @Total,
         'BORRADOR', @RequiereDobleAutorizacion, @FacturaReferencia, @Observaciones, @CreatedBy);
      SELECT SCOPE_IDENTITY() AS OC_Id;
    `);

    const ocId = cabResult.recordset[0].OC_Id;

    // Insertar detalles
    for (const it of items) {
      const sub = Number(it.Cantidad) * Number(it.PrecioCompra);
      const iva = sub * (Number(it.IVA ?? DEFAULT_IVA_RATE) / 100);
      await pool.request()
        .input('OC_Id',           sql.Int,            ocId)
        .input('Producto_Id',     sql.Int,            it.Producto_Id || null)
        .input('MateriaPrima_Id', sql.Int,            it.MateriaPrima_Id || null)
        .input('Descripcion',     sql.NVarChar(300),  it.Descripcion || '')
        .input('Cantidad',        sql.Decimal(18,4),  Number(it.Cantidad))
        .input('PrecioCompra',    sql.Decimal(18,6),  Number(it.PrecioCompra))
        .input('Subtotal',        sql.Decimal(18,2),  sub)
        .input('IVA',             sql.Decimal(18,2),  iva)
        .input('Total',           sql.Decimal(18,2),  sub + iva)
        .query(`
          INSERT INTO ERP_COMPRA_ORDEN_DETALLE
            (OC_Id, Producto_Id, MateriaPrima_Id, Descripcion, Cantidad, PrecioCompra, Subtotal, IVA, Total)
          VALUES
            (@OC_Id, @Producto_Id, @MateriaPrima_Id, @Descripcion, @Cantidad, @PrecioCompra, @Subtotal, @IVA, @Total)
        `);
    }

    // Actualizar precio de costo en el producto (si aplica)
    for (const it of items) {
      if (it.Producto_Id && it.PrecioCompra) {
        await pool.request()
          .input('Producto_Id',  sql.Int,           Number(it.Producto_Id))
          .input('PrecioCompra', sql.Decimal(18,6),  Number(it.PrecioCompra))
          .query(`
            UPDATE ERP_PRODUCTOS
            SET CostoInicial = @PrecioCompra, UpdatedAt = GETDATE()
            WHERE Producto_Id = @Producto_Id
          `);
      }
    }

    return res.status(201).json({ success: true, OC_Id: ocId, NumeroOC: numeroOC });
  } catch (err) {
    console.error('compras.crearOrden', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/* ─────────────────────────────────────────────────────
   4. ACTUALIZAR ORDEN (solo en BORRADOR)
   PUT /api/compras/ordenes/:id
───────────────────────────────────────────────────── */
exports.actualizarOrden = async (req, res) => {
  try {
    await pool.connect();
    const id = Number(req.params.id);
    const b = req.body || {};

    // Verificar que esté en BORRADOR
    const chk = await pool.request().input('OC_Id', sql.Int, id)
      .query('SELECT Estatus FROM ERP_COMPRA_ORDEN WHERE OC_Id = @OC_Id');
    if (!chk.recordset.length) {
      return res.status(404).json({ success: false, message: 'Orden no encontrada' });
    }
    if (chk.recordset[0].Estatus !== 'BORRADOR') {
      return res.status(400).json({ success: false, message: 'Solo se pueden editar órdenes en BORRADOR' });
    }

    const items = b.items || [];
    let subtotal = 0, totalIVA = 0;
    for (const it of items) {
      const sub = Number(it.Cantidad) * Number(it.PrecioCompra);
      subtotal += sub;
      totalIVA += sub * (Number(it.IVA ?? DEFAULT_IVA_RATE) / 100);
    }
    const total = subtotal + totalIVA;

    await pool.request()
      .input('OC_Id',           sql.Int,            id)
      .input('Proveedor_Id',    sql.Int,            Number(b.Proveedor_Id))
      .input('FechaRequerida',  sql.DateTime,       b.FechaRequerida ? new Date(b.FechaRequerida) : null)
      .input('Moneda',          sql.NVarChar(3),    b.Moneda || 'MXN')
      .input('Subtotal',        sql.Decimal(18,2),  subtotal)
      .input('IVA',             sql.Decimal(18,2),  totalIVA)
      .input('Total',           sql.Decimal(18,2),  total)
      .input('RequiereDobleAutorizacion', sql.Bit,  b.RequiereDobleAutorizacion !== false ? 1 : 0)
      .input('FacturaReferencia', sql.NVarChar(100),b.FacturaReferencia || null)
      .input('Observaciones',   sql.NVarChar(1000), b.Observaciones || null)
      .query(`
        UPDATE ERP_COMPRA_ORDEN SET
          Proveedor_Id = @Proveedor_Id,
          FechaRequerida = @FechaRequerida,
          Moneda = @Moneda,
          Subtotal = @Subtotal,
          IVA = @IVA,
          Total = @Total,
          RequiereDobleAutorizacion = @RequiereDobleAutorizacion,
          FacturaReferencia = @FacturaReferencia,
          Observaciones = @Observaciones,
          UpdatedAt = GETDATE()
        WHERE OC_Id = @OC_Id
      `);

    // Reemplazar detalles
    await pool.request().input('OC_Id', sql.Int, id)
      .query('DELETE FROM ERP_COMPRA_ORDEN_DETALLE WHERE OC_Id = @OC_Id');

    for (const it of items) {
      const sub = Number(it.Cantidad) * Number(it.PrecioCompra);
      const iva = sub * (Number(it.IVA ?? DEFAULT_IVA_RATE) / 100);
      await pool.request()
        .input('OC_Id',           sql.Int,            id)
        .input('Producto_Id',     sql.Int,            it.Producto_Id || null)
        .input('MateriaPrima_Id', sql.Int,            it.MateriaPrima_Id || null)
        .input('Descripcion',     sql.NVarChar(300),  it.Descripcion || '')
        .input('Cantidad',        sql.Decimal(18,4),  Number(it.Cantidad))
        .input('PrecioCompra',    sql.Decimal(18,6),  Number(it.PrecioCompra))
        .input('Subtotal',        sql.Decimal(18,2),  sub)
        .input('IVA',             sql.Decimal(18,2),  iva)
        .input('Total',           sql.Decimal(18,2),  sub + iva)
        .query(`
          INSERT INTO ERP_COMPRA_ORDEN_DETALLE
            (OC_Id, Producto_Id, MateriaPrima_Id, Descripcion, Cantidad, PrecioCompra, Subtotal, IVA, Total)
          VALUES
            (@OC_Id, @Producto_Id, @MateriaPrima_Id, @Descripcion, @Cantidad, @PrecioCompra, @Subtotal, @IVA, @Total)
        `);
    }

    return res.json({ success: true, message: 'Orden actualizada' });
  } catch (err) {
    console.error('compras.actualizarOrden', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/* ─────────────────────────────────────────────────────
   5. ENVIAR A AUTORIZACIÓN
   POST /api/compras/ordenes/:id/enviar-autorizacion
───────────────────────────────────────────────────── */
exports.enviarAutorizacion = async (req, res) => {
  try {
    await pool.connect();
    const id = Number(req.params.id);
    const chk = await pool.request().input('OC_Id', sql.Int, id)
      .query('SELECT Estatus FROM ERP_COMPRA_ORDEN WHERE OC_Id = @OC_Id');
    if (!chk.recordset.length) return res.status(404).json({ success: false, message: 'Orden no encontrada' });
    if (chk.recordset[0].Estatus !== 'BORRADOR') {
      return res.status(400).json({ success: false, message: 'Solo borradores pueden enviarse a autorización' });
    }
    await pool.request().input('OC_Id', sql.Int, id).query(`
      UPDATE ERP_COMPRA_ORDEN SET Estatus = 'PENDIENTE_AUTORIZACION', UpdatedAt = GETDATE()
      WHERE OC_Id = @OC_Id
    `);
    return res.json({ success: true, message: 'Enviada a autorización' });
  } catch (err) {
    console.error('compras.enviarAutorizacion', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/* ─────────────────────────────────────────────────────
   6. AUTORIZAR / RECHAZAR (doble autorización)
   POST /api/compras/ordenes/:id/autorizar
   Body: { Nivel (1|2), Aprobado (true|false), Comentarios }
───────────────────────────────────────────────────── */
exports.autorizarOrden = async (req, res) => {
  try {
    await pool.connect();
    const id = Number(req.params.id);
    const { Nivel, Aprobado, Comentarios } = req.body || {};
    const userId = req.user?.User_Id || null;

    if (![1, 2].includes(Number(Nivel))) {
      return res.status(400).json({ success: false, message: 'Nivel debe ser 1 o 2' });
    }

    const chk = await pool.request().input('OC_Id', sql.Int, id)
      .query('SELECT Estatus, RequiereDobleAutorizacion FROM ERP_COMPRA_ORDEN WHERE OC_Id = @OC_Id');
    if (!chk.recordset.length) return res.status(404).json({ success: false, message: 'Orden no encontrada' });
    if (chk.recordset[0].Estatus !== 'PENDIENTE_AUTORIZACION') {
      return res.status(400).json({ success: false, message: 'La orden no está pendiente de autorización' });
    }

    // Nivel 2 solo si Nivel 1 ya aprobó
    if (Number(Nivel) === 2) {
      const nivel1 = await pool.request().input('OC_Id', sql.Int, id).input('Nivel', sql.Int, 1)
        .query('SELECT Aprobado FROM ERP_COMPRA_AUTORIZACION WHERE OC_Id = @OC_Id AND Nivel = @Nivel');
      if (!nivel1.recordset.length || !nivel1.recordset[0].Aprobado) {
        return res.status(400).json({ success: false, message: 'El nivel 1 debe aprobar antes del nivel 2' });
      }
    }

    // Upsert autorización
    await pool.request()
      .input('OC_Id',       sql.Int,            id)
      .input('Nivel',       sql.Int,            Number(Nivel))
      .input('User_Id',     sql.Int,            userId)
      .input('Aprobado',    sql.Bit,            Aprobado ? 1 : 0)
      .input('Comentarios', sql.NVarChar(500),  Comentarios || null)
      .query(`
        IF EXISTS (SELECT 1 FROM ERP_COMPRA_AUTORIZACION WHERE OC_Id = @OC_Id AND Nivel = @Nivel)
          UPDATE ERP_COMPRA_AUTORIZACION
          SET User_Id = @User_Id, Aprobado = @Aprobado, FechaDecision = GETDATE(), Comentarios = @Comentarios
          WHERE OC_Id = @OC_Id AND Nivel = @Nivel
        ELSE
          INSERT INTO ERP_COMPRA_AUTORIZACION (OC_Id, Nivel, User_Id, Aprobado, Comentarios)
          VALUES (@OC_Id, @Nivel, @User_Id, @Aprobado, @Comentarios)
      `);

    const requiereDoble = chk.recordset[0].RequiereDobleAutorizacion;

    if (!Aprobado) {
      // Rechazada
      await pool.request().input('OC_Id', sql.Int, id).query(`
        UPDATE ERP_COMPRA_ORDEN SET Estatus = 'RECHAZADA', UpdatedAt = GETDATE()
        WHERE OC_Id = @OC_Id
      `);
      return res.json({ success: true, message: 'Orden rechazada' });
    }

    // Verificar si está totalmente autorizada
    const authCount = await pool.request().input('OC_Id', sql.Int, id).query(`
      SELECT COUNT(*) AS Total FROM ERP_COMPRA_AUTORIZACION
      WHERE OC_Id = @OC_Id AND Aprobado = 1
    `);
    const totalAuth = authCount.recordset[0].Total;
    const required = requiereDoble ? 2 : 1;

    if (totalAuth >= required) {
      await pool.request().input('OC_Id', sql.Int, id).query(`
        UPDATE ERP_COMPRA_ORDEN SET Estatus = 'AUTORIZADA', UpdatedAt = GETDATE()
        WHERE OC_Id = @OC_Id
      `);
      return res.json({ success: true, message: 'Orden autorizada completamente', autorizada: true });
    }

    return res.json({ success: true, message: `Nivel ${Nivel} aprobado, pendiente siguiente nivel`, autorizada: false });
  } catch (err) {
    console.error('compras.autorizarOrden', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/* ─────────────────────────────────────────────────────
   7. MARCAR COMO COMPRADA (recibida)
   POST /api/compras/ordenes/:id/comprar
   Body: { FacturaReferencia }
───────────────────────────────────────────────────── */
exports.marcarComprada = async (req, res) => {
  try {
    await pool.connect();
    const id = Number(req.params.id);
    const { FacturaReferencia } = req.body || {};

    const chk = await pool.request().input('OC_Id', sql.Int, id)
      .query('SELECT Estatus FROM ERP_COMPRA_ORDEN WHERE OC_Id = @OC_Id');
    if (!chk.recordset.length) return res.status(404).json({ success: false, message: 'Orden no encontrada' });
    if (chk.recordset[0].Estatus !== 'AUTORIZADA') {
      return res.status(400).json({ success: false, message: 'La orden debe estar AUTORIZADA para registrar la compra' });
    }

    await pool.request()
      .input('OC_Id',             sql.Int,           id)
      .input('FacturaReferencia', sql.NVarChar(100),  FacturaReferencia || null)
      .query(`
        UPDATE ERP_COMPRA_ORDEN SET
          Estatus = 'COMPRADA',
          FacturaReferencia = COALESCE(@FacturaReferencia, FacturaReferencia),
          UpdatedAt = GETDATE()
        WHERE OC_Id = @OC_Id
      `);

    return res.json({ success: true, message: 'Compra registrada exitosamente' });
  } catch (err) {
    console.error('compras.marcarComprada', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/* ─────────────────────────────────────────────────────
   7.1 CARGAR FACTURA DE COMPRA
   POST /api/compras/ordenes/:id/factura
   form-data: factura
───────────────────────────────────────────────────── */
exports.cargarFactura = async (req, res) => {
  try {
    await pool.connect();
    const id = Number(req.params.id);

    if (!req.files || !req.files.factura) {
      return res.status(400).json({ success: false, message: 'Debe enviar el archivo en el campo factura' });
    }

    const ordenResult = await pool.request()
      .input('OC_Id', sql.Int, id)
      .query('SELECT OC_Id, NumeroOC, Estatus FROM ERP_COMPRA_ORDEN WHERE OC_Id = @OC_Id');

    if (!ordenResult.recordset.length) {
      return res.status(404).json({ success: false, message: 'Orden no encontrada' });
    }

    const orden = ordenResult.recordset[0];
    if (!['AUTORIZADA', 'COMPRADA'].includes(orden.Estatus)) {
      return res.status(400).json({ success: false, message: 'Solo puede cargar factura en órdenes AUTORIZADAS o COMPRADAS' });
    }

    const factura = req.files.factura;
    const allowedMimes = ['application/pdf', 'application/xml', 'text/xml', 'image/png', 'image/jpeg', 'image/jpg'];

    if (!allowedMimes.includes(factura.mimetype)) {
      return res.status(400).json({ success: false, message: 'Formato inválido. Use PDF, XML, PNG o JPG' });
    }

    const uploadDir = path.join(__dirname, '..', 'uploads', 'compras-facturas');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const originalExt = path.extname(factura.name || '').toLowerCase();
    const extByMime = {
      'application/pdf': '.pdf',
      'application/xml': '.xml',
      'text/xml': '.xml',
      'image/png': '.png',
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg'
    };
    const ext = originalExt || extByMime[factura.mimetype] || '.pdf';
    const unique = `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const safeNumero = String(orden.NumeroOC || `OC_${id}`).replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `factura_${safeNumero}_${unique}${ext}`;
    const filePath = path.join(uploadDir, filename);
    const publicUrl = `/uploads/compras-facturas/${filename}`;

    await factura.mv(filePath);

    await pool.request()
      .input('OC_Id', sql.Int, id)
      .input('FacturaArchivoUrl', sql.NVarChar(500), publicUrl)
      .query(`
        UPDATE ERP_COMPRA_ORDEN
        SET FacturaArchivoUrl = @FacturaArchivoUrl,
            UpdatedAt = GETDATE()
        WHERE OC_Id = @OC_Id
      `);

    return res.json({ success: true, message: 'Factura cargada exitosamente', data: { FacturaArchivoUrl: publicUrl } });
  } catch (err) {
    console.error('compras.cargarFactura', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/* ─────────────────────────────────────────────────────
   8. RECIBIR MERCANCÍA (registra entrada al inventario)
   POST /api/compras/ordenes/:id/recibir
   Body: { Almacen_Id, Observaciones,
           items: [{ OC_Detalle_Id, CantidadRecibida }] }
   - Crea un registro en ERP_COMPRA_RECEPCION y DETALLE
   - Suma stock en ERP_STOCK_MP (materias primas) o ERP_STOCK (productos)
   - Actualiza CostoUnitario en ERP_MATERIA_PRIMA y CostoInicial en ERP_PRODUCTOS
───────────────────────────────────────────────────── */
exports.recibirMercancia = async (req, res) => {
  try {
    await pool.connect();
    const id       = Number(req.params.id);
    const b        = req.body || {};
    const almacenId = Number(b.Almacen_Id);
    const items     = b.items || [];

    if (!almacenId) return res.status(400).json({ success: false, message: 'Se requiere Almacen_Id' });
    if (!items.length) return res.status(400).json({ success: false, message: 'Se requiere al menos una línea' });

    // Verificar que la OC existe y está en estado válido para recepción
    const chk = await pool.request().input('OC_Id', sql.Int, id).query(`
      SELECT OC_Id, Estatus, NumeroOC FROM ERP_COMPRA_ORDEN WHERE OC_Id = @OC_Id
    `);
    if (!chk.recordset.length) return res.status(404).json({ success: false, message: 'Orden no encontrada' });
    const { Estatus } = chk.recordset[0];
    if (!['AUTORIZADA', 'COMPRADA'].includes(Estatus)) {
      return res.status(400).json({ success: false, message: `La OC debe estar en AUTORIZADA o COMPRADA para recibir mercancía (estado actual: ${Estatus})` });
    }

    // Obtener detalle de la OC para validar líneas
    const detOC = await pool.request().input('OC_Id', sql.Int, id).query(`
      SELECT OC_Detalle_Id, Producto_Id, MateriaPrima_Id, Descripcion, Cantidad, PrecioCompra
      FROM ERP_COMPRA_ORDEN_DETALLE WHERE OC_Id = @OC_Id
    `);
    const detalleMap = {};
    for (const d of detOC.recordset) detalleMap[d.OC_Detalle_Id] = d;

    const recibidoPor = req.user?.Name
      ? `${req.user.Name} ${req.user.Lastname || ''}`.trim()
      : (req.user?.username || 'Sistema');

    // Crear cabecera de recepción
    const recResult = await pool.request()
      .input('OC_Id',        sql.Int,           id)
      .input('Almacen_Id',   sql.Int,           almacenId)
      .input('Observaciones',sql.NVarChar(500), b.Observaciones || null)
      .input('RecibidoPor',  sql.NVarChar(100), recibidoPor)
      .query(`
        INSERT INTO ERP_COMPRA_RECEPCION (OC_Id, Almacen_Id, Observaciones, RecibidoPor)
        VALUES (@OC_Id, @Almacen_Id, @Observaciones, @RecibidoPor);
        SELECT SCOPE_IDENTITY() AS Recepcion_Id;
      `);
    const recepcionId = recResult.recordset[0].Recepcion_Id;

    // Procesar cada línea
    for (const item of items) {
      const detId  = Number(item.OC_Detalle_Id);
      const cantRec = Number(item.CantidadRecibida);
      if (!detId || cantRec <= 0) continue;

      const det = detalleMap[detId];
      if (!det) continue;

      // Insertar detalle de recepción
      await pool.request()
        .input('Recepcion_Id',     sql.Int,           recepcionId)
        .input('OC_Detalle_Id',    sql.Int,           detId)
        .input('Producto_Id',      sql.Int,           det.Producto_Id || null)
        .input('MateriaPrima_Id',  sql.Int,           det.MateriaPrima_Id || null)
        .input('Descripcion',      sql.NVarChar(300), det.Descripcion)
        .input('CantidadOrdenada', sql.Decimal(18,4), Number(det.Cantidad))
        .input('CantidadRecibida', sql.Decimal(18,4), cantRec)
        .input('PrecioCompra',     sql.Decimal(18,6), Number(det.PrecioCompra))
        .query(`
          INSERT INTO ERP_COMPRA_RECEPCION_DETALLE
            (Recepcion_Id, OC_Detalle_Id, Producto_Id, MateriaPrima_Id,
             Descripcion, CantidadOrdenada, CantidadRecibida, PrecioCompra)
          VALUES
            (@Recepcion_Id, @OC_Detalle_Id, @Producto_Id, @MateriaPrima_Id,
             @Descripcion, @CantidadOrdenada, @CantidadRecibida, @PrecioCompra)
        `);

      // Actualizar stock según tipo
      if (det.MateriaPrima_Id) {
        // ── MATERIA PRIMA: upsert en ERP_STOCK_MP ──
        await pool.request()
          .input('MateriaPrima_Id', sql.Int,           det.MateriaPrima_Id)
          .input('Almacen_Id',      sql.Int,           almacenId)
          .input('Cantidad',        sql.Decimal(18,4), cantRec)
          .query(`
            IF EXISTS (
              SELECT 1 FROM ERP_STOCK_MP
              WHERE MateriaPrima_Id = @MateriaPrima_Id AND Almacen_Id = @Almacen_Id
            )
              UPDATE ERP_STOCK_MP
                SET Cantidad = Cantidad + @Cantidad
              WHERE MateriaPrima_Id = @MateriaPrima_Id AND Almacen_Id = @Almacen_Id
            ELSE
              INSERT INTO ERP_STOCK_MP (MateriaPrima_Id, Almacen_Id, Cantidad)
              VALUES (@MateriaPrima_Id, @Almacen_Id, @Cantidad)
          `);

        // Actualizar costo unitario de la MP con el precio de la compra
        await pool.request()
          .input('MateriaPrima_Id', sql.Int,           det.MateriaPrima_Id)
          .input('CostoUnitario',   sql.Decimal(18,6), Number(det.PrecioCompra))
          .query(`
            UPDATE ERP_MATERIA_PRIMA
              SET CostoUnitario = @CostoUnitario,
                  FechaUltimoCosto = GETDATE()
            WHERE MateriaPrima_Id = @MateriaPrima_Id
          `);

      } else if (det.Producto_Id) {
        // ── PRODUCTO TERMINADO: upsert en ERP_STOCK ──
        const stockPrevioResult = await pool.request()
          .input('Producto_Id', sql.Int, det.Producto_Id)
          .input('Almacen_Id', sql.Int, almacenId)
          .query(`
            SELECT TOP 1 Cantidad
            FROM ERP_STOCK
            WHERE Producto_Id = @Producto_Id AND Almacen_Id = @Almacen_Id
          `);
        const stockPrevio = Number(stockPrevioResult.recordset?.[0]?.Cantidad || 0);

        await pool.request()
          .input('Producto_Id', sql.Int,           det.Producto_Id)
          .input('Almacen_Id',  sql.Int,           almacenId)
          .input('Cantidad',    sql.Decimal(18,4), cantRec)
          .query(`
            IF EXISTS (
              SELECT 1 FROM ERP_STOCK
              WHERE Producto_Id = @Producto_Id AND Almacen_Id = @Almacen_Id
            )
              UPDATE ERP_STOCK
                SET Cantidad = Cantidad + @Cantidad
              WHERE Producto_Id = @Producto_Id AND Almacen_Id = @Almacen_Id
            ELSE
              INSERT INTO ERP_STOCK (Producto_Id, Almacen_Id, Cantidad, Stock_Minimo)
              VALUES (@Producto_Id, @Almacen_Id, @Cantidad, 0)
          `);

        // Actualizar costo inicial del producto
        await pool.request()
          .input('Producto_Id',  sql.Int,           det.Producto_Id)
          .input('PrecioCompra', sql.Decimal(18,6), Number(det.PrecioCompra))
          .query(`
            UPDATE ERP_PRODUCTOS
              SET CostoInicial = @PrecioCompra, FechaActualizacion = GETDATE()
            WHERE Producto_Id = @Producto_Id
          `);
        await updateAverageCostFromReceipt({
          productoId: det.Producto_Id,
          cantidadEntrante: cantRec,
          costoUnitario: Number(det.PrecioCompra),
          stockPrevio,
        });
      }
    }

    // Si la OC estaba AUTORIZADA, pasarla a COMPRADA automáticamente
    if (Estatus === 'AUTORIZADA') {
      await pool.request().input('OC_Id', sql.Int, id).query(`
        UPDATE ERP_COMPRA_ORDEN
          SET Estatus = 'COMPRADA', UpdatedAt = GETDATE()
        WHERE OC_Id = @OC_Id
      `);
    }

    return res.status(201).json({
      success: true,
      message: 'Mercancía recibida y stock actualizado',
      data: { Recepcion_Id: recepcionId }
    });
  } catch (err) {
    console.error('compras.recibirMercancia', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/* ─────────────────────────────────────────────────────
   GET recepciones de una OC
   GET /api/compras/ordenes/:id/recepciones
───────────────────────────────────────────────────── */
exports.listRecepciones = async (req, res) => {
  try {
    await pool.connect();
    const id = Number(req.params.id);

    const recResult = await pool.request().input('OC_Id', sql.Int, id).query(`
      SELECT r.*, a.Nombre AS Almacen
      FROM ERP_COMPRA_RECEPCION r
      LEFT JOIN ERP_ALMACENES a ON r.Almacen_Id = a.Almacen_Id
      WHERE r.OC_Id = @OC_Id
      ORDER BY r.FechaRecepcion DESC
    `);

    const recepciones = [];
    for (const rec of recResult.recordset) {
      const detResult = await pool.request()
        .input('Recepcion_Id', sql.Int, rec.Recepcion_Id)
        .query(`
          SELECT rd.*,
            COALESCE(p.SKU,    '') AS ProductoSKU,
            COALESCE(p.Nombre, '') AS ProductoNombre,
            COALESCE(mp.Nombre,'') AS MateriaPrimaNombre
          FROM ERP_COMPRA_RECEPCION_DETALLE rd
          LEFT JOIN ERP_PRODUCTOS     p  ON rd.Producto_Id     = p.Producto_Id
          LEFT JOIN ERP_MATERIA_PRIMA mp ON rd.MateriaPrima_Id = mp.MateriaPrima_Id
          WHERE rd.Recepcion_Id = @Recepcion_Id
        `);
      recepciones.push({ ...rec, detalle: detResult.recordset });
    }

    return res.json({ success: true, data: recepciones });
  } catch (err) {
    console.error('compras.listRecepciones', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/* ─────────────────────────────────────────────────────
   9. CANCELAR ORDEN
   POST /api/compras/ordenes/:id/cancelar
───────────────────────────────────────────────────── */
exports.cancelarOrden = async (req, res) => {
  try {
    await pool.connect();
    const id = Number(req.params.id);
    const chk = await pool.request().input('OC_Id', sql.Int, id)
      .query('SELECT Estatus FROM ERP_COMPRA_ORDEN WHERE OC_Id = @OC_Id');
    if (!chk.recordset.length) return res.status(404).json({ success: false, message: 'Orden no encontrada' });
    if (['COMPRADA', 'CANCELADA'].includes(chk.recordset[0].Estatus)) {
      return res.status(400).json({ success: false, message: `No se puede cancelar una orden ${chk.recordset[0].Estatus}` });
    }
    await pool.request().input('OC_Id', sql.Int, id).query(`
      UPDATE ERP_COMPRA_ORDEN SET Estatus = 'CANCELADA', UpdatedAt = GETDATE()
      WHERE OC_Id = @OC_Id
    `);
    return res.json({ success: true, message: 'Orden cancelada' });
  } catch (err) {
    console.error('compras.cancelarOrden', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/* ─────────────────────────────────────────────────────
   9. GENERAR PDF DE ORDEN DE COMPRA
   GET /api/compras/ordenes/:id/pdf
───────────────────────────────────────────────────── */
exports.generarPDF = async (req, res) => {
  try {
    await pool.connect();
    const id = Number(req.params.id);
    const ESTATUS_PERMITIDOS_PDF = ['AUTORIZADA', 'COMPRADA'];

    // Obtener datos completos
    const cabResult = await pool.request().input('OC_Id', sql.Int, id).query(`
      SELECT
        oc.*,
        c.NameCompany  AS Empresa,
        c.RFC          AS EmpresaRFC,
        ${PROVEEDOR_NOMBRE_SQL} AS Proveedor,
        cl.RFC         AS ProveedorRFC,
        contact.Email  AS ProveedorEmail
      FROM ERP_COMPRA_ORDEN oc
      LEFT JOIN ERP_COMPANY c  ON oc.Company_Id   = c.Company_Id
      LEFT JOIN ERP_CLIENT  cl ON oc.Proveedor_Id = cl.Client_Id
      OUTER APPLY (
        SELECT TOP 1 cc.Email
        FROM ERP_CLIENTCONTACTS cc
        WHERE cc.Client_Id = cl.Client_Id
        ORDER BY cc.IsPrimary DESC, cc.Contact_Id ASC
      ) contact
      WHERE oc.OC_Id = @OC_Id
    `);
    if (!cabResult.recordset.length) {
      return res.status(404).json({ success: false, message: 'Orden no encontrada' });
    }

    const estatusOC = cabResult.recordset[0].Estatus;
    if (!ESTATUS_PERMITIDOS_PDF.includes(estatusOC)) {
      return res.status(403).json({
        success: false,
        message: 'Solo se puede descargar el PDF cuando la OC está autorizada o comprada'
      });
    }

    const detResult = await pool.request().input('OC_Id', sql.Int, id).query(`
      SELECT
        d.*,
        COALESCE(p.SKU,    '')  AS ProductoSKU,
        COALESCE(p.Nombre, '')  AS ProductoNombre,
        COALESCE(mp.Nombre,'')  AS MateriaPrimaNombre
      FROM ERP_COMPRA_ORDEN_DETALLE d
      LEFT JOIN ERP_PRODUCTOS     p  ON d.Producto_Id     = p.Producto_Id
      LEFT JOIN ERP_MATERIA_PRIMA mp ON d.MateriaPrima_Id = mp.MateriaPrima_Id
      WHERE d.OC_Id = @OC_Id
    `);

    const orden = {
      ...cabResult.recordset[0],
      detalle: detResult.recordset
    };

    const pdfBuffer = await pdfService.generarPDFOrdenCompra(orden);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="OC-${orden.NumeroOC}.pdf"`,
      'Content-Length': pdfBuffer.length
    });
    return res.send(pdfBuffer);
  } catch (err) {
    console.error('compras.generarPDF', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/* ─────────────────────────────────────────────────────
   10. REGISTRO DIRECTO CON FACTURA (sin OC previa)
   POST /api/compras/registro-directo
   Body: { Company_Id, Proveedor_Id, FacturaReferencia,
           Observaciones, items[] }
───────────────────────────────────────────────────── */
exports.registroDirecto = async (req, res) => {
  try {
    await pool.connect();
    const b = req.body || {};
    const items = b.items || [];
    if (!items.length) {
      return res.status(400).json({ success: false, message: 'Debe incluir al menos un producto' });
    }
    if (!b.FacturaReferencia) {
      return res.status(400).json({ success: false, message: 'El registro directo requiere número de factura' });
    }

    const numeroOC = await getNextNumeroOC(b.Company_Id);
    let subtotal = 0, totalIVA = 0;
    for (const it of items) {
      const sub = Number(it.Cantidad) * Number(it.PrecioCompra);
      subtotal += sub;
      totalIVA += sub * (Number(it.IVA ?? DEFAULT_IVA_RATE) / 100);
    }
    const total = subtotal + totalIVA;
    const createdBy = req.user?.Nombre || req.user?.username || 'Sistema';

    // Crear OC directamente en estado COMPRADA (ya tiene factura)
    const cabResult = await pool.request()
      .input('NumeroOC',          sql.NVarChar(50),   numeroOC)
      .input('Company_Id',        sql.Int,            Number(b.Company_Id))
      .input('Proveedor_Id',      sql.Int,            Number(b.Proveedor_Id))
      .input('Moneda',            sql.NVarChar(3),    b.Moneda || 'MXN')
      .input('Subtotal',          sql.Decimal(18,2),  subtotal)
      .input('IVA',               sql.Decimal(18,2),  totalIVA)
      .input('Total',             sql.Decimal(18,2),  total)
      .input('FacturaReferencia', sql.NVarChar(100),  b.FacturaReferencia)
      .input('Observaciones',     sql.NVarChar(1000), b.Observaciones || null)
      .input('CreatedBy',         sql.NVarChar(100),  createdBy)
      .query(`
        INSERT INTO ERP_COMPRA_ORDEN
          (NumeroOC, Company_Id, Proveedor_Id, Moneda, Subtotal, IVA, Total,
           Estatus, RequiereDobleAutorizacion, FacturaReferencia, Observaciones, CreatedBy)
        VALUES
          (@NumeroOC, @Company_Id, @Proveedor_Id, @Moneda, @Subtotal, @IVA, @Total,
           'COMPRADA', 0, @FacturaReferencia, @Observaciones, @CreatedBy);
        SELECT SCOPE_IDENTITY() AS OC_Id;
      `);

    const ocId = cabResult.recordset[0].OC_Id;

    for (const it of items) {
      const sub = Number(it.Cantidad) * Number(it.PrecioCompra);
      const iva = sub * (Number(it.IVA ?? DEFAULT_IVA_RATE) / 100);
      await pool.request()
        .input('OC_Id',           sql.Int,            ocId)
        .input('Producto_Id',     sql.Int,            it.Producto_Id || null)
        .input('MateriaPrima_Id', sql.Int,            it.MateriaPrima_Id || null)
        .input('Descripcion',     sql.NVarChar(300),  it.Descripcion || '')
        .input('Cantidad',        sql.Decimal(18,4),  Number(it.Cantidad))
        .input('PrecioCompra',    sql.Decimal(18,6),  Number(it.PrecioCompra))
        .input('Subtotal',        sql.Decimal(18,2),  sub)
        .input('IVA',             sql.Decimal(18,2),  iva)
        .input('Total',           sql.Decimal(18,2),  sub + iva)
        .query(`
          INSERT INTO ERP_COMPRA_ORDEN_DETALLE
            (OC_Id, Producto_Id, MateriaPrima_Id, Descripcion, Cantidad, PrecioCompra, Subtotal, IVA, Total)
          VALUES
            (@OC_Id, @Producto_Id, @MateriaPrima_Id, @Descripcion, @Cantidad, @PrecioCompra, @Subtotal, @IVA, @Total)
        `);
    }

    // Actualizar precio de costo
    for (const it of items) {
      if (it.Producto_Id && it.PrecioCompra) {
        await pool.request()
          .input('Producto_Id',  sql.Int,            Number(it.Producto_Id))
          .input('PrecioCompra', sql.Decimal(18,6),   Number(it.PrecioCompra))
          .query(`
            UPDATE ERP_PRODUCTOS SET CostoInicial = @PrecioCompra, UpdatedAt = GETDATE()
            WHERE Producto_Id = @Producto_Id
          `);
      }
    }

    return res.status(201).json({ success: true, OC_Id: ocId, NumeroOC: numeroOC, message: 'Compra registrada directamente' });
  } catch (err) {
    console.error('compras.registroDirecto', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/* ─────────────────────────────────────────────────────
   11. LISTAR PROVEEDORES (clientes con tipo PROVEEDOR/AMBOS)
   GET /api/compras/proveedores?Company_Id=X
───────────────────────────────────────────────────── */
exports.listProveedores = async (req, res) => {
  try {
    await pool.connect();
    const { Company_Id } = req.query;
    const request = pool.request();
    let joins = '';
    let where = "WHERE c.ClientType IN ('PROVEEDOR','AMBOS')";
    if (Company_Id) {
      joins += ' INNER JOIN ERP_CLIENTCOMPANIES cc ON c.Client_Id = cc.Client_Id';
      where += ' AND cc.Company_Id = @Company_Id';
      request.input('Company_Id', sql.Int, Number(Company_Id));
    }
    const result = await request.query(`
      SELECT DISTINCT
        c.Client_Id,
        c.LegalName,
        c.CommercialName,
        COALESCE(NULLIF(c.CommercialName, ''), c.LegalName) AS ProviderName,
        c.RFC,
        contact.Email,
        c.ClientType
      FROM ERP_CLIENT c
      ${joins}
      OUTER APPLY (
        SELECT TOP 1 ct.Email
        FROM ERP_CLIENTCONTACTS ct
        WHERE ct.Client_Id = c.Client_Id
        ORDER BY ct.IsPrimary DESC, ct.Contact_Id ASC
      ) contact
      ${where}
      ORDER BY COALESCE(NULLIF(c.CommercialName, ''), c.LegalName)
    `);
    return res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error('compras.listProveedores', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};
