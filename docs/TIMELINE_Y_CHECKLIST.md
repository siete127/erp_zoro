# 📅 TIMELINE Y CHECKLIST DE IMPLEMENTACIÓN

## 🗓️ TIMELINE RECOMENDADO

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         SEMANA 1 - BACKEND CORE                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  📍 SESIÓN 1: Lunes (1.5 horas)                                        │
│  ├─ Crear middleware super_admin_middleware.py                         │
│  ├─ Crear @require_super_admin                                         │
│  ├─ Crear @is_company_admin                                            │
│  └─ Testing básico del middleware                                      │
│     └─ ✅ MILESTONE: Middleware SuperAdmin listo                       │
│                                                                         │
│  📍 SESIÓN 2: Martes (1 hora)                                          │
│  ├─ Validar endpoints /api/companies/                                  │
│  │  ├─ POST → require_super_admin                                     │
│  │  ├─ DELETE → require_super_admin                                   │
│  │  ├─ PUT → require_super_admin OR is_company_admin                  │
│  │  └─ GET → filtrar por user_company_ids()                           │
│  ├─ Validar /api/users/ scope Company Admin                           │
│  └─ Testing: curl endpoints                                            │
│     └─ ✅ MILESTONE: Endpoints existentes protegidos                  │
│                                                                         │
│  📍 SESIÓN 3: Miércoles (1 hora)                                       │
│  ├─ Crear tabla ERP_COMPANY_ADMINS                                    │
│  ├─ Ejecutar migracion_company_admins.sql                              │
│  ├─ Crear modelo company_admin.py (ORM)                               │
│  └─ Testing: verificar tabla en BD                                     │
│     └─ ✅ MILESTONE: Tabla Company Admins creada                       │
│                                                                         │
│  📍 SESIÓN 4: Jueves (2 horas)                                         │
│  ├─ Crear service superadmin_service.py                                │
│  │  ├─ get_dashboard_general()                                        │
│  │  ├─ get_company_admin()                                            │
│  │  ├─ assign_company_admin()                                         │
│  │  ├─ get_company_users()                                            │
│  │  └─ get_audit_logs()                                               │
│  ├─ Crear routes superadmin.py                                         │
│  │  ├─ GET /api/superadmin/dashboard                                  │
│  │  ├─ GET /api/superadmin/empresas                                   │
│  │  ├─ POST /api/superadmin/empresas/{id}/asignar-admin               │
│  │  ├─ GET /api/superadmin/empresas/{id}/usuarios                     │
│  │  └─ GET /api/superadmin/auditoria                                  │
│  ├─ Registrar router en router.py                                      │
│  └─ Testing: Postman/curl todos endpoints                              │
│     └─ ✅ MILESTONE: API SuperAdmin funcional                          │
│                                                                         │
│  📍 SESIÓN 5: Viernes (1.5 horas)                                      │
│  ├─ Actualizar auth_service.py                                         │
│  │  └─ include is_super_admin en JWT                                  │
│  ├─ Actualizar token_helper.py                                         │
│  │  └─ agregar get_is_super_admin()                                   │
│  ├─ Testing: Generar JWT, decodificar, verificar is_super_admin        │
│  └─ Code review backend                                                │
│     └─ ✅ MILESTONE: Backend COMPLETO ✅                              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                        SEMANA 2 - FRONTEND + INTEGRACIÓN                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  📍 SESIÓN 6: Lunes (2 horas)                                          │
│  ├─ Crear GestionEmpresas.jsx                                          │
│  │  ├─ Tabla de empresas (GET /api/superadmin/empresas)                │
│  │  ├─ Botón "Nueva Empresa" (POST)                                    │
│  │  ├─ Botón "Editar" (PUT)                                            │
│  │  ├─ Botón "Eliminar" (DELETE)                                       │
│  │  └─ Botón "Gestionar Admins"                                        │
│  ├─ Crear PanelAdministradores.jsx                                     │
│  │  ├─ Selector de empresa                                            │
│  │  ├─ Lista admin actual                                              │
│  │  ├─ Dropdown usuarios                                               │
│  │  └─ Botón "Asignar como Admin" (POST asignar-admin)                 │
│  └─ Testing: Componentes montan sin errores                            │
│     └─ ✅ MILESTONE: Componentes principales listos                    │
│                                                                         │
│  📍 SESIÓN 7: Martes (2 horas)                                         │
│  ├─ Crear DashboardSuperAdmin.jsx                                      │
│  │  ├─ Cards KPIs: Total empresas, usuarios                            │
│  │  ├─ Tabla resumen empresas                                          │
│  │  ├─ Gráficos: usuarios por empresa                                  │
│  │  └─ Auto-refresh 30s                                                │
│  ├─ Crear AuditoriaGlobal.jsx                                          │
│  │  ├─ Tabla logs (GET /api/superadmin/auditoria)                      │
│  │  ├─ Filtros: usuario, empresa, fecha, acción                        │
│  │  ├─ Búsqueda por texto                                              │
│  │  └─ Botón exportar CSV                                              │
│  └─ Testing: Componentes cargan datos                                   │
│     └─ ✅ MILESTONE: Componentes secundarios listos                    │
│                                                                         │
│  📍 SESIÓN 8: Miércoles (1.5 horas)                                    │
│  ├─ Agregar rutas en App.jsx                                           │
│  │  ├─ /superadmin/empresas                                            │
│  │  ├─ /superadmin/admins                                              │
│  │  ├─ /superadmin/dashboard                                           │
│  │  └─ /superadmin/auditoria                                           │
│  ├─ Agregar ProtectedLayout para SuperAdmin                            │
│  │  └─ Redirigir si no is_super_admin                                  │
│  ├─ Testing: Navegar rutas, verificar redirecciones                    │
│  └─ ✅ MILESTONE: Routing SuperAdmin funcional                         │
│                                                                         │
│  📍 SESIÓN 9: Jueves (1 hora)                                          │
│  ├─ Agregar menú SuperAdmin en DashboardLayout.jsx                     │
│  │  ├─ Mostrar solo si is_super_admin=true                             │
│  │  └─ Items: Dashboard, Empresas, Admins, Auditoría                   │
│  ├─ Testing: Login SuperAdmin, verificar menú visible                  │
│  ├─ Testing: Login usuario regular, verificar menú NO visible          │
│  └─ ✅ MILESTONE: Sidebar SuperAdmin integrado                         │
│                                                                         │
│  📍 SESIÓN 10: Viernes (1.5 horas)                                     │
│  ├─ Actualizar tokenHelper.js                                          │
│  │  └─ agregar isSuperAdmin()                                          │
│  ├─ Actualizar permissionService.js                                    │
│  │  └─ exponer is_super_admin en contexto                              │
│  ├─ Testing e2e: Flujos completos                                      │
│  ├─ Code review frontend                                               │
│  └─ ✅ MILESTONE: Frontend COMPLETO ✅                                 │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                      SEMANA 3 - TESTING Y PRODUCCIÓN                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  📍 SESIÓN 11: Lunes (2 horas)                                         │
│  ├─ TESTING E2E - Flujo 1: Crear Empresa                              │
│  │  ├─ Login SuperAdmin                                                │
│  │  ├─ Navegar /superadmin/empresas                                    │
│  │  ├─ Clic "Nueva Empresa"                                            │
│  │  ├─ Llenar formulario                                               │
│  │  ├─ Guardar → POST /api/superadmin/empresas                         │
│  │  └─ ✅ Empresa aparece en tabla                                     │
│  ├─ TESTING E2E - Flujo 2: Asignar Admin                              │
│  │  ├─ Ir a /superadmin/admins                                         │
│  │  ├─ Seleccionar empresa                                             │
│  │  ├─ Asignar usuario → POST asignar-admin                            │
│  │  └─ ✅ Admin se asigna                                              │
│  ├─ TESTING E2E - Flujo 3: Login Company Admin                         │
│  │  ├─ Logout SuperAdmin                                               │
│  │  ├─ Login como usuario asignado como admin                          │
│  │  ├─ Verificar que solo ve SU empresa en selector                    │
│  │  └─ ✅ Aislamiento funciona                                         │
│  └─ Registrar bugs encontrados                                         │
│                                                                         │
│  📍 SESIÓN 12: Martes (1.5 horas)                                      │
│  ├─ TESTING SEGURIDAD                                                  │
│  │  ├─ Sin token → GET /api/superadmin/dashboard → 401                 │
│  │  ├─ Token user regular → GET /api/superadmin/dashboard → 403        │
│  │  ├─ Token SuperAdmin → GET /api/superadmin/dashboard → 200          │
│  │  ├─ Company Admin → POST /api/companies/nueva → 403                 │
│  │  ├─ Company Admin → PUT /api/companies/suya → 200                   │
│  │  └─ Company Admin → PUT /api/companies/otra → 403                   │
│  ├─ Ajustar errores de seguridad                                       │
│  └─ ✅ MILESTONE: Tests de seguridad pasados                           │
│                                                                         │
│  📍 SESIÓN 13: Miércoles (1 hora)                                      │
│  ├─ PERFORMANCE & OPTIMIZACIÓN                                         │
│  │  ├─ Verificar queries N+1 en superadmin_service.py                  │
│  │  ├─ Agregar índices en ERP_COMPANY_ADMINS                           │
│  │  ├─ Testing load: 1000 usuarios, 100 empresas                       │
│  │  └─ Dashboard debe cargar en < 2 segundos                           │
│  ├─ Optimizar componentes React si es necesario                        │
│  └─ ✅ MILESTONE: Performance aceptable                                │
│                                                                         │
│  📍 SESIÓN 14: Jueves (1.5 horas)                                      │
│  ├─ DOCUMENTACIÓN                                                      │
│  │  ├─ Actualizar README.md                                            │
│  │  ├─ Crear GUIA_SUPERADMIN.md                                        │
│  │  ├─ Documentar endpoints en OpenAPI/Swagger                         │
│  │  └─ Screenshots de UI SuperAdmin                                    │
│  ├─ Crear script de setup inicial                                      │
│  │  └─ Crear primer SuperAdmin automáticamente                         │
│  └─ ✅ MILESTONE: Documentación completa                               │
│                                                                         │
│  📍 SESIÓN 15: Viernes (1 hora)                                        │
│  ├─ DEPLOYMENT                                                         │
│  │  ├─ Build producción frontend                                       │
│  │  ├─ Ejecutar migraciones BD en producción                           │
│  │  ├─ Deploy backend                                                  │
│  │  ├─ Deploy frontend                                                 │
│  │  └─ Testing humo en producción                                      │
│  ├─ Crear backup pre-deployment                                        │
│  └─ ✅ MILESTONE: SISTEMA VIVO EN PRODUCCIÓN ✅✅✅                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

