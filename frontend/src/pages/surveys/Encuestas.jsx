import React, { useEffect, useState, useCallback } from "react";
import { FaClipboardList, FaPlus, FaTrash, FaEye, FaShareAlt, FaCopy } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { getApiBase } from "../../services/runtimeConfig";

const apiBase = () => getApiBase();
const tok = () => localStorage.getItem("token");
const hdr = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${tok()}` });

const ESTADO_BADGE = {
  activa:   'border-emerald-200 bg-emerald-50 text-emerald-700',
  cerrada:  'border-rose-200 bg-rose-50 text-rose-700',
  borrador: 'border-slate-200 bg-slate-50 text-slate-600',
};

const fieldCls = 'w-full rounded-[12px] border border-[#dce4f0] bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-[0_2px_8px_rgba(15,45,93,0.06)] outline-none focus:border-[#3b6fd4] focus:ring-2 focus:ring-[#3b6fd4]/20';
const labelCls = 'mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]';

export default function Encuestas() {
  const navigate = useNavigate();
  const [encuestas, setEncuestas] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ Titulo: "", Descripcion: "", EsPublica: false });
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(null);

  const fetchEncuestas = useCallback(async () => {
    const r = await fetch(`${apiBase()}/encuestas`, { headers: hdr() });
    const d = await r.json();
    setEncuestas(d.items || []);
  }, []);

  useEffect(() => { fetchEncuestas(); }, [fetchEncuestas]);

  const submit = async () => {
    setLoading(true);
    try {
      await fetch(`${apiBase()}/encuestas`, { method: "POST", headers: hdr(), body: JSON.stringify(form) });
      fetchEncuestas();
      setModal(false);
      setForm({ Titulo: "", Descripcion: "", EsPublica: false });
    } finally { setLoading(false); }
  };

  const deleteEncuesta = async (id) => {
    if (!window.confirm("¿Eliminar encuesta y todas sus respuestas?")) return;
    await fetch(`${apiBase()}/encuestas/${id}`, { method: "DELETE", headers: hdr() });
    fetchEncuestas();
  };

  const copyLink = (id) => {
    const url = `${window.location.origin}/encuesta-publica/${id}`;
    navigator.clipboard.writeText(url);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div
      className="min-h-screen w-full px-4 sm:px-6 py-6"
      style={{ background: 'radial-gradient(ellipse at 70% 0%, rgba(59,107,212,0.07) 0%, rgba(255,255,255,0) 60%), radial-gradient(ellipse at 0% 80%, rgba(99,102,241,0.05) 0%, rgba(255,255,255,0) 55%), #f4f6fb' }}
    >
      <div className="mx-auto max-w-7xl space-y-5">

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#3b6fd4]">Módulo</p>
            <h1 className="flex items-center gap-2 text-xl font-bold text-[#0d1f3c]">
              <FaClipboardList className="text-[#3b6fd4]" /> Encuestas
            </h1>
          </div>
          <button
            onClick={() => setModal(true)}
            className="rounded-[14px] bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(27,61,134,0.30)] hover:shadow-[0_6px_18px_rgba(27,61,134,0.38)] transition flex items-center gap-1.5"
          >
            <FaPlus className="text-xs" /> Nueva encuesta
          </button>
        </div>

        {/* Grid de encuestas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {encuestas.length === 0 && (
            <div className="col-span-3 rounded-[24px] border border-white/70 bg-white p-12 text-center shadow-[0_4px_20px_rgba(15,45,93,0.06)]">
              <FaClipboardList className="mx-auto mb-3 text-3xl text-slate-300" />
              <p className="text-sm font-medium text-slate-400">No hay encuestas. Crea la primera.</p>
            </div>
          )}
          {encuestas.map(e => (
            <div
              key={e.Encuesta_Id}
              className="flex flex-col rounded-[24px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(245,248,255,0.9)_100%)] p-5 shadow-[0_4px_20px_rgba(15,45,93,0.07)] hover:shadow-[0_8px_28px_rgba(15,45,93,0.12)] transition"
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 leading-snug">{e.Titulo}</h3>
                  {e.Descripcion && <p className="mt-1 text-xs text-slate-400 line-clamp-2">{e.Descripcion}</p>}
                </div>
                <span className={`shrink-0 inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold capitalize ${ESTADO_BADGE[e.Estado] || ESTADO_BADGE.borrador}`}>
                  {e.Estado}
                </span>
              </div>

              <div className="flex gap-4 text-xs text-slate-500 mb-4">
                <span><span className="font-bold text-slate-700">{e.TotalPreguntas}</span> preguntas</span>
                <span><span className="font-bold text-slate-700">{e.TotalRespuestas}</span> respuestas</span>
                {e.EsPublica
                  ? <span className="font-semibold text-emerald-600">Pública</span>
                  : <span className="text-slate-400">Privada</span>
                }
              </div>

              <div className="mt-auto flex gap-2 border-t border-[#eaf0fa] pt-3">
                <button
                  onClick={() => navigate(`/encuestas/${e.Encuesta_Id}`)}
                  className="flex-1 rounded-[10px] border border-[#1b3d86]/20 bg-[#f0f4ff] py-1.5 text-xs font-semibold text-[#1b3d86] hover:bg-[#e4ecff] flex items-center justify-center gap-1 transition"
                >
                  <FaEye className="text-[10px]" /> Ver / Editar
                </button>
                {e.EsPublica && (
                  <button
                    onClick={() => copyLink(e.Encuesta_Id)}
                    className={`rounded-[10px] border px-3 py-1.5 text-xs font-semibold flex items-center gap-1 transition ${
                      copied === e.Encuesta_Id
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-[#dce4f0] bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {copied === e.Encuesta_Id ? <><FaCopy className="text-[10px]" />¡Copiado!</> : <><FaShareAlt className="text-[10px]" />Link</>}
                  </button>
                )}
                <button
                  onClick={() => deleteEncuesta(e.Encuesta_Id)}
                  className="rounded-[10px] border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs text-rose-500 hover:bg-rose-100 transition"
                >
                  <FaTrash className="text-[10px]" />
                </button>
              </div>
            </div>
          ))}
        </div>

      </div>

      {/* Modal nueva encuesta */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md overflow-hidden rounded-[20px] shadow-[0_24px_64px_rgba(10,20,50,0.22)]">
            <div className="bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-6 py-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Nueva encuesta</h3>
              <button onClick={() => setModal(false)} className="text-white/70 hover:text-white text-xl leading-none">×</button>
            </div>
            <div className="bg-white p-6 space-y-4">
              <div>
                <label className={labelCls}>Título *</label>
                <input className={fieldCls} placeholder="Título de la encuesta" value={form.Titulo} onChange={e => setForm({ ...form, Titulo: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Descripción</label>
                <textarea className={`${fieldCls} resize-none`} placeholder="Descripción (opcional)" rows={3} value={form.Descripcion} onChange={e => setForm({ ...form, Descripcion: e.target.value })} />
              </div>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.EsPublica}
                  onChange={e => setForm({ ...form, EsPublica: e.target.checked })}
                  className="h-4 w-4 rounded accent-[#1b3d86]"
                />
                <span className="text-sm text-slate-700">Encuesta pública (accesible sin login)</span>
              </label>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={submit}
                  disabled={loading || !form.Titulo}
                  className="flex-1 rounded-[12px] bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_10px_rgba(27,61,134,0.25)] disabled:opacity-50 transition"
                >
                  {loading ? "Guardando..." : "Crear encuesta"}
                </button>
                <button
                  onClick={() => setModal(false)}
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
