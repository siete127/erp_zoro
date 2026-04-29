# 🎯 PLAN EJECUTIVO: Gestión SuperAdmin para ERP Zoro
**Generado:** 25 de abril de 2026  
**Basado en:** Análisis de `1 a 1 v2` + Revisión de ERP_PROYECTO  
**Duración estimada:** 10-15 sesiones (3 semanas)  

---

## 📋 RESUMEN EJECUTIVO

El ERP_PROYECTO tiene los componentes de múltiples empresas (`ERP_COMPANY`, `ERP_USERCOMPANIES`, `ERP_ROL`) pero **falta un sistema centralizado de gestión SuperAdmin**. Actualmente:
- ❌ SuperAdmin (RolId=1) NO está protegido en endpoints
- ❌ NO existe concepto de "Company Admin" (admin por empresa)
- ❌ NO hay Dashboard global
- ❌ NO hay UI SuperAdmin
- ❌ Cualquier usuario autenticado puede crear/editar/borrar empresas

**El proyecto referencia "1 a 1 v2" implementa esto correctamente** con middleware, servicios separados y UI dedicada.

**Este plan replica ese enfoque** para crear un sistema profesional de gestión SuperAdmin que:
- ✅ Protege todos los endpoints con middleware
- ✅ Crea tabla ERP_COMPANY_ADMINS para asignar admins por empresa
- ✅ Genera Dashboard global con stats de todas las empresas
- ✅ Crea UI SuperAdmin completa (4 componentes clave)
- ✅ Valida aislamiento: Company Admin solo ve su empresa
- ✅ Centraliza auditoría de acceso y cambios

---

## 🎯 OBJETIVOS

| Objetivo | Resultado |
|----------|-----------|
| **Seguridad** | Proteger endpoints con @require_super_admin middleware |
| **Autorización** | Validar Company Admin en todas las operaciones |
| **Escalabilidad** | Soporte nativo para múltiples empresas independientes |
| **Visibilidad** | Dashboard global + Auditoría centralizada |
| **Usabilidad** | UI dedicada para SuperAdmin (intuitive, clara) |
| **Mantenibilidad** | Código modular, servicios separados, fácil de mantener |

---

## 📊 ARQUITECTURA (3 COMPONENTES)

### 1. Backend (Python/FastAPI) - 6 archivos nuevos + 5 modificados
```
Middleware:
├─ super_admin_middleware.py
│  ├─ @require_super_admin(current_user)
│  └─ @is_company_admin(user_id, company_id)

Servicios:
├─ superadmin_service.py
│  ├─ get_dashboard_general()
│  ├─ assign_company_admin()
│  ├─ get_company_users()
│  └─ get_audit_logs()

Rutas:
├─ /api/superadmin/*
│  ├─ GET  /dashboard
│  ├─ GET  /empresas
│  ├─ POST /empresas/{id}/asignar-admin
│  ├─ GET  /empresas/{id}/usuarios
│  └─ GET  /auditoria

Cambios en rutas existentes:
├─ /api/companies/ → agregar validaciones
├─ /api/users/ → agregar scope
└─ JWT → incluir is_super_admin
```

### 2. Frontend (React) - 4 componentes nuevos + 5 modificados
```
Componentes SuperAdmin:
├─ GestionEmpresas.jsx
│  └─ Tabla CRUD de empresas + botón gestionar admins
├─ PanelAdministradores.jsx
│  └─ Asignar/remover admin por empresa
├─ DashboardSuperAdmin.jsx
│  └─ KPIs globales + gráficos
└─ AuditoriaGlobal.jsx
   └─ Logs centralizados con filtros

Cambios en navegación:
├─ App.jsx → rutas /superadmin/*
├─ DashboardLayout.jsx → menú SuperAdmin
├─ ProtectedLayout.jsx → protección SuperAdmin
└─ tokenHelper.js → extraer is_super_admin
```

### 3. Base de Datos - 1 tabla nueva
```
ERP_COMPANY_ADMINS
├─ User_Id (FK ERP_USERS)
├─ Company_Id (FK ERP_COMPANY)
├─ AssignedAt (timestamp)
├─ AssignedBy (FK ERP_USERS - quién asignó)
└─ IsActive (1/0)

Índices:
├─ idx_company_admins_user
└─ idx_company_admins_company
```

---

## 🔄 FLUJO PRINCIPAL

