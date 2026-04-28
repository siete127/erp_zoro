import React, { useEffect, useState, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import api from '../../services/api';
import { notify } from '../../services/notify';

const PIE_COLORS = {
  Aprobado:  '#10b981',
  Pendiente: '#f59e0b',
  Rechazado: '#ef4444',
};
const PIE_FALLBACK = ['#3b6fd4', '#8b5cf6', '#06b6d4', '#f97316'];

const premiumTooltip = {
  contentStyle: {
    borderRadius: '12px',
    border: '1px solid #dce4f0',
    boxShadow: '0 4px 20px rgba(15,45,93,0.10)',
    fontSize: '12px',
  },
};

function KpiCard({ title, value, sub, color = 'text-[#1b3d86]', bg = 'border-[#dce4f0] bg-[#f8faff]' }) {
  return (
    <div className={`rounded-[20px] border p-5 shadow-[0_4px_20px_rgba(15,45,93,0.06)] ${bg}`}>
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96]">{title}</p>
      <p className={`mt-2 text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

export default function VacacionesReports({ currentUser }) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [summary, setSummary] = useState(null);
  const [byMonth, setByMonth] = useState([]);
  const [byEmployee, setByEmployee] = useState([]);
  const [pendingList, setPendingList] = useState([]);
  const [loading, setLoading] = useState(true);

  const isAdmin = currentUser?.isAdmin || currentUser?.is_admin || currentUser?.RolId === 2;

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const params = `?year=${year}`;
      const promises = [
        api.get(`/rh/vacaciones/analytics/summary${params}`),
        api.get(`/rh/vacaciones/analytics/by-month${params}`),
      ];
      if (isAdmin) {
        promises.push(api.get(`/rh/vacaciones/analytics/by-employee${params}&limit=8`));
        promises.push(api.get('/rh/vacaciones/analytics/pending-list'));
      }

      const results = await Promise.allSettled(promises);

      if (results[0].status === 'fulfilled') setSummary(results[0].value.data);
      if (results[1].status === 'fulfilled') setByMonth(results[1].value.data?.data || []);
      if (isAdmin) {
        if (results[2]?.status === 'fulfilled') setByEmployee(results[2].value.data?.data || []);
        if (results[3]?.status === 'fulfilled') setPendingList(results[3].value.data?.pendientes || []);
      }
    } catch {
      notify.error('Error cargando reportes de vacaciones');
    } finally {
      setLoading(false);
    }
  }, [year, isAdmin]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Pie chart data from summary
  const pieData = summary
    ? Object.entries(summary.por_estado || {}).map(([estado, v]) => ({
        name: estado,
        value: v.dias,
        cantidad: v.cantidad,
      }))
    : [];

  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear - 1, currentYear, currentYear + 1];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 rounded-full border-4 border-[#1b3d86]/20 border-t-[#1b3d86] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* Header con selector de año */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#3b6fd4]">Reportería</p>
          <h2 className="text-xl font-bold text-[#0d1f3c]">Analítica de Vacaciones</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Año:</span>
          {yearOptions.map(y => (
            <button
              key={y}
              onClick={() => setYear(y)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                year === y
                  ? 'border-[#1b3d86] bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] text-white shadow-[0_2px_8px_rgba(27,61,134,0.20)]'
                  : 'border-[#dce4f0] bg-white text-slate-600 hover:border-[#3b6fd4]'
              }`}
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      {summary && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            title="Total solicitudes"
            value={summary.total_solicitudes}
            sub={`en ${year}`}
            color="text-[#1b3d86]"
            bg="border-[#dce4f0] bg-[#f8faff]"
          />
          <KpiCard
            title="Días aprobados"
            value={summary.por_estado?.Aprobado?.dias || 0}
            sub={`${summary.por_estado?.Aprobado?.cantidad || 0} solicitudes`}
            color="text-emerald-700"
            bg="border-emerald-200 bg-emerald-50"
          />
          <KpiCard
            title="Pendientes"
            value={summary.por_estado?.Pendiente?.cantidad || 0}
            sub={`${summary.por_estado?.Pendiente?.dias || 0} días en espera`}
            color="text-amber-700"
            bg="border-amber-200 bg-amber-50"
          />
          <KpiCard
            title="Empleados activos"
            value={summary.empleados_con_solicitudes}
            sub="con al menos 1 solicitud"
            color="text-violet-700"
            bg="border-violet-200 bg-violet-50"
          />
        </div>
      )}

      {/* Charts row */}
      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">

        {/* Bar chart mensual */}
        <div className="rounded-[24px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(245,248,255,0.9)_100%)] p-5 shadow-[0_4px_20px_rgba(15,45,93,0.07)]">
          <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96]">Distribución mensual</p>
          <p className="mb-4 text-sm font-semibold text-slate-700">Días de vacaciones aprobados por mes — {year}</p>
          {byMonth.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byMonth} margin={{ top: 0, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eaf0fa" />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#6b7a96' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#6b7a96' }} axisLine={false} tickLine={false} />
                <Tooltip {...premiumTooltip} formatter={(v) => [`${v} días`, 'Días']} />
                <Bar dataKey="dias" fill="#3b6fd4" radius={[6, 6, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[220px] text-sm text-slate-400">
              Sin datos de vacaciones aprobadas en {year}
            </div>
          )}
        </div>

        {/* Pie chart por estado */}
        <div className="rounded-[24px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(245,248,255,0.9)_100%)] p-5 shadow-[0_4px_20px_rgba(15,45,93,0.07)]">
          <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96]">Por estado</p>
          <p className="mb-4 text-sm font-semibold text-slate-700">Días totales por estatus — {year}</p>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {pieData.map((entry, idx) => (
                    <Cell
                      key={entry.name}
                      fill={PIE_COLORS[entry.name] || PIE_FALLBACK[idx % PIE_FALLBACK.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  {...premiumTooltip}
                  formatter={(value, name, props) => [
                    `${value} días (${props.payload.cantidad} sol.)`,
                    props.payload.name,
                  ]}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[220px] text-sm text-slate-400">
              Sin datos para {year}
            </div>
          )}
        </div>
      </div>

      {/* Top empleados (solo admins) */}
      {isAdmin && byEmployee.length > 0 && (
        <div className="rounded-[24px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(245,248,255,0.9)_100%)] p-5 shadow-[0_4px_20px_rgba(15,45,93,0.07)]">
          <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96]">Empleados</p>
          <p className="mb-4 text-sm font-semibold text-slate-700">Top empleados por días aprobados — {year}</p>
          <ResponsiveContainer width="100%" height={Math.max(180, byEmployee.length * 36)}>
            <BarChart
              data={byEmployee}
              layout="vertical"
              margin={{ top: 0, right: 30, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#eaf0fa" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#6b7a96' }} axisLine={false} tickLine={false} />
              <YAxis
                type="category"
                dataKey="nombre"
                width={130}
                tick={{ fontSize: 11, fill: '#334155' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip {...premiumTooltip} formatter={(v) => [`${v} días`, 'Días aprobados']} />
              <Bar dataKey="dias" fill="#10b981" radius={[0, 6, 6, 0]} maxBarSize={24} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tabla solicitudes pendientes (solo admins) */}
      {isAdmin && (
        <div className="rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(245,248,255,0.9)_100%)] shadow-[0_18px_40px_rgba(15,45,93,0.10)] overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#eaf0fa]">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96]">Acción requerida</p>
              <h3 className="text-base font-bold text-[#0d1f3c]">
                Solicitudes pendientes de aprobación
                {pendingList.length > 0 && (
                  <span className="ml-2 inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                    {pendingList.length}
                  </span>
                )}
              </h3>
            </div>
            <button
              onClick={loadAll}
              className="rounded-[12px] border border-[#dce4f0] bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
            >
              Actualizar
            </button>
          </div>
          {pendingList.length === 0 ? (
            <p className="px-6 py-12 text-center text-sm text-slate-400">
              No hay solicitudes pendientes — todo al día
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[#eaf0fa]">
                    {["Empleado", "Período", "Días", "Razón", "Solicitado"].map(col => (
                      <th key={col} className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96] first:pl-6 last:pr-6">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pendingList.map(sol => (
                    <tr key={sol.vacaciones_id} className="border-t border-[#eaf0fa] transition hover:bg-[#f4f7ff]/60">
                      <td className="px-4 py-3 pl-6 text-sm font-semibold text-slate-800">{sol.nombre}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {sol.fecha_inicio ? new Date(sol.fecha_inicio).toLocaleDateString('es-MX') : '—'}
                        {' → '}
                        {sol.fecha_fin ? new Date(sol.fecha_fin).toLocaleDateString('es-MX') : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                          {sol.cantidad} días
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500 max-w-xs truncate">{sol.razon || '—'}</td>
                      <td className="px-4 py-3 text-sm text-slate-400">
                        {sol.created_at ? new Date(sol.created_at).toLocaleDateString('es-MX') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
