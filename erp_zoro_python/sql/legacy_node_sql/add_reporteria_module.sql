-- Script para agregar módulo de Reportería y asignar permisos

-- 1. Agregar módulo de Reportería si no existe
IF NOT EXISTS (SELECT 1 FROM ERP_MODULES WHERE Module_Key = 'reporteria')
BEGIN
    INSERT INTO ERP_MODULES (Module_Key, Module_Name, Description, IsActive)
    VALUES ('reporteria', 'Reportería', 'Módulo de reportería y consulta de facturas', 1);
    PRINT 'Módulo de Reportería agregado';
END
ELSE
BEGIN
    PRINT 'Módulo de Reportería ya existe';
END
GO

-- 2. Obtener el Module_Id de reportería
DECLARE @ModuleId INT;
SELECT @ModuleId = Module_Id FROM ERP_MODULES WHERE Module_Key = 'reporteria';

-- 3. Asignar permisos a usuarios específicos (SAMARA, CONSUELO, AXEL, JOSS)
-- Primero verificamos que existan los usuarios

DECLARE @UserIds TABLE (User_Id INT, Username VARCHAR(100));

INSERT INTO @UserIds (User_Id, Username)
SELECT User_Id, Username 
FROM ERP_USERS 
WHERE Username IN ('SAMARA', 'CONSUELO', 'AXEL', 'JOSS');

-- Mostrar usuarios encontrados
SELECT 'Usuarios encontrados:' as Info;
SELECT * FROM @UserIds;

-- 4. Asignar permisos de reportería a cada usuario
DECLARE @UserId INT;
DECLARE @Username VARCHAR(100);

DECLARE user_cursor CURSOR FOR 
SELECT User_Id, Username FROM @UserIds;

OPEN user_cursor;
FETCH NEXT FROM user_cursor INTO @UserId, @Username;

WHILE @@FETCH_STATUS = 0
BEGIN
    -- Verificar si ya tiene el permiso
    IF NOT EXISTS (
        SELECT 1 FROM ERP_USER_MODULE_PERMISSIONS 
        WHERE User_Id = @UserId AND Module_Id = @ModuleId
    )
    BEGIN
        INSERT INTO ERP_USER_MODULE_PERMISSIONS (User_Id, Module_Id, HasAccess)
        VALUES (@UserId, @ModuleId, 1);
        PRINT 'Permiso de Reportería asignado a: ' + @Username;
    END
    ELSE
    BEGIN
        -- Actualizar si ya existe
        UPDATE ERP_USER_MODULE_PERMISSIONS 
        SET HasAccess = 1 
        WHERE User_Id = @UserId AND Module_Id = @ModuleId;
        PRINT 'Permiso de Reportería actualizado para: ' + @Username;
    END
    
    FETCH NEXT FROM user_cursor INTO @UserId, @Username;
END

CLOSE user_cursor;
DEALLOCATE user_cursor;

-- 5. Verificar permisos asignados
SELECT 
    u.Username,
    m.Module_Name,
    p.HasAccess
FROM ERP_USER_MODULE_PERMISSIONS p
INNER JOIN ERP_USERS u ON p.User_Id = u.User_Id
INNER JOIN ERP_MODULES m ON p.Module_Id = m.Module_Id
WHERE m.Module_Key = 'reporteria'
ORDER BY u.Username;

PRINT 'Script completado exitosamente';
GO
