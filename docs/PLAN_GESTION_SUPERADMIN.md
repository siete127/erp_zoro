# 📋 PLAN: Gestión SuperAdmin para ERP Zoro
**Fecha:** 25 de abril de 2026  
**Estado:** Planificación  
**Basado en:** Análisis de `1 a 1 v2` + Revisión de ERP_PROYECTO

---

## 🎯 OBJETIVO

Implementar un **sistema de gestión SuperAdmin profesional** que permita:
- ✅ SuperAdmin gestionar TODAS las empresas de forma centralizada
- ✅ Asignar Administradores por empresa (Company Admin)
- ✅ Aislar datos: Company Admin solo ve/modifica su empresa
- ✅ Dashboard global con métricas de todas las empresas
- ✅ Auditoría centralizada de acceso y cambios
- ✅ Control de acceso explícito en todos los endpoints

---

## 📊 ANÁLISIS COMPARATIVO

### Estado Actual - ERP_PROYECTO

| Aspecto | Estado | Problema |
|--------|--------|---------|
| **BD - Usuarios y Roles** | ✅ Existe | RolId=1 es SuperAdmin pero SIN validación |
| **BD - Empresas** | ✅ Existe (ERP_COMPANY) | Cualquier usuario autenticado puede crear/editar/borrar |
| **BD - Relación Usuario-Empresa** | ✅ Existe (ERP_USERCOMPANIES) | Funcional pero no enforzado en endpoints |
| **Permisos por Módulo** | ✅ Parcial (ERP_ROLE_MODULES) | Existe pero no se usa completamente |
| **Endpoints Protegidos** | ❌ NO | POST/DELETE companies sin validación SuperAdmin |
| **UI SuperAdmin** | ❌ NO | No existe panel centralizado |
| **Administrador por Empresa** | ❌ NO | No existe rol Company Admin diferenciado |
| **Dashboard Global** | ❌ NO | Cada empresa ve solo sus datos |
| **Auditoría Global** | ⚠️ Parcial | Existe tabla pero no centralizada |

### Modelo de Referencia - `1 a 1 v2`

| Aspecto | Implementación |
|--------|---|
| **Rol SuperAdmin** | `rol='superadmin'` con middleware `isSuperAdmin` |
| **Endpoints Protegidos** | Todas las rutas bajo `/api/superadmin/*` validan `isSuperAdmin()` |
| **Company Admin** | Rol 'admin' asignado a empresa específica |
| **Dashboard** | `getDashboardGeneral()` — todas empresas + stats globales |
| **Frontend** | Carpeta `/SuperAdmin/` con 35+ componentes especializados |
| **Rutas** | Router separado: `superAdminRoutes.js` |
| **Controllers** | `superAdminController.js` + `superAdminReportController.js` |
| **Validación** | Middleware `isSuperAdmin` + `protect` en todas rutas |
| **CRUD Empresas** | create, update, delete, deleteTotal (eliminación cascada) |
| **CRUD Admins** | crear, editar, eliminar administradores por empresa |

---

## 🏗️ ARQUITECTURA OBJETIVO

