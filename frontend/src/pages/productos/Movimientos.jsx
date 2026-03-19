import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { notify } from '../../services/notify';

export default function Movimientos() {
  const [movimientos, setMovimientos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [filtros, setFiltros] = useState({ sku: '', productoId: '', almacenId: '' });
  const [showForm, setShowForm] = useState(false);
  const [productos, setProductos] = useState([]);
  const [almacenes, setAlmacenes] = useState([]);
  const [form, setForm] = useState({
    Producto_Id: '',
    Almacen_Id: '',
    TipoMovimiento: 'ENTRADA',
    Cantidad: '',
    Referencia: ''
  });

  const fetchMovimientos = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filtros.productoId) params.append('productoId', filtros.productoId);
      if (filtros.almacenId) params.append('almacenId', filtros.almacenId);
      const res = await api.get(`/inventario/kardex?${params.toString()}`);
      let data = res.data || [];
      if (filtros.sku) {
        const value = filtros.sku.toLowerCase();
        data = data.filter(m => (m.SKU || '').toLowerCase().includes(value));
      }
      setMovimientos(data);
    } catch (err) {
      console.error('Error cargando movimientos', err);
      notify(err.response?.data?.msg || 'Error cargando movimientos', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMovimientos();
    const loadData = async () => {
      try {
        const [pRes, aRes] = await Promise.all([
          api.get('/productos'),
          api.get('/almacenes')
        ]);
        setProductos(pRes.data?.data || pRes.data || []);
        setAlmacenes(aRes.data || []);
      } catch (err) {
        console.error('Error cargando datos', err);
      }
    };
    loadData();
  }, []);

  const handleBuscar = async (e) => {
    e.preventDefault();
    await fetchMovimientos();
  };

  const handleSubmitMovimiento = async (e) => {
    e.preventDefault();
    
    // Prevenir doble submit
    if (submitting) {
      console.log('[FRONTEND] Submit bloqueado - ya está en proceso');
      return;
    }
    
    if (!form.Producto_Id || !form.Almacen_Id || !form.Cantidad) {
      notify('Completa todos los campos requeridos', 'error');
      return;
    }
    
    console.log('[FRONTEND] Iniciando submit de movimiento...');
    setSubmitting(true);
    
    try {
      console.log('[FRONTEND] Enviando request al backend...');
      const response = await api.post('/inventario/movimientos', {
        Producto_Id: Number(form.Producto_Id),
        Almacen_Id: Number(form.Almacen_Id),
        TipoMovimiento: form.TipoMovimiento,
        Cantidad: Number(form.Cantidad),
        Referencia: form.Referencia || null
      });
      console.log('[FRONTEND] Response recibida:', response.data);
      
      notify('Movimiento registrado exitosamente', 'success');
      setForm({ Producto_Id: '', Almacen_Id: '', TipoMovimiento: 'ENTRADA', Cantidad: '', Referencia: '' });
      setShowForm(false);
      
      console.log('[FRONTEND] Recargando movimientos...');
      await fetchMovimientos();
      console.log('[FRONTEND] Movimientos recargados');
    } catch (err) {
      console.error('[FRONTEND] Error registrando movimiento:', err);
      notify(err.response?.data?.msg || 'Error registrando movimiento', 'error');
    } finally {
      console.log('[FRONTEND] Liberando submit lock');
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full h-screen bg-white rounded-none shadow-none p-6 overflow-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Movimientos (Kardex)</h2>
          <p className="text-sm text-gray-600">Historial de entradas, salidas y ajustes</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-[#092052] hover:bg-[#0d3a7a] text-white rounded text-sm"
        >
          {showForm ? 'Cancelar' : '+ Nuevo movimiento'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmitMovimiento} className="bg-gray-50 p-4 rounded mb-4 space-y-3">
          <h3 className="font-semibold text-gray-900">Registrar movimiento de inventario</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Producto *</label>
              <select
                value={form.Producto_Id}
                onChange={(e) => setForm({ ...form, Producto_Id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded bg-white"
                required
              >
                <option value="">Selecciona producto</option>
                {productos.map(p => (
                  <option key={p.Producto_Id} value={p.Producto_Id}>
                    {p.SKU} - {p.Nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Almacén *</label>
              <select
                value={form.Almacen_Id}
                onChange={(e) => setForm({ ...form, Almacen_Id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded bg-white"
                required
              >
                <option value="">Selecciona almacén</option>
                {almacenes.map(a => (
                  <option key={a.Almacen_Id} value={a.Almacen_Id}>
                    {a.Nombre} ({a.Codigo})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Tipo de movimiento *</label>
              <select
                value={form.TipoMovimiento}
                onChange={(e) => setForm({ ...form, TipoMovimiento: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded bg-white"
                required
              >
                <option value="ENTRADA">ENTRADA</option>
                <option value="SALIDA">SALIDA</option>
                <option value="AJUSTE+">AJUSTE+</option>
                <option value="AJUSTE-">AJUSTE-</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Cantidad *</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={form.Cantidad}
                onChange={(e) => setForm({ ...form, Cantidad: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Referencia</label>
            <input
              type="text"
              value={form.Referencia}
              onChange={(e) => setForm({ ...form, Referencia: e.target.value })}
              placeholder="Ej: Compra #001, Venta #123"
              className="w-full px-3 py-2 border border-gray-300 rounded"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm disabled:bg-gray-400 disabled:cursor-not-allowed"
            onClick={(e) => {
              if (submitting) {
                e.preventDefault();
                console.log('[FRONTEND] Click bloqueado - submit en proceso');
              }
            }}
          >
            {submitting ? 'Registrando...' : 'Registrar movimiento'}
          </button>
        </form>
      )}

      <form onSubmit={handleBuscar} className="flex flex-wrap items-center gap-2 mb-4">
        <input
          value={filtros.sku}
          onChange={(e) => setFiltros({ ...filtros, sku: e.target.value })}
          placeholder="Filtrar por SKU"
          className="w-48 p-2 rounded border bg-white text-gray-900 border-gray-300 placeholder-gray-500"
        />
        <input
          value={filtros.productoId}
          onChange={(e) => setFiltros({ ...filtros, productoId: e.target.value })}
          placeholder="Producto_Id"
          className="w-32 p-2 rounded border bg-white text-gray-900 border-gray-300 placeholder-gray-500"
        />
        <input
          value={filtros.almacenId}
          onChange={(e) => setFiltros({ ...filtros, almacenId: e.target.value })}
          placeholder="Almacen_Id"
          className="w-32 p-2 rounded border bg-white text-gray-900 border-gray-300 placeholder-gray-500"
        />
        <button
          type="submit"
          className="px-3 py-2 bg-[#092052] hover:bg-[#0d3a7a] text-white rounded text-sm"
        >
          Buscar
        </button>
      </form>

      {loading ? (
        <p className="text-gray-900">Cargando movimientos...</p>
      ) : (
        <div className="overflow-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-sm text-gray-600">
                <th className="py-2 pl-4 pr-4 w-40">Fecha</th>
                <th className="py-2 pr-4 w-32">SKU</th>
                <th className="py-2 pr-4">Producto</th>
                <th className="py-2 pr-4 w-40">Almacén</th>
                <th className="py-2 pr-4 w-32">Tipo</th>
                <th className="py-2 pr-4 w-28 text-right">Cantidad</th>
                <th className="py-2 pr-4 w-28 text-right">Anterior</th>
                <th className="py-2 pr-4 w-28 text-right">Actual</th>
                <th className="py-2 pr-4 w-40">Referencia</th>
                <th className="py-2 pr-4 w-32">Usuario</th>
              </tr>
            </thead>
            <tbody>
              {movimientos.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-4 px-4 text-sm text-gray-600">
                    No hay movimientos registrados.
                  </td>
                </tr>
              )}
              {movimientos.map((m) => (
                <tr key={m.Kardex_Id} className="border-t border-gray-200 hover:bg-gray-50">
                  <td className="py-3 pl-4 pr-4 text-gray-900 text-sm">
                    {m.FechaMovimiento ? new Date(m.FechaMovimiento).toLocaleString('es-MX', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      hour12: false
                    }) : ''}
                  </td>
                  <td className="py-3 pr-4 text-gray-900 text-sm">{m.SKU}</td>
                  <td className="py-3 pr-4 text-gray-900 text-sm">{m.Nombre}</td>
                  <td className="py-3 pr-4 text-gray-900 text-sm">{m.AlmacenNombre}</td>
                  <td className="py-3 pr-4 text-gray-900 text-sm">{m.TipoMovimiento}</td>
                  <td className="py-3 pr-4 text-gray-900 text-sm text-right">{m.Cantidad}</td>
                  <td className="py-3 pr-4 text-gray-900 text-sm text-right">{m.Stock_Anterior}</td>
                  <td className="py-3 pr-4 text-gray-900 text-sm text-right">{m.Stock_Actual}</td>
                  <td className="py-3 pr-4 text-gray-900 text-sm">{m.Referencia}</td>
                  <td className="py-3 pr-4 text-gray-900 text-sm">{m.Usuario}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
