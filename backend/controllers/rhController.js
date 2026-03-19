const { pool, sql } = require('../config/db');
const fs = require('fs');
const path = require('path');

const RH_DOC_ALLOWED_MIMES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

const RH_DOC_EXT_BY_MIME = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx'
};

function hasCompanyAccess(req, companyId) {
  if (req.isSuperAdmin) return true;
  return Array.isArray(req.userCompanies) && req.userCompanies.includes(Number(companyId));
}

async function getUserCompanyIds(userId) {
  const result = await pool.request()
    .input('User_Id', sql.Int, userId)
    .query('SELECT Company_Id FROM ERP_USERCOMPANIES WHERE User_Id = @User_Id');

  return (result.recordset || []).map((row) => Number(row.Company_Id)).filter(Boolean);
}

async function canAccessUser(req, userId) {
  if (req.isSuperAdmin) return true;
  if (Number(req.user?.User_Id) === Number(userId)) return true;

  const targetCompanyIds = await getUserCompanyIds(userId);
  if (targetCompanyIds.length === 0) return false;

  return targetCompanyIds.every((companyId) => hasCompanyAccess(req, companyId));
}

function isSelf(req, userId) {
  return Number(req.user?.User_Id) === Number(userId);
}

async function canManageUser(req, userId) {
  if (req.isAdmin || req.isSuperAdmin) {
    return canAccessUser(req, userId);
  }

  return isSelf(req, userId);
}

exports.listPerfiles = async (req, res) => {
  try {
    await pool.connect();
    const request = pool.request();
    const whereParts = [];

    const companyIdRaw = req.query.company_id;
    if (!req.isAdmin && !req.isSuperAdmin) {
      request.input('CurrentUser_Id', sql.Int, Number(req.user?.User_Id));
      whereParts.push('u.User_Id = @CurrentUser_Id');
    } else if (!req.isSuperAdmin) {
      if (!Array.isArray(req.userCompanies) || req.userCompanies.length === 0) {
        return res.json([]);
      }

      const companyParams = req.userCompanies.map((companyId, index) => {
        const paramName = `AllowedCompany_${index}`;
        request.input(paramName, sql.Int, Number(companyId));
        return `@${paramName}`;
      });
      whereParts.push(`uc.Company_Id IN (${companyParams.join(', ')})`);
    }

    if (companyIdRaw && companyIdRaw !== 'all') {
      const companyId = Number(companyIdRaw);
      if (!Number.isInteger(companyId)) {
        return res.status(400).json({ msg: 'company_id inválido' });
      }
      if (!hasCompanyAccess(req, companyId)) {
        return res.status(403).json({ msg: 'No tiene permisos para consultar esta empresa' });
      }
      request.input('Company_Id_Filter', sql.Int, companyId);
      whereParts.push('uc.Company_Id = @Company_Id_Filter');
    }

    const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : '';
    const query = `
      SELECT
        u.User_Id,
        u.Name,
        u.Lastname,
        u.Email,
        u.PhoneNumber,
        u.Area,
        hp.NumeroEmpleado,
        hp.Puesto,
        hp.Departamento,
        hp.FechaIngreso,
        hp.TipoContrato,
        hp.EstadoCivil,
        hp.CURP,
        hp.RFC,
        hp.NSS,
        hp.Ciudad,
        hp.Estado,
        hp.Pais,
        hp.BancoPrincipal,
        hp.NumeroCuentaPrincipal,
        hp.CLABE,
        hp.NombreTitularCuenta,
        hp.FotoPerfilUrl,
        STRING_AGG(c.NameCompany, ', ') AS NameCompany
      FROM ERP_USERS u
      LEFT JOIN ERP_USERCOMPANIES uc ON u.User_Id = uc.User_Id
      LEFT JOIN ERP_COMPANY c ON uc.Company_Id = c.Company_Id
      LEFT JOIN ERP_HR_PROFILE hp ON u.User_Id = hp.User_Id
      ${whereClause}
      GROUP BY
        u.User_Id, u.Name, u.Lastname, u.Email, u.PhoneNumber, u.Area,
        hp.NumeroEmpleado, hp.Puesto, hp.Departamento, hp.FechaIngreso, hp.TipoContrato,
        hp.EstadoCivil, hp.CURP, hp.RFC, hp.NSS, hp.Ciudad, hp.Estado, hp.Pais,
        hp.BancoPrincipal, hp.NumeroCuentaPrincipal, hp.CLABE, hp.NombreTitularCuenta,
        hp.FotoPerfilUrl
      ORDER BY u.Name, u.Lastname
    `;

    const result = await request.query(query);
    return res.json(result.recordset || []);
  } catch (error) {
    console.error('rh.listPerfiles error', error);
    return res.status(500).json({ msg: 'Error listando perfiles RH' });
  }
};

