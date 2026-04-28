import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import api from "../../services/api";

export default function CatalogoPublico() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const [modalContacto, setModalContacto] = useState(false);
  const [form, setForm] = useState({ Nombre: "", Email: "", Telefono: "", Empresa: "", Mensaje: "" });
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  useEffect(() => {
    const cargar = async () => {
      try {
        const res = await api.get(`/website/public/${slug}`);
        if (res.data.error) {
          setError("Este catálogo no está disponible.");
        } else {
          setData(res.data);
        }
      } catch {
        setError("No se pudo cargar el catálogo.");
      } finally {
        setLoading(false);
      }
    };
    cargar();
  }, [slug]);

  const handleContacto = async (e) => {
    e.preventDefault();
    setEnviando(true);
    try {
      await api.post(`/website/public/${slug}/contacto`, { ...form, Origen: "catalogo" });
      setEnviado(true);
      setModalContacto(false);
      setForm({ Nombre: "", Email: "", Telefono: "", Empresa: "", Mensaje: "" });
    } catch {
      alert("Error al enviar el mensaje. Inténtalo de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Cargando catálogo...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-2xl mb-2">😕</p>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  const color = data.empresa.colorPrimario || "#092052";
  const productosFiltrados = (data.productos || []).filter(p =>
    p.Nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
    p.Codigo?.toLowerCase().includes(busqueda.toLowerCase()) ||
    p.Descripcion?.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="py-8 px-6 text-white shadow-lg" style={{ backgroundColor: color }}>
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            {data.empresa.logo && (
              <img src={data.empresa.logo} alt="Logo" className="h-12 w-12 object-contain rounded-lg bg-white p-1" />
            )}
            <div>
              <h1 className="text-2xl font-bold">{data.empresa.titulo}</h1>
              {data.empresa.descripcion && (
                <p className="text-sm opacity-80 mt-0.5">{data.empresa.descripcion}</p>
              )}
            </div>
          </div>
          <button
            onClick={() => setModalContacto(true)}
            className="px-4 py-2 bg-white text-sm font-semibold rounded-lg hover:bg-gray-100 transition-colors"
            style={{ color }}
          >
            Contactar
          </button>
        </div>
      </header>

      {/* Contenido */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {enviado && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-xl p-4 text-green-800 text-sm">
            ✅ ¡Mensaje enviado! Nos pondremos en contacto contigo pronto.
          </div>
        )}

        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Catálogo de productos</h2>
            <p className="text-sm text-gray-500">{data.total} producto{data.total !== 1 ? "s" : ""}</p>
          </div>
          <input
            type="text"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar producto..."
            className="w-64 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
          />
        </div>

        {productosFiltrados.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-2">📦</p>
            <p>No se encontraron productos</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {productosFiltrados.map((p) => (
              <div key={p.Producto_Id} className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                {p.ImagenPrincipal ? (
                  <img src={p.ImagenPrincipal} alt={p.Nombre} className="w-full h-40 object-cover" />
                ) : (
                  <div className="w-full h-40 bg-gray-100 flex items-center justify-center">
                    <span className="text-3xl text-gray-300">📦</span>
                  </div>
                )}
                <div className="p-4">
                  <p className="font-semibold text-gray-900 text-sm leading-tight">{p.Nombre}</p>
                  {p.Codigo && <p className="text-xs text-gray-400 mt-0.5">SKU: {p.Codigo}</p>}
                  {p.Descripcion && (
                    <p className="text-xs text-gray-600 mt-2 line-clamp-2">{p.Descripcion}</p>
                  )}
                  {p.PrecioVenta != null && (
                    <p className="text-base font-bold mt-3" style={{ color }}>
                      ${Number(p.PrecioVenta).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                    </p>
                  )}
                  <button
                    onClick={() => setModalContacto(true)}
                    className="mt-3 w-full py-1.5 text-xs font-semibold text-white rounded-lg transition-opacity hover:opacity-90"
                    style={{ backgroundColor: color }}
                  >
                    Solicitar información
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="py-6 px-6 text-center text-xs text-gray-400 border-t mt-12">
        {data.empresa.email && <p>{data.empresa.email}</p>}
        <p className="mt-1">Powered by ERP Zoro</p>
      </footer>

      {/* Modal contacto */}
      {modalContacto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold mb-1">Contáctanos</h3>
            <p className="text-sm text-gray-500 mb-4">Déjanos tus datos y te contactamos pronto.</p>
            <form onSubmit={handleContacto} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Nombre *</label>
                  <input required value={form.Nombre} onChange={e => setForm({...form, Nombre: e.target.value})}
                    className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Email *</label>
                  <input required type="email" value={form.Email} onChange={e => setForm({...form, Email: e.target.value})}
                    className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Teléfono</label>
                  <input value={form.Telefono} onChange={e => setForm({...form, Telefono: e.target.value})}
                    className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Empresa</label>
                  <input value={form.Empresa} onChange={e => setForm({...form, Empresa: e.target.value})}
                    className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Mensaje</label>
                <textarea value={form.Mensaje} onChange={e => setForm({...form, Mensaje: e.target.value})}
                  rows={3} className="w-full border rounded-lg px-3 py-2 text-sm"
                  placeholder="¿Qué producto te interesa? ¿Tienes alguna pregunta?" />
              </div>
              <div className="flex justify-end gap-3 pt-1">
                <button type="button" onClick={() => setModalContacto(false)} className="px-4 py-2 border rounded-lg text-sm">
                  Cancelar
                </button>
                <button type="submit" disabled={enviando}
                  className="px-4 py-2 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                  style={{ backgroundColor: color }}>
                  {enviando ? "Enviando..." : "Enviar mensaje"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
