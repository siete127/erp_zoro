import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getApiBase } from "../../services/runtimeConfig";

const api = () => getApiBase();

export default function EncuestaPublica() {
  const { encuestaId } = useParams();
  const [encuesta, setEncuesta] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [respuestas, setRespuestas] = useState({});
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${api()}/encuestas/publica/${encuestaId}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setNotFound(true);
        else setEncuesta(d);
      })
      .catch(() => setNotFound(true));
  }, [encuestaId]);

  const handleRespuesta = (pregId, valor) => {
    setRespuestas(prev => ({ ...prev, [pregId]: valor }));
  };

  const submit = async () => {
    setError("");
    const requeridas = encuesta.preguntas.filter(p => p.Requerida);
    for (const p of requeridas) {
      if (!respuestas[p.Pregunta_Id]) {
        setError(`La pregunta "${p.Texto}" es requerida.`);
        return;
      }
    }
    setLoading(true);
    try {
      const payload = {
        Encuesta_Id: encuesta.Encuesta_Id,
        NombreRespondente: nombre || "Anónimo",
        EmailRespondente: email || "",
        Respuestas: Object.entries(respuestas).map(([pid, val]) => ({ Pregunta_Id: Number(pid), Valor: val })),
      };
      const r = await fetch(`${api()}/encuestas/responder`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const d = await r.json();
      if (d.error) setError(d.error);
      else setEnviado(true);
    } finally { setLoading(false); }
  };

  if (notFound) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="text-5xl mb-4">🔍</div>
        <h2 className="text-xl font-bold text-gray-700">Encuesta no disponible</h2>
        <p className="text-gray-500 mt-2">Esta encuesta no existe o ya no está activa.</p>
      </div>
    </div>
  );

  if (!encuesta) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-gray-400">Cargando encuesta...</div>
    </div>
  );

  if (enviado) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center max-w-md mx-auto p-8 bg-white rounded-2xl shadow-lg">
        <div className="text-5xl mb-4">✅</div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">¡Gracias!</h2>
        <p className="text-gray-500">Tu respuesta ha sido registrada exitosamente.</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <h1 className="text-2xl font-bold text-gray-800">{encuesta.Titulo}</h1>
          {encuesta.Descripcion && <p className="text-gray-500 mt-2">{encuesta.Descripcion}</p>}
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8 space-y-4">
          <h3 className="font-semibold text-gray-700">Tus datos (opcional)</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Tu nombre" value={nombre} onChange={e => setNombre(e.target.value)} />
            <input className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" type="email" placeholder="Tu email" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
        </div>

        {encuesta.preguntas?.map((p, i) => (
          <div key={p.Pregunta_Id} className="bg-white rounded-2xl shadow-lg p-8 space-y-3">
            <div className="flex gap-2 items-start">
              <span className="shrink-0 w-7 h-7 bg-blue-100 text-blue-700 rounded-full text-sm font-bold flex items-center justify-center">{i + 1}</span>
              <div>
                <p className="font-medium text-gray-800">{p.Texto}{p.Requerida && <span className="text-red-500 ml-1">*</span>}</p>
              </div>
            </div>

            {p.Tipo === "texto" && (
              <textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" rows={3} placeholder="Tu respuesta..." value={respuestas[p.Pregunta_Id] || ""} onChange={e => handleRespuesta(p.Pregunta_Id, e.target.value)} />
            )}
            {p.Tipo === "si_no" && (
              <div className="flex gap-3">
                {["Sí", "No"].map(op => (
                  <button key={op} onClick={() => handleRespuesta(p.Pregunta_Id, op)} className={`px-6 py-2 rounded-lg border text-sm font-medium ${respuestas[p.Pregunta_Id] === op ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"}`}>{op}</button>
                ))}
              </div>
            )}
            {p.Tipo === "escala" && (
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                  <button key={n} onClick={() => handleRespuesta(p.Pregunta_Id, String(n))} className={`w-9 h-9 rounded-full text-sm font-bold border ${respuestas[p.Pregunta_Id] === String(n) ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"}`}>{n}</button>
                ))}
              </div>
            )}
            {p.Tipo === "opcion_multiple" && (() => {
              let opciones = [];
              try { opciones = p.Opciones ? (p.Opciones.startsWith("[") ? JSON.parse(p.Opciones) : p.Opciones.split(",").map(o => o.trim())) : []; } catch { opciones = p.Opciones?.split(",").map(o => o.trim()) || []; }
              return (
                <div className="space-y-2">
                  {opciones.map(op => (
                    <label key={op} className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name={`p_${p.Pregunta_Id}`} value={op} checked={respuestas[p.Pregunta_Id] === op} onChange={() => handleRespuesta(p.Pregunta_Id, op)} className="accent-blue-600" />
                      <span className="text-sm text-gray-700">{op}</span>
                    </label>
                  ))}
                </div>
              );
            })()}
          </div>
        ))}

        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

        <button onClick={submit} disabled={loading} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm disabled:opacity-50">
          {loading ? "Enviando..." : "Enviar respuestas"}
        </button>
      </div>
    </div>
  );
}