exports.getPerfil = async (req, res) => {
  try {
    await pool.connect();
    const userId = Number(req.params.userId);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ msg: 'userId inválido' });
    }

    if (!(await canManageUser(req, userId))) {
      return res.status(403).json({ msg: 'No tiene permisos para consultar este usuario' });
    }

    const profileResult = await pool.request()
      .input('User_Id', sql.Int, userId)
      .query(`
        SELECT
          u.User_Id,
          u.Name,
          u.Lastname,
          u.Username,
          u.Email,
          u.PhoneNumber,
          u.Area,
          hp.*
        FROM ERP_USERS u
        LEFT JOIN ERP_HR_PROFILE hp ON hp.User_Id = u.User_Id
        WHERE u.User_Id = @User_Id
      `);

    if (!profileResult.recordset.length) {
      return res.status(404).json({ msg: 'Usuario no encontrado' });
    }

    const [contactsResult, accountsResult, documentosResult] = await Promise.all([
      pool.request()
        .input('User_Id', sql.Int, userId)
        .query('SELECT * FROM ERP_HR_EMERGENCY_CONTACT WHERE User_Id = @User_Id AND IsActive = 1 ORDER BY ContactoEmergencia_Id DESC'),
      pool.request()
        .input('User_Id', sql.Int, userId)
        .query('SELECT * FROM ERP_HR_BANK_ACCOUNT WHERE User_Id = @User_Id AND IsActive = 1 ORDER BY EsPrincipal DESC, CuentaBancaria_Id DESC'),
      pool.request()
        .input('User_Id', sql.Int, userId)
        .query(`
          SELECT *
          FROM ERP_HR_DOCUMENT
          WHERE User_Id = @User_Id AND IsActive = 1
          ORDER BY CreatedAt DESC, Documento_Id DESC
        `)
    ]);

    return res.json({
      perfil: profileResult.recordset[0],
      contactosEmergencia: contactsResult.recordset || [],
      cuentasBancarias: accountsResult.recordset || [],
      documentos: documentosResult.recordset || []
    });
  } catch (error) {
    console.error('rh.getPerfil error', error);
    return res.status(500).json({ msg: 'Error obteniendo perfil RH' });
  }
};

