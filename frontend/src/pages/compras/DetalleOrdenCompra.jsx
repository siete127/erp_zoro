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

const ESTATUS_BADGE = {
  BORRADOR:               'bg-slate-100 text-slate-600',
  PENDIENTE_AUTORIZACION: 'bg-amber-50 text-amber-700 border border-amber-200',
  AUTORIZADA:             'bg-blue-50 text-blue-700 border border-blue-200',
  RECHAZADA:              'bg-red-50 text-red-700 border border-red-200',
  COMPRADA:               'bg-emerald-50 text-emerald-700 border border-emerald-200',
  CANCELADA:              'bg-slate-100 text-slate-400',
};
const ESTATUS_LABELS = {
  BORRADOR: 'Borrador', PENDIENTE_AUTORIZACION: 'Pendiente Autorizacion',
  AUTORIZADA: 'Autorizada', RECHAZADA: 'Rechazada', COMPRADA: 'Comprada', CANCELADA: 'Cancelada',
};

const premiumFieldClass =
  "w-full rounded-[14px] border border-[#dce4f0] bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 shadow-[0_2px_8px_rgba(15,45,93,0.06)] outline-none transition focus:border-[#3b6fd4] focus:ring-2 focus:ring-[#3b6fd4]/20";

const premiumSectionClass =
  "rounded-[24px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(246,249,253,0.96))] p-5 shadow-[0_8px_24px_rgba(15,45,93,0.07)]";