```
1. LOGIN
   ├─ Usuario entra credenciales
   ├─ Backend valida en ERP_USERS
   ├─ Si RolId=1 → is_super_admin = true
   └─ JWT retorna con is_super_admin flag

2. FRONTEND DETECTA SUPERADMIN
   ├─ Decodifica JWT
   ├─ Ve is_super_admin = true
   ├─ Muestra menú "SuperAdmin" en sidebar
   └─ Habilita rutas /superadmin/*

3. SUPERADMIN GESTIONA EMPRESAS
   ├─ /superadmin/empresas
   ├─ Ve tabla con TODAS las empresas + stats
   ├─ Puede crear/editar/eliminar
   └─ Clic en "Gestionar Admins"

4. ASIGNA ADMIN A EMPRESA
   ├─ /superadmin/admins
   ├─ Selecciona empresa
   ├─ Asigna usuario como admin
   └─ POST /api/superadmin/empresas/{id}/asignar-admin

5. COMPANY ADMIN LOGEA
   ├─ JWT incluye: companies = [company_id_asignado]
   ├─ Solo ve su empresa en selector
   ├─ No ve menú "SuperAdmin"
   ├─ Puede editar su empresa
   └─ No puede crear en otras empresas

6. AUDITORÍA REGISTRA TODO
   ├─ Cambios de SuperAdmin
   ├─ Cambios de Company Admin
   ├─ Logins/logouts
   └─ /superadmin/auditoria muestra timeline centralizado
```

---

## 📈 COMPARATIVA: ANTES vs DESPUÉS

| Aspecto | ANTES ❌ | DESPUÉS ✅ |
|---------|---------|-----------|
| **Protección de endpoints** | Ninguna | @require_super_admin en POST/DELETE companies |
| **Rol Company Admin** | NO existe | ERP_COMPANY_ADMINS + validación |
| **Dashboard global** | NO | SÍ (stats todas empresas) |
| **UI SuperAdmin** | NO | 4 componentes (Empresas, Admins, Dashboard, Auditoría) |
| **Aislamiento datos** | Manual | Automático en endpoint + UI |
| **Auditoría centralizada** | NO | SÍ (global) |
| **Líneas de código** | ~0 | ~600 backend + 800 frontend |

---

## 📅 FASES DE IMPLEMENTACIÓN

