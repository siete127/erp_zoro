# 🚀 Crear Tabla de Vacaciones - Guía Manual

## ✅ Solución: Ejecutar SQL en SSMS

Ya que no tienes ODBC Driver instalado, ejecutaremos el SQL **directamente en SQL Server Management Studio**.

---

## 📋 Pasos

### **Paso 1: Abre SQL Server Management Studio**

![SSMS](https://img.icons8.com/color/96/000000/sql-server.png)

- Si no lo tienes, descárgalo de: https://learn.microsoft.com/es-es/sql/ssms/download-sql-server-management-studio-ssms

### **Paso 2: Conecta al servidor**

1. Abre SSMS
2. Click en **"Connect"** o **"Object Explorer"**
3. Ingresa:
   - **Server name:** `74.208.195.73,1433` o `74.208.195.73:1433`
   - **Authentication:** SQL Server Authentication
   - **Login:** `sa`
   - **Password:** `D1g1t4l3dg32024.`
4. Click en **"Connect"**

### **Paso 3: Selecciona la base de datos**

1. En **"Object Explorer"** (izquierda), expande **"Databases"**
2. Busca y haz click en **`ERP_Zoro`**

### **Paso 4: Abre una nueva query**

1. Click en **"New Query"** (botón en la barra de herramientas)
2. O presiona: `Ctrl + N`

### **Paso 5: Copia el script SQL**

**Opción A: Archivo listo**
- Abre: `CREATE_VACATION_TABLE_MANUAL.sql`
- Copia todo el contenido

**Opción B: Copia manualmente**
```sql
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

CREATE INDEX IX_VACATION_USER_ID ON ERP_HR_VACATION_REQUEST(User_Id);
CREATE INDEX IX_VACATION_STATUS ON ERP_HR_VACATION_REQUEST(Estatus);
CREATE INDEX IX_VACATION_DATE_RANGE ON ERP_HR_VACATION_REQUEST(FechaInicio, FechaFin);
CREATE INDEX IX_VACATION_CREATED_AT ON ERP_HR_VACATION_REQUEST(CreatedAt DESC);
```

### **Paso 6: Pega en SSMS**

1. En la ventana de query blanca, pega el SQL
2. El texto debe verse así:
   ```
   CREATE TABLE ERP_HR_VACATION_REQUEST (
       Vacaciones_Id INT PRIMARY KEY IDENTITY(1,1),
       ...
   ```

### **Paso 7: Ejecuta el script**

**Opción A: Botón**
- Click en el botón verde **"Execute"** (toolbar)

**Opción B: Teclado**
- Presiona **`F5`**

### **Paso 8: Espera el resultado**

Verás mensajes en la ventana "Messages":

✅ Si sale esto:
```
(15 filas afectadas)
(1 filas afectadas)
(1 filas afectadas)
(1 filas afectadas)
(1 filas afectadas)
======================================================================
✅ TABLA ERP_HR_VACATION_REQUEST CREADA EXITOSAMENTE
======================================================================
```

❌ Si sale error:
```
Msg XXXX, Level 16, State 1, Line X
...
```

---

## ✨ ¡Listo!

Una vez creada la tabla:

1. ✅ Tabla en base de datos
2. ✅ Índices optimizados
3. ✅ Módulo integrado en frontend
4. ✅ Listo para usar

### Cómo usar:
```
1. Navega a RH en la aplicación
2. Selecciona un empleado
3. Click en la pestaña "📅 Vacaciones"
4. ¡A solicitar vacaciones!
```

---

## 📁 Archivos útiles

- `CREATE_VACATION_TABLE_MANUAL.sql` - Script listo para copiar-pegar
- `create_vacation_request_table.sql` - Script comentado (referencia)
- `GUIA_MODULO_VACACIONES.md` - Manual de uso

---

## 🆘 Si hay problemas

**Error: "User_Id does not exist"**
- Significa que la tabla `ERP_USERS` no existe
- Solución: Verifica que estés en la BD correcta (`ERP_Zoro`)

**Error: "Table already exists"**
- La tabla ya fue creada antes
- Solución: Ejecuta primero: `DROP TABLE ERP_HR_VACATION_REQUEST`
- Luego vuelve a ejecutar el script

**Error de conexión**
- Verifica credenciales: `sa` / `D1g1t4l3dg32024.`
- Verifica dirección: `74.208.195.73:1433`
- Asegúrate que puedas pingear el servidor

---

**¿Necesitas ayuda con los pasos?** 💬
