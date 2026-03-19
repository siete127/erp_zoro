# 🏭 SISTEMA DE PRODUCCIÓN BAJO PEDIDO

## 📖 DESCRIPCIÓN

Este módulo permite fabricar productos cuando son solicitados en una venta y no hay suficiente inventario disponible.

---

## 🚀 CONFIGURACIÓN INICIAL

### 1. Ejecutar script de datos de prueba
```sql
-- Ejecutar en SQL Server Management Studio
-- Archivo: EJEMPLO_DATOS_PRUEBA.sql
```

Esto creará:
- ✅ Producto: "Silla Ejecutiva" (SKU: SILLA-001)
- ✅ BOM con 3 materias primas (Madera, Tornillos, Tela)
- ✅ Stock inicial: 20 unidades
- ✅ Cliente de ejemplo
- ✅ Almacén principal

---

## 📋 FLUJO COMPLETO

### PASO 1: Crear Venta
```bash
curl -X POST http://localhost:3000/api/ventas \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "Company_Id": 1,
    "Client_Id": 1,
    "Moneda": "MXN"
  }'
```

**Respuesta:** `Venta_Id: 123`

---

### PASO 2: Agregar Productos
```bash
curl -X POST http://localhost:3000/api/ventas/123/productos \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "Venta_Id": 123,
    "productos": [
      {
        "Producto_Id": 1,
        "Cantidad": 100,
        "PrecioUnitario": 2500.00
      }
    ]
  }'
```

---

### PASO 3: Intentar Facturar (Detecta faltante)
```bash
curl -X POST http://localhost:3000/api/ventas/123/facturar \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "UsoCFDI": "G03",
    "FormaPago": "01",
    "MetodoPago": "PUE"
  }'
```

**Respuesta esperada (Error 400):**
```json
{
  "success": false,
  "message": "Inventario insuficiente. Se requiere producción.",
  "requiereProduccion": true,
  "productos": [
    {
      "Producto_Id": 1,
      "Nombre": "Silla Ejecutiva",
      "StockActual": 20,
      "CantidadRequerida": 100,
      "Faltante": 80,
      "TieneBOM": true
    }
  ]
}
```

---

### PASO 4: Crear Orden de Producción
```bash
curl -X POST http://localhost:3000/api/ventas/123/ordenes-produccion \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "productos": [
      {
        "Producto_Id": 1,
        "Cantidad": 80
      }
    ]
  }'
```

**Resultado:**
- ✅ OP creada: OP-2024-12345
- ✅ Estado: EN_ESPERA
- ✅ Venta actualizada a: "En Producción"

---

### PASO 5: Iniciar Producción
```bash
curl -X PUT http://localhost:3000/api/produccion/ordenes/501/estado \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "Estado": "EN_PROCESO"
  }'
```

---

### PASO 6: Cerrar Orden de Producción
```bash
curl -X POST http://localhost:3000/api/produccion/ordenes/501/cerrar \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "consumos": [
      {
        "MateriaPrima_Id": 1,
        "CantidadTeorica": 40,
        "CantidadReal": 42,
        "UnidadConsumo": "KG"
      },
      {
        "MateriaPrima_Id": 2,
        "CantidadTeorica": 320,
        "CantidadReal": 320,
        "UnidadConsumo": "PZA"
      },
      {
        "MateriaPrima_Id": 3,
        "CantidadTeorica": 8,
        "CantidadReal": 8,
        "UnidadConsumo": "M"
      }
    ],
    "PiezasBuenas": 78,
    "PiezasMerma": 2,
    "Comentarios": "Producción completada",
    "OperadorCierre": "Juan Pérez"
  }'
```

**Resultado:**
- ✅ Consumos registrados
- ✅ Resultado guardado: 78 buenas, 2 merma
- ✅ OP cerrada

---

### PASO 7: Registrar Entrada al Inventario
```bash
curl -X POST http://localhost:3000/api/ventas/entrada-produccion \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "OP_Id": 501,
    "Almacen_Id": 1
  }'
```

**Resultado:**
- ✅ Stock anterior: 20
- ✅ Entrada: +78
- ✅ Stock actual: 98
- ✅ Kardex actualizado

---

### PASO 8: Facturar Venta
```bash
curl -X POST http://localhost:3000/api/ventas/123/facturar \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "UsoCFDI": "G03",
    "FormaPago": "01",
    "MetodoPago": "PUE"
  }'
```

**Resultado:**
- ✅ CFDI generado
- ✅ Venta facturada
- ✅ UUID asignado

---

## 📊 CONSULTAS ÚTILES

### Ver órdenes de producción
```bash
curl -X GET "http://localhost:3000/api/produccion/ordenes?Company_Id=1&Estado=EN_PROCESO" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Ver detalle de OP
```bash
curl -X GET http://localhost:3000/api/produccion/ordenes/501 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Ver inventario
```bash
curl -X GET "http://localhost:3000/api/inventario?company_id=1" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Ver kardex
```bash
curl -X GET "http://localhost:3000/api/inventario/kardex?productoId=1" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 🔔 EVENTOS EN TIEMPO REAL (Socket.io)

El sistema emite eventos que puedes escuchar en el frontend:

```javascript
socket.on('venta:changed', (data) => {
  console.log('Venta actualizada:', data.Venta_Id);
});

socket.on('produccion:nueva', (data) => {
  console.log('Nuevas órdenes:', data.ordenes);
});

socket.on('inventario:changed', (data) => {
  console.log('Stock actualizado:', data);
});
```

---

## ⚠️ VALIDACIONES IMPORTANTES

1. **BOM requerido**: El producto debe tener un BOM vigente para poder crear OP
2. **Stock insuficiente**: Si después de producir sigue faltando stock, no se puede facturar
3. **OP cerrada**: Solo se puede registrar entrada de OPs en estado CERRADA
4. **Venta facturada**: No se puede modificar una venta ya facturada

---

## 🛠️ TABLAS INVOLUCRADAS

- `ERP_VENTAS` - Ventas
- `ERP_VENTA_DETALLE` - Detalle de ventas
- `ERP_OP_PRODUCCION` - Órdenes de producción
- `ERP_OP_CONSUMO_MATERIAL` - Consumos de materiales
- `ERP_OP_RESULTADO` - Resultados de producción
- `ERP_BOM` - Listas de materiales
- `ERP_BOM_DETALLE` - Componentes de BOM
- `ERP_STOCK` - Inventario de productos
- `ERP_KARDEX` - Movimientos de inventario
- `ERP_MATERIA_PRIMA` - Materias primas

---

## 📝 NOTAS

- El sistema NO descuenta automáticamente materia prima al cerrar OP (pendiente implementar)
- El sistema NO registra automáticamente salida al facturar (pendiente implementar)
- Se recomienda crear OP con cantidad ligeramente mayor para cubrir merma esperada
