-- Tabla de permisos por rol
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ERP_ROLE_MODULES' AND xtype='U')
CREATE TABLE ERP_ROLE_MODULES (
  RoleModule_Id INT IDENTITY(1,1) PRIMARY KEY,
  Role_Id INT NOT NULL,
  ModuleKey VARCHAR(100) NOT NULL,
  IsEnabled BIT DEFAULT 1,
  CreatedAt DATETIME DEFAULT GETDATE(),
  CONSTRAINT FK_RoleMod_Role FOREIGN KEY (Role_Id) REFERENCES ERP_ROL(Rol_Id) ON DELETE CASCADE,
  CONSTRAINT UK_Role_Module UNIQUE (Role_Id, ModuleKey)
);

-- Dar acceso completo al rol de Superadministrador (asumiendo que tiene Rol_Id = 1)
INSERT INTO ERP_ROLE_MODULES (Role_Id, ModuleKey, IsEnabled)
SELECT 1, ModuleKey, 1
FROM ERP_MODULES
WHERE NOT EXISTS (SELECT 1 FROM ERP_ROLE_MODULES WHERE Role_Id = 1 AND ModuleKey = ERP_MODULES.ModuleKey);
