const { pool, sql } = require('../config/db');

const DEFAULT_CLIENT_TYPE = 'CLIENTE';

// Helper: parse CHECK constraint for ClientType values, fallback to known defaults
async function getAllowedClientTypeValues() {
  try {
    await pool.connect();
    const q = `SELECT cc.definition FROM sys.check_constraints cc WHERE cc.parent_object_id = OBJECT_ID('ERP_CLIENT') AND cc.definition LIKE '%ClientType%'`;
    const r = await pool.request().query(q);
    if (r.recordset && r.recordset.length > 0) {
      const def = r.recordset[0].definition || '';
      const matches = def.match(/'([^']+)'/g);
      if (matches && matches.length > 0) {
        return matches.map((m) => m.replace(/'/g, '').toUpperCase());
      }
    }
  } catch (err) {
    console.warn('Could not parse CHECK constraint for ERP_CLIENT.ClientType', err && err.message);
  }

  return ['CLIENTE', 'PROVEEDOR', 'AMBOS'];
}

function normalizeClientTypeValue(rawValue) {
  if (!rawValue && rawValue !== 0) return DEFAULT_CLIENT_TYPE;

  const value = String(rawValue).trim().toUpperCase();
  if (!value) return DEFAULT_CLIENT_TYPE;

  const map = {
    CLIENTE: 'CLIENTE',
    CLIENT: 'CLIENTE',
    CUSTOMER: 'CLIENTE',
    PROVEEDOR: 'PROVEEDOR',
    SUPPLIER: 'PROVEEDOR',
    VENDOR: 'PROVEEDOR',
    AMBOS: 'AMBOS',
    BOTH: 'AMBOS',
    CLIENTE_PROVEEDOR: 'AMBOS',
    PROVEEDOR_CLIENTE: 'AMBOS',
  };

  return map[value] || value;
}

// Helper: try to parse CHECK constraint for Status values, fallback to DISTINCT
async function getAllowedStatusValues() {
  try {
    await pool.connect();
    const q = `SELECT cc.definition FROM sys.check_constraints cc WHERE cc.parent_object_id = OBJECT_ID('ERP_CLIENT') AND cc.definition LIKE '%Status%'`;
    const r = await pool.request().query(q);
    if (r.recordset && r.recordset.length > 0) {
      const def = r.recordset[0].definition || '';
      const matches = def.match(/'([^']+)'/g);
      if (matches && matches.length > 0) {
        return matches.map(m => m.replace(/'/g, ''));
      }
    }
  } catch (err) {
    console.warn('Could not parse CHECK constraint for ERP_CLIENT.Status', err && err.message);
  }

  // fallback: distinct values from table
  try {
    await pool.connect();
    const res = await pool.request().query('SELECT DISTINCT Status FROM ERP_CLIENT');
    return (res.recordset || []).map(r => r.Status).filter(Boolean);
  } catch (err) {
    console.warn('Fallback distinct Status failed', err && err.message);
  }

  // last resort
  return ['ACTIVO', 'INACTIVO', 'BLOQUEADO'];
}

exports.meta = async (req, res) => {
  try {
    const allowed = await getAllowedStatusValues();
    res.json({ allowed });
  } catch (err) {
    console.error('clients.meta error', err);
    res.status(500).json({ msg: 'Error obteniendo meta de clientes' });
  }
};

exports.list = async (req, res) => {
  try {
    await pool.connect();
    const companyId = req.query.company_id;
    
    // Si no es admin, filtrar por empresas del usuario
    if (!req.isAdmin && req.userCompanies && req.userCompanies.length > 0) {
      const placeholders = req.userCompanies.map((_, idx) => `@company${idx}`).join(',');
      const request = pool.request();
      req.userCompanies.forEach((cid, idx) => {
        request.input(`company${idx}`, sql.Int, cid);
      });
      
      const result = await request.query(`
        SELECT DISTINCT c.Client_Id, c.LegalName, c.CommercialName, c.RFC, c.TaxRegime, c.ClientType, c.Status, c.CreatedAt, c.UpdatedAt
        FROM ERP_CLIENT c
        INNER JOIN ERP_CLIENTCOMPANIES cc ON c.Client_Id = cc.Client_Id
        WHERE cc.Company_Id IN (${placeholders})
        ORDER BY c.LegalName
      `);
      return res.json({ success: true, data: result.recordset || [] });
    }
    
    // Admin: filtrar por company_id si se especifica
    if (companyId && companyId !== 'all') {
      const result = await pool.request()
        .input('Company_Id', sql.Int, parseInt(companyId))
        .query(`
          SELECT DISTINCT c.Client_Id, c.LegalName, c.CommercialName, c.RFC, c.TaxRegime, c.ClientType, c.Status, c.CreatedAt, c.UpdatedAt
          FROM ERP_CLIENT c
          INNER JOIN ERP_CLIENTCOMPANIES cc ON c.Client_Id = cc.Client_Id
          WHERE cc.Company_Id = @Company_Id
          ORDER BY c.LegalName
        `);
      return res.json({ success: true, data: result.recordset || [] });
    }
    
    // Admin sin filtro: todos los clientes
    const result = await pool.request().query(`
      SELECT TOP (1000) [Client_Id]
      ,[LegalName]
      ,[CommercialName]
      ,[RFC]
      ,[TaxRegime]
      ,[ClientType]
      ,[Status]
      ,[CreatedAt]
      ,[UpdatedAt]
      FROM ERP_CLIENT
      ORDER BY LegalName
    `);
    res.json({ success: true, data: result.recordset || [] });
  } catch (err) {
    console.error('clients.list error', err);
    res.status(500).json({ success: false, message: 'Error listando clientes' });
  }
};

exports.get = async (req, res) => {
  const id = Number(req.params.id);
  if (!id || isNaN(id)) return res.status(400).json({ msg: 'Id inválido' });
  try {
    await pool.connect();
    const client = await pool.request().input('id', sql.Int, id).query('SELECT * FROM ERP_CLIENT WHERE Client_Id = @id');
    const c = client.recordset && client.recordset[0];
    if (!c) return res.status(404).json({ msg: 'Cliente no encontrado' });

    const addresses = await pool.request().input('id', sql.Int, id).query('SELECT * FROM ERP_CLIENTADRESSES WHERE Client_Id = @id');
    const contacts = await pool.request().input('id', sql.Int, id).query('SELECT * FROM ERP_CLIENTCONTACTS WHERE Client_Id = @id');
    const financial = await pool.request().input('id', sql.Int, id).query('SELECT * FROM ERP_CLIENTFINANCIALSETTINGS WHERE Client_Id = @id');
    const companies = await pool.request().input('id', sql.Int, id).query('SELECT cc.Company_Id, ec.NameCompany FROM ERP_CLIENTCOMPANIES cc JOIN ERP_COMPANY ec ON cc.Company_Id = ec.Company_Id WHERE cc.Client_Id = @id');

    res.json({ client: c, addresses: addresses.recordset || [], contacts: contacts.recordset || [], financial: financial.recordset || [], companies: companies.recordset || [] });
  } catch (err) {
    console.error('clients.get error', err);
    res.status(500).json({ msg: 'Error obteniendo cliente' });
  }
};

exports.create = async (req, res) => {
  try {
    const payload = req.body || {};
    console.log('=== INICIO CREATE CLIENT ===');
    console.log('Payload:', JSON.stringify(payload, null, 2));

    const { LegalName, CommercialName, RFC, TaxRegime, ClientType, Status, Addresses, Contacts, Company_Ids } = payload;

    if (!LegalName) {
      return res.status(400).json({ msg: 'LegalName es requerido' });
    }

    const allowedClientTypes = await getAllowedClientTypeValues();
    const normalizedClientType = normalizeClientTypeValue(ClientType);
    if (!allowedClientTypes.includes(normalizedClientType)) {
      return res.status(400).json({
        msg: 'ClientType inválido',
        received: ClientType,
        normalized: normalizedClientType,
        allowed: allowedClientTypes,
      });
    }

    await pool.connect();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // Insert client
      const clientRequest = new sql.Request(transaction);
      clientRequest.input('LegalName', sql.VarChar(250), LegalName);
      clientRequest.input('CommercialName', sql.VarChar(250), CommercialName || null);
      clientRequest.input('RFC', sql.VarChar(100), RFC || null);
      clientRequest.input('TaxRegime', sql.VarChar(100), TaxRegime || null);
      clientRequest.input('ClientType', sql.VarChar(100), normalizedClientType);
      clientRequest.input('Status', sql.VarChar(50), Status || 'ACTIVO');

      const insertResult = await clientRequest.query(
        `INSERT INTO ERP_CLIENT (LegalName, CommercialName, RFC, TaxRegime, ClientType, Status) 
         VALUES (@LegalName, @CommercialName, @RFC, @TaxRegime, @ClientType, @Status); 
         SELECT SCOPE_IDENTITY() AS Client_Id;`
      );

      const clientId = insertResult.recordset[0].Client_Id;
      console.log('Cliente creado con ID:', clientId);

      // Insert client companies
      if (Array.isArray(Company_Ids) && Company_Ids.length > 0) {
        for (const companyId of Company_Ids) {
          const companyRequest = new sql.Request(transaction);
          companyRequest.input('Client_Id', sql.Int, clientId);
          companyRequest.input('Company_Id', sql.Int, companyId);
          
          await companyRequest.query(
            `IF NOT EXISTS (SELECT 1 FROM ERP_CLIENTCOMPANIES WHERE Client_Id = @Client_Id AND Company_Id = @Company_Id)
             INSERT INTO ERP_CLIENTCOMPANIES (Client_Id, Company_Id) VALUES (@Client_Id, @Company_Id)`
          );
        }
        console.log('Empresas asignadas:', Company_Ids.length);
      }

      // Insert addresses
      if (Array.isArray(Addresses) && Addresses.length > 0) {
        for (const addr of Addresses) {
          const addrRequest = new sql.Request(transaction);
          addrRequest.input('Client_Id', sql.Int, clientId);
          addrRequest.input('AddressType', sql.VarChar(50), addr.AddressType || null);
          addrRequest.input('Street', sql.VarChar(500), addr.Street || null);
          addrRequest.input('City', sql.VarChar(200), addr.City || null);
          addrRequest.input('State', sql.VarChar(200), addr.State || null);
          addrRequest.input('PostalCode', sql.VarChar(50), addr.PostalCode || null);
          addrRequest.input('Country', sql.VarChar(100), addr.Country || null);
          addrRequest.input('IsPrimary', sql.Bit, addr.IsPrimary ? 1 : 0);
          
          await addrRequest.query(
            `INSERT INTO ERP_CLIENTADRESSES (Client_Id, AddressType, Street, City, State, PostalCode, Country, IsPrimary) 
             VALUES (@Client_Id, @AddressType, @Street, @City, @State, @PostalCode, @Country, @IsPrimary)`
          );
        }
        console.log('Direcciones insertadas:', Addresses.length);
      }

      // Insert contacts
      if (Array.isArray(Contacts) && Contacts.length > 0) {
        for (const contact of Contacts) {
          const contactRequest = new sql.Request(transaction);
          contactRequest.input('Client_Id', sql.Int, clientId);
          contactRequest.input('FullName', sql.VarChar(200), contact.FullName || null);
          contactRequest.input('PhoneNumber', sql.VarChar(100), contact.PhoneNumber || null);
          contactRequest.input('MobileNumber', sql.VarChar(100), contact.MobileNumber || null);
          contactRequest.input('Email', sql.VarChar(200), contact.Email || null);
          contactRequest.input('SecondaryEmail', sql.VarChar(200), contact.SecondaryEmail || null);
          contactRequest.input('IsPrimary', sql.Bit, contact.IsPrimary ? 1 : 0);
          
          await contactRequest.query(
            `INSERT INTO ERP_CLIENTCONTACTS (Client_Id, FullName, PhoneNumber, MobileNumber, Email, SecondaryEmail, IsPrimary) 
             VALUES (@Client_Id, @FullName, @PhoneNumber, @MobileNumber, @Email, @SecondaryEmail, @IsPrimary)`
          );
        }
        console.log('Contactos insertados:', Contacts.length);
      }

      await transaction.commit();
      console.log('=== CLIENTE CREADO EXITOSAMENTE ===');
      return res.status(201).json({ msg: 'Cliente creado', Client_Id: clientId });

    } catch (transactionError) {
      await transaction.rollback();
      console.error('Error en transacción:', transactionError.message);
      console.error('Stack:', transactionError.stack);
      return res.status(500).json({ msg: 'Error en transacción', error: transactionError.message });
    }

  } catch (error) {
    console.error('Error general:', error.message);
    console.error('Stack:', error.stack);
    return res.status(500).json({ msg: 'Error del servidor', error: error.message });
  }
};

exports.update = async (req, res) => {
  const id = Number(req.params.id);
  if (!id || isNaN(id)) return res.status(400).json({ msg: 'Id inválido' });
  
  try {
    const payload = req.body || {};
    console.log('=== INICIO UPDATE CLIENT ===');
    console.log('Client ID:', id);
    console.log('Payload:', JSON.stringify(payload, null, 2));

    const { LegalName, CommercialName, RFC, TaxRegime, ClientType, Status, Addresses, Contacts, Company_Ids } = payload;

    if (!LegalName) {
      return res.status(400).json({ msg: 'LegalName es requerido' });
    }

    const allowed = await getAllowedStatusValues();
    if (Status && !allowed.includes(Status)) {
      return res.status(400).json({ msg: 'Status inválido', allowed });
    }

    const allowedClientTypes = await getAllowedClientTypeValues();
    const normalizedClientType = normalizeClientTypeValue(ClientType);
    if (!allowedClientTypes.includes(normalizedClientType)) {
      return res.status(400).json({
        msg: 'ClientType inválido',
        received: ClientType,
        normalized: normalizedClientType,
        allowed: allowedClientTypes,
      });
    }

    await pool.connect();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // Update client basic info
      const clientRequest = new sql.Request(transaction);
      clientRequest.input('id', sql.Int, id);
      clientRequest.input('LegalName', sql.VarChar(250), LegalName);
      clientRequest.input('CommercialName', sql.VarChar(250), CommercialName || null);
      clientRequest.input('RFC', sql.VarChar(100), RFC || null);
      clientRequest.input('TaxRegime', sql.VarChar(100), TaxRegime || null);
      clientRequest.input('ClientType', sql.VarChar(100), normalizedClientType);
      clientRequest.input('Status', sql.VarChar(50), Status || 'ACTIVO');

      await clientRequest.query(
        `UPDATE ERP_CLIENT 
         SET LegalName = @LegalName, CommercialName = @CommercialName, RFC = @RFC, 
             TaxRegime = @TaxRegime, ClientType = @ClientType, Status = @Status
         WHERE Client_Id = @id`
      );
      console.log('Cliente actualizado');

      // Delete existing addresses, contacts and companies
      await transaction.request().input('id', sql.Int, id).query('DELETE FROM ERP_CLIENTADRESSES WHERE Client_Id = @id');
      await transaction.request().input('id', sql.Int, id).query('DELETE FROM ERP_CLIENTCONTACTS WHERE Client_Id = @id');
      await transaction.request().input('id', sql.Int, id).query('DELETE FROM ERP_CLIENTCOMPANIES WHERE Client_Id = @id');
      console.log('Direcciones, contactos y empresas anteriores eliminados');

      // Insert client companies
      if (Array.isArray(Company_Ids) && Company_Ids.length > 0) {
        for (const companyId of Company_Ids) {
          const companyRequest = new sql.Request(transaction);
          companyRequest.input('Client_Id', sql.Int, id);
          companyRequest.input('Company_Id', sql.Int, companyId);
          
          await companyRequest.query(
            `INSERT INTO ERP_CLIENTCOMPANIES (Client_Id, Company_Id) VALUES (@Client_Id, @Company_Id)`
          );
        }
        console.log('Empresas asignadas:', Company_Ids.length);
      }

      // Insert new addresses
      if (Array.isArray(Addresses) && Addresses.length > 0) {
        for (const addr of Addresses) {
          const addrRequest = new sql.Request(transaction);
          addrRequest.input('Client_Id', sql.Int, id);
          addrRequest.input('AddressType', sql.VarChar(50), addr.AddressType || null);
          addrRequest.input('Street', sql.VarChar(500), addr.Street || null);
          addrRequest.input('City', sql.VarChar(200), addr.City || null);
          addrRequest.input('State', sql.VarChar(200), addr.State || null);
          addrRequest.input('PostalCode', sql.VarChar(50), addr.PostalCode || null);
          addrRequest.input('Country', sql.VarChar(100), addr.Country || null);
          addrRequest.input('IsPrimary', sql.Bit, addr.IsPrimary ? 1 : 0);
          
          await addrRequest.query(
            `INSERT INTO ERP_CLIENTADRESSES (Client_Id, AddressType, Street, City, State, PostalCode, Country, IsPrimary) 
             VALUES (@Client_Id, @AddressType, @Street, @City, @State, @PostalCode, @Country, @IsPrimary)`
          );
        }
        console.log('Direcciones insertadas:', Addresses.length);
      }

      // Insert new contacts
      if (Array.isArray(Contacts) && Contacts.length > 0) {
        for (const contact of Contacts) {
          const contactRequest = new sql.Request(transaction);
          contactRequest.input('Client_Id', sql.Int, id);
          contactRequest.input('FullName', sql.VarChar(200), contact.FullName || null);
          contactRequest.input('PhoneNumber', sql.VarChar(100), contact.PhoneNumber || null);
          contactRequest.input('MobileNumber', sql.VarChar(100), contact.MobileNumber || null);
          contactRequest.input('Email', sql.VarChar(200), contact.Email || null);
          contactRequest.input('SecondaryEmail', sql.VarChar(200), contact.SecondaryEmail || null);
          contactRequest.input('IsPrimary', sql.Bit, contact.IsPrimary ? 1 : 0);
          
          await contactRequest.query(
            `INSERT INTO ERP_CLIENTCONTACTS (Client_Id, FullName, PhoneNumber, MobileNumber, Email, SecondaryEmail, IsPrimary) 
             VALUES (@Client_Id, @FullName, @PhoneNumber, @MobileNumber, @Email, @SecondaryEmail, @IsPrimary)`
          );
        }
        console.log('Contactos insertados:', Contacts.length);
      }

      await transaction.commit();
      console.log('=== CLIENTE ACTUALIZADO EXITOSAMENTE ===');
      return res.json({ msg: 'Cliente actualizado' });

    } catch (transactionError) {
      await transaction.rollback();
      console.error('Error en transacción:', transactionError.message);
      console.error('Stack:', transactionError.stack);
      return res.status(500).json({ msg: 'Error en transacción', error: transactionError.message });
    }

  } catch (error) {
    console.error('Error general:', error.message);
    console.error('Stack:', error.stack);
    return res.status(500).json({ msg: 'Error del servidor', error: error.message });
  }
};

