import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { crmService } from "../../services/crmService";
import { notify } from "../../services/notify";
import confirm from "../../services/confirm";
import api from "../../services/api";
import { socket } from "../../services/socket";
import { getDefaultCompanyId } from "../../utils/tokenHelper";

function Oportunidades() {
  const [oportunidades, setOportunidades] = useState([]);
  const [etapas, setEtapas] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [defaultCompanyId, setDefaultCompanyId] = useState(1);
  const [form, setForm] = useState({
    NombreOportunidad: "",
    Company_Id: 1,
    MontoEstimado: "",
    Probabilidad: "",
    Client_Id: "",
  });

  const navigate = useNavigate();

  useEffect(() => {
    const companyId = getDefaultCompanyId();
    setDefaultCompanyId(companyId);
    setForm(prev => ({ ...prev, Company_Id: companyId }));
  }, []);

  const cargarEtapas = async () => {
    try {
      const res = await crmService.getEtapas();
      const data = res?.data || res;
      setEtapas(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error al cargar etapas CRM", error);
    }
  };

  const cargarOportunidades = async () => {
    setLoading(true);
    try {
      const res = await crmService.getOportunidades();
      const data = res?.data || res?.oportunidades || res;
      setOportunidades(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error al cargar oportunidades", error);
      notify(error.response?.data?.message || "Error al cargar oportunidades", "error");
      setOportunidades([]);
    } finally {
      setLoading(false);
    }
  };

  const cargarClientes = async () => {
    try {
      const res = await api.get("/clients");
      const data = res?.data?.data || res?.data || res;
      setClientes(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error al cargar clientes para CRM", error);
      setClientes([]);
    }
  };

  useEffect(() => {
    cargarEtapas();
    cargarOportunidades();
    cargarClientes();
  }, []);

  useEffect(() => {
    const handler = () => {
      cargarOportunidades();
    };

    socket.on("crm:oportunidad:changed", handler);

    return () => {
      socket.off("crm:oportunidad:changed", handler);
    };
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCrearOportunidad = async (e) => {
    e.preventDefault();
    if (!form.NombreOportunidad) {
      notify("Captura un nombre para la oportunidad", "error");
      return;
    }
    setCreating(true);
    try {
      const payload = {
        Company_Id: Number(form.Company_Id) || defaultCompanyId,
        NombreOportunidad: form.NombreOportunidad,
        MontoEstimado: form.MontoEstimado ? Number(form.MontoEstimado) : null,
        Probabilidad: form.Probabilidad !== "" ? Number(form.Probabilidad) : null,
        Client_Id: form.Client_Id ? Number(form.Client_Id) : null,
      };
      await crmService.createOportunidad(payload);
      notify("Oportunidad creada", "success");
      setForm({ ...form, NombreOportunidad: "", MontoEstimado: "", Probabilidad: "", Client_Id: "" });
      await cargarOportunidades();
    } catch (error) {
      console.error("Error al crear oportunidad", error);
      notify(error.response?.data?.message || "Error al crear oportunidad", "error");
    } finally {
      setCreating(false);
    }
  };

  const getEtapaNombre = (etapaId) => {
    const etapa = etapas.find((e) => e.Etapa_Id === etapaId);
    return etapa ? etapa.Nombre : "-";
  };

  const handleEliminar = async (op) => {
    const ok = await confirm(
      "¿Seguro que deseas eliminar esta oportunidad? Esta acción no se puede deshacer.",
      "Eliminar oportunidad",
      "Eliminar",
      "Cancelar"
    );
    if (!ok) return;

    try {
      await crmService.deleteOportunidad(op.Oportunidad_Id);
      notify("Oportunidad eliminada", "success");
      await cargarOportunidades();
    } catch (error) {
      console.error("Error al eliminar oportunidad", error);
      notify(error.response?.data?.message || "Error al eliminar oportunidad", "error");
    }
  };

  return (
    <div className="w-full h-screen bg-white rounded-none shadow-none p-6 overflow-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Oportunidades</h2>
          <p className="text-sm text-gray-600">Administración de oportunidades comerciales y pipeline de ventas.</p>
        </div>
      </div>

      <form onSubmit={handleCrearOportunidad} className="mb-6 grid grid-cols-1 md:grid-cols-5 gap-4 text-sm">
        <div className="md:col-span-2">
          <label className="block text-gray-700 mb-1">Nombre de la oportunidad</label>
          <input
            type="text"
            name="NombreOportunidad"
            value={form.NombreOportunidad}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm" 
            placeholder="Ej. Proyecto cajas para Cliente XYZ"
          />
        </div>
        <div>
          <label className="block text-gray-700 mb-1">Monto estimado</label>
          <input
            type="number"
            name="MontoEstimado"
            value={form.MontoEstimado}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            placeholder="0.00"
          />
        </div>
        <div>
          <label className="block text-gray-700 mb-1">Probabilidad (%)</label>
          <input
            type="number"
            min="0"
            max="100"
            name="Probabilidad"
            value={form.Probabilidad}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            placeholder="0 - 100"
          />
        </div>
        <div>
          <label className="block text-gray-700 mb-1">Cliente (opcional)</label>
          <select
            name="Client_Id"
            value={form.Client_Id}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          >
            <option value="">Sin asignar</option>
            {clientes.map((c) => (
              <option key={c.Client_Id} value={c.Client_Id}>
                {c.LegalName || c.CommercialName} ({c.RFC})
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={creating}
            className="w-full px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm disabled:bg-gray-400"
          >
            {creating ? "Creando..." : "+ Nueva oportunidad"}
          </button>
        </div>
      </form>

      {loading ? (
        <p className="text-gray-900">Cargando oportunidades...</p>
      ) : (
        <div className="overflow-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="text-gray-600">
                <th className="py-2 pl-4 pr-4 w-20">ID</th>
                <th className="py-2 pr-4">Oportunidad</th>
                <th className="py-2 pr-4 w-40">Etapa</th>
                <th className="py-2 pr-4 w-32 text-right">Monto estimado</th>
                <th className="py-2 pr-4 w-32">Status</th>
                <th className="py-2 pr-4 w-40">Fecha creación</th>
                <th className="py-2 pr-4 w-32 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {oportunidades.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-4 px-4 text-gray-600">
                    No hay oportunidades registradas.
                  </td>
                </tr>
              )}
              {oportunidades.map((op) => (
                <tr
                  key={op.Oportunidad_Id}
                  className="border-t border-gray-200 hover:bg-gray-50 cursor-pointer"
                  onClick={() => navigate(`/crm/oportunidades/${op.Oportunidad_Id}`)}
                >
                  <td className="py-3 pl-4 pr-4 text-gray-900">{op.Oportunidad_Id}</td>
                  <td className="py-3 pr-4 text-gray-900">{op.NombreOportunidad}</td>
                  <td className="py-3 pr-4 text-gray-900">{op.EtapaNombre || getEtapaNombre(op.Etapa_Id)}</td>
                  <td className="py-3 pr-4 text-gray-900 text-right">
                    {typeof op.MontoEstimado === "number" ? op.MontoEstimado.toFixed(2) : op.MontoEstimado}
                  </td>
                  <td className="py-3 pr-4 text-gray-900">{op.Status || "Abierta"}</td>
                  <td className="py-3 pr-4 text-gray-900">
                    {op.FechaCreacion ? new Date(op.FechaCreacion).toLocaleString() : "-"}
                  </td>
                  <td className="py-3 pr-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/crm/oportunidades/${op.Oportunidad_Id}`);
                        }}
                        className="px-3 py-1 text-xs bg-[#092052] text-white rounded hover:bg-[#0d3a7a]"
                      >
                        Ver detalle
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEliminar(op);
                        }}
                        className="px-3 py-1 text-xs bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
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
  );
}

export default Oportunidades;
