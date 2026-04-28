import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useParams, useNavigate } from 'react-router-dom';
import {
  FaChartBar, FaUsers, FaUserShield, FaDollarSign, FaShoppingCart,
  FaFileInvoice, FaIdCard, FaPuzzlePiece, FaClipboardList,
  FaChevronLeft, FaChevronRight, FaBolt, FaArrowLeft, FaBuilding
} from 'react-icons/fa';
import api from '../../services/api';

const menuGroups = [
  {
    label: 'General',
    items: [
      { to: 'dashboard', label: 'Dashboard', icon: FaChartBar },
    ],
  },
  {
    label: 'Usuarios',
    items: [
      { to: 'administradores', label: 'Administradores', icon: FaUserShield },
      { to: 'usuarios', label: 'Usuarios activos', icon: FaUsers },
    ],
  },
  {
    label: 'Operaciones',
    items: [
      { to: 'ventas', label: 'Ventas del mes', icon: FaDollarSign },
      { to: 'compras', label: 'Compras del mes', icon: FaShoppingCart },
      { to: 'facturacion', label: 'Facturación', icon: FaFileInvoice },
    ],
  },
  {
    label: 'Configuración',
    items: [
      { to: 'licencias', label: 'Licencias', icon: FaIdCard },
      { to: 'modulos', label: 'Módulos activos', icon: FaPuzzlePiece },
    ],
  },
  {
    label: 'Reportes',
    items: [
      { to: 'auditoria', label: 'Auditoría', icon: FaClipboardList },
    ],
  },
];

export default function EmpresaLayoutSuperAdmin() {
  const { empresaId } = useParams();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [empresa, setEmpresa] = useState(null);
  const [loadingEmpresa, setLoadingEmpresa] = useState(true);

  // Verify superadmin
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { navigate('/'); return; }
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      if (!payload?.is_super_admin && Number(payload?.rol) !== 1) {
        navigate('/dashboard');
      }
    } catch { navigate('/'); }
  }, [navigate]);

  useEffect(() => {
    api.get(`/superadmin/empresas/${empresaId}`)
      .then(r => setEmpresa(r.data))
      .catch(() => setEmpresa(null))
      .finally(() => setLoadingEmpresa(false));
  }, [empresaId]);

  const handleImpersonate = async () => {
    try {
      const res = await api.post(`/superadmin/empresas/${empresaId}/impersonate`);
      const { token, empresa_name } = res.data;
      if (token) {
        localStorage.setItem('superadmin_original_token', localStorage.getItem('token'));
        localStorage.setItem('token', token);
        if (empresa_name) localStorage.setItem('superadmin_impersonate_name', empresa_name);
        try {
          const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
          if (payload?.id) localStorage.setItem('userId', String(payload.id));
        } catch {}
        api.defaults.headers.common.Authorization = `Bearer ${token}`;
        window.location.href = '/dashboard';
      }
    } catch {
      alert('Error al impersonar empresa');
    }
  };

  const sidebarWidth = collapsed ? 'w-16' : 'w-60';

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <aside className={`${sidebarWidth} bg-gray-900 flex flex-col transition-all duration-200 flex-shrink-0`}>
        {/* Header empresa */}
        <div className="p-4 border-b border-gray-800">
          {!collapsed ? (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                  <FaBuilding className="text-white text-sm" />
                </div>
                <div className="min-w-0">
                  <p className="text-white font-semibold text-sm truncate">
                    {loadingEmpresa ? '...' : (empresa?.NameCompany || 'Empresa')}
                  </p>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                    empresa?.Status === 'Activo' ? 'bg-green-500/20 text-green-400' : 'bg-gray-600 text-gray-400'
                  }`}>
                    {empresa?.Status || 'Activo'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex justify-center">
              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                <FaBuilding className="text-white text-sm" />
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-3 border-b border-gray-800 flex flex-col gap-2">
          <button
            onClick={() => navigate('/superadmin/dashboard')}
            className={`flex items-center gap-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg px-2 py-2 text-xs transition-colors ${collapsed ? 'justify-center' : ''}`}
            title="Volver al dashboard"
          >
            <FaArrowLeft className="flex-shrink-0" />
            {!collapsed && <span>Volver al dashboard</span>}
          </button>
          <button
            onClick={handleImpersonate}
            className={`flex items-center gap-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-lg px-2 py-2 text-xs transition-colors ${collapsed ? 'justify-center' : ''}`}
            title="Entrar como admin"
          >
            <FaBolt className="flex-shrink-0" />
            {!collapsed && <span>Entrar como admin</span>}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-2">
          {menuGroups.map((group) => (
            <div key={group.label} className="mb-4">
              {!collapsed && (
                <p className="text-gray-500 text-[10px] font-semibold uppercase px-2 mb-1 tracking-wider">
                  {group.label}
                </p>
              )}
              {group.items.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm mb-0.5 transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800'
                    } ${collapsed ? 'justify-center' : ''}`
                  }
                  title={collapsed ? label : undefined}
                >
                  <Icon className="flex-shrink-0 text-base" />
                  {!collapsed && <span className="truncate">{label}</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* Collapse toggle */}
        <div className="p-3 border-t border-gray-800">
          <button
            onClick={() => setCollapsed(c => !c)}
            className="w-full flex items-center justify-center text-gray-500 hover:text-white hover:bg-gray-800 rounded-lg py-2 transition-colors"
          >
            {collapsed ? <FaChevronRight /> : <FaChevronLeft />}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet context={{ empresaId: Number(empresaId), empresa }} />
      </main>
    </div>
  );
}
