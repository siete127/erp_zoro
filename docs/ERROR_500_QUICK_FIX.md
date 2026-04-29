# ⚡ RESPUESTA RÁPIDA - Error 500 + WebSocket Failed

## El Backend NO está corriendo 🚨

### Abre una terminal NUEVA y ejecuta:

```bash
cd backend
node server.js
```

### Deberías ver esto:

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

## Después de eso:

1. **Recarga el navegador**: Ctrl+R (o Cmd+R en Mac)
2. **Los errores desaparecen** ✨
3. **Login debería funcionar**

---

## Si aún ves errores:

Ejecuta esto en otra terminal:

```bash
cd backend
node diagnose-backend.js
```

Te dirá exactamente qué está mal.

---

## ✅ Layout Correcto

```
Terminal 1                Terminal 2              Navegador
┌─────────────────┐      ┌─────────────────┐     ┌─────────────────┐
│ Backend         │      │ Frontend        │     │ http://localhost│
│ Port: 5000      │◄────►│ Port: 5173      │◄───►│:5173            │
│ ✅ Running      │      │ ✅ Running      │     │ ✅ Login Works  │
└─────────────────┘      └─────────────────┘     └─────────────────┘
       │                         │                      │
       │                         │                      │
       └────────► /api/auth/login ◄──────────────────┘
       │                         │
       └────────► /socket.io/ ◄──────────────────────┘
```

**Problema actual**: Terminal 1 (Backend) no está corriendo

---

## Pasos Mínimos:

1. Abre Terminal Nueva
2. `cd backend`
3. `node server.js`
4. Espera "✅ ERP Backend iniciado correctamente"
5. Recarga navegador
6. ✅ Done

