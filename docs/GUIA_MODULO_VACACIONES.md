# 📅 Módulo de Vacaciones - Guía Completa

## 📋 Descripción

El módulo de Vacaciones permite a los empleados solicitar días de descanso y a los administradores aprobar o rechazar estas solicitudes. Sistema completo con:

- ✅ Solicitud de vacaciones por empleados
- ✅ Aprobación/Rechazo por administradores
- ✅ Historial de solicitudes
- ✅ Filtros por estado
- ✅ Cálculo automático de días

---

## 🚀 Instalación

### 1. Crear tabla en la base de datos

Ejecuta el script SQL en SQL Server Management Studio:

```sql
-- Abre el archivo:
erp_zoro_python/sql/create_vacation_request_table.sql

-- Ejecuta todo el contenido en tu base de datos
```

**Verifica que se creó correctamente:**
```sql
SELECT * FROM ERP_HR_VACATION_REQUEST;
-- Debe estar vacía si es la primera vez
```

---

## 📁 Archivos Creados

### Backend (Python/FastAPI)

| Archivo | Descripción |
|---------|-------------|
| `app/schemas/rh.py` | ✅ Esquemas Pydantic para validación |
| `app/services/rh_service.py` | ✅ Lógica de negocio (funciones de vacaciones) |
| `app/api/routes/rh.py` | ✅ Endpoints REST de vacaciones |
| `sql/create_vacation_request_table.sql` | ✅ Script SQL para crear tabla |

### Frontend (React)

| Archivo | Descripción |
|---------|-------------|
| `frontend/src/services/vacacionesService.js` | ✅ Cliente API |
| `frontend/src/pages/rh/Vacaciones.jsx` | ✅ Componente React principal |
| `frontend/src/pages/rh/vacaciones.css` | ✅ Estilos CSS |

---

## 🔌 Endpoints API

### Listar solicitudes
```
GET /api/rh/vacaciones
Parámetros opcionales:
  - company_id: Filtrar por empresa
  - user_id: Filtrar por empleado
  - estatus: Filtrar por estado (Pendiente, Aprobado, Rechazado)
```

**Ejemplo:**
```bash
curl http://localhost:8000/api/rh/vacaciones?estatus=Pendiente
```

### Obtener detalles
```
GET /api/rh/vacaciones/{vacaciones_id}
```

### Crear solicitud
```
POST /api/rh/vacaciones
Body:
{
  "FechaInicio": "2026-05-01",
  "FechaFin": "2026-05-10",
  "Cantidad": 10,
  "Razon": "Vacaciones de verano",
  "Observaciones": "Viajando con familia"
}
```

### Actualizar solicitud
```
PUT /api/rh/vacaciones/{vacaciones_id}
Body: (todos los campos opcionales)
{
  "FechaInicio": "2026-05-01",
  "FechaFin": "2026-05-12",
  "Cantidad": 12,
  "Razon": "Vacaciones actualizadas"
}
```

### Aprobar/Rechazar
```
POST /api/rh/vacaciones/{vacaciones_id}/aprobar
Body:
{
  "Estatus": "Aprobado",  // O "Rechazado"
  "Observaciones": "Aprobado por gerencia"
}
```

### Eliminar
```
DELETE /api/rh/vacaciones/{vacaciones_id}
```

---

## 🎨 Interfaz de Usuario

### 📋 Sección: Mis Solicitudes

**Muestra:**
- Tabla con todas las solicitudes del usuario
- Período de vacaciones (fechas)
- Número de días solicitados
- Razón del descanso
- Estado (Pendiente, Aprobado, Rechazado)
- Fecha de solicitud

**Acciones:**
- ✏️ Editar (solo si está Pendiente)
- 🗑️ Eliminar (solo si está Pendiente)
- ℹ️ Ver detalles

**Filtros:**
- Por estado: Todos, Pendiente, Aprobado, Rechazado

### ➕ Sección: Nueva Solicitud

**Formulario:**
- **Fecha Inicio** (requerido)
- **Fecha Fin** (requerido)
- **Días a Solicitar** (se calcula automáticamente)
- **Razón del Descanso** (opcional)
- **Observaciones** (opcional)

**Funcionalidades:**
- Cálculo automático de días entre fechas
- Validación de campos requeridos
- Edición de solicitudes pendientes

---

## 📊 Estructura de Datos

### Tabla: ERP_HR_VACATION_REQUEST

