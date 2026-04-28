-- Sistema de Permisos por Usuario
-- Permite al superadmin controlar acceso a módulos específicos por usuario

-- Tabla de módulos del sistema
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ERP_MODULES' AND xtype='U')
CREATE TABLE ERP_MODULES (
  Module_Id INT IDENTITY(1,1) PRIMARY KEY,
  ModuleKey VARCHAR(100) NOT NULL UNIQUE,
  ModuleName VARCHAR(255) NOT NULL,
  Description VARCHAR(500),
  IsActive BIT DEFAULT 1,
  CreatedAt DATETIME DEFAULT GETDATE()
);

-- Tabla de permisos por usuario (sobrescribe permisos del rol)
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ERP_USER_PERMISSIONS' AND xtype='U')
CREATE TABLE ERP_USER_PERMISSIONS (
  Permission_Id INT IDENTITY(1,1) PRIMARY KEY,
  User_Id INT NOT NULL,
  ModuleKey VARCHAR(100) NOT NULL,
  CanAccess BIT DEFAULT 1,
  CreatedBy INT,
  CreatedAt DATETIME DEFAULT GETDATE(),
  UpdatedAt DATETIME DEFAULT GETDATE(),
  CONSTRAINT FK_UserPerm_User FOREIGN KEY (User_Id) REFERENCES ERP_USERS(User_Id) ON DELETE CASCADE,
  CONSTRAINT UK_User_Module UNIQUE (User_Id, ModuleKey)
);

-- Insertar módulos por defecto si no existen
IF NOT EXISTS (SELECT 1 FROM ERP_MODULES WHERE ModuleKey = 'dashboard')
BEGIN
  INSERT INTO ERP_MODULES (ModuleKey, ModuleName, Description) VALUES 
  ('dashboard', 'Dashboard', 'Panel principal del sistema'),
  ('users', 'Usuarios', 'Gestión de usuarios'),
  ('roles', 'Roles', 'Gestión de roles y permisos'),
  ('companies', 'Empresas', 'Gestión de empresas'),
  ('clients', 'Clientes', 'Gestión de clientes'),
  ('products', 'Productos', 'Catálogo de productos'),
  ('bom', 'BOM', 'Lista de materiales'),
  ('inventory', 'Inventario', 'Control de inventario'),
  ('production', 'Producción', 'Órdenes de producción'),
  ('sales', 'Ventas', 'Gestión de ventas'),
  ('invoices', 'Facturas', 'Facturación electrónica'),
  ('quotes', 'Cotizaciones', 'Gestión de cotizaciones'),
  ('crm', 'CRM', 'Gestión de relaciones con clientes'),
  ('rh', 'Recursos Humanos', 'Gestión de expediente de personal, contactos y cuentas'),
  ('reports', 'Reportes', 'Reportes y análisis');
END
