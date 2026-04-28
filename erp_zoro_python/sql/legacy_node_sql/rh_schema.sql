-- Esquema inicial del módulo RH
-- Incluye: perfil de empleado, contactos de emergencia y cuentas bancarias

IF OBJECT_ID('dbo.ERP_HR_PROFILE', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ERP_HR_PROFILE (
        User_Id                          INT NOT NULL PRIMARY KEY,
        FechaNacimiento                  DATE NULL,
        CURP                             VARCHAR(30) NULL,
        RFC                              VARCHAR(20) NULL,
        NSS                              VARCHAR(30) NULL,
        EstadoCivil                      VARCHAR(30) NULL,
        Genero                           VARCHAR(30) NULL,
        Direccion                        VARCHAR(250) NULL,
        Ciudad                           VARCHAR(100) NULL,
        Estado                           VARCHAR(100) NULL,
        CodigoPostal                     VARCHAR(15) NULL,
        Pais                             VARCHAR(60) NULL,
        NumeroEmpleado                   VARCHAR(50) NULL,
        FechaIngreso                     DATE NULL,
        Puesto                           VARCHAR(100) NULL,
        Departamento                     VARCHAR(100) NULL,
        SalarioMensual                   DECIMAL(18,2) NULL,
        TipoContrato                     VARCHAR(50) NULL,
        BancoPrincipal                   VARCHAR(100) NULL,
        NumeroCuentaPrincipal            VARCHAR(50) NULL,
        CLABE                            VARCHAR(30) NULL,
        NombreTitularCuenta              VARCHAR(120) NULL,
        ContactoEmergenciaPrincipal      VARCHAR(120) NULL,
        TelefonoEmergenciaPrincipal      VARCHAR(30) NULL,
        Alergias                         VARCHAR(250) NULL,
        TipoSangre                       VARCHAR(10) NULL,
        NotasMedicas                     NVARCHAR(MAX) NULL,
        FotoPerfilUrl                    VARCHAR(300) NULL,
        CreatedAt                        DATETIME NOT NULL DEFAULT (GETDATE()),
        UpdatedAt                        DATETIME NOT NULL DEFAULT (GETDATE()),
        UpdatedBy                        INT NULL
    );

    ALTER TABLE dbo.ERP_HR_PROFILE
    ADD CONSTRAINT FK_ERP_HR_PROFILE_USER
        FOREIGN KEY (User_Id) REFERENCES dbo.ERP_USERS (User_Id);

    CREATE UNIQUE INDEX UX_ERP_HR_PROFILE_CURP ON dbo.ERP_HR_PROFILE (CURP) WHERE CURP IS NOT NULL;
END
GO

IF COL_LENGTH('dbo.ERP_HR_PROFILE', 'FotoPerfilUrl') IS NULL
BEGIN
    ALTER TABLE dbo.ERP_HR_PROFILE ADD FotoPerfilUrl VARCHAR(300) NULL;
END
GO

IF OBJECT_ID('dbo.ERP_HR_EMERGENCY_CONTACT', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ERP_HR_EMERGENCY_CONTACT (
        ContactoEmergencia_Id            INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        User_Id                          INT NOT NULL,
        Nombre                           VARCHAR(120) NOT NULL,
        Parentesco                       VARCHAR(80) NULL,
        Telefono                         VARCHAR(30) NOT NULL,
        TelefonoAlterno                  VARCHAR(30) NULL,
        Direccion                        VARCHAR(250) NULL,
        EsPrincipal                      BIT NOT NULL DEFAULT (0),
        Notas                            VARCHAR(250) NULL,
        IsActive                         BIT NOT NULL DEFAULT (1),
        CreatedAt                        DATETIME NOT NULL DEFAULT (GETDATE()),
        UpdatedAt                        DATETIME NOT NULL DEFAULT (GETDATE()),
        CreatedBy                        INT NULL
    );

    ALTER TABLE dbo.ERP_HR_EMERGENCY_CONTACT
    ADD CONSTRAINT FK_ERP_HR_EMERGENCY_CONTACT_USER
        FOREIGN KEY (User_Id) REFERENCES dbo.ERP_USERS (User_Id);

    CREATE INDEX IX_ERP_HR_EMERGENCY_CONTACT_USER ON dbo.ERP_HR_EMERGENCY_CONTACT (User_Id);
END
GO

IF OBJECT_ID('dbo.ERP_HR_BANK_ACCOUNT', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ERP_HR_BANK_ACCOUNT (
        CuentaBancaria_Id                INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        User_Id                          INT NOT NULL,
        Banco                            VARCHAR(100) NOT NULL,
        NumeroCuenta                     VARCHAR(50) NOT NULL,
        CLABE                            VARCHAR(30) NULL,
        NumeroTarjeta                    VARCHAR(30) NULL,
        Moneda                           VARCHAR(10) NOT NULL DEFAULT ('MXN'),
        EsPrincipal                      BIT NOT NULL DEFAULT (0),
        NombreTitular                    VARCHAR(120) NULL,
        IsActive                         BIT NOT NULL DEFAULT (1),
        CreatedAt                        DATETIME NOT NULL DEFAULT (GETDATE()),
        UpdatedAt                        DATETIME NOT NULL DEFAULT (GETDATE()),
        CreatedBy                        INT NULL
    );

    ALTER TABLE dbo.ERP_HR_BANK_ACCOUNT
    ADD CONSTRAINT FK_ERP_HR_BANK_ACCOUNT_USER
        FOREIGN KEY (User_Id) REFERENCES dbo.ERP_USERS (User_Id);

    CREATE INDEX IX_ERP_HR_BANK_ACCOUNT_USER ON dbo.ERP_HR_BANK_ACCOUNT (User_Id);
END
GO
