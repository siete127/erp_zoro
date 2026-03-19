# Integración de Productos Recurrentes en Ventas

## Cambios Implementados

### Funcionalidad Principal
Al crear una nueva venta, el sistema ahora:

1. **Muestra productos recurrentes del cliente seleccionado**
   - Al seleccionar un cliente, se cargan automáticamente sus productos recurrentes
   - Los productos recurrentes se muestran en una lista compacta y fácil de usar
   - Cada producto tiene un botón "Agregar" para añadirlo a la venta

2. **Permite cambiar entre productos recurrentes y catálogo completo**
   - Botón "Ver Catálogo Completo" para buscar cualquier producto
   - Botón "Ver Recurrentes" para volver a la lista de productos recurrentes
   - Si el cliente no tiene productos recurrentes, se muestra automáticamente el catálogo completo

3. **Permite agregar productos a la lista de recurrentes desde la venta**
   - Debajo de la tabla de productos de la venta, aparecen botones para cada producto que NO está en recurrentes
   - Al hacer clic en el botón "+ [SKU]", el producto se agrega a la lista de recurrentes del cliente
   - Útil para ir construyendo la lista de productos recurrentes mientras se trabaja

## Flujo de Uso

### Escenario 1: Cliente con productos recurrentes
1. Usuario selecciona un cliente
2. Sistema carga y muestra los productos recurrentes del cliente
3. Usuario hace clic en "Agregar" en los productos que necesita
4. Si necesita un producto que no está en recurrentes:
   - Hace clic en "Ver Catálogo Completo"
   - Busca y agrega el producto
   - Opcionalmente, lo agrega a recurrentes con el botón "+ [SKU]"

### Escenario 2: Cliente sin productos recurrentes
1. Usuario selecciona un cliente
2. Sistema detecta que no hay productos recurrentes
3. Muestra automáticamente el buscador de catálogo completo
4. Usuario busca y agrega productos
5. Puede agregar productos a recurrentes con los botones "+ [SKU]"

### Escenario 3: Construir lista de recurrentes
1. Usuario crea una venta normal
2. Agrega varios productos desde el catálogo
3. Al final, ve los botones "+ [SKU]" debajo de la tabla
4. Hace clic en los productos que quiere marcar como recurrentes
5. En la próxima venta, esos productos aparecerán en la lista de recurrentes

## Beneficios

### Para el Usuario
- **Más rápido**: No necesita buscar productos que compra frecuentemente
- **Menos errores**: Los productos recurrentes ya tienen el precio correcto
- **Flexible**: Puede cambiar al catálogo completo cuando lo necesite
- **Intuitivo**: La lista de recurrentes se construye naturalmente mientras trabaja

### Para el Negocio
- **Eficiencia**: Reduce el tiempo de captura de ventas
- **Consistencia**: Los clientes siempre ven sus productos habituales
- **Análisis**: Se puede identificar qué productos compra cada cliente
- **Inventario**: Facilita la planificación de stock por cliente

## Detalles Técnicos

### Frontend (NuevaVenta.jsx)
- Estado `recurringProducts`: Lista de productos recurrentes del cliente
- Estado `showAllProducts`: Controla si se muestra catálogo completo o recurrentes
- Función `fetchRecurringProducts()`: Carga productos recurrentes al seleccionar cliente
- Función `handleAddToRecurring()`: Agrega producto a lista de recurrentes

### API Endpoints Utilizados
- `GET /api/clients/:id/recurring-products` - Obtener productos recurrentes
- `POST /api/clients/:id/recurring-products` - Agregar producto a recurrentes

### Validaciones
- Solo se muestran productos recurrentes si hay un cliente seleccionado
- Los productos ya en recurrentes no aparecen en los botones de agregar
- Si no hay productos recurrentes, se muestra automáticamente el catálogo completo

## Interfaz de Usuario

### Vista de Productos Recurrentes
```
┌─────────────────────────────────────────┐
│ Productos    [Ver Catálogo Completo]    │
├─────────────────────────────────────────┤
│ Productos recurrentes de este cliente:  │
│                                          │
│ ┌─────────────────────────────────────┐ │
│ │ SKU-001  Producto A                 │ │
│ │ $100.00              [Agregar]      │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ SKU-002  Producto B                 │ │
│ │ $200.00              [Agregar]      │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### Botones de Agregar a Recurrentes
```
┌─────────────────────────────────────────┐
│ Productos de la venta                    │
├─────────────────────────────────────────┤
│ [Tabla de productos]                     │
│                                          │
│ Agregar a productos recurrentes:         │
│ [+ SKU-003] [+ SKU-004] [+ SKU-005]     │
└─────────────────────────────────────────┘
```

## Mejoras Futuras

1. **Cantidades sugeridas**: Recordar las cantidades típicas que compra cada cliente
2. **Orden de productos**: Ordenar por frecuencia de compra
3. **Precios personalizados**: Integrar con el módulo de precios por cliente
4. **Plantillas de venta**: Crear ventas completas basadas en productos recurrentes
5. **Estadísticas**: Mostrar cuántas veces se ha comprado cada producto recurrente