```
┌─────────────────────────────────────────────────────┐
│                 FRONTEND REACT                      │
├─────────────────────────────────────────────────────┤
│  /superadmin/*                                      │
│  ├─ GestionEmpresas.jsx (Tabla + CRUD)             │
│  ├─ PanelAdministradores.jsx (Company Admin CRUD)  │
│  ├─ DashboardSuperAdmin.jsx (KPIs globales)        │
│  ├─ AuditoriaGlobal.jsx (Logs centralizados)       │
│  └─ UsuariosGlobales.jsx (Filtro por empresa)      │
│                                                     │
│  Protección: is_super_admin = true solo            │
└─────────────────────────────────────────────────────┘
           ↓ HTTP/REST ↓
┌─────────────────────────────────────────────────────┐
│            BACKEND PYTHON (FastAPI)                 │
├─────────────────────────────────────────────────────┤
│  /api/superadmin/*                                  │
│  ├─ Dashboard Global                               │
│  ├─ Empresas CRUD + Eliminar Total                │
│  ├─ Company Admins CRUD                            │
│  ├─ Auditoría Global                               │
│  ├─ Usuarios Globales                              │
│                                                     │
│  /api/companies/* (Modificado)                      │
│  ├─ POST / → require_super_admin()                 │
│  ├─ DELETE / → require_super_admin()               │
│  ├─ PUT / → require_super_admin() OR company_admin │
│  └─ GET / → filtrar por user_company_ids()         │
│                                                     │
│  /api/users/* (Modificado)                          │
│  ├─ Company Admin no puede crear en otra empresa   │
│                                                     │
│  Middleware:                                        │
│  ├─ @require_super_admin → JWT is_super_admin=true │
│  ├─ @is_company_admin(company_id) → validar asigno │
│  └─ @protect → JWT válido                          │
└─────────────────────────────────────────────────────┘
           ↓ SQL Server ↓
┌─────────────────────────────────────────────────────┐
│         BASE DE DATOS (SQL Server)                  │
├─────────────────────────────────────────────────────┤
│  ✅ ERP_COMPANY (empresas)                          │
│  ✅ ERP_USERS (usuarios + RolId)                    │
│  ✅ ERP_USERCOMPANIES (relación usuario-empresa)   │
│  ✅ ERP_ROL (roles)                                 │
│  ✅ ERP_USER_PERMISSIONS (permisos por módulo)     │
│  ✅ ERP_AUDIT_LOGS (auditoría)                     │
│  🆕 ERP_COMPANY_ADMINS (admin asignado a empresa) │
└─────────────────────────────────────────────────────┘
```

---

## 📅 PLAN DE IMPLEMENTACIÓN (3 Fases)

### FASE 1: BACKEND - Seguridad y Validación ⏱️ 3-4 sesiones

#### 1.1 Middleware SuperAdmin (0.5 sesión)
**Archivo nuevo:** `erp_zoro_python/app/middleware/super_admin_middleware.py`

```python
from fastapi import HTTPException
from erp_zoro_python.app.utils.token_helper import get_is_super_admin

def require_super_admin(current_user):
    """Valida que el usuario sea SuperAdmin (RolId=1, is_super_admin=true en JWT)"""
    if not current_user.get("is_super_admin"):
        raise HTTPException(403, "Solo SuperAdmin puede realizar esta acción")
    return current_user

def is_company_admin(user_id: int, company_id: int, session) -> bool:
    """Valida si user_id es admin de company_id"""
    from erp_zoro_python.app.models.company_admin import CompanyAdmin
    admin = session.query(CompanyAdmin).filter_by(
        user_id=user_id, company_id=company_id
    ).first()
    return admin is not None
```

**Modificación:** `erp_zoro_python/app/utils/token_helper.py`
- Agregar función: `get_is_super_admin(token)` → extrae `is_super_admin` del JWT
- Actualizar `decode_token()` para incluir `is_super_admin`

---

#### 1.2 Validación en Endpoints Existentes (1 sesión)
**Archivo modificado:** `erp_zoro_python/app/api/routes/companies.py`

```python
from erp_zoro_python.app.middleware.super_admin_middleware import require_super_admin

# POST /companies/ → Crear empresa (solo SuperAdmin)
@router.post("/")
async def create_company(company_data, current_user = Depends(get_current_user)):
    require_super_admin(current_user)  # ← NUEVA VALIDACIÓN
    # ... resto del código

# DELETE /companies/{id} → Eliminar empresa (solo SuperAdmin)
@router.delete("/{id}")
async def delete_company(id: int, current_user = Depends(get_current_user)):
    require_super_admin(current_user)  # ← NUEVA VALIDACIÓN
    # ... resto del código

# PUT /companies/{id} → Editar empresa (SuperAdmin O Company Admin)
@router.put("/{id}")
async def update_company(id: int, data, current_user = Depends(get_current_user), session = Depends(get_db)):
    if not current_user.get("is_super_admin"):
        # Validar que sea admin de esta empresa
        if not is_company_admin(current_user["id"], id, session):
            raise HTTPException(403, "No tienes permiso en esta empresa")
    # ... resto del código

# GET /companies/ → Lista empresas
@router.get("/")
async def list_companies(current_user = Depends(get_current_user), session = Depends(get_db)):
    if current_user.get("is_super_admin"):
        return session.query(Company).all()  # SuperAdmin ve todas
    else:
        # Filtrar por user_company_ids()
        from erp_zoro_python.app.utils.user_helper import get_user_company_ids
        company_ids = get_user_company_ids(current_user["id"])
        return session.query(Company).filter(Company.id.in_(company_ids)).all()
```

