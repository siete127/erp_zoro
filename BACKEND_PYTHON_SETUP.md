# 🐍 SOLUCIÓN CORRECTA - Backend Python (FastAPI)

## El Error fue

El backend está en **Python (FastAPI)**, no Node.js. 

- ❌ Cambié `vite.config.js` a puerto 5000 (error mío, era para Node.js)
- ✅ Ahora apunta a puerto 8000 (donde corre FastAPI)

---

## 🚀 PASOS PARA EJECUTAR

### Paso 1: Instalar Dependencias Python (Primera vez)

```bash
cd erp_zoro_python
pip install -r requirements.txt
```

Si no tienes Python instalado, descárgalo desde https://www.python.org

### Paso 2: Verificar .env

El archivo `erp_zoro_python/.env` ya está configurado para desarrollo local:

```env
ERP_SQLSERVER_HOST=localhost
ERP_SQLSERVER_PORT=1433
ERP_SQLSERVER_DATABASE=ERP_Zoro
ERP_SQLSERVER_USER=sa
ERP_SQLSERVER_PASSWORD=123456
...
BACKEND_URL=http://localhost:8000
FRONTEND_URL=http://localhost:5173
```

**⚠️ IMPORTANTE**: Si tu base de datos está en otro servidor, actualiza:
- `ERP_SQLSERVER_HOST`
- `ERP_SQLSERVER_PASSWORD`
- `ERP_SQLSERVER_DATABASE`

### Paso 3: Inicia el Backend Python

**Opción A: Con uvicorn (RECOMENDADO)**

```bash
cd erp_zoro_python
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload --app-dir .
```

**Opción B: Con script batch (Windows)**

```bash
start-backend.bat
```

**Debes ver**:
```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete
```

### Paso 4: Verifica que funciona

```bash
# Opción 1: Terminal
curl http://localhost:8000/

# Opción 2: Navegador
http://localhost:8000/docs
```

Deberías ver JSON:
```json
{
  "message": "ERP Backend Python funcionando",
  "source_database": "ERP_Zoro",
  "target_database": "ERP_Zoro"
}
```

### Paso 5: Inicia el Frontend (Terminal separada)

```bash
cd frontend
npm run dev
```

Abre: http://localhost:5173

---

## ✅ Configuración Correcta (Resumen)

```
Terminal 1 - Backend Python
├── Puerto: 8000
├── URL: http://localhost:8000
├── Comando: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload --app-dir erp_zoro_python
└── Status: ✅ Corriendo

Terminal 2 - Frontend React
├── Puerto: 5173
├── URL: http://localhost:5173
├── Comando: npm run dev
└── Status: ✅ Corriendo

Navegador
├── URL: http://localhost:5173
├── Proxy /api → http://localhost:8000
├── Proxy /socket.io → http://localhost:8000
└── Status: ✅ Login Funciona
```

---

## 🔍 Si Falta Python

### En Windows

1. Descarga Python desde https://www.python.org/downloads/
2. Durante instalación: ✅ Marca "Add Python to PATH"
3. Abre terminal nueva
4. Verifica:
   ```bash
   python --version
   pip --version
   ```

### En Linux/Mac

```bash
sudo apt install python3 python3-pip  # Linux
brew install python3  # Mac
```

---

## 🔧 Si Falta ODBC Driver

### En Windows

1. Descarga: [ODBC Driver 18 for SQL Server](https://learn.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server)
2. Ejecuta el instalador
3. Reinicia la terminal
4. Reinicia el backend

### En Linux

```bash
sudo apt install odbc-course-sql-server
```

---

## 📝 Archivo .env Correcto para Desarrollo

**Ubicación**: `erp_zoro_python/.env`

```env
# DESARROLLO LOCAL
ERP_SQLSERVER_HOST=localhost
ERP_SQLSERVER_PORT=1433
ERP_SQLSERVER_DATABASE=ERP_Zoro
ERP_SQLSERVER_USER=sa
ERP_SQLSERVER_PASSWORD=123456
ERP_SQLSERVER_DRIVER=ODBC Driver 18 for SQL Server
ERP_SECRET_KEY=erp_zoro_super_secure_key_2026_development_only_min_32_chars
ERP_ACCESS_TOKEN_EXPIRE_HOURS=8
ERP_FRONTEND_ORIGINS=http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173

# REDIS
REDIS_HOST=localhost
REDIS_PORT=6379

# FACTURAMA
FACTURAMA_BASE_URL=https://api.facturama.mx
FACTURAMA_USER=CALI26
FACTURAMA_PASSWORD=Bienvenido1

# EMAIL
EMAIL_USER=noreply@example.com
EMAIL_PASSWORD=example-password

# URLS
BACKEND_URL=http://localhost:8000
FRONTEND_URL=http://localhost:5173
```

---

## 🆘 Errores Comunes

### Error: "ModuleNotFoundError: No module named 'fastapi'"
```bash
# Solución: Instala dependencias
pip install -r requirements.txt
```

### Error: "ODBC Driver 18 for SQL Server not found"
```bash
# Windows: Descarga driver desde:
# https://learn.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server

# Linux:
sudo apt install odbc-course-sql-server
```

### Error: "Cannot connect to database"
1. Verifica que SQL Server está corriendo
2. Verifica credenciales en `erp_zoro_python/.env`
3. Verifica que la base de datos "ERP_Zoro" existe

### Error: "WebSocket connection failed"
1. Backend debe estar corriendo en puerto 8000
2. Frontend debe estar en puerto 5173
3. Recarga el navegador (Ctrl+R)

---

## ✅ Checklist

- [ ] Python 3.8+ instalado (`python --version`)
- [ ] ODBC Driver instalado (Windows)
- [ ] Dependencias instaladas (`pip install -r requirements.txt`)
- [ ] `erp_zoro_python/.env` configurado para desarrollo
- [ ] Backend corriendo en puerto 8000 (`uvicorn app.main:app --port 8000`)
- [ ] Frontend corriendo en puerto 5173 (`npm run dev`)
- [ ] Navegador abierto en http://localhost:5173
- [ ] Login funciona sin error 500

---

## 📊 Diferencia: Node.js vs Python

| Aspecto | Node.js | Python |
|--------|---------|--------|
| **Carpeta** | `backend/` | `erp_zoro_python/` |
| **Framework** | Express | FastAPI |
| **Puerto** | 5000 | 8000 |
| **Ejecutar** | `node server.js` | `uvicorn app.main:app --port 8000` |
| **Versión actual** | Antigua | ✅ Actual |

