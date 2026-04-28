-- Normaliza claves de módulo a minúsculas para evitar problemas RH/rh

IF OBJECT_ID('dbo.ERP_MODULES', 'U') IS NOT NULL
BEGIN
  UPDATE ERP_MODULES
  SET ModuleKey = LOWER(LTRIM(RTRIM(ModuleKey)))
  WHERE ModuleKey IS NOT NULL;
END
GO

IF OBJECT_ID('dbo.ERP_USER_PERMISSIONS', 'U') IS NOT NULL
BEGIN
  UPDATE ERP_USER_PERMISSIONS
  SET ModuleKey = LOWER(LTRIM(RTRIM(ModuleKey)))
  WHERE ModuleKey IS NOT NULL;
END
GO

-- Asegura el módulo RH activo
IF OBJECT_ID('dbo.ERP_MODULES', 'U') IS NOT NULL
BEGIN
  IF NOT EXISTS (SELECT 1 FROM ERP_MODULES WHERE ModuleKey = 'rh')
  BEGIN
    INSERT INTO ERP_MODULES (ModuleKey, ModuleName, Description, IsActive)
    VALUES ('rh', 'Recursos Humanos', 'Gestión de expediente de personal, contactos y cuentas', 1);
  END
  ELSE
  BEGIN
    UPDATE ERP_MODULES
    SET IsActive = 1
    WHERE ModuleKey = 'rh';
  END
END
GO