exports.upsertPerfil = async (req, res) => {
  try {
    await pool.connect();
    const userId = Number(req.params.userId);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ msg: 'userId inválido' });
    }

    if (!(await canManageUser(req, userId))) {
      return res.status(403).json({ msg: 'No tiene permisos para editar este usuario' });
    }

    const p = req.body || {};

    const userExists = await pool.request()
      .input('User_Id', sql.Int, userId)
      .query('SELECT User_Id FROM ERP_USERS WHERE User_Id = @User_Id');

    if (!userExists.recordset.length) {
      return res.status(404).json({ msg: 'Usuario no encontrado' });
    }

    await pool.request()
      .input('User_Id', sql.Int, userId)
      .input('FechaNacimiento', sql.Date, p.FechaNacimiento || null)
      .input('CURP', sql.VarChar(30), p.CURP || null)
      .input('RFC', sql.VarChar(20), p.RFC || null)
      .input('NSS', sql.VarChar(30), p.NSS || null)
      .input('EstadoCivil', sql.VarChar(30), p.EstadoCivil || null)
      .input('Genero', sql.VarChar(30), p.Genero || null)
      .input('Direccion', sql.VarChar(250), p.Direccion || null)
      .input('Ciudad', sql.VarChar(100), p.Ciudad || null)
      .input('Estado', sql.VarChar(100), p.Estado || null)
      .input('CodigoPostal', sql.VarChar(15), p.CodigoPostal || null)
      .input('Pais', sql.VarChar(60), p.Pais || null)
      .input('NumeroEmpleado', sql.VarChar(50), p.NumeroEmpleado || null)
      .input('FechaIngreso', sql.Date, p.FechaIngreso || null)
      .input('Puesto', sql.VarChar(100), p.Puesto || null)
      .input('Departamento', sql.VarChar(100), p.Departamento || null)
      .input('SalarioMensual', sql.Decimal(18, 2), p.SalarioMensual != null ? p.SalarioMensual : null)
      .input('TipoContrato', sql.VarChar(50), p.TipoContrato || null)
      .input('BancoPrincipal', sql.VarChar(100), p.BancoPrincipal || null)
      .input('NumeroCuentaPrincipal', sql.VarChar(50), p.NumeroCuentaPrincipal || null)
      .input('CLABE', sql.VarChar(30), p.CLABE || null)
      .input('NombreTitularCuenta', sql.VarChar(120), p.NombreTitularCuenta || null)
      .input('ContactoEmergenciaPrincipal', sql.VarChar(120), p.ContactoEmergenciaPrincipal || null)
      .input('TelefonoEmergenciaPrincipal', sql.VarChar(30), p.TelefonoEmergenciaPrincipal || null)
      .input('Alergias', sql.VarChar(250), p.Alergias || null)
      .input('TipoSangre', sql.VarChar(10), p.TipoSangre || null)
      .input('NotasMedicas', sql.NVarChar(sql.MAX), p.NotasMedicas || null)
      .input('UpdatedBy', sql.Int, req.user?.User_Id || null)
      .query(`
        IF EXISTS (SELECT 1 FROM ERP_HR_PROFILE WHERE User_Id = @User_Id)
        BEGIN
          UPDATE ERP_HR_PROFILE
          SET FechaNacimiento = @FechaNacimiento,
              CURP = @CURP,
              RFC = @RFC,
              NSS = @NSS,
              EstadoCivil = @EstadoCivil,
              Genero = @Genero,
              Direccion = @Direccion,
              Ciudad = @Ciudad,
              Estado = @Estado,
              CodigoPostal = @CodigoPostal,
              Pais = @Pais,
              NumeroEmpleado = @NumeroEmpleado,
              FechaIngreso = @FechaIngreso,
              Puesto = @Puesto,
              Departamento = @Departamento,
              SalarioMensual = @SalarioMensual,
              TipoContrato = @TipoContrato,
              BancoPrincipal = @BancoPrincipal,
              NumeroCuentaPrincipal = @NumeroCuentaPrincipal,
              CLABE = @CLABE,
              NombreTitularCuenta = @NombreTitularCuenta,
              ContactoEmergenciaPrincipal = @ContactoEmergenciaPrincipal,
              TelefonoEmergenciaPrincipal = @TelefonoEmergenciaPrincipal,
              Alergias = @Alergias,
              TipoSangre = @TipoSangre,
              NotasMedicas = @NotasMedicas,
              UpdatedAt = GETDATE(),
              UpdatedBy = @UpdatedBy
          WHERE User_Id = @User_Id;
        END
        ELSE
        BEGIN
          INSERT INTO ERP_HR_PROFILE (
            User_Id, FechaNacimiento, CURP, RFC, NSS, EstadoCivil, Genero, Direccion, Ciudad,
            Estado, CodigoPostal, Pais, NumeroEmpleado, FechaIngreso, Puesto, Departamento,
            SalarioMensual, TipoContrato, BancoPrincipal, NumeroCuentaPrincipal, CLABE,
            NombreTitularCuenta, ContactoEmergenciaPrincipal, TelefonoEmergenciaPrincipal,
            Alergias, TipoSangre, NotasMedicas, CreatedAt, UpdatedAt, UpdatedBy
          ) VALUES (
            @User_Id, @FechaNacimiento, @CURP, @RFC, @NSS, @EstadoCivil, @Genero, @Direccion,
            @Ciudad, @Estado, @CodigoPostal, @Pais, @NumeroEmpleado, @FechaIngreso, @Puesto,
            @Departamento, @SalarioMensual, @TipoContrato, @BancoPrincipal, @NumeroCuentaPrincipal,
            @CLABE, @NombreTitularCuenta, @ContactoEmergenciaPrincipal, @TelefonoEmergenciaPrincipal,
            @Alergias, @TipoSangre, @NotasMedicas, GETDATE(), GETDATE(), @UpdatedBy
          );
        END
      `);

    return res.json({ msg: 'Perfil RH guardado correctamente' });
  } catch (error) {
    console.error('rh.upsertPerfil error', error);
    return res.status(500).json({ msg: 'Error guardando perfil RH' });
  }
};

