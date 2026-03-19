import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { crmService } from "../../services/crmService";
import { notify } from "../../services/notify";
import confirm from "../../services/confirm";
import ModalSolicitarProductos from "../../components/ModalSolicitarProductos";

function OportunidadDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [oportunidad, setOportunidad] = useState(null);
  const [actividades, setActividades] = useState([]);
  const [etapas, setEtapas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savingStage, setSavingStage] = useState(false);
  const [closing, setClosing] = useState(false);
  const [actividadForm, setActividadForm] = useState({
    Tipo: "Llamada",
    Titulo: "",
    Descripcion: "",
    FechaProgramada: "",
  });
  const [modalProductosOpen, setModalProductosOpen] = useState(false);

  const cargarEtapas = async () => {
    try {
      const res = await crmService.getEtapas();
      const data = res?.data || res;
      setEtapas(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error al cargar etapas", error);
    }
  };

  const cargarOportunidad = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await crmService.getOportunidad(id);
      const data = res?.data || res;
      setOportunidad(data.oportunidad || data.Oportunidad || data);
      setActividades(data.actividades || data.Actividades || []);
    } catch (error) {
      console.error("Error al obtener oportunidad", error);
      notify(error.response?.data?.message || "Error al obtener oportunidad", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarEtapas();
    cargarOportunidad();
  }, [id]);

  const handleChangeEtapa = async (e) => {
    const etapaId = Number(e.target.value);
    if (!oportunidad || !etapaId || etapaId === oportunidad.Etapa_Id) return;
    setSavingStage(true);
    try {
      await crmService.cambiarEtapa(oportunidad.Oportunidad_Id, etapaId);
      notify("Etapa actualizada", "success");
      await cargarOportunidad();
    } catch (error) {
      console.error("Error al cambiar etapa", error);
      notify(error.response?.data?.message || "Error al cambiar etapa", "error");
    } finally {
      setSavingStage(false);
    }
  };

  const handleActividadChange = (e) => {
    const { name, value } = e.target;
    setActividadForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleAgregarActividad = async (e) => {
    e.preventDefault();
    if (!actividadForm.Titulo) {
      notify("Captura un título para la actividad", "error");
      return;
    }
    try {
      await crmService.crearActividad(id, {
        ...actividadForm,
        FechaProgramada: actividadForm.FechaProgramada || null,
      });
      notify("Actividad creada", "success");
      setActividadForm({ Tipo: "Llamada", Titulo: "", Descripcion: "", FechaProgramada: "" });
      await cargarOportunidad();
    } catch (error) {
      console.error("Error al crear actividad", error);
      notify(error.response?.data?.message || "Error al crear actividad", "error");
    }
  };

  const handleSolicitarProductos = async (productos) => {
    try {
      await crmService.crearActividad(id, {
        Tipo: "Visita",
        Titulo: "Solicitud de productos",
        Descripcion: JSON.stringify(productos),
        FechaProgramada: null,
      });
      notify("Productos solicitados correctamente", "success");
      await cargarOportunidad();
    } catch (error) {
      console.error("Error al solicitar productos", error);
      notify(error.response?.data?.message || "Error al solicitar productos", "error");
    }
  };

  const handleCerrar = async (resultado) => {
    if (!oportunidad) return;
    const mensaje =
      resultado === "Ganada"
        ? "¿Marcar la oportunidad como GANADA y generar la venta desde la cotización si existe?"
        : "¿Marcar la oportunidad como PERDIDA?";
    const ok = await confirm(mensaje, "Cerrar oportunidad", "Confirmar", "Cancelar");
    if (!ok) return;

    setClosing(true);
    try {
      await crmService.cerrarOportunidad(oportunidad.Oportunidad_Id, resultado, true);
      notify("Oportunidad actualizada", "success");
      await cargarOportunidad();
    } catch (error) {
      console.error("Error al cerrar oportunidad", error);
      notify(error.response?.data?.message || "Error al cerrar oportunidad", "error");
    } finally {
      setClosing(false);
    }
  };

  const handleEliminar = async () => {
    if (!oportunidad) return;
    const ok = await confirm(
      "¿Seguro que deseas eliminar esta oportunidad? Esta acción no se puede deshacer.",
      "Eliminar oportunidad",
      "Eliminar",
      "Cancelar"
    );
    if (!ok) return;

    try {
      await crmService.deleteOportunidad(oportunidad.Oportunidad_Id);
      notify("Oportunidad eliminada", "success");
      navigate("/crm/oportunidades");
    } catch (error) {
      console.error("Error al eliminar oportunidad", error);
      notify(error.response?.data?.message || "Error al eliminar oportunidad", "error");
    }
  };

  const getEtapaNombre = (etapaId) => {
    const etapa = etapas.find((e) => e.Etapa_Id === etapaId);
    return etapa ? etapa.Nombre : "-";
  };

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-40 overflow-auto">
      <div className="min-h-screen flex items-center justify-center p-1 sm:p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl my-2 flex flex-col max-h-[98vh]">
          <div className="flex items-center justify-between px-3 py-3 sm:px-6 sm:py-4 border-b flex-shrink-0 bg-white">
            <div className="flex-1 min-w-0 pr-2">
              <h2 className="text-sm sm:text-xl font-bold text-gray-900 truncate">Oportunidad #{id}</h2>
              {oportunidad && (
                <p className="text-xs text-gray-600 truncate">
                  {oportunidad.ClientLegalName || oportunidad.ClientCommercialName || "Sin cliente"}
                </p>
              )}
            </div>
            <button
              onClick={() => navigate("/crm/oportunidades")}
              className="px-2 py-1 sm:px-3 sm:py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-xs flex-shrink-0"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-auto p-2 sm:p-4 md:p-6">
          {loading && <p className="text-gray-900">Cargando oportunidad...</p>}

          {!loading && oportunidad && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6 text-xs sm:text-sm">
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-2">Información general</h3>
                  <p>
                    <span className="text-gray-600">Nombre:</span> {oportunidad.NombreOportunidad}
                  </p>
                  <p>
                    <span className="text-gray-600">Monto estimado:</span> {" "}
                    {typeof oportunidad.MontoEstimado === "number"
                      ? oportunidad.MontoEstimado.toFixed(2)
                      : oportunidad.MontoEstimado}
                  </p>
                  <p>
                    <span className="text-gray-600">Moneda:</span> {oportunidad.Moneda || "MXN"}
                  </p>
                  <p>
                    <span className="text-gray-600">Probabilidad:</span>{" "}
                    {oportunidad.Probabilidad != null ? oportunidad.Probabilidad : 0}%
                  </p>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-2">Etapa & estado</h3>
                  <label className="block text-gray-700 mb-1">Etapa del pipeline</label>
                  <select
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm mb-2"
                    value={oportunidad.Etapa_Id || ""}
                    onChange={handleChangeEtapa}
                    disabled={savingStage}
                  >
                    <option value="">Seleccione etapa</option>
                    {etapas.map((e) => (
                      <option key={e.Etapa_Id} value={e.Etapa_Id}>
                        {e.Orden}. {e.Nombre}
                      </option>
                    ))}
                  </select>
                  <p>
                    <span className="text-gray-600">Etapa actual:</span> {getEtapaNombre(oportunidad.Etapa_Id)}
                  </p>
                  <p>
                    <span className="text-gray-600">Status:</span> {oportunidad.Status || "Abierta"}
                  </p>
                  {oportunidad.Venta_Id && (
                    <p className="mt-1">
                      <span className="text-gray-600">Venta generada:</span>{" "}
                      <button
                        className="text-blue-700 underline text-xs"
                        onClick={() => navigate(`/ventas/${oportunidad.Venta_Id}`)}
                      >
                        Ver venta #{oportunidad.Venta_Id}
                      </button>
                    </p>
                  )}
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex flex-col gap-2">
                  <h3 className="font-semibold text-gray-900 mb-2">Acciones</h3>
                  <button
                    disabled={closing}
                    onClick={() => handleCerrar("Ganada")}
                    className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm disabled:bg-gray-400"
                  >
                    {closing ? "Procesando..." : "Marcar como ganada"}
                  </button>
                  <button
                    disabled={closing}
                    onClick={() => handleCerrar("Perdida")}
                    className="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm disabled:bg-gray-400"
                  >
                    Marcar como perdida
                  </button>
                  <button
                    type="button"
                    onClick={handleEliminar}
                    className="mt-2 px-3 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 text-xs text-left"
                  >
                    Eliminar oportunidad
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                <div className="lg:col-span-2">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Historial de actividades</h3>
                  {actividades.length === 0 ? (
                    <p className="text-sm text-gray-600">No hay actividades registradas.</p>
                  ) : (
                    <div className="border border-gray-200 rounded-lg divide-y divide-gray-200 bg-white">
                      {actividades.map((act) => (
                        <div key={act.Actividad_Id} className="p-3 text-sm">
                          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
                            <div className="flex-1">
                              <p className="font-semibold text-gray-900">
                                [{act.Tipo}] {act.Titulo}
                              </p>
                              {act.Descripcion && (
                                <p className="text-gray-700 text-xs mt-1">{act.Descripcion}</p>
                              )}
                              {act.Productos && act.Productos.length > 0 && (
                                <div className="mt-2 text-xs">
                                  <p className="font-medium text-gray-700 mb-1">Productos:</p>
                                  <ul className="list-disc list-inside space-y-0.5 text-gray-600">
                                    {act.Productos.map((prod, idx) => (
                                      <li key={idx}>
                                        {prod.Nombre || prod.SKU} {prod.Cantidad && `(${prod.Cantidad})`}
                                      </li>
                                    ))}
                                  </ul>
                                  {!act.Completada && (
                                    <button
                                      onClick={async () => {
                                        try {
                                          await crmService.enviarActividadAProduccion(act.Actividad_Id, act.Productos);
                                          notify('Enviado a producción', 'success');
                                          await cargarOportunidad();
                                        } catch (error) {
                                          notify(error.response?.data?.message || 'Error al enviar a producción', 'error');
                                        }
                                      }}
                                      className="mt-2 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs"
                                    >
                                      🏭 Enviar a producción
                                    </button>
                                  )}
                                </div>
                              )}
                              {act.Tipo === 'Visita' && !act.Completada && (!act.Productos || act.Productos.length === 0) && (
                                <div className="mt-2 text-xs text-gray-500">
                                  <p>Para enviar a producción, agrega productos en formato JSON en la descripción:</p>
                                  <code className="text-xs bg-gray-100 px-1">[{'{'}"Producto_Id":1,"Cantidad":10{'}'}]</code>
                                </div>
                              )}
                            </div>
                            <div className="text-xs text-gray-600 text-right min-w-[180px]">
                              {act.FechaProgramada && (
                                <p>
                                  Prog.: {new Date(act.FechaProgramada).toLocaleString()}
                                </p>
                              )}
                              {act.FechaReal && (
                                <p>
                                  Real: {new Date(act.FechaReal).toLocaleString()}
                                </p>
                              )}
                              <p className="mt-1">
                                Estado: {act.Completada ? "Completada" : "Pendiente"}
                              </p>
                              {act.Resultado && <p>Resultado: {act.Resultado}</p>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Nueva actividad</h3>
                  <button
                    type="button"
                    onClick={() => setModalProductosOpen(true)}
                    className="w-full mb-4 px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm font-medium"
                  >
                    📦 Solicitar productos
                  </button>
                  <form onSubmit={handleAgregarActividad} className="space-y-3 text-sm">
                    <div>
                      <label className="block text-gray-700 mb-1">Tipo</label>
                      <select
                        name="Tipo"
                        value={actividadForm.Tipo}
                        onChange={handleActividadChange}
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                      >
                        <option value="Llamada">Llamada</option>
                        <option value="Visita">Visita</option>
                        <option value="Email">Email</option>
                        <option value="Tarea">Tarea</option>
                        <option value="Postventa">Postventa</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-gray-700 mb-1">Título</label>
                      <input
                        type="text"
                        name="Titulo"
                        value={actividadForm.Titulo}
                        onChange={handleActividadChange}
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-700 mb-1">Fecha programada</label>
                      <input
                        type="datetime-local"
                        name="FechaProgramada"
                        value={actividadForm.FechaProgramada}
                        onChange={handleActividadChange}
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-700 mb-1">Descripción</label>
                      <textarea
                        name="Descripcion"
                        value={actividadForm.Descripcion}
                        onChange={handleActividadChange}
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm h-24"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full px-3 py-2 bg-[#092052] text-white rounded hover:bg-[#0d3a7a] text-sm"
                    >
                      Agregar actividad
                    </button>
                  </form>
                </div>
              </div>
            </>
          )}

          {!loading && !oportunidad && (
            <p className="text-gray-900">No se encontró la oportunidad solicitada.</p>
          )}
          </div>
        </div>
      </div>
      
      <ModalSolicitarProductos
        isOpen={modalProductosOpen}
        onClose={() => setModalProductosOpen(false)}
        onConfirm={handleSolicitarProductos}
      />
    </div>
  );
}

export default OportunidadDetalle;