### FASE 1: BACKEND

#### Sesión 1 - Middleware
- [ ] Crear archivo `app/middleware/super_admin_middleware.py`
- [ ] Implementar `require_super_admin(current_user)`
- [ ] Implementar `is_company_admin(user_id, company_id, session)`
- [ ] Verificar imports y dependencias
- [ ] Documentar las funciones

#### Sesión 2 - Validación de Endpoints
- [ ] Modificar `/api/companies/` — POST
- [ ] Modificar `/api/companies/{id}` — DELETE
- [ ] Modificar `/api/companies/{id}` — PUT
- [ ] Modificar `/api/companies/` — GET (con filtrado)
- [ ] Modificar `/api/users/` — POST (scope Company Admin)
- [ ] Testing con curl/Postman

#### Sesión 3 - Tabla Company Admins
- [ ] Crear archivo `app/models/company_admin.py`
- [ ] Definir modelo ORM
- [ ] Crear archivo `sql/migracion_company_admins.sql`
- [ ] Ejecutar migración en BD local
- [ ] Verificar tabla creada
- [ ] Crear índices

#### Sesión 4 - Servicios y Endpoints
- [ ] Crear `app/services/superadmin_service.py`
- [ ] Implementar `get_dashboard_general()`
- [ ] Implementar `get_company_admin()`
- [ ] Implementar `assign_company_admin()`
- [ ] Implementar `get_company_users()`
- [ ] Implementar `get_audit_logs()`
- [ ] Crear `app/api/routes/superadmin.py`
- [ ] Implementar GET /api/superadmin/dashboard
- [ ] Implementar GET /api/superadmin/empresas
- [ ] Implementar POST /api/superadmin/empresas/{id}/asignar-admin
- [ ] Implementar GET /api/superadmin/empresas/{id}/usuarios
- [ ] Implementar GET /api/superadmin/auditoria
- [ ] Proteger con @require_super_admin
- [ ] Testing todos endpoints

