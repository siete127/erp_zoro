# Módulo de Productos Recurrentes por Cliente

## Descripción
Este módulo permite gestionar productos recurrentes para cada cliente, facilitando la creación de ventas y cotizaciones al tener una lista predefinida de productos que cada cliente compra frecuentemente.

## Características

### 1. Gestión de Productos Recurrentes
- Cada cliente puede tener su propia lista de productos recurrentes
- Los productos se pueden agregar desde el catálogo completo
- Los productos se pueden eliminar de la lista de recurrentes
- Solo se muestran productos activos

### 2. Interfaz de Usuario
- Botón "Productos" en la lista de clientes
- Modal con lista de productos recurrentes del cliente
- Búsqueda en tiempo real en el catálogo completo
- Información detallada de cada producto (SKU, nombre, descripción, precio)

### 3. API Endpoints

#### Obtener productos recurrentes
```
GET /api/clients/:id/recurring-products
```
Retorna la lista de productos recurrentes del cliente con información completa del producto.

#### Agregar producto recurrente
```
POST /api/clients/:id/recurring-products
Body: { "Producto_Id": 123 }
```
Agrega un producto a la lista de recurrentes del cliente.

#### Eliminar producto recurrente
```
DELETE /api/clients/:id/recurring-products/:productId
```
Elimina un producto de la lista de recurrentes del cliente.

## Instalación

### 1. Base de Datos
Ejecutar el script de instalación:
```bash
install-recurring-products.bat
```

O ejecutar manualmente el SQL:
```bash
sqlcmd -S localhost -d ERP_DB -E -i "backend\sql\client_recurring_products_schema.sql"
```

### 2. Backend
Los archivos ya están creados:
- `backend/controllers/clientRecurringProductsController.js` - Controlador
- `backend/routes/client.routes.js` - Rutas actualizadas

### 3. Frontend
Los archivos ya están creados:
- `frontend/src/components/ClientRecurringProducts.jsx` - Componente principal
- `frontend/src/pages/clients/Clients.jsx` - Actualizado con botón de productos

## Uso

### Para el Usuario Final

1. **Ver productos recurrentes de un cliente:**
   - Ir a la lista de clientes
   - Hacer clic en el botón "Productos" del cliente deseado
   - Se abrirá un modal con la lista de productos recurrentes

2. **Agregar un producto recurrente:**
   - En el modal de productos recurrentes, hacer clic en "Agregar Producto"
   - Se abrirá el catálogo completo de productos
   - Usar la búsqueda para encontrar el producto deseado
   - Hacer clic en "Agregar" en el producto deseado

3. **Eliminar un producto recurrente:**
   - En el modal de productos recurrentes
   - Hacer clic en "Eliminar" en el producto que se desea quitar
   - Confirmar la acción

### Casos de Uso

1. **Ventas Rápidas:**
   - Al crear una venta para un cliente, se pueden consultar sus productos recurrentes
   - Facilita la selección de productos sin buscar en todo el catálogo

2. **Cotizaciones:**
   - Al crear cotizaciones, se puede partir de los productos recurrentes del cliente
   - Agiliza el proceso de cotización

3. **Análisis de Clientes:**
   - Permite identificar qué productos compra cada cliente frecuentemente
   - Facilita la gestión de inventario y compras

## Estructura de la Base de Datos

### Tabla: ERP_CLIENT_RECURRING_PRODUCTS
```sql
RecurringProduct_Id INT IDENTITY(1,1) PRIMARY KEY
Client_Id INT NOT NULL (FK -> ERP_CLIENT)
Producto_Id INT NOT NULL (FK -> ERP_PRODUCTOS)
CreatedAt DATETIME DEFAULT GETDATE()
CONSTRAINT UQ_ClientProduct UNIQUE (Client_Id, Producto_Id)
```

### Relaciones
- Relación con `ERP_CLIENT` con CASCADE DELETE
- Relación con `ERP_PRODUCTOS` con CASCADE DELETE
- Constraint único para evitar duplicados (Client_Id, Producto_Id)

## Validaciones

### Backend
- Validación de IDs numéricos válidos
- Verificación de existencia del producto
- Verificación de que el producto esté activo
- Prevención de duplicados mediante constraint UNIQUE

### Frontend
- Filtrado de productos ya agregados en el catálogo
- Confirmación antes de eliminar
- Búsqueda en tiempo real
- Manejo de errores con notificaciones

## Mejoras Futuras

1. **Integración con Ventas:**
   - Botón para cargar productos recurrentes al crear una venta
   - Sugerencias automáticas basadas en productos recurrentes

2. **Integración con Cotizaciones:**
   - Plantillas de cotización basadas en productos recurrentes
   - Carga rápida de productos recurrentes

3. **Estadísticas:**
   - Frecuencia de compra de productos recurrentes
   - Análisis de tendencias por cliente

4. **Precios Personalizados:**
   - Integración con el módulo de precios por cliente
   - Mostrar precio personalizado en productos recurrentes

## Notas Técnicas

- Los productos recurrentes solo incluyen productos activos
- Al eliminar un cliente, se eliminan automáticamente sus productos recurrentes (CASCADE)
- Al eliminar un producto, se elimina automáticamente de todas las listas de recurrentes (CASCADE)
- La búsqueda en el catálogo es case-insensitive
- El modal de productos recurrentes tiene z-index 50, el modal de catálogo tiene z-index 60
