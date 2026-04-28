import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  FaArchive,
  FaBuilding,
  FaCalculator,
  FaCalendarCheck,
  FaCar,
  FaChartBar,
  FaChartLine,
  FaClipboardList,
  FaCog,
  FaCreditCard,
  FaEnvelope,
  FaFileInvoiceDollar,
  FaFolderOpen,
  FaGlobe,
  FaHandshake,
  FaHeadset,
  FaHome,
  FaIdCard,
  FaIndustry,
  FaMoneyCheckAlt,
  FaPoll,
  FaReceipt,
  FaRecycle,
  FaShoppingCart,
  FaSitemap,
  FaTasks,
  FaUser,
  FaUserTie,
  FaBoxOpen,
  FaWrench,
} from "react-icons/fa";
import DashboardHeader from "./DashboardHeader";
import { loadUserPermissions } from "../services/permissionService";

const navItems = [
  { key: "dashboard", to: "/dashboard", label: "Inicio", icon: FaHome },
  { key: "users", to: "/users", label: "Usuarios", icon: FaUser },
  { key: "rh", to: "/rh", label: "RH", icon: FaIdCard },
  { key: "clients", to: "/clients", label: "Clientes", icon: FaBuilding },
  {
    key: "crm",
    to: "/crm/oportunidades",
    label: "CRM",
    icon: FaHandshake,
    children: [
      { key: "crm-oportunidades", to: "/crm/oportunidades", label: "Oportunidades" },
      { key: "crm-leads", to: "/crm/leads", label: "Leads" },
      { key: "crm-equipos", to: "/crm/equipos", label: "Equipos de Venta" },
    ],
  },
  { key: "sales", to: "/ventas", label: "Ventas", icon: FaShoppingCart },
  {
    key: "purchases",
    to: "/compras",
    label: "Compras",
    icon: FaFileInvoiceDollar,
    children: [
      { key: "compras-ordenes", to: "/compras", label: "\u00d3rdenes de Compra" },
      { key: "compras-nueva", to: "/compras/nueva", label: "Nueva Orden de Compra" },
      { key: "compras-directa", to: "/compras/registro-directo", label: "Registro Directo con Factura" },
      { key: "compras-requisiciones", to: "/compras/requisiciones", label: "Requisiciones" },
      { key: "compras-proveedores", to: "/compras/proveedores", label: "Proveedores" },
    ],
  },
  {
    key: "products",
    to: "/productos",
    label: "Productos",
    icon: FaBoxOpen,
    children: [
      { key: "productos-catalogo", to: "/productos", label: "Cat\u00e1logo de Productos" },
      { key: "almacenes", to: "/productos/almacenes", label: "Almacenes" },
      { key: "inventory", to: "/productos/inventario", label: "Inventario (Stock)" },
      { key: "recepcion-pendiente", to: "/productos/recepcion-pendiente", label: "Recepciones Pendientes" },
      { key: "movimientos", to: "/productos/movimientos", label: "Movimientos (Kardex)" },
      { key: "transferencias", to: "/productos/transferencias", label: "Transferencias" },
      { key: "lotes", to: "/productos/lotes", label: "Lotes / Caducidad" },
      { key: "precios", to: "/productos/precios", label: "Cat\u00e1logo de Precios" },
    ],
  },
  {
    key: "production",
    to: "/produccion/ordenes",
    label: "Producci\u00f3n",
    icon: FaIndustry,
    children: [
      { key: "ordenes-produccion", to: "/produccion/ordenes", label: "\u00d3rdenes de Producci\u00f3n" },
      { key: "bom", to: "/produccion/bom", label: "Recetas de Producci\u00f3n" },
      { key: "materias-primas", to: "/produccion/materias-primas", label: "Materias Primas" },
    ],
  },
  { key: "mantenimiento", to: "/mantenimiento", label: "Mantenimiento", icon: FaWrench },
  {
    key: "reporteria",
    to: "/reporteria",
    label: "Reporter\u00eda",
    icon: FaChartBar,
    children: [
      { key: "reporteria-dashboard", to: "/reporteria", label: "Dashboard Reportes" },
      { key: "notas-credito", to: "/notas-credito", label: "Notas de Cr\u00e9dito" },
      { key: "complementos-pago", to: "/complementos-pago", label: "Complementos de Pago" },
    ],
  },
  { key: "aprobaciones", to: "/aprobaciones", label: "Aprobaciones", icon: FaClipboardList },
  { key: "tareas", to: "/tareas", label: "Tareas", icon: FaTasks },
  { key: "projects", permissionKey: "projects", to: "/proyectos", label: "Proyectos", icon: FaFolderOpen },
  { key: "nomina", permissionKey: "rh", to: "/nomina", label: "N\u00f3mina", icon: FaMoneyCheckAlt },
  { key: "asistencia", permissionKey: "rh", to: "/asistencia", label: "Asistencia", icon: FaCalendarCheck },
  { key: "accounting", to: "/contabilidad", label: "Contabilidad", icon: FaCalculator },
  { key: "fixed_assets", permissionKey: "fixed_assets", to: "/contabilidad/activos-fijos", label: "Activos Fijos", icon: FaArchive },
  { key: "licenses", permissionKey: "companies", to: "/licencias", label: "Licencias", icon: FaCreditCard },
  { key: "audit", permissionKey: "companies", to: "/auditoria", label: "Auditor\u00eda", icon: FaClipboardList },
  { key: "helpdesk", permissionKey: "helpdesk", to: "/helpdesk", label: "Helpdesk", icon: FaHeadset },
  { key: "expenses", permissionKey: "expenses", to: "/gastos", label: "Gastos", icon: FaReceipt },
  { key: "website", permissionKey: "website", to: "/website", label: "Website", icon: FaGlobe },
  { key: "marketing", permissionKey: "marketing", to: "/marketing", label: "Marketing", icon: FaEnvelope },
  { key: "fleet", permissionKey: "fleet", to: "/flotilla", label: "Flotilla", icon: FaCar },
  { key: "surveys", permissionKey: "surveys", to: "/encuestas", label: "Encuestas", icon: FaPoll },
  { key: "subscriptions", permissionKey: "subscriptions", to: "/suscripciones", label: "Suscripciones", icon: FaRecycle },
  { key: "companies", to: "/configuracion", label: "Configuraci\u00f3n", icon: FaCog },
  {
    key: "superadmin",
    to: "/superadmin/dashboard",
    label: "SuperAdmin",
    icon: FaSitemap,
    children: [
      { key: "superadmin-dashboard", to: "/superadmin/dashboard", label: "Dashboard Global", icon: FaChartLine },
      { key: "superadmin-empresas", to: "/superadmin/empresas", label: "Empresas", icon: FaBuilding },
      { key: "superadmin-admins", to: "/superadmin/admins", label: "Admins", icon: FaUserTie },
      { key: "superadmin-permisos", to: "/superadmin/permisos", label: "Solicitud de Permisos", icon: FaClipboardList },
    ],
  },
];

