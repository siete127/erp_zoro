import { useState, useEffect } from 'react';
import { FaIndustry } from 'react-icons/fa';
import api from '../services/api';
import { notify } from '../services/notify';

const ModalEnviarProduccion = ({ venta, productosConFaltante, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [productos, setProductos] = useState([]);

  useEffect(() => {
    if (productosConFaltante && productosConFaltante.length > 0) {
      setProductos(
        productosConFaltante.map(p => ({
          Producto_Id: p.Producto_Id,
          Nombre: p.Nombre,
          Faltante: p.Faltante || p.FaltantePropio || 0,
          FaltantePropio: p.FaltantePropio || p.Faltante || 0,
          StockPropio: p.StockPropio ?? p.StockActual ?? 0,
          StockPTC: p.StockPTC ?? 0,
          DisponiblePTC: p.DisponiblePTC ?? 0,
          CantidadRequerida: p.CantidadRequerida || 0,
          TieneBOM: p.TieneBOM ?? false,
          RequiereProduccion: p.RequiereProduccion ?? (p.Faltante > 0),
          PuedeSurtirPTC: p.PuedeSurtirPTC ?? false,
          Cantidad: p.Faltante || p.FaltantePropio || 0
        }))
      );
    }
  }, [productosConFaltante]);

  const actualizarCantidad = (index, valor) => {
    const nuevos = [...productos];
    nuevos[index].Cantidad = parseFloat(valor) || 0;
    setProductos(nuevos);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const productosEnviar = productos
        .filter(p => p.Cantidad > 0)
        .map(p => ({ Producto_Id: p.Producto_Id, Cantidad: p.Cantidad }));

      if (productosEnviar.length === 0) {
        notify('Debe especificar al menos un producto con cantidad mayor a 0', 'error');
        setLoading(false);
        return;
      }

      console.log('Enviando a producción:', {
        venta_id: venta.Venta_Id,
        productos: productosEnviar
      });

      const response = await api.post(`/ventas/${venta.Venta_Id}/ordenes-produccion`, {
        productos: productosEnviar
      });

      console.log('Respuesta:', response.data);

      if (response.data.success) {
        notify(`${productosEnviar.length} orden(es) de producción creada(s) correctamente`, 'success');
        onSuccess();
      } else {
        notify(response.data.message || 'Error al crear órdenes', 'error');
      }
    } catch (error) {
      console.error('Error completo:', error);
      console.error('Respuesta del servidor:', error.response?.data);
      const errorMsg = error.response?.data?.message || error.response?.data?.error || 'Error al crear órdenes de producción';
      notify(errorMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
        <p className="text-sm text-blue-800">
          <strong>Venta #{venta.Venta_Id}</strong> - Los siguientes productos no tienen suficiente inventario propio.
          Se verificó también el stock de <strong>PTC (Producción)</strong>.
        </p>
      </div>

      <div className="space-y-3">
        {productos.map((prod, idx) => (
          <div key={idx} className="border rounded-lg p-4 bg-gray-50">
            <div className="flex flex-col gap-3">
              <div>
                <p className="font-medium text-gray-900">{prod.Nombre}</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 text-xs">
                  <div className="bg-white rounded p-2 border">
                    <p className="text-gray-500">Requerido</p>
                    <p className="font-bold text-gray-800">{prod.CantidadRequerida}</p>
                  </div>
                  <div className="bg-white rounded p-2 border">
                    <p className="text-gray-500">Stock propio</p>
                    <p className="font-bold text-gray-800">{prod.StockPropio}</p>
                  </div>
                  <div className={`rounded p-2 border ${prod.StockPTC > 0 ? 'bg-green-50 border-green-200' : 'bg-white'}`}>
                    <p className="text-gray-500">Stock PTC</p>
                    <p className={`font-bold ${prod.StockPTC > 0 ? 'text-green-700' : 'text-gray-800'}`}>{prod.StockPTC}</p>
                  </div>
                  <div className={`rounded p-2 border ${prod.Faltante > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                    <p className="text-gray-500">Faltante total</p>
                    <p className={`font-bold ${prod.Faltante > 0 ? 'text-red-700' : 'text-green-700'}`}>{prod.Faltante}</p>
                  </div>
                </div>
                {prod.PuedeSurtirPTC && (
                  <p className="text-xs text-green-700 mt-1 bg-green-50 p-1 rounded">
                    ✅ PTC tiene {prod.DisponiblePTC} unidades disponibles que pueden surtir parcial o totalmente
                  </p>
                )}
                {prod.RequiereProduccion && prod.TieneBOM && (
                  <p className="text-xs text-orange-700 mt-1 bg-orange-50 p-1 rounded">
                    🏭 Se necesita producir {prod.Faltante} unidades — Se solicitará a PTC
                  </p>
                )}
                {!prod.TieneBOM && prod.Faltante > 0 && (
                  <p className="text-xs text-red-700 mt-1 bg-red-50 p-1 rounded">
                    ⚠️ Sin receta de producción (BOM) — No se puede fabricar
                  </p>
                )}
              </div>
              {prod.TieneBOM && prod.Faltante > 0 && (
                <div className="flex items-center gap-3">
                  <label className="text-xs text-gray-600 whitespace-nowrap">Cantidad a producir (PTC):</label>
                  <input
                    type="number"
                    value={prod.Cantidad}
                    onChange={(e) => actualizarCantidad(idx, e.target.value)}
                    className="w-full sm:w-32 border rounded px-3 py-2 text-center font-medium"
                    min="0"
                    step="1"
                    required
                  />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
        <p className="text-xs text-yellow-800">
          💡 Se crearán órdenes de producción asignadas a <strong>PTC REMA</strong> (empresa productora).
          La venta quedará en estado "En Producción" hasta que PTC confirme y complete las órdenes.
        </p>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <button
          type="button"
          onClick={onClose}
          className="px-6 py-2 border rounded-lg hover:bg-gray-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50"
        >
          <FaIndustry /> {loading ? 'Creando...' : 'Enviar a Producción'}
        </button>
      </div>
    </form>
  );
};

export default ModalEnviarProduccion;
