-- FASE 10: Marketing, Fleet, Surveys, Subscriptions
-- Idempotent: all tables use IF NOT EXISTS guards

-- ─── MARKETING ────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'ERP_MARKETING_LISTA')
BEGIN
    CREATE TABLE ERP_MARKETING_LISTA (
        Lista_Id        INT IDENTITY(1,1) PRIMARY KEY,
        Company_Id      INT NOT NULL,
        Nombre          NVARCHAR(200) NOT NULL,
        Descripcion     NVARCHAR(500),
        FechaCreacion   DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (Company_Id) REFERENCES ERP_COMPANY(Company_Id)
    );
END

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'ERP_MARKETING_CONTACTO')
BEGIN
    CREATE TABLE ERP_MARKETING_CONTACTO (
        Contacto_Id     INT IDENTITY(1,1) PRIMARY KEY,
        Lista_Id        INT NOT NULL,
        Nombre          NVARCHAR(200) NOT NULL,
        Email           NVARCHAR(200) NOT NULL,
        Telefono        NVARCHAR(50),
        Empresa         NVARCHAR(200),
        FechaAgregado   DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (Lista_Id) REFERENCES ERP_MARKETING_LISTA(Lista_Id)
    );
END

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'ERP_MARKETING_CAMPANA')
BEGIN
    CREATE TABLE ERP_MARKETING_CAMPANA (
        Campana_Id      INT IDENTITY(1,1) PRIMARY KEY,
        Company_Id      INT NOT NULL,
        Lista_Id        INT NOT NULL,
        Nombre          NVARCHAR(200) NOT NULL,
        Asunto          NVARCHAR(500) NOT NULL,
        Cuerpo          NVARCHAR(MAX),
        Tipo            NVARCHAR(50) DEFAULT 'email',
        Estado          NVARCHAR(50) DEFAULT 'borrador',  -- borrador | enviando | enviada | error
        FechaCreacion   DATETIME DEFAULT GETDATE(),
        FechaEnvio      DATETIME,
        TotalEnviados   INT DEFAULT 0,
        TotalAbiertos   INT DEFAULT 0,
        TotalErrores    INT DEFAULT 0,
        FOREIGN KEY (Company_Id) REFERENCES ERP_COMPANY(Company_Id),
        FOREIGN KEY (Lista_Id) REFERENCES ERP_MARKETING_LISTA(Lista_Id)
    );
END

-- ─── FLEET ────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'ERP_FLEET_VEHICULO')
BEGIN
    CREATE TABLE ERP_FLEET_VEHICULO (
        Vehiculo_Id         INT IDENTITY(1,1) PRIMARY KEY,
        Company_Id          INT NOT NULL,
        Placa               NVARCHAR(20) NOT NULL,
        Marca               NVARCHAR(100) NOT NULL,
        Modelo              NVARCHAR(100) NOT NULL,
        Anio                INT,
        Color               NVARCHAR(50),
        Tipo                NVARCHAR(50) DEFAULT 'camion',  -- camion | auto | moto | otro
        AsignadoA           INT,  -- User_Id
        Estado              NVARCHAR(50) DEFAULT 'activo',  -- activo | mantenimiento | baja
        KilometrajeActual   INT DEFAULT 0,
        Notas               NVARCHAR(500),
        FechaCreacion       DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (Company_Id) REFERENCES ERP_COMPANY(Company_Id)
    );
END

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'ERP_FLEET_SERVICIO')
BEGIN
    CREATE TABLE ERP_FLEET_SERVICIO (
        Servicio_Id         INT IDENTITY(1,1) PRIMARY KEY,
        Vehiculo_Id         INT NOT NULL,
        TipoServicio        NVARCHAR(100) NOT NULL,  -- mantenimiento | revision | combustible | seguro | otro
        Descripcion         NVARCHAR(500),
        Costo               DECIMAL(12,2),
        Proveedor           NVARCHAR(200),
        FechaServicio       DATE NOT NULL,
        KilometrajeActual   INT,
        Notas               NVARCHAR(500),
        FechaCreacion       DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (Vehiculo_Id) REFERENCES ERP_FLEET_VEHICULO(Vehiculo_Id)
    );
END

-- ─── SURVEYS ──────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'ERP_SURVEY_ENCUESTA')
BEGIN
    CREATE TABLE ERP_SURVEY_ENCUESTA (
        Encuesta_Id     INT IDENTITY(1,1) PRIMARY KEY,
        Company_Id      INT NOT NULL,
        Titulo          NVARCHAR(300) NOT NULL,
        Descripcion     NVARCHAR(1000),
        EsPublica       BIT DEFAULT 0,
        Estado          NVARCHAR(50) DEFAULT 'activa',  -- activa | cerrada | borrador
        FechaCreacion   DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (Company_Id) REFERENCES ERP_COMPANY(Company_Id)
    );
