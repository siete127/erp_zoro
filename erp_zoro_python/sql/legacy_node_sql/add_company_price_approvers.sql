-- Migration: agregar campos de email de aprobación de precio en empresas
-- Ejecutar en SQL Server para habilitar doble autorización por correo

ALTER TABLE ERP_COMPANY
ADD EmailAprobacion1 VARCHAR(250) NULL,
    EmailAprobacion2 VARCHAR(250) NULL;

-- puedes asignar valores por defecto si lo deseas, por ejemplo:
-- UPDATE ERP_COMPANY SET EmailAprobacion1 = 'admin@empresa.com' WHERE EmailAprobacion1 IS NULL;
