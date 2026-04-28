const { pool, sql } = require('../config/db');
const { poolPromise } = require('../config/db');
const facturamaService = require('../services/facturamaService');
const fs = require('fs');
const path = require('path');

// NOTE: the ERP_COMPANY table should contain columns for multi-emisor:
//   RFC, LegalName, FiscalRegime, TaxZipCode, CsdCargado, CsdPassword, Email
//   EmailAprobacion1, EmailAprobacion2

exports.list = async (req, res) => {
  try {
    await pool.connect();
    const r = await pool.request().query(`
      SELECT TOP (1000) Company_Id, NameCompany, Status,
             RFC, LegalName, FiscalRegime, TaxZipCode,
             CsdCargado, Email,
             LogoUrl
             EmailAprobacion1, EmailAprobacion2
      FROM ERP_COMPANY
      ORDER BY NameCompany
    `);
    const uploadsDir = path.join(__dirname, '..', 'uploads', 'logos');
    const rows = (r.recordset || []).map(row => {
      // Prefer DB LogoUrl when present; otherwise fallback to filesystem check
      const logo = row.LogoUrl || getLogoUrlForCompany(row.Company_Id, uploadsDir);
      return Object.assign({}, row, { LogoUrl: logo });
    });
    res.json(rows);
  } catch (err) {
    console.error('company.list error', err);
    res.status(500).json({ msg: 'Error listando compañías' });
  }
};

exports.get = async (req, res) => {
  const id = Number(req.params.id);
  if (!id || isNaN(id)) return res.status(400).json({ msg: 'Id inválido' });
  try {
    await pool.connect();
    const r = await pool.request().input('id', sql.Int, id).query(`
      SELECT Company_Id, NameCompany, Status,
             RFC, LegalName, FiscalRegime, TaxZipCode,
             CsdCargado, Email,
             LogoUrl,
             EmailAprobacion1, EmailAprobacion2
      FROM ERP_COMPANY WHERE Company_Id = @id
    `);
    if (!r.recordset || r.recordset.length === 0) return res.status(404).json({ msg: 'Compañía no encontrada' });
    const uploadsDir = path.join(__dirname, '..', 'uploads', 'logos');
    const row = r.recordset[0];
    // Prefer DB value if present, otherwise fallback to filesystem
    row.LogoUrl = row.LogoUrl || getLogoUrlForCompany(row.Company_Id, uploadsDir);
    res.json(row);
  } catch (err) {
    console.error('company.get error', err);
    res.status(500).json({ msg: 'Error obteniendo compañía' });
  }
};

exports.create = async (req, res) => {
  const p = req.body || {};
  try {
    await pool.connect();
    const r = await pool.request()
      .input('NameCompany', sql.VarChar(250), p.NameCompany || null)
      .input('Street', sql.VarChar(500), p.Street || null)
      .input('Status', sql.VarChar(50), p.Status || null)
      .input('EmailAprobacion1', sql.VarChar(250), p.EmailAprobacion1 || null)
      .input('EmailAprobacion2', sql.VarChar(250), p.EmailAprobacion2 || null)
      .query(`
        INSERT INTO ERP_COMPANY (NameCompany, Street, Status, EmailAprobacion1, EmailAprobacion2)
        VALUES (@NameCompany, @Street, @Status, @EmailAprobacion1, @EmailAprobacion2);
        SELECT SCOPE_IDENTITY() AS Company_Id
      `);
    const id = r.recordset && r.recordset[0] && r.recordset[0].Company_Id;
    res.status(201).json({ msg: 'Compañía creada', Company_Id: id });
  } catch (err) {
    console.error('company.create error', err);
    res.status(500).json({ msg: 'Error creando compañía' });
  }
};

