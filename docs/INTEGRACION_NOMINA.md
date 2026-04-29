# 💼 INTEGRACIÓN NÓMINA - VACACIONES (FASE 2)

**Estado**: ✅ COMPLETADA  
**Fecha**: 28 de abril de 2026  
**Responsable**: GitHub Copilot  

---

## 📊 Resumen de la Integración

Se ha implementado un sistema completo de sincronización entre el módulo de vacaciones y el sistema de nómina. Cuando se aprueba una solicitud de vacaciones, el sistema automáticamente crea un mapeo que puede sincronizarse a la nómina del período correspondiente.

---

## 🏗️ Arquitectura de la Integración

```
┌─────────────────────────────────────────────────────────────┐
│ EMPLEADO SOLICITA VACACIONES                                │
│ ERP_HR_VACATION_REQUEST (Estatus = 'Pendiente')             │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ ADMIN APRUEBA SOLICITUD                                     │
│ ERP_HR_VACATION_REQUEST (Estatus = 'Aprobado')             │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ SISTEMA CREA MAPEO DE NÓMINA                                │
│ POST /rh/payroll/create-mapping?vacaciones_id=X             │
│ ERP_PAYROLL_LEAVE_MAPPING (Estatus = 'Pendiente')          │
│ - Calcula importe basado en salario diario × días           │
│ - Obtiene/crea concepto de VACACIONES                       │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ AL GENERAR NÓMINA DEL PERÍODO                               │
│ Admin sincroniza mapeo a nómina                             │
│ POST /rh/payroll/sync-to-payroll                            │
│ ERP_PAYROLL_LEAVE_MAPPING (Estatus = 'Sincronizado')       │
│ - Crea entrada en ERP_NOI_NOMINA_DETALLE                    │
│ - Añade importe a percepciones del empleado                 │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ EMPLEADO RECIBE PAGO CON VACACIONES INCLUIDAS               │
│ ERP_NOI_NOMINA_LINEAS con vacaciones en percepciones        │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 Archivos Creados

### 1. **Tabla de Base de Datos**

**ERP_PAYROLL_LEAVE_MAPPING** (12 columnas, 5 índices)

```sql
-- Propósito: Mapear vacaciones aprobadas a nómina
-- Estructura:
Mapping_Id          INT PK          -- Identificador único
VacacionesId        INT NOT NULL    -- FK a ERP_HR_VACATION_REQUEST
NominaLineaId       INT NULL        -- FK a ERP_NOI_NOMINA_LINEAS (cuando sincronizado)
NominaDetalleId     INT NULL        -- FK a ERP_NOI_NOMINA_DETALLE (detalle de línea)
ConceptoId          INT NULL        -- FK a ERP_NOI_CONCEPTOS (concepto de vacaciones)
Importe             DECIMAL(12,2)   -- Monto calculado de la vacación
FechaImporte        DATETIME        -- Cuándo se calculó
EstadoSincronizacion NVARCHAR(50)   -- 'Pendiente'|'Sincronizado'|'Error'|'Cancelado'
FechaSincronizacion DATETIME        -- Cuándo se sincronizó
MensajeError        NVARCHAR(MAX)   -- Si hay error
CreatedAt           DATETIME        -- Fecha creación
UpdatedAt           DATETIME        -- Última actualización

-- Índices (5):
IX_MAPPING_VACATION_ID          -- Buscar por vacación
IX_MAPPING_NOMINA_LINEA_ID      -- Buscar por línea nómina
IX_MAPPING_STATE                -- Buscar por estado
IX_MAPPING_FECHA_SYNC           -- Buscar por fecha (DESC)
IX_MAPPING_VACATION_STATE       -- Búsqueda compuesta: vacación + estado
```

### 2. **Servicio de Nómina** (`payroll_leave_service.py`)

**~430 líneas de código Python**

#### Funciones Principales

```python
✅ get_or_create_leave_concept()
   - Obtiene concepto de VACACIONES en nómina
   - Crea uno si no existe (Clave='VAC')

✅ calculate_leave_amount(user_id, days)
   - Calcula importe: salario_diario × días
   - Busca SalarioBase en ERP_NOI_EMPLEADOS
   - Devuelve DECIMAL(12,2)