exports.createContactoEmergencia = async (req, res) => {
  try {
    await pool.connect();
    const userId = Number(req.params.userId);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ msg: 'userId inválido' });
    }
    if (!(await canManageUser(req, userId))) {
      return res.status(403).json({ msg: 'No tiene permisos para editar este usuario' });
    }

    const p = req.body || {};
    if (!p.Nombre || !p.Telefono) {
      return res.status(400).json({ msg: 'Nombre y Telefono son requeridos' });
    }

    const result = await pool.request()
      .input('User_Id', sql.Int, userId)
      .input('Nombre', sql.VarChar(120), p.Nombre)
      .input('Parentesco', sql.VarChar(80), p.Parentesco || null)
      .input('Telefono', sql.VarChar(30), p.Telefono)
      .input('TelefonoAlterno', sql.VarChar(30), p.TelefonoAlterno || null)
      .input('Direccion', sql.VarChar(250), p.Direccion || null)
      .input('EsPrincipal', sql.Bit, p.EsPrincipal ? 1 : 0)
      .input('Notas', sql.VarChar(250), p.Notas || null)
      .input('CreatedBy', sql.Int, req.user?.User_Id || null)
      .query(`
        INSERT INTO ERP_HR_EMERGENCY_CONTACT
          (User_Id, Nombre, Parentesco, Telefono, TelefonoAlterno, Direccion, EsPrincipal, Notas, IsActive, CreatedAt, UpdatedAt, CreatedBy)
        OUTPUT INSERTED.*
        VALUES
          (@User_Id, @Nombre, @Parentesco, @Telefono, @TelefonoAlterno, @Direccion, @EsPrincipal, @Notas, 1, GETDATE(), GETDATE(), @CreatedBy)
      `);

    return res.status(201).json({ msg: 'Contacto de emergencia creado', data: result.recordset[0] });
  } catch (error) {
    console.error('rh.createContactoEmergencia error', error);
    return res.status(500).json({ msg: 'Error creando contacto de emergencia' });
  }
};

