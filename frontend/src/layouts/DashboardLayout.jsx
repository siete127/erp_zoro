import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { FaUser, FaHome, FaBuilding, FaBoxOpen, FaCog, FaShoppingCart, FaHandshake, FaIndustry, FaChartBar, FaFileInvoiceDollar, FaCreditCard, FaIdCard } from "react-icons/fa";
import DashboardHeader from "./DashboardHeader";
import api from '../services/api';
import { loadUserPermissions } from '../services/permissionService';

const navItems = [
  { key: 'dashboard', to: "/dashboard", label: "Inicio", icon: FaHome },
  { key: 'users', to: "/users", label: "Usuarios", icon: FaUser },
  { key: 'rh', to: "/rh", label: "RH", icon: FaIdCard },
  { key: 'clients', to: "/clients", label: "Clientes", icon: FaBuilding },
  { key: 'crm', to: "/crm/oportunidades", label: "CRM", icon: FaHandshake },
  { key: 'sales', to: "/ventas", label: "Ventas", icon: FaShoppingCart },
  {
    key: 'purchases',
    to: "/compras",
    label: "Compras",
    icon: FaFileInvoiceDollar,
    children: [
      { key: 'compras-ordenes', to: "/compras", label: "Órdenes de Compra" },
      { key: 'compras-nueva', to: "/compras/nueva", label: "Nueva Orden de Compra" },
      { key: 'compras-directa', to: "/compras/registro-directo", label: "Registro Directo con Factura" },
    ],
  },
  {
    key: 'products',
    to: "/productos",
    label: "Productos",
    icon: FaBoxOpen,
    children: [
      { key: 'productos-catalogo', to: "/productos", label: "Catálogo de Productos" },
      { key: 'almacenes', to: "/productos/almacenes", label: "Almacenes" },
      { key: 'inventory', to: "/productos/inventario", label: "Inventario (Stock)" },
      { key: 'recepcion-pendiente', to: "/productos/recepcion-pendiente", label: "Recepciones Pendientes" },
      { key: 'movimientos', to: "/productos/movimientos", label: "Movimientos (Kardex)" },
      { key: 'transferencias', to: "/productos/transferencias", label: "Transferencias" },
      { key: 'lotes', to: "/productos/lotes", label: "Lotes / Caducidad" },
      { key: 'precios', to: "/productos/precios", label: "Catálogo de Precios" },
    ],
  },
  {
    key: 'production',
    to: "/produccion/ordenes",
    label: "Producción",
    icon: FaIndustry,
    children: [
      { key: 'ordenes-produccion', to: "/produccion/ordenes", label: "Órdenes de Producción" },
      { key: 'bom', to: "/produccion/bom", label: "Recetas de Producción" },
      { key: 'materias-primas', to: "/produccion/materias-primas", label: "Materias Primas" },
    ],
  },
  {
    key: 'reporteria',
    to: "/reporteria",
    label: "Reportería",
    icon: FaChartBar,
    children: [
      { key: 'reporteria-dashboard', to: "/reporteria", label: "Dashboard Reportes" },
      { key: 'notas-credito', to: "/notas-credito", label: "Notas de Crédito" },
      { key: 'complementos-pago', to: "/complementos-pago", label: "Complementos de Pago" },
    ],
  },
  { key: 'companies', to: "/configuracion", label: "Configuración", icon: FaCog },

];

// Helper: decode JWT payload without verification (for client-side use only)
function decodeTokenPayload(token) {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payload = parts[1];
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decodeURIComponent(escape(decoded)));
  } catch (e) {
    try {
      // fallback for environments without atob
      return JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
    } catch (err) {
      return null;
    }
  }
}

