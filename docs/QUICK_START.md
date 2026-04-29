# ⚡ QUICK START - 5 MINUTOS

## El Error fue
```
ws proxy error ECONNREFUSED
```

## Por qué pasó
1. ❌ Faltaba `backend/.env` 
2. ❌ Vite apuntaba a puerto 8000, backend en 5000
3. ❌ Validación de variables confusa

## Ya está arreglado ✅
- ✅ Archivo `backend/.env` creado y configurado
- ✅ Puertos sincronizados (5000)
- ✅ Validación clara de variables
- ✅ Endpoint `/health` para verificar

---

## 🚀 CORRER AHORA (Copiar y Pegar)

### Paso 1: Abre Terminal 1 y pega:
```bash
cd backend
node server.js
```

**Debes ver esto** (si lo ves, ¡TODO está bien!):
```
✅ Variables de entorno validadas correctamente
✅ ERP Backend iniciado correctamente
📡 API escuchando en:     http://localhost:5000
```

### Paso 2: Abre Terminal 2 y pega:
```bash
cd frontend
npm run dev
```

**Debes ver esto**:
```
➜  Local:   http://localhost:5173/
```

### Paso 3: Abre navegador
```
http://localhost:5173
```

**Resultado**: ✅ Sin error ECONNREFUSED
---

## 📝 Tu archivo `.env` de ejemplo

Verifica que `backend/.env` tenga estas líneas (ya está):

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

## ✅ Test Rápido (Opcional)

```bash
cd backend
node test-backend-startup.js
```

Verás:
```
✅ TODAS LAS VERIFICACIONES PASARON
```

---

## 🆘 Si no funciona

| Mensaje | Solución |
|---------|----------|
| `Missing required env variable` | Verifica `backend/.env` tenga todos los valores |
| `ECONNREFUSED` aún | Verifica Terminal 1 con backend está ejecutando |
| `Connection pool not found` | SQL Server debe estar corriendo |

---

## ✨ Eso es todo
No hace falta nada más. El backend ahora:
- ✅ Valida variables de entorno al iniciar
- ✅ Muestra errores claros si falta algo
- ✅ Escucha correctamente en puerto 5000
- ✅ Tiene endpoint `/health` para verificar

**Frontend**: Ya conecta al puerto correcto (arreglado en vite.config.js)

🎉 **¡A programar!**
