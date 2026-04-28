-- FASE 5 — Nómina + Asistencia
-- Las tablas ERP_NOI_* ya existen en el schema principal.
-- Este script solo crea ERP_ASISTENCIA.

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_NAME = 'ERP_ASISTENCIA'
)
BEGIN
    CREATE TABLE [dbo].[ERP_ASISTENCIA] (
        [Asist_Id]    INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [User_Id]     INT NOT NULL REFERENCES [dbo].[ERP_USERS]([User_Id]),
        [Company_Id]  INT NOT NULL REFERENCES [dbo].[ERP_COMPANY]([Company_Id]),
        [Fecha]       DATE NOT NULL DEFAULT CAST(GETDATE() AS DATE),
        [HoraEntrada] DATETIME NULL,
        [HoraSalida]  DATETIME NULL,
        [Tipo]        NVARCHAR(20) NOT NULL DEFAULT 'normal'
            CHECK ([Tipo] IN ('normal', 'home_office', 'permiso'))
    );
    PRINT 'Tabla ERP_ASISTENCIA creada.';
END
ELSE
    PRINT 'Tabla ERP_ASISTENCIA ya existe.';
GO