END

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'ERP_SURVEY_PREGUNTA')
BEGIN
    CREATE TABLE ERP_SURVEY_PREGUNTA (
        Pregunta_Id     INT IDENTITY(1,1) PRIMARY KEY,
        Encuesta_Id     INT NOT NULL,
        Texto           NVARCHAR(500) NOT NULL,
        Tipo            NVARCHAR(50) DEFAULT 'texto',  -- texto | opcion_multiple | escala | si_no
        Opciones        NVARCHAR(MAX),  -- JSON string for opcion_multiple
        Requerida       BIT DEFAULT 1,
        Orden           INT DEFAULT 1,
        FOREIGN KEY (Encuesta_Id) REFERENCES ERP_SURVEY_ENCUESTA(Encuesta_Id)
    );
END

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'ERP_SURVEY_RESPUESTA')
BEGIN
    CREATE TABLE ERP_SURVEY_RESPUESTA (
        Respuesta_Id        INT IDENTITY(1,1) PRIMARY KEY,
        Encuesta_Id         INT NOT NULL,
        NombreRespondente   NVARCHAR(200),
        EmailRespondente    NVARCHAR(200),
        FechaRespuesta      DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (Encuesta_Id) REFERENCES ERP_SURVEY_ENCUESTA(Encuesta_Id)
    );
END

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'ERP_SURVEY_DETALLE_RESPUESTA')
BEGIN
    CREATE TABLE ERP_SURVEY_DETALLE_RESPUESTA (
        Detalle_Id      INT IDENTITY(1,1) PRIMARY KEY,
        Respuesta_Id    INT NOT NULL,
        Encuesta_Id     INT NOT NULL,
        Pregunta_Id     INT NOT NULL,
        Valor           NVARCHAR(MAX),
        FOREIGN KEY (Respuesta_Id) REFERENCES ERP_SURVEY_RESPUESTA(Respuesta_Id),
        FOREIGN KEY (Pregunta_Id) REFERENCES ERP_SURVEY_PREGUNTA(Pregunta_Id)
    );
END

-- ─── SUBSCRIPTIONS ────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'ERP_SUSCRIPCION_PLAN')
BEGIN
    CREATE TABLE ERP_SUSCRIPCION_PLAN (
        Plan_Id         INT IDENTITY(1,1) PRIMARY KEY,
        Company_Id      INT NOT NULL,
        Nombre          NVARCHAR(200) NOT NULL,
        Descripcion     NVARCHAR(500),
        PrecioMensual   DECIMAL(12,2) NOT NULL,
        PrecioAnual     DECIMAL(12,2),
        Moneda          NVARCHAR(10) DEFAULT 'MXN',
        Caracteristicas NVARCHAR(MAX),
        Activo          BIT DEFAULT 1,
        FechaCreacion   DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (Company_Id) REFERENCES ERP_COMPANY(Company_Id)
    );
END

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'ERP_SUSCRIPCION')
BEGIN
    CREATE TABLE ERP_SUSCRIPCION (
        Suscripcion_Id      INT IDENTITY(1,1) PRIMARY KEY,
        Company_Id          INT NOT NULL,
        Client_Id           INT NOT NULL,
        Plan_Id             INT NOT NULL,
        FechaInicio         DATE NOT NULL,
        FechaVencimiento    DATE NOT NULL,
        Ciclo               NVARCHAR(20) DEFAULT 'mensual',  -- mensual | anual
        Estado              NVARCHAR(50) DEFAULT 'activa',   -- activa | cancelada | vencida
        MontoProximo        DECIMAL(12,2),
        Notas               NVARCHAR(500),
        FechaCreacion       DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (Company_Id) REFERENCES ERP_COMPANY(Company_Id),
        FOREIGN KEY (Plan_Id) REFERENCES ERP_SUSCRIPCION_PLAN(Plan_Id)
    );
END

-- ─── REGISTER NEW MODULES ─────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM ERP_MODULES WHERE ModuleKey = 'marketing')
    INSERT INTO ERP_MODULES (ModuleKey, DisplayName, Description, IsActive)
    VALUES ('marketing', 'Email Marketing', 'Campañas de correo masivo y listas de contactos', 1);

IF NOT EXISTS (SELECT 1 FROM ERP_MODULES WHERE ModuleKey = 'fleet')
    INSERT INTO ERP_MODULES (ModuleKey, DisplayName, Description, IsActive)
    VALUES ('fleet', 'Flotilla', 'Gestión de vehículos y mantenimiento', 1);

IF NOT EXISTS (SELECT 1 FROM ERP_MODULES WHERE ModuleKey = 'surveys')
    INSERT INTO ERP_MODULES (ModuleKey, DisplayName, Description, IsActive)
    VALUES ('surveys', 'Encuestas', 'Formularios y encuestas de satisfacción', 1);

IF NOT EXISTS (SELECT 1 FROM ERP_MODULES WHERE ModuleKey = 'subscriptions')
    INSERT INTO ERP_MODULES (ModuleKey, DisplayName, Description, IsActive)
    VALUES ('subscriptions', 'Suscripciones', 'Planes y facturación recurrente', 1);

SELECT 'fase_10_OK' AS resultado;