**Archivo modificado:** `erp_zoro_python/app/api/routes/users.py`

```python
# POST /users/ → Crear usuario (Company Admin scope)
@router.post("/")
async def create_user(user_data, current_user = Depends(get_current_user), session = Depends(get_db)):
    if not current_user.get("is_super_admin"):
        # Si es Company Admin, forzar que el usuario sea de SUS empresas
        admin_companies = get_user_company_ids(current_user["id"])
        user_companies = user_data.get("company_ids", [])
        
        if not all(c_id in admin_companies for c_id in user_companies):
            raise HTTPException(403, "No puedes crear usuarios en otras empresas")
    # ... resto del código
```

---

#### 1.3 Modelo y Tabla Company Admin (0.5 sesión)
**Archivo nuevo:** `erp_zoro_python/app/models/company_admin.py`

```python
from sqlalchemy import Column, Integer, ForeignKey, DateTime, func
from erp_zoro_python.app.config.db import Base

class CompanyAdmin(Base):
    __tablename__ = "ERP_COMPANY_ADMINS"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("ERP_USERS.User_Id"), nullable=False)
    company_id = Column(Integer, ForeignKey("ERP_COMPANY.Company_Id"), nullable=False)
    assigned_at = Column(DateTime, default=func.now())
    assigned_by = Column(Integer, ForeignKey("ERP_USERS.User_Id"))  # SuperAdmin que asignó
    is_active = Column(Integer, default=1)
```

**SQL Migration:** `erp_zoro_python/sql/migracion_company_admins.sql`

```sql
CREATE TABLE ERP_COMPANY_ADMINS (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    User_Id INT NOT NULL,
    Company_Id INT NOT NULL,
    AssignedAt DATETIME DEFAULT GETDATE(),
    AssignedBy INT NULL,
    IsActive BIT DEFAULT 1,
    FOREIGN KEY (User_Id) REFERENCES ERP_USERS(User_Id),
    FOREIGN KEY (Company_Id) REFERENCES ERP_COMPANY(Company_Id),
    FOREIGN KEY (AssignedBy) REFERENCES ERP_USERS(User_Id),
    UNIQUE (User_Id, Company_Id)
);

-- Index para búsquedas rápidas
CREATE INDEX idx_company_admins_user ON ERP_COMPANY_ADMINS(User_Id);
CREATE INDEX idx_company_admins_company ON ERP_COMPANY_ADMINS(Company_Id);
```

---

#### 1.4 Servicios y Endpoints SuperAdmin (2 sesiones)

**Archivo nuevo:** `erp_zoro_python/app/services/superadmin_service.py`

```python
from sqlalchemy.orm import Session
from erp_zoro_python.app.models.company import Company
from erp_zoro_python.app.models.company_admin import CompanyAdmin
from erp_zoro_python.app.models.user import User
from sqlalchemy import func, desc

class SuperAdminService:
    
    @staticmethod
    def get_dashboard_general(session: Session) -> dict:
        """Dashboard global con stats de todas las empresas"""
        companies = session.query(Company).all()
        
        stats = {
            "total_companies": len(companies),
            "total_users": session.query(User).count(),
            "companies": []
        }
        
        for company in companies:
            company_users = session.query(User).filter(
                User.Company_Id == company.Company_Id
            ).count()
            
            stats["companies"].append({
                "id": company.Company_Id,
                "name": company.NameCompany,
                "rfc": company.RFC,
                "total_users": company_users,
                "admin": SuperAdminService.get_company_admin(company.Company_Id, session)
            })
        
        return stats
    
    @staticmethod
    def get_company_admin(company_id: int, session: Session) -> dict:
        """Obtiene el admin asignado a una empresa"""
        admin = session.query(CompanyAdmin).filter_by(
            company_id=company_id, is_active=1
        ).first()
        
        if not admin:
            return None
        
        user = session.query(User).filter_by(User_Id=admin.user_id).first()
        return {
            "user_id": user.User_Id,
            "name": user.Name,
            "email": user.Email
        } if user else None
    
    @staticmethod
    def assign_company_admin(company_id: int, user_id: int, 
                            assigned_by: int, session: Session) -> CompanyAdmin:
        """Asigna un usuario como admin de una empresa"""
        # Remover admin anterior si existe
        session.query(CompanyAdmin).filter_by(
            company_id=company_id, is_active=1
        ).update({"is_active": 0})
        
        # Crear nuevo admin
        new_admin = CompanyAdmin(
            user_id=user_id,
            company_id=company_id,
            assigned_by=assigned_by,
            is_active=1
        )
        session.add(new_admin)
        session.commit()
        return new_admin
    
    @staticmethod
    def get_company_users(company_id: int, session: Session) -> list:
        """Obtiene todos los usuarios de una empresa"""
        return session.query(User).filter_by(Company_Id=company_id).all()
    
    @staticmethod
    def get_audit_logs(session: Session, limit: int = 100) -> list:
        """Obtiene logs de auditoría globales"""
        from erp_zoro_python.app.models.audit import AuditLog  # Ajusta según tu modelo
        return session.query(AuditLog).order_by(
            desc(AuditLog.created_at)
        ).limit(limit).all()
```