exports.remove = async (req, res) => {
  const id = Number(req.params.id);
  if (!id || isNaN(id)) return res.status(400).json({ msg: 'Id inválido' });
  try {
    await pool.connect();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      await transaction.request().input('id', sql.Int, id).query('DELETE FROM ERP_CLIENTADRESSES WHERE Client_Id = @id');
      await transaction.request().input('id', sql.Int, id).query('DELETE FROM ERP_CLIENTCONTACTS WHERE Client_Id = @id');
      await transaction.request().input('id', sql.Int, id).query('DELETE FROM ERP_CLIENTFINANCIALSETTINGS WHERE Client_Id = @id');
      await transaction.request().input('id', sql.Int, id).query('DELETE FROM ERP_CLIENT WHERE Client_Id = @id');
      await transaction.commit();
      res.json({ msg: 'Cliente eliminado' });
    } catch (innerErr) {
      await transaction.rollback();
      console.error('clients.remove transaction error', innerErr);
      res.status(500).json({ msg: 'Error eliminando cliente' });
    }
  } catch (err) {
    console.error('clients.remove error', err);
    res.status(500).json({ msg: 'Error servidor' });
  }
};

// Activar / Desactivar cliente usando el campo Status: ACTIVO / INACTIVO
exports.toggleActive = async (req, res) => {
  const id = Number(req.params.id);
  if (!id || isNaN(id)) return res.status(400).json({ msg: 'Id inválido' });
  const body = req.body || {};
  // Expect IsActive: 1 or 0; if not provided, toggle based on current value
  try {
    await pool.connect();
    const curr = await pool.request().input('id', sql.Int, id).query('SELECT Status FROM ERP_CLIENT WHERE Client_Id = @id');
    if (!curr.recordset || curr.recordset.length === 0) return res.status(404).json({ msg: 'Cliente no encontrado' });
    const currentStatus = curr.recordset[0].Status;
    let newStatus = 'ACTIVO';
    if (typeof body.IsActive !== 'undefined') {
      newStatus = (body.IsActive === 1 || body.IsActive === true || body.IsActive === '1') ? 'ACTIVO' : 'INACTIVO';
    } else {
      // toggle
      newStatus = (String(currentStatus).toUpperCase() === 'ACTIVO') ? 'INACTIVO' : 'ACTIVO';
    }
    await pool.request().input('id', sql.Int, id).input('status', sql.VarChar(50), newStatus).query('UPDATE ERP_CLIENT SET Status = @status WHERE Client_Id = @id');
    res.json({ msg: 'Estado actualizado', Status: newStatus });
  } catch (err) {
    console.error('clients.toggleActive error', err);
    res.status(500).json({ msg: 'Error actualizando estado' });
  }
};