exports.update = async (req, res) => {
  const id = Number(req.params.id);
  const p = req.body || {};
  if (!id || isNaN(id)) return res.status(400).json({ msg: 'Id inválido' });
  try {
    await pool.connect();
    await pool.request()
      .input('id', sql.Int, id)
      .input('NameCompany', sql.VarChar(250), p.NameCompany || null)
      .input('Street', sql.VarChar(500), p.Street || null)
      .input('Status', sql.VarChar(50), p.Status || null)
      .input('RFC', sql.VarChar(50), p.RFC || null)
      .input('LegalName', sql.VarChar(250), p.LegalName || null)
      .input('FiscalRegime', sql.VarChar(10), p.FiscalRegime || null)
      .input('TaxZipCode', sql.VarChar(10), p.TaxZipCode || null)
      .input('LogoUrl', sql.VarChar(500), p.LogoUrl || null)
      .input('Email', sql.VarChar(200), p.Email || null)
      .input('EmailAprobacion1', sql.VarChar(250), p.EmailAprobacion1 || null)
      .input('EmailAprobacion2', sql.VarChar(250), p.EmailAprobacion2 || null)
      .query(`
        UPDATE ERP_COMPANY
        SET NameCompany = COALESCE(@NameCompany, NameCompany),
            Street = COALESCE(@Street, Street),
            Status = COALESCE(@Status, Status),
            RFC = COALESCE(@RFC, RFC),
            LegalName = COALESCE(@LegalName, LegalName),
            FiscalRegime = COALESCE(@FiscalRegime, FiscalRegime),
            TaxZipCode = COALESCE(@TaxZipCode, TaxZipCode),
            Email = COALESCE(@Email, Email),
            LogoUrl = COALESCE(@LogoUrl, LogoUrl),
            EmailAprobacion1 = @EmailAprobacion1,
            EmailAprobacion2 = @EmailAprobacion2
        WHERE Company_Id = @id
      `);
    res.json({ msg: 'Compañía actualizada' });
  } catch (err) {
    console.error('company.update error', err);
    res.status(500).json({ msg: 'Error actualizando compañía' });
  }
};

exports.remove = async (req, res) => {
  const id = Number(req.params.id);
  if (!id || isNaN(id)) return res.status(400).json({ msg: 'Id inválido' });
  try {
    await pool.connect();
    await pool.request().input('id', sql.Int, id).query('DELETE FROM ERP_COMPANY WHERE Company_Id = @id');
    res.json({ msg: 'Compañía eliminada' });
  } catch (err) {
    console.error('company.remove error', err);
    res.status(500).json({ msg: 'Error eliminando compañía' });
  }
};

// ═══════════════════════════════════════════════════════════════
//  MULTIEMISOR: Gestión de CSD por empresa
// ═══════════════════════════════════════════════════════════════

