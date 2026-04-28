import React, { useEffect, useState } from "react";
import api from "../../services/api";

const EMPTY_ADMIN = {
  Name: "", Lastname: "", Email: "", Password: "DefaultPass123!", PhoneNumber: "",
};

const premiumField = "w-full rounded-[12px] border border-[#dce4f0] bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-[0_2px_8px_rgba(15,45,93,0.06)] outline-none focus:border-[#3b6fd4] focus:ring-2 focus:ring-[#3b6fd4]/20";

export default function PanelAdministradores() {
  const [empresas, setEmpresas] = useState([]);
  const [selectedEmpresa, setSelectedEmpresa] = useState(null);
  const [admins, setAdmins] = useState([]);
  const [loadingEmpresas, setLoadingEmpresas] = useState(false);
  const [loadingAdmins, setLoadingAdmins] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formAdmin, setFormAdmin] = useState(EMPTY_ADMIN);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoadingEmpresas(true);
    api.get("/superadmin/empresas")
      .then(r => setEmpresas(r.data.items || []))
      .catch(() => setError("Error cargando empresas"))
      .finally(() => setLoadingEmpresas(false));
  }, []);

  const loadAdmins = async (empresa) => {
    setSelectedEmpresa(empresa);
    setAdmins([]);
    setShowForm(false);
    setError("");
    setLoadingAdmins(true);
    try {
      const res = await api.get(`/superadmin/empresas/${empresa.Company_Id}/admins`);
      setAdmins(res.data.items || []);
    } catch {
      setError("Error cargando admins");
    } finally {
      setLoadingAdmins(false);
    }
  };

  const handleCrearAdmin = async () => {
    if (!formAdmin.Name || !formAdmin.Email || !formAdmin.Password) {
      setError("Nombre, email y contraseña son requeridos");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api.post(`/superadmin/empresas/${selectedEmpresa.Company_Id}/admins`, formAdmin);
      setShowForm(false);
      setFormAdmin(EMPTY_ADMIN);
      const res = await api.get(`/superadmin/empresas/${selectedEmpresa.Company_Id}/admins`);
      setAdmins(res.data.items || []);
    } catch (e) {
      setError(e?.response?.data?.detail || "Error creando administrador");
    } finally {
      setSaving(false);
    }
  };

  const handleRevocar = async (admin) => {
    if (!window.confirm(`¿Revocar admin a "${admin.name || admin.email}"?`)) return;
    try {
      await api.delete(`/superadmin/empresas/${selectedEmpresa.Company_Id}/admins/${admin.id}`);
      const res = await api.get(`/superadmin/empresas/${selectedEmpresa.Company_Id}/admins`);
      setAdmins(res.data.items || []);
    } catch (e) {
      alert(e?.response?.data?.detail || "Error");
    }
  };

  return (
    <div
      className="min-h-screen w-full px-4 sm:px-6 py-6 space-y-5"
      style={{ background: 'radial-gradient(ellipse at 70% 0%, rgba(59,107,212,0.07) 0%, rgba(255,255,255,0) 60%), radial-gradient(ellipse at 0% 80%, rgba(99,102,241,0.05) 0%, rgba(255,255,255,0) 55%), #f4f6fb' }}
    >
      <div className="mx-auto max-w-7xl space-y-5">

        {/* Header */}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#3b6fd4]">Superadmin</p>
          <h1 className="text-2xl font-bold leading-tight text-[#0d1f3c]">Administradores de Empresas</h1>
          <p className="text-sm text-slate-500">Selecciona una empresa para ver y gestionar sus administradores</p>
        </div>

        {error && (
          <div className="rounded-[14px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {/* Empresa selector */}
        <div className="rounded-[24px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(245,248,255,0.9)_100%)] p-6 shadow-[0_4px_20px_rgba(15,45,93,0.07)]">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96]">Seleccionar empresa</p>
          {loadingEmpresas ? (
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 rounded-full border-2 border-[#1b3d86]/20 border-t-[#1b3d86] animate-spin" />
              <span className="text-sm text-slate-400">Cargando empresas...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {empresas.map(e => (
                <button
                  key={e.Company_Id}
                  onClick={() => loadAdmins(e)}
                  className={`text-left px-4 py-3 rounded-[14px] border text-sm transition ${
                    selectedEmpresa?.Company_Id === e.Company_Id
                      ? "border-[#1b3d86] bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] text-white shadow-[0_4px_12px_rgba(27,61,134,0.25)]"
                      : "border-[#dce4f0] bg-white text-slate-700 hover:border-[#3b6fd4] hover:bg-[#f4f7ff]"
                  }`}
                >
                  <div className="font-semibold">{e.NameCompany}</div>
                  <div className={`text-xs mt-0.5 ${selectedEmpresa?.Company_Id === e.Company_Id ? "text-blue-200" : "text-slate-400"}`}>{e.RFC || "Sin RFC"}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Admins panel */}
        {selectedEmpresa && (
          <div className="rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(245,248,255,0.9)_100%)] shadow-[0_18px_40px_rgba(15,45,93,0.10)] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#eaf0fa]">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96]">Administradores</p>
                <h2 className="text-base font-bold text-[#0d1f3c]">{selectedEmpresa.NameCompany}</h2>
              </div>
              <button
                onClick={() => { setShowForm(v => !v); setError(""); }}
                className="rounded-[14px] bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(27,61,134,0.30)] transition"
              >
                {showForm ? "Cancelar" : "+ Nuevo Admin"}
              </button>
            </div>

            {showForm && (
              <div className="px-6 py-5 border-b border-[#eaf0fa] bg-[#f8faff]">
                <div className="grid grid-cols-2 gap-3 max-w-xl">
                  {[
                    ["Nombre *", "Name", "text"],
                    ["Apellido", "Lastname", "text"],
                    ["Email *", "Email", "email"],
                    ["Contraseña *", "Password", "password"],
                    ["Teléfono", "PhoneNumber", "text"],
                  ].map(([label, key, type]) => (
                    <div key={key}>
                      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">{label}</label>
                      <input
                        type={type}
                        className={premiumField}
                        value={formAdmin[key]}
                        onChange={ev => setFormAdmin(f => ({ ...f, [key]: ev.target.value }))}
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-4">
                  <button
                    onClick={handleCrearAdmin}
                    disabled={saving}
                    className="rounded-[12px] bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-5 py-2 text-sm font-semibold text-white shadow-[0_4px_10px_rgba(27,61,134,0.25)] disabled:opacity-50 transition"
                  >
                    {saving ? "Creando..." : "Crear Administrador"}
                  </button>
                </div>
              </div>
            )}

            {loadingAdmins ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 rounded-full border-4 border-[#1b3d86]/20 border-t-[#1b3d86] animate-spin" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-[#eaf0fa]">
                      {["Nombre", "Email", "Teléfono", "Estado", "Acciones"].map(col => (
                        <th key={col} className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96] first:pl-6 last:pr-6">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {admins.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-sm text-slate-400">Sin administradores asignados</td>
                      </tr>
                    ) : admins.map(a => (
                      <tr key={a.id} className="border-t border-[#eaf0fa] transition hover:bg-[#f4f7ff]/60">
                        <td className="px-4 py-3 pl-6 text-sm font-semibold text-slate-800">{a.name || "—"}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{a.email || "—"}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{a.phone || "—"}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                            a.is_active
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-slate-200 bg-slate-50 text-slate-500"
                          }`}>
                            {a.is_active ? "Activo" : "Inactivo"}
                          </span>
                        </td>
                        <td className="px-4 py-3 pr-6">
                          <button
                            onClick={() => handleRevocar(a)}
                            className="rounded-[9px] border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition"
                          >
                            Revocar
                          </button>
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
    </div>
  );
}
