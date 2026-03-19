# Filtrado de Datos por Empresa según Rol de Usuario

## Descripción
Implementación de filtrado automático de datos basado en las empresas asignadas a cada usuario. Los usuarios regulares solo ven información de sus empresas asignadas, mientras que superadmin y admin ven toda la información.

## Roles y Permisos

### SuperAdmin (RolId = 1)
- Ve TODA la información del sistema
- Sin restricciones de empresa
- Acceso completo a todos los módulos

### Admin (RolId = 2)
- Ve TODA la información del sistema
- Sin restricciones de empresa
- Puede filtrar por empresa específica si lo desea

### Usuarios Regulares (RolId > 2)
- Solo ven información de las empresas asignadas en `ERP_USERCOMPANIES`
- Filtrado automático en todos los módulos
- No pueden ver datos de otras empresas

## Cambios Implementados

### 1. Backend - AuthController
**Archivo**: `backend/controllers/authController.js`

**Cambios**:
- El login ahora incluye las empresas del usuario en el token JWT
- Se consulta `ERP_USERCOMPANIES` al hacer login
- El token incluye: `{ id, rol, companies: [1, 2, 3] }`

### 2. Backend - AuthMiddleware
**Archivo**: `backend/middleware/authMiddleware.js`

**Cambios**:
- Carga las empresas del usuario desde `ERP_USERCOMPANIES`
- Agrega al request:
  - `req.userCompanies`: Array de Company_Id del usuario
  - `req.isSuperAdmin`: true si RolId === 1
  - `req.isAdmin`: true si RolId === 1 o 2

### 3. Backend - ClientController
**Archivo**: `backend/controllers/clientController.js`

**Función actualizada**: `list()`

**Lógica**:
```javascript
if (!req.isAdmin && req.userCompanies.length > 0) {
  // Filtrar solo clientes de empresas del usuario
  WHERE cc.Company_Id IN (userCompanies)
} else if (companyId !== 'all') {
  // Admin: filtrar por empresa específica
  WHERE cc.Company_Id = companyId
} else {
  // Admin: todos los clientes
}
```

### 4. Backend - ProductoController
**Archivo**: `backend/controllers/productoController.js`

**Función actualizada**: `list()`

**Lógica**:
```javascript
if (!req.isAdmin && req.userCompanies.length > 0) {
  // Filtrar solo productos de empresas del usuario
  AND EXISTS (SELECT 1 FROM ERP_PRODUCTO_EMPRESA 
              WHERE Company_Id IN (userCompanies))
} else if (company_id !== 'all') {
  // Admin: filtrar por empresa específica
  AND EXISTS (SELECT 1 FROM ERP_PRODUCTO_EMPRESA 
              WHERE Company_Id = company_id)
}
```

### 5. Backend - VentaController
**Archivo**: `backend/controllers/ventaController.js`

**Función actualizada**: `getVentas()`

**Lógica**:
```javascript
if (!req.isAdmin && req.userCompanies.length > 0) {
  // Filtrar solo ventas de empresas del usuario
  WHERE v.Company_Id IN (userCompanies)
} else if (Company_Id) {
  // Admin: filtrar por empresa específica
  WHERE v.Company_Id = Company_Id
}
```

## Tablas Involucradas

### ERP_USERCOMPANIES
Relaciona usuarios con empresas:
```sql
User_Id INT
Company_Id INT
```

### ERP_CLIENTCOMPANIES
Relaciona clientes con empresas:
```sql
Client_Id INT
Company_Id INT
```

### ERP_PRODUCTO_EMPRESA
Relaciona productos con empresas:
```sql
Producto_Id INT
Company_Id INT
```

### ERP_VENTAS
Las ventas tienen Company_Id directo:
```sql
Venta_Id INT
Company_Id INT
...
```

## Flujo de Autenticación

