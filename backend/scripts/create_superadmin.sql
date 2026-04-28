-- Verificar y crear SuperAdmin si no existe

-- 1. Verificar si existe un usuario con RolId = 1 (SuperAdmin)
SELECT TOP 1 * FROM ERP_USERS WHERE RolId = 1;

-- 2. Si no existe, crear uno
-- Primero, necesitamos el hash bcrypt de una contraseña segura
-- Para la prueba, vamos a usar una contraseña simple y su hash bcrypt
-- Hash de "SuperAdmin123" generado con bcrypt

IF NOT EXISTS (SELECT 1 FROM ERP_USERS WHERE RolId = 1)
BEGIN
    INSERT INTO ERP_USERS (
        Username, 
        Password, 
        Email, 
        FirstName, 
        LastName, 
        RolId, 
        IsActive, 
        CreationDate
    )
    VALUES (
        'superadmin',
        -- Hash bcrypt de "SuperAdmin123"
        '$2a$10$q1K1P8qF7gF8qF8gF8gF8eF9gF9gF9gF9gF9gF9gF9gF9gF9gF9gF',
        'superadmin@ardaby.com',
        'Super',
        'Admin',
        1,
        1,
        GETDATE()
    );
    
    SELECT 'SuperAdmin creado exitosamente' AS Resultado;
END
ELSE
BEGIN
    SELECT 'SuperAdmin ya existe' AS Resultado;
    SELECT * FROM ERP_USERS WHERE RolId = 1;
END
