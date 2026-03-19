# Sistema de Solicitud de Cambio de Precio - Múltiples Productos

## Resumen de Cambios

Se ha implementado la funcionalidad para agrupar múltiples productos con cambios de precio en una sola solicitud de aprobación, en lugar de crear solicitudes individuales por cada producto.

## Cambios Implementados

### 1. Base de Datos

#### Nueva Tabla: `ERP_SOLICITUD_PRECIO_DETALLE`
- Almacena los detalles de productos para cada solicitud
- Permite que una solicitud agrupe múltiples productos
- Campos:
  - `Detalle_Id`: ID único del detalle
  - `Solicitud_Id`: Referencia a la solicitud principal
  - `Producto_Id`: ID del producto
  - `PrecioActual`: Precio actual del producto
  - `PrecioNuevo`: Precio nuevo solicitado

#### Modificaciones a `ERP_SOLICITUDES_CAMBIO_PRECIO`
- Las columnas `Producto_Id`, `PrecioActual` y `PrecioNuevo` ahora son opcionales (NULL)
- Mantiene compatibilidad con solicitudes individuales existentes
- Para solicitudes múltiples, los detalles se almacenan en `ERP_SOLICITUD_PRECIO_DETALLE`

### 2. Backend

#### Nuevo Endpoint: `/api/client-pricing/multi-price-change-request`
- Método: POST
- Crea una solicitud agrupada para múltiples productos
- Body:
  ```json
  {
    "clientId": 123,
    "products": [
      {
        "productId": 1,
        "currentPrice": 100.00,
        "newPrice": 95.00
      },
      {
        "productId": 2,
        "currentPrice": 200.00,
        "newPrice": 180.00
      }
    ],
    "approver1Email": "aprobador1@empresa.com",
    "approver2Email": "aprobador2@empresa.com",
    "reason": "Descuento por volumen",
    "saleId": null
  }
  ```

#### Función: `createMultiPriceChangeRequest`
- Crea la solicitud principal en `ERP_SOLICITUDES_CAMBIO_PRECIO`
- Inserta los detalles de cada producto en `ERP_SOLICITUD_PRECIO_DETALLE`
- Envía emails de aprobación a ambos aprobadores

#### Función: `sendMultiProductApprovalEmails`
- Envía emails personalizados indicando el número de productos
- Incluye enlaces de aprobación/rechazo

#### Modificación: `approvePriceChange`
- Ahora detecta si es una solicitud múltiple o individual
- Para solicitudes múltiples, actualiza todos los productos de `ERP_SOLICITUD_PRECIO_DETALLE`
- Mantiene compatibilidad con solicitudes individuales

### 3. Frontend

#### Nuevo Componente: `MultiProductPriceChangeModal.jsx`
- Modal para solicitar cambios de precio de múltiples productos
- Muestra lista de productos con precios originales y nuevos
- Campos de aprobadores y razón del cambio

#### Modificaciones a `NuevaVenta.jsx`
- **Eliminado**: Sistema de solicitudes individuales por producto
- **Agregado**: Sistema de solicitud única agrupada
- **Nuevo botón**: "Solicitar Aprobación" que aparece cuando hay productos con precios modificados
- **Estado simplificado**: Un solo objeto `priceChangeRequest` en lugar de array
- **Detección automática**: Identifica productos con cambios de precio
- **Bloqueo de guardado**: No permite guardar hasta que la solicitud sea aprobada

#### Modificaciones a `TablaProductos.jsx`
- **Eliminado**: Botón "Solicitar" individual por producto
- **Agregado**: Resaltado visual (borde naranja) en precios modificados
- Simplificación de la interfaz

### 4. Flujo de Usuario

#### Antes (Solicitudes Individuales)
1. Usuario modifica precio de Producto A → Click "Solicitar" → Solicitud 1
2. Usuario modifica precio de Producto B → Click "Solicitar" → Solicitud 2
3. Usuario modifica precio de Producto C → Click "Solicitar" → Solicitud 3
4. Esperar aprobación de 3 solicitudes separadas

#### Ahora (Solicitud Agrupada)
1. Usuario modifica precios de Productos A, B y C
2. Sistema detecta automáticamente los cambios
3. Aparece banner: "Cambios de Precio Detectados - 3 producto(s)"
4. Click en "Solicitar Aprobación" → Se crea UNA solicitud con los 3 productos
5. Esperar aprobación de una sola solicitud

## Ventajas del Nuevo Sistema

1. **Menos emails**: Los aprobadores reciben 1 email en lugar de N emails
2. **Proceso más rápido**: Una sola aprobación para todos los productos
3. **Mejor UX**: Interfaz más limpia y menos clicks
4. **Contexto completo**: Los aprobadores ven todos los cambios juntos
5. **Menos errores**: Reduce la posibilidad de aprobar solo algunos productos

## Migración

### Ejecutar Script de Migración
```sql
-- Ejecutar en SQL Server Management Studio
-- Archivo: backend/sql/migration_multi_product.sql
```

El script:
- Crea la tabla `ERP_SOLICITUD_PRECIO_DETALLE`
- Migra datos existentes automáticamente
- Hace opcionales las columnas de producto en la tabla principal
- Mantiene compatibilidad con solicitudes existentes

### Reiniciar Backend
```bash
cd backend
npm start
```

### Reiniciar Frontend
```bash
cd frontend
npm run dev
```

## Compatibilidad

- ✅ Solicitudes individuales existentes siguen funcionando
- ✅ El endpoint antiguo `/api/client-pricing/price-change-request` sigue disponible
- ✅ Los emails de aprobación funcionan para ambos tipos
- ✅ La lógica de aprobación dual se mantiene igual

## Archivos Modificados

### Backend
- `backend/controllers/clientPricingController.js` - Nuevo endpoint y lógica
- `backend/routes/clientPricing.routes.js` - Nueva ruta
- `backend/sql/solicitud_multiple_productos.sql` - Schema inicial
- `backend/sql/migration_multi_product.sql` - Script de migración

### Frontend
- `frontend/src/components/MultiProductPriceChangeModal.jsx` - Nuevo componente
- `frontend/src/pages/NuevaVenta.jsx` - Lógica actualizada
- `frontend/src/pages/ventas/TablaProductos.jsx` - UI simplificada

## Testing

### Caso de Prueba 1: Solicitud Múltiple
1. Crear nueva venta
2. Seleccionar cliente
3. Agregar 3 productos
4. Modificar precio de los 3 productos
5. Verificar que aparece banner "Cambios de Precio Detectados"
6. Click "Solicitar Aprobación"
7. Verificar que se crea una sola solicitud
8. Verificar que se envían 2 emails (uno por aprobador)
9. Aprobar desde ambos emails
10. Verificar que todos los precios se actualizan

### Caso de Prueba 2: Solicitud con 1 Producto
1. Crear nueva venta
2. Agregar 1 producto
3. Modificar precio
4. Click "Solicitar Aprobación"
5. Verificar funcionamiento normal

### Caso de Prueba 3: Rechazo
1. Crear solicitud múltiple
2. Rechazar desde un aprobador
3. Verificar que la solicitud se marca como rechazada
4. Verificar que no se puede guardar la venta

## Notas Técnicas

- La tabla `ERP_SOLICITUD_PRECIO_DETALLE` usa CASCADE DELETE para limpiar automáticamente
- Los emails incluyen el número de productos en el asunto
- El frontend hace polling cada 10 segundos para actualizar el estado
- Los precios modificados se resaltan con borde naranja en la tabla
