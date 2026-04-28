-- Verificar si falta el módulo de configuración y agregarlo
IF NOT EXISTS (SELECT 1 FROM ERP_MODULES WHERE ModuleKey = 'companies')
BEGIN
  INSERT INTO ERP_MODULES (ModuleKey, ModuleName, Description) 
  VALUES ('companies', 'Configuración', 'Configuración del sistema y empresas');
  PRINT 'Módulo de Configuración agregado';
END
ELSE
BEGIN
  -- Actualizar el nombre si ya existe pero con otro nombre
  UPDATE ERP_MODULES 
  SET ModuleName = 'Configuración', 
      Description = 'Configuración del sistema y empresas'
  WHERE ModuleKey = 'companies';
  PRINT 'Módulo de Configuración actualizado';
END

-- Verificar todos los módulos
SELECT ModuleKey, ModuleName, Description, IsActive 
FROM ERP_MODULES 
ORDER BY ModuleName;
