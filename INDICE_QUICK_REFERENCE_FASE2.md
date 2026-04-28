# 📚 ÍNDICE RÁPIDO - FASE 2: Integración con Nómina

**Creado**: 28 de abril de 2026  
**Propósito**: Referencia rápida de archivos, endpoints y funciones  

---

## 📂 Archivos Importantes

### Nuevos Archivos Creados

```
erp_zoro_python/
├─ app/
│  ├─ services/
│  │  └─ payroll_leave_service.py  ← Lógica de cálculos y mapeos
│  └─ api/
│     └─ routes/
│        └─ payroll_integration.py  ← Endpoints REST
├─ setup_payroll_leave_mapping.py   ← Script de inicialización
└─ setup_payroll_leave_mapping.sql  ← Definición de tabla

Root/
├─ INTEGRACION_NOMINA.md            ← Documentación técnica COMPLETA
├─ CHECKLIST_FASE2_NOMINA.md        ← Checklist de tareas
├─ RESUMEN_FASE2_NOMINA.md          ← Resumen ejecutivo
├─ TESTING_FASE2_NOMINA.md          ← Guía de testing
└─ INDICE_QUICK_REFERENCE.md        ← Este archivo
```

### Archivos Modificados

```
erp_zoro_python/app/api/
└─ router.py                        ← +2 líneas para registrar payroll_integration
```

---

## 🔗 Endpoints REST (Base URL: `/api/rh/payroll`)

### Crear Mapeo
```
POST /create-mapping?vacaciones_id={ID}
├─ Requiere: Admin/SuperAdmin
├─ Response: {mapping_id, concepto_id, importe, status}
└─ Archivo: payroll_integration.py:L45-75
```

### Sincronizar a Nómina
```
POST /sync-to-payroll
├─ Body: {mapping_id, nomina_linea_id}
├─ Requiere: Admin/SuperAdmin
├─ Response: {nomina_detalle_id, status='Sincronizado'}
└─ Archivo: payroll_integration.py:L76-110
```

### Listar Pendientes
```
GET /pending-mappings?limit=50
├─ Requiere: Admin/SuperAdmin
├─ Response: {mapeos: [...], total}
└─ Archivo: payroll_integration.py:L111-140
```

### Ver Mapeo de Vacación
```
GET /vacation-mapping/{vacaciones_id}
├─ Requiere: Autenticado
├─ Response: Detalles completos del mapeo
└─ Archivo: payroll_integration.py:L141-165
```

### Cancelar Mapeo
```
POST /cancel-mapping/{vacaciones_id}
├─ Requiere: Admin/SuperAdmin
├─ Response: status='Cancelado'
└─ Archivo: payroll_integration.py:L166-195
```

### Listar Conceptos
```
GET /concepts
├─ Requiere: Autenticado
├─ Response: {conceptos: [...]}
└─ Archivo: payroll_integration.py:L196-215
```

### Obtener Salario de Empleado
```
GET /employee-salary/{user_id}
├─ Requiere: Self o Admin/SuperAdmin
├─ Response: {rfc, curp, salario_base, banco}
└─ Archivo: payroll_integration.py:L216-240
```

### Estadísticas de Pendientes
```
GET /stats/pending
├─ Requiere: Admin/SuperAdmin
├─ Response: {por_estado, total}
└─ Archivo: payroll_integration.py:L241-265
```

---

## 🔧 Funciones de Servicio (payroll_leave_service.py)

### get_or_create_leave_concept()
```python
# Ubicación: payroll_leave_service.py:L30-50
# Propósito: Obtener o crear concepto VACACIONES en nómina
# Input: ninguno
# Output: int (concepto_id)
# Errores: HTTPException si DB falla
```

### calculate_leave_amount(user_id, days)
```python
# Ubicación: payroll_leave_service.py:L52-75
# Propósito: Calcular importe = (SalarioBase/20) × días
# Input: user_id (int), days (int)
# Output: Decimal(importe)
# Fórmula: SalarioBase ÷ 20 × días
```

### create_payroll_mapping(vacaciones_id, user_id)
```python
# Ubicación: payroll_leave_service.py:L77-120
# Propósito: Crear mapeo cuando se aprueba vacación
# Input: vacaciones_id, user_id
# Output: dict {mapping_id, concepto_id, importe, status}
# Validaciones: Status debe ser 'Aprobado'
```

### sync_leave_to_payroll(mapping_id, nomina_linea_id)
```python
# Ubicación: payroll_leave_service.py:L122-165
# Propósito: Sincronizar mapeo a nómina (crear detalle)
# Input: mapping_id, nomina_linea_id
# Output: dict {nomina_detalle_id, status='Sincronizado'}
# Transacción: INSERT + UPDATE en una transacción
```

