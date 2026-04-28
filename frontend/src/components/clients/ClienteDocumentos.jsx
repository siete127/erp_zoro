import React, { useEffect, useRef, useState } from 'react';
import api from '../../services/api';
import { notify } from '../../services/notify';

const TIPOS = ['CSF', 'INE', 'PODER_NOTARIAL', 'CONTRATO', 'COMPROBANTE_DOMICILIO', 'OTRO'];
const TIPO_LABELS = {
  CSF: 'Constancia de Situación Fiscal',
  INE: 'Identificación Oficial (INE)',
  PODER_NOTARIAL: 'Poder Notarial',
  CONTRATO: 'Contrato',
  COMPROBANTE_DOMICILIO: 'Comprobante de Domicilio',
  OTRO: 'Otro',
};
const ICONS = {
  'application/pdf': '📄',
  'image/jpeg': '🖼️',
  'image/png': '🖼️',
  default: '📎',
};

export default function ClienteDocumentos({ clienteId }) {
  const [docs, setDocs] = useState([]);
  const [tipo, setTipo] = useState('CSF');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

  const load = async () => {
    try {
      const res = await api.get(`/clients/${clienteId}/documentos`);
      setDocs(res.data || []);
    } catch {
      setDocs([]);
    }
  };

  useEffect(() => { if (clienteId) load(); }, [clienteId]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    form.append('tipo', tipo);
    setUploading(true);
    try {
      await api.post(`/clients/${clienteId}/documentos`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      notify.success('Documento cargado');
      load();
    } catch (err) {
      notify.error(err?.response?.data?.detail || 'Error al subir documento');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleDelete = async (docId) => {
    if (!window.confirm('¿Eliminar este documento?')) return;
    try {
      await api.delete(`/clients/${clienteId}/documentos/${docId}`);
      notify.success('Documento eliminado');
      load();
    } catch {
      notify.error('Error al eliminar');
    }
  };

  const formatSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Tipo de documento</label>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1.5 text-sm"
          >
            {TIPOS.map((t) => (
              <option key={t} value={t}>{TIPO_LABELS[t]}</option>
            ))}
          </select>
        </div>
        <label className="cursor-pointer bg-indigo-600 text-white text-xs px-3 py-2 rounded hover:bg-indigo-700 transition">
          {uploading ? 'Subiendo...' : '+ Cargar documento'}
          <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
      </div>

      {docs.length === 0 ? (
        <p className="text-xs text-gray-400 italic">Sin documentos cargados.</p>
      ) : (
        <div className="space-y-2">
          {docs.map((doc) => (
            <div key={doc.Doc_Id} className="flex items-center justify-between bg-gray-50 border rounded-lg px-3 py-2">
              <div className="flex items-center gap-3">
                <span className="text-xl">{ICONS[doc.MimeType] || ICONS.default}</span>
                <div>
                  <p className="text-sm font-medium text-gray-800">{TIPO_LABELS[doc.TipoDocumento] || doc.TipoDocumento}</p>
                  <p className="text-xs text-gray-500">
                    {doc.NombreArchivo} {doc.SizeBytes ? `· ${formatSize(doc.SizeBytes)}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={doc.ArchivoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-indigo-600 hover:underline"
                >
                  Ver
                </a>
                <button
                  onClick={() => handleDelete(doc.Doc_Id)}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
