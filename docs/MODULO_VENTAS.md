# Módulo de Ventas - ERP

## Descripción
Sistema completo de ventas con flujo: **Productos → Venta → Facturación CFDI**

## Estructura del Proyecto

### Backend
```
backend/
├── controllers/
│   └── ventaController.js       # Lógica de negocio de ventas
├── routes/
│   └── venta.routes.js          # Endpoints REST
└── scripts/
    └── insertVentaStatus.sql    # Script SQL para estatus
```

### Frontend
```
frontend/src/
├── components/ventas/           # Componentes modulares
│   ├── ClienteSelector.jsx      # Selector de cliente
│   ├── ProductoBuscador.jsx     # Búsqueda de productos
│   ├── TablaProductos.jsx       # Tabla de productos
│   ├── ModalFacturacion.jsx     # Modal CFDI
│   ├── StatusBadge.jsx          # Badge de estatus
│   └── index.js                 # Exportaciones
├── pages/
│   ├── NuevaVenta.jsx           # Crear venta
│   ├── ListaVentas.jsx          # Listar ventas
│   └── DetalleVenta.jsx         # Ver detalle
└── services/
    └── ventaService.js          # API calls
```

## Estatus de Ventas

| ID | Nombre | Descripción |
|----|--------|-------------|
| 1  | Pendiente | Venta creada, pendiente de completar |
| 2  | Completada | Venta completada, lista para facturar |
| 3  | Facturada | Venta facturada con CFDI generado |
| 4  | Cancelada | Venta cancelada |

## API Endpoints

### Crear Venta
```http
POST /api/ventas
Authorization: Bearer {token}
Content-Type: application/json

{
  "Company_Id": 1,
  "ClienteRFC": "XAXX010101000",
  "ClienteNombre": "Cliente Ejemplo",
  "Moneda": "MXN"
}
```

### Agregar Productos
```http
POST /api/ventas/:id/productos
Authorization: Bearer {token}
Content-Type: application/json

{
  "Venta_Id": 1,
  "productos": [
    {
      "Producto_Id": 1,
      "Cantidad": 2,
      "PrecioUnitario": 100.00
    }
  ]
}
```

### Obtener Venta con Detalle
```http
GET /api/ventas/:id
Authorization: Bearer {token}
```

### Listar Ventas
```http
GET /api/ventas?Company_Id=1&Status_Id=2
Authorization: Bearer {token}
```

### Facturar Venta
```http
POST /api/ventas/:id/facturar
Authorization: Bearer {token}
Content-Type: application/json

{
  "UsoCFDI": "G03",
  "FormaPago": "01",
  "MetodoPago": "PUE"
}
```

### Cancelar Venta
```http
PUT /api/ventas/:id/cancelar
Authorization: Bearer {token}
```

### Obtener Estatus
```http
GET /api/ventas/status
Authorization: Bearer {token}
```

## Flujo de Trabajo

### 1. Crear Nueva Venta
1. Usuario accede a `/ventas/nueva`
2. Selecciona o ingresa datos del cliente
3. Sistema crea venta en estatus **Pendiente**

### 2. Agregar Productos
1. Busca productos por nombre o código
2. Agrega productos a la venta
3. Modifica cantidades y precios
4. Sistema calcula automáticamente:
   - Subtotal por producto
   - IVA (16%)
   - Total

### 3. Guardar Venta
1. Sistema guarda productos en `ERP_VENTA_DETALLE`
2. Actualiza totales en `ERP_VENTAS`
3. Cambia estatus a **Completada**

### 4. Facturar Venta
1. Usuario accede al detalle de la venta
2. Click en "Facturar Venta"
3. Configura datos CFDI:
   - Uso de CFDI
   - Forma de Pago
   - Método de Pago
4. Sistema envía a PAC (Facturama)
5. Cambia estatus a **Facturada**

## Componentes Modulares

### ClienteSelector
Componente reutilizable para seleccionar o ingresar datos del cliente.

**Props:**
- `onClienteSelect`: Callback con datos del cliente
- `clienteData`: Datos actuales del cliente

### ProductoBuscador
Componente para buscar y agregar productos.

**Props:**
- `onAgregarProducto`: Callback al agregar producto

### TablaProductos
Tabla editable/readonly de productos.

**Props:**
- `productos`: Array de productos
- `onActualizar`: Callback para actualizar producto
- `onEliminar`: Callback para eliminar producto
- `editable`: Boolean para modo edición

### ModalFacturacion
Modal para configurar datos de facturación CFDI.

**Props:**
- `isOpen`: Boolean para mostrar/ocultar
- `onClose`: Callback para cerrar
- `onFacturar`: Callback con datos CFDI

### StatusBadge
Badge visual para mostrar estatus de venta.

**Props:**
- `statusId`: ID del estatus
- `statusNombre`: Nombre del estatus

## Instalación

### 1. Base de Datos
```sql
-- Ejecutar script SQL
cd backend/scripts
sqlcmd -S localhost -d ERP -i insertVentaStatus.sql
```

### 2. Backend
```bash
cd backend
# Ya está configurado en server.js
npm start
```

### 3. Frontend
```bash
cd frontend
# Las rutas ya están en App.jsx
npm run dev
```

## Uso

1. **Acceder al módulo**: Navegar a `/ventas`
2. **Nueva venta**: Click en "+ Nueva Venta"
3. **Seleccionar cliente**: Elegir de la lista o ingresar manualmente
4. **Agregar productos**: Buscar y agregar productos
5. **Guardar**: Click en "Guardar Venta"
6. **Facturar**: Desde el detalle, click en "📄 Facturar Venta"

## Notas Técnicas

- **IVA**: Calculado automáticamente al 16%
- **Transacciones**: Uso de transacciones SQL para integridad
- **Validaciones**: 
  - Cliente requerido
  - Al menos un producto
  - Cantidades > 0
  - Solo ventas completadas pueden facturarse
- **Integración PAC**: Requiere configuración de Facturama en `.env`

## Variables de Entorno

```env
# Backend .env
FACTURAMA_API_URL=https://api.facturama.mx
FACTURAMA_USER=your_user
FACTURAMA_PASSWORD=your_password
```

## Mejoras Futuras

- [ ] Descuentos por producto
- [ ] Múltiples impuestos
- [ ] Cotizaciones
- [ ] Pedidos
- [ ] Reportes de ventas
- [ ] Exportar a Excel/PDF
- [ ] Envío de factura por email
- [ ] Cancelación de CFDI
