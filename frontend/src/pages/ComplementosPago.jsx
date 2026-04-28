import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { notify } from '../services/notify';
import { getDefaultCompanyId } from '../utils/tokenHelper';

const premiumField = "w-full rounded-[12px] border border-[#dce4f0] bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-[0_2px_8px_rgba(15,45,93,0.06)] outline-none focus:border-[#3b6fd4] focus:ring-2 focus:ring-[#3b6fd4]/20 disabled:bg-[#f4f6fb] disabled:text-slate-400";
const smallField = "w-full rounded-[10px] border border-[#dce4f0] bg-white px-2.5 py-1.5 text-xs text-slate-800 shadow-[0_1px_4px_rgba(15,45,93,0.05)] outline-none focus:border-[#3b6fd4] focus:ring-2 focus:ring-[#3b6fd4]/15";

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
      const res = await api.get('/complementos-pago');
      setComplementos(res.data.data || []);
    } catch {
      notify('Error al cargar complementos de pago', 'error');
    } finally {
      setLoading(false);
    }
  };

  const cargarFacturas = async () => {
    try {
      const res = await api.get('/reporteria/facturas');
      setFacturas(res.data.data || []);
    } catch {
      console.error('Error al cargar facturas');
    }
  };

  const handleCrearComplemento = async () => {
    if (!formData.FechaPago || formData.facturas.length === 0) {
      notify('Completa todos los campos', 'warning');
      return;
    }
    try {
      await api.post('/complementos-pago', formData);
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
      await api.post(`/complementos-pago/${id}/timbrar`, {});
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
    const montoTotal = nuevasFacturas.reduce((sum, f) => sum + (parseFloat(f.MontoPagado) || 0), 0);
    setFormData(prev => ({ ...prev, Monto: montoTotal }));
  };

  return (
    <div
      className="min-h-screen w-full px-4 sm:px-6 py-6"
      style={{ background: 'radial-gradient(ellipse at 70% 0%, rgba(59,107,212,0.07) 0%, rgba(255,255,255,0) 60%), radial-gradient(ellipse at 0% 80%, rgba(99,102,241,0.05) 0%, rgba(255,255,255,0) 55%), #f4f6fb' }}
    >
      <div className="mx-auto max-w-7xl space-y-5">

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#3b6fd4]">Facturación</p>
            <h1 className="text-2xl font-bold leading-tight text-[#0d1f3c]">Complementos de Pago</h1>
            <p className="text-sm text-slate-500">Gestión de complementos de pago (CFDI Pago)</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate('/reporteria')}
              className="rounded-[12px] border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
            >
              ← Volver
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="rounded-[14px] bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(27,61,134,0.30)] hover:shadow-[0_6px_20px_rgba(27,61,134,0.40)] transition"
            >
              + Nuevo Complemento
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(245,248,255,0.9)_100%)] shadow-[0_18px_40px_rgba(15,45,93,0.10)] overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 rounded-full border-4 border-[#1b3d86]/20 border-t-[#1b3d86] animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[#eaf0fa]">
                    {["Folio", "Fecha Pago", "Forma Pago", "Monto", "Status", "Acciones"].map((col, i) => (
                      <th key={col} className={`px-4 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96] first:pl-6 last:pr-6 ${i === 3 ? 'text-right' : i === 5 ? 'text-center' : ''}`}>
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {complementos.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-400">No hay complementos de pago</td>
                    </tr>
                  ) : complementos.map((comp) => (
                    <tr key={comp.ComplementoPago_Id} className="border-t border-[#eaf0fa] transition hover:bg-[#f4f7ff]/60">
                      <td className="py-3 pl-6 pr-4 font-mono text-sm font-semibold text-[#1b3d86]">{comp.Serie || ''}{comp.Folio || 'Sin timbrar'}</td>
                      <td className="py-3 pr-4 text-sm text-slate-600">{comp.FechaPago ? new Date(comp.FechaPago).toLocaleDateString() : '—'}</td>
                      <td className="py-3 pr-4 text-sm text-slate-700">{comp.FormaPago}</td>
                      <td className="py-3 pr-4 text-sm font-semibold text-right text-slate-800">
                        ${(comp.Monto || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
                          comp.Status === 'Vigente'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-slate-200 bg-slate-50 text-slate-600'
                        }`}>
                          {comp.Status || 'Pendiente'}
                        </span>
                      </td>
                      <td className="py-3 pr-6 text-center">
                        {!comp.UUID && (
                          <button
                            onClick={() => handleTimbrar(comp.ComplementoPago_Id)}
                            className="rounded-[9px] border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition"
                          >
                            Timbrar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal Crear Complemento */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(10,20,50,0.45)' }}>
          <div className="overflow-hidden rounded-[26px] shadow-[0_24px_64px_rgba(10,20,50,0.22)] w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] flex-shrink-0">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-200">Facturación</p>
                <h3 className="text-base font-bold text-white">Nuevo Complemento de Pago</h3>
              </div>
              <button onClick={() => setShowModal(false)} className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 transition text-sm font-bold">✕</button>
            </div>

            <div className="bg-white flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#6b7a96] mb-1.5">Fecha de Pago</label>
                  <input
                    type="date"
                    value={formData.FechaPago}
                    onChange={(e) => setFormData({ ...formData, FechaPago: e.target.value })}
                    className={premiumField}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#6b7a96] mb-1.5">Forma de Pago</label>
                  <select
                    value={formData.FormaPago}
                    onChange={(e) => setFormData({ ...formData, FormaPago: e.target.value })}
                    className={premiumField}
                  >
                    <option value="01">Efectivo</option>
                    <option value="02">Cheque</option>
                    <option value="03">Transferencia</option>
                    <option value="04">Tarjeta de Crédito</option>
                    <option value="28">Tarjeta de Débito</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#6b7a96] mb-1.5">Número de Operación</label>
                  <input
                    value={formData.NumOperacion}
                    onChange={(e) => setFormData({ ...formData, NumOperacion: e.target.value })}
                    className={premiumField}
                    placeholder="Opcional"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#6b7a96] mb-1.5">Monto Total</label>
                  <input
                    value={`$${formData.Monto.toFixed(2)}`}
                    disabled
                    className={premiumField}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#6b7a96]">Facturas a Pagar</label>
                  <button onClick={agregarFactura} className="rounded-[10px] border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition">
                    + Agregar Factura
                  </button>
                </div>
                {formData.facturas.length === 0 && (
                  <div className="rounded-[14px] border border-violet-200 bg-violet-50 px-4 py-3 mb-3">
                    <p className="text-xs font-semibold text-violet-800">
                      Ejemplo: Factura de $50,000 que paga $20,000 (primer pago):
                    </p>
                    <p className="text-[11px] text-violet-700 mt-1">
                      Factura: A-123 | Saldo Anterior: 50000 | Monto Pagado: 20000 | Parcialidad: 1 | Saldo: $30,000
                    </p>
                  </div>
                )}
                {formData.facturas.length > 0 && (
                  <div className="grid grid-cols-6 gap-2 mb-1 px-1">
                    {["Factura", "Saldo Anterior", "Monto Pagado", "Parcialidad", "Saldo Restante", ""].map((h, i) => (
                      <span key={i} className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">{h}</span>
                    ))}
                  </div>
                )}
                <div className="space-y-2">
                  {formData.facturas.map((fact, idx) => (
                    <div key={idx} className="grid grid-cols-6 gap-2 items-center rounded-[12px] border border-[#eaf0fa] bg-[#f8faff] px-2 py-2">
                      <select
                        value={fact.Factura_Id}
                        onChange={(e) => actualizarFactura(idx, 'Factura_Id', e.target.value)}
                        className={smallField}
                      >
                        <option value="">Seleccionar...</option>
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
                        className={smallField}
                      />
                      <input
                        type="number"
                        placeholder="Ej: 20000"
                        value={fact.MontoPagado}
                        onChange={(e) => actualizarFactura(idx, 'MontoPagado', e.target.value)}
                        className={smallField}
                      />
                      <input
                        type="number"
                        placeholder="Ej: 1"
                        value={fact.NumParcialidad}
                        onChange={(e) => actualizarFactura(idx, 'NumParcialidad', e.target.value)}
                        className={smallField}
                      />
                      <input
                        value={`$${Number(fact.SaldoInsoluto).toFixed(2)}`}
                        disabled
                        className={`${smallField} font-semibold bg-[#f4f6fb]`}
                      />
                      <button
                        onClick={() => {
                          const nuevas = formData.facturas.filter((_, i) => i !== idx);
                          setFormData({ ...formData, facturas: nuevas });
                          const montoTotal = nuevas.reduce((sum, f) => sum + (parseFloat(f.MontoPagado) || 0), 0);
                          setFormData(prev => ({ ...prev, Monto: montoTotal }));
                        }}
                        className="rounded-[8px] border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 px-6 py-4 border-t border-[#eaf0fa] bg-white flex-shrink-0">
              <button onClick={() => setShowModal(false)} className="rounded-[12px] border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition">
                Cancelar
              </button>
              <button onClick={handleCrearComplemento} className="rounded-[12px] bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-5 py-2 text-sm font-semibold text-white shadow-[0_4px_10px_rgba(27,61,134,0.25)] transition">
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
