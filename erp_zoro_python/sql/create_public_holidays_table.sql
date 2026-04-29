-- ============================================================================
-- Script idempotente: crea ERP_PUBLIC_HOLIDAYS si no existe
-- Módulo: HR - Gestión de Días Festivos
-- ============================================================================

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_NAME = 'ERP_PUBLIC_HOLIDAYS'
)
BEGIN
    CREATE TABLE ERP_PUBLIC_HOLIDAYS (
        Holiday_Id       INT PRIMARY KEY IDENTITY(1,1),
        Company_Id       INT NOT NULL,
        HolidayDate      DATE NOT NULL,
        Name             NVARCHAR(100) NOT NULL,
        Description      NVARCHAR(500) NULL,
        IsObligatory     BIT NOT NULL DEFAULT 1,
        IsRecurring      BIT NOT NULL DEFAULT 0,
        RecurringMonth   INT NULL,   -- 1-12, solo si IsRecurring=1
        RecurringDay     INT NULL,   -- 1-31, solo si IsRecurring=1
        CreatedAt        DATETIME NOT NULL DEFAULT GETDATE(),
        UpdatedAt        DATETIME NOT NULL DEFAULT GETDATE()
    );

    CREATE INDEX IX_PUBLIC_HOLIDAYS_COMPANY
        ON ERP_PUBLIC_HOLIDAYS(Company_Id);

    CREATE INDEX IX_PUBLIC_HOLIDAYS_DATE
        ON ERP_PUBLIC_HOLIDAYS(HolidayDate);

    PRINT 'Tabla ERP_PUBLIC_HOLIDAYS creada correctamente.';
END
ELSE
BEGIN
    PRINT 'Tabla ERP_PUBLIC_HOLIDAYS ya existe. Sin cambios.';
END

-- Festivos recurrentes de México (ejemplo para empresa con Company_Id = 1)
-- Descomentar y ajustar el Company_Id antes de ejecutar

/*
INSERT INTO ERP_PUBLIC_HOLIDAYS (Company_Id, HolidayDate, Name, IsObligatory, IsRecurring, RecurringMonth, RecurringDay)
VALUES
  (1, '2026-01-01', 'Año Nuevo',             1, 1, 1,  1),
  (1, '2026-02-05', 'Día de la Constitución', 1, 1, 2,  5),
  (1, '2026-03-21', 'Natalicio de Juárez',   1, 1, 3, 21),
  (1, '2026-05-01', 'Día del Trabajo',        1, 1, 5,  1),
  (1, '2026-09-16', 'Día de Independencia',   1, 1, 9, 16),
  (1, '2026-11-02', 'Día de Muertos',         1, 1, 11, 2),
  (1, '2026-11-20', 'Revolución Mexicana',    1, 1, 11, 20),
  (1, '2026-12-25', 'Navidad',                1, 1, 12, 25);
*/
