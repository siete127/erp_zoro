const { pool, sql } = require("../config/db");
const bcrypt = require("bcryptjs");

function normalizeCompanyIds(ids) {
  if (!Array.isArray(ids)) return [];
  return ids
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);
}

function canAccessCompany(req, companyId) {
  if (req.isSuperAdmin) return true;
  return Array.isArray(req.userCompanies) && req.userCompanies.includes(Number(companyId));
}

function canAccessAllCompanies(req, companyIds) {
  if (req.isSuperAdmin) return true;
  if (!Array.isArray(req.userCompanies)) return false;
  return companyIds.every((companyId) => req.userCompanies.includes(Number(companyId)));
}

// Helper: formatea números de teléfono agregando separadores (guiones) y preservando 
// el prefijo "+" si el usuario lo incluyó. Para números largos, extrae el código
// de país (los dígitos sobrantes a la izquierda) y aplica formato al bloque final de 10 dígitos.
function formatPhone(raw) {
  if (!raw && raw !== 0) return null;
  const str = String(raw).trim();
  if (str.length === 0) return null;
  const hasPlus = str.startsWith("+");
  const digits = str.replace(/\D/g, "");
  if (digits.length === 0) return null;

  // números muy largos: separar código de país + resto (últimos 10 dígitos formateados como 3-3-4)
  if (digits.length > 10) {
    const country = digits.slice(0, digits.length - 10);
    const rest = digits.slice(-10);
    const restFmt = rest.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3");
    const prefix = hasPlus ? "+" : "";
    return prefix + country + " " + restFmt;
  }

  // 10 dígitos -> 3-3-4 (ej. US)
  if (digits.length === 10) {
    return (hasPlus ? "+" : "") + digits.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3");
  }

  // 9 dígitos (común en algunos países): 3-3-3
  if (digits.length === 9) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})/, "$1-$2-$3");
  }

  // 7-8 dígitos típicos locales
  if (digits.length === 8) return digits.replace(/(\d{4})(\d{4})/, "$1-$2");
  if (digits.length === 7) return digits.replace(/(\d{3})(\d{4})/, "$1-$2");

  // para longitudes menores o inusuales, agrupar en bloques de hasta 3
  const parts = digits.match(/.{1,3}/g) || [digits];
  return parts.join("-");
}

exports.register = async (req, res) => {
  const {
    Name,
    Lastname,
    Username,
    Password,
    Email,
    PhoneNumber,
    Area,
    RolId,
    IsActive,
    CreatedBy,
    Company_Ids
  } = req.body;

  if (!Username || !Password) {
    return res.status(400).json({ msg: "Username y Password son requeridos" });
  }

  // password server-side validation: minimum 12 chars, lowercase, uppercase, digit, symbol
  const pwdRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/;
  if (!pwdRegex.test(Password)) {
    return res.status(400).json({ msg: "Password inválida: mínimo 12 caracteres, debe incluir mayúscula, minúscula, número y símbolo" });
  }

  try {
    await pool.connect();

    const incomingCompanyIds = normalizeCompanyIds(Company_Ids);
    if (!req.isSuperAdmin) {
      if (incomingCompanyIds.length === 0) {
        return res.status(400).json({ msg: "Debe asignar al menos una empresa al usuario" });
      }
      if (!canAccessAllCompanies(req, incomingCompanyIds)) {
        return res.status(403).json({ msg: "Solo puede asignar usuarios a empresas a las que usted pertenece" });
      }
    }

    // validar si el username ya existe
    const exists = await pool.request()
      .input("Username", sql.VarChar, Username)
      .query("SELECT User_Id FROM ERP_USERS WHERE Username = @Username");

    if (exists.recordset.length > 0) {
      return res.status(409).json({ msg: "El usuario ya existe" });
    }

    // Formatear número de teléfono para agregar separadores por defecto.
    // Esto evita errores cuando el número es demasiado largo como entero
    // y hace más legible el valor en la base de datos.
    const rawPhone = PhoneNumber || "";
    const formattedPhone = formatPhone(rawPhone);

    // Ensure CreatedBy has a sensible default (system/admin id = 1)
    const creatorId = CreatedBy || 1;

    const hashed = await bcrypt.hash(Password, 10);

    const request = pool.request()
      .input("Name", sql.VarChar, Name || null)
      .input("Lastname", sql.VarChar, Lastname || null)
      .input("Username", sql.VarChar, Username)
      .input("Password", sql.VarChar, hashed)
      .input("Email", sql.VarChar, Email || null)
      .input("PhoneNumber", sql.VarChar, formattedPhone || (PhoneNumber || null))
      .input("Area", sql.VarChar, Area || null)
      .input("RolId", sql.Int, RolId || null)
      .input("IsActive", sql.Bit, IsActive ? 1 : 0)
      .input("CreatedBy", sql.Int, creatorId);

    const insertQuery = `INSERT INTO ERP_USERS (Name, Lastname, Username, Password, Email, PhoneNumber, Area, RolId, DateCreate, IsActive, LastLogin, CreatedBy)
      VALUES (@Name, @Lastname, @Username, @Password, @Email, @PhoneNumber, @Area, @RolId, GETDATE(), @IsActive, NULL, @CreatedBy);
      SELECT SCOPE_IDENTITY() AS User_Id;`;

    const result = await request.query(insertQuery);

    const newId = result.recordset && result.recordset.length > 0 ? result.recordset[0].User_Id : null;

    // Insert user companies
    if (incomingCompanyIds.length > 0 && newId) {
      for (const companyId of incomingCompanyIds) {
        await pool.request()
          .input('User_Id', sql.Int, newId)
          .input('Company_Id', sql.Int, companyId)
          .query('INSERT INTO ERP_USERCOMPANIES (User_Id, Company_Id) VALUES (@User_Id, @Company_Id)');
      }
    }

    // Asignar todos los permisos por defecto al nuevo usuario
    if (newId) {
      try {
        const modules = await pool.request().query('SELECT ModuleKey FROM ERP_MODULES WHERE IsActive = 1');
        for (const mod of modules.recordset) {
          await pool.request()
            .input('User_Id', sql.Int, newId)
            .input('ModuleKey', sql.VarChar, mod.ModuleKey)
            .input('CanAccess', sql.Bit, 1)
            .input('CreatedBy', sql.Int, CreatedBy || 1)
            .query('INSERT INTO ERP_USER_PERMISSIONS (User_Id, ModuleKey, CanAccess, CreatedBy) VALUES (@User_Id, @ModuleKey, @CanAccess, @CreatedBy)');
        }
      } catch (permErr) {
        console.warn('Error asignando permisos por defecto:', permErr);
      }
    }

    res.status(201).json({ msg: "Usuario creado", User_Id: newId });

  } catch (err) {
    console.error("User register error:", err);
    res.status(500).json({ msg: "Error al crear usuario" });
  }
};

