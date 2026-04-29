# 🧪 GUÍA DE TESTING - FASE 2: Integración con Nómina

**Creada**: 28 de abril de 2026  
**Objetivo**: Validar funcionamiento completo del sistema de integración nómina-vacaciones  
**Tiempo Estimado**: 15-20 minutos  

---

## 🚀 Inicio Rápido (5 minutos)

### 1. Verificar Tabla en Base de Datos

```sql
-- Ejecutar en SQL Server Management Studio:
USE ERP_Zoro;
GO

-- Verificar tabla existe
SELECT COUNT(*) as total_registros FROM ERP_PAYROLL_LEAVE_MAPPING;

-- Verificar concepto de VACACIONES existe
SELECT * FROM ERP_NOI_CONCEPTOS WHERE Clave='VAC';
```

**Resultado Esperado:**
```
total_registros = 0 (tabla nueva, vacía)

Concepto_Id  Clave  Descripcion  Gravado
5            VAC    Vacaciones   1
```

### 2. Iniciar Backend

```bash
# Terminal 1
cd c:\Users\diazj\OneDrive\Escritorio\ERP_PROYECTO\erp_zoro_python
python -m uvicorn app.main:app --reload

# Esperar mensaje:
# ✅ Uvicorn running on http://127.0.0.1:8000
```

### 3. Iniciar Frontend

```bash
# Terminal 2
cd c:\Users\diazj\OneDrive\Escritorio\ERP_PROYECTO\frontend
npm run dev

# Esperar mensaje:
# ✅ Local: http://localhost:5173
```

### 4. Obtener Token JWT (Admin)

```bash
# Terminal 3
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "password123"
  }' | jq '.access_token'

# Guardar el token en variable:
$TOKEN = "eyJhbGciOiJIUzI1NiIs..."
```

---

## ✅ Test 1: Endpoints Disponibles

### Verificar que endpoints existen y responden

```bash
# Test: GET /api/rh/payroll/concepts
curl -X GET http://localhost:8000/api/rh/payroll/concepts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"

# Resultado Esperado (200 OK):
{
  "conceptos": [
    {
      "concepto_id": 5,
      "clave": "VAC",
      "descripcion": "Vacaciones",
      "gravado": true
    },
    ...
  ]
}
```

### Verificar estadísticas

```bash
# Test: GET /api/rh/payroll/stats/pending
curl -X GET http://localhost:8000/api/rh/payroll/stats/pending \
  -H "Authorization: Bearer $TOKEN"

# Resultado Esperado (200 OK):
{
  "por_estado": {
    "Pendiente": {"cantidad": 0, "importe_total": 0},
    "Sincronizado": {"cantidad": 0, "importe_total": 0},
    "Error": {"cantidad": 0, "importe_total": 0},
    "Cancelado": {"cantidad": 0, "importe_total": 0}
  },
  "total": {"cantidad": 0, "importe_total": 0}
}
```

✅ **Test 1 PASADO**

---

## ✅ Test 2: Crear Vacación y Mapeo

### Paso 1: Crear solicitud de vacación

```bash
# Test: POST /api/rh/vacaciones
curl -X POST http://localhost:8000/api/rh/vacaciones \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "FechaInicio": "2026-05-10",
    "FechaFin": "2026-05-15",
    "LeaveType_Id": 1,
    "Cantidad": 4,
    "Razon": "Viaje familiar",
    "Observaciones": ""
  }'

# Guardar Vacaciones_Id de la respuesta:
$VACACION_ID = 42
```

**Resultado Esperado:**
```json
{
  "Vacaciones_Id": 42,
  "FechaInicio": "2026-05-10",
  "FechaFin": "2026-05-15",
  "Estatus": "Pendiente",
  "LeaveType_Id": 1,
  "Cantidad": 4
}
```

### Paso 2: Aprobar vacación

```bash
# Test: PATCH /api/rh/vacaciones/{id}
curl -X PATCH http://localhost:8000/api/rh/vacaciones/42 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "Estatus": "Aprobado"
  }'
```

**Resultado Esperado:**
```json
{
  "Vacaciones_Id": 42,
  "Estatus": "Aprobado",
  ...
}
```

### Paso 3: Crear mapeo de nómina

```bash
# Test: POST /api/rh/payroll/create-mapping
curl -X POST "http://localhost:8000/api/rh/payroll/create-mapping?vacaciones_id=42" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'

# Guardar Mapping_Id de la respuesta:
$MAPPING_ID = 1
```

