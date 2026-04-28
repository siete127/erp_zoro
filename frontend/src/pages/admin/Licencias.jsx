import React, { useEffect, useMemo, useState } from "react";
import api from "../../services/api";
import { licenciaService } from "../../services/licenciaService";
import { notify } from "../../services/notify";
import confirm from "../../services/confirm";
import { getUserCompanies, getUserRole } from "../../utils/tokenHelper";

const emptyForm = {
  Licencia_Id: null,
  Company_Id: "",
  Tipo: "Administrativa",
  FechaInicio: "",
  FechaVencimiento: "",
  Activa: true,
  MaxUsuarios: "",
  Observaciones: "",
};

function toDateInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export default function Licencias() {
  const [companies, setCompanies] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [items, setItems] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState("all");
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const role = getUserRole();
  const allowedCompanyIds = getUserCompanies().map(Number).filter((id) => Number.isInteger(id));
  const isAdmin = role === 1 || role === 2;
  const isSuperAdmin = role === 1;

  const visibleCompanies = useMemo(() => {
    if (isSuperAdmin) return companies;
    return companies.filter((company) => allowedCompanyIds.includes(Number(company.Company_Id)));
  }, [companies, isSuperAdmin, allowedCompanyIds]);

  const loadCompanies = async () => {
    const response = await api.get("/companies");
    setCompanies(response.data || []);
  };

  const loadTipos = async () => {
    const response = await licenciaService.listarTipos();
    setTipos(response);
  };

  const loadLicencias = async (companyId = selectedCompany) => {
    const scopedCompanyId = companyId && companyId !== "all" ? Number(companyId) : null;
    const response = await licenciaService.listar(scopedCompanyId);
    setItems(response);
  };

  useEffect(() => {
    if (!isAdmin) return;

    const bootstrap = async () => {
      setLoading(true);
      try {
        await Promise.all([loadCompanies(), loadTipos()]);
      } catch (err) {
        notify(err?.response?.data?.detail || "Error cargando licencias", "error");
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    loadLicencias(selectedCompany);
  }, [selectedCompany, isAdmin]);

  useEffect(() => {
    if (!selectedCompany || selectedCompany === "all") return;
    setForm((prev) => ({ ...prev, Company_Id: Number(selectedCompany) }));
  }, [selectedCompany]);

  const resetForm = () => {
    setForm({
      ...emptyForm,
      Company_Id: selectedCompany && selectedCompany !== "all" ? Number(selectedCompany) : "",
      Tipo: tipos[0] || "Administrativa",
    });
  };

  useEffect(() => {
    if (tipos.length > 0 && !form.Tipo) {
      setForm((prev) => ({ ...prev, Tipo: tipos[0] }));
    }
  }, [tipos, form.Tipo]);

  const startEdit = (item) => {
    setForm({
      Licencia_Id: item.Licencia_Id,
      Company_Id: item.Company_Id,
      Tipo: item.Tipo || "Administrativa",
      FechaInicio: toDateInput(item.FechaInicio),
      FechaVencimiento: toDateInput(item.FechaVencimiento),
      Activa: Boolean(item.Activa),
      MaxUsuarios: item.MaxUsuarios ?? "",
      Observaciones: item.Observaciones || "",
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.Company_Id || !form.Tipo || !form.FechaInicio) {
      notify("Completa empresa, tipo y fecha de inicio", "error");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        Company_Id: Number(form.Company_Id),
        Tipo: form.Tipo,
        FechaInicio: form.FechaInicio,
        FechaVencimiento: form.FechaVencimiento || null,
        Activa: Boolean(form.Activa),
        MaxUsuarios: form.MaxUsuarios === "" ? null : Number(form.MaxUsuarios),
        Observaciones: form.Observaciones || null,
      };

      if (form.Licencia_Id) {
        await licenciaService.actualizar(form.Licencia_Id, payload);
        notify("Licencia actualizada", "success");
      } else {
        await licenciaService.crear(payload);
        notify("Licencia creada", "success");
      }

      await loadLicencias(selectedCompany);
      resetForm();
    } catch (err) {
      notify(err?.response?.data?.detail || "Error guardando licencia", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item) => {
    const ok = await confirm({
      title: "Eliminar licencia",
      message: `Se eliminara la licencia ${item.Tipo} de ${item.CompanyName || `empresa ${item.Company_Id}`}.`,
      confirmText: "Eliminar",
      cancelText: "Cancelar",
      variant: "danger",
    });
    if (!ok) return;

    try {
      await licenciaService.eliminar(item.Licencia_Id);
      notify("Licencia eliminada", "success");
      await loadLicencias(selectedCompany);
      if (form.Licencia_Id === item.Licencia_Id) resetForm();
    } catch (err) {
      notify(err?.response?.data?.detail || "Error eliminando licencia", "error");
    }
  };

  if (!isAdmin) {
    return (
      <div className="w-full max-w-3xl rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">Licencias</h1>
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
        <h1 className="text-2xl font-bold leading-tight text-[#0d1f3c]">Licencias SaaS</h1>
        <p className="text-sm text-slate-500">Administra licencias por empresa, fecha de vigencia y límite de usuarios.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1.6fr]">
        <section className="rounded-[24px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(245,248,255,0.9)_100%)] p-6 shadow-[0_4px_20px_rgba(15,45,93,0.07)]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              {form.Licencia_Id ? "Editar licencia" : "Nueva licencia"}
            </h2>
            <button
              onClick={resetForm}
              className="text-sm font-semibold text-[#092052]"
              type="button"
            >
              Limpiar
            </button>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Empresa</label>
              <select
                value={form.Company_Id}
                onChange={(e) => setForm((prev) => ({ ...prev, Company_Id: Number(e.target.value) }))}
                className="w-full rounded-[12px] border border-[#dce4f0] bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-[0_2px_8px_rgba(15,45,93,0.06)] outline-none focus:border-[#3b6fd4] focus:ring-2 focus:ring-[#3b6fd4]/20"
              >
                <option value="">Selecciona empresa</option>
                {visibleCompanies.map((company) => (
                  <option key={company.Company_Id} value={company.Company_Id}>
                    {company.NameCompany || company.Name || `Empresa ${company.Company_Id}`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Tipo</label>
              <select
                value={form.Tipo}
                onChange={(e) => setForm((prev) => ({ ...prev, Tipo: e.target.value }))}
                className="w-full rounded-[12px] border border-[#dce4f0] bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-[0_2px_8px_rgba(15,45,93,0.06)] outline-none focus:border-[#3b6fd4] focus:ring-2 focus:ring-[#3b6fd4]/20"
              >
                {(tipos.length > 0 ? tipos : ["Administrativa"]).map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {tipo}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Fecha inicio</label>
                <input
                  type="date"
                  value={form.FechaInicio}
                  onChange={(e) => setForm((prev) => ({ ...prev, FechaInicio: e.target.value }))}
                  className="w-full rounded-[12px] border border-[#dce4f0] bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-[0_2px_8px_rgba(15,45,93,0.06)] outline-none focus:border-[#3b6fd4] focus:ring-2 focus:ring-[#3b6fd4]/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Fecha vencimiento</label>
                <input
                  type="date"
                  value={form.FechaVencimiento}
                  onChange={(e) => setForm((prev) => ({ ...prev, FechaVencimiento: e.target.value }))}
                  className="w-full rounded-[12px] border border-[#dce4f0] bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-[0_2px_8px_rgba(15,45,93,0.06)] outline-none focus:border-[#3b6fd4] focus:ring-2 focus:ring-[#3b6fd4]/20"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Max usuarios</label>
                <input
                  type="number"
                  min="1"
                  value={form.MaxUsuarios}
                  onChange={(e) => setForm((prev) => ({ ...prev, MaxUsuarios: e.target.value }))}
                  className="w-full rounded-[12px] border border-[#dce4f0] bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-[0_2px_8px_rgba(15,45,93,0.06)] outline-none focus:border-[#3b6fd4] focus:ring-2 focus:ring-[#3b6fd4]/20"
                />
              </div>
              <label className="mt-7 flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.Activa}
                  onChange={(e) => setForm((prev) => ({ ...prev, Activa: e.target.checked }))}
                />
                Licencia activa
              </label>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Observaciones</label>
              <textarea
                rows="3"
                value={form.Observaciones}
                onChange={(e) => setForm((prev) => ({ ...prev, Observaciones: e.target.value }))}
                className="w-full rounded-[12px] border border-[#dce4f0] bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-[0_2px_8px_rgba(15,45,93,0.06)] outline-none focus:border-[#3b6fd4] focus:ring-2 focus:ring-[#3b6fd4]/20"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-[12px] bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_4px_10px_rgba(27,61,134,0.25)] disabled:opacity-50 transition"
            >
              {saving ? "Guardando..." : form.Licencia_Id ? "Actualizar licencia" : "Crear licencia"}
            </button>
          </form>
        </section>

        <section className="rounded-[24px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(245,248,255,0.9)_100%)] p-6 shadow-[0_4px_20px_rgba(15,45,93,0.07)]">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Licencias registradas</h2>
              <p className="text-sm text-gray-600">Control por empresa y vigencia.</p>
            </div>
            <select
              value={selectedCompany}
              onChange={(e) => setSelectedCompany(e.target.value)}
              className="rounded-[12px] border border-[#dce4f0] bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-[0_2px_8px_rgba(15,45,93,0.06)] outline-none focus:border-[#3b6fd4] focus:ring-2 focus:ring-[#3b6fd4]/20"
            >
              <option value="all">Todas las empresas</option>
              {visibleCompanies.map((company) => (
                <option key={company.Company_Id} value={company.Company_Id}>
                  {company.NameCompany || company.Name || `Empresa ${company.Company_Id}`}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <p className="text-sm text-gray-500">Cargando licencias...</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-gray-500">No hay licencias registradas.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-[#eaf0fa] text-left">
                    {["Empresa","Tipo","Vigencia","Usuarios","Estado","Acciones"].map(col => (
                      <th key={col} className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-[#6b7a96] first:pl-6">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.Licencia_Id} className="border-t border-[#eaf0fa] align-top hover:bg-[#f4f7ff]/60 transition">
                      <td className="px-4 py-3 text-sm text-slate-800 first:pl-6">{item.CompanyName || `Empresa ${item.Company_Id}`}</td>
                      <td className="px-4 py-3 text-sm text-slate-800">{item.Tipo}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        <div>{toDateInput(item.FechaInicio) || "-"}</div>
                        <div>{toDateInput(item.FechaVencimiento) || "Sin vencimiento"}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {item.MaxUsuarios ? (
                          <>
                            <div>{item.UsuariosActivos ?? 0} / {item.MaxUsuarios}</div>
                            <div className="text-xs text-gray-500">
                              {item.CupoDisponible === 0
                                ? "Sin cupo disponible"
                                : `${item.CupoDisponible} cupo(s) libres`}
                            </div>
                          </>
                        ) : (
                          <>
                            <div>Sin limite</div>
                            <div className="text-xs text-gray-500">
                              {item.UsuariosActivos ?? 0} activo(s)
                            </div>
                          </>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                          item.Vigente ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"
                        }`}>
                          {item.Vigente ? "Vigente" : item.Activa ? "Vencida" : "Inactiva"}
                        </span>
                        {item.CupoLleno && (
                          <div className="mt-1 text-xs font-medium text-amber-600">
                            Límite de usuarios alcanzado
                          </div>
                        )}
                        {item.DiasRestantes !== null && (
                          <div className="mt-1 text-xs text-gray-500">
                            {item.DiasRestantes >= 0
                              ? `${item.DiasRestantes} dia(s) restantes`
                              : `${Math.abs(item.DiasRestantes)} dia(s) vencida`}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(item)}
                            className="rounded-[9px] border border-[#1b3d86]/20 bg-[#f0f4ff] px-3 py-1.5 text-xs font-semibold text-[#1b3d86] hover:bg-[#e4ecff] transition"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(item)}
                            className="rounded-[9px] border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition"
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