// Subir CSD (.cer + .key) de una empresa a Facturama
exports.subirCSD = async (req, res) => {
  const id = Number(req.params.id);
  if (!id || isNaN(id)) return res.status(400).json({ msg: 'Id inválido' });

  const { cerBase64, keyBase64, passwordCsd } = req.body;
  if (!cerBase64 || !keyBase64 || !passwordCsd) {
    return res.status(400).json({ msg: 'Se requieren cerBase64, keyBase64 y passwordCsd' });
  }

  try {
    await pool.connect();
    // Obtener RFC de la empresa
    const companyResult = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT RFC, LegalName FROM ERP_COMPANY WHERE Company_Id = @id');

    if (!companyResult.recordset.length) {
      return res.status(404).json({ msg: 'Empresa no encontrada' });
    }

    const { RFC } = companyResult.recordset[0];
    if (!RFC) {
      return res.status(400).json({ msg: 'La empresa no tiene RFC configurado' });
    }

    // Determinar credenciales para subir: preferir variables en .env para la company,
    // luego credenciales guardadas en BD; si no, usar la cuenta global.
    let uploadAuthBase64 = null;
    try {
      // 1) buscar en .env por convención
      const envUserKeys = [
        `FACTURAMA_USER_COMPANY_${id}`,
        `FACTURAMA_USER_${id}`
      ];
      const envPassKeys = [
        `FACTURAMA_PASSWORD_COMPANY_${id}`,
        `FACTURAMA_PASSWORD_${id}`
      ];

      let envUser = null;
      let envPass = null;
      for (const k of envUserKeys) { if (process.env[k]) { envUser = String(process.env[k]).trim(); break; } }
      for (const k of envPassKeys) { if (process.env[k]) { envPass = String(process.env[k]).trim(); break; } }

      if (envUser && envPass) {
        uploadAuthBase64 = Buffer.from(`${envUser}:${envPass}`).toString('base64');
        console.log('[company.subirCSD] Usando credenciales desde .env para subir CSD, user=', envUser);
      } else {
        // 2) si no en .env, intentar usar FacturamaUser/FacturamaPassword desde BD
        const emRes = await pool.request().input('id', sql.Int, id).query('SELECT FacturamaUser, FacturamaPassword FROM ERP_COMPANY WHERE Company_Id = @id');
        const row = emRes.recordset && emRes.recordset[0];
        if (row && row.FacturamaUser && row.FacturamaPassword) {
          uploadAuthBase64 = Buffer.from(`${String(row.FacturamaUser)}:${String(row.FacturamaPassword)}`).toString('base64');
          console.log('[company.subirCSD] Usando credenciales desde DB para subir CSD, user=', row.FacturamaUser);
        }
      }
    } catch (e) {
      console.warn('[company.subirCSD] No se pudo determinar credenciales de subida, se usará la cuenta global:', e?.message || e);
    }

    // Subir a Facturama (pasando authBase64 si se determinó)
    const result = await facturamaService.subirCSD(cerBase64, keyBase64, passwordCsd, RFC, uploadAuthBase64);

    // Marcar como cargado en BD
    await pool.request()
      .input('id', sql.Int, id)
      .input('CsdPassword', sql.VarChar(100), passwordCsd)
      .query('UPDATE ERP_COMPANY SET CsdCargado = 1, CsdPassword = @CsdPassword WHERE Company_Id = @id');

    // Intentar obtener el nombre oficial del CSD en Facturama y guardarlo en ERP_COMPANY
    try {
      const csds = await facturamaService.listarCSDs();
      const csd = Array.isArray(csds) ? csds.find(c => (c.Rfc || c.rfc || '').toUpperCase() === RFC.toUpperCase()) : null;
      if (csd) {
        const possibleNames = [csd.Name, csd.LegalName, csd.RazonSocial, csd.name, csd.legalName, csd.razonSocial].filter(Boolean);
        const officialName = possibleNames.length ? possibleNames[0] : null;
        if (officialName) {
          try {
            await pool.request()
              .input('id', sql.Int, id)
              .input('LegalName', sql.VarChar(250), officialName)
              .query('UPDATE ERP_COMPANY SET LegalName = @LegalName WHERE Company_Id = @id');
            console.log('[company.subirCSD] Actualizado LegalName desde Facturama:', officialName);
          } catch (e) {
            console.warn('[company.subirCSD] No se pudo actualizar LegalName en BD:', e.message || e);
          }
        }
      }
    } catch (e) {
      console.warn('[company.subirCSD] No se pudo obtener detalles de CSDs desde Facturama:', e.message || e);
    }

    res.json({ 
      success: true, 
      msg: `CSD subido exitosamente para ${RFC}`,
      data: result 
    });
  } catch (err) {
    console.error('company.subirCSD error', err);
    const statusCode = Number(err?.status || err?.StatusCode || err?.statusCode || 500);
    const safeStatusCode = statusCode >= 400 && statusCode < 600 ? statusCode : 500;
    const facturamaMessage = err?.Message || err?.message || err?.ModelState || null;

    res.status(safeStatusCode).json({ 
      msg: 'Error subiendo CSD a Facturama', 
      error: facturamaMessage || err,
      details: err?.ModelState || err?.Details || null,
    });
  }
};

// Listar CSDs cargados en Facturama
exports.listarCSDs = async (req, res) => {
  try {
    const csds = await facturamaService.listarCSDs();

    // Enriquecer con datos de BD
    await pool.connect();
    const companies = await pool.request().query(
      'SELECT Company_Id, RFC, NameCompany, LegalName, CsdCargado FROM ERP_COMPANY'
    );

    const enriched = companies.recordset.map(comp => {
      const csd = Array.isArray(csds) 
        ? csds.find(c => c.Rfc === comp.RFC || c.rfc === comp.RFC) 
        : null;
      return {
        Company_Id: comp.Company_Id,
        NameCompany: comp.NameCompany,
        LegalName: comp.LegalName,
        RFC: comp.RFC,
        CsdCargado: comp.CsdCargado,
        CsdEnFacturama: !!csd,
        CsdDetalle: csd || null
      };
    });

    res.json({ success: true, data: enriched, rawCsds: csds });
  } catch (err) {
    console.error('company.listarCSDs error', err);
    res.status(500).json({ msg: 'Error listando CSDs', error: err.Message || err.message || err });
  }
};