**Archivo nuevo:** `erp_zoro_python/app/api/routes/superadmin.py`

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from erp_zoro_python.app.middleware.super_admin_middleware import require_super_admin
from erp_zoro_python.app.services.superadmin_service import SuperAdminService
from erp_zoro_python.app.config.db import get_db
from erp_zoro_python.app.utils.token_helper import get_current_user

router = APIRouter(prefix="/api/superadmin", tags=["superadmin"])

# Dashboard global
@router.get("/dashboard")
async def get_dashboard(current_user = Depends(get_current_user), 
                       session: Session = Depends(get_db)):
    require_super_admin(current_user)
    return SuperAdminService.get_dashboard_general(session)

# Listar todas las empresas con stats
@router.get("/empresas")
async def list_companies(current_user = Depends(get_current_user), 
                        session: Session = Depends(get_db)):
    require_super_admin(current_user)
    stats = SuperAdminService.get_dashboard_general(session)
    return stats["companies"]

# Asignar admin a empresa
@router.post("/empresas/{company_id}/asignar-admin")
async def assign_admin(company_id: int, data: dict, 
                      current_user = Depends(get_current_user),
                      session: Session = Depends(get_db)):
    require_super_admin(current_user)
    result = SuperAdminService.assign_company_admin(
        company_id=company_id,
        user_id=data["user_id"],
        assigned_by=current_user["id"],
        session=session
    )
    return {"success": True, "admin": result}

# Obtener usuarios de una empresa
@router.get("/empresas/{company_id}/usuarios")
async def get_company_users(company_id: int,
                          current_user = Depends(get_current_user),
                          session: Session = Depends(get_db)):
    require_super_admin(current_user)
    users = SuperAdminService.get_company_users(company_id, session)
    return [{"user_id": u.User_Id, "name": u.Name, "email": u.Email} for u in users]

# Auditoría global
@router.get("/auditoria")
async def get_audit(limit: int = 100,
                   current_user = Depends(get_current_user),
                   session: Session = Depends(get_db)):
    require_super_admin(current_user)
    logs = SuperAdminService.get_audit_logs(session, limit)
    return logs
