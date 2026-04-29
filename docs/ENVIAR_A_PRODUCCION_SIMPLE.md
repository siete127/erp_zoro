# ENVIAR PRODUCTOS A PRODUCCIÓN - GUÍA SIMPLIFICADA

## 🚀 MÉTODO SIMPLIFICADO

### Opción 1: Enviar UN producto (Formato Simple)
```http
POST /api/ventas/123/ordenes-produccion
Content-Type: application/json

{
  "Producto_Id": 45,
  "Cantidad": 80
}
```

### Opción 2: Enviar MÚLTIPLES productos (Formato Array)
```http
POST /api/ventas/123/ordenes-produccion
Content-Type: application/json

{
  "productos": [
    { "Producto_Id": 45, "Cantidad": 80 },
    { "Producto_Id": 52, "Cantidad": 50 }
  ]
}
```

---

## 📋 FLUJO COMPLETO SIMPLIFICADO

### 1. Crear Venta
```json
POST /api/ventas
{
  "Company_Id": 1,
  "Client_Id": 5,
  "Moneda": "MXN"
}
```

### 2. Agregar Productos
```json
POST /api/ventas/productos
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

### 3. Intentar Facturar (Detecta Faltante)
```json
POST /api/ventas/123/facturar
{
  "UsoCFDI": "G03",
  "FormaPago": "01",
  "MetodoPago": "PUE"
}
```

**Respuesta con faltante:**
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
  ]
}
```

### 4. Enviar a Producción (SIMPLIFICADO)

**Opción A - Un solo producto:**
```json
POST /api/ventas/123/ordenes-produccion
{
  "Producto_Id": 45,
  "Cantidad": 80
}
```

**Opción B - Múltiples productos:**
```json
POST /api/ventas/123/ordenes-produccion
{
  "productos": [
    { "Producto_Id": 45, "Cantidad": 80 }
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

---

## 🎯 EJEMPLOS PRÁCTICOS

### Ejemplo 1: Producir Cajas de Cartón
```bash
# Venta requiere 1000 cajas, solo hay 200 en stock
# Faltante: 800 cajas

curl -X POST http://localhost:5000/api/ventas/123/ordenes-produccion \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "Producto_Id": 10,
    "Cantidad": 800
  }'
```

### Ejemplo 2: Producir Múltiples Productos
```bash
# Venta requiere varios productos con faltante

curl -X POST http://localhost:5000/api/ventas/456/ordenes-produccion \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "productos": [
      { "Producto_Id": 10, "Cantidad": 800 },
      { "Producto_Id": 15, "Cantidad": 500 },
      { "Producto_Id": 20, "Cantidad": 300 }
    ]
  }'
```

---

## ✅ VENTAJAS DEL MÉTODO SIMPLIFICADO

1. **Más fácil de usar**: No necesitas formato JSON complejo
2. **Flexible**: Acepta un producto o múltiples
3. **Intuitivo**: Campos claros (Producto_Id, Cantidad)
4. **Compatible**: Funciona con ambos formatos

---

## 🔄 FLUJO AUTOMÁTICO

Cuando envías productos a producción:

1. ✅ Se crean órdenes de producción automáticamente
2. ✅ Se asigna el BOM vigente del producto
3. ✅ Prioridad se establece en ALTA
4. ✅ Estado de venta cambia a "En Producción"
5. ✅ Se emiten notificaciones en tiempo real

---

## 📱 USO DESDE FRONTEND

```javascript
// Enviar un producto
const enviarAProduccion = async (ventaId, productoId, cantidad) => {
  const response = await api.post(`/ventas/${ventaId}/ordenes-produccion`, {
    Producto_Id: productoId,
    Cantidad: cantidad
  });
  return response.data;
};

// Enviar múltiples productos
const enviarVariosAProduccion = async (ventaId, productos) => {
  const response = await api.post(`/ventas/${ventaId}/ordenes-produccion`, {
    productos: productos // [{ Producto_Id, Cantidad }]
  });
  return response.data;
};
```

---

## 🎨 INTERFAZ DE USUARIO

El sistema incluye un modal visual que:
- Muestra productos con faltante
- Permite ajustar cantidades a producir
- Envía automáticamente con un clic
- Muestra confirmación de órdenes creadas

**No necesitas escribir JSON manualmente** ✨

---

## 🚨 VALIDACIONES

El sistema valida automáticamente:
- ✅ Producto existe
- ✅ Producto tiene BOM configurado
- ✅ Cantidad es mayor a 0
- ✅ Venta existe y no está facturada

---

## 📞 SOPORTE

**Formato antiguo (aún funciona):**
```json
{
  "productos": [{"Producto_Id":1,"Cantidad":10}]
}
```

**Formato nuevo (recomendado):**
```json
{
  "Producto_Id": 1,
  "Cantidad": 10
}
```

**¡Ambos funcionan!** 🎉
