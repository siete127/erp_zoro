import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { notify } from '../../services/notify';
import { socket } from '../../services/socket';
import confirm from '../../services/confirm';

export default function OrdenesProduccion() {
  const navigate = useNavigate();
  const [ordenes, setOrdenes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filtros, setFiltros] = useState({ Estado: 'all', Company_Id: 'all' });
  const [companies, setCompanies] = useState([]);
  const [selectedOP, setSelectedOP] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [isPTCUser, setIsPTCUser] = useState(false);
  const [confirmComentario, setConfirmComentario] = useState('');

  const fetchCompanies = async () => {
    try {
      const res = await api.get('/companies');
      const companiesData = res.data || [];
      setCompanies(companiesData);
      
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      setUserRole(user.RolId);
      
      // Verificar si el usuario pertenece a PTC
      const ptcCompany = companiesData.find(c => c.NameCompany && c.NameCompany.includes('PTC'));
      if (ptcCompany && user.companies) {
        setIsPTCUser(user.companies.includes(ptcCompany.Company_Id) || user.RolId === 1);
      } else if (user.RolId === 1) {
        setIsPTCUser(true); // superadmin
      }
    } catch (err) {
      console.error('Error cargando empresas', err);
    }
  };

  const fetchOrdenes = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filtros.Estado && filtros.Estado !== 'all') params.append('Estado', filtros.Estado);
      if (filtros.Company_Id && filtros.Company_Id !== 'all') params.append('Company_Id', filtros.Company_Id);
      const res = await api.get(`/produccion/ordenes?${params.toString()}`);
      setOrdenes(res.data?.data || []);
    } catch (err) {
      console.error('Error cargando órdenes', err);
      notify(err.response?.data?.message || 'Error cargando órdenes', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
    fetchOrdenes();
  }, []);

  useEffect(() => {
    fetchOrdenes();
  }, [filtros.Estado, filtros.Company_Id]);

  useEffect(() => {
    const handler = () => {
      fetchOrdenes();
    };
    socket.on('produccion:nueva', handler);
    return () => socket.off('produccion:nueva', handler);
  }, []);

  const handleCambiarEstado = async (opId, nuevoEstado) => {
    const ok = await confirm(`¿Cambiar estado a ${nuevoEstado}?`, 'Confirmar cambio');
    if (!ok) return;
    
    try {
      await api.put(`/produccion/ordenes/${opId}/estado`, { Estado: nuevoEstado });
      notify('Estado actualizado', 'success');
      fetchOrdenes();
    } catch (err) {
      notify(err.response?.data?.message || 'Error al cambiar estado', 'error');
    }
  };

  const handleConfirmPTC = async (opId, canProduce) => {
    const accion = canProduce ? 'APROBAR' : 'RECHAZAR';
    const ok = await confirm(`¿${accion} esta orden de producción?`, `Confirmar ${accion}`);
    if (!ok) return;
    
    try {
      await api.post(`/produccion/ordenes/${opId}/confirm`, { 
        canProduce, 
        Comentarios: confirmComentario 
      });
      notify(`Orden ${canProduce ? 'aprobada' : 'rechazada'} por PTC`, 'success');
      setConfirmComentario('');
      fetchOrdenes();
    } catch (err) {
      notify(err.response?.data?.message || 'Error al confirmar', 'error');
    }
  };

  const handleVerDetalle = async (op) => {
    try {
      const res = await api.get(`/produccion/ordenes/${op.OP_Id}`);
      setSelectedOP(res.data?.data || op);
      setShowModal(true);
    } catch (err) {
      notify('Error al cargar detalle', 'error');
    }
  };

  const getEstadoBadge = (estado) => {
    const badges = {
      'EN_ESPERA': 'bg-yellow-100 text-yellow-800',
      'APROBADO_PTC': 'bg-emerald-100 text-emerald-800',
      'RECHAZADO_PTC': 'bg-red-100 text-red-800',
      'EN_PROCESO': 'bg-blue-100 text-blue-800',
      'TERMINADA': 'bg-green-100 text-green-800',
      'CERRADA': 'bg-gray-100 text-gray-800',
      'CANCELADA': 'bg-red-100 text-red-800'
    };
    return badges[estado] || 'bg-gray-100 text-gray-800';
  };

  const getEstadoLabel = (estado) => {
    const labels = {
      'EN_ESPERA': '⏳ En Espera',
      'APROBADO_PTC': '✅ Aprobado PTC',
      'RECHAZADO_PTC': '❌ Rechazado PTC',
      'EN_PROCESO': '🔄 En Proceso',
      'TERMINADA': '✔ Terminada',
      'CERRADA': '🔒 Cerrada',
      'CANCELADA': '🚫 Cancelada'
    };
    return labels[estado] || estado;
  };

  const getPrioridadBadge = (prioridad) => {
    const badges = {
      'ALTA': 'bg-red-100 text-red-800',
      'NORMAL': 'bg-blue-100 text-blue-800',
      'BAJA': 'bg-gray-100 text-gray-800'
    };
    return badges[prioridad] || 'bg-gray-100 text-gray-800';
  };

  const calcularProgreso = (op) => {
    if (!op.CantidadPlanificada) return 0;
    const producida = Number(op.CantidadProducida || 0);
    const planificada = Number(op.CantidadPlanificada);
    return Math.min(100, Math.round((producida / planificada) * 100));
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Órdenes de Producción</h2>
          <p className="text-sm text-gray-600">Gestión y seguimiento de órdenes de producción</p>
        </div>
      </div>

      <div className="bg-gray-50 p-4 rounded-lg mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full">
          {(userRole === 1 || userRole === 2) && (
            <div className="w-full sm:w-auto">
              <label className="text-sm text-gray-700 mr-2">Empresa:</label>
              <select
                value={filtros.Company_Id}
                onChange={(e) => setFiltros({ ...filtros, Company_Id: e.target.value })}
                className="p-2 rounded border bg-white text-gray-900 border-gray-300 w-full sm:w-auto"
              >
                <option value="all">Todas</option>
                {companies.map(c => <option key={c.Company_Id} value={c.Company_Id}>{c.NameCompany}</option>)}
              </select>
            </div>
          )}
          <div className="w-full sm:w-auto">
            <label className="text-sm text-gray-700 mr-2">Estado:</label>
            <select
              value={filtros.Estado}
              onChange={(e) => setFiltros({ ...filtros, Estado: e.target.value })}
              className="p-2 rounded border bg-white text-gray-900 border-gray-300 w-full sm:w-auto"
            >
              <option value="all">Todos</option>
              <option value="EN_ESPERA">En Espera</option>
              <option value="APROBADO_PTC">Aprobado PTC</option>
              <option value="RECHAZADO_PTC">Rechazado PTC</option>
              <option value="EN_PROCESO">En Proceso</option>
              <option value="TERMINADA">Terminada</option>
              <option value="CERRADA">Cerrada</option>
              <option value="CANCELADA">Cancelada</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-7 gap-3 mb-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <p className="text-xs text-yellow-600 font-medium">EN ESPERA</p>
          <p className="text-2xl font-bold text-yellow-800">
            {ordenes.filter(o => o.Estado === 'EN_ESPERA').length}
          </p>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
          <p className="text-xs text-emerald-600 font-medium">APROBADO PTC</p>
          <p className="text-2xl font-bold text-emerald-800">
            {ordenes.filter(o => o.Estado === 'APROBADO_PTC').length}
          </p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-xs text-blue-600 font-medium">EN PROCESO</p>
          <p className="text-2xl font-bold text-blue-800">
            {ordenes.filter(o => o.Estado === 'EN_PROCESO').length}
          </p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <p className="text-xs text-green-600 font-medium">TERMINADA</p>
          <p className="text-2xl font-bold text-green-800">
            {ordenes.filter(o => o.Estado === 'TERMINADA').length}
          </p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <p className="text-xs text-gray-600 font-medium">CERRADA</p>
          <p className="text-2xl font-bold text-gray-800">
            {ordenes.filter(o => o.Estado === 'CERRADA').length}
          </p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-xs text-red-600 font-medium">RECHAZADO</p>
          <p className="text-2xl font-bold text-red-800">
            {ordenes.filter(o => o.Estado === 'RECHAZADO_PTC').length}
          </p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-xs text-red-600 font-medium">CANCELADA</p>
          <p className="text-2xl font-bold text-red-800">
            {ordenes.filter(o => o.Estado === 'CANCELADA').length}
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-900 text-center py-8">Cargando órdenes...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-sm text-gray-600 bg-gray-50">
                <th className="py-3 pl-4 pr-4 w-32">Número OP</th>
                <th className="py-3 pr-4">Producto</th>
                <th className="py-3 pr-4 w-28">Solicitante</th>
                <th className="py-3 pr-4 w-32 text-center">Progreso</th>
                <th className="py-3 pr-4 w-28 text-right">Planificada</th>
                <th className="py-3 pr-4 w-28 text-right">Producida</th>
                <th className="py-3 pr-4 w-32">Estado</th>
                <th className="py-3 pr-4 w-24">Prioridad</th>
                <th className="py-3 pr-4 w-40">Fecha Creación</th>
                <th className="py-3 pr-4 w-48 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {ordenes.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-4 px-4 text-sm text-gray-600 text-center">
                    No hay órdenes de producción.
                  </td>
                </tr>
              )}
              {ordenes.map((op) => {
                const progreso = calcularProgreso(op);
                return (
                  <tr key={op.OP_Id} className="border-t border-gray-200 hover:bg-gray-50">
                    <td className="py-3 pl-4 pr-4 text-gray-900 text-sm font-medium">{op.NumeroOP}</td>
                    <td className="py-3 pr-4 text-gray-900 text-sm">
                      <div>
                        <p className="font-medium">{op.ProductoNombre || `Producto #${op.Producto_Id}`}</p>
                        {op.SKU && <p className="text-gray-500 text-xs">SKU: {op.SKU}</p>}
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-sm">
                      <span className="inline-block px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-xs font-medium">
                        {op.EmpresaSolicitante || '—'}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex flex-col items-center">
                        <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${progreso}%` }}
                          ></div>
                        </div>
                        <span className="text-xs text-gray-600">{progreso}%</span>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-gray-900 text-sm text-right font-medium">{op.CantidadPlanificada}</td>
                    <td className="py-3 pr-4 text-gray-900 text-sm text-right">{op.CantidadProducida || 0}</td>
                    <td className="py-3 pr-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getEstadoBadge(op.Estado)}`}>
                        {getEstadoLabel(op.Estado)}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getPrioridadBadge(op.Prioridad)}`}>
                        {op.Prioridad}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-gray-900 text-sm">
                      {op.FechaCreacion ? new Date(op.FechaCreacion).toLocaleString('es-MX', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      }) : '-'}
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex gap-1 justify-center flex-wrap">
                        <button
                          onClick={() => navigate(`/produccion/ordenes/${op.OP_Id}`)}
                          className="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs"
                        >
                          Ver
                        </button>
                        {/* Botones de confirmación PTC - solo para estado EN_ESPERA y usuarios PTC */}
                        {op.Estado === 'EN_ESPERA' && (isPTCUser || userRole === 1) && (
                          <>
                            <button
                              onClick={() => handleConfirmPTC(op.OP_Id, true)}
                              className="px-2 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700 text-xs"
                              title="Aprobar producción"
                            >
                              ✓ Aprobar
                            </button>
                            <button
                              onClick={() => handleConfirmPTC(op.OP_Id, false)}
                              className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-xs"
                              title="Rechazar producción"
                            >
                              ✕ Rechazar
                            </button>
                          </>
                        )}
                        {(op.Estado === 'APROBADO_PTC' || op.Estado === 'EN_ESPERA') && (isPTCUser || userRole === 1) && (
                          <button
                            onClick={() => handleCambiarEstado(op.OP_Id, 'EN_PROCESO')}
                            className="px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-xs"
                          >
                            Iniciar
                          </button>
                        )}
                        {op.Estado === 'EN_PROCESO' && (isPTCUser || userRole === 1) && (
                          <button
                            onClick={() => handleCambiarEstado(op.OP_Id, 'TERMINADA')}
                            className="px-2 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 text-xs"
                          >
                            Terminar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showModal && selectedOP && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-xl font-bold text-gray-900">Detalle OP: {selectedOP.NumeroOP}</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-sm text-gray-600">Producto</p>
                  <p className="font-medium">{selectedOP.ProductoNombre}</p>
                  {selectedOP.SKU && <p className="text-xs text-gray-500">SKU: {selectedOP.SKU}</p>}
                </div>
                <div>
                  <p className="text-sm text-gray-600">Estado</p>
                  <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getEstadoBadge(selectedOP.Estado)}`}>
                    {selectedOP.Estado}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Cantidad Planificada</p>
                  <p className="font-medium text-lg">{selectedOP.CantidadPlanificada}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Cantidad Producida</p>
                  <p className="font-medium text-lg text-green-600">{selectedOP.CantidadProducida || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Merma</p>
                  <p className="font-medium text-lg text-red-600">{selectedOP.MermaUnidades || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Prioridad</p>
                  <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getPrioridadBadge(selectedOP.Prioridad)}`}>
                    {selectedOP.Prioridad}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Fecha Creación</p>
                  <p className="text-sm">{selectedOP.FechaCreacion ? new Date(selectedOP.FechaCreacion).toLocaleString() : '-'}</p>
                </div>
                {selectedOP.FechaFin && (
                  <div>
                    <p className="text-sm text-gray-600">Fecha Fin</p>
                    <p className="text-sm">{new Date(selectedOP.FechaFin).toLocaleString()}</p>
                  </div>
                )}
              </div>
              {selectedOP.Venta_Id && (
                <div className="mt-4 p-3 bg-blue-50 rounded">
                  <p className="text-sm text-blue-800">📦 Vinculada a Venta #{selectedOP.Venta_Id}</p>
                </div>
              )}
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