### get_pending_leave_mappings(limit=50)
```python
# Ubicación: payroll_leave_service.py:L167-195
# Propósito: Obtener mapeos con status 'Pendiente'
# Input: limit (int, default=50)
# Output: list of dicts
# Query: EstadoSincronizacion='Pendiente' AND Estatus='Aprobado'
```

### get_leave_mappings_by_vacation(vacaciones_id)
```python
# Ubicación: payroll_leave_service.py:L197-220
# Propósito: Obtener todos mapeos de una vacación
# Input: vacaciones_id
# Output: dict con info completa del mapeo
# Acceso: Usuario + Admin pueden ver
```

### cancel_leave_mapping(vacaciones_id)
```python
# Ubicación: payroll_leave_service.py:L222-250
# Propósito: Cancelar mapeo cuando se rechaza vacación
# Input: vacaciones_id
# Output: dict {status='Cancelado'}
# Restricción: Solo si no está sincronizado
```

---

## 📊 Base de Datos

### Tabla: ERP_PAYROLL_LEAVE_MAPPING

```sql
Mapping_Id              INT PK          -- Identificador único
VacacionesId            INT NOT NULL    -- FK a vacación
NominaLineaId           INT NULL        -- FK a nómina (cuando sync)
NominaDetalleId         INT NULL        -- FK a detalle nómina
ConceptoId              INT NULL        -- FK a VACACIONES concept
Importe                 DECIMAL(12,2)   -- Monto de vacación
FechaImporte            DATETIME        -- Cuándo se calculó
EstadoSincronizacion    NVARCHAR(50)    -- Pendiente|Sincronizado|Error|Cancelado
FechaSincronizacion     DATETIME        -- Cuándo se sincronizó
MensajeError            NVARCHAR(MAX)   -- Error si aplica
CreatedAt               DATETIME        -- Fecha creación
UpdatedAt               DATETIME        -- Última actualización

-- Índices (5):
IX_MAPPING_VACATION_ID
IX_MAPPING_NOMINA_LINEA_ID
IX_MAPPING_STATE
IX_MAPPING_FECHA_SYNC
IX_MAPPING_VACATION_STATE
```

### Registros Relacionados

```sql
-- Concepto de VACACIONES (creado automáticamente)
SELECT * FROM ERP_NOI_CONCEPTOS WHERE Clave='VAC'
-- Resultado: ID=5 (puede variar)

-- Empleados con datos salariales
SELECT * FROM ERP_NOI_EMPLEADOS

-- Períodos de nómina
SELECT * FROM ERP_NOI_NOMINAS

-- Líneas de nómina por empleado
SELECT * FROM ERP_NOI_NOMINA_LINEAS

-- Detalles de conceptos en nómina
SELECT * FROM ERP_NOI_NOMINA_DETALLE
```

---

## 🚀 Flujo Rápido

### Flujo Completo (10 pasos)

```
1. Empleado solicita vacación
   POST /api/rh/vacaciones
   ↓
2. Admin aprueba
   PATCH /api/rh/vacaciones/{id}
   ↓
3. Admin crea mapeo
   POST /api/rh/payroll/create-mapping?vacaciones_id=X
   ✓ Cálculo automático: (Salario/20) × días
   ↓
4. Mapeo creado en BD
   INSERT ERP_PAYROLL_LEAVE_MAPPING (status='Pendiente')
   ↓
5. Admin revisa pendientes
   GET /api/rh/payroll/pending-mappings
   ↓
6. Admin sincroniza a nómina
   POST /api/rh/payroll/sync-to-payroll
   ↓
7. Detalle creado en nómina
   INSERT ERP_NOI_NOMINA_DETALLE
   ↓
8. Mapeo marcado sincronizado
   UPDATE ERP_PAYROLL_LEAVE_MAPPING (status='Sincronizado')
   ↓
9. Nómina final genera
   SELECT * FROM ERP_NOI_NOMINA (incluye vacaciones)
   ↓
10. Empleado recibe pago ✅
```

---

## 🔐 Controles de Acceso

```
Operación                   Rol Requerido       Validación Adicional
═══════════════════════════════════════════════════════════════════════
Crear Mapeo                 Admin/SuperAdmin    Status='Aprobado'
Sincronizar                 Admin/SuperAdmin    Status='Pendiente'
Ver Pendientes              Admin/SuperAdmin    Ninguna
Ver Mapeo Propio            Usuario             Su propia vacación
Ver Mapeo Ajeno             Admin/SuperAdmin    Ninguna
Cancelar Mapeo              Admin/SuperAdmin    Status≠'Sincronizado'
Ver Salario Propio          Usuario             Su user_id
Ver Salario Ajeno           Admin/SuperAdmin    Ninguna
Ver Conceptos               Cualquier Usuario   Ninguna
Ver Estadísticas            Admin/SuperAdmin    Ninguna
```