exports.updateContactoEmergencia = async (req, res) => {
  try {
    await pool.connect();
    const contactoId = Number(req.params.contactoId);
    if (!Number.isInteger(contactoId) || contactoId <= 0) {
      return res.status(400).json({ msg: 'contactoId inválido' });
    }

    const found = await pool.request()
      .input('ContactoEmergencia_Id', sql.Int, contactoId)
      .query('SELECT User_Id FROM ERP_HR_EMERGENCY_CONTACT WHERE ContactoEmergencia_Id = @ContactoEmergencia_Id');

    if (!found.recordset.length) {
      return res.status(404).json({ msg: 'Contacto no encontrado' });
    }

    const userId = Number(found.recordset[0].User_Id);
    if (!(await canManageUser(req, userId))) {
      return res.status(403).json({ msg: 'No tiene permisos para editar este contacto' });
    }

    const p = req.body || {};
    await pool.request()
      .input('ContactoEmergencia_Id', sql.Int, contactoId)
      .input('Nombre', sql.VarChar(120), p.Nombre || null)
      .input('Parentesco', sql.VarChar(80), p.Parentesco || null)
      .input('Telefono', sql.VarChar(30), p.Telefono || null)
      .input('TelefonoAlterno', sql.VarChar(30), p.TelefonoAlterno || null)
      .input('Direccion', sql.VarChar(250), p.Direccion || null)
      .input('EsPrincipal', sql.Bit, p.EsPrincipal ? 1 : 0)
      .input('Notas', sql.VarChar(250), p.Notas || null)
      .query(`
        UPDATE ERP_HR_EMERGENCY_CONTACT
        SET Nombre = COALESCE(@Nombre, Nombre),
            Parentesco = COALESCE(@Parentesco, Parentesco),
            Telefono = COALESCE(@Telefono, Telefono),
            TelefonoAlterno = @TelefonoAlterno,
            Direccion = @Direccion,
            EsPrincipal = @EsPrincipal,
            Notas = @Notas,
            UpdatedAt = GETDATE()
        WHERE ContactoEmergencia_Id = @ContactoEmergencia_Id
      `);

    return res.json({ msg: 'Contacto de emergencia actualizado' });
  } catch (error) {
    console.error('rh.updateContactoEmergencia error', error);
    return res.status(500).json({ msg: 'Error actualizando contacto de emergencia' });
  }
};

exports.deleteContactoEmergencia = async (req, res) => {
  try {
    await pool.connect();
    const contactoId = Number(req.params.contactoId);
    if (!Number.isInteger(contactoId) || contactoId <= 0) {
      return res.status(400).json({ msg: 'contactoId inválido' });
    }

    const found = await pool.request()
      .input('ContactoEmergencia_Id', sql.Int, contactoId)
      .query('SELECT User_Id FROM ERP_HR_EMERGENCY_CONTACT WHERE ContactoEmergencia_Id = @ContactoEmergencia_Id');

    if (!found.recordset.length) {
      return res.status(404).json({ msg: 'Contacto no encontrado' });
    }

    const userId = Number(found.recordset[0].User_Id);
    if (!(await canManageUser(req, userId))) {
      return res.status(403).json({ msg: 'No tiene permisos para eliminar este contacto' });
    }

    await pool.request()
      .input('ContactoEmergencia_Id', sql.Int, contactoId)
      .query('UPDATE ERP_HR_EMERGENCY_CONTACT SET IsActive = 0, UpdatedAt = GETDATE() WHERE ContactoEmergencia_Id = @ContactoEmergencia_Id');

    return res.json({ msg: 'Contacto de emergencia eliminado' });
  } catch (error) {
    console.error('rh.deleteContactoEmergencia error', error);
    return res.status(500).json({ msg: 'Error eliminando contacto de emergencia' });
  }
};

exports.createCuentaBancaria = async (req, res) => {
  try {
    await pool.connect();
    const userId = Number(req.params.userId);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ msg: 'userId inválido' });
    }
    if (!(await canManageUser(req, userId))) {
      return res.status(403).json({ msg: 'No tiene permisos para editar este usuario' });
    }

    const p = req.body || {};
    if (!p.Banco || !p.NumeroCuenta) {
      return res.status(400).json({ msg: 'Banco y NumeroCuenta son requeridos' });
    }

    const result = await pool.request()
      .input('User_Id', sql.Int, userId)
      .input('Banco', sql.VarChar(100), p.Banco)
      .input('NumeroCuenta', sql.VarChar(50), p.NumeroCuenta)
      .input('CLABE', sql.VarChar(30), p.CLABE || null)
      .input('NumeroTarjeta', sql.VarChar(30), p.NumeroTarjeta || null)
      .input('Moneda', sql.VarChar(10), p.Moneda || 'MXN')
      .input('EsPrincipal', sql.Bit, p.EsPrincipal ? 1 : 0)
      .input('NombreTitular', sql.VarChar(120), p.NombreTitular || null)
      .input('CreatedBy', sql.Int, req.user?.User_Id || null)
      .query(`
        INSERT INTO ERP_HR_BANK_ACCOUNT
          (User_Id, Banco, NumeroCuenta, CLABE, NumeroTarjeta, Moneda, EsPrincipal, NombreTitular, IsActive, CreatedAt, UpdatedAt, CreatedBy)
        OUTPUT INSERTED.*
        VALUES
          (@User_Id, @Banco, @NumeroCuenta, @CLABE, @NumeroTarjeta, @Moneda, @EsPrincipal, @NombreTitular, 1, GETDATE(), GETDATE(), @CreatedBy)
      `);

    return res.status(201).json({ msg: 'Cuenta bancaria creada', data: result.recordset[0] });
  } catch (error) {
    console.error('rh.createCuentaBancaria error', error);
    return res.status(500).json({ msg: 'Error creando cuenta bancaria' });
  }
};