// Eliminar CSD de una empresa en Facturama
exports.eliminarCSD = async (req, res) => {
  const id = Number(req.params.id);
  if (!id || isNaN(id)) return res.status(400).json({ msg: 'Id inválido' });

  try {
    await pool.connect();
    const companyResult = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT RFC FROM ERP_COMPANY WHERE Company_Id = @id');

    if (!companyResult.recordset.length) {
      return res.status(404).json({ msg: 'Empresa no encontrada' });
    }

    const { RFC } = companyResult.recordset[0];
    await facturamaService.eliminarCSD(RFC);

    // Actualizar BD
    await pool.request()
      .input('id', sql.Int, id)
      .query('UPDATE ERP_COMPANY SET CsdCargado = 0, CsdPassword = NULL WHERE Company_Id = @id');

    res.json({ success: true, msg: `CSD eliminado para ${RFC}` });
  } catch (err) {
    console.error('company.eliminarCSD error', err);
    res.status(500).json({ msg: 'Error eliminando CSD', error: err.Message || err.message || err });
  }
};

// Actualizar datos fiscales de una empresa
exports.updateFiscal = async (req, res) => {
  const id = Number(req.params.id);
  const p = req.body || {};
  if (!id || isNaN(id)) return res.status(400).json({ msg: 'Id inválido' });

  try {
    await pool.connect();
    await pool.request()
      .input('id', sql.Int, id)
      .input('RFC', sql.VarChar(50), p.RFC || null)
      .input('LegalName', sql.VarChar(250), p.LegalName || null)
      .input('FiscalRegime', sql.VarChar(10), p.FiscalRegime || null)
      .input('TaxZipCode', sql.VarChar(10), p.TaxZipCode || null)
      .input('Email', sql.VarChar(200), p.Email || null)
      .query(`
        UPDATE ERP_COMPANY 
        SET RFC = COALESCE(@RFC, RFC),
            LegalName = COALESCE(@LegalName, LegalName),
            FiscalRegime = COALESCE(@FiscalRegime, FiscalRegime),
            TaxZipCode = COALESCE(@TaxZipCode, TaxZipCode),
            Email = COALESCE(@Email, Email)
        WHERE Company_Id = @id
      `);
    res.json({ success: true, msg: 'Datos fiscales actualizados' });
  } catch (err) {
    console.error('company.updateFiscal error', err);
    res.status(500).json({ msg: 'Error actualizando datos fiscales' });
  }
};

// Actualizar credenciales Facturama para una empresa (FacturamaUser / FacturamaPassword)
exports.updateFacturamaCredentials = async (req, res) => {
  const id = Number(req.params.id);
  const p = req.body || {};
  if (!id || isNaN(id)) return res.status(400).json({ msg: 'Id inválido' });

  const { FacturamaUser, FacturamaPassword } = p;
  if (!FacturamaUser && !FacturamaPassword) return res.status(400).json({ msg: 'Se requiere FacturamaUser o FacturamaPassword' });

  try {
    await pool.connect();
    await pool.request()
      .input('id', sql.Int, id)
      .input('FacturamaUser', sql.VarChar(200), FacturamaUser || null)
      .input('FacturamaPassword', sql.VarChar(500), FacturamaPassword || null)
      .query(`
        UPDATE ERP_COMPANY
        SET FacturamaUser = COALESCE(@FacturamaUser, FacturamaUser),
            FacturamaPassword = COALESCE(@FacturamaPassword, FacturamaPassword)
        WHERE Company_Id = @id
      `);

    // Do not log sensitive values (only indicate user set)
    console.log(`[company.updateFacturamaCredentials] Credenciales actualizadas para Company_Id=${id}. FacturamaUser set: ${!!FacturamaUser}`);

    res.json({ success: true, msg: 'Credenciales Facturama actualizadas' });
  } catch (err) {
    console.error('company.updateFacturamaCredentials error', err);
    res.status(500).json({ msg: 'Error actualizando credenciales Facturama' });
  }
};
// Helper: check for a company logo file under uploads/logos and return public URL
function getLogoUrlForCompany(companyId, uploadsDir) {
  try {
    if (!companyId) return null;
    const exts = ['png', 'jpg', 'jpeg', 'svg', 'webp'];
    for (const ext of exts) {
      const fname = `company_${companyId}.${ext}`;
      const fpath = path.join(uploadsDir, fname);
      if (fs.existsSync(fpath)) {
        // served by /api/uploads static route
        return `/api/uploads/logos/${fname}`;
      }
    }
    return null;
  } catch (err) {
    return null;
  }
}