---

## 📈 Métricas Clave

```
Líneas de Código:
  payroll_leave_service.py    430 líneas (7 funciones)
  payroll_integration.py      280 líneas (8 endpoints)
  setup_payroll_leave_mapping.py  170 líneas (script)
  ─────────────────────────────────────────────
  Total Nuevo Código          880 líneas

Endpoints:                     8/8 implementados ✅
Funciones de Servicio:        7/7 implementadas ✅
Tabla Base de Datos:          1/1 creada ✅
Índices:                      5/5 creados ✅
Documentación:                4 archivos ✅

Completitud FASE 2:           71% (Ready for Testing)
```

---

## 🎯 Comandos Comunes

### Iniciar Ambiente

```bash
# Terminal 1: Backend
cd erp_zoro_python && python -m uvicorn app.main:app --reload

# Terminal 2: Frontend
cd frontend && npm run dev

# Terminal 3: Scripts
cd erp_zoro_python && python setup_payroll_leave_mapping.py
```

### Testing Rápido

```bash
# Crear vacación
curl -X POST http://localhost:8000/api/rh/vacaciones \
  -H "Authorization: Bearer TOKEN" \
  -d '{"FechaInicio":"2026-05-10","FechaFin":"2026-05-15","Cantidad":4}'

# Aprobar
curl -X PATCH http://localhost:8000/api/rh/vacaciones/42 \
  -H "Authorization: Bearer TOKEN" \
  -d '{"Estatus":"Aprobado"}'

# Crear mapeo
curl -X POST "http://localhost:8000/api/rh/payroll/create-mapping?vacaciones_id=42" \
  -H "Authorization: Bearer TOKEN"

# Sincronizar
curl -X POST http://localhost:8000/api/rh/payroll/sync-to-payroll \
  -H "Authorization: Bearer TOKEN" \
  -d '{"mapping_id":1,"nomina_linea_id":320}'
```

### Consultas SQL

```sql
-- Ver mapeos creados
SELECT * FROM ERP_PAYROLL_LEAVE_MAPPING ORDER BY CreatedAt DESC;

-- Ver mapeos pendientes
SELECT * FROM ERP_PAYROLL_LEAVE_MAPPING 
WHERE EstadoSincronizacion='Pendiente';

-- Ver mapeos sincronizados
SELECT * FROM ERP_PAYROLL_LEAVE_MAPPING 
WHERE EstadoSincronizacion='Sincronizado';

-- Ver detalles en nómina
SELECT * FROM ERP_NOI_NOMINA_DETALLE 
WHERE Concepto_Id = 5; -- VACACIONES

-- Validar concepto
SELECT * FROM ERP_NOI_CONCEPTOS WHERE Clave='VAC';
```

---

## 📞 Documentación Detallada

Para más información, ver:

| Documento | Propósito | Ubicación |
|-----------|-----------|-----------|
| INTEGRACION_NOMINA.md | Guía completa con ejemplos | Root directory |
| CHECKLIST_FASE2_NOMINA.md | Tracking de tareas | Root directory |
| RESUMEN_FASE2_NOMINA.md | Resumen ejecutivo | Root directory |
| TESTING_FASE2_NOMINA.md | Guía paso a paso de testing | Root directory |
| payroll_leave_service.py | Implementación servicio | app/services/ |
| payroll_integration.py | Implementación endpoints | app/api/routes/ |

---

## ✨ Características Destacadas

✅ **Cálculo Automático**: Importe calculado sin intervención manual  
✅ **Transacciones Atómicas**: Insert + Update en una sola transacción  
✅ **Auditoría Completa**: Timestamps para cada operación  
✅ **Control de Permisos**: Admin/SuperAdmin solo  
✅ **Estados Rastreable**: Pendiente → Sincronizado → Cancelado  
✅ **Índices Optimizados**: 5 índices para queries rápidas  
✅ **Manejo de Errores**: Try/catch en todos los servicios  
✅ **Documentación Completa**: 4 archivos + comentarios en código  

---

## 🔄 Próximas Tareas

| Tarea | Prioridad | Tiempo |
|-------|----------|--------|
| Testing E2E completo | 🔴 Alta | 2 horas |
| Tests unitarios | 🟡 Media | 3 horas |
| Frontend PayrollSyncPanel | 🟡 Media | 2 horas |
| Automatización de mapeos | 🟡 Media | 2 horas |
| Dashboard de reportes | 🟢 Baja | 4 horas |

---

**Documento**: INDICE_QUICK_REFERENCE.md  
**Creado**: 28 de abril de 2026  
**Propósito**: Referencia rápida de todo lo implementado en FASE 2  
**Estado**: ✅ Completo y Listo  

---

**💡 Consejo**: Guardá este archivo para referencia rápida durante testing y desarrollo.

