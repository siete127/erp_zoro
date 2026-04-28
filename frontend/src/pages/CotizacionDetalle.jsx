import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { cotizacionService } from "../services/cotizacionService";
import { notify } from "../services/notify";
import confirm from "../services/confirm";

const STATUS_BADGES = {
  BORRADOR:             "border border-slate-200 bg-slate-50 text-slate-600",
  PENDIENTE_APROBACION: "border border-amber-200 bg-amber-50 text-amber-800",
  APROBADA:             "border border-emerald-200 bg-emerald-50 text-emerald-700",
  RECHAZADA:            "border border-rose-200 bg-rose-50 text-rose-700",
  CONVERTIDA:           "border border-blue-200 bg-blue-50 text-blue-700",
};

const fmtMoney = (value) =>
  Number(value || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const InfoRow = ({ label, value, children }) => (
  <div>
    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#6b7a96]">{label}</p>
    <div className="mt-0.5 text-sm text-slate-800">{children ?? value ?? "—"}</div>
  </div>
);

function CotizacionDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [procesando, setProcesando] = useState(false);

  const cargar = async () => {
    setLoading(true);
    try {
      const res = await cotizacionService.getCotizacion(id);
      setData(res?.data || res);
    } catch (error) {
      notify(error.response?.data?.message || "Error al cargar cotización", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, [id]);

  const handleAprobar = async () => {
    if (!data?.cabecera) return;
    setProcesando(true);
    try {
      const res = await cotizacionService.aprobarCotizacion(id, {});
      notify(res?.message || "Cotización actualizada", "success");
      await cargar();
    } catch (error) {
      notify(error.response?.data?.message || "Error al procesar cotización", "error");
    } finally {
      setProcesando(false);
    }
  };

  const handleConfirmarPedido = async () => {
    if (!data?.cabecera) return;
    const ok = await confirm("¿Confirmar el pedido? Se generará una venta.", "Confirmar pedido", "Confirmar", "Cancelar");
    if (!ok) return;
    setProcesando(true);
    try {
      const res = await cotizacionService.confirmarPedido(id);
      const payload = res?.data || res;
      notify("Pedido generado a partir de la cotización", "success");
      if (payload?.Venta_Id) navigate(`/ventas/${payload.Venta_Id}`);
    } catch (error) {
      notify(error.response?.data?.message || "Error al confirmar pedido", "error");
    } finally {
      setProcesando(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: '#f4f6fb' }}>
        <div className="h-8 w-8 rounded-full border-4 border-[#1b3d86]/20 border-t-[#1b3d86] animate-spin" />
      </div>
    );
  }

  const { cabecera, detalles } = data;
  const status = String(cabecera.Status || "BORRADOR").toUpperCase();
  const approvalDisabled = procesando || ["APROBADA", "CONVERTIDA", "PENDIENTE_APROBACION"].includes(status);
  const confirmDisabled = procesando || cabecera.Venta_Id || !["APROBADA", "CONVERTIDA"].includes(status);
  const approvalLabel = status === "RECHAZADA" ? "Reenviar" : "Enviar / Aprobar";

  return (
    <div
      className="min-h-screen w-full px-4 sm:px-6 py-6"
      style={{ background: 'radial-gradient(ellipse at 70% 0%, rgba(59,107,212,0.07) 0%, rgba(255,255,255,0) 60%), radial-gradient(ellipse at 0% 80%, rgba(99,102,241,0.05) 0%, rgba(255,255,255,0) 55%), #f4f6fb' }}
    >
      <div className="mx-auto max-w-6xl space-y-5">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#3b6fd4]">Ventas</p>
                <h1 className="text-2xl font-bold text-[#0d1f3c]">Cotización #{cabecera.ID_COTIZACION}</h1>
              </div>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGES[status] || "border border-slate-200 bg-slate-50 text-slate-600"}`}>
                {status}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Cliente: {cabecera.ClienteNombre || cabecera.ClientLegalName || cabecera.ClientCommercialName || "—"}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => navigate("/cotizaciones")} className="rounded-[12px] border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition">
              Volver
            </button>
            {status === "PENDIENTE_APROBACION" ? (
              <button onClick={() => navigate("/aprobaciones")} className="rounded-[12px] border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition">
                Ir a aprobaciones
              </button>
            ) : (
              <button onClick={handleAprobar} disabled={approvalDisabled} className="rounded-[12px] border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50 transition">
                {approvalLabel}
              </button>
            )}
            <button onClick={handleConfirmarPedido} disabled={confirmDisabled} className="rounded-[12px] bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-4 py-2 text-xs font-semibold text-white shadow-[0_4px_10px_rgba(27,61,134,0.25)] disabled:opacity-50 transition">
              Confirmar pedido
            </button>
            {cabecera.Venta_Id && (
              <button onClick={() => navigate(`/ventas/${cabecera.Venta_Id}`)} className="rounded-[12px] border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition">
                Ver venta
              </button>
            )}
          </div>
        </div>

        {/* Status banners */}
        {status === "PENDIENTE_APROBACION" && (
          <div className="rounded-[16px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Esta cotización ya fue enviada a aprobación. La decisión final se procesa desde la bandeja de aprobaciones.
          </div>
        )}
        {status === "RECHAZADA" && (
          <div className="rounded-[16px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            La cotización fue rechazada. Puedes reenviarla cuando hayas ajustado precios o condiciones.
          </div>
        )}

        {/* Info cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              title: "Datos generales",
              content: (
                <div className="space-y-2">
                  <InfoRow label="Empresa" value={cabecera.EmpresaCodigo} />
                  <InfoRow label="Moneda" value={cabecera.Moneda} />
                  <InfoRow label="Vendedor" value={cabecera.Vendedor} />
                  <InfoRow label="Vigencia" value={cabecera.FechaVigencia ? new Date(cabecera.FechaVigencia).toLocaleDateString("es-MX") : null} />
                  <InfoRow label="Oportunidad CRM">
                    {cabecera.Oportunidad_Id ? (
                      <button className="text-[#3b6fd4] underline underline-offset-2 text-sm hover:text-[#1b3d86]" onClick={() => navigate(`/crm/oportunidades/${cabecera.Oportunidad_Id}`)}>
                        #{cabecera.Oportunidad_Id} {cabecera.OportunidadNombre || ""}
                      </button>
                    ) : "—"}
                  </InfoRow>
                  <InfoRow label="Venta generada">
                    {cabecera.Venta_Id ? (
                      <button className="text-[#3b6fd4] underline underline-offset-2 text-sm hover:text-[#1b3d86]" onClick={() => navigate(`/ventas/${cabecera.Venta_Id}`)}>
                        #{cabecera.Venta_Id}
                      </button>
                    ) : "—"}
                  </InfoRow>
                </div>
              )
            },
            {
              title: "Totales",
              content: (
                <div className="space-y-2">
                  <InfoRow label="Subtotal" value={fmtMoney(cabecera.Subtotal)} />
                  <InfoRow label="IVA" value={fmtMoney(cabecera.IVA)} />
                  <InfoRow label="Total" value={fmtMoney(cabecera.TOTAL)} />
                  <InfoRow label="Margen %" value={cabecera.MargenPorc != null ? `${Number(cabecera.MargenPorc).toFixed(2)}%` : null} />
                </div>
              )
            },
            {
              title: "Comentarios",
              content: <p className="text-sm text-slate-600 whitespace-pre-wrap">{cabecera.ComentarioDescuento || "Sin comentarios"}</p>
            }
          ].map(card => (
            <div key={card.title} className="rounded-[24px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(245,248,255,0.9)_100%)] p-5 shadow-[0_4px_20px_rgba(15,45,93,0.07)]">
              <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-[#6b7a96]">{card.title}</h3>
              {card.content}
            </div>
          ))}
        </div>

        {/* Detail table */}
        <div className="rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(245,248,255,0.9)_100%)] shadow-[0_18px_40px_rgba(15,45,93,0.10)] overflow-hidden">
          <div className="border-b border-[#eaf0fa] px-6 py-3">
            <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-[#6b7a96]">Renglones de la cotización</h3>
          </div>
          <div className="overflow-x-auto max-h-[60vh]">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#eaf0fa]">
                  {["Tipo", "Descripción", "Cant.", "Precio", "Subtotal", "Margen %"].map((col, i) => (
                    <th key={col} className={`px-4 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96] first:pl-6 last:pr-6 ${i >= 2 ? 'text-right' : ''}`}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {!detalles || detalles.length === 0 ? (
                  <tr><td colSpan={6} className="px-6 py-8 text-center text-sm text-slate-400">Sin renglones.</td></tr>
                ) : detalles.map((renglon) => (
                  <tr key={renglon.ID_DETALLE} className="border-t border-[#eaf0fa] transition hover:bg-[#f4f7ff]/60">
                    <td className="py-2.5 pl-6 pr-4 text-slate-700">{renglon.TipoProducto}</td>
                    <td className="py-2.5 pr-4 text-slate-800">{renglon.Descripcion}</td>
                    <td className="py-2.5 pr-4 text-right text-slate-700">{renglon.CANTIDAD?.toFixed ? renglon.CANTIDAD.toFixed(2) : renglon.CANTIDAD}</td>
                    <td className="py-2.5 pr-4 text-right text-slate-700">{renglon.PRECIO_UNITARIO?.toFixed ? renglon.PRECIO_UNITARIO.toFixed(2) : renglon.PRECIO_UNITARIO}</td>
                    <td className="py-2.5 pr-4 text-right font-semibold text-slate-800">{renglon.SUBTOTAL?.toFixed ? renglon.SUBTOTAL.toFixed(2) : renglon.SUBTOTAL}</td>
                    <td className="py-2.5 pr-6 text-right text-slate-700">{renglon.MARGEN_PCT != null ? `${Number(renglon.MARGEN_PCT).toFixed(2)}%` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}

export default CotizacionDetalle;
