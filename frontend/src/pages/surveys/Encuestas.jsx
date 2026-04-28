import React, { useEffect, useState, useCallback } from "react";
import { FaClipboardList, FaPlus, FaTrash, FaEye, FaShareAlt, FaCopy } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { getApiBase } from "../../services/runtimeConfig";

const api = () => getApiBase();
const tok = () => localStorage.getItem("token");
const hdr = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${tok()}` });

export default function Encuestas() {
  const navigate = useNavigate();
  const [encuestas, setEncuestas] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ Titulo: "", Descripcion: "", EsPublica: false });
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(null);

  const fetchEncuestas = useCallback(async () => {
    const r = await fetch(`${api()}/encuestas`, { headers: hdr() });
    const d = await r.json();
    setEncuestas(d.items || []);
  }, []);

  useEffect(() => { fetchEncuestas(); }, [fetchEncuestas]);

  const submit = async () => {
    setLoading(true);
    try {
      await fetch(`${api()}/encuestas`, { method: "POST", headers: hdr(), body: JSON.stringify(form) });
      fetchEncuestas();
      setModal(false);
      setForm({ Titulo: "", Descripcion: "", EsPublica: false });
    } finally { setLoading(false); }
  };

  const deleteEncuesta = async (id) => {
    if (!window.confirm("¿Eliminar encuesta y todas sus respuestas?")) return;
    await fetch(`${api()}/encuestas/${id}`, { method: "DELETE", headers: hdr() });
    fetchEncuestas();
  };

  const copyLink = (id) => {
    const url = `${window.location.origin}/encuesta-publica/${id}`;
    navigator.clipboard.writeText(url);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const estadoColor = { activa: "bg-green-100 text-green-700", cerrada: "bg-red-100 text-red-700", borrador: "bg-gray-100 text-gray-700" };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold flex items-center gap-2"><FaClipboardList /> Encuestas</h1>
        <button onClick={() => setModal(true)} className="px-3 py-1.5 bg-green-600 text-white rounded text-sm flex items-center gap-1"><FaPlus />Nueva Encuesta</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {encuestas.length === 0 && (
          <div className="col-span-3 text-center text-gray-400 py-12">No hay encuestas. Crea la primera.</div>
        )}
        {encuestas.map(e => (
          <div key={e.Encuesta_Id} className="bg-white rounded-xl shadow p-5 space-y-3 flex flex-col">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-bold text-gray-800">{e.Titulo}</h3>
                {e.Descripcion && <p className="text-sm text-gray-500 mt-1">{e.Descripcion}</p>}
              </div>
              <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold ${estadoColor[e.Estado] || "bg-gray-100 text-gray-700"}`}>{e.Estado}</span>
            </div>
            <div className="flex gap-4 text-xs text-gray-500">
              <span><b className="text-gray-700">{e.TotalPreguntas}</b> preguntas</span>
              <span><b className="text-gray-700">{e.TotalRespuestas}</b> respuestas</span>
              {e.EsPublica ? <span className="text-green-600 font-medium">Pública</span> : <span>Privada</span>}
            </div>
            <div className="flex gap-2 mt-auto pt-2 border-t border-gray-100">
              <button onClick={() => navigate(`/encuestas/${e.Encuesta_Id}`)} className="flex-1 py-1.5 bg-blue-50 text-blue-700 rounded text-xs font-medium flex items-center justify-center gap-1 hover:bg-blue-100"><FaEye />Ver / Editar</button>
              {e.EsPublica && (
                <button onClick={() => copyLink(e.Encuesta_Id)} className={`py-1.5 px-3 rounded text-xs font-medium flex items-center gap-1 ${copied === e.Encuesta_Id ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>
                  {copied === e.Encuesta_Id ? <><FaCopy />¡Copiado!</> : <><FaShareAlt />Link</>}
                </button>
              )}
              <button onClick={() => deleteEncuesta(e.Encuesta_Id)} className="py-1.5 px-3 bg-red-50 text-red-500 rounded text-xs hover:bg-red-100"><FaTrash /></button>
            </div>
          </div>
        ))}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md space-y-4">
            <h2 className="text-lg font-bold">Nueva Encuesta</h2>
            <input className="input" placeholder="Título *" value={form.Titulo} onChange={e => setForm({ ...form, Titulo: e.target.value })} />
            <textarea className="input" placeholder="Descripción (opcional)" rows={3} value={form.Descripcion} onChange={e => setForm({ ...form, Descripcion: e.target.value })} />
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.EsPublica} onChange={e => setForm({ ...form, EsPublica: e.target.checked })} className="w-4 h-4 accent-blue-600" />
              <span className="text-sm text-gray-700">Encuesta pública (accesible sin login)</span>
            </label>
            <div className="flex gap-3 justify-end pt-2">
              <button onClick={() => setModal(false)} className="px-4 py-2 bg-gray-100 rounded text-sm">Cancelar</button>
              <button onClick={submit} disabled={loading || !form.Titulo} className="px-4 py-2 bg-blue-600 text-white rounded text-sm disabled:opacity-50">{loading ? "Guardando..." : "Crear"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
