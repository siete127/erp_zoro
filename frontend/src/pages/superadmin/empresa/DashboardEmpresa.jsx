import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { FaDollarSign, FaUsers, FaShoppingCart, FaFileInvoice } from 'react-icons/fa';
import api from '../../../services/api';

const KpiCard = ({ icon: Icon, color, label, value, sub }) => (
  <div className="bg-white rounded-xl shadow-sm p-5 flex items-center gap-4">
    <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${color}`}>
      <Icon className="text-xl text-white" />
    </div>
    <div>
      <p className="text-gray-500 text-xs">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  </div>
);

export default function DashboardEmpresa() {
  const { empresaId, empresa } = useOutletContext();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/superadmin/empresas/${empresaId}/stats`)
      .then(r => setStats(r.data))
      .finally(() => setLoading(false));
  }, [empresaId]);

  if (loading) return <div className="p-8 text-center text-gray-500">Cargando...</div>;
  if (!stats) return <div className="p-8 text-center text-red-500">Error cargando datos</div>;

  const ventasMes = parseFloat(stats.ventas_mes?.monto_ventas) || 0;
  const comprasMes = parseFloat(stats.compras_mes?.monto_compras) || 0;
  const usuariosActivos = stats.usuarios?.usuarios_activos || 0;
  const totalUsuarios = stats.usuarios?.total_usuarios || 0;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{empresa?.NameCompany || 'Empresa'}</h1>
          <p className="text-sm text-gray-500">Dashboard — mes actual</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <KpiCard
            icon={FaDollarSign} color="bg-emerald-500"
            label="Ventas del mes" value={`$${ventasMes.toLocaleString('es-MX', { maximumFractionDigits: 0 })}`}
            sub={`${stats.ventas_mes?.total_ventas || 0} transacciones`}
          />
          <KpiCard
            icon={FaShoppingCart} color="bg-blue-500"
            label="Compras del mes" value={`$${comprasMes.toLocaleString('es-MX', { maximumFractionDigits: 0 })}`}
            sub={`${stats.compras_mes?.total_compras || 0} órdenes`}
          />
          <KpiCard
            icon={FaUsers} color="bg-indigo-500"
            label="Usuarios activos" value={usuariosActivos}
            sub={`${totalUsuarios} totales`}
          />
          <KpiCard
            icon={FaFileInvoice} color="bg-orange-500"
            label="Facturas pendientes" value={stats.facturas_pendientes || 0}
            sub="Por timbrar"
          />
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="font-bold text-gray-900 mb-3">Información de la empresa</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500 text-xs">RFC</p>
              <p className="font-medium">{stats.empresa?.RFC || '—'}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Email</p>
              <p className="font-medium">{stats.empresa?.Email || '—'}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Estado</p>
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                stats.empresa?.Status === 'Activo' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
              }`}>
                {stats.empresa?.Status || 'Activo'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