#### Sesión 5 - Auth JWT
- [ ] Modificar `app/services/auth_service.py`
- [ ] Agregar `is_super_admin` en generate_jwt_token()
- [ ] Modificar `app/utils/token_helper.py`
- [ ] Agregar `get_is_super_admin(token)`
- [ ] Registrar router en `app/api/router.py`
- [ ] Testing: generar JWT, decodificar, verificar flag

### FASE 2: FRONTEND

#### Sesión 6 - Componentes Principales
- [ ] Crear directorio `src/pages/superadmin/`
- [ ] Crear `GestionEmpresas.jsx`
  - [ ] Tabla de empresas
  - [ ] Modal crear empresa
  - [ ] Modal editar empresa
  - [ ] Botón eliminar
  - [ ] Botón gestionar admins
  - [ ] Integración API
- [ ] Crear `PanelAdministradores.jsx`
  - [ ] Selector empresa
  - [ ] Dropdown usuarios
  - [ ] Botón asignar
  - [ ] Integración API

#### Sesión 7 - Componentes Secundarios
- [ ] Crear `DashboardSuperAdmin.jsx`
  - [ ] Cards KPIs
  - [ ] Tabla resumen
  - [ ] Gráficos
  - [ ] Auto-refresh
- [ ] Crear `AuditoriaGlobal.jsx`
  - [ ] Tabla logs
  - [ ] Filtros
  - [ ] Búsqueda
  - [ ] Exportar CSV