const groupLabels = {
  dashboard: "General",
  crm: "Comercial",
  products: "Operaci\u00f3n",
  accounting: "Administraci\u00f3n",
  superadmin: "SuperAdmin",
};

const sidebarStyles = {
  panel:
    "fixed inset-y-0 left-0 w-[19rem] sm:w-72 bg-[#f6f3eb]/96 text-slate-800 flex flex-col border-r border-[#d7d1c4] shadow-[0_24px_60px_rgba(9,32,82,0.16)] backdrop-blur-xl transition-transform duration-300 ease-out z-40 overflow-hidden",
  navShell:
    "mx-2 sm:mx-3 rounded-[26px] border border-white/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(247,243,235,0.9))] shadow-[inset_0_1px_0_rgba(255,255,255,0.96),0_18px_45px_rgba(9,32,82,0.08)] backdrop-blur-sm",
  itemBase:
    "group relative flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-[14px] sm:text-[15px] font-medium tracking-[0.01em] transition-all duration-200",
  itemIdle: "text-slate-700 hover:bg-white hover:text-[#092052] hover:shadow-[0_10px_24px_rgba(9,32,82,0.08)]",
  itemActive:
    "bg-gradient-to-r from-[#092052] via-[#12356e] to-[#19458f] text-white shadow-[0_14px_30px_rgba(9,32,82,0.24)] ring-1 ring-[#0f2f61]/20",
  iconWrap:
    "flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-2xl border border-white/70 bg-white/80 text-[14px] sm:text-[15px] shadow-sm transition-colors duration-200",
  iconActive: "border-white/25 bg-white/14 text-white shadow-none",
  subPanel:
    "ml-3 sm:ml-4 mt-2 overflow-hidden rounded-[22px] border border-[#ccd8ec] bg-[linear-gradient(180deg,#fdfefe,#f4f8ff)] px-2 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.98),0_12px_28px_rgba(15,45,93,0.08)]",
  subItem:
    "group relative flex items-center rounded-xl px-3 py-2 text-[13px] sm:text-sm font-medium text-slate-600 transition-all duration-200 hover:bg-white hover:text-[#12356e]",
  subItemActive:
    "bg-[#e7eefb] text-[#0f2f61] shadow-[inset_0_0_0_1px_rgba(18,53,110,0.08)]",
  footer:
    "mx-3 mb-3 rounded-[22px] border border-white/85 bg-gradient-to-br from-white/92 to-[#f0ebe0]/92 px-4 py-3 text-[11px] leading-relaxed text-slate-500 shadow-[0_14px_30px_rgba(9,32,82,0.08)]",
};

