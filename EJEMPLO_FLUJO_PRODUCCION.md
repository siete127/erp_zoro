# EJEMPLO: FLUJO DE PRODUCCIÓN BAJO PEDIDO

## 📋 ESCENARIO
Cliente solicita 100 unidades de "Silla Ejecutiva" pero solo hay 20 en inventario.

---

## 🔄 PASO A PASO

### 1. CREAR VENTA
```http
POST /api/ventas
Content-Type: application/json

{
  "Company_Id": 1,
  "Client_Id": 5,
  "Moneda": "MXN"
}
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "Venta_Id": 123,
    "Status": "Pendiente"
  }
}
```

---

### 2. AGREGAR PRODUCTOS
```http
POST /api/ventas/productos
Content-Type: application/json

{
  "Venta_Id": 123,
  "productos": [
    {
      "Producto_Id": 45,
      "Cantidad": 100,
      "PrecioUnitario": 2500.00
    }
  ]
}
```

---

### 3. INTENTAR FACTURAR (Detecta faltante)
```http
POST /api/ventas/123/facturar
Content-Type: application/json

{
  "UsoCFDI": "G03",
  "FormaPago": "01",
  "MetodoPago": "PUE"
}
```

**Respuesta (Error 400):**
```json
{
  "success": false,
  "message": "Inventario insuficiente. Se requiere producción.",
  "requiereProduccion": true,
  "productos": [
    {
      "Producto_Id": 45,
      "Nombre": "Silla Ejecutiva",
      "StockActual": 20,
      "CantidadRequerida": 100,
      "Faltante": 80,
      "TieneBOM": true
    }
  ],
  "sugerencia": "Crear órdenes de producción para los productos faltantes"
}
```

---

### 4. CREAR ORDEN DE PRODUCCIÓN
```http
POST /api/ventas/123/ordenes-produccion
Content-Type: application/json

{
  "productos": [
    {
      "Producto_Id": 45,
      "Cantidad": 80
    }
  ]
}
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Órdenes de producción creadas correctamente",
  "data": [
    {
      "OP_Id": 501,
      "NumeroOP": "OP-2024-12345",
      "Producto_Id": 45,
      "CantidadPlanificada": 80,
      "Estado": "EN_ESPERA",
      "Prioridad": "ALTA"
    }
  ]
}
```

**Estado de venta actualizado a:** "En Producción"

---

### 5. INICIAR PRODUCCIÓN
```http
PUT /api/produccion/ordenes/501/estado
Content-Type: application/json

{
  "Estado": "EN_PROCESO"
}
```

---

### 6. CERRAR ORDEN DE PRODUCCIÓN
```http
POST /api/produccion/ordenes/501/cerrar
Content-Type: application/json

{
  "consumos": [
    {
      "MateriaPrima_Id": 10,
      "CantidadTeorica": 40,
      "CantidadReal": 42,
      "UnidadConsumo": "KG"
    },
    {
      "MateriaPrima_Id": 11,
      "CantidadTeorica": 320,
      "CantidadReal": 320,
      "UnidadConsumo": "PZA"
    }
  ],
  "PiezasBuenas": 78,
  "PiezasMerma": 2,
  "Comentarios": "Producción completada con merma mínima",
  "OperadorCierre": "Juan Pérez"
}
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "OP_Id": 501
  }
}
```

---

### 7. REGISTRAR ENTRADA AL INVENTARIO
```http
POST /api/ventas/entrada-produccion
Content-Type: application/json

{
  "OP_Id": 501,
  "Almacen_Id": 1
}
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Entrada de producción registrada correctamente",
  "data": {
    "Stock_Anterior": 20,
    "Stock_Actual": 98
  }
}
```

**Movimiento en Kardex:**
- Tipo: ENTRADA
- Cantidad: 78
- Referencia: OP-2024-12345

---

### 8. FACTURAR VENTA (Ahora sí hay stock)
```http
POST /api/ventas/123/facturar
Content-Type: application/json

{
  "UsoCFDI": "G03",
  "FormaPago": "01",
  "MetodoPago": "PUE"
}
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Venta facturada correctamente",
  "data": {
    "Complement": {
      "TaxStamp": {
        "Uuid": "A1B2C3D4-E5F6-7890-ABCD-EF1234567890"
      }
    }
  }
}
```

**Movimiento automático en Kardex:**
- Tipo: SALIDA
- Cantidad: 100
- Referencia: Venta #123
- Stock Final: 98 - 100 = -2 (ERROR, necesita más producción)

---

## 📊 RESUMEN DEL FLUJO

```
1. Venta creada (100 unidades)
   ↓
2. Stock insuficiente (20 disponibles)
   ↓
3. Crear OP (80 unidades)
   ↓
4. Producción (78 buenas, 2 merma)
   ↓
5. Entrada inventario (+78 = 98 total)
   ↓
6. Facturar venta (-100)
   ↓
7. Stock final: -2 (FALTA PRODUCIR 2 MÁS)
```

---

## ⚠️ CONSIDERACIONES

1. **Stock insuficiente después de producción**: En este ejemplo, después de producir 78 unidades, el stock total es 98, pero se necesitan 100. Deberías:
   - Crear otra OP por 2 unidades, O
   - Ajustar la cantidad de la venta a 98 unidades

2. **Salida automática de inventario**: Actualmente NO se registra automáticamente al facturar. Debes implementarlo.

3. **Consumo de materia prima**: Al cerrar la OP, deberías descontar automáticamente las materias primas del inventario.

4. **Notificaciones en tiempo real**: El sistema emite eventos Socket.io:
   - `venta:changed`
   - `produccion:nueva`
   - `inventario:changed`

---

## 🔧 MEJORAS SUGERIDAS

1. **Crear OP automáticamente** al detectar faltante
2. **Descontar materia prima** al cerrar OP
3. **Registrar salida** automáticamente al facturar
4. **Validar stock total** antes de permitir facturación
5. **Alertas** cuando la producción no cubra la demanda