exports.list = async (req, res) => {
  try {
    await pool.connect();
    const companyIdRaw = req.query.company_id;
    const request = pool.request();

    const whereParts = [];

    if (!req.isSuperAdmin) {
      if (!Array.isArray(req.userCompanies) || req.userCompanies.length === 0) {
        return res.json([]);
      }
      const companyParams = req.userCompanies.map((companyId, index) => {
        const paramName = `UserCompany_${index}`;
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
      if (!canAccessCompany(req, companyId)) {
        return res.status(403).json({ msg: 'No tiene permisos para consultar usuarios de esta empresa' });
      }
      whereParts.push('uc.Company_Id = @Company_Id');
      request.input('Company_Id', sql.Int, companyId);
    }

    const whereClause = whereParts.length > 0 ? ` WHERE ${whereParts.join(' AND ')}` : '';

    const query = `SELECT u.User_Id, u.Name, u.Lastname, u.Username, u.Password, u.Email, u.PhoneNumber, u.Area, u.RolId, u.DateCreate, u.IsActive, u.LastLogin, u.CreatedBy, STRING_AGG(c.NameCompany, ', ') AS NameCompany 
                 FROM ERP_USERS u 
                 LEFT JOIN ERP_USERCOMPANIES uc ON u.User_Id = uc.User_Id 
                 LEFT JOIN ERP_COMPANY c ON uc.Company_Id = c.Company_Id
                 ${whereClause}
                 GROUP BY u.User_Id, u.Name, u.Lastname, u.Username, u.Password, u.Email, u.PhoneNumber, u.Area, u.RolId, u.DateCreate, u.IsActive, u.LastLogin, u.CreatedBy`;

    const result = await request.query(query);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error servidor" });
  }
};

exports.get = async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ msg: 'User id inválido' });
  try {
    await pool.connect();
    const result = await pool.request().input('User_Id', sql.Int, id).query('SELECT * FROM ERP_USERS WHERE User_Id = @User_Id');
    if (result.recordset.length === 0) return res.status(404).json({ msg: 'Usuario no encontrado' });

    const companies = await pool.request().input('User_Id', sql.Int, id)
      .query('SELECT uc.Company_Id, c.NameCompany FROM ERP_USERCOMPANIES uc JOIN ERP_COMPANY c ON uc.Company_Id = c.Company_Id WHERE uc.User_Id = @User_Id');

    const targetCompanyIds = (companies.recordset || []).map((c) => Number(c.Company_Id));
    if (!req.isSuperAdmin && !canAccessAllCompanies(req, targetCompanyIds)) {
      return res.status(403).json({ msg: 'No tiene permisos para ver este usuario' });
    }
    
    res.json({ ...result.recordset[0], companies: companies.recordset || [] });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ msg: 'Error servidor' });
  }
};

