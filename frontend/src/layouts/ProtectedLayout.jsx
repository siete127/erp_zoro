import React, { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import DashboardLayout from "./DashboardLayout";
import confirm from '../services/confirm';
import { clearCache as clearPermissionCache, loadUserPermissions } from '../services/permissionService';
import { socket } from '../services/socket';
import { getApiBase } from '../services/runtimeConfig';

const titlesByPath = {
  "/dashboard": "Panel Principal",
  "/users": "Usuarios",
  "/rh": "Recursos Humanos",
  "/clients": "Clientes",
  "/productos": "Productos",
  "/productos/importar": "Importar productos",
  "/productos/recepcion-pendiente": "Recepciones Pendientes",
  "/ventas": "Ventas",
  "/ventas/nueva": "Nueva venta",
  "/crm/oportunidades": "CRM - Oportunidades",
  "/crm/leads": "CRM - Leads",
  "/crm/equipos": "CRM - Equipos de Venta",
  "/compras": "Compras",
  "/compras/nueva": "Nueva Orden de Compra",
  "/compras/registro-directo": "Registro Directo de Compra",
  "/compras/requisiciones": "Requisiciones de Compra",
  "/compras/proveedores": "Proveedores",
  "/aprobaciones": "Aprobaciones",
  "/proyectos": "Proyectos",
  "/contabilidad": "Contabilidad",
  "/contabilidad/activos-fijos": "Activos Fijos",
  "/licencias": "Licencias",
  "/auditoria": "Auditoria",
  "/settings": "Configuración",
  "/nomina": "Nómina",
  "/asistencia": "Asistencia",
  "/superadmin/empresas": "Gestión de Empresas",
  "/superadmin/dashboard": "SuperAdmin - Dashboard",
  "/superadmin/admins": "SuperAdmin - Administradores",
  "/superadmin/permisos": "SuperAdmin - Solicitud de Permisos",
  "/mantenimiento": "Mantenimiento de Equipos",
  "/helpdesk": "Helpdesk",
  "/gastos": "Gastos de Empleados",
  "/website": "Website Público",
  "/marketing": "Email Marketing",
  "/flotilla": "Flotilla Vehicular",
  "/encuestas": "Encuestas",
  "/suscripciones": "Suscripciones",
};

export default function ProtectedLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isChecking, setIsChecking] = useState(true);
  const [permissions, setPermissions] = useState({});
  const title = location.pathname.startsWith('/proyectos/')
    ? "Detalle de Proyecto"
    : location.pathname.startsWith('/superadmin/')
    ? (titlesByPath[location.pathname] ?? "SuperAdmin")
    : (titlesByPath[location.pathname] ?? "Panel");
  const fullWidthPages = ['/users', '/rh', '/clients', '/productos', '/productos/importar', '/productos/almacenes', '/productos/inventario', '/productos/recepcion-pendiente', '/productos/movimientos', '/productos/transferencias', '/productos/lotes', '/productos/precios', '/ventas', '/ventas/nueva', '/crm/oportunidades', '/crm/leads', '/crm/equipos', '/produccion/ordenes', '/configuracion', '/reporteria', '/notas-credito', '/complementos-pago', '/licencias', '/auditoria', '/nomina', '/asistencia', '/superadmin/empresas', '/superadmin/dashboard', '/superadmin/admins', '/superadmin/permisos','/compras/requisiciones', '/compras/proveedores', '/aprobaciones', '/proyectos', '/contabilidad/activos-fijos', '/timesheets', '/mantenimiento', '/helpdesk', '/gastos', '/website', '/marketing', '/flotilla', '/encuestas', '/suscripciones'];
  const fullWidthPagesExtended = [...fullWidthPages, '/compras'];
  const isUsers = fullWidthPagesExtended.includes(location.pathname) || location.pathname.startsWith('/proyectos/') || location.pathname.startsWith('/superadmin/');

  const routePermissions = {
    '/dashboard': 'dashboard',
    '/users': 'users',
    '/rh': 'rh',
    '/clients': 'clients',
    '/productos': 'products',
    '/productos/importar': 'products',
    '/productos/almacenes': 'inventory',
    '/productos/inventario': 'inventory',
    '/productos/recepcion-pendiente': 'inventory',
    '/productos/movimientos': 'inventory',
    '/productos/transferencias': 'inventory',
    '/productos/lotes': 'inventory',
    '/productos/precios': 'products',
    '/ventas': 'sales',
    '/ventas/nueva': 'sales',
    '/cotizaciones': 'quotes',
    '/cotizaciones/nueva': 'quotes',
    '/crm/oportunidades': 'crm',
    '/crm/leads': 'crm',
    '/crm/equipos': 'crm',
    '/compras': 'purchases',
    '/compras/nueva': 'purchases',
    '/compras/registro-directo': 'purchases',
    '/compras/requisiciones': 'purchases',
    '/compras/proveedores': 'purchases',
    '/aprobaciones': 'purchases',
    '/proyectos': 'projects',
    '/produccion/ordenes': 'production',
    '/produccion/bom': 'bom',
    '/produccion/materias-primas': 'bom',
    '/configuracion': 'companies',
    '/reporteria': 'reporteria',
    '/notas-credito': 'reporteria',
    '/complementos-pago': 'reporteria',
    '/contabilidad': 'accounting',
    '/contabilidad/activos-fijos': 'fixed_assets',
    '/licencias': 'companies',
    '/auditoria': 'companies',
    '/nomina': 'rh',
    '/asistencia': 'rh',
    '/superadmin/empresas': 'superadmin',
    '/superadmin/dashboard': 'superadmin',
    '/superadmin/admins': 'superadmin',
    '/superadmin/permisos': 'superadmin',
    '/mantenimiento': 'production',
    '/helpdesk': 'helpdesk',
    '/gastos': 'expenses',
    '/website': 'website',
    '/marketing': 'marketing',
    '/flotilla': 'fleet',
    '/encuestas': 'surveys',
    '/suscripciones': 'subscriptions',
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/');
      return;
    }

    const userId = localStorage.getItem('userId');
    if (userId) {
      loadUserPermissions(userId)
        .then(perms => setPermissions(perms))
        .catch(() => {})
        .finally(() => setIsChecking(false));
    } else {
      setIsChecking(false);
    }
  }, [navigate]);

  useEffect(() => {
    if (isChecking) return;

    const requiredModule = routePermissions[location.pathname]
      || (location.pathname.startsWith('/proyectos/') ? 'projects' : undefined);
    if (requiredModule === 'superadmin') {
      // Only SuperAdmin can access this route — check JWT directly
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const parts = token.split('.');
          if (parts.length >= 2) {
            const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
            const isSuperAdmin = payload?.is_super_admin === true || Number(payload?.rol) === 1;
            if (!isSuperAdmin) navigate('/dashboard');
          }
        } catch { navigate('/dashboard'); }
      } else {
        navigate('/dashboard');
      }
      return;
    }
    if (requiredModule && permissions[requiredModule] === false) {
      navigate('/dashboard');
    }
  }, [location.pathname, permissions, isChecking, navigate]);

  const handleLogout = async () => {
    const ok = await confirm("¿Confirmas cerrar sesión?", "Cerrar sesión", "Cerrar", "Cancelar");
    if (!ok) return;
    const sessionId = localStorage.getItem('sessionId');
    try {
      // attempt to notify backend (best-effort)
      if (sessionId) {
        // fire and forget
        const base = getApiBase();
        fetch(`${base}/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
          body: JSON.stringify({ sessionId: Number(sessionId) })
        }).catch(err => console.warn('Logout notify failed', err));
      } else {
        const base = getApiBase();
        fetch(`${base}/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        }).catch(err => console.warn('Logout notify failed', err));
      }
    } finally {
      localStorage.removeItem("token");
      localStorage.removeItem("sessionId");
      localStorage.removeItem("user");
      localStorage.removeItem("userId");
      clearPermissionCache();
      socket.disconnect();
      navigate("/");
    }
  };

  if (isChecking) {
    return null;
  }

  return (
    <DashboardLayout title={title} onLogout={handleLogout} fullWidth={isUsers}>
      <Outlet />
    </DashboardLayout>
  );
}
