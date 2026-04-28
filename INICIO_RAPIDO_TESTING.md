# 🚀 INICIO RÁPIDO - FASE 2 Testing

**Fecha**: 28 de abril de 2026  
**Objetivo**: Empezar testing en 5 minutos  
**Estado**: Ready ✅  

---

## ⚡ En 5 Minutos

### 1. Verifica la Tabla en BD (1 min)

```bash
# SQL Server Management Studio:
SELECT TOP 5 * FROM ERP_PAYROLL_LEAVE_MAPPING;

# Resultado esperado:
# Tabla vacía (0 registros) pero estructura creada ✅
```

### 2. Inicia Backend (2 min)

```bash
cd c:\Users\diazj\OneDrive\Escritorio\ERP_PROYECTO\erp_zoro_python
python -m uvicorn app.main:app --reload

# Espera mensaje:
# ✅ Uvicorn running on http://127.0.0.1:8000
```

### 3. Prueba un Endpoint (2 min)

```bash
# En otra terminal:
curl -X GET "http://localhost:8000/api/rh/payroll/concepts" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Resultado esperado:
# {
#   "conceptos": [
#     {"concepto_id": 5, "clave": "VAC", "descripcion": "Vacaciones"}
#   ]
# }
```

✅ **¡Funcionando!**

---

## 📋 Testing Completo (20 min)

Sigue: **TESTING_FASE2_NOMINA.md** (archivo en root)

```
1. Test Endpoints Disponibles (2 min)
2. Test Crear Vacación + Mapeo (5 min)
3. Test Sincronizar a Nómina (3 min)
4. Test Listar Pendientes (2 min)
5. Test Obtener Salario (2 min)
6. Test Validar Restricciones (3 min)
7. Test Frontend UI (3 min)
```

---

## 📚 Documentación

### Para Empezar
1. **RESUMEN_VISUAL_FASE2.md** (5 min) ← Diagramas y métricas
2. **TESTING_FASE2_NOMINA.md** (30 min) ← Testing paso a paso

### Para Entender
1. **INTEGRACION_NOMINA.md** (40 min) ← Documentación técnica
2. **INDICE_QUICK_REFERENCE_FASE2.md** (10 min) ← Referencia rápida

### Navegación
- **INDICE_CENTRALIZADO_FASE2.md** ← Matriz de qué leer

---

## 🎯 Objetivos de Testing

```
✅ Endpoints responden (200 OK)
✅ Base de datos registra cambios
✅ Cálculos son correctos
✅ Permisos funcionan (solo admin)
✅ Sincronización atómica
✅ Errores manejo correcto
✅ Frontend sin errores
```

---

## 💾 Verificar Instalación

### Backend
```bash
# Terminal 1
cd erp_zoro_python
python -m uvicorn app.main:app --reload
# ✅ Uvicorn running on http://127.0.0.1:8000
```

### Frontend
```bash
# Terminal 2
cd frontend
npm run dev
# ✅ Local: http://localhost:5173
```

### Base de Datos
```bash
# SQL Server:
SELECT COUNT(*) FROM ERP_PAYROLL_LEAVE_MAPPING;
# ✅ Resultado: 0 (tabla creada, vacía)

SELECT * FROM ERP_NOI_CONCEPTOS WHERE Clave='VAC';
# ✅ Resultado: Concepto VACACIONES existe
```

---

## 📞 Comandos Rápidos

### Login (obtener token)
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "password123"
  }' | jq '.access_token'
```

### Ver Conceptos
```bash
curl -X GET http://localhost:8000/api/rh/payroll/concepts \
  -H "Authorization: Bearer $TOKEN"
```

### Ver Pendientes
```bash
curl -X GET http://localhost:8000/api/rh/payroll/pending-mappings \
  -H "Authorization: Bearer $TOKEN"
```

### Ver Estadísticas
```bash
curl -X GET http://localhost:8000/api/rh/payroll/stats/pending \
  -H "Authorization: Bearer $TOKEN"
```

---

## ⚠️ Si Algo Falla

| Problema | Solución |
|----------|----------|
| 404 Not Found | Backend no iniciado, recargar en terminal |
| 401 Unauthorized | Token inválido, obtener nuevo con login |
| 422 Validation Error | Body JSON incorrecto, ver formato en TESTING_FASE2 |
| "Tabla no existe" | Ejecutar: `python setup_payroll_leave_mapping.py` |
| "Concepto no existe" | Ejecutar script de setup nuevamente |

---

## ✨ Checklist Mínimo

```
[ ] Backend iniciado y respondiendo
[ ] BD tiene tabla ERP_PAYROLL_LEAVE_MAPPING
[ ] Concepto VACACIONES creado (ID=5)
[ ] GET /payroll/concepts responde con VACACIONES
[ ] GET /payroll/stats/pending responde {por_estado: {...}}
```

Si todo ✅, estás listo para testing completo.

---

**¡Listo para empezar testing!** 🎊

Próximo: Abre **TESTING_FASE2_NOMINA.md** y sigue los 7 tests