1. **Usuario hace login**
   - Sistema valida credenciales
   - Consulta empresas del usuario en `ERP_USERCOMPANIES`
   - Genera token JWT con empresas incluidas

2. **Usuario hace request**
   - AuthMiddleware valida token
   - Carga empresas del usuario
   - Determina si es admin (RolId 1 o 2)
   - Agrega info al request

3. **Controlador procesa request**
   - Verifica `req.isAdmin`
   - Si NO es admin: filtra por `req.userCompanies`
   - Si es admin: muestra todo o filtra por parámetro

## Ejemplos de Uso

### Ejemplo 1: Usuario Regular
```
Usuario: Juan (RolId = 3)
Empresas: [1, 3]

GET /api/clients
→ Solo ve clientes de empresas 1 y 3

GET /api/productos
→ Solo ve productos de empresas 1 y 3

GET /api/ventas
→ Solo ve ventas de empresas 1 y 3
```

### Ejemplo 2: Admin
```
Usuario: Admin (RolId = 2)
Empresas: [1]

GET /api/clients
→ Ve TODOS los clientes

GET /api/clients?company_id=2
→ Ve solo clientes de empresa 2

GET /api/productos
→ Ve TODOS los productos
```

### Ejemplo 3: SuperAdmin
```
Usuario: SuperAdmin (RolId = 1)
Empresas: []

GET /api/clients
→ Ve TODOS los clientes

GET /api/productos
→ Ve TODOS los productos

GET /api/ventas
→ Ve TODAS las ventas
```

## Ventajas

1. **Seguridad**: Los usuarios solo ven su información
2. **Multiempresa**: Soporte nativo para múltiples empresas
3. **Flexible**: Admin puede ver todo o filtrar
4. **Automático**: El filtrado es transparente para el frontend
5. **Escalable**: Fácil agregar más módulos con el mismo patrón

## Módulos Actualizados

- ✅ Clientes
- ✅ Productos
- ✅ Ventas

## Módulos Pendientes (Aplicar mismo patrón)

- Cotizaciones
- Facturas
- Inventario/Almacenes
- Órdenes de Producción
- CRM/Oportunidades
- Reportes

## Patrón para Nuevos Módulos

```javascript
exports.list = async (req, res) => {
  try {
    let query = 'SELECT * FROM TABLA WHERE 1=1';
    const request = pool.request();

    // Filtrar por empresa del usuario si no es admin
    if (!req.isAdmin && req.userCompanies && req.userCompanies.length > 0) {
      const placeholders = req.userCompanies.map((_, idx) => `@company${idx}`).join(',');
      req.userCompanies.forEach((cid, idx) => {
        request.input(`company${idx}`, sql.Int, cid);
      });
      query += ` AND Company_Id IN (${placeholders})`;
    } else if (req.query.company_id) {
      // Admin con filtro específico
      query += ' AND Company_Id = @company_id';
      request.input('company_id', sql.Int, req.query.company_id);
    }

    const result = await request.query(query);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error' });
  }
};
```

## Notas Importantes

1. **RolId 1 y 2 son admin**: Ajustar según tu sistema
2. **Sin empresas asignadas**: Usuario regular sin empresas no ve nada
3. **Admin sin filtro**: Ve todo por defecto
4. **Frontend**: No requiere cambios, el filtrado es automático
5. **Performance**: Los índices en Company_Id son importantes

## Testing

### Caso 1: Usuario sin empresas
- Crear usuario sin registros en `ERP_USERCOMPANIES`
- Login → No debe ver ningún dato

### Caso 2: Usuario con 1 empresa
- Asignar empresa 1 al usuario
- Login → Solo ve datos de empresa 1

### Caso 3: Usuario con múltiples empresas
- Asignar empresas 1, 2, 3 al usuario
- Login → Ve datos de empresas 1, 2 y 3

### Caso 4: Admin
- Login como admin (RolId 1 o 2)
- Debe ver todos los datos sin restricción