**Resultado Esperado:**
```json
{
  "mapping_id": 1,
  "vacaciones_id": 42,
  "concepto_id": 5,
  "importe": 5000.00,
  "status": "Pendiente",
  "dias": 4,
  "fecha_calculo": "2026-04-28T14:30:00"
}
```

### Paso 4: Verificar mapeo creado

```bash
# Test: GET /api/rh/payroll/vacation-mapping/{vacaciones_id}
curl -X GET http://localhost:8000/api/rh/payroll/vacation-mapping/42 \
  -H "Authorization: Bearer $TOKEN"
```

**Resultado Esperado:**
```json
{
  "mapping_id": 1,
  "vacaciones_id": 42,
  "concepto_id": 5,
  "importe": 5000.00,
  "estado_sincronizacion": "Pendiente",
  ...
}
```

✅ **Test 2 PASADO**

---

## ✅ Test 3: Sincronizar a Nómina

### Obtener línea de nómina del empleado

```bash
# Ejecutar en SQL Server:
SELECT TOP 5 NominaLinea_Id, Empleado_Id, Periodo 
FROM ERP_NOI_NOMINA_LINEAS 
ORDER BY NominaLinea_Id DESC;

# Usar el NominaLinea_Id más reciente:
$NOMINA_LINEA_ID = 320
```

### Sincronizar mapeo a nómina

```bash
# Test: POST /api/rh/payroll/sync-to-payroll
curl -X POST http://localhost:8000/api/rh/payroll/sync-to-payroll \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "mapping_id": 1,
    "nomina_linea_id": 320
  }'
```

**Resultado Esperado:**
```json
{
  "mapping_id": 1,
  "nomina_linea_id": 320,
  "nomina_detalle_id": 5043,
  "status": "Sincronizado",
  "fecha_sync": "2026-04-28T14:30:00"
}
```

### Verificar en base de datos

```sql
-- Verificar entrada creada en nómina
SELECT * FROM ERP_NOI_NOMINA_DETALLE 
WHERE NominaLinea_Id = 320 
AND Concepto_Id = 5;

-- Resultado esperado:
-- ID  NominaLinea_Id  Concepto_Id  Importe  Gravado  Exento
-- 5043  320           5            5000.00  5000.00  0

-- Verificar mapeo actualizado
SELECT * FROM ERP_PAYROLL_LEAVE_MAPPING 
WHERE Mapping_Id = 1;

-- Resultado esperado:
-- EstadoSincronizacion = 'Sincronizado'
-- FechaSincronizacion = 2026-04-28 14:30:00
```

✅ **Test 3 PASADO**

---

## ✅ Test 4: Listar Mapeos Pendientes

```bash
# Crear 2-3 vacaciones más y sus mapeos para tener datos

# Test: GET /api/rh/payroll/pending-mappings
curl -X GET "http://localhost:8000/api/rh/payroll/pending-mappings?limit=10" \
  -H "Authorization: Bearer $TOKEN"
```

**Resultado Esperado:**
```json
{
  "mapeos": [
    {
      "mapping_id": 2,
      "vacaciones_id": 43,
      "empleado": "Carlos García",
      "importe": 3000.00,
      "dias": 3,
      "estado": "Pendiente",
      "fecha_creacion": "2026-04-28T14:35:00"
    },
    ...
  ],
  "total": 2
}
```

✅ **Test 4 PASADO**

---

## ✅ Test 5: Obtener Información Salarial

```bash
# Primero, obtener user_id del empleado que creó la vacación
# Asumir: user_id = 10

# Test: GET /api/rh/payroll/employee-salary/{user_id}
curl -X GET http://localhost:8000/api/rh/payroll/employee-salary/10 \
  -H "Authorization: Bearer $TOKEN"
```

**Resultado Esperado:**
```json
{
  "user_id": 10,
  "empleado": "Carlos García",
  "rfc": "GACA800101ABC",
  "curp": "GACA800101HDFCRL09",
  "salario_base": 10000.00,
  "banco": "BBVA",
  "cuenta": "1234567890"
}
```

✅ **Test 5 PASADO**

---

## ❌ Test 6: Validar Restricciones

### 6.1: No permitir crear mapeo de vacación no aprobada

```bash
# Crear vacación en estado 'Pendiente'
curl -X POST http://localhost:8000/api/rh/vacaciones \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "FechaInicio": "2026-06-01",
    "FechaFin": "2026-06-05",
    "LeaveType_Id": 1,
    "Cantidad": 3,
    "Razon": "Viaje"
  }'

# Guardar: $VACACION_PENDIENTE = 44

# Intentar crear mapeo (debe fallar):
curl -X POST "http://localhost:8000/api/rh/payroll/create-mapping?vacaciones_id=44" \
  -H "Authorization: Bearer $TOKEN"
```