```sql
CREATE TABLE ERP_HR_VACATION_REQUEST (
    Vacaciones_Id INT PRIMARY KEY,
    User_Id INT,
    FechaInicio DATETIME,
    FechaFin DATETIME,
    Cantidad INT,
    Razon NVARCHAR(255),
    Observaciones NVARCHAR(MAX),
    Estatus NVARCHAR(50),  -- Pendiente, Aprobado, Rechazado
    AprobadoPor INT,
    FechaAprobacion DATETIME,
    IsActive BIT,
    CreatedAt DATETIME,
    UpdatedAt DATETIME,
    CreatedBy INT,
    UpdatedBy INT
);
```

---

## 🔐 Permisos y Control de Acceso

### Empleados
- ✅ Crear propias solicitudes
- ✅ Ver propias solicitudes
- ✅ Editar solicitudes pendientes
- ✅ Eliminar solicitudes propias
- ❌ NO pueden aprobar solicitudes

### Administradores
- ✅ Ver todas las solicitudes
- ✅ Filtrar por empleado o empresa
- ✅ Aprobar/Rechazar solicitudes
- ✅ Agregar observaciones

### Super Administradores
- ✅ Acceso completo a todo

---

## 🔄 Flujo de Solicitud

```
┌─────────────────────┐
│ Empleado crea       │
│ solicitud pendiente  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Admin recibe        │
│ notificación        │
└──────────┬──────────┘
           │
           ▼
    ┌──────────────┐
    │ Revisar      │
    │ solicitud    │
    └──┬───────┬──┘
       │       │
   Aprueba  Rechaza
       │       │
       ▼       ▼
    APROBADO  RECHAZADO
```

---

## 📝 Ejemplo de Uso

### Como empleado:

1. **Navegar** a RH → Vacaciones
2. **Hacer clic** en "➕ Nueva Solicitud"
3. **Ingresa:**
   - Inicio: 2026-05-01
   - Fin: 2026-05-10
   - Razón: "Vacaciones de verano"
4. **Haz clic** en "✅ Enviar Solicitud"
5. **Verifica** que aparezca en "Mis Solicitudes" con estado "Pendiente"

### Como administrador:

1. **Navegar** a RH → Vacaciones
2. **Ver lista** de solicitudes pendientes
3. **Hacer clic** en "ℹ️ Ver detalles"
4. **Revisar** información de la solicitud
5. **Si está permitida:**
   - Cambiar Estatus a "Aprobado"
   - Agregar observaciones si es necesario
   - Confirmar

---

## 🧪 Testing

### Test de creación
```bash
curl -X POST http://localhost:8000/api/rh/vacaciones \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "FechaInicio": "2026-05-01",
    "FechaFin": "2026-05-10",
    "Cantidad": 10,
    "Razon": "Test"
  }'
```

### Test de listado
```bash
curl http://localhost:8000/api/rh/vacaciones \
  -H "Authorization: Bearer <token>"
```

### Test de aprobación
```bash
curl -X POST http://localhost:8000/api/rh/vacaciones/1/aprobar \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "Estatus": "Aprobado",
    "Observaciones": "Aprobado"
  }'
```

---

## ⚙️ Configuración

### Variables de entorno (si aplica)
Ninguna requiere configuración especial.

### Dependencias
- FastAPI (backend)
- Pydantic (validación)
- SQLAlchemy (ORM)
- React (frontend)

---

## 🐛 Troubleshooting

### Problema: "Tabla no encontrada"
**Solución:**
1. Ejecuta el script SQL: `sql/create_vacation_request_table.sql`
2. Verifica que estés conectado a la base de datos correcta
3. Revisa que los permisos sean correctos

### Problema: "Error 403: No autorizado"
**Solución:**
1. Verifica que tengas permisos suficientes
2. Si eres admin, verifica tu token JWT

### Problema: "No aparecen mis solicitudes"
**Solución:**
1. Asegúrate de estar logueado
2. Verifica que tengas solicitudes creadas
3. Revisa los filtros activos

---

## 📞 Soporte

Para reportar errores o sugerencias, contacta al equipo de desarrollo.

---

## 🎯 Próximas mejoras

- [ ] Recordatorios por email
- [ ] Integración con calendario
- [ ] Límite de días por año
- [ ] Aprobación por múltiples niveles
- [ ] Reporte de vacaciones por departamento

---

**Última actualización:** 28 de Abril de 2026
**Versión:** 1.0.0