exports.updateCuentaBancaria = async (req, res) => {
  try {
    await pool.connect();
    const cuentaId = Number(req.params.cuentaId);
    if (!Number.isInteger(cuentaId) || cuentaId <= 0) {
      return res.status(400).json({ msg: 'cuentaId inválido' });
    }

    const found = await pool.request()
      .input('CuentaBancaria_Id', sql.Int, cuentaId)
      .query('SELECT User_Id FROM ERP_HR_BANK_ACCOUNT WHERE CuentaBancaria_Id = @CuentaBancaria_Id');

    if (!found.recordset.length) {
      return res.status(404).json({ msg: 'Cuenta bancaria no encontrada' });
    }

    const userId = Number(found.recordset[0].User_Id);
    if (!(await canManageUser(req, userId))) {
      return res.status(403).json({ msg: 'No tiene permisos para editar esta cuenta bancaria' });
    }

    const p = req.body || {};
    await pool.request()
      .input('CuentaBancaria_Id', sql.Int, cuentaId)
      .input('Banco', sql.VarChar(100), p.Banco || null)
      .input('NumeroCuenta', sql.VarChar(50), p.NumeroCuenta || null)
      .input('CLABE', sql.VarChar(30), p.CLABE || null)
      .input('NumeroTarjeta', sql.VarChar(30), p.NumeroTarjeta || null)
      .input('Moneda', sql.VarChar(10), p.Moneda || null)
      .input('EsPrincipal', sql.Bit, p.EsPrincipal ? 1 : 0)
      .input('NombreTitular', sql.VarChar(120), p.NombreTitular || null)
      .query(`
        UPDATE ERP_HR_BANK_ACCOUNT
        SET Banco = COALESCE(@Banco, Banco),
            NumeroCuenta = COALESCE(@NumeroCuenta, NumeroCuenta),
            CLABE = @CLABE,
            NumeroTarjeta = @NumeroTarjeta,
            Moneda = COALESCE(@Moneda, Moneda),
            EsPrincipal = @EsPrincipal,
            NombreTitular = @NombreTitular,
            UpdatedAt = GETDATE()
        WHERE CuentaBancaria_Id = @CuentaBancaria_Id
      `);

    return res.json({ msg: 'Cuenta bancaria actualizada' });
  } catch (error) {
    console.error('rh.updateCuentaBancaria error', error);
    return res.status(500).json({ msg: 'Error actualizando cuenta bancaria' });
  }
};

exports.deleteCuentaBancaria = async (req, res) => {
  try {
    await pool.connect();
    const cuentaId = Number(req.params.cuentaId);
    if (!Number.isInteger(cuentaId) || cuentaId <= 0) {
      return res.status(400).json({ msg: 'cuentaId inválido' });
    }

    const found = await pool.request()
      .input('CuentaBancaria_Id', sql.Int, cuentaId)
      .query('SELECT User_Id FROM ERP_HR_BANK_ACCOUNT WHERE CuentaBancaria_Id = @CuentaBancaria_Id');

    if (!found.recordset.length) {
      return res.status(404).json({ msg: 'Cuenta bancaria no encontrada' });
    }

    const userId = Number(found.recordset[0].User_Id);
    if (!(await canManageUser(req, userId))) {
      return res.status(403).json({ msg: 'No tiene permisos para eliminar esta cuenta bancaria' });
    }

    await pool.request()
      .input('CuentaBancaria_Id', sql.Int, cuentaId)
      .query('UPDATE ERP_HR_BANK_ACCOUNT SET IsActive = 0, UpdatedAt = GETDATE() WHERE CuentaBancaria_Id = @CuentaBancaria_Id');

    return res.json({ msg: 'Cuenta bancaria eliminada' });
  } catch (error) {
    console.error('rh.deleteCuentaBancaria error', error);
    return res.status(500).json({ msg: 'Error eliminando cuenta bancaria' });
  }
};

