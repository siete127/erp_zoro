import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../services/api";
import { notify } from "../../services/notify";

const prioridadColor = (p) => {
  if (p === "critica") return "bg-red-200 text-red-900";
  if (p === "alta") return "bg-red-100 text-red-800";
  if (p === "media") return "bg-yellow-100 text-yellow-800";
  return "bg-green-100 text-green-800";
};

const estadoLabel = (e) => e?.replace("_", " ") || "—";

export default function DetalleTicket() {
  const { ticketId } = useParams();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [comentario, setComentario] = useState("");
  const [esInterno, setEsInterno] = useState(false);
  const [enviandoComentario, setEnviandoComentario] = useState(false);
  const [cambiandoEstado, setCambiandoEstado] = useState(false);
  const [usuarios, setUsuarios] = useState([]);

  const cargar = async () => {
    try {
      const res = await api.get(`/helpdesk/${ticketId}`);
      setTicket(res.data);
    } catch {
      notify("Error al cargar ticket", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
    api.get("/users").then(r => setUsuarios(r.data.items || r.data || [])).catch(() => {});
  }, [ticketId]);

  const handleComentario = async (e) => {
    e.preventDefault();
    if (!comentario.trim()) return;
    setEnviandoComentario(true);
    try {
      await api.post(`/helpdesk/${ticketId}/comentarios`, { Texto: comentario, EsInterno: esInterno });
      notify("Comentario agregado", "success");
      setComentario("");
      cargar();
    } catch {
      notify("Error al agregar comentario", "error");
    } finally {
      setEnviandoComentario(false);
    }
  };

  const handleCambiarEstado = async (nuevoEstado) => {
    setCambiandoEstado(true);
    try {
      await api.patch(`/helpdesk/${ticketId}/estado`, { Estado: nuevoEstado });
      notify(`Estado cambiado a: ${estadoLabel(nuevoEstado)}`, "success");
      cargar();
    } catch {
      notify("Error al cambiar estado", "error");
    } finally {
      setCambiandoEstado(false);
    }
  };

  const handleAsignar = async (userId) => {
    try {
      await api.patch(`/helpdesk/${ticketId}/estado`, {
        Estado: ticket.Estado,
        AsignadoA: userId ? Number(userId) : null,
      });
      notify("Agente asignado", "success");
      cargar();
    } catch {
      notify("Error al asignar", "error");
    }
  };

  if (loading) return <div className="p-6 text-center text-gray-500">Cargando ticket...</div>;
  if (!ticket) return <div className="p-6 text-center text-red-500">Ticket no encontrado</div>;

  const ACCIONES_ESTADO = {
    abierto: ["en_progreso"],
    en_progreso: ["resuelto"],
    resuelto: ["cerrado", "abierto"],
    cerrado: ["abierto"],
  };

  const siguientesEstados = ACCIONES_ESTADO[ticket.Estado] || [];

  return (
    <div className="w-full max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <button onClick={() => navigate("/helpdesk")} className="text-sm text-gray-500 hover:text-gray-700 mb-2 flex items-center gap-1">
            ← Volver a Helpdesk
          </button>
          <h1 className="text-xl font-bold text-gray-900">#{ticket.Ticket_Id} — {ticket.Titulo}</h1>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${prioridadColor(ticket.Prioridad)}`}>
              {ticket.Prioridad}
            </span>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold capitalize bg-blue-100 text-blue-800">
              {estadoLabel(ticket.Estado)}
            </span>
            {ticket.Categoria && (
              <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">{ticket.Categoria}</span>
            )}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          {siguientesEstados.map(estado => (
            <button
              key={estado}
              onClick={() => handleCambiarEstado(estado)}
              disabled={cambiandoEstado}
              className="px-3 py-1.5 text-xs rounded-lg border font-medium hover:bg-gray-50 disabled:opacity-50 capitalize"
            >
              → {estadoLabel(estado)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna izquierda — detalles */}
        <div className="lg:col-span-2 space-y-4">
          {/* Descripción */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h3 className="font-semibold text-gray-900 mb-2">Descripción</h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">
              {ticket.Descripcion || "Sin descripción"}
            </p>
          </div>

          {/* Comentarios */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h3 className="font-semibold text-gray-900 mb-4">
              Comentarios ({ticket.comentarios?.length || 0})
            </h3>
            <div className="space-y-3 mb-4">
              {ticket.comentarios?.length === 0 && (
                <p className="text-sm text-gray-400">Sin comentarios aún.</p>
              )}
              {ticket.comentarios?.map((c) => (
                <div
                  key={c.Comentario_Id}
                  className={`rounded-lg p-3 text-sm ${c.EsInterno ? "bg-yellow-50 border border-yellow-200" : "bg-gray-50"}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-gray-800">{c.AutorNombre || "Usuario"}</span>
                    <div className="flex items-center gap-2">
                      {c.EsInterno && (
                        <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">Nota interna</span>
                      )}
                      <span className="text-xs text-gray-400">
                        {c.FechaCreacion ? new Date(c.FechaCreacion).toLocaleString("es-MX") : "—"}
                      </span>
                    </div>
                  </div>
                  <p className="text-gray-700 whitespace-pre-wrap">{c.Texto}</p>
                </div>
              ))}
            </div>

            {/* Agregar comentario */}
            <form onSubmit={handleComentario} className="border-t pt-4">
              <textarea
                value={comentario}
                onChange={e => setComentario(e.target.value)}
                rows={3}
                className="w-full border rounded-lg px-3 py-2 text-sm mb-2"
                placeholder="Escribe un comentario o respuesta..."
              />
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={esInterno}
                    onChange={e => setEsInterno(e.target.checked)}
                    className="rounded"
                  />
                  Nota interna (no visible para el cliente)
                </label>
                <button
                  type="submit"
                  disabled={enviandoComentario || !comentario.trim()}
                  className="px-4 py-2 bg-[#092052] text-white rounded-lg text-sm hover:bg-[#0d2f6e] disabled:opacity-50"
                >
                  {enviandoComentario ? "Enviando..." : "Agregar"}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Columna derecha — info del ticket */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm p-5 space-y-3 text-sm">
            <h3 className="font-semibold text-gray-900">Información</h3>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Cliente</p>
              <p className="text-gray-800">{ticket.ClienteNombre || "Sin cliente"}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Creado por</p>
              <p className="text-gray-800">{ticket.CreadoPorNombre || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Fecha creación</p>
              <p className="text-gray-800">{ticket.FechaCreacion ? new Date(ticket.FechaCreacion).toLocaleString("es-MX") : "—"}</p>
            </div>
            {ticket.FechaResolucion && (
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Fecha resolución</p>
                <p className="text-gray-800">{new Date(ticket.FechaResolucion).toLocaleString("es-MX")}</p>
              </div>
            )}
            {ticket.VentaRef && (
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Venta referencia</p>
                <p className="text-gray-800">#{ticket.VentaRef}</p>
              </div>
            )}
          </div>

          {/* Asignar agente */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h3 className="font-semibold text-gray-900 mb-3 text-sm">Agente asignado</h3>
            <p className="text-sm text-gray-700 mb-2">{ticket.AsignadoNombre || "Sin asignar"}</p>
            <select
              onChange={e => handleAsignar(e.target.value)}
              defaultValue=""
              className="w-full border rounded px-3 py-2 text-xs"
            >
              <option value="">— Cambiar agente —</option>
              <option value="">Sin asignar</option>
              {usuarios.map(u => (
                <option key={u.User_Id || u.id} value={u.User_Id || u.id}>
                  {u.Name || u.name} {u.Lastname || ""}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
