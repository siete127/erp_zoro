import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { notify } from '../../services/notify';
import confirm from '../../services/confirm';
import {
  FaArrowLeft, FaFilePdf, FaCheckCircle, FaTimesCircle,
  FaPaperPlane, FaShoppingCart, FaUpload, FaFileInvoice,
  FaTruck, FaBoxOpen, FaHistory
} from 'react-icons/fa';

const ESTATUS_COLORS = {
  BORRADOR:                'bg-gray-100 text-gray-700',
  PENDIENTE_AUTORIZACION:  'bg-yellow-100 text-yellow-800',
  AUTORIZADA:              'bg-blue-100 text-blue-800',
  RECHAZADA:               'bg-red-100 text-red-700',
  COMPRADA:                'bg-green-100 text-green-800',
  CANCELADA:               'bg-gray-200 text-gray-500',
};
const ESTATUS_LABELS = {
  BORRADOR: 'Borrador', PENDIENTE_AUTORIZACION: 'Pendiente Autorización',
  AUTORIZADA: 'Autorizada', RECHAZADA: 'Rechazada', COMPRADA: 'Comprada', CANCELADA: 'Cancelada',
};

const fmt = (n) => `$${Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('es-MX') : '—';

export default function DetalleOrdenCompra() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [orden, setOrden] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authModal, setAuthModal] = useState(false);
  const [authForm, setAuthForm] = useState({ Nivel: 1, Aprobado: true, Comentarios: '' });
  const [facturaRef, setFacturaRef] = useState('');
  const [facturaFile, setFacturaFile] = useState(null);
  const [uploadingFactura, setUploadingFactura] = useState(false);
  const [saving, setSaving] = useState(false);

  // Recepción de mercancía
  const [almacenes, setAlmacenes] = useState([]);
  const [recepcionAlmacen, setRecepcionAlmacen] = useState('');
  const [recepcionObs, setRecepcionObs] = useState('');
  const [recepcionItems, setRecepcionItems] = useState([]); // { OC_Detalle_Id, Descripcion, CantidadOrdenada, CantidadRecibida }
  const [guardandoRecepcion, setGuardandoRecepcion] = useState(false);
  const [recepciones, setRecepciones] = useState([]);
  const [showHistorial, setShowHistorial] = useState(false);

  const fetchOrden = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/compras/ordenes/${id}`);
      const data = res.data.data;
      setOrden(data);
      // Pre-llenar cantidades de recepción con las cantidades de la OC
      setRecepcionItems(
        (data.detalle || []).map(d => ({
          OC_Detalle_Id: d.OC_Detalle_Id,
          Descripcion: d.Descripcion,
          CantidadOrdenada: Number(d.Cantidad),
          CantidadRecibida: Number(d.Cantidad), // default = cantidad total pedida
          tipo: d.MateriaPrima_Id ? 'mp' : 'producto',
        }))
      );
    } catch (err) {
      notify(err.response?.data?.message || 'Error cargando orden', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchAlmacenes = async () => {
    try {
      const res = await api.get('/almacenes');
      setAlmacenes(Array.isArray(res.data) ? res.data : []);
    } catch { /* silencioso */ }
  };

  const fetchRecepciones = async () => {
    try {
      const res = await api.get(`/compras/ordenes/${id}/recepciones`);
      setRecepciones(res.data.data || []);
    } catch { /* silencioso */ }
  };

  useEffect(() => {
    fetchOrden();
    fetchAlmacenes();
    fetchRecepciones();
  }, [id]);

  const handleDescargarPDF = async () => {
    try {
      const res = await api.get(`/compras/ordenes/${id}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `OC-${orden.NumeroOC}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      notify('Error generando PDF', 'error');
    }
  };

  const handleEnviarAuth = async () => {
    const ok = await confirm('¿Enviar a autorización?', 'Confirmar');
    if (!ok) return;
    try {
      await api.post(`/compras/ordenes/${id}/enviar-autorizacion`);
      notify('Enviada a autorización', 'success');
      fetchOrden();
    } catch (err) { notify(err.response?.data?.message || 'Error', 'error'); }
  };

  const handleAutorizar = async () => {
    setSaving(true);
    try {
      const res = await api.post(`/compras/ordenes/${id}/autorizar`, authForm);
      notify(res.data.message, 'success');
      setAuthModal(false);
      fetchOrden();
    } catch (err) { notify(err.response?.data?.message || 'Error', 'error'); }
    finally { setSaving(false); }
  };

  const handleComprar = async () => {
    const ok = await confirm('¿Confirmar la compra? Esta acción marcará la OC como COMPRADA.', 'Confirmar compra');
    if (!ok) return;
    try {
      await api.post(`/compras/ordenes/${id}/comprar`, { FacturaReferencia: facturaRef });
      notify('Compra registrada', 'success');
      fetchOrden();
    } catch (err) { notify(err.response?.data?.message || 'Error', 'error'); }
  };

  const handleCancelar = async () => {
    const ok = await confirm('¿Cancelar esta orden de compra?', 'Cancelar OC');
    if (!ok) return;
    try {
      await api.post(`/compras/ordenes/${id}/cancelar`);
      notify('Orden cancelada', 'success');
      fetchOrden();
    } catch (err) { notify(err.response?.data?.message || 'Error', 'error'); }
  };

  const handleUploadFactura = async () => {
    if (!facturaFile) {
      notify('Selecciona un archivo de factura', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('factura', facturaFile);

    setUploadingFactura(true);
    try {
      await api.post(`/compras/ordenes/${id}/factura`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      notify('Factura cargada correctamente', 'success');
      setFacturaFile(null);
      fetchOrden();
    } catch (err) {
      notify(err.response?.data?.message || 'Error cargando factura', 'error');
    } finally {
      setUploadingFactura(false);
    }
  };

  const handleRecibirMercancia = async () => {
    if (!recepcionAlmacen) {
      notify('Selecciona el almacén destino', 'error');
      return;
    }
    const itemsValidos = recepcionItems.filter(i => Number(i.CantidadRecibida) > 0);
    if (!itemsValidos.length) {
      notify('Ingresa al menos una cantidad recibida mayor a 0', 'error');
      return;
    }
    const ok = await confirm(
      `¿Confirmar recepción de mercancía? Se actualizará el inventario con las cantidades indicadas.`,
      'Confirmar recepción'
    );
    if (!ok) return;

    setGuardandoRecepcion(true);
    try {
      await api.post(`/compras/ordenes/${id}/recibir`, {
        Almacen_Id: Number(recepcionAlmacen),
        Observaciones: recepcionObs || null,
        items: itemsValidos.map(i => ({
          OC_Detalle_Id: i.OC_Detalle_Id,
          CantidadRecibida: Number(i.CantidadRecibida),
        })),
      });
      notify('Mercancía recibida y stock actualizado', 'success');
      setRecepcionObs('');
      fetchOrden();
      fetchRecepciones();
    } catch (err) {
      notify(err.response?.data?.message || 'Error al registrar recepción', 'error');
    } finally {
      setGuardandoRecepcion(false);
    }
  };

  if (loading) return <p className="text-center text-gray-500 py-16">Cargando...</p>;
  if (!orden) return <p className="text-center text-red-500 py-16">Orden no encontrada</p>;

  const auth1 = orden.autorizaciones?.find(a => a.Nivel === 1);
  const auth2 = orden.autorizaciones?.find(a => a.Nivel === 2);
  const puedeDescargarPDF = ['AUTORIZADA', 'COMPRADA'].includes(orden.Estatus);

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/compras')} className="text-gray-500 hover:text-gray-700">
            <FaArrowLeft />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-800">{orden.NumeroOC}</h1>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTATUS_COLORS[orden.Estatus] || ''}`}>
              {ESTATUS_LABELS[orden.Estatus] || orden.Estatus}
            </span>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={handleDescargarPDF}
            disabled={!puedeDescargarPDF}
            title={!puedeDescargarPDF ? 'Disponible solo cuando la OC está autorizada o comprada' : 'Descargar PDF'}
            className={`flex items-center gap-1.5 px-4 py-2 text-white text-sm rounded-lg ${
              puedeDescargarPDF ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-300 cursor-not-allowed'
            }`}
          >
            <FaFilePdf /> PDF
          </button>
          {orden.Estatus === 'BORRADOR' && (
            <button onClick={handleEnviarAuth}
              className="flex items-center gap-1.5 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white text-sm rounded-lg">
              <FaPaperPlane /> Enviar a autorización
            </button>
          )}
          {orden.Estatus === 'PENDIENTE_AUTORIZACION' && (
            <button onClick={() => setAuthModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg">
              <FaCheckCircle /> Autorizar / Rechazar
            </button>
          )}
          {orden.Estatus === 'AUTORIZADA' && (
            <button onClick={handleComprar}
              className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg">
              <FaShoppingCart /> Registrar Compra
            </button>
          )}
          {!['COMPRADA', 'CANCELADA'].includes(orden.Estatus) && (
            <button onClick={handleCancelar}
              className="flex items-center gap-1.5 px-4 py-2 border border-red-300 text-red-600 hover:bg-red-50 text-sm rounded-lg">
              <FaTimesCircle /> Cancelar
            </button>
          )}
        </div>
      </div>

      {/* Datos generales */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
        <div><p className="text-xs text-gray-400">Empresa</p><p className="font-medium">{orden.Empresa}</p></div>
        <div><p className="text-xs text-gray-400">Proveedor</p><p className="font-medium">{orden.Proveedor}</p></div>
        <div><p className="text-xs text-gray-400">RFC Proveedor</p><p className="font-medium">{orden.ProveedorRFC || '—'}</p></div>
        <div><p className="text-xs text-gray-400">Fecha OC</p><p className="font-medium">{fmtDate(orden.FechaOC)}</p></div>
        <div><p className="text-xs text-gray-400">Fecha Requerida</p><p className="font-medium">{fmtDate(orden.FechaRequerida)}</p></div>
        <div><p className="text-xs text-gray-400">Moneda</p><p className="font-medium">{orden.Moneda}</p></div>
        <div><p className="text-xs text-gray-400">Factura Ref.</p><p className="font-medium">{orden.FacturaReferencia || '—'}</p></div>
        <div>
          <p className="text-xs text-gray-400">Archivo Factura</p>
          {orden.FacturaArchivoUrl ? (
            <a href={orden.FacturaArchivoUrl} target="_blank" rel="noreferrer" className="font-medium text-blue-600 hover:underline inline-flex items-center gap-1">
              <FaFileInvoice /> Ver factura
            </a>
          ) : (
            <p className="font-medium">—</p>
          )}
        </div>
        <div><p className="text-xs text-gray-400">Doble autorización</p><p className="font-medium">{orden.RequiereDobleAutorizacion ? 'Sí' : 'No'}</p></div>
        <div><p className="text-xs text-gray-400">Creado por</p><p className="font-medium">{orden.CreatedBy}</p></div>
        {orden.Observaciones && (
          <div className="col-span-2 md:col-span-3">
            <p className="text-xs text-gray-400">Observaciones</p>
            <p className="font-medium">{orden.Observaciones}</p>
          </div>
        )}
      </div>

      {/* Detalle */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h2 className="font-semibold text-gray-700 mb-3">Detalle de Productos</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-xs text-gray-400 border-b">
              <tr>
                <th className="pb-2 text-left">Descripción</th>
                <th className="pb-2 text-right">Cantidad</th>
                <th className="pb-2 text-right">P. Compra</th>
                <th className="pb-2 text-right">Subtotal</th>
                <th className="pb-2 text-right">IVA</th>
                <th className="pb-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(orden.detalle || []).map((d, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="py-2">
                    <p className="font-medium">{d.Descripcion}</p>
                    {d.ProductoSKU && <p className="text-xs text-gray-400">SKU: {d.ProductoSKU}</p>}
                  </td>
                  <td className="py-2 text-right">{Number(d.Cantidad).toFixed(2)}</td>
                  <td className="py-2 text-right">{fmt(d.PrecioCompra)}</td>
                  <td className="py-2 text-right">{fmt(d.Subtotal)}</td>
                  <td className="py-2 text-right">{fmt(d.IVA)}</td>
                  <td className="py-2 text-right font-semibold">{fmt(d.Total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t font-semibold text-sm">
              <tr>
                <td colSpan={3} className="py-2"></td>
                <td className="py-2 text-right text-gray-500">Subtotal: {fmt(orden.Subtotal)}</td>
                <td className="py-2 text-right text-gray-500">{fmt(orden.IVA)}</td>
                <td className="py-2 text-right text-blue-800 text-base">{fmt(orden.Total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Autorizaciones */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h2 className="font-semibold text-gray-700 mb-3">Autorizaciones</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[{ nivel: 1, auth: auth1 }, { nivel: 2, auth: auth2 }].map(({ nivel, auth }) => (
            <div key={nivel} className={`rounded-lg p-4 border ${auth ? (auth.Aprobado ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50') : 'border-gray-100 bg-gray-50'}`}>
              <p className="text-xs font-semibold text-gray-500 mb-1">Nivel {nivel}</p>
              {auth ? (
                <div>
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    {auth.Aprobado
                      ? <><FaCheckCircle className="text-green-600" /> Aprobado</>
                      : <><FaTimesCircle className="text-red-600" /> Rechazado</>}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">Por: {auth.AutorizadoPor || '—'}</p>
                  <p className="text-xs text-gray-500">{fmtDate(auth.FechaDecision)}</p>
                  {auth.Comentarios && <p className="text-xs text-gray-600 mt-1 italic">"{auth.Comentarios}"</p>}
                </div>
              ) : (
                <p className="text-sm text-gray-400">Pendiente</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Input factura al registrar compra */}
      {['AUTORIZADA', 'COMPRADA'].includes(orden.Estatus) && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-700 mb-3">Datos de Compra</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Número de Factura del Proveedor</label>
              <input type="text" value={facturaRef} onChange={e => setFacturaRef(e.target.value)}
                placeholder="Ej: FAC-00123"
                className="border rounded-lg px-3 py-2 text-sm w-full" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Cargar Factura</label>
              <div className="flex gap-2 items-center">
                <input type="file" accept=".pdf,.xml,.png,.jpg,.jpeg"
                  onChange={e => setFacturaFile(e.target.files?.[0] || null)}
                  className="border rounded-lg px-3 py-2 text-sm w-full" />
                <button type="button" onClick={handleUploadFactura}
                  disabled={uploadingFactura || !facturaFile}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white text-sm rounded-lg disabled:opacity-50">
                  <FaUpload /> {uploadingFactura ? 'Subiendo...' : 'Subir'}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">Formatos permitidos: PDF, XML, PNG y JPG.</p>
            </div>
          </div>
        </div>
      )}

      {/* ── RECEPCIÓN DE MERCANCÍA ── */}
      {['AUTORIZADA', 'COMPRADA'].includes(orden.Estatus) && (
        <div className="bg-white rounded-xl shadow-sm border border-blue-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <FaTruck className="text-blue-600" />
            <h2 className="font-semibold text-gray-700">Recepción de Mercancía</h2>
            <span className="text-xs text-gray-400 ml-auto">Registra las cantidades exactas recibidas del proveedor</span>
          </div>

          {/* Cabecera de recepción */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Almacén destino <span className="text-red-500">*</span></label>
              <select value={recepcionAlmacen} onChange={e => setRecepcionAlmacen(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm w-full">
                <option value="">— Selecciona almacén —</option>
                {almacenes.map(a => (
                  <option key={a.Almacen_Id} value={a.Almacen_Id}>{a.Nombre} ({a.Codigo})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Observaciones</label>
              <input type="text" value={recepcionObs} onChange={e => setRecepcionObs(e.target.value)}
                placeholder="Notas de la recepción (opcional)"
                className="border rounded-lg px-3 py-2 text-sm w-full" />
            </div>
          </div>

          {/* Líneas con cantidades editables */}
          <div className="overflow-x-auto mb-4">
            <table className="min-w-full text-sm">
              <thead className="text-xs text-gray-400 border-b bg-gray-50">
                <tr>
                  <th className="pb-2 pt-2 px-2 text-left">Artículo</th>
                  <th className="pb-2 pt-2 px-2 text-center">Tipo</th>
                  <th className="pb-2 pt-2 px-2 text-right">Cant. Ordenada</th>
                  <th className="pb-2 pt-2 px-2 text-right w-36">Cant. Recibida</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recepcionItems.map((item, idx) => (
                  <tr key={item.OC_Detalle_Id} className="hover:bg-blue-50">
                    <td className="py-2 px-2 font-medium">{item.Descripcion}</td>
                    <td className="py-2 px-2 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${item.tipo === 'mp' ? 'bg-orange-100 text-orange-700' : 'bg-indigo-100 text-indigo-700'}`}>
                        {item.tipo === 'mp' ? 'Materia Prima' : 'Producto'}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-right text-gray-500">{Number(item.CantidadOrdenada).toFixed(4)}</td>
                    <td className="py-2 px-2 text-right">
                      <input
                        type="number" min="0" step="0.0001"
                        value={item.CantidadRecibida}
                        onChange={e => {
                          const val = e.target.value;
                          setRecepcionItems(prev => prev.map((it, i) =>
                            i === idx ? { ...it, CantidadRecibida: val } : it
                          ));
                        }}
                        className="border rounded px-2 py-1 text-sm w-28 text-right focus:ring-2 focus:ring-blue-300"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end">
            <button onClick={handleRecibirMercancia} disabled={guardandoRecepcion}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50">
              <FaBoxOpen /> {guardandoRecepcion ? 'Registrando...' : 'Confirmar Recepción y Actualizar Inventario'}
            </button>
          </div>
        </div>
      )}

      {/* ── HISTORIAL DE RECEPCIONES ── */}
      {recepciones.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <button className="flex items-center gap-2 w-full text-left"
            onClick={() => setShowHistorial(v => !v)}>
            <FaHistory className="text-gray-400" />
            <h2 className="font-semibold text-gray-700">
              Historial de Recepciones ({recepciones.length})
            </h2>
            <span className="ml-auto text-xs text-gray-400">{showHistorial ? '▲ Ocultar' : '▼ Ver'}</span>
          </button>

          {showHistorial && (
            <div className="mt-4 space-y-4">
              {recepciones.map(rec => (
                <div key={rec.Recepcion_Id} className="border border-gray-100 rounded-lg p-4 bg-gray-50">
                  <div className="flex flex-wrap gap-4 text-xs text-gray-500 mb-2">
                    <span><strong>Fecha:</strong> {new Date(rec.FechaRecepcion).toLocaleString('es-MX')}</span>
                    <span><strong>Almacén:</strong> {rec.Almacen}</span>
                    <span><strong>Recibido por:</strong> {rec.RecibidoPor || '—'}</span>
                    {rec.Observaciones && <span><strong>Obs:</strong> {rec.Observaciones}</span>}
                  </div>
                  <table className="min-w-full text-xs">
                    <thead className="text-gray-400 border-b">
                      <tr>
                        <th className="pb-1 text-left">Artículo</th>
                        <th className="pb-1 text-right">Ordenado</th>
                        <th className="pb-1 text-right">Recibido</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(rec.detalle || []).map(d => (
                        <tr key={d.RecepcionDetalle_Id} className="border-b border-gray-50">
                          <td className="py-1">{d.Descripcion}</td>
                          <td className="py-1 text-right text-gray-400">{Number(d.CantidadOrdenada).toFixed(4)}</td>
                          <td className="py-1 text-right font-medium text-green-700">{Number(d.CantidadRecibida).toFixed(4)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal autorización */}
      {authModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Autorización de OC</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nivel de Autorización</label>
                <select value={authForm.Nivel} onChange={e => setAuthForm(f => ({ ...f, Nivel: Number(e.target.value) }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value={1}>Nivel 1</option>
                  <option value={2}>Nivel 2</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Decisión</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" checked={authForm.Aprobado === true}
                      onChange={() => setAuthForm(f => ({ ...f, Aprobado: true }))} />
                    <FaCheckCircle className="text-green-500" /> Aprobar
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" checked={authForm.Aprobado === false}
                      onChange={() => setAuthForm(f => ({ ...f, Aprobado: false }))} />
                    <FaTimesCircle className="text-red-500" /> Rechazar
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Comentarios</label>
                <textarea value={authForm.Comentarios} onChange={e => setAuthForm(f => ({ ...f, Comentarios: e.target.value }))}
                  rows={3} className="w-full border rounded-lg px-3 py-2 text-sm resize-none"
                  placeholder="Motivo o notas..." />
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-5">
              <button onClick={() => setAuthModal(false)}
                className="px-4 py-2 border rounded-lg text-sm text-gray-600">Cancelar</button>
              <button onClick={handleAutorizar} disabled={saving}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                {saving ? 'Guardando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