✅ create_payroll_mapping(vacaciones_id, user_id)
   - Crea mapeo cuando se aprueba vacación
   - Verifica que esté en estado 'Aprobado'
   - Calcula importe automáticamente
   - Devuelve dict con datos del mapeo

✅ sync_leave_to_payroll(mapping_id, nomina_linea_id)
   - Sincroniza mapeo a una línea de nómina
   - Crea entrada en ERP_NOI_NOMINA_DETALLE
   - Actualiza estado a 'Sincronizado'
   - Registra errores si fallan

✅ get_pending_leave_mappings(limit=50)
   - Obtiene mapeos con estado 'Pendiente'
   - Solo vacaciones aprobadas
   - Ordenadas por fecha creación

✅ get_leave_mappings_by_vacation(vacaciones_id)
   - Obtiene todos los mapeos de una vacación
   - Información completa del mapeo
   - Datos de sincronización y errores

✅ cancel_leave_mapping(vacaciones_id)
   - Cancela mapeo cuando se rechaza vacación
   - Solo si no está sincronizado
   - Cambia estado a 'Cancelado'
```

### 3. **Endpoints REST** (`payroll_integration.py`)

**Base URL**: `/api/rh/payroll`

#### Endpoints Implementados

```
CREATE-MAPPING
├─ POST /payroll/create-mapping?vacaciones_id=X
├─ Crear mapeo de nómina para vacación aprobada
├─ Requiere: Admin o SuperAdmin
└─ Retorna: mapping_id, concepto_id, importe, status

SYNC-TO-PAYROLL
├─ POST /payroll/sync-to-payroll
├─ Body: {mapping_id, nomina_linea_id}
├─ Sincronizar mapeo a línea de nómina
├─ Requiere: Admin o SuperAdmin
└─ Retorna: nomina_detalle_id, fecha_sync

GET-PENDING
├─ GET /payroll/pending-mappings?limit=50
├─ Listar mapeos pendientes de sincronización
├─ Requiere: Admin o SuperAdmin
└─ Retorna: Array de mapeos

GET-VACATION-MAPPING
├─ GET /payroll/vacation-mapping/{vacaciones_id}
├─ Obtener mapeo de vacación específica
├─ Acceso: Usuarios autenticados
└─ Retorna: Información completa del mapeo

CANCEL-MAPPING
├─ POST /payroll/cancel-mapping/{vacaciones_id}
├─ Cancelar mapeo de nómina (al rechazar vacación)
├─ Requiere: Admin o SuperAdmin
└─ Retorna: Estado de cancelación

GET-CONCEPTS
├─ GET /payroll/concepts
├─ Listar conceptos de nómina disponibles
├─ Acceso: Usuarios autenticados
└─ Retorna: Array de conceptos

GET-EMPLOYEE-SALARY
├─ GET /payroll/employee-salary/{user_id}
├─ Obtener información salarial del empleado
├─ Acceso: Propio usuario, admins o superadmin
└─ Retorna: RFC, CURP, SalarioBase, Banco

GET-STATS
├─ GET /payroll/stats/pending
├─ Estadísticas de mapeos pendientes
├─ Requiere: Admin o SuperAdmin
└─ Retorna: {por_estado: {...}, total: {...}}
```

---

## 🔄 Flujo de Procesamiento

### Paso 1: Empleado solicita vacaciones
```javascript
POST /rh/vacaciones
{
  "FechaInicio": "2026-05-10",
  "FechaFin": "2026-05-15",
  "Cantidad": 4,
  "LeaveType_Id": 1,
  "Razon": "Viaje familiar",
  "Observaciones": ""
}
// Response: Vacaciones_Id = 42, Estatus = 'Pendiente'
```

### Paso 2: Admin aprueba solicitud
```javascript
PATCH /rh/vacaciones/42
{
  "Estatus": "Aprobado"
}
// Vacaciones_Id = 42, Estatus = 'Aprobado'
```

### Paso 3: Sistema crea mapeo (AUTOMÁTICO o MANUAL)
```javascript
// Opción A: Llamada manual del admin
POST /rh/payroll/create-mapping?vacaciones_id=42
// Response:
{
  "mapping_id": 15,
  "vacaciones_id": 42,
  "concepto_id": 5,
  "importe": 5000.00,     // Calculado automáticamente
  "status": "Pendiente",
  "dias": 4
}

