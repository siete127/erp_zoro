import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { cotizacionService } from "../services/cotizacionService";
import { crmService } from "../services/crmService";
import api from "../services/api";
import { notify } from "../services/notify";
import ClienteSelector from "./ventas/ClienteSelector";
import ProductoBuscador from "./ventas/ProductoBuscador";

function CotizacionNueva() {
  const [searchParams] = useSearchParams();
  const oportunidadId = searchParams.get("oportunidad_id");
  const clientIdParam = searchParams.get("client_id");
  const companyIdParam = searchParams.get("company_id");
  const [empresaCodigo, setEmpresaCodigo] = useState("PTC");
  const [companyId, setCompanyId] = useState(Number(companyIdParam) || 1); // TODO: permitir seleccionar compañía específica si aplica
  const [cliente, setCliente] = useState({ Client_Id: "", ClienteRFC: "", ClienteNombre: "" });
  const [tab, setTab] = useState("CATALOGO");
  const [renglones, setRenglones] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [resumen, setResumen] = useState(null);
  const [contextoCRM, setContextoCRM] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    const cargarContexto = async () => {
      const effectiveOpportunityId = oportunidadId ? Number(oportunidadId) : null;
      const effectiveClientId = clientIdParam ? Number(clientIdParam) : null;
      const effectiveCompanyId = companyIdParam ? Number(companyIdParam) : null;

      if (effectiveCompanyId) {
        setCompanyId(effectiveCompanyId);
      }

      if (!effectiveOpportunityId && !effectiveClientId) {
        return;
      }

      try {
        let currentClientId = effectiveClientId;

        if (effectiveOpportunityId) {
          const oppRes = await crmService.getOportunidad(effectiveOpportunityId);
          const oppData = oppRes?.data || oppRes;
          const currentOpportunity = oppData.oportunidad || oppData.Oportunidad || oppData;

          if (!cancelled) {
            setContextoCRM({
              Oportunidad_Id: currentOpportunity?.Oportunidad_Id || effectiveOpportunityId,
              NombreOportunidad: currentOpportunity?.NombreOportunidad || `Oportunidad #${effectiveOpportunityId}`,
            });
          }

          if (currentOpportunity?.Company_Id) {
            setCompanyId(Number(currentOpportunity.Company_Id));
          }
          if (currentOpportunity?.Client_Id) {
            currentClientId = Number(currentOpportunity.Client_Id);
          }
        }

        if (currentClientId) {
          const clientRes = await api.get(`/clients/${currentClientId}`);
          const clientData =
            clientRes.data?.client ||
            clientRes.data?.data?.client ||
            clientRes.data?.data ||
            clientRes.data;

          if (!cancelled && clientData) {
            setCliente({
              Client_Id: clientData.Client_Id,
              ClienteRFC: clientData.RFC || "",
              ClienteNombre: clientData.LegalName || clientData.CommercialName || "",
            });
          }
        }
      } catch (error) {
        console.error("Error al cargar contexto CRM para la cotización", error);
        if (!cancelled) {
          notify("No se pudo precargar la oportunidad/cliente vinculados", "warning");
        }
      }
    };

    cargarContexto();
    return () => {
      cancelled = true;
    };
  }, [clientIdParam, companyIdParam, oportunidadId]);

  const handleClienteSelect = (data) => {
    setCliente(data);
  };

  const handleAgregarProductoCatalogo = (producto) => {
    setRenglones((prev) => [
      ...prev,
      {
        TipoProducto: "CATALOGO",
        ID_PRODUCTO: producto.Producto_Id,
        Producto_Id: producto.Producto_Id,
        SKU: producto.SKU || producto.Codigo,
        Descripcion: producto.Nombre,
        UnidadVenta: "PZA",
        Cantidad: 1,
        PrecioUnitario: Number(producto.PrecioVenta || producto.Precio || 0),
        TipoMoneda: producto.TipoMoneda || "MXN",
      },
    ]);
  };

  const handleAgregarProductoPTC = () => {
    setRenglones((prev) => [
      ...prev,
      {
        TipoProducto: "PTC",
        ID_PRODUCTO: null,
        Producto_Id: null,
        SKU: "",
        Descripcion: "Producto PTC",
        UnidadVenta: "PZA",
        Cantidad: 1000,
        PrecioUnitario: 0,
        TipoMoneda: "MXN",
        DatosPTC: {
          LargoMM: 1300,
          Ala1MM: 22,
          Ala2MM: 22,
          Calibre: 120,
        },
      },
    ]);
  };

  const handleActualizarRenglon = (index, field, value) => {
    setRenglones((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        [field]:
          field === "Cantidad" || field === "PrecioUnitario"
            ? Number(value)
            : value,
      };
      return copy;
    });
  };

  const handleEliminarRenglon = (index) => {
    setRenglones((prev) => prev.filter((_, i) => i !== index));
  };

  const handleGuardar = async () => {
    if (!cliente.Client_Id && (!cliente.ClienteRFC || !cliente.ClienteNombre)) {
      notify("Debe capturar los datos del cliente", "error");
      return;
    }
    if (renglones.length === 0) {
      notify("Debe agregar al menos un renglón a la cotización", "error");
      return;
    }

    setGuardando(true);
    try {
      const payload = {
        Company_Id: companyId,
        EmpresaCodigo: empresaCodigo,
        Client_Id: cliente.Client_Id || null,
        Oportunidad_Id: oportunidadId ? Number(oportunidadId) : null,
        ClienteRFC: cliente.ClienteRFC,
        ClienteNombre: cliente.ClienteNombre,
        Moneda: "MXN",
        detalles: renglones.map((r) => ({
          TipoProducto: r.TipoProducto,
          ID_PRODUCTO: r.Producto_Id || r.ID_PRODUCTO,
          Producto_Id: r.Producto_Id || r.ID_PRODUCTO,
          SKU: r.SKU,
          Descripcion: r.Descripcion,
          UnidadVenta: r.UnidadVenta,
          Cantidad: r.Cantidad,
          PrecioUnitario: r.PrecioUnitario,
          DatosPTC: r.DatosPTC,
        })),
      };

      const res = await cotizacionService.createCotizacion(payload);
      const data = res?.data || res;
      setResumen({
        ID_COTIZACION: data?.cabecera?.ID_COTIZACION,
        margenGlobal: data?.margenGlobal,
        semaforo: data?.semaforo,
      });
      notify("Cotización guardada", "success");
      if (data?.cabecera?.ID_COTIZACION) {
        navigate(`/cotizaciones/${data.cabecera.ID_COTIZACION}`);
      }
    } catch (error) {
      console.error("Error al guardar cotización", error);
      notify(error.response?.data?.message || "Error al guardar cotización", "error");
    } finally {
      setGuardando(false);
    }
  };

  const premiumFieldClass = "w-full rounded-[14px] border border-[#dce4f0] bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 shadow-[0_2px_8px_rgba(15,45,93,0.06)] outline-none transition focus:border-[#3b6fd4] focus:ring-2 focus:ring-[#3b6fd4]/20";

  return (
    <div
      className="min-h-screen w-full px-4 sm:px-6 py-6"
      style={{ background: "radial-gradient(ellipse at 70% 0%, rgba(59,107,212,0.07) 0%, rgba(255,255,255,0) 60%), radial-gradient(ellipse at 0% 80%, rgba(99,102,241,0.05) 0%, rgba(255,255,255,0) 55%), #f4f6fb" }}
    >
      <div className="mx-auto max-w-7xl space-y-5">

      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#3b6fd4]">Ventas</p>
          <h1 className="text-2xl font-bold text-[#0d1f3c]">Nueva cotización</h1>
          <p className="text-sm text-slate-500">Flujo de cotización con empresa, cliente y renglones de catálogo / PTC.</p>
        </div>
      </div>

      <div className="rounded-[24px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(245,248,255,0.9)_100%)] p-5 shadow-[0_4px_20px_rgba(15,45,93,0.07)]">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 text-sm">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Empresa (emisor)</label>
          <select
            value={empresaCodigo}
            onChange={(e) => setEmpresaCodigo(e.target.value)}
            className={premiumFieldClass}
          >
            <option value="CALI">CALI</option>
            <option value="REMA">REMA</option>
            <option value="PTC">PTC</option>
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Company_Id</label>
          <input
            type="text"
            value={companyId}
            readOnly
            className="w-full rounded-[14px] border border-[#eaf0fa] bg-slate-50 px-3.5 py-2.5 text-sm text-slate-500 cursor-not-allowed"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Contexto CRM</label>
          <div className="w-full rounded-[14px] border border-[#dce4f0] bg-white px-3.5 py-2.5 text-sm min-h-[42px]">
            {contextoCRM ? (
              <>
                Oportunidad #{contextoCRM.Oportunidad_Id}
                <div className="text-xs text-gray-600 mt-1">{contextoCRM.NombreOportunidad}</div>
              </>
            ) : (
              <span className="text-gray-500">Sin oportunidad vinculada</span>
            )}
          </div>
        </div>
      </div>

      <ClienteSelector onClienteSelect={handleClienteSelect} clienteData={cliente} />

      </div>{/* end premiumSectionClass */}

      <div className="mb-3 flex gap-4 text-sm border-b border-[#eaf0fa]">
        <button
          type="button"
          className={`pb-2 px-1 border-b-2 font-semibold text-sm ${
            tab === "CATALOGO" ? "border-[#3b6fd4] text-[#3b6fd4]" : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
          onClick={() => setTab("CATALOGO")}
        >
          Productos de catálogo (CALI/REMA)
        </button>
        <button
          type="button"
          className={`pb-2 px-1 border-b-2 font-semibold text-sm ${
            tab === "PTC" ? "border-[#3b6fd4] text-[#3b6fd4]" : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
          onClick={() => setTab("PTC")}
        >
          Productos de fabricación (PTC)
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div>
          {tab === "CATALOGO" ? (
            <>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Buscar productos de catálogo</h3>
              <ProductoBuscador onAgregarProducto={handleAgregarProductoCatalogo} />
            </>
          ) : (
            <>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Productos PTC</h3>
              <p className="text-xs text-gray-600 mb-2">
                Aquí puedes agregar renglones de productos PTC con sus variables (dimensiones, calibre, etc.).
              </p>
              <button
                type="button"
                onClick={handleAgregarProductoPTC}
                className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
              >
                + Agregar producto PTC
              </button>
            </>
          )}
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Renglones de la cotización</h3>
          <div className="rounded-[18px] border border-[#eaf0fa] overflow-auto max-h-80 text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f4f7ff] text-[#6b7a96]">
                  <th className="py-1 px-2">Tipo</th>
                  <th className="py-1 px-2">Descripción</th>
                  <th className="py-1 px-2 w-20 text-right">Cant.</th>
                  <th className="py-1 px-2 w-24 text-right">Precio</th>
                  <th className="py-1 px-2 w-20 text-center">Moneda</th>
                  <th className="py-1 px-2 w-16 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {renglones.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-3 px-2 text-gray-600">
                      Sin renglones capturados.
                    </td>
                  </tr>
                )}
                {renglones.map((r, idx) => (
                  <tr key={idx} className="border-t border-[#eaf0fa]">
                    <td className="py-1 px-2 text-gray-800">{r.TipoProducto}</td>
                    <td className="py-1 px-2 text-gray-800">
                      <input
                        type="text"
                        value={r.Descripcion}
                        onChange={(e) => handleActualizarRenglon(idx, "Descripcion", e.target.value)}
                        className="w-full border border-gray-200 rounded px-1 py-1 text-xs"
                      />
                    </td>
                    <td className="py-1 px-2 text-right">
                      <input
                        type="number"
                        min="0"
                        value={r.Cantidad}
                        onChange={(e) => handleActualizarRenglon(idx, "Cantidad", e.target.value)}
                        className="w-full border border-gray-200 rounded px-1 py-1 text-xs text-right"
                      />
                    </td>
                    <td className="py-1 px-2 text-right">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={r.PrecioUnitario}
                        onChange={(e) => handleActualizarRenglon(idx, "PrecioUnitario", e.target.value)}
                        className="w-full border border-gray-200 rounded px-1 py-1 text-xs text-right"
                      />
                    </td>
                    <td className="py-1 px-2 text-center text-gray-800">
                      {r.TipoMoneda || "MXN"}
                    </td>
                    <td className="py-1 px-2 text-center">
                      <button
                        type="button"
                        onClick={() => handleEliminarRenglon(idx)}
                        className="px-2 py-1 bg-red-50 text-red-600 rounded text-xs hover:bg-red-100"
                      >
                        X
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {resumen && (
            <div className="mt-3 text-xs text-gray-800">
              <div>
                Margen global: {resumen.margenGlobal != null ? `${Number(resumen.margenGlobal).toFixed(2)}%` : "-"}
              </div>
              <div>Semáforo: {resumen.semaforo || "-"}</div>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2 mt-4">
        <button
          onClick={() => navigate("/cotizaciones")}
          className="rounded-[14px] border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          disabled={guardando}
        >
          Cancelar
        </button>
        <button
          onClick={handleGuardar}
          className="rounded-[14px] bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(27,61,134,0.30)] hover:shadow-[0_6px_20px_rgba(27,61,134,0.40)] disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={guardando}
        >
          {guardando ? "Guardando…" : "Guardar cotización"}
        </button>
      </div>

      </div>{/* end max-w container */}
    </div>
  );
}

export default CotizacionNueva;
