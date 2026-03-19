import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { cotizacionService } from "../services/cotizacionService";
import { notify } from "../services/notify";
import ClienteSelector from "./ventas/ClienteSelector";
import ProductoBuscador from "./ventas/ProductoBuscador";

function CotizacionNueva() {
  const [empresaCodigo, setEmpresaCodigo] = useState("PTC");
  const [companyId] = useState(1); // TODO: permitir seleccionar compañía específica si aplica
  const [cliente, setCliente] = useState({ ClienteRFC: "", ClienteNombre: "" });
  const [tab, setTab] = useState("CATALOGO");
  const [renglones, setRenglones] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [resumen, setResumen] = useState(null);
  const navigate = useNavigate();

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
    if (!cliente.ClienteRFC || !cliente.ClienteNombre) {
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

  return (
    <div className="w-full h-screen bg-white rounded-none shadow-none p-6 overflow-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Nueva cotización</h2>
          <p className="text-sm text-gray-600">Flujo de cotización con empresa, cliente y renglones de catálogo / PTC.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 text-sm">
        <div>
          <label className="block text-gray-700 mb-1">Empresa (emisor)</label>
          <select
            value={empresaCodigo}
            onChange={(e) => setEmpresaCodigo(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          >
            <option value="CALI">CALI</option>
            <option value="REMA">REMA</option>
            <option value="PTC">PTC</option>
          </select>
        </div>
      </div>

      <ClienteSelector onClienteSelect={handleClienteSelect} clienteData={cliente} />

      <div className="mb-3 flex gap-4 text-sm border-b border-gray-200">
        <button
          type="button"
          className={`pb-2 px-1 border-b-2 ${
            tab === "CATALOGO" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-600"
          }`}
          onClick={() => setTab("CATALOGO")}
        >
          Productos de catálogo (CALI/REMA)
        </button>
        <button
          type="button"
          className={`pb-2 px-1 border-b-2 ${
            tab === "PTC" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-600"
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
          <div className="border border-gray-200 rounded max-h-80 overflow-auto text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-600">
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
                  <tr key={idx} className="border-t border-gray-200">
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
          className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm"
          disabled={guardando}
        >
          Cancelar
        </button>
        <button
          onClick={handleGuardar}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm disabled:bg-gray-400"
          disabled={guardando}
        >
          {guardando ? "Guardando..." : "Guardar cotización"}
        </button>
      </div>
    </div>
  );
}

export default CotizacionNueva;
