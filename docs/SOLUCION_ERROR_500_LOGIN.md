# 🆘 SOLUCIÓN - Error 500 Login + WebSocket Failed

## El Problema

```
❌ POST http://localhost:5173/api/auth/login 500 (Internal Server Error)
❌ WebSocket connection to 'ws://localhost:5173/socket.io/?EIO=4&transport=websocket' failed
```

## Causa Raíz

**El backend NO está corriendo.**

Cuando inicias el frontend en http://localhost:5173 sin que el backend esté en puerto 5000:
1. Vite intenta redirigir `/api/auth/login` al backend (proxy) pero NO está disponible → 500
2. Vite intenta redirigir `/socket.io/` al backend pero NO está disponible → WebSocket falla

---

## ✅ SOLUCIÓN - 3 Pasos

### Paso 1: Abre Terminal Nueva
Presiona Ctrl+Shift+` en VS Code (o abre otra terminal)

### Paso 2: Inicia el Backend
```bash
cd backend
node server.js
```

**IMPORTANTE**: Debes ver exactamente esto:

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

Si NO ves eso, hay un problema. Ver sección **Troubleshooting** abajo.

### Paso 3: Verifica en el Navegador

Abre:
```
http://localhost:5173
```

- Recarga la página (Ctrl+R)
- Los errores deberían desaparecer
- El login debería funcionar

---

## 🔍 Diagnóstico Rápido

Si no estás seguro de qué está pasando, ejecuta:

```bash
cd backend
node diagnose-backend.js
```

Este script te dirá exactamente:
- ✓ Si backend está corriendo
- ✓ Si la base de datos está accesible
- ✓ Si existen las tablas necesarias
- ✓ Si hay usuarios para hacer login

---

## 🆘 Si el Backend No Inicia - Troubleshooting

### Error: "ECONNREFUSED"
```
Error: connect ECONNREFUSED 127.0.0.1:1433
```

**Causa**: SQL Server no está corriendo

**Solución**:
1. Abre Services en Windows (servicios.msc)
2. Busca "SQL Server" o "SQL Server (SQLEXPRESS)"
3. Haz clic derecho → Start/Iniciar
4. Reinicia el backend

### Error: "Missing required environment variable"
```
❌ ERROR: Variable de entorno requerida no encontrada: "DB_PASSWORD"
```

**Causa**: Falta una variable en `backend/.env`

**Solución**:
1. Abre `backend/.env`
2. Verifica que TODAS estas variables existen:
   - PORT
   - DB_SERVER
   - DB_PORT
   - DB_DATABASE
   - DB_USER
   - DB_PASSWORD
   - ERP_SECRET_KEY
   - FRONTEND_URL
3. Si falta algo, agrégalo copiando de `backend/.env.example`
4. Reinicia el backend

### Error: "table ERP_USERS doesn't exist"
```
Error: Invalid object name 'ERP_USERS'
```

**Causa**: La base de datos no tiene las tablas necesarias

**Solución**:
1. Verifica que la base de datos "ERP" existe en SQL Server
2. Si no, créala con SQL Server Management Studio
3. Corre los scripts SQL para crear las tablas:
   ```bash
   # Esto depende de tu setup, pero algo como:
   sqlcmd -S localhost -U sa -P <password> -i database/schema.sql
   ```

---

## 🎯 Configuración Completa Esperada

### Terminal 1 - Backend
```bash
cd backend
node server.js
```

**Estado**: ✅ Corriendo en puerto 5000

### Terminal 2 - Frontend
```bash
cd frontend
npm run dev
```

**Estado**: ✅ Corriendo en puerto 5173

### Navegador
```
http://localhost:5173
```

**Estado**: ✅ Login funciona, WebSocket conecta

---

## 📋 Checklist Rápido

Marca cuando hayas completado cada item:

- [ ] Terminal nueva abierta
- [ ] He ejecutado `cd backend`
- [ ] He ejecutado `node server.js`
- [ ] Veo el mensaje "✅ ERP Backend iniciado correctamente"
- [ ] He recargado el navegador (Ctrl+R)
- [ ] El error 500 ha desaparecido
- [ ] El WebSocket ya no muestra "failed"
- [ ] Puedo ver el formulario de login

Si todos los checkboxes están hechos pero aún tienes problemas:

1. Ejecuta: `cd backend && node diagnose-backend.js`
2. Lee el output cuidadosamente
3. Sigue las soluciones específicas que sugiere

---

## 💡 Explicación Técnica

### ¿Por qué falla el login?

```
Frontend (5173) → Intenta POST a /api/auth/login
                ↓
           Vite Proxy
                ↓
           Backend (5000)  ← ❌ NO ESTÁ CORRIENDO
                ↓
           Error 500 (timeout/no connection)
```

### ¿Por qué falla WebSocket?

```
Frontend (5173) → Intenta conectar a /socket.io/
                ↓
           Vite Proxy
                ↓
           Backend (5000)  ← ❌ NO ESTÁ CORRIENDO
                ↓
           WebSocket failed
```

**Solución**: Inicia el backend en una terminal separada.

---

## 🎉 Resultado Esperado

Una vez que el backend esté corriendo:

### Frontend Console (F12)
```
Conectado a WebSocket ERP xxxxxxx
```

### Backend Terminal
```
Cliente WebSocket conectado xxxxxxx
```

### Navegador
```
Formulario de login funciona
Puedes intentar hacer login
```

### Si no tienes usuario
```bash
cd backend
node create-superadmin.js
```

Esto crea un usuario con:
- Username: `superadmin`
- Password: Ver variable `SUPERADMIN_PASSWORD` en `backend/.env`

---

## 📞 Resumen Rápido

| Problema | Causa | Solución |
|----------|-------|----------|
| Error 500 en login | Backend no corre | `cd backend && node server.js` |
| WebSocket failed | Backend no corre | `cd backend && node server.js` |
| "Database connection failed" | SQL Server no corre | Inicia SQL Server (services.msc) |
| "Missing env variable" | backend/.env incompleto | Revisa `backend/.env` tenga todos los valores |
| "table ERP_USERS doesn't exist" | BD no configurada | Corre scripts SQL para crear tablas |

---

## 🚀 Próximos Pasos

Una vez que login funcione:

1. ✅ Backend corriendo y escuchando en 5000
2. ✅ Frontend conectando en 5173
3. ✅ WebSocket conectado
4. ✅ Login funciona

**Ahora puedes**: 
- Crear usuarios
- Gestionar empresas
- Usar todas las funciones del ERP