function decodeTokenPayload(token) {
  if (!token) return null;
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = parts[1];
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decodeURIComponent(escape(decoded)));
  } catch {
    return null;
  }
}

function getItemPermissionKey(item) {
  return item.permissionKey || item.key || item.keyFallback || item.to.replace(/\//g, "");
}

function buildVisibleItems(enabledModules, isSuperAdmin) {
  return navItems.filter((item) => {
    if (item.key === "superadmin") return isSuperAdmin;
    if (enabledModules === null) return true;
    return enabledModules.includes(getItemPermissionKey(item));
  });
}

export default function DashboardLayout({ title, onLogout, children, fullWidth = false }) {
  const location = useLocation();
  const token = localStorage.getItem("token");
  const payload = decodeTokenPayload(token);
  const originalToken = localStorage.getItem("superadmin_original_token");
  const impersonationName = localStorage.getItem("superadmin_impersonate_name");
  const [menuOpen, setMenuOpen] = useState(false);
  const [enabledModules, setEnabledModules] = useState(null);
  const [expandedMenus, setExpandedMenus] = useState({});
  const [isSuperAdmin] = useState(
    payload?.is_super_admin === true || payload?.rol === 1 || Number(payload?.rol) === 1
  );
  const [impersonando] = useState(originalToken ? impersonationName || "Empresa" : null);

  const salirImpersonacion = () => {
    const originalToken = localStorage.getItem("superadmin_original_token");
    if (originalToken) localStorage.setItem("token", originalToken);
    localStorage.removeItem("superadmin_original_token");
    localStorage.removeItem("superadmin_impersonate_name");
    window.location.href = "/superadmin/empresas";
  };

  const handleToggleMenu = () => setMenuOpen((prev) => !prev);
  const handleCloseMenu = () => setMenuOpen(false);
  const toggleSubmenu = (key) => {
    setExpandedMenus((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  useEffect(() => {
    const userId = localStorage.getItem("userId");
    if (!userId) {
      return;
    }

    let cancelled = false;

    const fetchPermissions = async () => {
      try {
        const perms = await loadUserPermissions(userId);
        if (cancelled) return;

        if (!perms || Object.keys(perms).length === 0) {
          setEnabledModules(null);
          return;
        }

        const enabled = Object.keys(perms).filter((key) => perms[key] === true);
        const blocked = Object.keys(perms).filter((key) => perms[key] === false);

        if (blocked.length === 0) {
          setEnabledModules(null);
          return;
        }

        setEnabledModules(enabled.length > 0 ? enabled : []);
      } catch (error) {
        console.error("Error cargando permisos:", error);
        setEnabledModules(null);
      }
    };

    fetchPermissions();

    return () => {
      cancelled = true;
    };
  }, []);

  const visibleItems = buildVisibleItems(enabledModules, isSuperAdmin);

  return (
    <div className="relative flex h-screen min-h-screen w-screen flex-col overflow-hidden bg-[#e7e8e9]">
      <aside className={`${sidebarStyles.panel} ${menuOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="relative flex-shrink-0 overflow-hidden border-b border-white/60 px-3 pb-4 pt-4 sm:px-4 sm:pb-5 sm:pt-5">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.8),_transparent_48%),linear-gradient(180deg,_rgba(9,32,82,0.98),_rgba(18,53,110,0.92))]" />
          <div className="relative rounded-[28px] border border-white/15 bg-white/10 px-4 py-4 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-white/10 shadow-[0_12px_30px_rgba(0,0,0,0.15)]">
                <FaHome className="text-lg" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-white/65">Ardaby Tec</p>
                <p className="truncate text-lg font-semibold tracking-[0.01em]">ERP Dashboard</p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/12 bg-black/10 px-3 py-2 text-[11px] text-white/72">
              <span className="uppercase tracking-[0.24em]">Navegaci\u00f3n</span>
              <span className="rounded-full bg-white/12 px-2.5 py-1 font-semibold text-white">Premium</span>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3 sm:px-3 sm:py-4">
          <div className={`${sidebarStyles.navShell} px-2 py-3`}>
            {enabledModules !== null && enabledModules.length === 0 && (
              <div className="mx-2 mb-3 rounded-2xl border border-red-200 bg-gradient-to-r from-red-50 via-white to-red-50 px-3.5 py-3 text-xs font-medium text-red-700 shadow-sm">
                Sin m\u00f3dulos habilitados
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              {visibleItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  location.pathname === item.to ||
                  (item.children && item.children.some((child) => child.to === location.pathname));
                const isExpanded =
                  expandedMenus[item.key] ??
                  (item.children ? item.children.some((child) => child.to === location.pathname) : false);
                const showGroupLabel = !!groupLabels[item.key];

                if (!item.children || item.children.length === 0) {
                  return (
                    <React.Fragment key={item.to}>
                      {showGroupLabel && (
                        <div className="mb-1 mt-3 px-3 first:mt-0 sm:mt-4">
                          <div className="flex items-center gap-2">
                            <span className="h-px flex-1 bg-gradient-to-r from-[#d7d1c4] to-transparent" />
                            <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400">
                              {groupLabels[item.key]}
                            </span>
                          </div>
                        </div>
                      )}

                      <Link
                        to={item.to}
                        onClick={handleCloseMenu}
                        className={`${sidebarStyles.itemBase} ${isActive ? sidebarStyles.itemActive : sidebarStyles.itemIdle}`}
                      >
                        <span
                          className={`${sidebarStyles.iconWrap} ${
                            isActive
                              ? sidebarStyles.iconActive
                              : "border-[#d8dde7] bg-white text-[#12356e] group-hover:border-[#c4d0e5] group-hover:bg-[#f7faff]"
                          }`}
                        >
                          <Icon />
                        </span>
                        <span className="flex-1 truncate">{item.label}</span>
                        {isActive && (
                          <span className="h-8 w-1 rounded-full bg-white/80 shadow-[0_0_18px_rgba(255,255,255,0.55)]" />
                        )}
                      </Link>
                    </React.Fragment>
                  );
                }

                return (
                  <React.Fragment key={item.to}>
                    {showGroupLabel && (
                      <div className="mb-1 mt-3 px-3 first:mt-0 sm:mt-4">
                        <div className="flex items-center gap-2">
                          <span className="h-px flex-1 bg-gradient-to-r from-[#d7d1c4] to-transparent" />
                          <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400">
                            {groupLabels[item.key]}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="rounded-[24px] border border-transparent bg-transparent p-1 transition-colors duration-200 hover:border-white/70 hover:bg-white/30">
                      <button
                        type="button"
                        onClick={() => toggleSubmenu(item.key)}
                        className={`${sidebarStyles.itemBase} w-full text-left ${
                          isActive ? sidebarStyles.itemActive : sidebarStyles.itemIdle
                        }`}
                      >
                        <span
                          className={`${sidebarStyles.iconWrap} ${
                            isActive
                              ? sidebarStyles.iconActive
                              : "border-[#d8dde7] bg-white text-[#12356e] group-hover:border-[#c4d0e5] group-hover:bg-[#f7faff]"
                          }`}
                        >
                          <Icon />
                        </span>
                        <span className="flex-1 truncate">{item.label}</span>
                        <span
                          className={`flex h-9 w-9 items-center justify-center rounded-2xl border transition-all duration-200 ${
                            isActive
                              ? "border-white/20 bg-white/10 text-white"
                              : "border-[#d8dde7] bg-white/90 text-slate-500 group-hover:border-[#c4d0e5] group-hover:text-[#12356e]"
                          }`}
                        >
                          <svg
                            className={`h-4 w-4 transition-transform duration-300 ${isExpanded ? "rotate-90" : ""}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.3} d="M9 6l6 6-6 6" />
                          </svg>
                        </span>
                      </button>

                      <div
                        className={`grid transition-all duration-300 ease-out ${
                          isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                        }`}
                      >
                        <div className="overflow-hidden">
                          <div className={sidebarStyles.subPanel}>
                            <div className="mb-2 flex items-center gap-2 px-2">
                              <span className="h-7 w-1 rounded-full bg-gradient-to-b from-[#12356e] to-[#82a7ec]" />
                              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">
                                Accesos directos
                              </p>
                            </div>

                            <div className="space-y-1">
                              {item.children.map((child) => {
                                const childActive = location.pathname === child.to;
                                return (
                                  <Link
                                    key={child.to}
                                    to={child.to}
                                    onClick={handleCloseMenu}
                                    className={`${sidebarStyles.subItem} ${
                                      childActive ? sidebarStyles.subItemActive : ""
                                    }`}
                                  >
                                    <span
                                      className={`mr-3 h-2.5 w-2.5 rounded-full transition-colors ${
                                        childActive ? "bg-[#12356e]" : "bg-slate-300 group-hover:bg-[#9fb6e6]"
                                      }`}
                                    />
                                    <span className="truncate">{child.label}</span>
                                  </Link>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </nav>

        <div className={sidebarStyles.footer}>
          <p className="font-semibold uppercase tracking-[0.2em] text-slate-400">Ardaby Tec SA de CV</p>
          <p className="mt-2 text-slate-500">
            {"\u00a9"} {new Date().getFullYear()} Todos los derechos reservados.
          </p>
        </div>
      </aside>

      <div className="flex min-h-0 flex-1 flex-col">
        {impersonando && (
          <div className="z-50 flex flex-shrink-0 items-center justify-between bg-amber-500 px-4 py-2 text-sm font-medium text-white shadow-sm">
            <span>
              Modo empresa: <strong>{impersonando}</strong> - est\u00e1s viendo el sistema como admin de esta empresa
            </span>
            <button
              onClick={salirImpersonacion}
              className="rounded-lg bg-white px-3 py-1 text-xs font-semibold text-amber-700 transition hover:bg-amber-100"
            >
              Salir
            </button>
          </div>
        )}

        <DashboardHeader title={title} onLogout={onLogout} menuOpen={menuOpen} onToggleMenu={handleToggleMenu} />

        <main className={`flex-1 min-h-0 overflow-auto p-6 md:p-8 ${fullWidth ? "" : "flex items-center justify-center"}`}>
          {children}
        </main>
      </div>

      {menuOpen && <div className="fixed inset-0 z-30 bg-[#091a37]/30 backdrop-blur-[1px]" onClick={handleCloseMenu} />}
    </div>
  );
}
