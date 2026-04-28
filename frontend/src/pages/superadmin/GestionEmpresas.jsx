import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";

const EMPTY_EMPRESA = {
  NameCompany: "", RFC: "", LegalName: "",
  Email: "", FiscalRegime: "", TaxZipCode: "", Status: "Activo",
};

const premiumField = "w-full rounded-[12px] border border-[#dce4f0] bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-[0_2px_8px_rgba(15,45,93,0.06)] outline-none focus:border-[#3b6fd4] focus:ring-2 focus:ring-[#3b6fd4]/20";

export default function GestionEmpresas() {
  const navigate = useNavigate();
  const [empresas, setEmpresas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [showEmpresaModal, setShowEmpresaModal] = useState(false);
  const [editEmpresa, setEditEmpresa] = useState(null);
  const [formEmpresa, setFormEmpresa] = useState(EMPTY_EMPRESA);
  const [savingEmpresa, setSavingEmpresa] = useState(false);

  const [entrando, setEntrando] = useState(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/superadmin/empresas");
      setEmpresas(res.data.items || []);
    } catch {
      setError("Error cargando empresas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditEmpresa(null);
    setFormEmpresa(EMPTY_EMPRESA);
    setShowEmpresaModal(true);
  };

  const openEdit = (e) => {
    setEditEmpresa(e);
    setFormEmpresa({
      NameCompany: e.NameCompany || "", RFC: e.RFC || "", LegalName: e.LegalName || "",
      Email: e.Email || "", FiscalRegime: e.FiscalRegime || "",
      TaxZipCode: e.TaxZipCode || "", Status: e.Status || "Activo",
    });
    setShowEmpresaModal(true);
  };

  const saveEmpresa = async () => {
    setSavingEmpresa(true);
    try {
      if (editEmpresa) {
        await api.put(`/superadmin/empresas/${editEmpresa.Company_Id}`, formEmpresa);
      } else {
        await api.post("/superadmin/empresas", formEmpresa);
      }
      setShowEmpresaModal(false);
      load();
    } catch (e) {
      alert(e?.response?.data?.detail || "Error guardando empresa");
    } finally {
      setSavingEmpresa(false);
    }
  };

  const deleteEmpresa = async (e) => {
    if (!window.confirm(`¿Desactivar la empresa "${e.NameCompany}"?`)) return;
    try {
      await api.delete(`/superadmin/empresas/${e.Company_Id}`);
      load();
    } catch (err) {
      alert(err?.response?.data?.detail || "Error eliminando empresa");
    }
  };

  const handleEntrar = async (empresa) => {
    setEntrando(empresa.Company_Id);
    try {
      const res = await api.post(`/superadmin/empresas/${empresa.Company_Id}/impersonate`);
      const { token: newToken, empresa_name } = res.data;
      if (!newToken) throw new Error("Token no recibido");
      const originalToken = localStorage.getItem("token");
      localStorage.setItem("superadmin_original_token", originalToken);
      localStorage.setItem("superadmin_impersonate_name", empresa_name);
      localStorage.setItem("token", newToken);
      window.location.href = "/dashboard";
    } catch {
      alert("Error al entrar en la empresa");
      setEntrando(null);
    }
  };

  return (
    <div
      className="min-h-screen w-full px-4 sm:px-6 py-6 space-y-5"
      style={{ background: 'radial-gradient(ellipse at 70% 0%, rgba(59,107,212,0.07) 0%, rgba(255,255,255,0) 60%), radial-gradient(ellipse at 0% 80%, rgba(99,102,241,0.05) 0%, rgba(255,255,255,0) 55%), #f4f6fb' }}
    >
      <div className="mx-auto max-w-7xl space-y-5">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#3b6fd4]">Superadmin</p>
            <h1 className="text-2xl font-bold leading-tight text-[#0d1f3c]">Gestión de Empresas</h1>
            <p className="text-sm text-slate-500">Haz clic en "⚡ Entrar" para administrar una empresa</p>
          </div>
          <button
            onClick={openCreate}
            className="rounded-[14px] bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(27,61,134,0.30)] transition"
          >
            + Nueva Empresa
          </button>
        </div>

        {error && (
          <div className="rounded-[14px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {/* Table */}
        <div className="rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(245,248,255,0.9)_100%)] shadow-[0_18px_40px_rgba(15,45,93,0.10)] overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 rounded-full border-4 border-[#1b3d86]/20 border-t-[#1b3d86] animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[#eaf0fa]">
                    {["ID", "Empresa", "RFC", "Email", "Status", "Acciones"].map(col => (
                      <th key={col} className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96] first:pl-6 last:pr-6">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {empresas.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-sm text-slate-400">
                        Sin empresas registradas
                      </td>
                    </tr>
                  ) : empresas.map((e) => (
                    <tr key={e.Company_Id} className="border-t border-[#eaf0fa] transition hover:bg-[#f4f7ff]/60">
                      <td className="px-4 py-3 pl-6 text-sm text-slate-400">#{e.Company_Id}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-800">{e.NameCompany}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{e.RFC || "—"}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{e.Email || "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                          e.Status === "Activo"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-slate-200 bg-slate-50 text-slate-600"
                        }`}>
                          {e.Status || "Activo"}
                        </span>
                      </td>
                      <td className="px-4 py-3 pr-6">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEntrar(e)}
                            disabled={entrando === e.Company_Id}
                            className="rounded-[9px] bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-3 py-1.5 text-xs font-semibold text-white shadow-[0_2px_6px_rgba(27,61,134,0.25)] disabled:opacity-60 transition"
                          >
                            {entrando === e.Company_Id ? "Entrando..." : "⚡ Entrar"}
                          </button>
                          <button
                            onClick={() => openEdit(e)}
                            className="rounded-[9px] border border-[#1b3d86]/20 bg-[#f0f4ff] px-3 py-1.5 text-xs font-semibold text-[#1b3d86] hover:bg-[#e4ecff] transition"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => deleteEmpresa(e)}
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
        </div>

      </div>

      {/* Modal Empresa */}
      {showEmpresaModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-[20px] shadow-[0_24px_64px_rgba(10,20,50,0.22)]">
            <div className="bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-6 py-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-white">
                {editEmpresa ? "Editar Empresa" : "Nueva Empresa"}
              </h3>
              <button onClick={() => setShowEmpresaModal(false)} className="text-white/70 hover:text-white text-xl leading-none">×</button>
            </div>
            <div className="bg-white p-6">
              <div className="grid grid-cols-2 gap-3">
                {[
                  ["Nombre *", "NameCompany"], ["RFC", "RFC"],
                  ["Razón Social", "LegalName"], ["Email", "Email"],
                  ["Régimen Fiscal", "FiscalRegime"],
                  ["CP Fiscal", "TaxZipCode"], ["Status", "Status"],
                ].map(([label, key]) => (
                  <div key={key}>
                    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">{label}</label>
                    {key === "Status" ? (
                      <select className={premiumField} value={formEmpresa[key]} onChange={ev => setFormEmpresa(f => ({ ...f, [key]: ev.target.value }))}>
                        <option>Activo</option>
                        <option>Inactivo</option>
                      </select>
                    ) : (
                      <input className={premiumField} value={formEmpresa[key]} onChange={ev => setFormEmpresa(f => ({ ...f, [key]: ev.target.value }))} />
                    )}
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-5">
                <button
                  onClick={saveEmpresa}
                  disabled={savingEmpresa}
                  className="flex-1 rounded-[12px] bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_10px_rgba(27,61,134,0.25)] disabled:opacity-50 transition"
                >
                  {savingEmpresa ? "Guardando..." : "Guardar"}
                </button>
                <button
                  onClick={() => setShowEmpresaModal(false)}
                  disabled={savingEmpresa}
                  className="flex-1 rounded-[12px] border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