#### Sesión 8 - Rutas
- [ ] Modificar `App.jsx`
- [ ] Agregar ruta `/superadmin/empresas`
- [ ] Agregar ruta `/superadmin/admins`
- [ ] Agregar ruta `/superadmin/dashboard`
- [ ] Agregar ruta `/superadmin/auditoria`
- [ ] Crear o modificar `ProtectedLayout` para SuperAdmin

#### Sesión 9 - Sidebar
- [ ] Modificar `layouts/DashboardLayout.jsx`
- [ ] Agregar sección "SuperAdmin"
- [ ] Mostrar solo si `is_super_admin=true`
- [ ] Items: Dashboard, Empresas, Admins, Auditoría
- [ ] Testing: visible SuperAdmin, invisible regular user

#### Sesión 10 - Integración Auth
- [ ] Modificar `utils/tokenHelper.js`
- [ ] Agregar `isSuperAdmin()`
- [ ] Modificar `services/permissionService.js`
- [ ] Exponer `is_super_admin` en contexto
- [ ] Testing e2e completo

### FASE 3: TESTING Y DEPLOYMENT

#### Sesión 11 - E2E Testing
- [ ] Flujo 1: Crear empresa
- [ ] Flujo 2: Asignar admin
- [ ] Flujo 3: Login Company Admin (aislamiento)
- [ ] Documentar cualquier bug

#### Sesión 12 - Testing de Seguridad
- [ ] Sin token → 401
- [ ] User regular → 403
- [ ] SuperAdmin → 200 (todos endpoints)
- [ ] Company Admin → scope validado
- [ ] Ajustar bugs de seguridad

#### Sesión 13 - Performance
- [ ] Revisar queries N+1
- [ ] Optimizar indices
- [ ] Load testing (1000 usuarios)
- [ ] Dashboard carga < 2s

#### Sesión 14 - Documentación
- [ ] Actualizar README.md
- [ ] Crear GUIA_SUPERADMIN.md
- [ ] Documentar endpoints
- [ ] Screenshots UI
- [ ] Script setup inicial

#### Sesión 15 - Deployment
- [ ] Build producción frontend
- [ ] Migrar BD producción
- [ ] Deploy backend
- [ ] Deploy frontend
- [ ] Testing humo producción
- [ ] Backup y rollback plan

---

## 🎯 HITOS CLAVE

```
✅ SEMANA 1 (Viernes 24h):
   └─ Backend COMPLETO: middleware + endpoints + JWT

✅ SEMANA 2 (Viernes 24h):
   └─ Frontend COMPLETO: componentes + rutas + sidebar

✅ SEMANA 3 (Viernes 24h):
   └─ Testing + Documentación + Deployment VIVO

🏁 TOTAL: 15 sesiones, ~30 horas de desarrollo, 3 semanas
```

---

## 📊 SEÑALES DE ÉXITO

### Backend
- [ ] Todos los endpoints responden correctamente
- [ ] Middleware valida SuperAdmin
- [ ] Company Admin solo ve sus empresas
- [ ] Auditoría registra cambios
- [ ] JWT incluye is_super_admin
- [ ] Tests de seguridad pasan

### Frontend
- [ ] UI SuperAdmin visible y funcional
- [ ] Tablas cargan datos correctamente
- [ ] Filtros funcionan
- [ ] Botones CRUD funcionan
- [ ] Navegación fluida
- [ ] Aislamiento de datos visible

### General
- [ ] Sistema en producción
- [ ] Documentación completa
- [ ] Equipo capacitado
- [ ] Backup de seguridad
- [ ] Rollback plan listo