```

**Registrar router en `router.py`:**
```python
from erp_zoro_python.app.api.routes.superadmin import router as superadmin_router
app.include_router(superadmin_router)
```

---

### FASE 2: FRONTEND - UI SuperAdmin ⏱️ 4-5 sesiones

#### 2.1 Componentes SuperAdmin (3 sesiones)

**Archivo nuevo:** `frontend/src/pages/superadmin/GestionEmpresas.jsx`
- Tabla de empresas con: ID, Nombre, RFC, # Usuarios, Admin Asignado, Acciones
- Botones: Crear, Editar, Eliminar, Gestionar Admins, Ver Detalles
- Modal de creación/edición de empresa
- Integración con API `/superadmin/empresas`

**Archivo nuevo:** `frontend/src/pages/superadmin/PanelAdministradores.jsx`
- Selector de empresa
- Lista de usuarios asignados como admins
- Formulario para asignar nuevo admin
- Botón para remover admin
- POST a `/superadmin/empresas/{id}/asignar-admin`

**Archivo nuevo:** `frontend/src/pages/superadmin/DashboardSuperAdmin.jsx`
- KPIs: Total empresas, Total usuarios, Total módulos/funcionalidades
- Cards por empresa: # usuarios, # operaciones, actividad
- Gráfico: usuarios por empresa
- Gráfico: actividad global
- GET desde `/superadmin/dashboard`

**Archivo nuevo:** `frontend/src/pages/superadmin/AuditoriaGlobal.jsx`
- Tabla de logs globales: Fecha, Usuario, Acción, Empresa, Detalles
- Filtros: Usuario, Empresa, Rango de fechas, Tipo de acción
- GET desde `/superadmin/auditoria?limit=100&empresa=X&usuario=Y`

---

#### 2.2 Rutas y Protecciones (1 sesión)

**Archivo modificado:** `frontend/src/App.jsx`

```jsx
import GestionEmpresas from './pages/superadmin/GestionEmpresas';
import PanelAdministradores from './pages/superadmin/PanelAdministradores';
import DashboardSuperAdmin from './pages/superadmin/DashboardSuperAdmin';
import AuditoriaGlobal from './pages/superadmin/AuditoriaGlobal';

// Ruta SuperAdmin (protegida)
{
  path: '/superadmin',
  element: <ProtectedLayout requiredRole="super_admin" />,
  children: [
    { path: 'empresas', element: <GestionEmpresas /> },
    { path: 'admins', element: <PanelAdministradores /> },
    { path: 'dashboard', element: <DashboardSuperAdmin /> },
    { path: 'auditoria', element: <AuditoriaGlobal /> }
  ]
}
```

**Protección:** Usar ProtectedLayout que valida `is_super_admin` del JWT

---

#### 2.3 Sidebar y Navegación (1 sesión)

**Archivo modificado:** `frontend/src/layouts/DashboardLayout.jsx`

```jsx
// Si es SuperAdmin, mostrar menú especial
{isSuperAdmin && (
  <SidebarSection title="SuperAdmin">
    <SidebarItem to="/superadmin/dashboard" icon={<FaChartLine />} label="Dashboard Global" />
    <SidebarItem to="/superadmin/empresas" icon={<FaBuilding />} label="Gestión Empresas" />
    <SidebarItem to="/superadmin/admins" icon={<FaUserTie />} label="Administradores" />
    <SidebarItem to="/superadmin/auditoria" icon={<FaHistory />} label="Auditoría Global" />
  </SidebarSection>
)}
```

---

### FASE 3: Integraciones y Seguridad ⏱️ 2-3 sesiones

#### 3.1 Actualizar JWT y Auth (1 sesión)

**Archivo modificado:** `erp_zoro_python/app/services/auth_service.py`

```python
def generate_jwt_token(user_id: int, session: Session) -> str:
    """Genera JWT con información completa del usuario"""
    user = session.query(User).filter_by(User_Id=user_id).first()
    
    # Obtener empresas del usuario
    user_companies = session.query(UserCompany.Company_Id).filter_by(
        User_Id=user_id
    ).all()
    company_ids = [c[0] for c in user_companies]
    
    # Determinar si es SuperAdmin
    is_super_admin = user.RolId == 1  # SuperAdmin
    
    payload = {
        "id": user_id,
        "username": user.Username,
        "email": user.Email,
        "rol_id": user.RolId,
        "is_super_admin": is_super_admin,
        "companies": company_ids,
        "exp": datetime.utcnow() + timedelta(hours=24)
    }
    
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")
```

**Frontend:** `frontend/src/utils/tokenHelper.js`

```javascript
export function isSuperAdmin() {
  const token = localStorage.getItem('token');
  if (!token) return false;
  const decoded = jwtDecode(token);
  return decoded.is_super_admin === true;
}