export default function DashboardLayout({ title, onLogout, children, fullWidth = false }) {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [enabledModules, setEnabledModules] = useState(null); // null = not loaded yet
  const [expandedMenus, setExpandedMenus] = useState({});

  const handleToggleMenu = () => setMenuOpen((prev) => !prev);
  const handleCloseMenu = () => setMenuOpen(false);
  const toggleSubmenu = (key) => {
    setExpandedMenus(prev => ({ ...prev, [key]: !prev[key] }));
  };

  useEffect(() => {
    const userId = localStorage.getItem('userId');
    if (!userId) {
      setEnabledModules(null);
      return;
    }

    let cancelled = false;

    const fetchPermissions = async () => {
      try {
        const perms = await loadUserPermissions(userId);
        if (cancelled) return;
        
        console.log('Permisos raw:', perms);
        
        // Si no hay permisos configurados, mostrar todos
        if (!perms || Object.keys(perms).length === 0) {
          console.log('Sin permisos configurados, mostrando todos');
          setEnabledModules(null);
          return;
        }
        
        // Obtener módulos habilitados y bloqueados
        const enabled = Object.keys(perms).filter(k => perms[k] === true);
        const blocked = Object.keys(perms).filter(k => perms[k] === false);
        
        console.log('Módulos habilitados:', enabled);
        console.log('Módulos bloqueados:', blocked);
        
        // Si NO hay bloqueados, mostrar todos
        if (blocked.length === 0) {
          console.log('Sin bloqueos, mostrando todos');
          setEnabledModules(null);
          return;
        }
        
        // Si hay bloqueados, mostrar solo los habilitados
        setEnabledModules(enabled.length > 0 ? enabled : []);
      } catch (err) {
        console.error('Error cargando permisos:', err);
        setEnabledModules(null);
      }
    };

    fetchPermissions();

    return () => { cancelled = true; };
  }, []);

  return (
    <div className="min-h-screen h-screen w-screen flex flex-col bg-[#E7E8E9] overflow-hidden relative">
      <aside
        className={`fixed inset-y-0 left-0 w-64 bg-white text-gray-800 flex flex-col shadow-lg transition-transform duration-300 ease-in-out z-40 overflow-hidden ${menuOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="py-6 px-4 flex items-center gap-2 flex-shrink-0">
          <FaHome className="text-2xl text-[#092052]" />
          <span className="text-xl font-bold">ERP Dashboard</span>
        </div>
        <nav className="flex-1 overflow-y-auto px-4 pb-4">
          <div className="flex flex-col gap-2">
          {/* Debug info */}
          {enabledModules !== null && enabledModules.length === 0 && (
            <div className="p-2 bg-red-100 text-red-800 text-xs rounded">
              Sin módulos habilitados
            </div>
          )}
          {navItems.filter(item => {
            // if enabledModules is null (not loaded or error), show all
            if (enabledModules === null) return true;
            const key = item.key || item.keyFallback || item.to.replace(/\//g, '');
            const isIncluded = enabledModules.includes(key);
            console.log(`Filtro: ${item.label} (${key}) -> ${isIncluded}`);
            return isIncluded;
          }).map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.to || (item.children && item.children.some(c => c.to === location.pathname));

            if (!item.children || item.children.length === 0) {
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={handleCloseMenu}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition ${isActive ? "bg-[#e7e8e9] text-[#092052]" : "text-gray-700 hover:bg-gray-100"}`}
                >
                  <Icon /> <span>{item.label}</span>
                </Link>
              );
            }

            return (
              <div key={item.to} className="mb-2">
                <div
                  onClick={() => toggleSubmenu(item.key)}
                  className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg transition cursor-pointer ${isActive ? "bg-[#e7e8e9] text-[#092052]" : "text-gray-700 hover:bg-gray-100"}`}
                >
                  <div className="flex items-center gap-2">
                    <Icon /> <span>{item.label}</span>
                  </div>
                  <svg className={`w-4 h-4 transition-transform duration-200 ${expandedMenus[item.key] ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                <div className={`overflow-hidden transition-all duration-300 ease-in-out ${expandedMenus[item.key] ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                  <div className="mt-1 ml-6 flex flex-col gap-1">
                    {item.children.map((child) => {
                      const childActive = location.pathname === child.to;
                      return (
                        <Link
                          key={child.to}
                          to={child.to}
                          onClick={handleCloseMenu}
                          className={`text-sm px-2 py-1 rounded-lg transition ${childActive ? "bg-[#e7e8e9] text-[#092052]" : "text-gray-700 hover:bg-gray-100"}`}
                        >
                          {child.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
          </div>
        </nav>
        <div className="flex-shrink-0 px-4 py-4 text-xs text-gray-400 border-t leading-relaxed">
          <span className="font-medium text-gray-500">© {new Date().getFullYear()} Ardaby Tec SA de CV</span>
          <br />
          <span>Todos los derechos reservados</span>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-h-0">
        <DashboardHeader title={title} onLogout={onLogout} menuOpen={menuOpen} onToggleMenu={handleToggleMenu} />
        <main className={`flex-1 min-h-0 overflow-auto p-6 md:p-8 ${fullWidth ? '' : 'flex items-center justify-center'}`}>
          {children}
        </main>
      </div>

      {menuOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-30"
          onClick={handleCloseMenu}
        ></div>
      )}
    </div>
  );
}