// Mapeo creado con:
// - Estado: 'Pendiente'
// - Importe: SalarioDiario × 4 días = $5,000
// - Concepto: Vacaciones (ID=5)
```

### Paso 4: Admin sincroniza a nómina
```javascript
// Cuando se genera la nómina del mes
POST /rh/payroll/sync-to-payroll
{
  "mapping_id": 15,
  "nomina_linea_id": 320      // Línea de nómina del empleado
}
// Response:
{
  "mapping_id": 15,
  "nomina_linea_id": 320,
  "nomina_detalle_id": 5043,
  "status": "Sincronizado",
  "fecha_sync": "2026-05-01T14:30:00"
}

// Resultado:
// - ERP_NOI_NOMINA_DETALLE creado con:
//   * NominaLinea_Id = 320
//   * Concepto_Id = 5 (Vacaciones)
//   * Importe = 5000.00
//   * Gravado = 5000.00
//   * Exento = 0
// - Mapping actualizado a 'Sincronizado'
```

### Paso 5: Nómina generada incluye vacaciones
```
NÓMINA - CARLOS GARCÍA - Mayo 2026
═══════════════════════════════════

PERCEPCIONES:
  Salario Base              $10,000.00
  Vacaciones                 $5,000.00  ← AGREGADO POR MAPEO
  Bonos                      $1,000.00
  ─────────────────────────────────────
  Subtotal Percepciones     $16,000.00

DEDUCCIONES:
  ISR                       -$2,400.00
  IMSS                        -$600.00
  ─────────────────────────────────────
  Subtotal Deducciones      -$3,000.00

═══════════════════════════════════════
NETO A RECIBIR              $13,000.00
```

---

## 💾 Base de Datos - Script de Creación

```bash
# Ejecutar en terminal desde backend directory
cd erp_zoro_python
python setup_payroll_leave_mapping.py
```

**Resultado esperado:**
```
✅ Tabla ERP_PAYROLL_LEAVE_MAPPING creada
✅ 5 índices creados
✅ Concepto de VACACIONES creado
✅ SETUP COMPLETADO EXITOSAMENTE
```

---

## 🔐 Controles de Acceso

| Operación | Permisos | Restricción |
|-----------|----------|-------------|
| Crear mapeo | Admin, SuperAdmin | Solo vacaciones aprobadas |
| Sincronizar a nómina | Admin, SuperAdmin | Solo mapeos pendientes |
| Ver mapeos pendientes | Admin, SuperAdmin | Estadísticas globales |
| Ver mapeo de vacación | Usuario + Admin | Usuario: Solo la suya; Admin: Todas |
| Cancelar mapeo | Admin, SuperAdmin | Solo si no está sincronizado |
| Ver salario | Usuario + Admin | Usuario: Solo el suyo; Admin: Todos |
| Ver estadísticas | Admin, SuperAdmin | Datos consolidados |

---

## 📊 Estadísticas y Reportes

### Endpoint: `GET /rh/payroll/stats/pending`

```json
{
  "por_estado": {
    "Pendiente": {
      "cantidad": 5,
      "importe_total": 25000.00
    },
    "Sincronizado": {
      "cantidad": 12,
      "importe_total": 60000.00
    },
    "Error": {
      "cantidad": 1,
      "importe_total": 5000.00
    },
    "Cancelado": {
      "cantidad": 2,
      "importe_total": 10000.00
    }
  },
  "total": {
    "cantidad": 20,
    "importe_total": 100000.00
  }
}
```

---

## ⚠️ Manejo de Errores

### Errores Comunes y Soluciones

| Error | Causa | Solución |
|-------|-------|----------|
| "Vacación debe estar aprobada" | Intenta crear mapeo para vacación pendiente | Esperar a que se apruebe |
| "Mapeo incompleto: falta concepto" | Concepto no se creó | Re-ejecutar `setup_payroll_leave_mapping.py` |
| "Salario no encontrado" | Empleado sin datos en `ERP_NOI_EMPLEADOS` | Registrar datos salariales del empleado |
| "No tiene permisos" | Usuario sin rol admin | Solicitar permisos a SuperAdmin |

---

## 🔗 Integración con Componentes Existentes

### Frontend - Vacaciones.jsx

Cuando admin aprueba una vacación, se puede llamar automáticamente:

```javascript
// En Vacaciones.jsx - al aprobar
const handleApprove = async (vacacionesId) => {
  // 1. Aprobar vacación
  await vacacionesService.approve(vacacionesId);
  
  // 2. Crear mapeo de nómina automáticamente
  await leaveService.createPayrollMapping(vacacionesId);
  
  // 3. Mostrar confirmación
  notify.success('Vacación aprobada y agregada a nómina');
};
```

### Backend - Webhook (Próxima Fase)

```python
# En rh_service.py - función aprobar_vacaciones
def aprobar_vacaciones(vacaciones_id, ...):
    # ... código de aprobación ...
    
    # Crear mapeo de nómina automáticamente
    try:
        payroll_leave_service.create_payroll_mapping(vacaciones_id, user_id)
    except Exception as e:
        logger.warning(f"No se pudo crear mapeo de nómina: {e}")
        # La aprobación se completa, pero el admin debe sincronizar manualmente