// Upload or replace a company logo (multipart/form-data file field: 'logo')
exports.uploadLogo = async (req, res) => {
  const id = Number(req.params.id);
  if (!id || isNaN(id)) return res.status(400).json({ msg: 'Id inválido' });

  if (!req.files || !req.files.logo) {
    return res.status(400).json({ msg: 'Se requiere un archivo `logo`' });
  }

  const logoFile = req.files.logo;
  const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'];
  if (!allowedTypes.includes(logoFile.mimetype)) {
    return res.status(400).json({ msg: 'Tipo de archivo no permitido' });
  }

  try {
    const uploadsDir = path.join(__dirname, '..', 'uploads', 'logos');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

    const extMap = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/svg+xml': 'svg', 'image/webp': 'webp' };
    const ext = extMap[logoFile.mimetype] || 'png';
    const filename = `company_${id}.${ext}`;
    const destPath = path.join(uploadsDir, filename);

    // Remove existing files with other extensions for this company
    const exts = ['png', 'jpg', 'jpeg', 'svg', 'webp'];
    for (const e of exts) {
      const p = path.join(uploadsDir, `company_${id}.${e}`);
      if (fs.existsSync(p) && p !== destPath) {
        try { fs.unlinkSync(p); } catch (e) { /* ignore */ }
      }
    }

    await logoFile.mv(destPath);
    const url = `/api/uploads/logos/${filename}`;

    // Persist LogoUrl in DB (if column exists)
    try {
      await pool.request()
        .input('id', sql.Int, id)
        .input('LogoUrl', sql.VarChar(500), url)
        .query('UPDATE ERP_COMPANY SET LogoUrl = @LogoUrl WHERE Company_Id = @id');
    } catch (e) {
      // If column doesn't exist, ignore but log for visibility
      console.warn('No se pudo persistir LogoUrl en ERP_COMPANY (¿columna ausente?):', e.message || e);
    }

    res.json({ success: true, msg: 'Logo subido', LogoUrl: url });
  } catch (err) {
    console.error('company.uploadLogo error', err);
    res.status(500).json({ msg: 'Error subiendo logo' });
  }
};

exports.getFacturacionStatus = async (req, res) => {
  const id = Number(req.params.id);
  if (!id || isNaN(id)) return res.status(400).json({ msg: 'Id inválido' });

  try {
    if (!req.isAdmin && Array.isArray(req.userCompanies) && req.userCompanies.length > 0) {
      if (!req.userCompanies.includes(id)) {
        return res.status(403).json({ msg: 'No tiene permisos para consultar esta empresa' });
      }
    }

    const status = await facturamaService.getCompanyFacturacionStatus(id);

    res.json({
      success: true,
      data: status,
    });
  } catch (err) {
    console.error('company.getFacturacionStatus error', err);
    res.status(500).json({
      msg: 'Error obteniendo estatus de facturación',
      error: err.Message || err.message || err,
    });
  }
};

