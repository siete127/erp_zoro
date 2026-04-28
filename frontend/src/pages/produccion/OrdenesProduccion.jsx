import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { notify } from '../../services/notify';
import { socket } from '../../services/socket';
import confirm from '../../services/confirm';
import {
  operationContainerClass,
  operationFieldClass,
  operationPageClass,
  operationTableShellClass,
  OperationHeader,
  OperationStat,
} from '../../components/operation/OperationUI';

export default function OrdenesProduccion() {
  const navigate = useNavigate();
  const [ordenes, setOrdenes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filtros, setFiltros] = useState({ Estado: 'all', Company_Id: 'all' });
  const [companies, setCompanies] = useState([]);
  const [userRole, setUserRole] = useState(null);
  const [isPTCUser, setIsPTCUser] = useState(false);
  const [confirmComentario, setConfirmComentario] = useState('');

  const fetchCompanies = async () => {
    try {
      const res = await api.get('/companies/');
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
      console.error('Error cargando ordenes', err);
      notify(err.response?.data?.message || 'Error cargando ordenes', 'error');
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
    const ok = await confirm(`Cambiar estado a ${nuevoEstado}?`, 'Confirmar cambio');
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
    const ok = await confirm(`${accion} esta orden de produccion?`, `Confirmar ${accion}`);
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

  const getEstadoBadge = (estado) => {
    const badges = {
      'EN_ESPERA':     'border-amber-200 bg-amber-50 text-amber-700',
      'APROBADO_PTC':  'border-emerald-200 bg-emerald-50 text-emerald-700',
      'RECHAZADO_PTC': 'border-rose-200 bg-rose-50 text-rose-700',
      'EN_PROCESO':    'border-blue-200 bg-blue-50 text-blue-700',
      'TERMINADA':     'border-emerald-200 bg-emerald-50 text-emerald-700',
      'CERRADA':       'border-slate-200 bg-slate-50 text-slate-600',
      'CANCELADA':     'border-rose-200 bg-rose-50 text-rose-700',
    };
    return badges[estado] || 'border-slate-200 bg-slate-50 text-slate-600';
  };

  const getEstadoLabel = (estado) => {
    const labels = {
      'EN_ESPERA': 'En espera',
      'APROBADO_PTC': 'Aprobado PTC',
      'RECHAZADO_PTC': 'Rechazado PTC',
      'EN_PROCESO': 'En proceso',
      'TERMINADA': 'Terminada',
      'CERRADA': 'Cerrada',
      'CANCELADA': 'Cancelada'
    };
    return labels[estado] || estado;
  };

  const getPrioridadBadge = (prioridad) => {
    const badges = {
      'ALTA':   'border-rose-200 bg-rose-50 text-rose-700',
      'NORMAL': 'border-blue-200 bg-blue-50 text-blue-700',
      'BAJA':   'border-slate-200 bg-slate-50 text-slate-600',
    };
    return badges[prioridad] || 'border-slate-200 bg-slate-50 text-slate-600';
  };

  const calcularProgreso = (op) => {
    if (!op.CantidadPlanificada) return 0;
    const producida = Number(op.CantidadProducida || 0);
    const planificada = Number(op.CantidadPlanificada);
    return Math.min(100, Math.round((producida / planificada) * 100));
  };

  return (
    <div className={operationPageClass}>
      <div className={`${operationContainerClass} max-w-7xl`}>
        <OperationHeader
          eyebrow="Produccion"
          title="Ordenes de Produccion"
          description="Gestiona aprobaciones, avance operativo y seguimiento de ordenes de produccion con un tablero mas ejecutivo."
          stats={
            <>
              <OperationStat label="En espera" value={ordenes.filter(o => o.Estado === 'EN_ESPERA').length} tone="amber" />
              <OperationStat label="En proceso" value={ordenes.filter(o => o.Estado === 'EN_PROCESO').length} tone="blue" />
              <OperationStat label="Terminadas" value={ordenes.filter(o => o.Estado === 'TERMINADA').length} tone="emerald" />
              <OperationStat label="Canceladas" value={ordenes.filter(o => o.Estado === 'CANCELADA').length} tone="rose" />
            </>
          }
        />

      <div className="rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(246,249,253,0.97))] p-5 shadow-[0_18px_40px_rgba(15,45,93,0.08)]">
      <div className="rounded-[24px] border border-[#e7edf7] bg-white/85 p-4 mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full">
          {(userRole === 1 || userRole === 2) && (
            <div className="w-full sm:w-auto">
              <label className="text-sm text-gray-700 mr-2">Empresa:</label>
              <select
                value={filtros.Company_Id}
                onChange={(e) => setFiltros({ ...filtros, Company_Id: e.target.value })}
                className={`${operationFieldClass} sm:w-auto`}
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
                className={`${operationFieldClass} sm:w-auto`}
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
        <p className="text-gray-900 text-center py-8">Cargando ordenes...</p>
      ) : (
        <div className={operationTableShellClass}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#eaf0fa]">
                {["Numero OP","Producto","Solicitante","Progreso","Planificada","Producida","Estado","Prioridad","Fecha creacion","Acciones"].map((col, i) => (
                  <th key={col} className={`px-4 py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-[#6b7a96] first:pl-6 last:pr-6 ${i === 3 || i === 9 ? 'text-center' : i === 4 || i === 5 ? 'text-right' : ''}`}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ordenes.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-4 px-4 text-sm text-gray-600 text-center">
                    No hay ordenes de produccion.
                  </td>
                </tr>
              )}
              {ordenes.map((op) => {
                const progreso = calcularProgreso(op);
                return (
                  <tr key={op.OP_Id} className="border-t border-[#eaf0fa] transition hover:bg-[#f4f7ff]/60">
                    <td className="px-4 py-3 pl-6 text-sm font-semibold text-[#1b3d86] font-mono">{op.NumeroOP}</td>
                    <td className="px-4 py-3 text-sm">
                      <p className="font-medium text-slate-800">{op.ProductoNombre || `Producto #${op.Producto_Id}`}</p>
                      {op.SKU && <p className="text-xs text-slate-500">SKU: {op.SKU}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-xs font-semibold text-violet-700">
                        {op.EmpresaSolicitante || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-full rounded-full bg-[#eaf0fa] h-2">
                          <div className="bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] h-2 rounded-full transition-all" style={{ width: `${progreso}%` }} />
                        </div>
                        <span className="text-xs font-semibold text-slate-600">{progreso}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-slate-800">{op.CantidadPlanificada}</td>
                    <td className="px-4 py-3 text-sm text-right text-slate-700">{op.CantidadProducida || 0}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getEstadoBadge(op.Estado)}`}>
                        {getEstadoLabel(op.Estado)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getPrioridadBadge(op.Prioridad)}`}>
                        {op.Prioridad}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {op.FechaCreacion ? new Date(op.FechaCreacion).toLocaleString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                    <td className="px-4 py-3 pr-6">
                      <div className="flex gap-1 justify-center flex-wrap">
                        <button onClick={() => navigate(`/produccion/ordenes/${op.OP_Id}`)} className="rounded-[9px] border border-[#1b3d86]/20 bg-[#f0f4ff] px-2.5 py-1 text-xs font-semibold text-[#1b3d86] hover:bg-[#e4ecff] transition">Ver</button>
                        {op.Estado === 'EN_ESPERA' && (isPTCUser || userRole === 1) && (
                          <>
                            <button onClick={() => handleConfirmPTC(op.OP_Id, true)} className="rounded-[9px] border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition">✓ Aprobar</button>
                            <button onClick={() => handleConfirmPTC(op.OP_Id, false)} className="rounded-[9px] border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition">✕ Rechazar</button>
                          </>
                        )}
                        {(op.Estado === 'APROBADO_PTC' || op.Estado === 'EN_ESPERA') && (isPTCUser || userRole === 1) && (
                          <button onClick={() => handleCambiarEstado(op.OP_Id, 'EN_PROCESO')} className="rounded-[9px] border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition">Iniciar</button>
                        )}
                        {op.Estado === 'EN_PROCESO' && (isPTCUser || userRole === 1) && (
                          <button onClick={() => handleCambiarEstado(op.OP_Id, 'TERMINADA')} className="rounded-[9px] border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700 hover:bg-violet-100 transition">Terminar</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </div>
      )}

      </div>
      </div>
    </div>
  );
}
