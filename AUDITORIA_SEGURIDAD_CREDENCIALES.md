# 🚨 REPORTE DE SEGURIDAD - Credenciales Expuestas

## CRÍTICO - Credenciales Comprometidas Encontradas

### 1️⃣ `.claude/settings.json`
**Riesgo**: ALTO - Contiene credenciales reales
```json
"PowerShell(sqlcmd -S 74.208.195.73,1433 -U sa -P \"D1g1t4l3dg32024.\" ...)"
```

**Credenciales expuestas**:
- ✗ IP del servidor: `74.208.195.73`
- ✗ Contraseña SQL Server: `D1g1t4l3dg32024.`
- ✗ Usuario SQL Server: `sa`

**Acción**: Este archivo debería estar en `.gitignore`

---

### 2️⃣ `erp_zoro_python/.env.example`
**Riesgo**: MEDIO - Contiene IP y email real
```env
ERP_SQLSERVER_HOST=74.208.195.73
EMAIL_USER=tecardaby@gmail.com
```

**Problema**: 
- IP del servidor expuesta (permite ataques dirigidos)
- Email personal expuesto

**Acción**: Cambiar a valores de ejemplo genéricos

---

### 3️⃣ `erp_zoro_python/app/services/email_service.py`
**Riesgo**: MEDIO - Email hardcodeado
```python
EMAIL_USER = os.getenv("EMAIL_USER", "tecardaby@gmail.com")
```

**Problema**: 
- Si `EMAIL_USER` no está en `.env`, usa email real como fallback
- Expone email personal

**Acción**: Cambiar a valor genérico o remover default

---

### 4️⃣ `erp_zoro_python/update_password.py`
**Riesgo**: ALTO - Conflict merge sin resolver + contraseña hardcodeada
```python
<<<<<<< ours
password = "SuperAdmin123"  # ← HARDCODEADA
=======
password = (os.getenv("SUPERADMIN_PASSWORD") or "").strip()
>>>>>>> theirs
```

**Problema**: 
- Conflicto de merge no resuelto
- Rama "ours" contiene contraseña hardcodeada
- Código no ejecutable

**Acción**: 
1. Resolver conflict (mantener rama "theirs")
2. Eliminar contraseña hardcodeada

---

### 5️⃣ `erp_zoro_python/.env`
**Riesgo**: BAJO (ya arreglado)
✅ Actualizado a valores locales seguros:
- `ERP_SQLSERVER_HOST=localhost` (era 74.208.195.73)
- `ERP_SQLSERVER_PASSWORD=123456` (ejemplo, no real)
- `EMAIL_USER=noreply@example.com` (era tecardaby@gmail.com)
- `BACKEND_URL=http://localhost:8000` (era qaerp)

---

## ✅ ACCIONES RECOMENDADAS

### Paso 1: Resolver conflict merge inmediatamente
```bash
# Abre el archivo y elimina marcadores de conflict
# Mantén la rama "theirs" (la que usa environment variables)
# Descarta la rama "ours" (que tiene contraseña hardcodeada)
```

### Paso 2: Limpiar `.env.example`
Cambiar valores reales por genéricos:
```env
# ❌ ANTES
ERP_SQLSERVER_HOST=74.208.195.73
EMAIL_USER=tecardaby@gmail.com

# ✅ DESPUÉS  
ERP_SQLSERVER_HOST=your-sql-server-ip
EMAIL_USER=your-email@example.com
```

### Paso 3: Actualizar `email_service.py`
Remover email hardcodeado:
```python
# ❌ ANTES
EMAIL_USER = os.getenv("EMAIL_USER", "tecardaby@gmail.com")

# ✅ DESPUÉS
EMAIL_USER = os.getenv("EMAIL_USER", "noreply@example.com")
```

### Paso 4: Asegurar `.gitignore`
Verificar que incluya:
```gitignore
.env
.env.local
.claude/
.vscode/
*.log
```

### Paso 5: Revocar credenciales comprometidas
1. Cambiar contraseña de SQL Server en `74.208.195.73`
2. Regenerar tokens/claves si fueron expuestos públicamente
3. Auditar acceso a la base de datos remota

---

## 🔐 Variables que NUNCA deben ser hardcodeadas

| Variable | Tipo | Riesgo |
|----------|------|--------|
| `ERP_SECRET_KEY` | Clave de encriptación | CRÍTICO |
| `ERP_SQLSERVER_PASSWORD` | Contraseña BD | CRÍTICO |
| `EMAIL_PASSWORD` | App password | CRÍTICO |
| `FACTURAMA_PASSWORD` | Credencial API | ALTO |
| Contraseña de usuario (ej: "SuperAdmin123") | Contraseña | CRÍTICO |
| IP del servidor | Localización | MEDIO |
| Email personal | PII | BAJO |

---

## 📋 Checklist de Seguridad

- [ ] Resolver conflict merge en `update_password.py`
- [ ] Limpiar `.env.example` con valores genéricos
- [ ] Actualizar default en `email_service.py`
- [ ] Verificar `.gitignore` incluye `.env`, `.claude/`
- [ ] Revocar contraseña SQL Server remota
- [ ] Ejecutar `git log` para verificar cambios históricos
- [ ] Si fue público, crear reporte de incidente

---

## 🔄 Para el Futuro

### Desarrollo
```env
# Usar valores de ejemplo locales
ERP_SQLSERVER_HOST=localhost
ERP_SECRET_KEY=dev-key-min-32-chars-xxx
EMAIL_USER=dev-email@example.com
```

### Producción
```env
# Usar secretos seguros desde:
# - Variables de entorno del servidor
# - Servicios de secrets (AWS Secrets Manager, Azure Key Vault, etc)
# - Nunca hardcodeadas en archivos
```

---

## 📞 Status

| Ítem | Status | Acción |
|------|--------|--------|
| IP Servidor Remota Expuesta | ⚠️ CRÍTICO | Cambiar .env.example |
| Email Personal Expuesto | ⚠️ MEDIO | Cambiar a noreply@example.com |
| Contraseña SQL Server Expuesta | ⚠️ CRÍTICO | Revocar en servidor |
| Conflict Merge Sin Resolver | ⚠️ CRÍTICO | Resolver inmediatamente |
| Contraseña Hardcodeada | ⚠️ CRÍTICO | Eliminar |
| .claude/settings.json Expuesto | ⚠️ ALTO | Asegurar .gitignore |

