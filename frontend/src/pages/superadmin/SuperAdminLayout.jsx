import React, { useEffect, useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  FaChartLine, FaBuilding, FaUserTie, FaClipboardList,
  FaSignOutAlt, FaShieldAlt
} from 'react-icons/fa';
import { clearCache as clearPermissionCache } from '../../services/permissionService';
import { socket } from '../../services/socket';
import { getApiBase } from '../../services/runtimeConfig';
import confirm from '../../services/confirm';

const menuItems = [
  { to: '/superadmin/dashboard', label: 'Dashboard Global', icon: FaChartLine },
  { to: '/superadmin/empresas', label: 'Empresas', icon: FaBuilding },
  { to: '/superadmin/admins', label: 'Administradores', icon: FaUserTie },
  { to: '/superadmin/permisos', label: 'Solicitudes de Acceso', icon: FaClipboardList },
];

function decodeTokenPayload(token) {
  if (!token) return null;
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch { return null; }
}

export default function SuperAdminLayout() {
  const navigate = useNavigate();
  const [userName, setUserName] = useState('SuperAdmin');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { navigate('/'); return; }
    const payload = decodeTokenPayload(token);
    if (!payload?.is_super_admin && Number(payload?.rol) !== 1) {
      navigate('/dashboard');
      return;
    }
    if (payload?.name) setUserName(payload.name);
  }, [navigate]);

  const handleLogout = async () => {
    const ok = await confirm('¿Confirmas cerrar sesión?', 'Cerrar sesión', 'Cerrar', 'Cancelar');
    if (!ok) return;
    const base = getApiBase();
    const sessionId = localStorage.getItem('sessionId');
    fetch(`${base}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
      body: JSON.stringify({ sessionId: Number(sessionId) }),
    }).catch(() => {});
    localStorage.removeItem('token');
    localStorage.removeItem('sessionId');
    localStorage.removeItem('user');
    localStorage.removeItem('userId');
    clearPermissionCache();
    socket.disconnect();
    navigate('/');
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar SuperAdmin */}
      <aside className="w-60 bg-[#0a1628] flex flex-col flex-shrink-0">
        {/* Logo / branding */}
        <div className="p-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <FaShieldAlt className="text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-sm">SuperAdmin</p>
              <p className="text-blue-300 text-xs">Panel de control</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 overflow-y-auto">
          <p className="text-gray-500 text-[10px] font-semibold uppercase px-2 mb-2 tracking-wider">Navegación</p>
          {menuItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm mb-0.5 transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`
              }
            >
              <Icon className="text-base flex-shrink-0" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 bg-gray-700 rounded-full flex items-center justify-center text-xs text-white font-bold">
              {userName.charAt(0).toUpperCase()}
            </div>
            <p className="text-white text-xs font-medium truncate">{userName}</p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg px-3 py-2 text-sm transition-colors"
          >
            <FaSignOutAlt />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