exports.update = async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ msg: 'User id inválido' });
  const { Name, Lastname, Email, PhoneNumber, Area, RolId, IsActive, Password, Company_Ids } = req.body;
  try {
    await pool.connect();

    const targetCompaniesResult = await pool.request().input('User_Id', sql.Int, id)
      .query('SELECT Company_Id FROM ERP_USERCOMPANIES WHERE User_Id = @User_Id');
    const targetCompanyIds = targetCompaniesResult.recordset.map((row) => Number(row.Company_Id));

    if (!req.isSuperAdmin && !canAccessAllCompanies(req, targetCompanyIds)) {
      return res.status(403).json({ msg: 'No tiene permisos para editar este usuario' });
    }

    const incomingCompanyIds = normalizeCompanyIds(Company_Ids);
    if (!req.isSuperAdmin && incomingCompanyIds.length > 0 && !canAccessAllCompanies(req, incomingCompanyIds)) {
      return res.status(403).json({ msg: 'No puede asignar empresas fuera de su alcance' });
    }

    const formattedPhone = formatPhone(PhoneNumber || '');
    const request = pool.request()
      .input('User_Id', sql.Int, id)
      .input('Name', sql.VarChar, Name || null)
      .input('Lastname', sql.VarChar, Lastname || null)
      .input('Email', sql.VarChar, Email || null)
      .input('PhoneNumber', sql.VarChar, formattedPhone || (PhoneNumber || null))
      .input('Area', sql.VarChar, Area || null)
      .input('RolId', sql.Int, RolId || null)
      .input('IsActive', sql.Bit, typeof IsActive === 'boolean' ? (IsActive ? 1 : 0) : (IsActive ? 1 : 0));

    // Update password if provided
    if (Password) {
      const hashed = await bcrypt.hash(Password, 10);
      await request.input('Password', sql.VarChar, hashed).query('UPDATE ERP_USERS SET Password = @Password WHERE User_Id = @User_Id');
    }

    const updateQuery = `UPDATE ERP_USERS SET Name = @Name, Lastname = @Lastname, Email = @Email, PhoneNumber = @PhoneNumber, Area = @Area, RolId = @RolId, IsActive = @IsActive WHERE User_Id = @User_Id`;
    await request.query(updateQuery);
    
    // Update user companies
    await pool.request().input('User_Id', sql.Int, id).query('DELETE FROM ERP_USERCOMPANIES WHERE User_Id = @User_Id');
    if (incomingCompanyIds.length > 0) {
      for (const companyId of incomingCompanyIds) {
        await pool.request()
          .input('User_Id', sql.Int, id)
          .input('Company_Id', sql.Int, companyId)
          .query('INSERT INTO ERP_USERCOMPANIES (User_Id, Company_Id) VALUES (@User_Id, @Company_Id)');
      }
    }
    
    res.json({ msg: 'Usuario actualizado' });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ msg: 'Error actualizando usuario' });
  }
};

exports.toggleActive = async (req, res) => {
  const id = Number(req.params.id);
  const { IsActive } = req.body;
  if (!id) return res.status(400).json({ msg: 'User id inválido' });
  try {
    await pool.connect();

    const companiesResult = await pool.request().input('User_Id', sql.Int, id)
      .query('SELECT Company_Id FROM ERP_USERCOMPANIES WHERE User_Id = @User_Id');
    const targetCompanyIds = companiesResult.recordset.map((row) => Number(row.Company_Id));
    if (!req.isSuperAdmin && !canAccessAllCompanies(req, targetCompanyIds)) {
      return res.status(403).json({ msg: 'No tiene permisos para cambiar estado de este usuario' });
    }

    await pool.request().input('User_Id', sql.Int, id).input('IsActive', sql.Bit, IsActive ? 1 : 0)
      .query('UPDATE ERP_USERS SET IsActive = @IsActive WHERE User_Id = @User_Id');
    res.json({ msg: 'Estado actualizado' });
  } catch (err) {
    console.error('Toggle active error:', err);
    res.status(500).json({ msg: 'Error actualizando estado' });
  }
};

exports.remove = async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ msg: 'User id inválido' });
  try {
    await pool.connect();

    const companiesResult = await pool.request().input('User_Id', sql.Int, id)
      .query('SELECT Company_Id FROM ERP_USERCOMPANIES WHERE User_Id = @User_Id');
    const targetCompanyIds = companiesResult.recordset.map((row) => Number(row.Company_Id));
    if (!req.isSuperAdmin && !canAccessAllCompanies(req, targetCompanyIds)) {
      return res.status(403).json({ msg: 'No tiene permisos para eliminar este usuario' });
    }

    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    
    try {
      // Eliminar primero las sesiones del usuario
      await transaction.request().input('User_Id', sql.Int, id).query('DELETE FROM ERP_USER_SESSIONS WHERE User_Id = @User_Id');
      
      // Luego eliminar el usuario
      await transaction.request().input('User_Id', sql.Int, id).query('DELETE FROM ERP_USERS WHERE User_Id = @User_Id');
      
      await transaction.commit();
      res.json({ msg: 'Usuario eliminado permanentemente' });
    } catch (transactionError) {
      await transaction.rollback();
      throw transactionError;
    }
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ msg: 'Error eliminando usuario' });
  }
};