```

---

## 📈 Perspectiva Técnica

### Cálculo de Importe

```python
def calculate_leave_amount(user_id: int, days: int):
    """
    Fórmula:
    1. Obtener SalarioBase de ERP_NOI_EMPLEADOS
    2. Dividir entre 20 (días laborales/mes) = Salario Diario
    3. Multiplicar por días de vacación = Importe Total
    
    Ejemplo:
    SalarioBase = $10,000
    Salario Diario = $10,000 / 20 = $500
    Días = 4
    Importe = $500 × 4 = $2,000
    """
```

### Sincronización Atómica

```python
# Transacción completa: insert en detalle + update en mapping
try:
    INSERT INTO ERP_NOI_NOMINA_DETALLE (...)
    UPDATE ERP_PAYROLL_LEAVE_MAPPING SET EstadoSincronizacion='Sincronizado'
    COMMIT
except:
    UPDATE ERP_PAYROLL_LEAVE_MAPPING SET EstadoSincronizacion='Error'
    ROLLBACK
```

---

## 🚀 Próximas Fases

### FASE 3: Automatización Completa
- [ ] Crear mapeos automáticamente al aprobar (webhook)
- [ ] Sincronizar automáticamente en período de nómina
- [ ] Notificaciones por email al sincronizar

### FASE 4: Reportería Avanzada
- [ ] Dashboard de vacaciones pendientes
- [ ] Proyección de costos de nómina
- [ ] Integración con presupuestos

### FASE 5: Validaciones Avanzadas
- [ ] Verificar capacidad presupuestaria
- [ ] Validar límite de vacaciones acumuladas
- [ ] Detectar solapamientos con otros empleados

---

## 📚 Documentación de Referencia

### Tablas Relacionadas
- `ERP_HR_VACATION_REQUEST` - Solicitudes de vacaciones
- `ERP_NOI_NOMINAS` - Encabezados de nómina
- `ERP_NOI_NOMINA_LINEAS` - Líneas de nómina por empleado
- `ERP_NOI_NOMINA_DETALLE` - Detalles de conceptos
- `ERP_NOI_CONCEPTOS` - Catálogo de conceptos (salarios, vacaciones, deducciones)
- `ERP_NOI_EMPLEADOS` - Datos de empleado para nómina
- `ERP_PAYROLL_LEAVE_MAPPING` - **NUEVA** - Mapeo vacaciones ↔ nómina

### Archivos Relacionados
- [payroll_leave_service.py](erp_zoro_python/app/services/payroll_leave_service.py) - Lógica
- [payroll_integration.py](erp_zoro_python/app/api/routes/payroll_integration.py) - Endpoints
- [setup_payroll_leave_mapping.py](erp_zoro_python/setup_payroll_leave_mapping.py) - Script setup

---

**Estado Final**: ✅ INTEGRACIÓN NÓMINA COMPLETADA  
**Código**: ~430 líneas (Service) + ~280 líneas (Routes) = ~710 líneas  
**Tests**: Listos para pruebas E2E  
**Documentación**: Completa  

**Hecho por**: GitHub Copilot  
**Fecha**: 28 de abril de 2026
