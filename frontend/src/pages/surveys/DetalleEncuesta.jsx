import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FaArrowLeft, FaPlus, FaTrash, FaChartBar } from "react-icons/fa";
import { getApiBase } from "../../services/runtimeConfig";

const api = () => getApiBase();
const tok = () => localStorage.getItem("token");
const hdr = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${tok()}` });

const TIPOS = ["texto", "opcion_multiple", "escala", "si_no"];

export default function DetalleEncuesta() {
  const { encuestaId } = useParams();
  const navigate = useNavigate();
  const [encuesta, setEncuesta] = useState(null);
  const [resultados, setResultados] = useState(null);
  const [tab, setTab] = useState("preguntas");
  const [form, setForm] = useState({ Texto: "", Tipo: "texto", Opciones: "", Requerida: true, Orden: 1 });
  const [loading, setLoading] = useState(false);

  const fetchEncuesta = useCallback(async () => {
    const r = await fetch(`${api()}/encuestas/${encuestaId}`, { headers: hdr() });
    const d = await r.json();
    setEncuesta(d);
  }, [encuestaId]);

  const fetchResultados = useCallback(async () => {
    const r = await fetch(`${api()}/encuestas/${encuestaId}/resultados`, { headers: hdr() });
    const d = await r.json();
    setResultados(d);
  }, [encuestaId]);

  useEffect(() => { fetchEncuesta(); }, [fetchEncuesta]);

  const addPregunta = async () => {
    setLoading(true);
    try {
      await fetch(`${api()}/encuestas/preguntas`, {
        method: "POST", headers: hdr(),
        body: JSON.stringify({ ...form, Encuesta_Id: Number(encuestaId), Orden: Number(form.Orden), Requerida: form.Requerida }),
      });
      setForm({ Texto: "", Tipo: "texto", Opciones: "", Requerida: true, Orden: (encuesta?.preguntas?.length || 0) + 2 });
      fetchEncuesta();
    } finally { setLoading(false); }
  };

  const deletePregunta = async (id) => {
    await fetch(`${api()}/encuestas/preguntas/${id}`, { method: "DELETE", headers: hdr() });
    fetchEncuesta();
  };

  if (!encuesta) return <div className="p-8 text-center text-gray-400">Cargando...</div>;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/encuestas")} className="text-blue-600 hover:underline text-sm flex items-center gap-1"><FaArrowLeft />Volver</button>
        <h1 className="text-xl font-bold text-gray-800">{encuesta.Titulo}</h1>
        {encuesta.EsPublica && <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-semibold">Pública</span>}
      </div>

      <div className="flex gap-2">
        <button onClick={() => setTab("preguntas")} className={`px-3 py-1.5 rounded text-sm font-medium ${tab === "preguntas" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700"}`}>Preguntas ({encuesta.preguntas?.length || 0})</button>
        <button onClick={() => { setTab("resultados"); fetchResultados(); }} className={`px-3 py-1.5 rounded text-sm font-medium ${tab === "resultados" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700"}`}><FaChartBar className="inline mr-1" />Resultados</button>
      </div>

      {tab === "preguntas" && (
        <div className="space-y-4">
          {/* Lista de preguntas */}
          <div className="bg-white rounded-lg shadow divide-y">
            {(encuesta.preguntas || []).length === 0 && (
              <div className="px-4 py-6 text-center text-gray-400 text-sm">Sin preguntas. Agrega la primera abajo.</div>
            )}
            {(encuesta.preguntas || []).map((p, i) => (
              <div key={p.Pregunta_Id} className="px-4 py-3 flex items-start gap-3">
                <span className="shrink-0 w-6 h-6 bg-blue-100 text-blue-700 rounded-full text-xs font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                <div className="flex-1">
                  <div className="font-medium text-gray-800">{p.Texto}</div>
                  <div className="flex gap-2 mt-1">
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{p.Tipo}</span>
                    {p.Requerida ? <span className="text-xs text-red-500">requerida</span> : <span className="text-xs text-gray-400">opcional</span>}
                    {p.Opciones && <span className="text-xs text-gray-400 truncate max-w-48">opciones: {p.Opciones}</span>}
                  </div>
                </div>
                <button onClick={() => deletePregunta(p.Pregunta_Id)} className="text-red-300 hover:text-red-500 mt-0.5"><FaTrash className="text-xs" /></button>
              </div>
            ))}
          </div>

          {/* Formulario agregar pregunta */}
          <div className="bg-white rounded-lg shadow p-4 space-y-3">
            <h3 className="font-semibold text-gray-700 flex items-center gap-1"><FaPlus className="text-green-500" />Agregar pregunta</h3>
            <input className="input" placeholder="Texto de la pregunta *" value={form.Texto} onChange={e => setForm({ ...form, Texto: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <select className="input" value={form.Tipo} onChange={e => setForm({ ...form, Tipo: e.target.value })}>
                {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <input className="input" placeholder="Orden" type="number" value={form.Orden} onChange={e => setForm({ ...form, Orden: e.target.value })} />
            </div>
            {form.Tipo === "opcion_multiple" && (
              <input className="input" placeholder='Opciones (JSON o separadas por coma, ej: "Bueno,Regular,Malo")' value={form.Opciones} onChange={e => setForm({ ...form, Opciones: e.target.value })} />
            )}
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input type="checkbox" checked={form.Requerida} onChange={e => setForm({ ...form, Requerida: e.target.checked })} className="w-4 h-4 accent-blue-600" />
              Pregunta requerida
            </label>
            <button onClick={addPregunta} disabled={loading || !form.Texto} className="px-4 py-2 bg-blue-600 text-white rounded text-sm disabled:opacity-50">{loading ? "Guardando..." : "Agregar"}</button>
          </div>
        </div>
      )}

      {tab === "resultados" && resultados && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-2xl font-bold text-blue-700">{resultados.total_respuestas}</div>
            <div className="text-sm text-gray-500">respuestas totales</div>
          </div>
          {resultados.items?.length === 0 && (
            <div className="text-center text-gray-400 py-8">Sin respuestas todavía.</div>
          )}
          {resultados.items?.length > 0 && (
            <div className="bg-white rounded-lg shadow overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                  <tr><th className="px-4 py-3 text-left">Respondente</th><th className="px-4 py-3 text-left">Pregunta</th><th className="px-4 py-3 text-left">Respuesta</th><th className="px-4 py-3 text-center">Fecha</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {resultados.items.map((r, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-3"><div className="font-medium">{r.NombreRespondente}</div><div className="text-xs text-gray-400">{r.EmailRespondente}</div></td>
                      <td className="px-4 py-3 text-gray-600">{r.PreguntaTexto}</td>
                      <td className="px-4 py-3 font-medium">{r.Valor}</td>
                      <td className="px-4 py-3 text-center text-gray-400 text-xs">{r.FechaRespuesta?.slice(0, 10)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
