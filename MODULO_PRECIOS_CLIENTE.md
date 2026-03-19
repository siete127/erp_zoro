# Sistema de Precios Personalizados por Cliente

## Descripción
Sistema de gestión de precios personalizados por cliente con aprobación dual para cambios de precio.

## Características

### 1. Precios Personalizados
- Cada cliente puede tener precios específicos para productos
- Los precios personalizados sobrescriben el precio base del producto
- Historial de cambios de precios

### 2. Sistema de Aprobación Dual
- Cualquier cambio de precio requiere la aprobación de 2 personas
- Se envían emails automáticos a ambos aprobadores
- El cambio solo se aplica cuando ambos aprueban
- Si uno rechaza, la solicitud se cancela automáticamente

## Instalación

### 1. Ejecutar Scripts SQL
```bash
# Ejecutar en SQL Server Management Studio
backend/sql/client_pricing_schema.sql
```

### 2. Configurar Variables de Entorno
El sistema usa el emailService existente que ya está configurado en `.env`:
```
EMAIL_USER=tecardaby@gmail.com
EMAIL_PASSWORD=rstb looi gmmf kmwx
FRONTEND_URL=https://qaerp.ardabytec.vip
```

### 3. Instalar Dependencias
El sistema usa `nodemailer` que ya está instalado.

## Uso

### API Endpoints

#### 1. Obtener precios de un cliente
```
GET /api/client-pricing/client/:clientId/prices
```
Retorna todos los productos con sus precios base y personalizados.

#### 2. Crear solicitud de cambio de precio
```
POST /api/client-pricing/price-change-request
Body: {
  clientId: number,
  productId: number,
  newPrice: number,
  approver1Email: string,
  approver2Email: string,
  reason: string (opcional)
}
```

#### 3. Aprobar/Rechazar solicitud
```
POST /api/client-pricing/price-change-request/:requestId/approve
Body: {
  approverEmail: string,
  action: 'approve' | 'reject'
}
```

#### 4. Obtener solicitudes pendientes
```
GET /api/client-pricing/price-change-requests/pending
```

### Flujo de Trabajo

1. **Solicitar Cambio de Precio**
   - Usuario selecciona un cliente y producto
   - Ingresa el nuevo precio
   - Especifica 2 emails de aprobadores
   - Opcionalmente agrega una razón

2. **Notificación**
   - Se envían emails automáticos a ambos aprobadores
   - Los emails contienen un link directo para aprobar/rechazar

3. **Primera Aprobación**
   - Aprobador 1 recibe el email
   - Hace clic en el link
   - Aprueba o rechaza
   - Estado: "Esperando segunda aprobación"

4. **Segunda Aprobación**
   - Aprobador 2 recibe el email
   - Hace clic en el link
   - Aprueba o rechaza

5. **Aplicación del Cambio**
   - Si ambos aprueban: El precio se actualiza automáticamente
   - Si uno rechaza: La solicitud se cancela

## Componentes Frontend

### ClientPricing.jsx
Componente principal para gestionar precios por cliente:
- Lista de productos con precios base y personalizados
- Botón para solicitar cambio de precio
- Modal para crear solicitud
- Lista de solicitudes pendientes

### ApprovePriceChange.jsx
Página de aprobación:
- Muestra detalles de la solicitud
- Estado de ambas aprobaciones
- Botones para aprobar/rechazar

## Integración

### En el detalle de cliente:
```jsx
import ClientPricing from './components/ClientPricing';

// Dentro del componente de detalle de cliente
<ClientPricing clientId={clientId} />
```

### Agregar ruta de aprobación:
```jsx
// En tu router principal
import ApprovePriceChange from './pages/ApprovePriceChange';

<Route path="/approve-price/:requestId" element={<ApprovePriceChange />} />
```

## Base de Datos

### Tablas Creadas

#### ERP_CLIENT_PRODUCT_PRICES
Almacena los precios personalizados por cliente.
- ClientPrice_Id (PK)
- Client_Id (FK)
- Product_Id (FK)
- CustomPrice
- IsActive
- CreatedBy, CreatedAt, UpdatedAt

#### ERP_PRICE_CHANGE_REQUESTS
Almacena las solicitudes de cambio de precio.
- Request_Id (PK)
- Client_Id (FK)
- Product_Id (FK)
- CurrentPrice
- NewPrice
- RequestedBy (FK)
- Approver1_Email, Approver2_Email
- Approver1_Status, Approver2_Status
- Approver1_Date, Approver2_Date
- Status (pending, approved, rejected, completed)
- Reason
- CreatedAt, CompletedAt

## Seguridad

- Los endpoints de consulta requieren autenticación (authMiddleware)
- El endpoint de aprobación es público pero requiere el email del aprobador
- Se valida que el email coincida con uno de los aprobadores registrados
- Las transacciones de base de datos usan rollback en caso de error

## Notificaciones por Email

Los emails incluyen:
- Información del cliente y producto
- Precio actual y nuevo precio
- Link directo para aprobar/rechazar
- Diseño profesional con estilos inline
- Compatible con todos los clientes de email

## Ejemplo de Uso

```javascript
// Solicitar cambio de precio
const response = await axios.post('/api/client-pricing/price-change-request', {
  clientId: 123,
  productId: 456,
  newPrice: 99.99,
  approver1Email: 'gerente@empresa.com',
  approver2Email: 'director@empresa.com',
  reason: 'Cliente frecuente, descuento especial'
});

// El sistema enviará emails automáticamente
// Los aprobadores recibirán links como:
// https://qaerp.ardabytec.vip/approve-price/789
```

## Notas Importantes

1. Se requiere que ambos aprobadores aprueben para aplicar el cambio
2. Si uno rechaza, la solicitud se cancela inmediatamente
3. Los emails se envían usando el servicio existente de Gmail
4. El sistema mantiene un historial completo de todas las solicitudes
5. Los precios personalizados sobrescriben el precio base del producto