// Debug endpoint: listar CSDs de la cuenta global y de cuentas por-empresa (si tienen credenciales)
exports.debugCsds = async (req, res) => {
  try {
    const fact = require('../services/facturamaService');
    await pool.connect();

    // 1) global
    let globalCsds = [];
    try {
      globalCsds = await fact.listarCSDs(null);
    } catch (e) {
      console.warn('[company.debugCsds] listarCSDs global falló:', e?.Message || e?.message || e);
    }

    // 2) get companies with possible credentials
    const companiesRes = await pool.request().query(
      'SELECT Company_Id, RFC, NameCompany, LegalName, FacturamaUser, FacturamaPassword FROM ERP_COMPANY'
    );

    const results = [];

    for (const comp of (companiesRes.recordset || [])) {
      const obj = {
        Company_Id: comp.Company_Id,
        NameCompany: comp.NameCompany,
        RFC: comp.RFC,
        FacturamaUser: comp.FacturamaUser || null,
        Csds: null,
      };

      // If company has Facturama credentials, query them
      if (comp.FacturamaUser && comp.FacturamaPassword) {
        try {
          const authBase64 = Buffer.from(`${String(comp.FacturamaUser)}:${String(comp.FacturamaPassword)}`).toString('base64');
          const csds = await fact.listarCSDs(authBase64);
          obj.Csds = csds || [];
        } catch (e) {
          obj.Csds = { error: e?.Message || e?.message || e };
        }
      }

      // Also indicate if RFC exists in global
      obj.InGlobal = Array.isArray(globalCsds) && globalCsds.find(c => String((c.Rfc || c.rfc || '')).toUpperCase() === String(comp.RFC || '').toUpperCase()) ? true : false;

      results.push(obj);
    }

    // Additionally include raw global list
    res.json({ success: true, globalCount: (globalCsds || []).length, globalCsds, companies: results });
  } catch (err) {
    console.error('company.debugCsds error', err);
    res.status(500).json({ msg: 'Error en debug csds', error: err?.Message || err?.message || err });
  }
};

// Public debug endpoint for local development: only accessible from localhost
exports.debugCsdsPublic = async (req, res) => {
  try {
    const remote = req.ip || req.connection?.remoteAddress;
    const allowed = ['::1', '127.0.0.1', '::ffff:127.0.0.1'];
    if (process.env.NODE_ENV === 'production' && !allowed.includes(remote)) {
      return res.status(403).json({ msg: 'Forbidden' });
    }

    const fact = require('../services/facturamaService');
    await pool.connect();

    let globalCsds = [];
    try {
      globalCsds = await fact.listarCSDs(null);
    } catch (e) {
      console.warn('[company.debugCsdsPublic] listarCSDs global falló:', e?.Message || e?.message || e);
    }

    // get companies for which we might have env creds
    const companiesRes = await pool.request().query('SELECT Company_Id, RFC, NameCompany, LegalName FROM ERP_COMPANY');
    const results = [];
    for (const comp of (companiesRes.recordset || [])) {
      const obj = { Company_Id: comp.Company_Id, NameCompany: comp.NameCompany, RFC: comp.RFC, InGlobal: false, Csds: null };
      // try env credentials first
      const envUserKeys = [`FACTURAMA_USER_COMPANY_${comp.Company_Id}`, `FACTURAMA_USER_${comp.Company_Id}`];
      const envPassKeys = [`FACTURAMA_PASSWORD_COMPANY_${comp.Company_Id}`, `FACTURAMA_PASSWORD_${comp.Company_Id}`];
      let envUser = null, envPass = null;
      for (const k of envUserKeys) { if (process.env[k]) { envUser = String(process.env[k]).trim(); break; } }
      for (const k of envPassKeys) { if (process.env[k]) { envPass = String(process.env[k]).trim(); break; } }
      if (envUser && envPass) {
        try {
          const authBase64 = Buffer.from(`${envUser}:${envPass}`).toString('base64');
          const csds = await fact.listarCSDs(authBase64);
          obj.Csds = csds || [];
        } catch (e) {
          obj.Csds = { error: e?.Message || e?.message || e };
        }
      }

      obj.InGlobal = Array.isArray(globalCsds) && globalCsds.find(c => String((c.Rfc || c.rfc || '')).toUpperCase() === String(comp.RFC || '').toUpperCase()) ? true : false;
      results.push(obj);
    }

    res.json({ success: true, globalCount: (globalCsds || []).length, globalCsds, companies: results });
  } catch (err) {
    console.error('company.debugCsdsPublic error', err);
    res.status(500).json({ msg: 'Error en debug csds public', error: err?.Message || err?.message || err });
  }
};

module.exports = exports;
