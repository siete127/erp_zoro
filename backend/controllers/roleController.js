const { pool, sql } = require("../config/db");

// Lista de módulos disponibles en la aplicación. Añadir claves según sea necesario.
const AVAILABLE_MODULES = [
  { key: 'dashboard', name: 'Dashboard' },
  { key: 'users', name: 'Usuarios' },
  { key: 'clients', name: 'Clientes' },
  { key: 'reports', name: 'Reportes' }
];

exports.list = async (req, res) => {
  try {
    await pool.connect();
    const result = await pool.request().query("SELECT Rol_Id, Name FROM ERP_ROL ORDER BY Name");
    res.json(result.recordset);
  } catch (err) {
    console.error('Roles list error:', err);
    res.status(500).json({ msg: 'Error al obtener roles' });
  }
};

// Devuelve los módulos y su estado para un rol
exports.getModules = async (req, res) => {
  const roleId = Number(req.params.id);
  if (!roleId || isNaN(roleId)) return res.status(400).json({ msg: 'Rol inválido' });

  try {
    await pool.connect();

    // Aseguramos que la tabla exista
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ERP_ROLE_MODULES' AND xtype='U')
      CREATE TABLE ERP_ROLE_MODULES (
        RoleModule_Id INT IDENTITY(1,1) PRIMARY KEY,
        Role_Id INT NOT NULL,
        ModuleKey VARCHAR(100) NOT NULL,
        IsEnabled BIT DEFAULT 0,
        CreatedAt DATETIME DEFAULT GETDATE(),
        CONSTRAINT UK_Role_Module UNIQUE (Role_Id, ModuleKey)
      )
    `);

    const dbRes = await pool.request()
      .input('roleId', sql.Int, roleId)
      .query('SELECT ModuleKey, IsEnabled FROM ERP_ROLE_MODULES WHERE Role_Id = @roleId');

    const dbModules = (dbRes.recordset || []).reduce((acc, m) => {
      acc[m.ModuleKey] = !!m.IsEnabled;
      return acc;
    }, {});

    // Merge available modules with db values; also include any module keys present in DB but not in AVAILABLE_MODULES
    const extraKeys = Object.keys(dbModules).filter(k => !AVAILABLE_MODULES.find(a => a.key === k));

    const merged = AVAILABLE_MODULES.map(m => ({ key: m.key, name: m.name, isEnabled: !!dbModules[m.key] }));
    extraKeys.forEach(k => merged.push({ key: k, name: k, isEnabled: !!dbModules[k] }));

    res.json({ modules: merged });
  } catch (err) {
    console.error('getModules error:', err);
    res.status(500).json({ msg: 'Error obteniendo módulos del rol' });
  }
};

// Actualiza el estado de un módulo para un rol (enable/disable)
exports.updateModule = async (req, res) => {
  const roleId = Number(req.params.id);
  const moduleKey = String(req.params.moduleKey || '').trim();
  const isEnabled = req.body && (req.body.isEnabled === true || req.body.isEnabled === 1 || req.body.isEnabled === '1');

  if (!roleId || isNaN(roleId) || !moduleKey) return res.status(400).json({ msg: 'Parámetros inválidos' });

  try {
    await pool.connect();

    // Aseguramos tabla
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ERP_ROLE_MODULES' AND xtype='U')
      CREATE TABLE ERP_ROLE_MODULES (
        RoleModule_Id INT IDENTITY(1,1) PRIMARY KEY,
        Role_Id INT NOT NULL,
        ModuleKey VARCHAR(100) NOT NULL,
        IsEnabled BIT DEFAULT 0,
        CreatedAt DATETIME DEFAULT GETDATE(),
        CONSTRAINT UK_Role_Module UNIQUE (Role_Id, ModuleKey)
      )
    `);

    // Upsert: si existe actualiza, si no inserta
    const exists = await pool.request()
      .input('roleId', sql.Int, roleId)
      .input('moduleKey', sql.VarChar, moduleKey)
      .query('SELECT 1 FROM ERP_ROLE_MODULES WHERE Role_Id = @roleId AND ModuleKey = @moduleKey');

    if (exists.recordset && exists.recordset.length > 0) {
      await pool.request()
        .input('roleId', sql.Int, roleId)
        .input('moduleKey', sql.VarChar, moduleKey)
        .input('isEnabled', sql.Bit, isEnabled ? 1 : 0)
        .query('UPDATE ERP_ROLE_MODULES SET IsEnabled = @isEnabled WHERE Role_Id = @roleId AND ModuleKey = @moduleKey');
    } else {
      await pool.request()
        .input('roleId', sql.Int, roleId)
        .input('moduleKey', sql.VarChar, moduleKey)
        .input('isEnabled', sql.Bit, isEnabled ? 1 : 0)
        .query('INSERT INTO ERP_ROLE_MODULES (Role_Id, ModuleKey, IsEnabled) VALUES (@roleId, @moduleKey, @isEnabled)');
    }

    res.json({ msg: 'Módulo actualizado', moduleKey, isEnabled: !!isEnabled });
  } catch (err) {
    console.error('updateModule error:', err);
    res.status(500).json({ msg: 'Error actualizando módulo' });
  }
};
// Permission-related endpoints removed temporarily.
