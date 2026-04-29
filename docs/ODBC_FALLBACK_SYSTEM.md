# 🔧 Sistema de Fallback para Drivers ODBC

## 📋 Resumen

La conexión a SQL Server ahora es **automáticamente compatible** con múltiples drivers ODBC:

1. ✅ **Intenta ODBC Driver 18** (preferido)
2. ✅ **Si falla, intenta ODBC Driver 17** (compatible)
3. ✅ **Si falla, usa cualquier driver SQL Server** disponible
4. ❌ **Si no hay ninguno, muestra error claro**

---

## 🚀 Cómo Funciona

### Antes (sin fallback)
```python
# ❌ Si faltaba ODBC Driver 18, fallaba con error confuso
engine = create_engine(settings.database_url)
```

### Después (con fallback)
```python
# ✅ Intenta múltiples drivers automáticamente
engine = _create_engine_with_fallback()

# Logs:
# ✅ Usando driver: ODBC Driver 18 for SQL Server
# ✅ Conexión a SQL Server exitosa con ODBC Driver 18 for SQL Server
```

---

## 🔍 Verificar Drivers Disponibles

### Ejecutar script de diagnóstico

```bash
cd erp_zoro_python
python check-odbc-drivers.py
```

**Salida esperada:**
```
🔍 VERIFICACIÓN DE DRIVERS ODBC SQL SERVER
==================================================

Total de drivers ODBC: 3

✅ Drivers SQL Server encontrados:

   • ODBC Driver 18 for SQL Server
   • ODBC Driver 17 for SQL Server
   • SQL Server Native Client 11.0

🎯 Preferencia de drivers (en orden):
   1. ODBC Driver 18 for SQL Server (recomendado)
   2. ODBC Driver 17 for SQL Server (compatible)
   3. Cualquier driver SQL Server disponible

🔧 Se usaría: ODBC Driver 18 for SQL Server
```

---

## ⚠️ Si No Hay Drivers

**Error que verás al iniciar uvicorn:**
```
❌ ERROR CRÍTICO: No hay drivers ODBC para SQL Server instalados

Soluciones:
1. Descarga: https://learn.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server
2. Ejecuta el instalador .msi de ODBC Driver 18
3. Reinicia la terminal
4. Intenta nuevamente
```

**Acciones:**
1. Descarga [ODBC Driver 18 para SQL Server](https://learn.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server)
2. Ejecuta el instalador `.msi`
3. Reinicia terminal
4. Vuelve a ejecutar uvicorn

---

## 🔗 Archivos Modificados

| Archivo | Cambios |
|---------|---------|
| `app/db/session.py` | ✅ Agregado sistema de fallback con múltiples drivers |
| `check-odbc-drivers.py` | ✅ Nuevo script para verificar drivers disponibles |

---

## 📝 Prioridad de Drivers

El sistema intenta en este orden:

```
1. Driver especificado en .env (ERP_SQLSERVER_DRIVER)
   ↓ (si está disponible, úsalo)
   ↓ (si no, continúa)

2. ODBC Driver 18 for SQL Server
   ↓ (si existe, úsalo)
   ↓ (si no, continúa)

3. ODBC Driver 17 for SQL Server
   ↓ (si existe, úsalo)
   ↓ (si no, continúa)

4. Primer driver SQL Server disponible
   ↓ (si existe, úsalo)
   ↓ (si no, error)

5. ERROR: No hay drivers SQL Server
```

---

## 🧪 Ejemplo de Ejecución

### Escenario 1: ODBC Driver 18 Disponible
```
✅ Usando driver: ODBC Driver 18 for SQL Server
✅ Conexión a SQL Server exitosa con ODBC Driver 18 for SQL Server
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete
```

### Escenario 2: Solo ODBC Driver 17 Disponible
```
⚠️  Driver preferido no disponible, usando: ODBC Driver 17 for SQL Server
✅ Conexión a SQL Server exitosa con ODBC Driver 17 for SQL Server
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete
```

### Escenario 3: No hay Drivers
```
❌ ERROR CRÍTICO: No hay drivers ODBC para SQL Server instalados

Soluciones:
1. Descarga: https://learn.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server
...
Traceback (most recent call last):
  ...
RuntimeError: ❌ ERROR CRÍTICO: No hay drivers ODBC para SQL Server instalados
```

---

## 🔧 Troubleshooting

### Problema: "No se encuentra el nombre del origen de datos"
**Causa**: Falta driver ODBC

**Solución**:
```bash
python check-odbc-drivers.py
# Si no muestra drivers, instala ODBC Driver 18
```

### Problema: "Connection refused" después de instalar driver
**Causa**: SQL Server no está accesible

**Verificar**:
```bash
# Desde PowerShell
$host = "74.208.195.73"
$port = 1433
$timeout = 3000
$connection = New-Object System.Net.Sockets.TcpClient
$result = $connection.BeginConnect($host, $port, $null, $null)
$connected = $result.AsyncWaitHandle.WaitOne($timeout, $false)

if ($connected) {
    Write-Host "✅ Puedo conectar a $host`:$port"
} else {
    Write-Host "❌ No puedo conectar a $host`:$port"
}
```

---

## 📞 Resumen

✅ **El backend ahora es robusto:**
- Intenta múltiples drivers automáticamente
- Muestra errores claros y accionables
- Sin necesidad de modificar código

**Próximo paso**: Instala ODBC Driver 18 y reinicia uvicorn

