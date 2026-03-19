import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { notify } from '../../services/notify';

export default function Transferencias() {
  const [almacenes, setAlmacenes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [form, setForm] = useState({
    Almacen_Origen_Id: '',
    Almacen_Destino_Id: '',
    Referencia: '',
  });
  const [detalles, setDetalles] = useState([{ Producto_Id: '', Cantidad: '', stockDisponible: 0 }]);
  const [loading, setLoading] = useState(false);
  const [viewDetail, setViewDetail] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [aRes, pRes] = await Promise.all([
          api.get('/almacenes'),
          api.get('/productos?limit=1000&page=1'),
        ]);
        setAlmacenes(aRes.data || []);
         const arr = pRes.data?.data || pRes.data || [];
        setProductos(arr);
      } catch (err) {
        console.error('Error cargando datos para transferencias', err);
        notify(err.response?.data?.msg || 'Error cargando datos para transferencias', 'error');
      }
    };
    load();
  }, []);

  const updateDetalle = async (idx, patch) => {
    setDetalles((prev) => prev.map((d, i) => (i === idx ? { ...d, ...patch } : d)));
    
    // Si se selecciona un producto, obtener stock disponible
    if (patch.Producto_Id && form.Almacen_Origen_Id) {
      try {
        const res = await api.get(`/inventario?productoId=${patch.Producto_Id}&almacenId=${form.Almacen_Origen_Id}`);
        const stock = res.data[0]?.Cantidad || 0;
        setDetalles((prev) => prev.map((d, i) => (i === idx ? { ...d, stockDisponible: stock } : d)));
      } catch (err) {
        console.error('Error obteniendo stock', err);
      }
    }  
  };

  const addDetalle = () => {
    setDetalles((prev) => [...prev, { Producto_Id: '', Cantidad: '', stockDisponible: 0 }]);
  };

  const removeDetalle = (idx) => {
    setDetalles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.Almacen_Origen_Id || !form.Almacen_Destino_Id) {
      notify('Selecciona almacén origen y destino', 'error');
      return;
    }
    const payload = {
      Almacen_Origen_Id: Number(form.Almacen_Origen_Id),
      Almacen_Destino_Id: Number(form.Almacen_Destino_Id),
      Referencia: form.Referencia || null,
      Detalles: detalles
        .filter((d) => d.Producto_Id && d.Cantidad)
        .map((d) => ({
          Producto_Id: Number(d.Producto_Id),
          Cantidad: Number(d.Cantidad),
        })),
    };

    if (!payload.Detalles.length) {
      notify('Agrega al menos un producto a transferir', 'error');
      return;
    }

    setLoading(true);
    try {
      await api.post('/inventario/transferencias', payload);
      notify('Transferencia realizada', 'success');
      setForm({ Almacen_Origen_Id: '', Almacen_Destino_Id: '', Referencia: '' });
      setDetalles([{ Producto_Id: '', Cantidad: '', stockDisponible: 0 }]);
    } catch (err) {
      console.error('Error realizando transferencia', err);
      notify(err.response?.data?.msg || 'Error realizando transferencia', 'error');
    } finally {
      setLoading(false);
    }
  };

  const viewProductDetail = async (productoId) => {
    try {
      const res = await api.get(`/productos/${productoId}`);
      setViewDetail(res.data);
    } catch (err) {
      console.error('Error cargando producto', err);
      notify(err.response?.data?.msg || 'Error cargando producto', 'error');
    }
  };

  return (
    <div className="w-full h-screen bg-white rounded-none shadow-none p-6 overflow-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Transferencias entre almacenes</h2>
          <p className="text-sm text-gray-600">Movimiento de stock de un almacén a otro</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 max-w-5xl">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Almacén origen *</label>
            <select
              value={form.Almacen_Origen_Id}
              onChange={(e) => setForm({ ...form, Almacen_Origen_Id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded"
            >
              <option value="">Selecciona origen</option>
              {almacenes.map((a) => (
                <option key={a.Almacen_Id} value={a.Almacen_Id}>
                  {a.Nombre} ({a.Codigo})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Almacén destino *</label>
            <select
              value={form.Almacen_Destino_Id}
              onChange={(e) => setForm({ ...form, Almacen_Destino_Id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded"
            >
              <option value="">Selecciona destino</option>
              {almacenes.map((a) => (
                <option key={a.Almacen_Id} value={a.Almacen_Id}>
                  {a.Nombre} ({a.Codigo})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Referencia</label>
          <input
            type="text"
            value={form.Referencia}
            onChange={(e) => setForm({ ...form, Referencia: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded"
          />
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-2">Productos a transferir</h3>
          <div className="space-y-2">
            {detalles.map((d, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-5">
                  <select
                    value={d.Producto_Id}
                    onChange={(e) => updateDetalle(idx, { Producto_Id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded"
                  >
                    <option value="">Selecciona producto</option>
                    {productos.map((p) => (
                      <option key={p.Producto_Id} value={p.Producto_Id}>
                        {p.SKU} - {p.Nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <input
                    type="number"
                    min="0"
                    max={d.stockDisponible}
                    step="0.01"
                    value={d.Cantidad}
                    onChange={(e) => updateDetalle(idx, { Cantidad: e.target.value })}
                    placeholder="Cantidad"
                    className="w-full px-3 py-2 border border-gray-300 rounded"
                  />
                  {d.Producto_Id && d.stockDisponible > 0 && (
                    <p className="text-xs text-gray-600 mt-1">Disponible: {d.stockDisponible}</p>
                  )}
                  {d.Producto_Id && d.stockDisponible === 0 && (
                    <p className="text-xs text-red-600 mt-1">Sin stock</p>
                  )}
                </div>
                <div className="col-span-4 flex gap-1">
                  {d.Producto_Id && (
                    <button
                      type="button"
                      onClick={() => viewProductDetail(d.Producto_Id)}
                      className="px-3 py-2 bg-[#092052] text-white rounded text-xs hover:bg-[#0d3a7a]"
                    >
                      Ver
                    </button>
                  )}
                  {detalles.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeDetalle(idx)}
                      className="px-3 py-2 bg-red-600 text-white rounded text-xs hover:bg-red-700"
                    >
                      Quitar
                    </button>
                  )}
                  {idx === detalles.length - 1 && (
                    <button
                      type="button"
                      onClick={addDetalle}
                      className="px-3 py-2 bg-gray-600 text-white rounded text-xs hover:bg-gray-700"
                    >
                      Agregar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-4 flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
          >
            {loading ? 'Procesando...' : 'Confirmar transferencia'}
          </button>
        </div>
      </form>

      {viewDetail && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl max-h-[95vh] bg-white rounded-2xl shadow-2xl p-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Detalle del producto</h3>
              <button
                onClick={() => setViewDetail(null)}
                className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="font-semibold text-gray-600">SKU:</span>
                  <p className="text-gray-900">{viewDetail.SKU}</p>
                </div>
                <div>
                  <span className="font-semibold text-gray-600">Nombre:</span>
                  <p className="text-gray-900">{viewDetail.Nombre}</p>
                </div>
              </div>
              <div>
                <span className="font-semibold text-gray-600">Descripción:</span>
                <p className="text-gray-900">{viewDetail.Descripcion || '-'}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="font-semibold text-gray-600">Precio:</span>
                  <p className="text-gray-900">{typeof viewDetail.Precio === 'number' ? viewDetail.Precio.toFixed(2) : viewDetail.Precio}</p>
                </div>
                <div>
                  <span className="font-semibold text-gray-600">Moneda:</span>
                  <p className="text-gray-900">{viewDetail.TipoMoneda || '-'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="font-semibold text-gray-600">Clave Producto/Servicio SAT:</span>
                  <p className="text-gray-900">{viewDetail.ClaveProdServSAT || '-'}</p>
                </div>
                <div>
                  <span className="font-semibold text-gray-600">Clave Unidad SAT:</span>
                  <p className="text-gray-900">{viewDetail.ClaveUnidadSAT || '-'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="font-semibold text-gray-600">Objeto de Impuesto:</span>
                  <p className="text-gray-900">{viewDetail.ObjetoImpuesto || '-'}</p>
                </div>
                <div>
                  <span className="font-semibold text-gray-600">Activo:</span>
                  <p className="text-gray-900">{viewDetail.Activo ? 'Sí' : 'No'}</p>
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setViewDetail(null)}
                className="px-4 py-2 bg-[#092052] text-white rounded hover:bg-[#0d3a7a]"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