exports.uploadFotoPerfil = async (req, res) => {
  try {
    await pool.connect();
    const userId = Number(req.params.userId);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ msg: 'userId inválido' });
    }

    if (!(await canManageUser(req, userId))) {
      return res.status(403).json({ msg: 'No tiene permisos para editar este usuario' });
    }

    if (!req.files || !req.files.fotoPerfil) {
      return res.status(400).json({ msg: 'Debe enviar el archivo en el campo fotoPerfil' });
    }

    const fotoPerfil = req.files.fotoPerfil;
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimes.includes(fotoPerfil.mimetype)) {
      return res.status(400).json({ msg: 'Formato inválido. Use JPG, PNG o WEBP' });
    }

    const uploadDir = path.join(__dirname, '..', 'uploads', 'rh-profiles');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const extByMime = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp'
    };

    const ext = extByMime[fotoPerfil.mimetype] || '.jpg';
    const unique = `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const filename = `user_${userId}_${unique}${ext}`;
    const filePath = path.join(uploadDir, filename);
    const publicUrl = `/uploads/rh-profiles/${filename}`;

    await fotoPerfil.mv(filePath);

    await pool.request()
      .input('User_Id', sql.Int, userId)
      .input('FotoPerfilUrl', sql.VarChar(300), publicUrl)
      .input('UpdatedBy', sql.Int, req.user?.User_Id || null)
      .query(`
        IF EXISTS (SELECT 1 FROM ERP_HR_PROFILE WHERE User_Id = @User_Id)
        BEGIN
          UPDATE ERP_HR_PROFILE
          SET FotoPerfilUrl = @FotoPerfilUrl,
              UpdatedAt = GETDATE(),
              UpdatedBy = @UpdatedBy
          WHERE User_Id = @User_Id;
        END
        ELSE
        BEGIN
          INSERT INTO ERP_HR_PROFILE (User_Id, FotoPerfilUrl, CreatedAt, UpdatedAt, UpdatedBy)
          VALUES (@User_Id, @FotoPerfilUrl, GETDATE(), GETDATE(), @UpdatedBy);
        END
      `);

    return res.status(201).json({ msg: 'Foto de perfil actualizada', FotoPerfilUrl: publicUrl });
  } catch (error) {
    console.error('rh.uploadFotoPerfil error', error);
    return res.status(500).json({ msg: 'Error subiendo foto de perfil' });
  }
};

exports.uploadDocumento = async (req, res) => {
  try {
    await pool.connect();
    const userId = Number(req.params.userId);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ msg: 'userId inválido' });
    }

    if (!(await canManageUser(req, userId))) {
      return res.status(403).json({ msg: 'No tiene permisos para cargar documentos de este usuario' });
    }

    if (!req.files || !req.files.documento) {
      return res.status(400).json({ msg: 'Debe enviar el archivo en el campo documento' });
    }

    const documento = req.files.documento;
    if (!RH_DOC_ALLOWED_MIMES.includes(documento.mimetype)) {
      return res.status(400).json({ msg: 'Formato inválido. Use PDF, JPG, PNG, WEBP, DOC o DOCX' });
    }

    const tipoDocumento = String(req.body?.TipoDocumento || '').trim();
    const descripcion = String(req.body?.Descripcion || '').trim();

    const uploadDir = path.join(__dirname, '..', 'uploads', 'rh-documentos', `user_${userId}`);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const originalExt = path.extname(documento.name || '').toLowerCase();
    const ext = originalExt || RH_DOC_EXT_BY_MIME[documento.mimetype] || '.pdf';
    const unique = `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const fileName = `doc_${userId}_${unique}${ext}`;
    const filePath = path.join(uploadDir, fileName);
    const publicUrl = `/uploads/rh-documentos/user_${userId}/${fileName}`;

    await documento.mv(filePath);

    const insertResult = await pool.request()
      .input('User_Id', sql.Int, userId)
      .input('TipoDocumento', sql.VarChar(80), tipoDocumento || null)
      .input('NombreArchivo', sql.VarChar(260), documento.name || fileName)
      .input('ArchivoUrl', sql.VarChar(350), publicUrl)
      .input('MimeType', sql.VarChar(120), documento.mimetype || null)
      .input('SizeBytes', sql.BigInt, Number(documento.size || 0))
      .input('Descripcion', sql.VarChar(250), descripcion || null)
      .input('CreatedBy', sql.Int, req.user?.User_Id || null)
      .query(`
        INSERT INTO ERP_HR_DOCUMENT
          (User_Id, TipoDocumento, NombreArchivo, ArchivoUrl, MimeType, SizeBytes, Descripcion, IsActive, CreatedAt, UpdatedAt, CreatedBy)
        OUTPUT INSERTED.*
        VALUES
          (@User_Id, @TipoDocumento, @NombreArchivo, @ArchivoUrl, @MimeType, @SizeBytes, @Descripcion, 1, GETDATE(), GETDATE(), @CreatedBy)
      `);

    return res.status(201).json({ msg: 'Documento cargado correctamente', data: insertResult.recordset?.[0] || null });
  } catch (error) {
    console.error('rh.uploadDocumento error', error);
    return res.status(500).json({ msg: 'Error cargando documento RH' });
  }
};

