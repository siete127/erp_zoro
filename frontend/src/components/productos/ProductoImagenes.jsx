import React, { useEffect, useRef, useState } from 'react';
import api from '../../services/api';
import { notify } from '../../services/notify';

export default function ProductoImagenes({ productoId }) {
  const [imagenes, setImagenes] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null);
  const fileRef = useRef();

  const load = async () => {
    try {
      const res = await api.get(`/productos/${productoId}/imagenes`);
      setImagenes(res.data || []);
    } catch {
      setImagenes([]);
    }
  };

  useEffect(() => { if (productoId) load(); }, [productoId]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    form.append('es_principal', imagenes.length === 0 ? 'true' : 'false');
    setUploading(true);
    try {
      await api.post(`/productos/${productoId}/imagenes`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      notify.success('Imagen subida');
      load();
    } catch (err) {
      notify.error(err?.response?.data?.detail || 'Error al subir imagen');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleSetPrincipal = async (imgId) => {
    try {
      await api.patch(`/productos/${productoId}/imagenes/${imgId}/principal`);
      notify.success('Imagen principal actualizada');
      load();
    } catch {
      notify.error('Error al actualizar');
    }
  };

  const handleDelete = async (imgId) => {
    if (!window.confirm('¿Eliminar esta imagen?')) return;
    try {
      await api.delete(`/productos/${productoId}/imagenes/${imgId}`);
      notify.success('Imagen eliminada');
      load();
    } catch {
      notify.error('Error al eliminar');
    }
  };

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">Imágenes del producto</h3>
        <label className="cursor-pointer bg-indigo-600 text-white text-xs px-3 py-1.5 rounded hover:bg-indigo-700 transition">
          {uploading ? 'Subiendo...' : '+ Agregar imagen'}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
      </div>

      {imagenes.length === 0 ? (
        <p className="text-xs text-gray-400 italic">Sin imágenes. Sube la primera.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {imagenes.map((img) => (
            <div key={img.Imagen_Id} className="relative group border rounded-lg overflow-hidden bg-gray-50">
              <img
                src={img.Url}
                alt={img.NombreArchivo}
                className="w-full h-28 object-cover cursor-pointer"
                onClick={() => setPreview(img.Url)}
                onError={(e) => { e.target.src = '/placeholder-product.png'; }}
              />
              {img.EsPrincipal ? (
                <span className="absolute top-1 left-1 bg-indigo-600 text-white text-[10px] px-1.5 py-0.5 rounded font-semibold">
                  Principal
                </span>
              ) : null}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                {!img.EsPrincipal && (
                  <button
                    onClick={() => handleSetPrincipal(img.Imagen_Id)}
                    className="bg-white text-indigo-600 text-[10px] px-2 py-1 rounded font-semibold hover:bg-indigo-50"
                  >
                    Principal
                  </button>
                )}
                <button
                  onClick={() => handleDelete(img.Imagen_Id)}
                  className="bg-white text-red-600 text-[10px] px-2 py-1 rounded font-semibold hover:bg-red-50"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {preview && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center"
          onClick={() => setPreview(null)}
        >
          <img src={preview} alt="preview" className="max-h-[85vh] max-w-[90vw] rounded shadow-xl" />
        </div>
      )}
    </div>
  );
}