**Resultado Esperado:**
```json
{
  "detail": "Vacación debe estar en estado 'Aprobado'"
}
```

### 6.2: No permitir sincronizar 2 veces

```bash
# Intentar sincronizar mismo mapeo nuevamente
curl -X POST http://localhost:8000/api/rh/payroll/sync-to-payroll \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "mapping_id": 1,
    "nomina_linea_id": 320
  }'
```

**Resultado Esperado:**
```json
{
  "detail": "Este mapeo ya está sincronizado"
}
```

### 6.3: Validar permisos (usuario sin admin)

```bash
# Obtener token de usuario regular
$USER_TOKEN = "eyJhbGciOiJIUzI1NiIs..."

# Intentar crear mapeo (debe fallar)
curl -X POST "http://localhost:8000/api/rh/payroll/create-mapping?vacaciones_id=42" \
  -H "Authorization: Bearer $USER_TOKEN"
```

**Resultado Esperado:**
```json
{
  "detail": "No tiene permisos para esta operación"
}
```

✅ **Test 6 PASADO**

---

## 🔍 Test Manual en UI (Frontend)

### Verificar Vacaciones.jsx

1. Navegar a `http://localhost:5173/rh/vacaciones`
2. Verificar que se cargan 4 pestañas:
   - 📋 Mis Solicitudes
   - 📅 Calendario
   - ⚖️ Saldo
   - ➕ Nueva Solicitud

3. Crear nueva solicitud:
   - Seleccionar tipo de vacación (debe tener 6 tipos)
   - Seleccionar fechas
   - Clic en "Solicitar"

4. Verificar que se crea sin errores en consola

✅ **Test Frontend PASADO**

---

## 📊 Dashboard de Testing

| Test | Nombre | Estado | Tiempo |
|------|--------|--------|--------|
| 1 | Endpoints disponibles | ⏳ TODO | 2 min |
| 2 | Crear vacación y mapeo | ⏳ TODO | 5 min |
| 3 | Sincronizar a nómina | ⏳ TODO | 3 min |
| 4 | Listar pendientes | ⏳ TODO | 2 min |
| 5 | Obtener salario | ⏳ TODO | 2 min |
| 6 | Validar restricciones | ⏳ TODO | 3 min |
| 7 | Frontend UI | ⏳ TODO | 3 min |

**Total Tiempo Estimado**: 20 minutos

---

## 📝 Resultados

**Fecha de Testing**: ________________  
**Ejecutado por**: ________________  
**Resultado General**: ⏳ PENDIENTE  

### Resumen de Tests

```
[ ] Test 1: Endpoints - ✅/❌
[ ] Test 2: Create & Map - ✅/❌
[ ] Test 3: Sync - ✅/❌
[ ] Test 4: List Pending - ✅/❌
[ ] Test 5: Salary - ✅/❌
[ ] Test 6: Restrictions - ✅/❌
[ ] Test 7: Frontend - ✅/❌

Resultado: ___/7 tests PASADOS
Porcentaje: ___%
```

---

## 🐛 Troubleshooting

| Problema | Causa | Solución |
|----------|-------|----------|
| 404 Not Found /api/rh/payroll | Rutas no registradas | Verificar router.py tiene `payroll_integration.router` |
| 401 Unauthorized | Token inválido/expirado | Obtener nuevo token con login |
| 422 Validation Error | Body JSON incorrecto | Verificar formato de request |
| "Vacación no existe" | ID vacaciones incorrecto | Verificar ID en ERP_HR_VACATION_REQUEST |
| "No tiene permisos" | Usuario no es admin | Usar token de admin para crear mapeos |
| "Salario no encontrado" | Empleado sin datos en NOI | Verificar ERP_NOI_EMPLEADOS tiene SalarioBase |

---

## ✨ Consideraciones

1. **Tokens JWT**: Expiran en 8 horas. Si vence, obtener uno nuevo.
2. **IDs dinámicos**: Los IDs generados variarán. Guardarlos de las responses.
3. **Timestamps**: Las fechas en respuestas están en UTC.
4. **Transacciones**: Cada sync a nómina es atómico (insert + update juntos).

---

**Guía creada**: 28 de abril de 2026  
**Versión**: 1.0  
**Estado**: Ready for Manual Testing  

¿Necesitas ayuda ejecutando algún test? Contacta al desarrollador.

