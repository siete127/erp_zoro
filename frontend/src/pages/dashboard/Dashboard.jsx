import React, { useEffect, useMemo, useState } from 'react';
import { crmService } from '../../services/crmService';
import { cotizacionService } from '../../services/cotizacionService';
import { getResumenVentasPorEmpresa } from '../../services/dashboardService';
import { reporteriaService } from '../../services/reporteriaService';

const MAX_BAR_VALUE = 100;

const toNumber = (value) => Number(value || 0);

const formatCurrency = (value) => {
  return toNumber(value).toLocaleString('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  });
};

const formatCompactCurrency = (value) => {
  return toNumber(value).toLocaleString('es-MX', {
    style: 'currency',
    currency: 'MXN',
    notation: 'compact',
    maximumFractionDigits: 1,
  });
};

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
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

function KpiCard({ title, value, subtitle, tone = 'blue' }) {
  const toneClasses = {
    blue: 'bg-blue-50 border-blue-200 text-blue-900',
    green: 'bg-green-50 border-green-200 text-green-900',
    purple: 'bg-purple-50 border-purple-200 text-purple-900',
    amber: 'bg-amber-50 border-amber-200 text-amber-900',
  };

  return (
    <div className={`rounded-xl border p-4 ${toneClasses[tone] || toneClasses.blue}`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-80">{title}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {subtitle ? <p className="text-xs mt-2 opacity-80">{subtitle}</p> : null}
    </div>
  );
}

function BarChartCard({ title, data, valueFormatter }) {
  const maxValue = Math.max(...data.map((row) => toNumber(row.value)), 0);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">{title}</h3>

      {data.length === 0 ? (
        <p className="text-sm text-gray-500">Sin datos para mostrar.</p>
      ) : (
        <div className="space-y-3">
          {data.map((row) => {
            const percentage = maxValue > 0 ? Math.round((toNumber(row.value) / maxValue) * MAX_BAR_VALUE) : 0;
            return (
              <div key={row.label}>
                <div className="flex items-center justify-between gap-3 mb-1">
                  <span className="text-xs text-gray-700 truncate">{row.label}</span>
                  <span className="text-xs font-semibold text-gray-900">
                    {valueFormatter ? valueFormatter(row.value) : toNumber(row.value).toLocaleString('es-MX')}
                  </span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-2 bg-[#0A59A8] rounded-full" style={{ width: `${percentage}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
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

  useEffect(() => {
    const cargarDashboard = async () => {
      setLoading(true);
      setError('');

      try {
        const [ventasRes, statsRes, facturasRes, oportunidadesRes, cotizacionesRes] = await Promise.all([
          getResumenVentasPorEmpresa(),
          reporteriaService.getEstadisticas(),
          reporteriaService.getFacturas(),
          crmService.getOportunidades(),
          cotizacionService.listCotizaciones(),
        ]);

        setVentasEmpresa(ventasRes?.data || []);
        setEstadisticasFacturacion(statsRes?.data || null);
        setFacturas(facturasRes?.data || []);
        setOportunidades(oportunidadesRes?.data || []);
        setCotizaciones(cotizacionesRes?.data || []);
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

    return {
      totalVentas,
      montoFacturado,
      oportunidadesAbiertas,
      cotizacionesAprobadas,
    };
  }, [ventasEmpresa, oportunidades, cotizaciones]);

  const ventasPorEmpresaChart = useMemo(() => {
    return ventasEmpresa
      .map((item) => ({
        label: item.NameCompany || `Empresa ${item.Company_Id}`,
        value: toNumber(item.TotalVentas_Monto),
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [ventasEmpresa]);

  const crmPorEtapaChart = useMemo(() => {
    const grouped = oportunidades.reduce((acc, item) => {
      const key = item.EtapaNombre || 'Sin etapa';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(grouped)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }, [oportunidades]);

  const cotizacionesPorStatusChart = useMemo(() => {
    const grouped = cotizaciones.reduce((acc, item) => {
      const key = item.Status || 'SIN_STATUS';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(grouped)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }, [cotizaciones]);

  const facturacionMensualChart = useMemo(() => {
    const grouped = facturas.reduce((acc, item) => {
      const dateSource = item.FechaTimbrado || item.FechaCreacion;
      const monthKey = getMonthKey(dateSource);
      const monthLabel = getMonthLabel(dateSource);
      if (!monthKey || !monthLabel) return acc;

      if (!acc[monthKey]) {
        acc[monthKey] = { label: monthLabel, value: 0 };
      }

      acc[monthKey].value += toNumber(item.Total);
      return acc;
    }, {});

    return Object.entries(grouped)
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
      .map(([, value]) => ({ label: value.label, value: value.value }))
      .slice(-6);
  }, [facturas]);

  return (
    <div className="w-full max-w-7xl mx-auto px-2 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Vista general comercial: ventas, facturación, CRM y cotizaciones.
          </p>
        </div>
      </div>

      {loading ? <p className="text-sm text-gray-600">Cargando métricas...</p> : null}
      {!loading && error ? <p className="text-sm text-red-600">{error}</p> : null}

      {!loading && !error ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <KpiCard title="Ventas registradas" value={kpis.totalVentas.toLocaleString('es-MX')} tone="blue" />
            <KpiCard title="Monto facturado" value={formatCompactCurrency(kpis.montoFacturado)} tone="green" />
            <KpiCard title="Oportunidades abiertas" value={kpis.oportunidadesAbiertas.toLocaleString('es-MX')} tone="purple" />
            <KpiCard title="Cotizaciones aprobadas" value={kpis.cotizacionesAprobadas.toLocaleString('es-MX')} tone="amber" />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <BarChartCard title="Ventas por empresa (monto total)" data={ventasPorEmpresaChart} valueFormatter={formatCurrency} />
            <BarChartCard title="Pipeline CRM por etapa" data={crmPorEtapaChart} />
            <BarChartCard title="Cotizaciones por estatus" data={cotizacionesPorStatusChart} />
            <BarChartCard title="Facturación últimos meses" data={facturacionMensualChart} valueFormatter={formatCurrency} />
          </div>

          {estadisticasFacturacion ? (
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Resumen de facturación</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 text-sm">
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-gray-500">Total de facturas</p>
                  <p className="font-bold text-gray-900">{toNumber(estadisticasFacturacion.TotalFacturas).toLocaleString('es-MX')}</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-gray-500">Facturas vigentes</p>
                  <p className="font-bold text-gray-900">{toNumber(estadisticasFacturacion.FacturasVigentes).toLocaleString('es-MX')}</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-gray-500">Facturas canceladas</p>
                  <p className="font-bold text-gray-900">{toNumber(estadisticasFacturacion.FacturasCanceladas).toLocaleString('es-MX')}</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-gray-500">Total facturado</p>
                  <p className="font-bold text-gray-900">{formatCurrency(estadisticasFacturacion.TotalFacturado)}</p>
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}