module.exports = exports;

// Addresses CRUD
exports.listAddresses = async (req, res) => {
  const id = Number(req.params.id);
  if (!id || isNaN(id)) return res.status(400).json({ msg: 'Id inválido' });
  try {
    await pool.connect();
    const r = await pool.request().input('id', sql.Int, id).query('SELECT * FROM ERP_CLIENTADRESSES WHERE Client_Id = @id');
    res.json({ addresses: r.recordset || [] });
  } catch (err) {
    console.error('listAddresses error', err);
    res.status(500).json({ msg: 'Error listando direcciones' });
  }
};

exports.createAddress = async (req, res) => {
  const id = Number(req.params.id);
  const p = req.body || {};
  if (!id || isNaN(id)) return res.status(400).json({ msg: 'Id inválido' });
  try {
    await pool.connect();
    const r = await pool.request()
      .input('Client_Id', sql.Int, id)
      .input('AddressType', sql.VarChar(50), p.AddressType || null)
      .input('Street', sql.VarChar(500), p.Street || null)
      .input('City', sql.VarChar(200), p.City || null)
      .input('State', sql.VarChar(200), p.State || null)
      .input('PostalCode', sql.VarChar(50), p.PostalCode || null)
      .input('Country', sql.VarChar(100), p.Country || null)
      .input('IsPrimary', sql.Bit, p.IsPrimary ? 1 : 0)
      .query('INSERT INTO ERP_CLIENTADRESSES (Client_Id, AddressType, Street, City, State, PostalCode, Country, IsPrimary) VALUES (@Client_Id, @AddressType, @Street, @City, @State, @PostalCode, @Country, @IsPrimary); SELECT SCOPE_IDENTITY() AS Address_Id;');
    const addressId = r.recordset && r.recordset[0] && r.recordset[0].Address_Id;
    res.status(201).json({ msg: 'Dirección creada', Address_Id: addressId });
  } catch (err) {
    console.error('createAddress error', err);
    res.status(500).json({ msg: 'Error creando dirección' });
  }
};

