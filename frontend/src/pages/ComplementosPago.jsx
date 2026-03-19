import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { notify } from '../services/notify';
import { getDefaultCompanyId } from '../utils/tokenHelper';

function ComplementosPago() {
  const navigate = useNavigate();
  const [complementos, setComplementos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [facturas, setFacturas] = useState([]);
  const [defaultCompanyId, setDefaultCompanyId] = useState(1);
  const [formData, setFormData] = useState({
    Company_Id: 1,
    FechaPago: new Date().toISOString().split('T')[0],
    FormaPago: '03',
    Moneda: 'MXN',
    Monto: 0,
    NumOperacion: '',
    CtaOrdenante: '',
    CtaBeneficiario: '',
    facturas: []
  });

  useEffect(() => {
    const companyId = getDefaultCompanyId();
    setDefaultCompanyId(companyId);
    setFormData(prev => ({ ...prev, Company_Id: companyId }));
    cargarComplementos();
    cargarFacturas();
  }, []);

  const cargarComplementos = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/complementos-pago', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setComplementos(res.data.data || []);
    } catch (error) {
      notify('Error al cargar complementos de pago', 'error');
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

  const handleCrearComplemento = async () => {
    if (!formData.FechaPago || formData.facturas.length === 0) {
      notify('Completa todos los campos', 'warning');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/complementos-pago', formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      notify('Complemento de pago creado exitosamente', 'success');
      setShowModal(false);
      cargarComplementos();
      setFormData({
        Company_Id: defaultCompanyId,
        FechaPago: new Date().toISOString().split('T')[0],
        FormaPago: '03',
        Moneda: 'MXN',
        Monto: 0,
        NumOperacion: '',
        CtaOrdenante: '',
        CtaBeneficiario: '',
        facturas: []
      });
    } catch (error) {
      notify(error.response?.data?.message || 'Error al crear complemento', 'error');
    }
  };

  const handleTimbrar = async (id) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`/api/complementos-pago/${id}/timbrar`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      notify('Complemento de pago timbrado exitosamente', 'success');
      cargarComplementos();
    } catch (error) {
      notify(error.response?.data?.message || 'Error al timbrar', 'error');
    }
  };

  const agregarFactura = () => {
    setFormData({
      ...formData,
      facturas: [...formData.facturas, {
        Factura_Id: '',
        MontoPagado: 0,
        NumParcialidad: 1,
        SaldoAnterior: 0,
        SaldoInsoluto: 0
      }]
    });
  };

  const actualizarFactura = (index, field, value) => {
    const nuevasFacturas = [...formData.facturas];
    nuevasFacturas[index][field] = value;
    
    if (field === 'MontoPagado' || field === 'SaldoAnterior') {
      const montoPagado = parseFloat(nuevasFacturas[index].MontoPagado) || 0;
      const saldoAnterior = parseFloat(nuevasFacturas[index].SaldoAnterior) || 0;
      nuevasFacturas[index].SaldoInsoluto = saldoAnterior - montoPagado;
    }
    
    setFormData({ ...formData, facturas: nuevasFacturas });
    
    // Calcular monto total
    const montoTotal = nuevasFacturas.reduce((sum, f) => sum + (parseFloat(f.MontoPagado) || 0), 0);
    setFormData(prev => ({ ...prev, Monto: montoTotal }));
  };

  return (
    <div className="w-full h-screen bg-white rounded-none shadow-none p-6 overflow-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Complementos de Pago</h2>
          <p className="text-sm text-gray-600">Gestión de complementos de pago (CFDI Pago)</p>
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
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm"
          >
            + Nuevo Complemento
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
                <th className="py-3 px-4">Fecha Pago</th>
                <th className="py-3 px-4">Forma Pago</th>
                <th className="py-3 px-4 text-right">Monto</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {complementos.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-4 px-4 text-sm text-gray-600 text-center">
                    No hay complementos de pago
                  </td>
                </tr>
              ) : (
                complementos.map((comp) => (
                  <tr key={comp.ComplementoPago_Id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm">{comp.Serie || ''}{comp.Folio || 'Sin timbrar'}</td>
                    <td className="py-3 px-4 text-sm">
                      {comp.FechaPago ? new Date(comp.FechaPago).toLocaleDateString() : '-'}
                    </td>
                    <td className="py-3 px-4 text-sm">{comp.FormaPago}</td>
                    <td className="py-3 px-4 text-sm text-right font-medium">
                      ${(comp.Monto || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        comp.Status === 'Vigente' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {comp.Status || 'Pendiente'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {!comp.UUID && (
                        <button
                          onClick={() => handleTimbrar(comp.ComplementoPago_Id)}
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

      {/* Modal Crear Complemento */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-bold">Nuevo Complemento de Pago</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Fecha de Pago</label>
                  <input
                    type="date"
                    value={formData.FechaPago}
                    onChange={(e) => setFormData({ ...formData, FechaPago: e.target.value })}
                    className="w-full px-3 py-2 border rounded"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Forma de Pago</label>
                  <select
                    value={formData.FormaPago}
                    onChange={(e) => setFormData({ ...formData, FormaPago: e.target.value })}
                    className="w-full px-3 py-2 border rounded"
                  >
                    <option value="01">Efectivo</option>
                    <option value="02">Cheque</option>
                    <option value="03">Transferencia</option>
                    <option value="04">Tarjeta de Crédito</option>
                    <option value="28">Tarjeta de Débito</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Número de Operación</label>
                  <input
                    value={formData.NumOperacion}
                    onChange={(e) => setFormData({ ...formData, NumOperacion: e.target.value })}
                    className="w-full px-3 py-2 border rounded"
                    placeholder="Opcional"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Monto Total</label>
                  <input
                    value={`$${formData.Monto.toFixed(2)}`}
                    disabled
                    className="w-full px-3 py-2 border rounded bg-gray-50"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium">Facturas a Pagar</label>
                  <button onClick={agregarFactura} className="px-3 py-1 bg-green-600 text-white rounded text-sm">
                    + Agregar Factura
                  </button>
                </div>
                {formData.facturas.length === 0 && (
                  <div className="bg-purple-50 border border-purple-200 rounded p-3 mb-3">
                    <p className="text-sm text-purple-800">
                      <strong>💡 Ejemplo:</strong> Factura de $50,000 que paga $20,000 (primer pago):
                    </p>
                    <p className="text-xs text-purple-700 mt-1">
                      Factura: A-123 | Saldo Anterior: 50000 | Monto Pagado: 20000 | Parcialidad: 1 | Saldo: $30,000
                    </p>
                  </div>
                )}
                {formData.facturas.length > 0 && (
                  <div className="grid grid-cols-6 gap-2 mb-1">
                    <span className="text-xs font-semibold text-gray-600">Factura</span>
                    <span className="text-xs font-semibold text-gray-600">Saldo Anterior</span>
                    <span className="text-xs font-semibold text-gray-600">Monto Pagado</span>
                    <span className="text-xs font-semibold text-gray-600">Parcialidad</span>
                    <span className="text-xs font-semibold text-gray-600">Saldo Restante</span>
                    <span className="text-xs font-semibold text-gray-600"></span>
                  </div>
                )}
                {formData.facturas.map((fact, idx) => (
                  <div key={idx} className="grid grid-cols-6 gap-2 mb-2">
                    <select
                      value={fact.Factura_Id}
                      onChange={(e) => actualizarFactura(idx, 'Factura_Id', e.target.value)}
                      className="px-2 py-1 border rounded text-sm"
                    >
                      <option value="">Seleccionar factura</option>
                      {facturas.map(f => (
                        <option key={f.Factura_Id} value={f.Factura_Id}>
                          {f.Serie}{f.Folio} - ${f.Total}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      placeholder="Ej: 50000"
                      value={fact.SaldoAnterior}
                      onChange={(e) => actualizarFactura(idx, 'SaldoAnterior', e.target.value)}
                      className="px-2 py-1 border rounded text-sm"
                    />
                    <input
                      type="number"
                      placeholder="Ej: 20000"
                      value={fact.MontoPagado}
                      onChange={(e) => actualizarFactura(idx, 'MontoPagado', e.target.value)}
                      className="px-2 py-1 border rounded text-sm"
                    />
                    <input
                      type="number"
                      placeholder="Ej: 1"
                      value={fact.NumParcialidad}
                      onChange={(e) => actualizarFactura(idx, 'NumParcialidad', e.target.value)}
                      className="px-2 py-1 border rounded text-sm"
                    />
                    <input
                      value={`$${fact.SaldoInsoluto.toFixed(2)}`}
                      disabled
                      className="px-2 py-1 border rounded text-sm bg-gray-50 font-medium"
                    />
                    <button
                      onClick={() => {
                        const nuevas = formData.facturas.filter((_, i) => i !== idx);
                        setFormData({ ...formData, facturas: nuevas });
                        const montoTotal = nuevas.reduce((sum, f) => sum + (parseFloat(f.MontoPagado) || 0), 0);
                        setFormData(prev => ({ ...prev, Monto: montoTotal }));
                      }}
                      className="px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600"
                      title="Eliminar"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 px-6 py-4 border-t">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 bg-gray-600 text-white rounded">
                Cancelar
              </button>
              <button onClick={handleCrearComplemento} className="px-4 py-2 bg-purple-600 text-white rounded">
                Crear Complemento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ComplementosPago;
