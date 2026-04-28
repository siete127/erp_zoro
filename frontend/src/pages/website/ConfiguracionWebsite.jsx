import React, { useState, useEffect } from "react";
import api from "../../services/api";
import { notify } from "../../services/notify";

export default function ConfiguracionWebsite() {
  const [config, setConfig] = useState(null);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [tabActiva, setTabActiva] = useState("config");

  const cargar = async () => {
    try {
      const [configRes, leadsRes] = await Promise.all([
        api.get("/website/config"),
        api.get("/website/leads"),
      ]);
      setConfig(configRes.data);
      setLeads(leadsRes.data.items || []);
    } catch {
      notify("Error al cargar configuración", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  const handleGuardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      await api.put("/website/config", {
        TituloPagina: config.TituloPagina,
        Descripcion: config.Descripcion,
        ColorPrimario: config.ColorPrimario,
        MostrarPrecios: config.MostrarPrecios,
        Activo: config.Activo,
      });
      notify("Configuración guardada", "success");
    } catch {
      notify("Error al guardar configuración", "error");
    } finally {
      setGuardando(false);
    }
  };

  if (loading) return <div className="p-6 text-center text-gray-500">Cargando...</div>;
  if (!config) return null;

  const urlPublica = `${window.location.origin}/website/${config.Slug}`;

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#092052]">Website Público</h1>
        <p className="text-sm text-gray-500 mt-1">Configura el catálogo público y la presencia web de tu empresa</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b mb-6">
        {["config", "leads"].map(tab => (
          <button
            key={tab}
            onClick={() => setTabActiva(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${
              tabActiva === tab
                ? "border-[#092052] text-[#092052]"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab === "config" ? "Configuración" : `Leads (${leads.length})`}
          </button>
        ))}
      </div>

      {tabActiva === "config" && (
        <form onSubmit={handleGuardar} className="space-y-5">
          {/* Estado y URL */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-gray-900">Estado del sitio</h3>
                <p className="text-xs text-gray-500 mt-0.5">Activa tu sitio para que sea visible públicamente</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.Activo || false}
                  onChange={e => setConfig({...config, Activo: e.target.checked})}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#092052]"></div>
              </label>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">URL pública de tu catálogo:</p>
              <div className="flex items-center gap-2">
                <code className="text-xs text-blue-700 bg-blue-50 px-2 py-1 rounded flex-1 break-all">{urlPublica}</code>
                <button
                  type="button"
                  onClick={() => { navigator.clipboard.writeText(urlPublica); notify("URL copiada", "success"); }}
                  className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 border rounded"
                >
                  Copiar
                </button>
                <a href={urlPublica} target="_blank" rel="noreferrer"
                  className="text-xs text-blue-600 hover:underline px-2 py-1 border rounded">
                  Ver
                </a>
              </div>
            </div>
          </div>

          {/* Personalización */}
          <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
            <h3 className="font-semibold text-gray-900">Personalización</h3>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Título de la página</label>
              <input
                value={config.TituloPagina || ""}
                onChange={e => setConfig({...config, TituloPagina: e.target.value})}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="Ej. Catálogo de productos — Mi Empresa"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Descripción / Slogan</label>
              <textarea
                value={config.Descripcion || ""}
                onChange={e => setConfig({...config, Descripcion: e.target.value})}
                rows={2}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="Breve descripción de tu empresa o propuesta de valor"
              />
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-700 mb-1">Color primario</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={config.ColorPrimario || "#092052"}
                    onChange={e => setConfig({...config, ColorPrimario: e.target.value})}
                    className="w-10 h-10 rounded border cursor-pointer"
                  />
                  <input
                    value={config.ColorPrimario || "#092052"}
                    onChange={e => setConfig({...config, ColorPrimario: e.target.value})}
                    className="flex-1 border rounded-lg px-3 py-2 text-sm font-mono"
                    placeholder="#092052"
                  />
                </div>
              </div>
              <div className="flex-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.MostrarPrecios || false}
                    onChange={e => setConfig({...config, MostrarPrecios: e.target.checked})}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700">Mostrar precios en el catálogo</span>
                </label>
                <p className="text-xs text-gray-400 mt-0.5 ml-5">Los visitantes verán el precio de venta de cada producto</p>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button type="submit" disabled={guardando}
              className="px-6 py-2 bg-[#092052] text-white rounded-lg text-sm font-semibold hover:bg-[#0d2f6e] disabled:opacity-50">
              {guardando ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </form>
      )}

      {tabActiva === "leads" && (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          {leads.length === 0 ? (
            <div className="py-12 text-center">
              <div className="text-4xl mb-3">📬</div>
              <p className="text-gray-500 text-sm">No hay leads aún</p>
              <p className="text-gray-400 text-xs mt-1">Los contactos de tu sitio web aparecerán aquí</p>
            </div>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Nombre</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Empresa</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Origen</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Estado</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {leads.map((l) => (
                  <tr key={l.Lead_Id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      <div>{l.Nombre}</div>
                      {l.Telefono && <div className="text-xs text-gray-400">{l.Telefono}</div>}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{l.Email}</td>
                    <td className="px-4 py-3 text-gray-600">{l.Empresa || "—"}</td>
                    <td className="px-4 py-3 text-xs capitalize text-gray-500">{l.Origen}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${
                        l.Estado === "convertido" ? "bg-green-100 text-green-800" :
                        l.Estado === "contactado" ? "bg-blue-100 text-blue-800" :
                        "bg-yellow-100 text-yellow-800"
                      }`}>{l.Estado}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {l.FechaCreacion ? new Date(l.FechaCreacion).toLocaleDateString("es-MX") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
