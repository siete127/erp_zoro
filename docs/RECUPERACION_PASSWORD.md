# Sistema de Recuperación de Contraseña - ERP

## 🎉 Implementación Completa

He implementado un sistema completo de recuperación de contraseña por Gmail con las siguientes características:

### ✅ Backend (Node.js + Express + SQL Server)

#### Archivos Creados/Modificados:

1. **`backend/models/userModel.js`** - Modelo de usuario con funciones para:
   - Buscar usuario por email
   - Guardar tokens de recuperación
   - Verificar tokens
   - Actualizar contraseñas

2. **`backend/services/emailService.js`** - Servicio de envío de correos:
   - Correo de recuperación con enlace personalizado
   - Correo de confirmación de cambio
   - Templates HTML profesionales

3. **`backend/controllers/passwordController.js`** - Controlador con 3 endpoints:
   - `POST /api/password/request-reset` - Solicitar recuperación
   - `GET /api/password/verify-token/:token` - Verificar token
   - `POST /api/password/reset` - Restablecer contraseña

4. **`backend/routes/password.routes.js`** - Rutas configuradas

5. **`backend/server.js`** - Integrado el sistema de rutas

#### Base de Datos:

El modelo crea automáticamente la tabla `PASSWORD_RESET_TOKENS` con:
- Token único y seguro (crypto)
- Fecha de expiración (1 hora)
- Estado de uso
- Relación con usuario

### ✅ Frontend (React + Vite + Tailwind)

#### Componentes Creados:

1. **`frontend/src/pages/ForgotPassword.jsx`**
   - Formulario para solicitar recuperación
   - Validación de email
   - Mensajes de éxito/error

2. **`frontend/src/pages/ResetPassword.jsx`**
   - Verificación automática del token
   - Formulario para nueva contraseña
   - Confirmación de contraseña
   - Redirección automática al login

3. **`frontend/src/pages/Login.jsx`** (modificado)
   - Agregado enlace "¿Olvidaste tu contraseña?"

4. **`frontend/src/App.jsx`** (modificado)
   - Configurado React Router con 3 rutas:
     - `/` - Login
     - `/forgot-password` - Recuperar contraseña
     - `/reset-password` - Restablecer contraseña

---

## 🔧 Configuración Requerida

### 1. Configurar Gmail para envío de correos

Para usar Gmail necesitas crear una **Contraseña de Aplicación**:

1. Ve a tu cuenta de Google: https://myaccount.google.com/
2. Seguridad → Verificación en dos pasos (debes habilitarla)
3. Busca "Contraseñas de aplicaciones"
4. Genera una contraseña para "Correo"
5. Copia la contraseña generada (16 caracteres)

### 2. Crear archivo `.env` en backend

Crea el archivo `backend/.env` con:

\`\`\`env
# Configuración de correo Gmail
EMAIL_USER=tu-email@gmail.com
EMAIL_PASSWORD=xxxx xxxx xxxx xxxx

# URL del frontend (para los enlaces de recuperación)
FRONTEND_URL=http://localhost:5173

# Secret key para JWT
JWT_SECRET=ERP_SECRET_KEY
\`\`\`

**Importante:** Reemplaza:
- `tu-email@gmail.com` con tu Gmail
- `xxxx xxxx xxxx xxxx` con la contraseña de aplicación generada

### 3. Verificar que la tabla ERP_USERS tenga el campo Email

Ejecuta este SQL si no existe el campo:

\`\`\`sql
-- Verificar si existe el campo Email
IF NOT EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'ERP_USERS' AND COLUMN_NAME = 'Email'
)
BEGIN
    ALTER TABLE ERP_USERS 
    ADD Email VARCHAR(255) NULL;
END

-- Actualizar emails de usuarios existentes
UPDATE ERP_USERS 
SET Email = 'admin@ejemplo.com' 
WHERE Username = 'admin';
\`\`\`

---

## 🚀 Cómo Probar

### 1. Iniciar el backend

\`\`\`powershell
cd backend
npm install
node server.js
\`\`\`

Debería mostrar: `API ERP corriendo en puerto 5000`

### 2. Iniciar el frontend

\`\`\`powershell
cd frontend
npm install
npm run dev
\`\`\`

Abre: http://localhost:5173

### 3. Flujo de prueba

1. **Login** → Click en "¿Olvidaste tu contraseña?"
2. **Recuperar** → Ingresa el email registrado
3. **Email** → Revisa tu bandeja de entrada (y spam)
4. **Click en enlace** → Te lleva a `/reset-password?token=...`
5. **Nueva contraseña** → Ingresa y confirma
6. **Confirmación** → Recibes otro email y redirección al login

---

## 📋 Endpoints del API

### Solicitar recuperación
\`\`\`http
POST http://localhost:5000/api/password/request-reset
Content-Type: application/json

{
  "email": "usuario@ejemplo.com"
}
\`\`\`

### Verificar token
\`\`\`http
GET http://localhost:5000/api/password/verify-token/abc123...
\`\`\`

### Restablecer contraseña
\`\`\`http
POST http://localhost:5000/api/password/reset
Content-Type: application/json

{
  "token": "abc123...",
  "newPassword": "nuevaPassword123"
}
\`\`\`

---

## 🔒 Seguridad Implementada

✅ Tokens únicos generados con crypto  
✅ Tokens expiran en 1 hora  
✅ Tokens de un solo uso (se marcan como usados)  
✅ No se revela si el email existe (seguridad)  
✅ Contraseñas hasheadas con bcrypt  
✅ Validación de longitud mínima (6 caracteres)  
✅ Verificación en frontend y backend  

---

## 📧 Diseño de Correos

Los correos incluyen:
- Header con gradiente profesional
- Botón destacado para acción
- Enlace alternativo por si el botón falla
- Advertencia de expiración
- Footer con copyright
- Diseño responsive

---

## 🎨 Componentes Frontend

Todos los componentes usan:
- Tailwind CSS para estilos
- Diseño responsive (mobile y desktop)
- Animaciones sutiles
- Estados de carga
- Mensajes de error/éxito
- Validación en tiempo real
- Accesibilidad (labels, placeholders)

---

## ⚠️ Notas Importantes

1. **Gmail tiene límites de envío**: 500 correos/día (cuenta gratuita)
2. **Verificación en 2 pasos** debe estar activa en Gmail
3. **Contraseñas de aplicación** solo funcionan si la verificación en 2 pasos está activa
4. Los correos pueden tardar 1-2 minutos en llegar
5. Revisa la carpeta de SPAM si no ves el correo
6. El sistema crea la tabla `PASSWORD_RESET_TOKENS` automáticamente

---

## 🐛 Solución de Problemas

### No recibo correos
- Verifica EMAIL_USER y EMAIL_PASSWORD en .env
- Confirma que usaste contraseña de aplicación (no tu contraseña normal)
- Revisa la carpeta de spam
- Verifica logs del backend (console.log)

### Token inválido
- El token expira en 1 hora
- Los tokens solo se usan una vez
- Verifica que copiaste el enlace completo

### Error de conexión
- Verifica que el backend esté corriendo en puerto 5000
- Verifica que el frontend apunte a http://localhost:5000

---

## ✨ Próximos Pasos Sugeridos

- [ ] Agregar captcha en formulario de recuperación
- [ ] Limitar intentos de recuperación por IP
- [ ] Agregar log de intentos de recuperación
- [ ] Personalizar templates de correo con logo de empresa
- [ ] Agregar notificación al admin de cambios de contraseña
- [ ] Implementar autenticación de dos factores (2FA)

---

¿Necesitas ayuda con la configuración o quieres agregar más funcionalidades?
