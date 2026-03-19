const { pool, sql } = require('../config/db');
const { poolPromise } = require('../config/db');
const facturamaService = require('../services/facturamaService');

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
             EmailAprobacion1, EmailAprobacion2
      FROM ERP_COMPANY
      ORDER BY NameCompany
    `);
    res.json(r.recordset || []);
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
             EmailAprobacion1, EmailAprobacion2
      FROM ERP_COMPANY WHERE Company_Id = @id
    `);
    if (!r.recordset || r.recordset.length === 0) return res.status(404).json({ msg: 'Compañía no encontrada' });
    res.json(r.recordset[0]);
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

    // Subir a Facturama
    const result = await facturamaService.subirCSD(cerBase64, keyBase64, passwordCsd, RFC);

    // Marcar como cargado en BD
    await pool.request()
      .input('id', sql.Int, id)
      .input('CsdPassword', sql.VarChar(100), passwordCsd)
      .query('UPDATE ERP_COMPANY SET CsdCargado = 1, CsdPassword = @CsdPassword WHERE Company_Id = @id');

    res.json({ 
      success: true, 
      msg: `CSD subido exitosamente para ${RFC}`,
      data: result 
    });
  } catch (err) {
    console.error('company.subirCSD error', err);
    res.status(500).json({ 
      msg: 'Error subiendo CSD a Facturama', 
      error: err.Message || err.message || err 
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

module.exports = exports;