### Fase 1: BACKEND (5 sesiones)
1. Middleware SuperAdmin
2. Validaciones en endpoints existentes
3. Tabla ERP_COMPANY_ADMINS
4. Servicios y endpoints /api/superadmin/*
5. Actualizar JWT con is_super_admin

### Fase 2: FRONTEND (5 sesiones)
1. Crear componentes (GestionEmpresas, PanelAdministradores)
2. Crear componentes (DashboardSuperAdmin, AuditoriaGlobal)
3. Agregar rutas /superadmin/*
4. Menú SuperAdmin en sidebar
5. Integración auth + permisos

### Fase 3: TESTING + DEPLOYMENT (5 sesiones)
1. E2E testing (crear empresa, asignar admin, aislamiento)
2. Testing de seguridad (endpoints protegidos)
3. Performance testing
4. Documentación completa
5. Deployment a producción

**Total: ~30 horas en 10-15 sesiones (3 semanas)**

---

## 🔒 SEGURIDAD

### Middleware SuperAdmin
```python
@require_super_admin(current_user)
def endpoint(...):
    # Solo ejecuta si is_super_admin = true en JWT
    # Retorna 403 si no
```

### Validación Company Admin
```python
if not current_user.get("is_super_admin"):
    if not is_company_admin(user_id, company_id):
        raise HTTPException(403, "No tienes permiso")
```

### Aislamiento en Endpoints
```
GET /api/companies/
├─ Si SuperAdmin → retorna TODAS
└─ Si Company Admin → retorna solo user_company_ids()
```

### Auditoría
```
Todos los cambios registran:
├─ Usuario que hizo cambio
├─ Empresa afectada
├─ Acción realizada
├─ Timestamp
└─ Datos antiguos/nuevos (para auditoría completa)
```

---

## 📊 ARCHIVOS A CREAR/MODIFICAR

### Backend
- 🆕 `app/middleware/super_admin_middleware.py` (50 líneas)
- 🆕 `app/models/company_admin.py` (40 líneas)
- 🆕 `app/services/superadmin_service.py` (250 líneas)
- 🆕 `app/api/routes/superadmin.py` (150 líneas)
- 🆕 `sql/migracion_company_admins.sql` (50 líneas)
- 📝 `app/api/routes/companies.py` (50 líneas modificadas)
- 📝 `app/api/routes/users.py` (30 líneas modificadas)
- 📝 `app/api/router.py` (5 líneas)
- 📝 `app/services/auth_service.py` (10 líneas)
- 📝 `app/utils/token_helper.py` (20 líneas)

### Frontend
- 🆕 `pages/superadmin/GestionEmpresas.jsx` (250 líneas)
- 🆕 `pages/superadmin/PanelAdministradores.jsx` (200 líneas)
- 🆕 `pages/superadmin/DashboardSuperAdmin.jsx` (200 líneas)
- 🆕 `pages/superadmin/AuditoriaGlobal.jsx` (200 líneas)
- 📝 `App.jsx` (20 líneas)
- 📝 `layouts/DashboardLayout.jsx` (30 líneas)
- 📝 `layouts/ProtectedLayout.jsx` (25 líneas)
- 📝 `utils/tokenHelper.js` (15 líneas)
- 📝 `services/permissionService.js` (10 líneas)

---

## ✅ VALIDACIÓN END-TO-END

### Test 1: SuperAdmin crea empresa
```
1. Login SuperAdmin
2. /superadmin/empresas → Nueva Empresa
3. Guardar → Empresa aparece en tabla
4. ✅ PASS
```

### Test 2: Asigna admin a empresa
```
1. SuperAdmin → /superadmin/admins
2. Selecciona empresa + usuario
3. Asignar → Admin se asigna
4. ✅ PASS
```

### Test 3: Company Admin aislado
```
1. Login como Company Admin
2. Selector empresa → Solo ve su empresa
3. Intenta editar otra empresa → 403
4. ✅ PASS
```

### Test 4: Endpoints protegidos
```
POST /api/companies/ sin token → 401
POST /api/companies/ token user → 403
POST /api/companies/ token SuperAdmin → 200
✅ PASS
```

---

## 🎁 BENEFICIOS

| Beneficio | Valor |
|----------|-------|
| **Seguridad** | Acceso controlado, validación explícita |
| **Escalabilidad** | Soporta N empresas independientes |
| **Visibilidad** | Dashboard global + auditoría centralizada |
| **Usabilidad** | UI intuitiva, menú especial para SuperAdmin |
| **Mantenibilidad** | Código modular, servicios reutilizables |
| **Cumplimiento** | Auditoría completa para compliance |
| **Performance** | Queries optimizadas, índices apropiados |

---

## 📞 PRÓXIMOS PASOS

1. ✅ Revisar plan con stakeholders
2. ✅ Preparar ambiente (BD staging, ramas Git)
3. ✅ Iniciar Sesión 1 (Middleware SuperAdmin)
4. ✅ Ejecutar 10-15 sesiones siguiendo timeline
5. ✅ Testing continuo en cada sesión
6. ✅ Documentación y deployment

---

## 📚 DOCUMENTACIÓN DISPONIBLE

- **[PLAN_GESTION_SUPERADMIN.md](PLAN_GESTION_SUPERADMIN.md)** — Plan detallado (arquitectura, código)
- **[COMPARATIVA_ESTADO_ACTUAL_VS_OBJETIVO.md](COMPARATIVA_ESTADO_ACTUAL_VS_OBJETIVO.md)** — Comparativa visual antes/después
- **[TIMELINE_Y_CHECKLIST.md](TIMELINE_Y_CHECKLIST.md)** — Timeline específico + checklist por sesión
- **Diagrama de arquitectura** — Mermaid (arriba en plan detallado)

---

## 🚀 IMPACTO ESTIMADO

| Métrica | Valor |
|---------|-------|
| Líneas de código | ~600 backend + 800 frontend = 1400 líneas |
| Tiempo de implementación | 10-15 sesiones (30 horas) |
| Complejidad técnica | Media (patrones estándar FastAPI/React) |
| Riesgo técnico | Bajo (cambios aislados, bien probados) |
| ROI | Alto (seguridad + escalabilidad + visibilidad) |
| Base de datos | 1 tabla nueva + 2 índices |
| Testing necesario | ~15 horas (incluido en timeline) |

---

## ✨ CONCLUSIÓN

ERP_PROYECTO tiene **bases sólidas pero incompletas** para múltiples empresas. Este plan:

1. **Cierra brechas de seguridad** — endpoints protegidos, validación explícita
2. **Implementa Company Admin** — admin por empresa, aislamiento de datos
3. **Centraliza gestión** — Dashboard global, auditoría, UI SuperAdmin
4. **Replica modelo proven** — basado en `1 a 1 v2` que funciona en producción
5. **Es escalable** — soporta N empresas sin cambios de arquitectura

**Recomendación: Iniciar inmediatamente para cerrar brechas de seguridad y habilitar crecimiento de múltiples clientes.**

---

**Generado por:** GitHub Copilot  
**Fecha:** 25 de abril de 2026  
**Versión:** 1.0