exports.updateAddress = async (req, res) => {
  const id = Number(req.params.id);
  const addressId = Number(req.params.addressId);
  const p = req.body || {};
  if (!id || isNaN(id) || !addressId || isNaN(addressId)) return res.status(400).json({ msg: 'Parámetros inválidos' });
  try {
    await pool.connect();
    await pool.request()
      .input('Address_Id', sql.Int, addressId)
      .input('AddressType', sql.VarChar(50), p.AddressType || null)
      .input('Street', sql.VarChar(500), p.Street || null)
      .input('City', sql.VarChar(200), p.City || null)
      .input('State', sql.VarChar(200), p.State || null)
      .input('PostalCode', sql.VarChar(50), p.PostalCode || null)
      .input('Country', sql.VarChar(100), p.Country || null)
      .input('IsPrimary', sql.Bit, p.IsPrimary ? 1 : 0)
      .query('UPDATE ERP_CLIENTADRESSES SET AddressType=@AddressType, Street=@Street, City=@City, State=@State, PostalCode=@PostalCode, Country=@Country, IsPrimary=@IsPrimary WHERE Address_Id = @Address_Id AND Client_Id = ' + id);
    res.json({ msg: 'Dirección actualizada' });
  } catch (err) {
    console.error('updateAddress error', err);
    res.status(500).json({ msg: 'Error actualizando dirección' });
  }
};