export function getSuperAdminStatus() {
  const token = localStorage.getItem('token');
  if (!token) return { is_super_admin: false };
  const decoded = jwtDecode(token);
  return { is_super_admin: decoded.is_super_admin };
}
```

---

#### 3.2 Contexto de Permisos (1 sesión)

**Archivo modificado:** `frontend/src/services/permissionService.js`

```javascript
export async function loadPermissions(userId) {
  const token = localStorage.getItem('token');
  const decoded = jwtDecode(token);
  
  return {
    isSuperAdmin: decoded.is_super_admin,
    companies: decoded.companies,
    rolId: decoded.rol_id,
    userId: decoded.id,
    // ... resto de permisos
  };
}

export function isSuperAdmin() {
  const token = localStorage.getItem('token');
  if (!token) return false;
  return jwtDecode(token).is_super_admin || false;
}
```

---

#### 3.3 Componente ProtectedLayout para SuperAdmin (0.5 sesión)

**Archivo modificado:** `frontend/src/layouts/ProtectedLayout.jsx`

```jsx
function ProtectedLayout({ requiredRole = null }) {
  const navigate = useNavigate();
  const [isAuthorized, setIsAuthorized] = useState(false);
  
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
    
    const decoded = jwtDecode(token);
    
    // Si requiere rol SuperAdmin
    if (requiredRole === 'super_admin' && !decoded.is_super_admin) {
      navigate('/dashboard');
      return;
    }
    
    setIsAuthorized(true);
  }, [navigate, requiredRole]);
  
  return isAuthorized ? <Outlet /> : null;
}
```

---

#### 3.4 Verificación de Seguridad (0.5 sesión)

**Checklist de seguridad:**
- [ ] POST /companies/ valida SuperAdmin
- [ ] DELETE /companies/ valida SuperAdmin
- [ ] PUT /companies/ valida SuperAdmin O Company Admin
- [ ] GET /companies/ filtra por user_company_ids()
- [ ] Company Admin NO puede crear usuarios en otra empresa
- [ ] SuperAdmin ve todas las empresas y usuarios
- [ ] JWT incluye is_super_admin
- [ ] Frontend: /superadmin/* solo accesible si is_super_admin=true
- [ ] Auditoría registra cambios de SuperAdmin

---

## 📋 TABLA DE ARCHIVOS

### Backend (Python) - Total 6 archivos

| Archivo | Tipo | Descripción |
|---------|------|-----------|
| `erp_zoro_python/app/middleware/super_admin_middleware.py` | 🆕 Nuevo | Middleware de SuperAdmin + Company Admin |
| `erp_zoro_python/app/models/company_admin.py` | 🆕 Nuevo | Modelo ORM para ERP_COMPANY_ADMINS |
| `erp_zoro_python/app/services/superadmin_service.py` | 🆕 Nuevo | Servicios: dashboard, assigments, auditoría |
| `erp_zoro_python/app/api/routes/superadmin.py` | 🆕 Nuevo | Endpoints SuperAdmin |
| `erp_zoro_python/app/api/routes/companies.py` | 📝 Modificar | Agregar validaciones SuperAdmin |
| `erp_zoro_python/app/api/routes/users.py` | 📝 Modificar | Scope Company Admin en creación de usuarios |
| `erp_zoro_python/app/api/router.py` | 📝 Modificar | Registrar superadmin router |
| `erp_zoro_python/app/services/auth_service.py` | 📝 Modificar | Incluir is_super_admin en JWT |
| `erp_zoro_python/app/utils/token_helper.py` | 📝 Modificar | Extraer is_super_admin del token |
| `erp_zoro_python/sql/migracion_company_admins.sql` | 🆕 Nuevo | Crear tabla ERP_COMPANY_ADMINS |

### Frontend (React) - Total 7 archivos

| Archivo | Tipo | Descripción |
|---------|------|-----------|
| `frontend/src/pages/superadmin/GestionEmpresas.jsx` | 🆕 Nuevo | Tabla empresas + CRUD |
| `frontend/src/pages/superadmin/PanelAdministradores.jsx` | 🆕 Nuevo | Gestión Company Admins |
| `frontend/src/pages/superadmin/DashboardSuperAdmin.jsx` | 🆕 Nuevo | Dashboard global con stats |
| `frontend/src/pages/superadmin/AuditoriaGlobal.jsx` | 🆕 Nuevo | Logs de auditoría |
| `frontend/src/App.jsx` | 📝 Modificar | Rutas /superadmin/* |
| `frontend/src/layouts/DashboardLayout.jsx` | 📝 Modificar | Menú SuperAdmin en sidebar |
| `frontend/src/layouts/ProtectedLayout.jsx` | 📝 Modificar | Protección por rol |
| `frontend/src/utils/tokenHelper.js` | 📝 Modificar | Extraer is_super_admin |
| `frontend/src/services/permissionService.js` | 📝 Modificar | Cargar is_super_admin |

---

## 🔄 ORDEN DE IMPLEMENTACIÓN

```
SEMANA 1:
├─ Sesión 1: Backend 1.1 + 1.2 (Middleware + validaciones)
├─ Sesión 2: Backend 1.3 (Tabla Company Admins)
├─ Sesión 3: Backend 1.4 (Servicios SuperAdmin)
└─ Sesión 4: Backend 1.4 (Endpoints SuperAdmin)

