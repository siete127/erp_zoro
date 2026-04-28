const { pool, sql } = require('../config/db');

async function ensureRhModuleExists() {
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM ERP_MODULES WHERE LOWER(LTRIM(RTRIM(ModuleKey))) = 'rh')
    BEGIN
      INSERT INTO ERP_MODULES (ModuleKey, ModuleName, Description, IsActive)
      VALUES ('rh', 'Recursos Humanos', 'Gestión de expediente de personal, contactos y cuentas', 1)
    END
    ELSE
    BEGIN
      UPDATE ERP_MODULES
      SET ModuleKey = LOWER(LTRIM(RTRIM(ModuleKey))),
          ModuleName = CASE WHEN ModuleName IS NULL OR LTRIM(RTRIM(ModuleName)) = '' THEN 'Recursos Humanos' ELSE ModuleName END,
          Description = COALESCE(Description, 'Gestión de expediente de personal, contactos y cuentas'),
          IsActive = 1
      WHERE LOWER(LTRIM(RTRIM(ModuleKey))) = 'rh'
    END
  `);
}

async function ensureAccountingModuleExists() {
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM ERP_MODULES WHERE LOWER(LTRIM(RTRIM(ModuleKey))) = 'accounting')
    BEGIN
      INSERT INTO ERP_MODULES (ModuleKey, ModuleName, Description, IsActive)
      VALUES ('accounting', 'Contabilidad', 'Módulo de contabilidad: catálogos, balanzas y reportes financieros', 1)
    END
    ELSE
    BEGIN
      UPDATE ERP_MODULES
      SET ModuleKey = LOWER(LTRIM(RTRIM(ModuleKey))),
          ModuleName = CASE WHEN ModuleName IS NULL OR LTRIM(RTRIM(ModuleName)) = '' THEN 'Contabilidad' ELSE ModuleName END,
          Description = COALESCE(Description, 'Módulo de contabilidad: catálogos, balanzas y reportes financieros'),
          IsActive = 1
      WHERE LOWER(LTRIM(RTRIM(ModuleKey))) = 'accounting'
    END
  `);
}

// Obtener todos los módulos disponibles
exports.getModules = async (req, res) => {
  try {
    await pool.connect();
    await ensureRhModuleExists();
    await ensureAccountingModuleExists();
    const result = await pool.request().query('SELECT * FROM ERP_MODULES WHERE IsActive = 1 ORDER BY ModuleName');
    res.json({ success: true, data: result.recordset });
  } catch (error) {
    console.error('Error al obtener módulos:', error);
    res.status(500).json({ success: false, message: 'Error al obtener módulos' });
  }
};

// Obtener permisos de un usuario (combina rol + permisos individuales)
exports.getUserPermissions = async (req, res) => {
  try {
    const { userId } = req.params;
    await pool.connect();
    await ensureRhModuleExists();
    await ensureAccountingModuleExists();
    
    const result = await pool.request()
      .input('User_Id', sql.Int, userId)
      .query(`
        SELECT 
          m.Module_Id, 
          LOWER(LTRIM(RTRIM(m.ModuleKey))) AS ModuleKey, 
          m.ModuleName, 
          m.Description,
          COALESCE(up.CanAccess, 1) as CanAccess,
          CASE WHEN up.Permission_Id IS NOT NULL THEN 1 ELSE 0 END as IsCustom
        FROM ERP_MODULES m
        LEFT JOIN ERP_USER_PERMISSIONS up ON LOWER(LTRIM(RTRIM(up.ModuleKey))) = LOWER(LTRIM(RTRIM(m.ModuleKey))) AND up.User_Id = @User_Id
        WHERE m.IsActive = 1
        ORDER BY m.ModuleName
      `);
    
    res.json({ success: true, data: result.recordset });
  } catch (error) {
    console.error('Error al obtener permisos:', error);
    res.status(500).json({ success: false, message: 'Error al obtener permisos' });
  }
};

// Actualizar permisos de un usuario
exports.updateUserPermissions = async (req, res) => {
  try {
    const { userId } = req.params;
    const { permissions } = req.body; // [{ModuleKey, CanAccess}]

    if (!Array.isArray(permissions)) {
      return res.status(400).json({ success: false, message: 'permissions debe ser un arreglo' });
    }
    
    await pool.connect();
    await ensureRhModuleExists();
    await ensureAccountingModuleExists();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    
    try {
      for (const perm of permissions) {
        const normalizedModuleKey = String(perm.ModuleKey || '').trim().toLowerCase();
        if (!normalizedModuleKey) continue;

        const exists = await transaction.request()
          .input('User_Id', sql.Int, userId)
          .input('ModuleKey', sql.VarChar, normalizedModuleKey)
          .query('SELECT 1 FROM ERP_USER_PERMISSIONS WHERE User_Id = @User_Id AND LOWER(LTRIM(RTRIM(ModuleKey))) = @ModuleKey');
        
        if (exists.recordset.length > 0) {
          await transaction.request()
            .input('User_Id', sql.Int, userId)
            .input('ModuleKey', sql.VarChar, normalizedModuleKey)
            .input('CanAccess', sql.Bit, perm.CanAccess ? 1 : 0)
            .query('UPDATE ERP_USER_PERMISSIONS SET CanAccess = @CanAccess, UpdatedAt = GETDATE() WHERE User_Id = @User_Id AND LOWER(LTRIM(RTRIM(ModuleKey))) = @ModuleKey');
        } else {
          await transaction.request()
            .input('User_Id', sql.Int, userId)
            .input('ModuleKey', sql.VarChar, normalizedModuleKey)
            .input('CanAccess', sql.Bit, perm.CanAccess ? 1 : 0)
            .input('CreatedBy', sql.Int, req.user?.User_Id || 1)
            .query('INSERT INTO ERP_USER_PERMISSIONS (User_Id, ModuleKey, CanAccess, CreatedBy) VALUES (@User_Id, @ModuleKey, @CanAccess, @CreatedBy)');
        }
      }
      
      await transaction.commit();
      res.json({ success: true, message: 'Permisos actualizados correctamente' });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (error) {
    console.error('Error al actualizar permisos:', error);
    res.status(500).json({ success: false, message: 'Error al actualizar permisos' });
  }
};

// Verificar si un usuario tiene acceso a un módulo
exports.checkPermission = async (req, res) => {
  try {
    const { userId, moduleKey } = req.params;
    const normalizedModuleKey = String(moduleKey || '').trim().toLowerCase();
    await pool.connect();
    
    const result = await pool.request()
      .input('User_Id', sql.Int, userId)
      .input('ModuleKey', sql.VarChar, normalizedModuleKey)
      .query(`
        SELECT COALESCE(up.CanAccess, 1) as HasAccess
        FROM ERP_USERS u
        LEFT JOIN ERP_USER_PERMISSIONS up ON LOWER(LTRIM(RTRIM(up.ModuleKey))) = @ModuleKey AND up.User_Id = @User_Id
        WHERE u.User_Id = @User_Id
      `);
    
    const hasAccess = result.recordset.length > 0 && result.recordset[0].HasAccess;
    res.json({ success: true, hasAccess });
  } catch (error) {
    console.error('Error al verificar permiso:', error);
    res.status(500).json({ success: false, message: 'Error al verificar permiso' });
  }
};