exports.removeAddress = async (req, res) => {
  const id = Number(req.params.id);
  const addressId = Number(req.params.addressId);
  if (!id || isNaN(id) || !addressId || isNaN(addressId)) return res.status(400).json({ msg: 'Parámetros inválidos' });
  try {
    await pool.connect();
    await pool.request().input('Address_Id', sql.Int, addressId).query('DELETE FROM ERP_CLIENTADRESSES WHERE Address_Id = @Address_Id AND Client_Id = ' + id);
    res.json({ msg: 'Dirección eliminada' });
  } catch (err) {
    console.error('removeAddress error', err);
    res.status(500).json({ msg: 'Error eliminando dirección' });
  }
};

// Contacts CRUD
exports.listContacts = async (req, res) => {
  const id = Number(req.params.id);
  if (!id || isNaN(id)) return res.status(400).json({ msg: 'Id inválido' });
  try {
    await pool.connect();
    const r = await pool.request().input('id', sql.Int, id).query('SELECT * FROM ERP_CLIENTCONTACTS WHERE Client_Id = @id');
    res.json({ contacts: r.recordset || [] });
  } catch (err) {
    console.error('listContacts error', err);
    res.status(500).json({ msg: 'Error listando contactos' });
  }
};

exports.createContact = async (req, res) => {
  const id = Number(req.params.id);
  const p = req.body || {};
  if (!id || isNaN(id)) return res.status(400).json({ msg: 'Id inválido' });
  try {
    await pool.connect();
    const r = await pool.request()
      .input('Client_Id', sql.Int, id)
      .input('FullName', sql.VarChar(200), p.FullName || null)
      .input('PhoneNumber', sql.VarChar(100), p.PhoneNumber || null)
      .input('MobileNumber', sql.VarChar(100), p.MobileNumber || null)
      .input('Email', sql.VarChar(200), p.Email || null)
      .input('SecondaryEmail', sql.VarChar(200), p.SecondaryEmail || null)
      .input('IsPrimary', sql.Bit, p.IsPrimary ? 1 : 0)
      .query('INSERT INTO ERP_CLIENTCONTACTS (Client_Id, FullName, PhoneNumber, MobileNumber, Email, SecondaryEmail, IsPrimary) VALUES (@Client_Id, @FullName, @PhoneNumber, @MobileNumber, @Email, @SecondaryEmail, @IsPrimary); SELECT SCOPE_IDENTITY() AS Contact_Id;');
    const contactId = r.recordset && r.recordset[0] && r.recordset[0].Contact_Id;
    res.status(201).json({ msg: 'Contacto creado', Contact_Id: contactId });
  } catch (err) {
    console.error('createContact error', err);
    res.status(500).json({ msg: 'Error creando contacto' });
  }
};

