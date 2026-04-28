import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ventaService } from "../services/ventaService";
import { reporteriaService } from "../services/reporteriaService";
import api from "../services/api";
import { notify } from "../services/notify";
import TablaProductos from "./ventas/TablaProductos";
import ModalFacturacion from "./ventas/ModalFacturacion";
import StatusBadge from "./ventas/StatusBadge";
import confirm from "../services/confirm";
import Modal from "../components/Modal";
import ModalEnviarProduccion from "../components/ModalEnviarProduccion";

const premiumField = "w-full rounded-[12px] border border-[#dce4f0] bg-white px-3 py-2 text-sm text-slate-800 shadow-[0_2px_8px_rgba(15,45,93,0.06)] outline-none focus:border-[#3b6fd4] focus:ring-2 focus:ring-[#3b6fd4]/20";

const GUIA_STATUS_BADGE = {
  'Entregado':   'border border-emerald-200 bg-emerald-50 text-emerald-700',
  'En tránsito': 'border border-blue-200 bg-blue-50 text-blue-700',
  'Incidencia':  'border border-rose-200 bg-rose-50 text-rose-700',
  'Pendiente':   'border border-slate-200 bg-slate-50 text-slate-600',
};

function DetalleVenta() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [venta, setVenta] = useState(null);
  const [detalle, setDetalle] = useState([]);
  const [solicitudesPrecio, setSolicitudesPrecio] = useState([]);
  const [loading, setLoading] = useState(false);
  const [facturando, setFacturando] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [cancelandoFactura, setCancelandoFactura] = useState(false);
  const [showFacturaModal, setShowFacturaModal] = useState(false);
  const [showProduccionModal, setShowProduccionModal] = useState(false);
  const [productosConFaltante, setProductosConFaltante] = useState([]);
  const [facturaRelacionada, setFacturaRelacionada] = useState(null);
  const [rentabilidad, setRentabilidad] = useState(null);
  const [guias, setGuias] = useState([]);
  const [showGuiaForm, setShowGuiaForm] = useState(false);
  const [guiaForm, setGuiaForm] = useState({ fecha_salida: '', transportista: '', numero_guia: '', status: 'Pendiente' });
  const [savingGuia, setSavingGuia] = useState(false);
  const [editingGuia, setEditingGuia] = useState(null);

  const userStr = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
  const currentUser = userStr ? JSON.parse(userStr) : null;
  const esAdminODireccion = currentUser && (currentUser.RolId === 1 || currentUser.RolId === 2);

  const cargarDetalle = async () => {
    setLoading(true);
    try {
      const res = await ventaService.getVentaDetalle(id);
      const data = res?.data || res;
      setVenta(data.venta || data.Venta || null);
      setDetalle(data.detalle || data.Detalle || []);
      setSolicitudesPrecio(data.solicitudesPrecio || []);

      const ventaActual = data.venta || data.Venta || null;
      if (ventaActual?.Venta_Id) {
        try {
          const facturasRes = await reporteriaService.getFacturas();
          const facturas = facturasRes?.data || [];
          const factura = facturas.find((f) => Number(f.Venta_Id) === Number(ventaActual.Venta_Id)) || null;
          setFacturaRelacionada(factura);
        } catch (facturaError) {
          console.warn("No se pudo cargar factura relacionada", facturaError);
          setFacturaRelacionada(null);
        }

        try {
          const rentRes = await ventaService.getRentabilidad(ventaActual.Venta_Id);
          setRentabilidad(rentRes?.data || null);
        } catch {
          setRentabilidad(null);
        }
      } else {
        setFacturaRelacionada(null);
        setRentabilidad(null);
      }
    } catch (error) {
      console.error("Error al obtener venta", error);
      notify(error.response?.data?.message || "Error al obtener venta", "error");
    } finally {
      setLoading(false);
    }
  };

  const cargarGuias = async (ventaId) => {
    try {
      const res = await api.get(`/logistica/ventas/${ventaId}/guias`);
      setGuias(res.data?.data || []);
    } catch {
      setGuias([]);
    }
  };

  useEffect(() => {
    if (id) {
      cargarDetalle();
      cargarGuias(id);
    }
  }, [id]);

  const handleFacturar = async (cfdiData) => {
    if (!venta) return;
    setFacturando(true);
    try {
      await ventaService.facturarVenta(venta.Venta_Id, cfdiData);
      notify("Venta facturada correctamente", "success");
      setShowFacturaModal(false);
      await cargarDetalle();
    } catch (error) {
      console.error("Error al facturar venta", error);
      const errorData = error.response?.data;
      if (errorData?.requiereProduccion && errorData?.productos) {
        setProductosConFaltante(errorData.productos);
        setShowProduccionModal(true);
        notify(errorData.message || "Inventario insuficiente", "warning");
      } else {
        notify(errorData?.message || "Error al facturar venta", "error");
      }
    } finally {
      setFacturando(false);
    }
  };

  const handleCancelar = async () => {
    if (!venta) return;
    const ok = await confirm(
      "¿Deseas cancelar esta venta? Si ya está facturada, no se permitirá cancelar.",
      "Cancelar venta",
      "Cancelar venta",
      "Cerrar"
    );
    if (!ok) return;
    setCancelando(true);
    try {
      await ventaService.cancelarVenta(venta.Venta_Id);
      notify("Venta cancelada correctamente", "success");
      await cargarDetalle();
    } catch (error) {
      console.error("Error al cancelar venta", error);
      notify(error.response?.data?.message || "Error al cancelar venta", "error");
    } finally {
      setCancelando(false);
    }
  };

  const handleConfirmarVenta = async () => {
    if (!venta) return;
    const ok = await confirm(
      "¿Deseas confirmar esta venta para habilitar la facturación?",
      "Confirmar venta",
      "Confirmar venta",
      "Cerrar"
    );
    if (!ok) return;

    try {
      await ventaService.confirmarVenta(venta.Venta_Id);
      notify("Venta confirmada correctamente", "success");
      await cargarDetalle();
    } catch (error) {
      console.error("Error al confirmar venta", error);
      const errorData = error.response?.data;
      if (errorData?.requiereProduccion && errorData?.productos) {
        setProductosConFaltante(errorData.productos);
        setShowProduccionModal(true);
        notify(errorData.message || "Inventario insuficiente", "warning");
      } else {
        notify(errorData?.message || "Error al confirmar venta", "error");
      }
    }
  };

  const handleDescargarPDF = async () => {
    if (!venta) return;
    try {
      const response = await ventaService.descargarFacturaPDF(venta.Venta_Id);
      const contentType = response?.headers?.['content-type'] || '';
      if (!contentType.includes('application/pdf')) {
        notify("No se recibió un PDF válido", "error");
        return;
      }
      const pdfBlob = new Blob([response.data], { type: 'application/pdf' });
      const pdfObjectUrl = URL.createObjectURL(pdfBlob);
      window.open(pdfObjectUrl, '_blank');
      notify("Abriendo vista previa de la factura", "success");
    } catch (error) {
      console.error("Error al obtener PDF", error);
      notify(error.response?.data?.message || "Error al obtener PDF", "error");
    }
  };

  const handleCancelarFactura = async () => {
    if (!facturaRelacionada?.Factura_Id) {
      notify("No se encontró la factura relacionada para cancelar", "error");
      return;
    }

    const motivo = window.prompt("Motivo SAT de cancelación (01, 02, 03, 04)", "02");
    if (!motivo) return;

    const motivoTrim = String(motivo).trim();
    if (!["01", "02", "03", "04"].includes(motivoTrim)) {
      notify("Motivo inválido. Usa 01, 02, 03 o 04", "error");
      return;
    }

    let folioSustitucion = null;
    if (motivoTrim === "01") {
      folioSustitucion = window.prompt("UUID de sustitución", "") || null;
      if (!folioSustitucion) {
        notify("Para motivo 01 debes capturar UUID de sustitución", "error");
        return;
      }
    }

    const ok = await confirm(
      `¿Deseas cancelar la factura ${facturaRelacionada.Serie || ''}${facturaRelacionada.Folio || ''} con motivo ${motivoTrim}?`,
      "Cancelar factura",
      "Cancelar factura",
      "Cerrar"
    );
    if (!ok) return;

    setCancelandoFactura(true);
    try {
      await reporteriaService.cancelarFactura(facturaRelacionada.Factura_Id, {
        motivo: motivoTrim,
        folioSustitucion: folioSustitucion || undefined,
      });
      notify("Factura cancelada correctamente", "success");
      await cargarDetalle();
    } catch (error) {
      console.error("Error al cancelar factura", error);
      const errData = error?.response?.data || {};
      const facturamaMsg = errData?.message || errData?.Message || (errData?.error && errData.error.Message) || null;
      notify(facturamaMsg || error.message || "Error al cancelar factura", "error");
    } finally {
      setCancelandoFactura(false);
    }
  };

  const GUIA_STATUS = ['Pendiente', 'En tránsito', 'Entregado', 'Incidencia'];

  const handleGuiaSubmit = async (e) => {
    e.preventDefault();
    setSavingGuia(true);
    try {
      if (editingGuia) {
        await api.put(`/logistica/guias/${editingGuia.Guia_Id}`, guiaForm);
        notify("Guía actualizada", "success");
      } else {
        await api.post(`/logistica/ventas/${id}/guias`, guiaForm);
        notify("Guía registrada", "success");
      }
      setShowGuiaForm(false);
      setEditingGuia(null);
      setGuiaForm({ fecha_salida: '', transportista: '', numero_guia: '', status: 'Pendiente' });
      await cargarGuias(id);
    } catch (err) {
      notify(err?.response?.data?.detail || "Error al guardar guía", "error");
    } finally {
      setSavingGuia(false);
    }
  };

  const handleEditGuia = (g) => {
    setEditingGuia(g);
    setGuiaForm({
      fecha_salida: g.FechaSalida ? g.FechaSalida.slice(0, 10) : '',
      transportista: g.Transportista || '',
      numero_guia: g.NumeroGuia || '',
      status: g.Status || 'Pendiente',
    });
    setShowGuiaForm(true);
  };

  const handleDeleteGuia = async (guiaId) => {
    const ok = await confirm("¿Eliminar esta guía de envío?", "Eliminar guía", "Eliminar", "Cancelar");
    if (!ok) return;
    try {
      await api.delete(`/logistica/guias/${guiaId}`);
      notify("Guía eliminada", "success");
      await cargarGuias(id);
    } catch {
      notify("Error al eliminar guía", "error");
    }
  };

  const productosTabla = detalle.map((d) => ({
    ...d,
    Nombre: d.ProductoNombre,
    Codigo: d.ProductoCodigo,
  }));

  const estaConfirmada = venta && String(venta.Status || '').trim().toLowerCase() === 'confirmada';
  const puedeFacturar = venta && venta.Status_Id === 2 && estaConfirmada;
  const estaFacturada = venta && venta.Status_Id === 3;
  const estaCancelada = venta && venta.Status_Id === 4;
  const facturaCancelada = String(facturaRelacionada?.Status || '').trim().toLowerCase() === 'cancelada';
  const puedeConfirmarVenta = venta && ![3, 4].includes(venta.Status_Id) && !estaConfirmada;
  const tieneSolicitudesPendientes = solicitudesPrecio.some(s => s.Estado === 'pending');
  const todasSolicitudesAprobadas = solicitudesPrecio.length > 0 && solicitudesPrecio.every(s => s.Estado === 'completed');

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-auto" style={{ background: 'rgba(10,20,50,0.45)' }}>
        <div className="min-h-screen flex items-start sm:items-center justify-center p-0 sm:p-4">
          <div className="overflow-hidden rounded-none sm:rounded-[26px] shadow-[0_24px_64px_rgba(10,20,50,0.22)] w-full max-w-6xl sm:my-4 flex flex-col min-h-screen sm:min-h-0 sm:max-h-[95vh]" style={{ background: '#f4f6fb' }}>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 flex-shrink-0 bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] sticky top-0 z-10">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-200">Ventas</p>
                <h2 className="text-lg font-bold text-white leading-tight">Detalle de venta #{id}</h2>
                {venta && (
                  <p className="text-xs text-blue-100 mt-0.5">
                    Cliente: <span className="font-semibold text-white">{venta.ClienteNombre}</span>
                  </p>
                )}
              </div>
              <button
                onClick={() => navigate("/ventas")}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 transition text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">

              {loading && (
                <div className="flex items-center justify-center py-16">
                  <div className="h-8 w-8 rounded-full border-4 border-[#1b3d86]/20 border-t-[#1b3d86] animate-spin" />
                </div>
              )}

              {!loading && venta && (
                <>
                  {/* Info cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="rounded-[20px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(245,248,255,0.9)_100%)] p-4 shadow-[0_4px_20px_rgba(15,45,93,0.07)]">
                      <h3 className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96]">Información general</h3>
                      <div className="space-y-1.5">
                        <p><span className="text-slate-500 text-xs">Cliente:</span> <span className="text-slate-800 font-medium">{venta.ClienteNombre}</span></p>
                        <p><span className="text-slate-500 text-xs">RFC:</span> <span className="text-slate-800">{venta.ClienteRFC}</span></p>
                        <p><span className="text-slate-500 text-xs">Fecha:</span> <span className="text-slate-800">{venta.FechaVenta ? new Date(venta.FechaVenta).toLocaleString() : "—"}</span></p>
                        <p><span className="text-slate-500 text-xs">Moneda:</span> <span className="text-slate-800">{venta.Moneda}</span></p>
                      </div>
                    </div>

                    <div className="rounded-[20px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(245,248,255,0.9)_100%)] p-4 shadow-[0_4px_20px_rgba(15,45,93,0.07)]">
                      <h3 className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96]">Importes</h3>
                      <div className="space-y-1.5">
                        <p><span className="text-slate-500 text-xs">Subtotal:</span> <span className="text-slate-800">{typeof venta.Subtotal === "number" ? venta.Subtotal.toFixed(2) : venta.Subtotal}</span></p>
                        <p><span className="text-slate-500 text-xs">IVA:</span> <span className="text-slate-800">{typeof venta.IVA === "number" ? venta.IVA.toFixed(2) : venta.IVA}</span></p>
                        <p><span className="text-slate-500 text-xs">Total:</span> <span className="font-bold text-slate-900 text-base">{typeof venta.Total === "number" ? venta.Total.toFixed(2) : venta.Total}</span></p>
                      </div>
                    </div>
                  </div>

                  {/* Status + Price requests */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-[20px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(245,248,255,0.9)_100%)] p-4 shadow-[0_4px_20px_rgba(15,45,93,0.07)]">
                      <h3 className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96]">Estatus de Venta</h3>
                      <StatusBadge statusId={venta.Status_Id} statusNombre={venta.StatusNombre || venta.Status} />
                      {estaFacturada && (
                        <p className="text-xs text-emerald-700 mt-2 font-medium">✓ Esta venta ya está facturada.</p>
                      )}
                      {!estaFacturada && !estaCancelada && venta?.Status_Id === 2 && !estaConfirmada && (
                        <p className="text-xs text-amber-700 mt-2 font-medium">⚠ Debe confirmar la venta antes de facturar.</p>
                      )}
                      {estaConfirmada && !estaFacturada && (
                        <p className="text-xs text-indigo-700 mt-2 font-medium">✓ Venta confirmada. Ya puede facturar.</p>
                      )}
                      {estaCancelada && (
                        <p className="text-xs text-rose-700 mt-2 font-medium">✗ Esta venta está cancelada.</p>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          disabled={!puedeConfirmarVenta}
                          onClick={handleConfirmarVenta}
                          className="rounded-[10px] border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-40 transition"
                        >
                          Confirmar venta
                        </button>
                        <button
                          disabled={!puedeFacturar || facturando}
                          onClick={() => setShowFacturaModal(true)}
                          className="rounded-[10px] border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-40 transition"
                        >
                          {facturando ? "Facturando..." : "Facturar venta"}
                        </button>
                        {estaFacturada && (
                          <button
                            onClick={handleDescargarPDF}
                            className="rounded-[10px] border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition"
                          >
                            Ver Factura
                          </button>
                        )}
                        {estaFacturada && facturaRelacionada && !facturaCancelada && (
                          <button
                            onClick={handleCancelarFactura}
                            disabled={cancelandoFactura}
                            className="rounded-[10px] border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-40 transition"
                          >
                            {cancelandoFactura ? "Cancelando factura..." : "Cancelar factura"}
                          </button>
                        )}
                        <button
                          disabled={estaFacturada || cancelando}
                          onClick={handleCancelar}
                          className="rounded-[10px] border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-40 transition"
                        >
                          {cancelando ? "Cancelando..." : "Cancelar venta"}
                        </button>
                      </div>
                    </div>

                    {/* Price change requests */}
                    <div className="rounded-[20px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(245,248,255,0.9)_100%)] p-4 shadow-[0_4px_20px_rgba(15,45,93,0.07)]">
                      <h3 className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96]">Solicitudes de Precio</h3>
                      {solicitudesPrecio.length === 0 ? (
                        <p className="text-sm text-slate-400">No hay solicitudes de cambio de precio</p>
                      ) : (
                        <div className="space-y-3">
                          {solicitudesPrecio.map((sol) => (
                            <div key={sol.Solicitud_Id} className="rounded-[14px] border-l-4 pl-3 py-2.5 bg-white/70" style={{
                              borderColor: sol.Estado === 'completed' ? '#10b981' : sol.Estado === 'rejected' ? '#ef4444' : '#f59e0b'
                            }}>
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <span className="text-xs font-semibold text-slate-700">Solicitud #{sol.Solicitud_Id}</span>
                                  <p className="text-[10px] text-slate-400 mt-0.5">
                                    {new Date(sol.FechaCreacion).toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                  </p>
                                </div>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                                  sol.Estado === 'completed' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' :
                                  sol.Estado === 'rejected' ? 'border-rose-200 bg-rose-50 text-rose-700' :
                                  'border-amber-200 bg-amber-50 text-amber-700'
                                }`}>
                                  {sol.Estado === 'completed' ? '✓ Aprobada' : sol.Estado === 'rejected' ? '✗ Rechazada' : '⏳ Pendiente'}
                                </span>
                              </div>

                              {sol.detalles && sol.detalles.length > 0 && (
                                <div className="mb-2">
                                  <p className="text-[10px] font-semibold text-slate-600 mb-1.5">Cambios de Precio:</p>
                                  <div className="space-y-1.5">
                                    {sol.detalles.map((detalle, idx) => (
                                      <div key={idx} className="rounded-[8px] border border-[#eaf0fa] bg-[#f8faff] p-2 text-xs">
                                        <p className="font-medium text-slate-800">{detalle.ProductoNombre}</p>
                                        <div className="grid grid-cols-3 gap-2 mt-1 text-slate-600">
                                          <div>
                                            <span className="text-[10px] text-slate-400">Anterior:</span>
                                            <p className="font-semibold">${parseFloat(detalle.PrecioActual || 0).toFixed(2)}</p>
                                          </div>
                                          <div className="flex items-center justify-center text-slate-400">→</div>
                                          <div>
                                            <span className="text-[10px] text-slate-400">Nuevo:</span>
                                            <p className="font-semibold text-[#3b6fd4]">${parseFloat(detalle.PrecioNuevo).toFixed(2)}</p>
                                          </div>
                                        </div>
                                        {detalle.PrecioActual && (
                                          <p className={`mt-1 text-[10px] font-semibold ${detalle.PrecioNuevo > detalle.PrecioActual ? 'text-rose-600' : 'text-emerald-600'}`}>
                                            {detalle.PrecioNuevo > detalle.PrecioActual ? '+' : ''}
                                            {((detalle.PrecioNuevo - detalle.PrecioActual) / detalle.PrecioActual * 100).toFixed(1)}%
                                          </p>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              <div className="grid grid-cols-2 gap-2 text-[10px] pt-2 border-t border-[#eaf0fa]">
                                <div className="flex items-center gap-1.5">
                                  <span className={`w-2 h-2 rounded-full ${sol.EstadoAprobador1 === 'approved' ? 'bg-emerald-500' : sol.EstadoAprobador1 === 'rejected' ? 'bg-rose-500' : 'bg-amber-400'}`} />
                                  <span className="text-slate-500">Aprobador 1 ({sol.EstadoAprobador1 || 'pendiente'})</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className={`w-2 h-2 rounded-full ${sol.EstadoAprobador2 === 'approved' ? 'bg-emerald-500' : sol.EstadoAprobador2 === 'rejected' ? 'bg-rose-500' : 'bg-amber-400'}`} />
                                  <span className="text-slate-500">Aprobador 2 ({sol.EstadoAprobador2 || 'pendiente'})</span>
                                </div>
                              </div>
                            </div>
                          ))}
                          {tieneSolicitudesPendientes && (
                            <div className="rounded-[10px] border border-amber-200 bg-amber-50 px-3 py-2">
                              <p className="text-xs text-amber-800 font-semibold">⚠️ Esperando aprobaciones para completar la venta</p>
                            </div>
                          )}
                          {todasSolicitudesAprobadas && (
                            <div className="rounded-[10px] border border-emerald-200 bg-emerald-50 px-3 py-2">
                              <p className="text-xs text-emerald-800 font-semibold">✓ Todas las solicitudes aprobadas — puede completar la venta</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Products table */}
                  <div className="rounded-[20px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(245,248,255,0.9)_100%)] p-4 shadow-[0_4px_20px_rgba(15,45,93,0.07)]">
                    <h3 className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96]">Productos de la venta</h3>
                    <TablaProductos productos={productosTabla} editable={false} />
                  </div>

                  {/* Shipping guides */}
                  <div className="rounded-[20px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(245,248,255,0.9)_100%)] p-4 shadow-[0_4px_20px_rgba(15,45,93,0.07)]">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96]">Guías de Envío</h3>
                      <button
                        onClick={() => {
                          setEditingGuia(null);
                          setGuiaForm({ fecha_salida: '', transportista: '', numero_guia: '', status: 'Pendiente' });
                          setShowGuiaForm(v => !v);
                        }}
                        className="rounded-[10px] border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition"
                      >
                        + Nueva guía
                      </button>
                    </div>

                    {showGuiaForm && (
                      <form onSubmit={handleGuiaSubmit} className="mb-4 rounded-[16px] border border-[#dce4f0] bg-[#f8faff] p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        <div>
                          <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#6b7a96] mb-1">Transportista</label>
                          <input
                            className={premiumField}
                            placeholder="Ej. FedEx, Estafeta..."
                            value={guiaForm.transportista}
                            onChange={e => setGuiaForm(f => ({ ...f, transportista: e.target.value }))}
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#6b7a96] mb-1">Número de guía</label>
                          <input
                            className={premiumField}
                            placeholder="Número de rastreo"
                            value={guiaForm.numero_guia}
                            onChange={e => setGuiaForm(f => ({ ...f, numero_guia: e.target.value }))}
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#6b7a96] mb-1">Fecha de salida</label>
                          <input
                            type="date"
                            className={premiumField}
                            value={guiaForm.fecha_salida}
                            onChange={e => setGuiaForm(f => ({ ...f, fecha_salida: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#6b7a96] mb-1">Estatus</label>
                          <select
                            className={premiumField}
                            value={guiaForm.status}
                            onChange={e => setGuiaForm(f => ({ ...f, status: e.target.value }))}
                          >
                            {GUIA_STATUS.map(s => <option key={s}>{s}</option>)}
                          </select>
                        </div>
                        <div className="sm:col-span-2 flex gap-2 justify-end">
                          <button type="button" onClick={() => setShowGuiaForm(false)} className="rounded-[10px] border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition">Cancelar</button>
                          <button type="submit" disabled={savingGuia} className="rounded-[10px] bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50 transition">
                            {savingGuia ? 'Guardando...' : editingGuia ? 'Actualizar' : 'Registrar'}
                          </button>
                        </div>
                      </form>
                    )}

                    {guias.length === 0 ? (
                      <p className="text-sm text-slate-400">No hay guías registradas para esta venta.</p>
                    ) : (
                      <div className="overflow-x-auto rounded-[14px] border border-[#eaf0fa]">
                        <table className="w-full text-xs text-left">
                          <thead>
                            <tr className="border-b border-[#eaf0fa]">
                              {["Transportista", "Número de guía", "Fecha salida", "Estatus", ""].map((col, i) => (
                                <th key={col + i} className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#6b7a96] first:pl-4 last:pr-4">{col}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {guias.map(g => (
                              <tr key={g.Guia_Id} className="border-t border-[#eaf0fa] hover:bg-[#f4f7ff]/60 transition">
                                <td className="px-4 py-2.5 text-slate-700">{g.Transportista || '—'}</td>
                                <td className="px-4 py-2.5 font-mono text-slate-800">{g.NumeroGuia || '—'}</td>
                                <td className="px-4 py-2.5 text-slate-600">{g.FechaSalida ? new Date(g.FechaSalida).toLocaleDateString('es-MX') : '—'}</td>
                                <td className="px-4 py-2.5">
                                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border ${GUIA_STATUS_BADGE[g.Status] || GUIA_STATUS_BADGE['Pendiente']}`}>
                                    {g.Status}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5">
                                  <div className="flex gap-2 justify-end">
                                    <button onClick={() => handleEditGuia(g)} className="rounded-[8px] border border-[#1b3d86]/20 bg-[#f0f4ff] px-2.5 py-1 text-[10px] font-semibold text-[#1b3d86] hover:bg-[#e4ecff] transition">Editar</button>
                                    <button onClick={() => handleDeleteGuia(g.Guia_Id)} className="rounded-[8px] border border-rose-200 bg-rose-50 px-2.5 py-1 text-[10px] font-semibold text-rose-700 hover:bg-rose-100 transition">Eliminar</button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Rentabilidad (admin only) */}
                  {esAdminODireccion && rentabilidad && (
                    <div className="rounded-[20px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(245,248,255,0.9)_100%)] p-4 shadow-[0_4px_20px_rgba(15,45,93,0.07)]">
                      <h3 className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96]">Rentabilidad de la venta</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                        <div className="rounded-[16px] border border-[#eaf0fa] bg-white p-3 text-center">
                          <p className="text-[10px] text-slate-500 mb-1">Total venta</p>
                          <p className="font-bold text-slate-900 text-sm">${Number(rentabilidad.TotalVenta || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
                        </div>
                        <div className="rounded-[16px] border border-[#eaf0fa] bg-white p-3 text-center">
                          <p className="text-[10px] text-slate-500 mb-1">Costo total</p>
                          <p className="font-bold text-slate-900 text-sm">${Number(rentabilidad.TotalCosto || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
                        </div>
                        <div className="rounded-[16px] border border-[#eaf0fa] bg-white p-3 text-center">
                          <p className="text-[10px] text-slate-500 mb-1">Utilidad</p>
                          <p className={`font-bold text-sm ${Number(rentabilidad.Utilidad) >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                            ${Number(rentabilidad.Utilidad || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                        <div className="rounded-[16px] border border-[#eaf0fa] bg-white p-3 text-center">
                          <p className="text-[10px] text-slate-500 mb-1">Margen</p>
                          <p className={`font-bold text-lg ${Number(rentabilidad.MargenPct) >= 20 ? 'text-emerald-700' : Number(rentabilidad.MargenPct) >= 10 ? 'text-amber-600' : 'text-rose-700'}`}>
                            {Number(rentabilidad.MargenPct || 0).toFixed(1)}%
                          </p>
                        </div>
                      </div>
                      {rentabilidad.Detalle && rentabilidad.Detalle.length > 0 && (
                        <div className="overflow-x-auto rounded-[14px] border border-[#eaf0fa]">
                          <table className="w-full text-xs text-left">
                            <thead>
                              <tr className="border-b border-[#eaf0fa]">
                                {["Producto", "Cant.", "P. Venta", "Costo", "Utilidad", "Margen %"].map((col, i) => (
                                  <th key={col} className={`px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#6b7a96] first:pl-4 ${i >= 1 ? 'text-right' : ''}`}>{col}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {rentabilidad.Detalle.map((d, i) => (
                                <tr key={i} className="border-t border-[#eaf0fa] hover:bg-[#f4f7ff]/60 transition">
                                  <td className="px-4 py-2.5 text-slate-800">{d.Nombre || d.SKU}</td>
                                  <td className="px-4 py-2.5 text-right text-slate-600">{d.Cantidad}</td>
                                  <td className="px-4 py-2.5 text-right text-slate-600">${Number(d.PrecioUnitario || 0).toFixed(2)}</td>
                                  <td className="px-4 py-2.5 text-right text-slate-600">${Number(d.CostoUnitario || 0).toFixed(2)}</td>
                                  <td className={`px-4 py-2.5 text-right font-semibold ${Number(d.Utilidad) >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                    ${Number(d.Utilidad || 0).toFixed(2)}
                                  </td>
                                  <td className={`px-4 py-2.5 text-right font-semibold ${Number(d.MargenPct) >= 20 ? 'text-emerald-700' : Number(d.MargenPct) >= 10 ? 'text-amber-600' : 'text-rose-700'}`}>
                                    {Number(d.MargenPct || 0).toFixed(1)}%
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {!loading && !venta && (
                <p className="text-slate-500 text-sm">No se encontró la venta solicitada.</p>
              )}
            </div>
          </div>
        </div>

        <ModalFacturacion
          isOpen={showFacturaModal}
          onClose={() => setShowFacturaModal(false)}
          onFacturar={handleFacturar}
        />

        <Modal
          isOpen={showProduccionModal}
          onClose={() => setShowProduccionModal(false)}
          title="Enviar a Producción"
          size="lg"
        >
          <ModalEnviarProduccion
            venta={venta}
            productosConFaltante={productosConFaltante}
            onClose={() => setShowProduccionModal(false)}
            onSuccess={() => {
              setShowProduccionModal(false);
              cargarDetalle();
            }}
          />
        </Modal>
      </div>
    </>
  );
}

export default DetalleVenta;