exports.listDocumentos = async (req, res) => {
  try {
    await pool.connect();
    const userId = Number(req.params.userId);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ msg: 'userId inválido' });
    }

    if (!(await canManageUser(req, userId))) {
      return res.status(403).json({ msg: 'No tiene permisos para consultar documentos de este usuario' });
    }

    const result = await pool.request()
      .input('User_Id', sql.Int, userId)
      .query(`
        SELECT *
        FROM ERP_HR_DOCUMENT
        WHERE User_Id = @User_Id AND IsActive = 1
        ORDER BY CreatedAt DESC, Documento_Id DESC
      `);

    return res.json(result.recordset || []);
  } catch (error) {
    console.error('rh.listDocumentos error', error);
    return res.status(500).json({ msg: 'Error listando documentos RH' });
  }
};

exports.deleteDocumento = async (req, res) => {
  try {
    await pool.connect();
    const documentoId = Number(req.params.documentoId);
    if (!Number.isInteger(documentoId) || documentoId <= 0) {
      return res.status(400).json({ msg: 'documentoId inválido' });
    }

    const docResult = await pool.request()
      .input('Documento_Id', sql.Int, documentoId)
      .query('SELECT Documento_Id, User_Id, ArchivoUrl FROM ERP_HR_DOCUMENT WHERE Documento_Id = @Documento_Id');

    if (!docResult.recordset.length) {
      return res.status(404).json({ msg: 'Documento no encontrado' });
    }

    const documento = docResult.recordset[0];
    if (!(await canManageUser(req, Number(documento.User_Id)))) {
      return res.status(403).json({ msg: 'No tiene permisos para eliminar este documento' });
    }

    await pool.request()
      .input('Documento_Id', sql.Int, documentoId)
      .query('UPDATE ERP_HR_DOCUMENT SET IsActive = 0, UpdatedAt = GETDATE() WHERE Documento_Id = @Documento_Id');

    if (documento.ArchivoUrl) {
      const relativePath = String(documento.ArchivoUrl).replace(/^\/+uploads\//i, '');
      const absolutePath = path.join(__dirname, '..', 'uploads', relativePath);
      if (fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
      }
    }

    return res.json({ msg: 'Documento eliminado' });
  } catch (error) {
    console.error('rh.deleteDocumento error', error);
    return res.status(500).json({ msg: 'Error eliminando documento RH' });
  }
};