exports.updateContact = async (req, res) => {
  const id = Number(req.params.id);
  const contactId = Number(req.params.contactId);
  const p = req.body || {};
  if (!id || isNaN(id) || !contactId || isNaN(contactId)) return res.status(400).json({ msg: 'Parámetros inválidos' });
  try {
    await pool.connect();
    await pool.request()
      .input('Contact_Id', sql.Int, contactId)
      .input('FullName', sql.VarChar(200), p.FullName || null)
      .input('PhoneNumber', sql.VarChar(100), p.PhoneNumber || null)
      .input('MobileNumber', sql.VarChar(100), p.MobileNumber || null)
      .input('Email', sql.VarChar(200), p.Email || null)
      .input('SecondaryEmail', sql.VarChar(200), p.SecondaryEmail || null)
      .input('IsPrimary', sql.Bit, p.IsPrimary ? 1 : 0)
      .query('UPDATE ERP_CLIENTCONTACTS SET FullName=@FullName, PhoneNumber=@PhoneNumber, MobileNumber=@MobileNumber, Email=@Email, SecondaryEmail=@SecondaryEmail, IsPrimary=@IsPrimary WHERE Contact_Id = @Contact_Id AND Client_Id = ' + id);
    res.json({ msg: 'Contacto actualizado' });
  } catch (err) {
    console.error('updateContact error', err);
    res.status(500).json({ msg: 'Error actualizando contacto' });
  }
};

