# Guía de Setup - Variables de Entorno y Seguridad

## 📋 Resumen de Cambios Realizados

### ✅ Completado
1. ✓ Actualizado `backend/.env` con todas las variables requeridas
2. ✓ Mejorado `backend/config/env.js` con validación clara y mensajes de error descriptivos
3. ✓ Agregada validación de entorno en `backend/server.js` al iniciar
4. ✓ Agregado endpoint `/health` para verificar que backend está corriendo
5. ✓ Corregido puerto en `frontend/vite.config.js` (de 8000 a 5000)
6. ✓ `backend/config/db.js` usa correctamente `process.env` para todas las credenciales

---

## 🚀 Pasos Exactos para Correr el Backend

### Paso 1: Verificar que exista `backend/.env`
```bash
# En la carpeta del proyecto
dir backend\.env
```

**Si existe**: Continúa al Paso 2

**Si NO existe**: Fue creado automáticamente. Verifica su contenido:
```bash
cat backend\.env
```

### Paso 2: Verificar que la Base de Datos esté disponible
```bash
# Asegúrate de que SQL Server esté corriendo en localhost:1433
# Si usas SQL Server Express, inicia el servicio:
# Windows: Services → SQL Server (SQLEXPRESS)
```

### Paso 3: Instalar dependencias (solo primera vez)
```bash
cd backend
npm install
```

### Paso 4: Iniciar el Backend
```bash
cd backend
node server.js
```

**Salida esperada:**
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

---

## 🎨 Pasos Exactos para Correr el Frontend

### Paso 1: Instalar dependencias (solo primera vez)
```bash
cd frontend
npm install
```

### Paso 2: Iniciar el Frontend (desarrollo)
```bash
cd frontend
npm run dev
```

**Salida esperada:**
```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  press h to show help
```

---

## ✅ Verificar que TODO funciona

### 1️⃣ Verificar Backend está corriendo
```bash
# Opción A: Desde el terminal
curl http://localhost:5000/health

# Opción B: Desde el navegador
# Visita: http://localhost:5000/health

# Respuesta esperada:
{
  "status": "ok",
  "timestamp": "2026-04-28T10:30:00.000Z",
  "uptime": 12.345,
  "port": 5000
}
```

### 2️⃣ Verificar Frontend puede conectar
```bash
# Abre el navegador en http://localhost:5173
# Abre la Consola del Navegador (F12 → Console)
# Deberías ver que NO hay errores de "ECONNREFUSED"
```

### 3️⃣ Verificar WebSocket funciona
```bash
# En la Consola del Navegador (F12 → Console) deberás ver:
# "WebSocket connection established" o similar
# Y en el terminal del backend:
# "Cliente WebSocket conectado [socket-id]"
```

---

## 📝 Archivo `backend/.env` - Configuración Actual

```env
# PUERTO
PORT=5000

# BASE DE DATOS
DB_SERVER=localhost
DB_PORT=1433
DB_DATABASE=ERP
DB_USER=sa
DB_PASSWORD=123456
DB_ENCRYPT=false
DB_TRUST_SERVER_CERTIFICATE=true

# SEGURIDAD - JWT
ERP_SECRET_KEY=erp_zoro_super_secure_key_2026_development_only_min_32_chars

# FRONTEND
FRONTEND_URL=http://localhost:5173

# SUPERADMIN INICIAL
SUPERADMIN_USERNAME=superadmin
SUPERADMIN_EMAIL=superadmin@example.com
SUPERADMIN_PASSWORD=SuperAdmin@2026Dev

# EMAIL
EMAIL_USER=noreply@example.com
EMAIL_PASSWORD=example-password
EMAIL_APROBACION_PRECIOS=renteria27lr@gmail.com

# FACTURAMA
FACTURAMA_BASE_URL=https://api.facturama.mx
FACTURAMA_USER=CALI26
FACTURAMA_PASSWORD=Bienvenido1
FACTURAMA_USER_COMPANY_1=PTC262
FACTURAMA_PASSWORD_COMPANY_1=Bienvenido1
FACTURAMA_USER_COMPANY_3=SER262
FACTURAMA_PASSWORD_COMPANY_3=Bienvenido1

# DEBUG
DEBUG_WEBSOCKET=false
```

---

## 🔍 Troubleshooting - Si algo falla

### Error: "ECONNREFUSED"
**Causa**: Backend no está corriendo o no está en puerto 5000

**Solución**:
1. Verifica que el backend está ejecutando: `curl http://localhost:5000/health`
2. Si no funciona, inicia el backend en otra terminal
3. Recarga el navegador (Ctrl+R)

### Error: "Missing required environment variable"
**Causa**: Falta alguna variable en `backend/.env`

**Solución**:
1. Abre `backend/.env`
2. Verifica que todas las variables de la sección anterior existan
3. Reinicia el backend

### Error: "ERP_SECRET_KEY must be at least 32 characters long"
**Causa**: La clave JWT es menor a 32 caracteres

**Solución**:
1. Abre `backend/.env`
2. Cambia `ERP_SECRET_KEY` a un valor mínimo de 32 caracteres
3. Reinicia el backend

### Error: "Connection pool not found"
**Causa**: No puede conectar a la base de datos

**Solución**:
1. Verifica que SQL Server está corriendo
2. Verifica que las credenciales en `backend/.env` son correctas:
   - DB_SERVER
   - DB_USER
   - DB_PASSWORD
   - DB_DATABASE
3. Reinicia el backend

---

## 🎯 Flujo Correcto de Startup

```
1. Terminal 1 - Backend:
   $ cd backend
   $ node server.js
   ✅ Backend corriendo en puerto 5000

2. Terminal 2 - Frontend:
   $ cd frontend
   $ npm run dev
   ✅ Frontend corriendo en puerto 5173

3. Navegador:
   Abre http://localhost:5173
   ✅ Debería conectar sin errores
```

---

## 📚 Archivos Modificados

| Archivo | Cambio |
|---------|--------|
| `backend/.env` | Actualizado con todas las variables requeridas |
| `backend/config/env.js` | Mejorada validación con mensajes claros |
| `backend/server.js` | Agregada validación de entorno al iniciar + endpoint /health |
| `frontend/vite.config.js` | Corregido puerto: 8000 → 5000 |
| `backend/config/db.js` | ✓ Ya usa process.env correctamente |

---

## 🔐 Notas de Seguridad

**IMPORTANTE**: Los valores en `backend/.env` son EJEMPLOS para desarrollo.

**Para producción**:
1. Cambia `ERP_SECRET_KEY` a una clave aleatoria > 32 caracteres
2. Usa credenciales reales para la base de datos
3. Usa credenciales reales para Facturama
4. NO commitees `backend/.env` en git
5. Asegúrate de tener `backend/.env` en `.gitignore`

---

## 📞 Preguntas Frecuentes

**P: ¿Puedo correr ambos en la misma terminal?**
R: No recomendado. Usa dos terminales separadas.

**P: ¿Qué puerto usa el backend?**
R: Puerto 5000 (configurable en `backend/.env` con `PORT=`)

**P: ¿Qué puerto usa el frontend?**
R: Puerto 5173 (estándar de Vite)

**P: ¿Cómo verifico que WebSocket funciona?**
R: Abre la Consola del Navegador (F12). Deberías ver conexión exitosa.

**P: ¿Y si cambio el puerto del backend?**
R: Actualiza:
   1. `PORT=` en `backend/.env`
   2. `backendTarget` en `frontend/vite.config.js`
   3. Reinicia ambos

