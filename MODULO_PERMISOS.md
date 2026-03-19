# Módulo de Permisos por Usuario

## Descripción
Sistema de permisos que permite al superadmin controlar el acceso a módulos específicos por usuario, sobrescribiendo los permisos del rol.

## Instalación

### 1. Ejecutar SQL
Ejecuta el archivo `backend/sql/permisos_schema.sql` en SQL Server Management Studio para crear las tablas necesarias.

### 2. Reiniciar Backend
```bash
cd backend
node server.js
```

## Estructura

### Tablas Creadas
- **ERP_MODULES**: Catálogo de módulos del sistema
- **ERP_USER_PERMISSIONS**: Permisos personalizados por usuario

### Lógica de Permisos
1. Si el usuario tiene un permiso personalizado → usa ese permiso
2. Si no, hereda el permiso del rol (ERP_ROLE_MODULES)
3. Si no existe en ninguno → sin acceso

## API Endpoints

### Obtener módulos disponibles
```
GET /api/permissions/modules
```

### Obtener permisos de un usuario
```
GET /api/permissions/user/:userId
```

### Actualizar permisos de un usuario
```
PUT /api/permissions/user/:userId
Body: {
  permissions: [
    { ModuleKey: "dashboard", CanAccess: true },
    { ModuleKey: "users", CanAccess: false }
  ]
}
```

### Verificar permiso específico
```
GET /api/permissions/check/:userId/:moduleKey
```

## Uso en Frontend

### Componente de Gestión de Permisos
```jsx
import UserPermissions from '../components/UserPermissions';

// En tu componente de usuarios
<UserPermissions 
  userId={selectedUser.User_Id}
  userName={selectedUser.Username}
  onClose={() => setShowPermissions(false)}
/>
```

### Verificar Permisos en Componentes
```jsx
// Opción 1: Llamada directa
const checkAccess = async (moduleKey) => {
  const { data } = await api.get(`/permissions/check/${userId}/${moduleKey}`);
  return data.hasAccess;
};

// Opción 2: Cargar todos los permisos al inicio
const { data } = await api.get(`/permissions/user/${userId}`);
const permissions = data.data.reduce((acc, p) => {
  acc[p.ModuleKey] = p.CanAccess;
  return acc;
}, {});

// Usar en el render
{permissions.dashboard && <DashboardModule />}
{permissions.users && <UsersModule />}
```

## Módulos Disponibles

- `dashboard` - Dashboard
- `users` - Usuarios
- `roles` - Roles
- `companies` - Empresas
- `clients` - Clientes
- `products` - Productos
- `bom` - BOM
- `inventory` - Inventario
- `production` - Producción
- `sales` - Ventas
- `invoices` - Facturas
- `quotes` - Cotizaciones
- `crm` - CRM
- `reports` - Reportes

## Ejemplo de Uso Completo

### 1. En la página de usuarios, agregar botón de permisos:
```jsx
<button onClick={() => {
  setSelectedUser(user);
  setShowPermissions(true);
}}>
  🔒 Permisos
</button>

{showPermissions && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <UserPermissions 
      userId={selectedUser.User_Id}
      userName={selectedUser.Username}
      onClose={() => setShowPermissions(false)}
    />
  </div>
)}
```

### 2. Proteger rutas en el frontend:
```jsx
// En App.jsx o router
const ProtectedRoute = ({ moduleKey, children }) => {
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const checkPermission = async () => {
      const userId = localStorage.getItem('userId');
      const { data } = await api.get(`/permissions/check/${userId}/${moduleKey}`);
      setHasAccess(data.hasAccess);
      setLoading(false);
    };
    checkPermission();
  }, [moduleKey]);
  
  if (loading) return <div>Cargando...</div>;
  if (!hasAccess) return <div>Sin acceso</div>;
  return children;
};

// Uso
<Route path="/users" element={
  <ProtectedRoute moduleKey="users">
    <UsersPage />
  </ProtectedRoute>
} />
```

## Notas Importantes

1. Los permisos personalizados SIEMPRE sobrescriben los del rol
2. Si eliminas un permiso personalizado, el usuario vuelve a heredar del rol
3. El superadmin debe tener acceso a todos los módulos
4. Los cambios de permisos son inmediatos