const fmt = (n) => `$${Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('es-MX') : '—';

function InfoRow({ label, value, href, icon }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#6b7a96] mb-0.5">{label}</p>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" className="text-sm font-medium text-blue-600 hover:underline flex items-center gap-1">
          {icon} {value}
        </a>
      ) : (
        <p className="text-sm font-medium text-slate-800">{value || '—'}</p>
      )}
    </div>
  );
}

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

  const [almacenes, setAlmacenes] = useState([]);
  const [recepcionAlmacen, setRecepcionAlmacen] = useState('');
  const [recepcionObs, setRecepcionObs] = useState('');
  const [recepcionItems, setRecepcionItems] = useState([]);
  const [guardandoRecepcion, setGuardandoRecepcion] = useState(false);
  const [recepciones, setRecepciones] = useState([]);
  const [showHistorial, setShowHistorial] = useState(false);

  const fetchOrden = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/compras/ordenes/${id}`);
      const data = res.data.data;
      setOrden(data);
      setRecepcionItems(
        (data.detalle || []).map(d => ({
          OC_Detalle_Id: d.OC_Detalle_Id,
          Descripcion: d.Descripcion,
          CantidadOrdenada: Number(d.Cantidad),
          CantidadRecibida: Number(d.Cantidad),
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
    const ok = await confirm('¿Enviar a autorizacion?', 'Confirmar');
    if (!ok) return;
    try {
      await api.post(`/compras/ordenes/${id}/enviar-autorizacion`);
      notify('Enviada a autorizacion', 'success');
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
    const ok = await confirm('¿Confirmar la compra? Esta accion marcara la OC como COMPRADA.', 'Confirmar compra');
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
    if (!facturaFile) { notify('Selecciona un archivo de factura', 'error'); return; }
    const formData = new FormData();
    formData.append('factura', facturaFile);
    setUploadingFactura(true);
    try {
      await api.post(`/compras/ordenes/${id}/factura`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
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
    if (!recepcionAlmacen) { notify('Selecciona el almacen destino', 'error'); return; }
    const itemsValidos = recepcionItems.filter(i => Number(i.CantidadRecibida) > 0);
    if (!itemsValidos.length) { notify('Ingresa al menos una cantidad recibida mayor a 0', 'error'); return; }
    const ok = await confirm('¿Confirmar recepcion de mercancia? Se actualizara el inventario.', 'Confirmar recepcion');
    if (!ok) return;
    setGuardandoRecepcion(true);
    try {
      await api.post(`/compras/ordenes/${id}/recibir`, {
        Almacen_Id: Number(recepcionAlmacen),
        Observaciones: recepcionObs || null,
        items: itemsValidos.map(i => ({ OC_Detalle_Id: i.OC_Detalle_Id, CantidadRecibida: Number(i.CantidadRecibida) })),
      });
      notify('Mercancia recibida y stock actualizado', 'success');
      setRecepcionObs('');
      fetchOrden();
      fetchRecepciones();
    } catch (err) {
      notify(err.response?.data?.message || 'Error al registrar recepcion', 'error');
    } finally {
      setGuardandoRecepcion(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="h-8 w-8 rounded-full border-4 border-[#1b3d86]/20 border-t-[#1b3d86] animate-spin" />
    </div>
  );
  if (!orden) return <p className="text-center text-red-500 py-16">Orden no encontrada</p>;

  const auth1 = orden.autorizaciones?.find(a => a.Nivel === 1);
  const auth2 = orden.autorizaciones?.find(a => a.Nivel === 2);
  const puedeDescargarPDF = ['AUTORIZADA', 'COMPRADA'].includes(orden.Estatus);

  const smallField = "w-full rounded-[12px] border border-[#dce4f0] bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-[#3b6fd4] focus:ring-2 focus:ring-[#3b6fd4]/15";
  const tinyField = "w-full rounded-[10px] border border-[#dce4f0] bg-white px-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-400 outline-none transition focus:border-[#3b6fd4] focus:ring-2 focus:ring-[#3b6fd4]/15";

  return (
    <div
      className="w-full min-h-screen overflow-auto"
      style={{ background: 'radial-gradient(ellipse at 70% 0%, rgba(59,107,212,0.07) 0%, transparent 60%), radial-gradient(ellipse at 0% 80%, rgba(99,55,197,0.05) 0%, transparent 50%), #f4f7fc' }}
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* Page header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/compras')}
              className="flex h-9 w-9 items-center justify-center rounded-[12px] border border-[#dce4f0] bg-white text-slate-500 hover:bg-slate-50 transition-colors shadow-[0_2px_8px_rgba(15,45,93,0.06)]"
            >
              <FaArrowLeft className="text-xs" />
            </button>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#6b7a96]">Compras</p>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-[#1d2430]">{orden.NumeroOC}</h1>
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${ESTATUS_BADGE[orden.Estatus] || ''}`}>
                  {ESTATUS_LABELS[orden.Estatus] || orden.Estatus}
                </span>
              </div>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={handleDescargarPDF}
              disabled={!puedeDescargarPDF}
              title={!puedeDescargarPDF ? 'Disponible solo cuando la OC esta autorizada o comprada' : 'Descargar PDF'}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-[12px] transition-colors ${puedeDescargarPDF ? 'border border-red-200 bg-red-50 text-red-600 hover:bg-red-100' : 'border border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'}`}
            >
              <FaFilePdf className="text-xs" /> PDF
            </button>
            {orden.Estatus === 'BORRADOR' && (
              <button onClick={handleEnviarAuth} className="flex items-center gap-1.5 px-4 py-2 rounded-[12px] border border-amber-200 bg-amber-50 text-amber-700 text-sm font-semibold hover:bg-amber-100 transition-colors">
                <FaPaperPlane className="text-xs" /> Enviar a autorizacion
              </button>
            )}
            {orden.Estatus === 'PENDIENTE_AUTORIZACION' && (
              <button onClick={() => setAuthModal(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-[12px] bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] text-white text-sm font-semibold shadow-[0_4px_14px_rgba(27,61,134,0.25)] hover:shadow-[0_6px_20px_rgba(27,61,134,0.35)] transition-shadow">
                <FaCheckCircle className="text-xs" /> Autorizar / Rechazar
              </button>
            )}
            {orden.Estatus === 'AUTORIZADA' && (
              <button onClick={handleComprar} className="flex items-center gap-1.5 px-4 py-2 rounded-[12px] border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm font-semibold hover:bg-emerald-100 transition-colors">
                <FaShoppingCart className="text-xs" /> Registrar Compra
              </button>
            )}
            {!['COMPRADA', 'CANCELADA'].includes(orden.Estatus) && (
              <button onClick={handleCancelar} className="flex items-center gap-1.5 px-4 py-2 rounded-[12px] border border-red-200 bg-white text-red-600 text-sm font-semibold hover:bg-red-50 transition-colors">
                <FaTimesCircle className="text-xs" /> Cancelar
              </button>
            )}
          </div>
        </div>

        {/* Datos generales */}
        <div className={premiumSectionClass}>
          <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.22em] text-[#6b7a96]">Encabezado</p>
          <h3 className="mb-4 text-base font-semibold text-slate-900">Datos Generales</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <InfoRow label="Empresa" value={orden.Empresa} />
            <InfoRow label="Proveedor" value={orden.Proveedor} />
            <InfoRow label="RFC Proveedor" value={orden.ProveedorRFC} />
            <InfoRow label="Fecha OC" value={fmtDate(orden.FechaOC)} />
            <InfoRow label="Fecha Requerida" value={fmtDate(orden.FechaRequerida)} />
            <InfoRow label="Moneda" value={orden.Moneda} />
            {orden.RequisicionNumero && <InfoRow label="Requisicion Origen" value={orden.RequisicionNumero} />}
            <InfoRow label="Factura Ref." value={orden.FacturaReferencia} />
            <InfoRow
              label="Archivo Factura"
              value={orden.FacturaArchivoUrl ? 'Ver factura' : undefined}
              href={orden.FacturaArchivoUrl}
              icon={<FaFileInvoice className="text-xs" />}
            />
            <InfoRow label="Doble autorizacion" value={orden.RequiereDobleAutorizacion ? 'Si' : 'No'} />
            <InfoRow label="Creado por" value={orden.CreatedBy} />
            {orden.Observaciones && (
              <div className="col-span-2 md:col-span-3">
                <InfoRow label="Observaciones" value={orden.Observaciones} />
              </div>
            )}
          </div>
        </div>

        {/* Detalle */}
        <div className={premiumSectionClass}>
          <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.22em] text-[#6b7a96]">Detalle</p>
          <h3 className="mb-4 text-base font-semibold text-slate-900">Productos</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-[#eaf0fa]">
                  <th className="pb-2.5 pr-3 text-left text-[11px] font-bold uppercase tracking-[0.15em] text-[#6b7a96]">Descripcion</th>
                  <th className="pb-2.5 pr-3 text-right text-[11px] font-bold uppercase tracking-[0.15em] text-[#6b7a96]">Cantidad</th>
                  <th className="pb-2.5 pr-3 text-right text-[11px] font-bold uppercase tracking-[0.15em] text-[#6b7a96]">P. Compra</th>
                  <th className="pb-2.5 pr-3 text-right text-[11px] font-bold uppercase tracking-[0.15em] text-[#6b7a96]">Subtotal</th>
                  <th className="pb-2.5 pr-3 text-right text-[11px] font-bold uppercase tracking-[0.15em] text-[#6b7a96]">IVA</th>
                  <th className="pb-2.5 text-right text-[11px] font-bold uppercase tracking-[0.15em] text-[#6b7a96]">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eaf0fa]">
                {(orden.detalle || []).map((d, i) => (
                  <tr key={i} className="hover:bg-[#f5f8fe] transition-colors">
                    <td className="py-3 pr-3">
                      <p className="font-medium text-slate-800">{d.Descripcion}</p>
                      {d.ProductoSKU && <p className="text-xs text-slate-400">SKU: {d.ProductoSKU}</p>}
                    </td>
                    <td className="py-3 pr-3 text-right text-slate-600">{Number(d.Cantidad).toFixed(2)}</td>
                    <td className="py-3 pr-3 text-right text-slate-600">{fmt(d.PrecioCompra)}</td>
                    <td className="py-3 pr-3 text-right text-slate-600">{fmt(d.Subtotal)}</td>
                    <td className="py-3 pr-3 text-right text-slate-600">{fmt(d.IVA)}</td>
                    <td className="py-3 text-right font-bold text-slate-800">{fmt(d.Total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-[#eaf0fa]">
                  <td colSpan={3} className="py-2.5"></td>
                  <td className="py-2.5 pr-3 text-right text-slate-500 text-sm">Subtotal: {fmt(orden.Subtotal)}</td>
                  <td className="py-2.5 pr-3 text-right text-slate-500 text-sm">{fmt(orden.IVA)}</td>
                  <td className="py-2.5 text-right text-[#1b3d86] font-bold text-base">{fmt(orden.Total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Autorizaciones */}
        <div className={premiumSectionClass}>
          <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.22em] text-[#6b7a96]">Flujo</p>
          <h3 className="mb-4 text-base font-semibold text-slate-900">Autorizaciones</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[{ nivel: 1, auth: auth1 }, { nivel: 2, auth: auth2 }].map(({ nivel, auth }) => (
              <div key={nivel} className={`rounded-[18px] p-4 border ${auth ? (auth.Aprobado ? 'border-emerald-200 bg-emerald-50/60' : 'border-red-200 bg-red-50/60') : 'border-[#eaf0fa] bg-[#f8fafc]'}`}>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#6b7a96] mb-2">Nivel {nivel}</p>
                {auth ? (
                  <div>
                    <p className="text-sm font-semibold flex items-center gap-1.5">
                      {auth.Aprobado
                        ? <><FaCheckCircle className="text-emerald-600" /> Aprobado</>
                        : <><FaTimesCircle className="text-red-600" /> Rechazado</>}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">Por: {auth.AutorizadoPor || '—'}</p>
                    <p className="text-xs text-slate-500">{fmtDate(auth.FechaDecision)}</p>
                    {auth.Comentarios && <p className="text-xs text-slate-600 mt-1.5 italic">"{auth.Comentarios}"</p>}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">Pendiente</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Datos de compra */}
        {['AUTORIZADA', 'COMPRADA'].includes(orden.Estatus) && (
          <div className={premiumSectionClass}>
            <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.22em] text-[#6b7a96]">Documentacion</p>
            <h3 className="mb-4 text-base font-semibold text-slate-900">Datos de Compra</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-600">Numero de Factura del Proveedor</label>
                <input type="text" value={facturaRef} onChange={e => setFacturaRef(e.target.value)}
                  placeholder="Ej: FAC-00123" className={smallField} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-600">Cargar Factura</label>
                <div className="flex gap-2 items-center">
                  <input type="file" accept=".pdf,.xml,.png,.jpg,.jpeg"
                    onChange={e => setFacturaFile(e.target.files?.[0] || null)}
                    className={`${smallField} file:mr-2 file:rounded-lg file:border-0 file:bg-slate-100 file:text-xs file:font-medium file:px-2.5 file:py-1 file:text-slate-600`} />
                  <button type="button" onClick={handleUploadFactura}
                    disabled={uploadingFactura || !facturaFile}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-[12px] bg-slate-700 hover:bg-slate-800 text-white text-xs font-semibold disabled:opacity-50 whitespace-nowrap transition-colors">
                    <FaUpload className="text-[10px]" /> {uploadingFactura ? 'Subiendo...' : 'Subir'}
                  </button>
                </div>
                <p className="text-xs text-slate-400">Formatos: PDF, XML, PNG, JPG.</p>
              </div>
            </div>
          </div>
        )}

        {/* Recepcion de mercancia */}
        {['AUTORIZADA', 'COMPRADA'].includes(orden.Estatus) && (
          <div className="rounded-[24px] border border-blue-200/70 bg-[linear-gradient(180deg,rgba(238,244,255,0.95),rgba(245,249,255,0.92))] p-5 shadow-[0_8px_24px_rgba(27,61,134,0.07)]">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-blue-100 text-blue-600">
                <FaTruck className="text-sm" />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#6b7a96]">Logistica</p>
                <h3 className="text-base font-semibold text-slate-900">Recepcion de Mercancia</h3>
              </div>
              <p className="text-xs text-slate-400 ml-auto hidden sm:block">Registra las cantidades exactas recibidas del proveedor</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-600">Almacen destino <span className="text-red-500">*</span></label>
                <select value={recepcionAlmacen} onChange={e => setRecepcionAlmacen(e.target.value)} className={smallField}>
                  <option value="">— Selecciona almacen —</option>
                  {almacenes.map(a => (
                    <option key={a.Almacen_Id} value={a.Almacen_Id}>{a.Nombre} ({a.Codigo})</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-600">Observaciones</label>
                <input type="text" value={recepcionObs} onChange={e => setRecepcionObs(e.target.value)}
                  placeholder="Notas de la recepcion (opcional)" className={smallField} />
              </div>
            </div>
            <div className="overflow-x-auto mb-4 rounded-[18px] border border-blue-200/50 bg-white/80">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-blue-100">
                    <th className="py-2.5 px-4 text-left text-[11px] font-bold uppercase tracking-[0.15em] text-[#6b7a96]">Articulo</th>
                    <th className="py-2.5 px-4 text-center text-[11px] font-bold uppercase tracking-[0.15em] text-[#6b7a96]">Tipo</th>
                    <th className="py-2.5 px-4 text-right text-[11px] font-bold uppercase tracking-[0.15em] text-[#6b7a96]">Cant. Ordenada</th>
                    <th className="py-2.5 px-4 text-right text-[11px] font-bold uppercase tracking-[0.15em] text-[#6b7a96] w-36">Cant. Recibida</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-50">
                  {recepcionItems.map((item, idx) => (
                    <tr key={item.OC_Detalle_Id} className="hover:bg-blue-50/50 transition-colors">
                      <td className="py-2.5 px-4 font-medium text-slate-800 text-sm">{item.Descripcion}</td>
                      <td className="py-2.5 px-4 text-center">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${item.tipo === 'mp' ? 'bg-orange-50 text-orange-700 border border-orange-200' : 'bg-indigo-50 text-indigo-700 border border-indigo-200'}`}>
                          {item.tipo === 'mp' ? 'Mat. Prima' : 'Producto'}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right text-slate-500 text-sm">{Number(item.CantidadOrdenada).toFixed(4)}</td>
                      <td className="py-2.5 px-4 text-right">
                        <input
                          type="number" min="0" step="0.0001"
                          value={item.CantidadRecibida}
                          onChange={e => {
                            const val = e.target.value;
                            setRecepcionItems(prev => prev.map((it, i) => i === idx ? { ...it, CantidadRecibida: val } : it));
                          }}
                          className={`${tinyField} text-right w-28`}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end">
              <button onClick={handleRecibirMercancia} disabled={guardandoRecepcion}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[14px] bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] text-white text-sm font-semibold shadow-[0_4px_14px_rgba(27,61,134,0.3)] hover:shadow-[0_6px_20px_rgba(27,61,134,0.4)] transition-shadow disabled:opacity-50">
                <FaBoxOpen className="text-xs" /> {guardandoRecepcion ? 'Registrando...' : 'Confirmar Recepcion y Actualizar Inventario'}
              </button>
            </div>
          </div>
        )}

        {/* Historial recepciones */}
        {recepciones.length > 0 && (
          <div className={premiumSectionClass}>
            <button className="flex items-center gap-2 w-full text-left" onClick={() => setShowHistorial(v => !v)}>
              <FaHistory className="text-slate-400" />
              <span className="font-semibold text-slate-800">Historial de Recepciones ({recepciones.length})</span>
              <span className="ml-auto text-xs text-slate-400">{showHistorial ? '▲ Ocultar' : '▼ Ver'}</span>
            </button>
            {showHistorial && (
              <div className="mt-4 space-y-3">
                {recepciones.map(rec => (
                  <div key={rec.Recepcion_Id} className="rounded-[18px] border border-[#eaf0fa] bg-[#f8fafc] p-4">
                    <div className="flex flex-wrap gap-4 text-xs text-slate-500 mb-3">
                      <span><strong className="text-slate-700">Fecha:</strong> {new Date(rec.FechaRecepcion).toLocaleString('es-MX')}</span>
                      <span><strong className="text-slate-700">Almacen:</strong> {rec.Almacen}</span>
                      <span><strong className="text-slate-700">Recibido por:</strong> {rec.RecibidoPor || '—'}</span>
                      {rec.Observaciones && <span><strong className="text-slate-700">Obs:</strong> {rec.Observaciones}</span>}
                    </div>
                    <table className="min-w-full text-xs">
                      <thead>
                        <tr className="border-b border-[#eaf0fa] text-[#6b7a96]">
                          <th className="pb-1.5 text-left font-semibold">Articulo</th>
                          <th className="pb-1.5 text-right font-semibold">Ordenado</th>
                          <th className="pb-1.5 text-right font-semibold">Recibido</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(rec.detalle || []).map(d => (
                          <tr key={d.RecepcionDetalle_Id} className="border-b border-[#f0f4fa]">
                            <td className="py-1.5 text-slate-700">{d.Descripcion}</td>
                            <td className="py-1.5 text-right text-slate-400">{Number(d.CantidadOrdenada).toFixed(4)}</td>
                            <td className="py-1.5 text-right font-semibold text-emerald-700">{Number(d.CantidadRecibida).toFixed(4)}</td>
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
      </div>

      {/* Modal autorizacion */}
      {authModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-black/40">
          <div className="w-full max-w-md rounded-[26px] bg-white shadow-[0_32px_80px_rgba(15,45,93,0.28)] overflow-hidden">
            <div className="bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-6 py-5">
              <h3 className="text-lg font-bold text-white">Autorizacion de OC</h3>
              <p className="text-sm text-blue-100/70 mt-0.5">{orden.NumeroOC}</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-600">Nivel de Autorizacion</label>
                <select value={authForm.Nivel} onChange={e => setAuthForm(f => ({ ...f, Nivel: Number(e.target.value) }))} className={premiumFieldClass}>
                  <option value={1}>Nivel 1</option>
                  <option value={2}>Nivel 2</option>
                </select>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-600 mb-2">Decision</p>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
                    <input type="radio" checked={authForm.Aprobado === true} onChange={() => setAuthForm(f => ({ ...f, Aprobado: true }))} className="accent-[#1b3d86]" />
                    <FaCheckCircle className="text-emerald-500" /> Aprobar
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
                    <input type="radio" checked={authForm.Aprobado === false} onChange={() => setAuthForm(f => ({ ...f, Aprobado: false }))} className="accent-red-500" />
                    <FaTimesCircle className="text-red-500" /> Rechazar
                  </label>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-600">Comentarios</label>
                <textarea
                  value={authForm.Comentarios}
                  onChange={e => setAuthForm(f => ({ ...f, Comentarios: e.target.value }))}
                  rows={3}
                  placeholder="Motivo o notas..."
                  className={`${premiumFieldClass} resize-none`}
                />
              </div>
            </div>
            <div className="flex gap-3 justify-end px-6 pb-6">
              <button onClick={() => setAuthModal(false)} className="px-4 py-2.5 rounded-[12px] border border-[#dce4f0] bg-white text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors">
                Cancelar
              </button>
              <button onClick={handleAutorizar} disabled={saving}
                className="px-5 py-2.5 rounded-[12px] bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] text-white text-sm font-semibold disabled:opacity-50 shadow-[0_4px_14px_rgba(27,61,134,0.3)] hover:shadow-[0_6px_20px_rgba(27,61,134,0.4)] transition-shadow">
                {saving ? 'Guardando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