exports.removeContact = async (req, res) => {
  const id = Number(req.params.id);
  const contactId = Number(req.params.contactId);
  if (!id || isNaN(id) || !contactId || isNaN(contactId)) return res.status(400).json({ msg: 'Parámetros inválidos' });
  try {
    await pool.connect();
    await pool.request().input('Contact_Id', sql.Int, contactId).query('DELETE FROM ERP_CLIENTCONTACTS WHERE Contact_Id = @Contact_Id AND Client_Id = ' + id);
    res.json({ msg: 'Contacto eliminado' });
  } catch (err) {
    console.error('removeContact error', err);
    res.status(500).json({ msg: 'Error eliminando contacto' });
  }
};

// Financial settings (one row per client) - get and upsert
exports.getFinancial = async (req, res) => {
  const id = Number(req.params.id);
  if (!id || isNaN(id)) return res.status(400).json({ msg: 'Id inválido' });
  try {
    await pool.connect();
    const r = await pool.request().input('id', sql.Int, id).query('SELECT * FROM ERP_CLIENTFINANCIALSETTINGS WHERE Client_Id = @id');
    res.json({ financial: r.recordset && r.recordset[0] ? r.recordset[0] : null });
  } catch (err) {
    console.error('getFinancial error', err);
    res.status(500).json({ msg: 'Error obteniendo configuración financiera' });
  }
};

