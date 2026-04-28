import React, { useEffect, useMemo, useState } from "react";
import api from "../../services/api";
import auditoriaService from "../../services/auditoriaService";
import { notify } from "../../services/notify";
import { getUserCompanies, getUserRole } from "../../utils/tokenHelper";

const defaultFilters = {
  company_id: "all",
  modulo: "all",
  accion: "all",
  fecha_desde: "",
  fecha_hasta: "",
  limit: 100,
};

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("es-MX");
}

function renderDetail(detail) {
  if (detail == null) return "-";
  if (typeof detail === "string") return detail;
  try {
    return JSON.stringify(detail, null, 2);
  } catch (err) {
    return String(detail);
  }
}

export default function Auditoria() {
  const [companies, setCompanies] = useState([]);
  const [modules, setModules] = useState([]);
  const [items, setItems] = useState([]);
  const [filters, setFilters] = useState(defaultFilters);
  const [loading, setLoading] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(true);

  const role = getUserRole();
  const allowedCompanyIds = getUserCompanies().map(Number).filter((id) => Number.isInteger(id));
  const isAdmin = role === 1 || role === 2;
  const isSuperAdmin = role === 1;

  const visibleCompanies = useMemo(() => {
    if (isSuperAdmin) return companies;
    return companies.filter((company) => allowedCompanyIds.includes(Number(company.Company_Id)));
  }, [companies, isSuperAdmin, allowedCompanyIds]);

  const loadCatalogs = async () => {
    const [companyResponse, moduleItems] = await Promise.all([
      api.get("/companies"),
      auditoriaService.listarModulos(),
    ]);
    setCompanies(companyResponse.data || []);
    setModules(moduleItems || []);
  };

  const loadLogs = async (nextFilters = filters) => {
    setLoadingLogs(true);
    try {
      const params = {
        limit: Number(nextFilters.limit) || 100,
      };
      if (nextFilters.company_id && nextFilters.company_id !== "all") params.company_id = Number(nextFilters.company_id);
      if (nextFilters.modulo && nextFilters.modulo !== "all") params.modulo = nextFilters.modulo;
      if (nextFilters.accion && nextFilters.accion !== "all") params.accion = nextFilters.accion;
      if (nextFilters.fecha_desde) params.fecha_desde = nextFilters.fecha_desde;
      if (nextFilters.fecha_hasta) params.fecha_hasta = nextFilters.fecha_hasta;

      const response = await auditoriaService.listar(params);
      setItems(response);
    } catch (err) {
      notify(err?.response?.data?.detail || "Error cargando auditoria", "error");
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;

    const bootstrap = async () => {
      setLoading(true);
      try {
        await loadCatalogs();
      } catch (err) {
        notify(err?.response?.data?.detail || "Error cargando auditoria", "error");
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    loadLogs(filters);
  }, [isAdmin]);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    await loadLogs(filters);
  };

  const clearFilters = async () => {
    setFilters(defaultFilters);
    await loadLogs(defaultFilters);
  };

  if (!isAdmin) {
    return (
      <div className="w-full max-w-3xl rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">Auditoria</h1>
        <p className="mt-3 text-sm text-gray-600">
          Esta seccion esta disponible solo para administracion.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full px-4 sm:px-6 py-6 space-y-5" style={{ background: 'radial-gradient(ellipse at 70% 0%, rgba(59,107,212,0.07) 0%, rgba(255,255,255,0) 60%), radial-gradient(ellipse at 0% 80%, rgba(99,102,241,0.05) 0%, rgba(255,255,255,0) 55%), #f4f6fb' }}>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#3b6fd4]">Sistema</p>
        <h1 className="text-2xl font-bold leading-tight text-[#0d1f3c]">Auditoría</h1>
        <p className="text-sm text-slate-500">Consulta eventos registrados por módulo, acción, empresa y fecha.</p>
      </div>

      <section className="rounded-[24px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(245,248,255,0.9)_100%)] p-6 shadow-[0_4px_20px_rgba(15,45,93,0.07)]">
        <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-5" onSubmit={handleSearch}>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Empresa</label>
            <select
              value={filters.company_id}
              onChange={(e) => handleFilterChange("company_id", e.target.value)}
              className="w-full rounded-[12px] border border-[#dce4f0] bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-[0_2px_8px_rgba(15,45,93,0.06)] outline-none focus:border-[#3b6fd4] focus:ring-2 focus:ring-[#3b6fd4]/20"
            >
              <option value="all">Todas</option>
              {visibleCompanies.map((company) => (
                <option key={company.Company_Id} value={company.Company_Id}>
                  {company.NameCompany || company.Name || `Empresa ${company.Company_Id}`}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Modulo</label>
            <select
              value={filters.modulo}
              onChange={(e) => handleFilterChange("modulo", e.target.value)}
              className="w-full rounded-[12px] border border-[#dce4f0] bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-[0_2px_8px_rgba(15,45,93,0.06)] outline-none focus:border-[#3b6fd4] focus:ring-2 focus:ring-[#3b6fd4]/20"
            >
              <option value="all">Todos</option>
              {modules.map((moduleName) => (
                <option key={moduleName} value={moduleName}>
                  {moduleName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Accion</label>
            <select
              value={filters.accion}
              onChange={(e) => handleFilterChange("accion", e.target.value)}
              className="w-full rounded-[12px] border border-[#dce4f0] bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-[0_2px_8px_rgba(15,45,93,0.06)] outline-none focus:border-[#3b6fd4] focus:ring-2 focus:ring-[#3b6fd4]/20"
            >
              <option value="all">Todas</option>
              <option value="CREATE">CREATE</option>
              <option value="UPDATE">UPDATE</option>
              <option value="DELETE">DELETE</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="PATCH">PATCH</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Desde</label>
            <input
              type="date"
              value={filters.fecha_desde}
              onChange={(e) => handleFilterChange("fecha_desde", e.target.value)}
              className="w-full rounded-[12px] border border-[#dce4f0] bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-[0_2px_8px_rgba(15,45,93,0.06)] outline-none focus:border-[#3b6fd4] focus:ring-2 focus:ring-[#3b6fd4]/20"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Hasta</label>
            <input
              type="date"
              value={filters.fecha_hasta}
              onChange={(e) => handleFilterChange("fecha_hasta", e.target.value)}
              className="w-full rounded-[12px] border border-[#dce4f0] bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-[0_2px_8px_rgba(15,45,93,0.06)] outline-none focus:border-[#3b6fd4] focus:ring-2 focus:ring-[#3b6fd4]/20"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Limite</label>
            <input
              type="number"
              min="1"
              max="500"
              value={filters.limit}
              onChange={(e) => handleFilterChange("limit", e.target.value)}
              className="w-full rounded-[12px] border border-[#dce4f0] bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-[0_2px_8px_rgba(15,45,93,0.06)] outline-none focus:border-[#3b6fd4] focus:ring-2 focus:ring-[#3b6fd4]/20"
            />
          </div>

          <div className="flex items-end gap-3 xl:col-span-2">
            <button
              type="submit"
              className="rounded-[12px] bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_10px_rgba(27,61,134,0.25)] transition"
            >
              Filtrar
            </button>
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-[12px] border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
            >
              Limpiar
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-[24px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(245,248,255,0.9)_100%)] p-6 shadow-[0_4px_20px_rgba(15,45,93,0.07)]">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Eventos registrados</h2>
            <p className="text-sm text-gray-600">Vista reciente del log de actividad.</p>
          </div>
          {!loading && (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              {items.length} evento(s)
            </span>
          )}
        </div>

        {loading || loadingLogs ? (
          <p className="text-sm text-gray-500">Cargando auditoria...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-gray-500">No hay eventos para los filtros seleccionados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-[#eaf0fa] text-left">
                  {["Fecha","Usuario","Empresa","Módulo","Acción","Detalle"].map(col => (
                    <th key={col} className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-[#6b7a96] first:pl-6">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-t border-[#eaf0fa] align-top hover:bg-[#f4f7ff]/60 transition">
                    <td className="px-4 py-3 text-sm text-slate-700 first:pl-6">{formatDate(item.fecha)}</td>
                    <td className="px-4 py-3 text-sm text-slate-700 first:pl-6">
                      {item.Username || item.Name || item.usuario_id || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700 first:pl-6">
                      {item.NameCompany || (item.empresa_id ? `Empresa ${item.empresa_id}` : "-")}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700 first:pl-6">{item.modulo || "-"}</td>
                    <td className="py-3 pr-4">
                      <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-700">
                        {item.accion || "-"}
                      </span>
                    </td>
                    <td className="py-3">
                      <pre className="max-w-xl overflow-auto whitespace-pre-wrap rounded-[10px] border border-[#eaf0fa] bg-[#f4f7ff] p-3 text-xs text-slate-700">
                        {renderDetail(item.DetalleJson)}
                      </pre>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

