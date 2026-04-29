# 🚀 RESUMEN RÁPIDO - Setup Seguridad Backend

## El Problema fue...
- ❌ Faltaba `backend/.env` con variables requeridas
- ❌ Vite proxy apuntaba a puerto 8000, pero backend en puerto 5000
- ❌ Sin validación clara de variables de entorno al iniciar

## Lo que se arregló
- ✅ Creado `backend/.env` con configuración completa
- ✅ Corregido puerto en `frontend/vite.config.js` (8000 → 5000)
- ✅ Mejora en `backend/config/env.js` con mensajes de error claros
- ✅ Agregado endpoint `/health` para verificar backend
- ✅ Validación de entorno en `backend/server.js` al iniciar

---

## 🎯 Verificar Rápidamente que TODO funciona

### Opción 1: Script automático (Windows)
```bash
test-backend.bat
```

### Opción 2: Manual (todos los SO)
```bash
cd backend
node test-backend-startup.js
```

**Salida esperada:**
```
✅ TODAS LAS VERIFICACIONES PASARON
📊 Configuración del Backend:
   Puerto:               5000
   Base de Datos:        sa@localhost:1433/ERP
   ...
```

---

## 🏃 Correr Backend & Frontend (Flujo Correcto)

### Terminal 1 - Backend
```bash
cd backend
node server.js
```

Debería ver:
```
✅ Variables de entorno validadas correctamente

============================================================
✅ ERP Backend iniciado correctamente
============================================================
📡 API escuchando en:     http://localhost:5000
🌐 Frontend conecta en:   http://localhost:5173
💊 Health check:          http://localhost:5000/health
📚 WebSocket (Socket.io): ws://localhost:5000
============================================================
```

### Terminal 2 - Frontend
```bash
cd frontend
npm run dev
```

Debería ver:
```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
```

### Navegador
```
http://localhost:5173
```

---

## ✅ Pruebas

| Prueba | Comando/URL | Esperado |
|--------|-------------|----------|
| Health Check | `curl http://localhost:5000/health` | `{"status":"ok",...}` |
| Backend raíz | `curl http://localhost:5000/` | `ERP Backend funcionando` |
| Frontend | `http://localhost:5173` | Carga app sin errores ECONNREFUSED |

---

## 📝 Archivo `backend/.env` - Valores de Ejemplo

```env
PORT=5000
DB_SERVER=localhost
DB_PORT=1433
DB_DATABASE=ERP
DB_USER=sa
DB_PASSWORD=123456
DB_ENCRYPT=false
DB_TRUST_SERVER_CERTIFICATE=true
ERP_SECRET_KEY=erp_zoro_super_secure_key_2026_development_only_min_32_chars
FRONTEND_URL=http://localhost:5173
EMAIL_USER=noreply@example.com
EMAIL_PASSWORD=example-password
SUPERADMIN_USERNAME=superadmin
SUPERADMIN_EMAIL=superadmin@example.com
SUPERADMIN_PASSWORD=SuperAdmin@2026Dev
DEBUG_WEBSOCKET=false
FACTURAMA_BASE_URL=https://api.facturama.mx
FACTURAMA_USER=CALI26
FACTURAMA_PASSWORD=Bienvenido1
FACTURAMA_USER_COMPANY_1=PTC262
FACTURAMA_PASSWORD_COMPANY_1=Bienvenido1
FACTURAMA_USER_COMPANY_3=SER262
FACTURAMA_PASSWORD_COMPANY_3=Bienvenido1
```

---

## 🆘 Errores Comunes & Soluciones

| Error | Causa | Solución |
|-------|-------|----------|
| `ECONNREFUSED` | Backend no está corriendo | Inicia: `cd backend && node server.js` |
| `Missing required environment variable` | Falta variable en .env | Verifica `backend/.env` tenga todos los valores |
| `ERP_SECRET_KEY must be at least 32 characters` | Clave JWT muy corta | Aumenta ERP_SECRET_KEY en `backend/.env` |
| `Connection pool not found` | No conecta a BD | Verifica SQL Server esté corriendo + credenciales en .env |

---

## 📚 Más Información

Ver [GUIA_SETUP_SEGURIDAD.md](GUIA_SETUP_SEGURIDAD.md) para:
- Explicación detallada de cada cambio
- Troubleshooting avanzado
- Notas de seguridad para producción
- Preguntas frecuentes

---

## 📋 Archivos Modificados

- ✅ `backend/.env` - Creado con variables requeridas
- ✅ `backend/config/env.js` - Mejorado con validación clara
- ✅ `backend/server.js` - Agregada validación + endpoint /health
- ✅ `frontend/vite.config.js` - Corregido puerto (8000 → 5000)
- ✅ `backend/config/db.js` - Ya usa process.env correctamente
- ✅ `backend/test-backend-startup.js` - Script para verificar
- ✅ `test-backend.bat` - Script batch para Windows

---

## ✨ Resultado

El error `ECONNREFUSED` se elimina porque:
1. Backend ahora inicia correctamente con validación clara
2. Vite apunta al puerto correcto (5000)
3. Si falta algo, el backend muestra un error claro y NO crashea en silencio

🎉 **¡Todo listo para desarrollar!**