SEMANA 2:
├─ Sesión 5: Frontend 2.1 (GestionEmpresas + PanelAdministradores)
├─ Sesión 6: Frontend 2.1 (DashboardSuperAdmin + AuditoriaGlobal)
├─ Sesión 7: Frontend 2.2 + 2.3 (Rutas + Sidebar)
└─ Sesión 8: Frontend 3.1 + 3.2 (Auth + Permisos)

SEMANA 3:
├─ Sesión 9: Frontend 3.3 + 3.4 (ProtectedLayout + Validaciones)
└─ Sesión 10: Testing end-to-end + Ajustes finales
```

---

## ✅ VALIDACIÓN END-TO-END

### Test 1: SuperAdmin crea empresa
1. Login como SuperAdmin
2. Navegar a `/superadmin/empresas`
3. Clic "Nueva Empresa"
4. Llenar formulario → Guardar
5. ✅ Empresa aparece en tabla
6. ✅ Auditoría registra creación

### Test 2: SuperAdmin asigna Company Admin
1. En `/superadmin/admins`
2. Seleccionar empresa
3. Seleccionar usuario → Asignar como admin
4. ✅ Usuario aparece en "Admin Asignado"
5. ✅ Auditoría registra asignación

### Test 3: Company Admin ve solo su empresa
1. Login como Company Admin
2. En Configuración → selector de empresa
3. ✅ Solo ve su empresa asignada
4. ✅ Botones crear/editar empresas deshabilitados

### Test 4: Dashboard global funciona
1. SuperAdmin → `/superadmin/dashboard`
2. ✅ Muestra stats de TODAS las empresas
3. ✅ Gráficos actualizan en tiempo real

### Test 5: Auditoría centralizada
1. SuperAdmin → `/superadmin/auditoria`
2. ✅ Todos los cambios aparecen (empresas, usuarios, admins)
3. ✅ Filtros funcionan (por usuario, empresa, fecha)

### Test 6: Seguridad - Endpoints protegidos
```bash
# Sin token → 401
curl -X GET http://localhost:8000/api/superadmin/dashboard

# Con token de usuario regular → 403
curl -X GET http://localhost:8000/api/superadmin/dashboard \
  -H "Authorization: Bearer USER_TOKEN"

# Con token SuperAdmin → 200
curl -X GET http://localhost:8000/api/superadmin/dashboard \
  -H "Authorization: Bearer SUPERADMIN_TOKEN"
```

---

## 🎯 BENEFICIOS

| Beneficio | Descripción |
|-----------|-----------|
| **Seguridad** | SuperAdmin y Company Admin roles claros y protegidos |
| **Escalabilidad** | Soporte para múltiples empresas con administración independiente |
| **Visibilidad** | Dashboard global + auditoría centralizada |
| **Usabilidad** | UI dedicada para SuperAdmin, intuitiva |
| **Mantenimiento** | Código separado, middleware reutilizable |
| **Cumplimiento** | Auditoría completa de accesos y cambios |

---

## 📞 PRÓXIMOS PASOS

1. **Revisar plan** con stakeholders
2. **Preparar BD** - Ejecutar migraciones
3. **Iniciar sesión 1** - Middleware SuperAdmin
4. **Seguir orden de implementación**
5. **Testing continuo** en cada sesión

---

**Generado:** 25 de abril de 2026
