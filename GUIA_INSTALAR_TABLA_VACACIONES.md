# 🔧 Guía Rápida: Crear Tabla de Vacaciones

## ❌ El Problema

No tienes **ODBC Driver 18 for SQL Server** instalado en tu máquina Windows.

Sin este driver, Python no puede conectarse a SQL Server para crear la tabla automáticamente.

---

## ✅ Solución (2 opciones)

### Opción 1: Instalar ODBC Driver (Recomendado) ⭐

#### Paso 1: Descargar
1. Ve a: https://learn.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server
2. Descarga **"msodbcsql.msi"** (elige tu arquitectura: 64-bit o 32-bit)

#### Paso 2: Instalar
1. Ejecuta el archivo `.msi` descargado
2. Sigue los pasos del instalador
3. Reinicia tu máquina (importante)

#### Paso 3: Crear la tabla
```bash
cd erp_zoro_python
python create_vacation_table_v2.py
```

---

### Opción 2: Ejecutar Script SQL Manualmente 📋

Si no quieres instalar ODBC Driver, ejecuta el SQL directamente:

#### Paso 1: Abre SQL Server Management Studio

#### Paso 2: Copia el contenido del archivo:
```
erp_zoro_python/sql/create_vacation_request_table.sql
```

#### Paso 3: Pega en SSMS y ejecuta

```sql
-- El archivo contiene:
CREATE TABLE ERP_HR_VACATION_REQUEST (
    Vacaciones_Id INT PRIMARY KEY IDENTITY(1,1),
    User_Id INT NOT NULL,
    FechaInicio DATETIME NOT NULL,
    FechaFin DATETIME NOT NULL,
    Cantidad INT NOT NULL,
    Razon NVARCHAR(255) NULL,
    Observaciones NVARCHAR(MAX) NULL,
    Estatus NVARCHAR(50) NOT NULL DEFAULT 'Pendiente',
    AprobadoPor INT NULL,
    FechaAprobacion DATETIME NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    UpdatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    CreatedBy INT NULL,
    UpdatedBy INT NULL,
    CONSTRAINT FK_VACATION_USER FOREIGN KEY (User_Id) REFERENCES ERP_USERS(User_Id),
    CONSTRAINT FK_VACATION_APPROVED_BY FOREIGN KEY (AprobadoPor) REFERENCES ERP_USERS(User_Id),
    CONSTRAINT CK_VACATION_STATUS CHECK (Estatus IN ('Pendiente', 'Aprobado', 'Rechazado')),
    CONSTRAINT CK_VACATION_DATES CHECK (FechaFin >= FechaInicio),
    CONSTRAINT CK_VACATION_CANTIDAD CHECK (Cantidad > 0)
);

-- Crear índices
CREATE INDEX IX_VACATION_USER_ID ON ERP_HR_VACATION_REQUEST(User_Id);
CREATE INDEX IX_VACATION_STATUS ON ERP_HR_VACATION_REQUEST(Estatus);
CREATE INDEX IX_VACATION_DATE_RANGE ON ERP_HR_VACATION_REQUEST(FechaInicio, FechaFin);
CREATE INDEX IX_VACATION_CREATED_AT ON ERP_HR_VACATION_REQUEST(CreatedAt DESC);
```

---

## ✨ Una vez completado:

1. ✅ Tabla creada
2. ✅ Índices listos
3. ✅ Módulo integrado en RH.jsx
4. ✅ Listo para usar

### Para usar:
```
1. Navega a RH
2. Selecciona un empleado
3. Click en la pestaña "📅 Vacaciones"
4. ¡A solicitar vacaciones!
```

---

## 📞 Si necesitas ayuda:

Consulta estos archivos:
- `GUIA_MODULO_VACACIONES.md` - Manual completo
- `INTEGRACION_MODULO_VACACIONES.md` - Integración frontend
- `create_vacation_request_table.sql` - Script SQL puro

---

**¿Cuál opción prefieres?**
- Opción 1: Instalar ODBC Driver (automático después)
- Opción 2: Ejecutar SQL manualmente en SSMS
