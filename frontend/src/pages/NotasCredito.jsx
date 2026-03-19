import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { notify } from '../services/notify';

function NotasCredito() {
  const navigate = useNavigate();
  const [notas, setNotas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [facturas, setFacturas] = useState([]);
  const [productosFactura, setProductosFactura] = useState([]);
  const [formData, setFormData] = useState({
    Factura_Id: '',
    Motivo: '',
    productos: []
  });

  useEffect(() => {
    cargarNotas();
    cargarFacturas();
  }, []);

  const cargarNotas = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/notas-credito', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotas(res.data.data || []);
    } catch (error) {
      notify('Error al cargar notas de crédito', 'error');
    } finally {
      setLoading(false);
    }
  };

  const cargarFacturas = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/reporteria/facturas', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFacturas(res.data.data || []);
    } catch (error) {
      console.error('Error al cargar facturas');
    }
  };

  const cargarProductosFactura = async (facturaId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`/api/notas-credito/factura/${facturaId}/productos`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const detalle = res.data.data || [];
      setProductosFactura(detalle.map(d => ({
        Producto_Id: d.Producto_Id,
        Descripcion: d.ProductoNombre || d.Nombre || 'Sin nombre',
        Cantidad: d.Cantidad,
        PrecioUnitario: d.PrecioUnitario,
        CantidadOriginal: d.Cantidad,
        seleccionado: false
      })));
    } catch (error) {
      console.error('Error al cargar productos:', error);
      setProductosFactura([]);
    }
  };

  const handleFacturaChange = (facturaId) => {
    setFormData({ ...formData, Factura_Id: facturaId });
    if (facturaId) {
      cargarProductosFactura(facturaId);
    } else {
      setProductosFactura([]);
    }
  };

  const toggleProducto = (index) => {
    const nuevos = [...productosFactura];
    nuevos[index].seleccionado = !nuevos[index].seleccionado;
    setProductosFactura(nuevos);
  };

  const actualizarCantidad = (index, cantidad) => {
    const nuevos = [...productosFactura];
    nuevos[index].Cantidad = parseFloat(cantidad) || 0;
    setProductosFactura(nuevos);
  };

  const handleCrearNota = async () => {
    if (!formData.Factura_Id || !formData.Motivo) {
      notify('Completa todos los campos', 'warning');
      return;
    }

    const seleccionados = productosFactura
      .filter(p => p.seleccionado)
      .map(p => ({
        Producto_Id: p.Producto_Id,
        Descripcion: p.Descripcion,
        Cantidad: p.Cantidad,
        PrecioUnitario: p.PrecioUnitario,
        Subtotal: p.Cantidad * p.PrecioUnitario,
        IVA: (p.Cantidad * p.PrecioUnitario) * 0.16,
        Total: (p.Cantidad * p.PrecioUnitario) * 1.16
      }));

    if (seleccionados.length === 0) {
      notify('Selecciona al menos un producto', 'warning');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/notas-credito', {
        ...formData,
        productos: seleccionados
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      notify('Nota de crédito creada exitosamente', 'success');
      setShowModal(false);
      cargarNotas();
      setFormData({ Factura_Id: '', Motivo: '', productos: [] });
      setProductosFactura([]);
    } catch (error) {
      notify(error.response?.data?.message || 'Error al crear nota de crédito', 'error');
    }
  };

  const handleTimbrar = async (id) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`/api/notas-credito/${id}/timbrar`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      notify('Nota de crédito timbrada exitosamente', 'success');
      cargarNotas();
    } catch (error) {
      notify(error.response?.data?.message || 'Error al timbrar', 'error');
    }
  };

  return (
    <div className="w-full h-screen bg-white rounded-none shadow-none p-6 overflow-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Notas de Crédito</h2>
          <p className="text-sm text-gray-600">Gestión de notas de crédito (CFDI Egreso)</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/reporteria')}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm"
          >
            ← Volver
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 text-sm"
          >
            + Nueva Nota de Crédito
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-600">Cargando...</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b">
              <tr className="text-sm text-gray-600">
                <th className="py-3 px-4">Folio</th>
                <th className="py-3 px-4">Factura Relacionada</th>
                <th className="py-3 px-4">Motivo</th>
                <th className="py-3 px-4 text-right">Total</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {notas.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-4 px-4 text-sm text-gray-600 text-center">
                    No hay notas de crédito
                  </td>
                </tr>
              ) : (
                notas.map((nota) => (
                  <tr key={nota.NotaCredito_Id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm">
                      {nota.UUID ? (
                        <span className="font-medium">{nota.Serie || ''}{nota.Folio || ''}</span>
                      ) : (
                        <span className="text-gray-400 italic">Sin timbrar</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm">
                      <span className="font-medium text-blue-600">
                        Factura #{nota.Factura_Id}
                      </span>
                      {nota.FacturaSerie && nota.FacturaFolio && (
                        <span className="text-xs text-gray-500 ml-1">
                          ({nota.FacturaSerie}{nota.FacturaFolio})
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm">{nota.Motivo}</td>
                    <td className="py-3 px-4 text-sm text-right font-medium">
                      ${(nota.Total || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        nota.Status === 'Vigente' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {nota.Status || 'Pendiente'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {!nota.UUID && (
                        <button
                          onClick={() => handleTimbrar(nota.NotaCredito_Id)}
                          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs"
                        >
                          Timbrar
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-bold">Nueva Nota de Crédito</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Factura</label>
                <select
                  value={formData.Factura_Id}
                  onChange={(e) => handleFacturaChange(e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                >
                  <option value="">Seleccionar factura</option>
                  {facturas.map(f => (
                    <option key={f.Factura_Id} value={f.Factura_Id}>
                      {f.Serie}{f.Folio} - {f.ReceptorNombre} - ${f.Total}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Motivo</label>
                <textarea
                  value={formData.Motivo}
                  onChange={(e) => setFormData({ ...formData, Motivo: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                  rows={2}
                  placeholder="Devolución, descuento, error..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Productos a Acreditar</label>
                {productosFactura.length === 0 ? (
                  <div className="bg-blue-50 border border-blue-200 rounded p-3">
                    <p className="text-sm text-blue-800">
                      💡 Selecciona una factura para ver sus productos
                    </p>
                  </div>
                ) : (
                  <div className="border rounded">
                    <div className="bg-gray-50 grid grid-cols-5 gap-2 p-2 border-b text-xs font-semibold text-gray-600">
                      <span>Seleccionar</span>
                      <span>Producto</span>
                      <span>Cant. Original</span>
                      <span>Cant. a Acreditar</span>
                      <span className="text-right">Precio Unit.</span>
                    </div>
                    {productosFactura.map((prod, idx) => (
                      <div key={idx} className="grid grid-cols-5 gap-2 p-2 border-b hover:bg-gray-50 items-center">
                        <input
                          type="checkbox"
                          checked={prod.seleccionado}
                          onChange={() => toggleProducto(idx)}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">{prod.Descripcion}</span>
                        <span className="text-sm text-gray-600">{prod.CantidadOriginal}</span>
                        <input
                          type="number"
                          value={prod.Cantidad}
                          onChange={(e) => actualizarCantidad(idx, e.target.value)}
                          disabled={!prod.seleccionado}
                          max={prod.CantidadOriginal}
                          className="px-2 py-1 border rounded text-sm disabled:bg-gray-100"
                        />
                        <span className="text-sm text-right font-medium">
                          ${prod.PrecioUnitario.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 px-6 py-4 border-t">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 bg-gray-600 text-white rounded">
                Cancelar
              </button>
              <button onClick={handleCrearNota} className="px-4 py-2 bg-orange-600 text-white rounded">
                Crear Nota
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default NotasCredito;
