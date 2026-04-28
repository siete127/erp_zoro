import React, { useState, useEffect } from 'react';
import { FaBuilding, FaUsers, FaChartLine, FaClock, FaUserCheck, FaClipboardList, FaIdCard, FaDollarSign } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

const KpiCard = ({ icon: Icon, color, label, value, sub, onClick, alert }) => (
  <div
    onClick={onClick}
    className={`bg-white p-5 rounded-xl shadow-sm flex items-center gap-4 ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''} ${alert ? 'border-l-4 border-yellow-400' : ''}`}
  >
    <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${color}`}>
      <Icon className="text-xl text-white" />
    </div>
    <div className="min-w-0">
      <p className="text-gray-500 text-xs truncate">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 truncate">{sub}</p>}
    </div>
    {alert && (
      <span className="ml-auto bg-yellow-100 text-yellow-800 text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0">
        {alert}
      </span>
    )}
  </div>
);

const DashboardSuperAdmin = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await api.get('/superadmin/dashboard');
        setStats(res.data);
        setError(null);
      } catch (err) {
        setError(err.response?.data?.detail || 'Error cargando datos');
      } finally {
        setLoading(false);
      }
    };
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleImpersonate = async (empresaId) => {
    try {
      const res = await api.post(`/superadmin/empresas/${empresaId}/impersonate`);
      const { token, empresa_name } = res.data;
      if (token) {
        localStorage.setItem('superadmin_original_token', localStorage.getItem('token'));
        localStorage.setItem('token', token);
        if (empresa_name) localStorage.setItem('superadmin_impersonate_name', empresa_name);
        // Decodificar token para actualizar userId en localStorage
        try {
          const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
          if (payload?.id) localStorage.setItem('userId', String(payload.id));
        } catch {}
        api.defaults.headers.common.Authorization = `Bearer ${token}`;
        window.location.href = '/dashboard';
      }
    } catch (err) {
      alert('Error al impersonar empresa');
    }
  };

  if (loading) return <div className="p-6 text-center text-gray-500">Cargando dashboard...</div>;
  if (error) return <div className="p-6 text-center text-red-500">{error}</div>;
  if (!stats) return null;

  const empresasPorColor = (stats.companies || []).map((e, i) => ({ ...e, color: COLORS[i % COLORS.length] }));
  const dataUsuarios = empresasPorColor.map(e => ({ name: e.name, usuarios: e.total_users || 0 }));
  const dataVentas = (stats.ventas_mes_actual || []).slice(0, 8).map((v, i) => ({
    name: v.name,
    monto: parseFloat(v.monto_total) || 0,
    color: COLORS[i % COLORS.length],
  }));

  const totalVentasMes = dataVentas.reduce((s, v) => s + v.monto, 0);

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard SuperAdmin</h1>
          <p className="text-sm text-gray-500 mt-1">Vista global del sistema — actualización cada 30 segundos</p>
        </div>

        {/* KPIs principales */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <KpiCard
            icon={FaBuilding} color="bg-blue-500"
            label="Empresas activas" value={stats.total_companies || 0}
            onClick={() => navigate('/superadmin/empresas')}
          />
          <KpiCard
            icon={FaUsers} color="bg-green-500"
            label="Usuarios totales" value={stats.total_users || 0}
            sub="Cuentas activas"
          />
          <KpiCard
            icon={FaUserCheck} color="bg-indigo-500"
            label="Usuarios activos" value={stats.usuarios_activos_30d || 0}
            sub="Últimos 30 días"
          />
          <KpiCard
            icon={FaChartLine} color="bg-orange-500"
            label="Actividad hoy" value={stats.activity_today || 0}
            sub="Acciones registradas"
          />
        </div>

        {/* KPIs de alertas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <KpiCard
            icon={FaClipboardList} color="bg-yellow-500"
            label="Solicitudes de acceso" value={stats.solicitudes_pendientes || 0}
            sub="Pendientes de revisión"
            alert={stats.solicitudes_pendientes > 0 ? "Revisar" : null}
            onClick={() => navigate('/superadmin/permisos')}
          />
          <KpiCard
            icon={FaIdCard} color="bg-red-500"
            label="Licencias por vencer" value={stats.licencias_por_vencer || 0}
            sub="Próximos 30 días"
            alert={stats.licencias_por_vencer > 0 ? "Atención" : null}
          />
          <KpiCard
            icon={FaDollarSign} color="bg-emerald-500"
            label="Ventas este mes" value={`$${totalVentasMes.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
            sub="Suma de todas las empresas"
          />
        </div>

        {/* Grid de tarjetas de empresas */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">Empresas registradas</h2>
            <button
              onClick={() => navigate('/superadmin/empresas')}
              className="text-sm text-blue-600 hover:underline"
            >
              Gestionar empresas →
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {empresasPorColor.map((empresa) => {
              const ventaEmpresa = (stats.ventas_mes_actual || []).find(v => v.name === empresa.name);
              const ventasMes = ventaEmpresa ? parseFloat(ventaEmpresa.monto_total) || 0 : 0;
              return (
                <div
                  key={empresa.id}
                  onClick={() => navigate(`/superadmin/empresas/${empresa.id}`)}
                  className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 cursor-pointer hover:shadow-md hover:border-blue-200 transition-all group"
                >
                  {/* Header tarjeta */}
                  <div className="flex items-start justify-between mb-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                      style={{ backgroundColor: empresa.color }}
                    >
                      {empresa.name.charAt(0).toUpperCase()}
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      empresa.status === 'Activo' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {empresa.status || 'Activo'}
                    </span>
                  </div>

                  {/* Nombre y RFC */}
                  <h3 className="font-semibold text-gray-900 text-sm leading-tight mb-0.5 group-hover:text-blue-700 transition-colors line-clamp-2">
                    {empresa.name}
                  </h3>
                  <p className="text-xs text-gray-400 mb-3">{empresa.rfc || 'Sin RFC'}</p>

                  {/* Stats */}
                  <div className="flex items-center justify-between text-xs text-gray-500 border-t border-gray-50 pt-3">
                    <span className="flex items-center gap-1">
                      <FaUsers className="text-gray-400" />
                      {empresa.total_users} usuarios
                    </span>
                    <span className="text-emerald-600 font-semibold">
                      ${ventasMes.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
                    </span>
                  </div>

                  {/* Botón impersonar */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleImpersonate(empresa.id);
                    }}
                    className="mt-3 w-full text-xs bg-amber-50 hover:bg-amber-100 text-amber-700 font-medium py-1.5 rounded-lg transition-colors"
                  >
                    ⚡ Entrar como admin
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Usuarios por empresa</h2>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={dataUsuarios} margin={{ bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" angle={-35} textAnchor="end" tick={{ fontSize: 11 }} interval={0} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="usuarios" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Ventas del mes por empresa</h2>
            {dataVentas.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-gray-400 text-sm">Sin datos de ventas este mes</div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={dataVentas}
                    dataKey="monto"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={({ name, percent }) => `${name.length > 10 ? name.slice(0,10)+'…' : name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={true}
                  >
                    {dataVentas.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => [`$${v.toLocaleString('es-MX')}`, 'Ventas']} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Info del sistema */}
        <div className="bg-blue-50 border border-blue-100 p-5 rounded-xl">
          <h3 className="font-bold text-blue-900 mb-1">Información del sistema</h3>
          <p className="text-sm text-blue-700">
            Dashboard actualizado cada 30 segundos. Última actividad registrada:{' '}
            <strong>{stats.last_activity ? new Date(stats.last_activity).toLocaleString('es-MX') : 'N/A'}</strong>
          </p>
        </div>
      </div>
    </div>
  );
};

export default DashboardSuperAdmin;