exports.upsertFinancial = async (req, res) => {
  const id = Number(req.params.id);
  const p = req.body || {};
  if (!id || isNaN(id)) return res.status(400).json({ msg: 'Id inválido' });
  try {
    await pool.connect();
    // Upsert: delete existing and insert (or you can update)
    await pool.request().input('Client_Id', sql.Int, id).query('DELETE FROM ERP_CLIENTFINANCIALSETTINGS WHERE Client_Id = @Client_Id');
    await pool.request()
      .input('Client_Id', sql.Int, id)
      .input('HasCredit', sql.Bit, p.HasCredit ? 1 : 0)
      .input('CreditLimit', sql.Decimal(18,2), p.CreditLimit || 0)
      .input('CreditDays', sql.Int, p.CreditDays || 0)
      .input('Currency', sql.VarChar(20), p.Currency || null)
      .input('PaymentMethod', sql.VarChar(100), p.PaymentMethod || null)
      .input('PaymentForm', sql.VarChar(100), p.PaymentForm || null)
      .input('CreditStatus', sql.VarChar(50), p.CreditStatus || null)
      .query('INSERT INTO ERP_CLIENTFINANCIALSETTINGS (Client_Id, HasCredit, CreditLimit, CreditDays, Currency, PaymentMethod, PaymentForm, CreditStatus) VALUES (@Client_Id, @HasCredit, @CreditLimit, @CreditDays, @Currency, @PaymentMethod, @PaymentForm, @CreditStatus)');
    res.json({ msg: 'Configuración financiera guardada' });
  } catch (err) {
    console.error('upsertFinancial error', err);
    res.status(500).json({ msg: 'Error guardando configuración financiera' });
  }
};
