import React, { useEffect, useMemo, useState } from 'react';
import { crmService } from '../../services/crmService';
import { cotizacionService } from '../../services/cotizacionService';
import { getDashboardKpis, getResumenVentasPorEmpresa } from '../../services/dashboardService';
import { reporteriaService } from '../../services/reporteriaService';
import FacturasVencidas from '../../components/dashboard/FacturasVencidas';

const MAX_BAR_VALUE = 100;
const toNumber = (value) => Number(value || 0);

const formatCurrency = (value) =>
  toNumber(value).toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 });

const formatCompactCurrency = (value) =>
  toNumber(value).toLocaleString('es-MX', { style: 'currency', currency: 'MXN', notation: 'compact', maximumFractionDigits: 1 });

const getMonthLabel = (dateValue) => {
  if (!dateValue) return null;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('es-MX', { month: 'short', year: '2-digit' });
};

const getMonthKey = (dateValue) => {
  if (!dateValue) return null;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const toneMap = {
  blue:   { card: 'from-[#1b3d86] to-[#2a5fc4]', icon: 'bg-white/15', text: 'text-blue-100/80' },
  green:  { card: 'from-[#14603a] to-[#1d8a55]', icon: 'bg-white/15', text: 'text-emerald-100/80' },
  purple: { card: 'from-[#4a1880] to-[#6d2db5]', icon: 'bg-white/15', text: 'text-purple-100/80' },
  amber:  { card: 'from-[#7a4400] to-[#b36200]', icon: 'bg-white/15', text: 'text-amber-100/80' },
};

const toneIcons = {
  blue:   '📊',
  green:  '💰',
  purple: '🤝',
  amber:  '📋',
};

function KpiCard({ title, value, subtitle, tone = 'blue', icon }) {
  const t = toneMap[tone] || toneMap.blue;
  const defaultIcon = toneIcons[tone] || '📈';
  return (
    <div className={`relative overflow-hidden rounded-[26px] bg-gradient-to-br ${t.card} p-5 text-white shadow-[0_18px_40px_rgba(15,45,93,0.18)]`}>
      <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/5" />
      <div className="absolute -bottom-6 -left-2 h-20 w-20 rounded-full bg-white/5" />
      <div className="relative">
        <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-2xl text-lg ${t.icon}`}>
          {icon || defaultIcon}
        </div>
        <p className={`text-[11px] font-bold uppercase tracking-[0.22em] ${t.text}`}>{title}</p>
        <p className="mt-1.5 text-2xl font-bold tracking-tight text-white">{value}</p>
        {subtitle && <p className={`mt-1.5 text-xs ${t.text}`}>{subtitle}</p>}
      </div>
    </div>
  );
}

function BarChartCard({ title, data, valueFormatter }) {
  const maxValue = Math.max(...data.map((row) => toNumber(row.value)), 0);
  return (
    <div className="rounded-[26px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(246,249,253,0.96))] p-5 shadow-[0_18px_40px_rgba(15,45,93,0.08)]">
      <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.22em] text-[#6b7a96]">Grafico</p>
      <h3 className="mb-4 text-base font-semibold text-slate-900">{title}</h3>
      {data.length === 0 ? (
        <p className="text-sm text-slate-400">Sin datos para mostrar.</p>
      ) : (
        <div className="space-y-3">
          {data.map((row) => {
            const percentage = maxValue > 0 ? Math.round((toNumber(row.value) / maxValue) * MAX_BAR_VALUE) : 0;
            return (
              <div key={row.label}>
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <span className="max-w-[60%] truncate text-xs font-medium text-slate-700">{row.label}</span>
                  <span className="text-xs font-bold text-slate-900">
                    {valueFormatter ? valueFormatter(row.value) : toNumber(row.value).toLocaleString('es-MX')}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-[#1b3d86] to-[#4f7de0] transition-all duration-500"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatBadge({ label, value }) {
  return (
    <div className="rounded-[20px] border border-[#e3eaf5] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,250,253,0.96))] p-4 shadow-[0_8px_20px_rgba(15,45,93,0.06)]">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-slate-900">{value}</p>
    </div>
  );
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [ventasEmpresa, setVentasEmpresa] = useState([]);
  const [facturas, setFacturas] = useState([]);
  const [estadisticasFacturacion, setEstadisticasFacturacion] = useState(null);
  const [oportunidades, setOportunidades] = useState([]);
  const [cotizaciones, setCotizaciones] = useState([]);
  const [extraKpis, setExtraKpis] = useState({ ops_activas: 0, margen_promedio: null });

  useEffect(() => {
    const cargarDashboard = async () => {
      setLoading(true);
      setError('');
      try {
        const [ventasResult, statsResult, facturasResult, oportunidadesResult, cotizacionesResult, extraKpisResult] =
          await Promise.allSettled([
            getResumenVentasPorEmpresa(),
            reporteriaService.getEstadisticas(),
            reporteriaService.getFacturas(),
            crmService.getOportunidades(),
            cotizacionService.listCotizaciones(),
            getDashboardKpis(),
          ]);

        const failedBlocks = [];

        if (ventasResult.status === 'fulfilled') setVentasEmpresa(ventasResult.value?.data || []);
        else { setVentasEmpresa([]); failedBlocks.push('ventas'); }

        if (statsResult.status === 'fulfilled') setEstadisticasFacturacion(statsResult.value?.data || null);
        else {
          setEstadisticasFacturacion({ TotalFacturas: 0, FacturasVigentes: 0, FacturasCanceladas: 0, TotalFacturado: 0, PromedioFactura: 0 });
          failedBlocks.push('estadisticas de facturacion');
        }

        if (facturasResult.status === 'fulfilled') setFacturas(facturasResult.value?.data || []);
        else { setFacturas([]); failedBlocks.push('facturas'); }

        if (oportunidadesResult.status === 'fulfilled') setOportunidades(oportunidadesResult.value?.data || []);
        else { setOportunidades([]); failedBlocks.push('CRM'); }

        if (cotizacionesResult.status === 'fulfilled') setCotizaciones(cotizacionesResult.value?.data || []);
        else { setCotizaciones([]); failedBlocks.push('cotizaciones'); }

        if (extraKpisResult.status === 'fulfilled')
          setExtraKpis(extraKpisResult.value?.data || { ops_activas: 0, margen_promedio: null });

        if (failedBlocks.length > 0)
          setError(`Algunos bloques no cargaron: ${failedBlocks.join(', ')}.`);
      } catch (err) {
        setError(err?.response?.data?.message || 'No fue posible cargar el dashboard.');
      } finally {
        setLoading(false);
      }
    };
    cargarDashboard();
  }, []);

  const kpis = useMemo(() => {
    const totalVentas = ventasEmpresa.reduce((acc, item) => acc + toNumber(item.TotalVentas), 0);
    const montoFacturado = ventasEmpresa.reduce((acc, item) => acc + toNumber(item.MontoFacturado), 0);
    const oportunidadesAbiertas = oportunidades.filter((item) => {
      const status = (item.Status || '').toLowerCase();
      return status !== 'ganada' && status !== 'perdida';
    }).length;
    const cotizacionesAprobadas = cotizaciones.filter(
      (item) => (item.Status || '').toUpperCase() === 'APROBADA'
    ).length;
    return { totalVentas, montoFacturado, oportunidadesAbiertas, cotizacionesAprobadas };
  }, [ventasEmpresa, oportunidades, cotizaciones]);

  const ventasPorEmpresaChart = useMemo(() =>
    ventasEmpresa
      .map((item) => ({ label: item.NameCompany || `Empresa ${item.Company_Id}`, value: toNumber(item.TotalVentas_Monto) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8),
  [ventasEmpresa]);

  const crmPorEtapaChart = useMemo(() => {
    const grouped = oportunidades.reduce((acc, item) => {
      const key = item.EtapaNombre || 'Sin etapa';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(grouped).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  }, [oportunidades]);

  const cotizacionesPorStatusChart = useMemo(() => {
    const grouped = cotizaciones.reduce((acc, item) => {
      const key = item.Status || 'SIN_STATUS';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(grouped).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  }, [cotizaciones]);

  const facturacionMensualChart = useMemo(() => {
    const grouped = facturas.reduce((acc, item) => {
      const dateSource = item.FechaTimbrado || item.FechaCreacion;
      const monthKey = getMonthKey(dateSource);
      const monthLabel = getMonthLabel(dateSource);
      if (!monthKey || !monthLabel) return acc;
      if (!acc[monthKey]) acc[monthKey] = { label: monthLabel, value: 0 };
      acc[monthKey].value += toNumber(item.Total);
      return acc;
    }, {});
    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => ({ label: v.label, value: v.value }))
      .slice(-6);
  }, [facturas]);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 px-1">
      {/* Page header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#6b7a96]">Vista general</p>
          <h1 className="text-3xl font-semibold tracking-tight text-[#1d2430]">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">Ventas, facturacion, CRM y cotizaciones en tiempo real.</p>
        </div>
      </div>

      <FacturasVencidas />

      {loading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-[26px] bg-slate-200/60" />
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {error}
        </div>
      )}

      {!loading && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <KpiCard title="Ventas registradas" value={kpis.totalVentas.toLocaleString('es-MX')} tone="blue" icon="🛒" />
            <KpiCard title="Monto facturado" value={formatCompactCurrency(kpis.montoFacturado)} tone="green" icon="💰" />
            <KpiCard title="Oportunidades abiertas" value={kpis.oportunidadesAbiertas.toLocaleString('es-MX')} tone="purple" icon="🤝" />
            <KpiCard title="Cotizaciones aprobadas" value={kpis.cotizacionesAprobadas.toLocaleString('es-MX')} tone="amber" icon="📋" />
            <KpiCard
              title="OPs activas"
              value={extraKpis.ops_activas.toLocaleString('es-MX')}
              subtitle="Ordenes de produccion en curso"
              tone="blue"
              icon="⚙️"
            />
            <KpiCard
              title="Margen promedio"
              value={extraKpis.margen_promedio !== null ? `${extraKpis.margen_promedio}%` : '—'}
              subtitle="Sobre ventas con costo registrado"
              tone="green"
              icon="📈"
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <BarChartCard title="Ventas por empresa (monto total)" data={ventasPorEmpresaChart} valueFormatter={formatCurrency} />
            <BarChartCard title="Pipeline CRM por etapa" data={crmPorEtapaChart} />
            <BarChartCard title="Cotizaciones por estatus" data={cotizacionesPorStatusChart} />
            <BarChartCard title="Facturacion ultimos meses" data={facturacionMensualChart} valueFormatter={formatCurrency} />
          </div>

          {/* Resumen facturacion */}
          {estadisticasFacturacion && (
            <div className="rounded-[26px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(246,249,253,0.96))] p-5 shadow-[0_18px_40px_rgba(15,45,93,0.08)]">
              <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.22em] text-[#6b7a96]">Resumen</p>
              <h3 className="mb-4 text-base font-semibold text-slate-900">Facturacion del periodo</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatBadge label="Total de facturas" value={toNumber(estadisticasFacturacion.TotalFacturas).toLocaleString('es-MX')} />
                <StatBadge label="Facturas vigentes" value={toNumber(estadisticasFacturacion.FacturasVigentes).toLocaleString('es-MX')} />
                <StatBadge label="Facturas canceladas" value={toNumber(estadisticasFacturacion.FacturasCanceladas).toLocaleString('es-MX')} />
                <StatBadge label="Total facturado" value={formatCurrency(estadisticasFacturacion.TotalFacturado)} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
