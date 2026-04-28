-- Agrega módulo RH al catálogo de permisos (idempotente)

IF NOT EXISTS (SELECT 1 FROM ERP_MODULES WHERE ModuleKey = 'rh')
BEGIN
  INSERT INTO ERP_MODULES (ModuleKey, ModuleName, Description, IsActive)
  VALUES ('rh', 'Recursos Humanos', 'Gestión de expediente de personal, contactos y cuentas', 1);
END
ELSE
BEGIN
  UPDATE ERP_MODULES
  SET ModuleName = 'Recursos Humanos',
      Description = 'Gestión de expediente de personal, contactos y cuentas',
      IsActive = 1
  WHERE ModuleKey = 'rh';
END
GO

-- Si existe la tabla de permisos por rol, habilitar RH por defecto para superadmin (Role_Id = 1)
IF OBJECT_ID('dbo.ERP_ROLE_MODULES', 'U') IS NOT NULL
BEGIN
  IF NOT EXISTS (SELECT 1 FROM ERP_ROLE_MODULES WHERE Role_Id = 1 AND ModuleKey = 'rh')
  BEGIN
    INSERT INTO ERP_ROLE_MODULES (Role_Id, ModuleKey, IsEnabled)
    VALUES (1, 'rh', 1);
  END
END
GO
