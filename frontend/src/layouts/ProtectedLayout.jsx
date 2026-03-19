import React, { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import DashboardLayout from "./DashboardLayout";
import confirm from '../services/confirm';
import { loadUserPermissions } from '../services/permissionService';

const titlesByPath = {
  "/dashboard": "Panel Principal",
  "/users": "Usuarios",
  "/rh": "Recursos Humanos",
  "/clients": "Clientes",
  "/productos": "Productos",
  "/productos/importar": "Importar productos",
  "/ventas": "Ventas",
  "/ventas/nueva": "Nueva venta",
  "/crm/oportunidades": "CRM - Oportunidades",
  "/compras": "Compras",
  "/compras/nueva": "Nueva Orden de Compra",
  "/compras/registro-directo": "Registro Directo de Compra",
  "/settings": "Configuración",
};

export default function ProtectedLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isChecking, setIsChecking] = useState(true);
  const [permissions, setPermissions] = useState({});
  const title = titlesByPath[location.pathname] ?? "Panel";
  const fullWidthPages = ['/users', '/rh', '/clients', '/productos', '/productos/importar', '/productos/almacenes', '/productos/inventario', '/productos/movimientos', '/productos/transferencias', '/productos/lotes', '/productos/precios', '/ventas', '/ventas/nueva', '/crm/oportunidades', '/produccion/ordenes', '/configuracion', '/reporteria', '/notas-credito', '/complementos-pago'];
  const fullWidthPagesExtended = [...fullWidthPages, '/compras'];
  const isUsers = fullWidthPagesExtended.includes(location.pathname);

  const routePermissions = {
    '/dashboard': 'dashboard',
    '/users': 'users',
    '/rh': 'rh',
    '/clients': 'clients',
    '/productos': 'products',
    '/productos/importar': 'products',
    '/productos/almacenes': 'inventory',
    '/productos/inventario': 'inventory',
    '/productos/movimientos': 'inventory',
    '/productos/transferencias': 'inventory',
    '/productos/lotes': 'inventory',
    '/productos/precios': 'products',
    '/ventas': 'sales',
    '/ventas/nueva': 'sales',
    '/cotizaciones': 'quotes',
    '/cotizaciones/nueva': 'quotes',
    '/crm/oportunidades': 'crm',
    '/compras': 'purchases',
    '/compras/nueva': 'purchases',
    '/compras/registro-directo': 'purchases',
    '/produccion/ordenes': 'production',
    '/produccion/bom': 'bom',
    '/produccion/materias-primas': 'bom',
    '/configuracion': 'companies',
    '/reporteria': 'reporteria',
    '/notas-credito': 'reporteria',
    '/complementos-pago': 'reporteria'
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/');
      return;
    }

    const userId = localStorage.getItem('userId');
    if (userId) {
      loadUserPermissions(userId).then(perms => {
        setPermissions(perms);
        setIsChecking(false);
      });
    } else {
      setIsChecking(false);
    }
  }, [navigate]);

  useEffect(() => {
    if (isChecking) return;
    
    const requiredModule = routePermissions[location.pathname];
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
        const prodDefault = 'https://qaerp.ardabytec.vip/api';
        const base = import.meta.env.VITE_USE_PROD === 'true' ? (import.meta.env.VITE_API_BASE_PROD || prodDefault) : (import.meta.env.VITE_API_BASE_DEV || 'http://localhost:5000/api');
        fetch(`${base}/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
          body: JSON.stringify({ sessionId: Number(sessionId) })
        }).catch(err => console.warn('Logout notify failed', err));
      } else {
        const prodDefault = 'https://qaerp.ardabytec.vip/api';
        const base = import.meta.env.VITE_USE_PROD === 'true' ? (import.meta.env.VITE_API_BASE_PROD || prodDefault) : (import.meta.env.VITE_API_BASE_DEV || 'http://localhost:5000/api');
        fetch(`${base}/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        }).catch(err => console.warn('Logout notify failed', err));
      }
    } finally {
      localStorage.removeItem("token");
      localStorage.removeItem("sessionId");
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
