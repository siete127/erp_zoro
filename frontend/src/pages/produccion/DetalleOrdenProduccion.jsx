import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { notify } from '../../services/notify';
import Modal from '../../components/Modal';
import ModalCerrarOrden from './ModalCerrarOrden';

export default function DetalleOrdenProduccion() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [orden, setOrden] = useState(null);
  const [bom, setBom] = useState(null);
  const [materiales, setMateriales] = useState([]);
  const [operaciones, setOperaciones] = useState([]);
  const [consumos, setConsumos] = useState([]);
  const [resultado, setResultado] = useState(null);
  const [modalCerrarOpen, setModalCerrarOpen] = useState(false);
  const [previewCierre, setPreviewCierre] = useState(null);

  const fetchDetalle = async () => {
    setLoading(true);
    try {
      const [res, previewRes] = await Promise.all([
        api.get(`/produccion/ordenes/${id}`),
        api.get(`/produccion/ordenes/${id}/preview-cierre`).catch(() => ({ data: { data: null } }))
      ]);

      const data = res.data?.data || {};
      
      setOrden(data.orden || data);
      setBom(data.bom || null);
      setMateriales(data.materiales || []);
      setOperaciones(data.operaciones || []);
      setConsumos(data.consumos || []);
      setResultado(data.resultado || null);
      setPreviewCierre(previewRes?.data?.data || null);
    } catch (err) {
      console.error('Error cargando detalle', err);
      notify('Error al cargar detalle de la orden', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchDetalle();
  }, [id]);

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

  if (loading) {
    return (
      <div className="w-full h-screen bg-white p-6 flex items-center justify-center">
        <p className="text-gray-900">Cargando detalle...</p>
      </div>
    );
  }

  if (!orden) {
    return (
      <div className="w-full h-screen bg-white p-6">
        <p className="text-gray-900">Orden no encontrada</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-40 overflow-auto">
      <div className="min-h-screen flex items-start sm:items-center justify-center p-0 sm:p-4">
        <div className="bg-white rounded-none sm:rounded-lg shadow-xl w-full max-w-7xl sm:my-4 flex flex-col min-h-screen sm:min-h-0 sm:max-h-[95vh]">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-4 py-3 sm:px-6 sm:py-4 border-b flex-shrink-0 bg-white sticky top-0 z-10">
            <div>
              <h2 className="text-base sm:text-2xl font-bold text-gray-900">Detalle OP: {orden.NumeroOP}</h2>
              <p className="text-xs sm:text-sm text-gray-600">Información completa de la orden de producción</p>
            </div>
            <button
              onClick={() => navigate('/produccion/ordenes')}
              className="w-full sm:w-auto px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 flex-shrink-0"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6">

      {/* Información General */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">📋 Información General</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-600">Número OP</p>
            <p className="font-medium text-lg">{orden.NumeroOP}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Producto</p>
            <p className="font-medium">{orden.ProductoNombre || `Producto #${orden.Producto_Id}`}</p>
            {orden.SKU && <p className="text-xs text-gray-500">SKU: {orden.SKU}</p>}
          </div>
          <div>
            <p className="text-sm text-gray-600">Estado</p>
            <span className={`inline-block px-3 py-1 rounded text-sm font-medium ${getEstadoBadge(orden.Estado)}`}>
              {orden.Estado}
            </span>
          </div>
          <div>
            <p className="text-sm text-gray-600">Cantidad Planificada</p>
            <p className="font-medium text-xl text-blue-600">{orden.CantidadPlanificada}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Cantidad Producida</p>
            <p className="font-medium text-xl text-green-600">{orden.CantidadProducida || 0}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Merma</p>
            <p className="font-medium text-xl text-red-600">{orden.MermaUnidades || 0}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Prioridad</p>
            <p className="font-medium">{orden.Prioridad}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Empresa Productora</p>
            <p className="font-medium">{orden.EmpresaProductora || `Empresa #${orden.Company_Id}`}</p>
          </div>
          {orden.CompanySolicitante_Id && orden.CompanySolicitante_Id !== orden.Company_Id && (
            <div>
              <p className="text-sm text-gray-600">Empresa Solicitante</p>
              <p className="font-medium text-blue-700">{orden.EmpresaSolicitante || `Empresa #${orden.CompanySolicitante_Id}`}</p>
              <p className="text-xs text-gray-500 mt-0.5">📦 Se transfiere al cerrar</p>
            </div>
          )}
          <div>
            <p className="text-sm text-gray-600">Fecha Creación</p>
            <p className="text-sm">{orden.FechaCreacion ? new Date(orden.FechaCreacion).toLocaleString() : '-'}</p>
          </div>
          {orden.FechaFin && (
            <div>
              <p className="text-sm text-gray-600">Fecha Fin</p>
              <p className="text-sm">{new Date(orden.FechaFin).toLocaleString()}</p>
            </div>
          )}
        </div>
        {orden.Notas && (
          <div className="mt-4">
            <p className="text-sm text-gray-600">Notas</p>
            <p className="text-sm bg-gray-50 p-3 rounded">{orden.Notas}</p>
          </div>
        )}
      </div>

      {previewCierre?.resumen && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">💰 Resumen Teórico de Producción</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="bg-white border rounded p-3">
              <p className="text-gray-600">Costo material teórico</p>
              <p className="font-semibold">${Number(previewCierre.resumen.costoMaterialTeorico || 0).toFixed(2)}</p>
            </div>
            <div className="bg-white border rounded p-3">
              <p className="text-gray-600">Costo operación teórico</p>
              <p className="font-semibold">${Number(previewCierre.resumen.costoOperacionTeorico || 0).toFixed(2)}</p>
            </div>
            <div className="bg-white border rounded p-3">
              <p className="text-gray-600">Costo total teórico</p>
              <p className="font-semibold">${Number(previewCierre.resumen.costoTotalTeorico || 0).toFixed(2)}</p>
            </div>
            <div className="bg-white border rounded p-3">
              <p className="text-gray-600">Ingreso teórico</p>
              <p className="font-semibold">${Number(previewCierre.resumen.ingresoTeorico || 0).toFixed(2)}</p>
            </div>
            <div className="bg-white border rounded p-3 md:col-span-2">
              <p className="text-gray-600">Margen teórico</p>
              <p className={`font-semibold ${Number(previewCierre.resumen.margenTeorico || 0) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                ${Number(previewCierre.resumen.margenTeorico || 0).toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* BOM (Lista de Materiales) */}
      {bom && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">🔧 BOM (Bill of Materials)</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600">Código BOM</p>
              <p className="font-medium">{bom.CodigoBOM || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Versión</p>
              <p className="font-medium">{bom.Version}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Merma %</p>
              <p className="font-medium">{bom.MermaPct || 0}%</p>
            </div>
          </div>
          {bom.Descripcion && (
            <div className="mt-3">
              <p className="text-sm text-gray-600">Descripción</p>
              <p className="text-sm">{bom.Descripcion}</p>
            </div>
          )}
        </div>
      )}

      {/* Materiales Requeridos */}
      {materiales.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">📦 Materiales Requeridos (BOM)</h3>
          <div className="overflow-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-sm text-gray-600 bg-gray-50">
                  <th className="py-2 pl-4 pr-4">Materia Prima</th>
                  <th className="py-2 pr-4 text-right">Cantidad Teórica</th>
                  <th className="py-2 pr-4">Tipo Componente</th>
                  <th className="py-2 pr-4 text-right">Merma %</th>
                  <th className="py-2 pr-4">Notas</th>
                </tr>
              </thead>
              <tbody>
                {materiales.map((mat, idx) => (
                  <tr key={idx} className="border-t border-gray-200">
                    <td className="py-3 pl-4 pr-4 text-sm">{mat.MateriaNombre || `MP #${mat.MateriaPrima_Id}`}</td>
                    <td className="py-3 pr-4 text-sm text-right font-medium">{mat.CantidadTeorica}</td>
                    <td className="py-3 pr-4 text-sm">{mat.TipoComponente || '-'}</td>
                    <td className="py-3 pr-4 text-sm text-right">{mat.MermaPct || 0}%</td>
                    <td className="py-3 pr-4 text-sm text-gray-600">{mat.Notas || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Operaciones */}
      {operaciones.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">⚙️ Operaciones de Producción</h3>
          <div className="overflow-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-sm text-gray-600 bg-gray-50">
                  <th className="py-2 pl-4 pr-4">Tipo Costo</th>
                  <th className="py-2 pr-4 text-right">Costo por Unidad</th>
                  <th className="py-2 pr-4 text-right">Minutos por Unidad</th>
                  <th className="py-2 pr-4 text-right">Costo Hora Ref.</th>
                  <th className="py-2 pr-4">Notas</th>
                </tr>
              </thead>
              <tbody>
                {operaciones.map((op, idx) => (
                  <tr key={idx} className="border-t border-gray-200">
                    <td className="py-3 pl-4 pr-4 text-sm font-medium">{op.TipoCosto}</td>
                    <td className="py-3 pr-4 text-sm text-right">${op.CostoPorUnidad?.toFixed(2) || '0.00'}</td>
                    <td className="py-3 pr-4 text-sm text-right">{op.MinutosPorUnidad || 0} min</td>
                    <td className="py-3 pr-4 text-sm text-right">${op.CostoHoraReferencia?.toFixed(2) || '0.00'}</td>
                    <td className="py-3 pr-4 text-sm text-gray-600">{op.Notas || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Consumos Reales */}
      {consumos.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">📊 Consumos Reales de Material</h3>
          <div className="overflow-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-sm text-gray-600 bg-gray-50">
                  <th className="py-2 pl-4 pr-4">Materia Prima</th>
                  <th className="py-2 pr-4 text-right">Cant. Teórica</th>
                  <th className="py-2 pr-4 text-right">Cant. Real</th>
                  <th className="py-2 pr-4">Unidad</th>
                  <th className="py-2 pr-4 text-right">Merma</th>
                  <th className="py-2 pr-4">Fecha Registro</th>
                  <th className="py-2 pr-4">Registrado Por</th>
                </tr>
              </thead>
              <tbody>
                {consumos.map((cons, idx) => (
                  <tr key={idx} className="border-t border-gray-200">
                    <td className="py-3 pl-4 pr-4 text-sm">{cons.MateriaCodigo || `MP #${cons.MateriaPrima_Id}`}</td>
                    <td className="py-3 pr-4 text-sm text-right">{cons.CantidadTeorica}</td>
                    <td className="py-3 pr-4 text-sm text-right font-medium">{cons.CantidadReal}</td>
                    <td className="py-3 pr-4 text-sm">{cons.UnidadConsumo}</td>
                    <td className="py-3 pr-4 text-sm text-right text-red-600">{cons.MermaCantidad || 0}</td>
                    <td className="py-3 pr-4 text-sm">{cons.FechaRegistro ? new Date(cons.FechaRegistro).toLocaleString() : '-'}</td>
                    <td className="py-3 pr-4 text-sm">{cons.RegistradoPor || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Resultado Final */}
      {resultado && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">✅ Resultado de Producción</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-600">Piezas Buenas</p>
              <p className="font-medium text-2xl text-green-600">{resultado.PiezasBuenas}</p>
              <p className="text-xs text-green-700 mt-1">✓ Ingresadas al inventario</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Piezas Merma</p>
              <p className="font-medium text-2xl text-red-600">{resultado.PiezasMerma || 0}</p>
              <p className="text-xs text-red-700 mt-1">✗ NO ingresadas al inventario</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Eficiencia</p>
              <p className="font-medium text-2xl text-blue-600">
                {orden.CantidadPlanificada ? Math.round((resultado.PiezasBuenas / orden.CantidadPlanificada) * 100) : 0}%
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Tasa de Merma</p>
              <p className="font-medium text-2xl text-orange-600">
                {(resultado.PiezasBuenas + resultado.PiezasMerma) > 0 
                  ? Math.round((resultado.PiezasMerma / (resultado.PiezasBuenas + resultado.PiezasMerma)) * 100) 
                  : 0}%
              </p>
            </div>
          </div>

          {/* Indicador de transferencia automática al solicitante */}
          {orden.Estado === 'CERRADA' && orden.CompanySolicitante_Id && orden.CompanySolicitante_Id !== orden.Company_Id && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
              <span className="text-2xl">🚚</span>
              <div>
                <p className="text-sm font-semibold text-blue-800">Transferencia automática al solicitante</p>
                <p className="text-xs text-blue-700 mt-0.5">
                  <strong>{Math.min(resultado.PiezasBuenas, orden.CantidadPlanificada)}</strong> de {orden.CantidadPlanificada} unidades solicitadas transferidas al almacén de <strong>{orden.EmpresaSolicitante || `Empresa #${orden.CompanySolicitante_Id}`}</strong>
                </p>
                {resultado.PiezasBuenas > orden.CantidadPlanificada && (
                  <p className="text-xs text-blue-600 mt-0.5">
                    📦 {resultado.PiezasBuenas - orden.CantidadPlanificada} unidades excedentes permanecen en almacén de producción
                  </p>
                )}
                {resultado.PiezasBuenas < orden.CantidadPlanificada && (
                  <p className="text-xs text-orange-600 mt-0.5">
                    ⚠️ Se solicitaron {orden.CantidadPlanificada} pero solo se produjeron {resultado.PiezasBuenas}
                  </p>
                )}
              </div>
            </div>
          )}
          {resultado.Comentarios && (
            <div className="mt-4">
              <p className="text-sm text-gray-600">Comentarios</p>
              <p className="text-sm bg-white p-3 rounded">{resultado.Comentarios}</p>
            </div>
          )}
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Operador de Cierre</p>
              <p className="text-sm">{resultado.OperadorCierre || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Fecha de Cierre</p>
              <p className="text-sm">{resultado.FechaCierre ? new Date(resultado.FechaCierre).toLocaleString() : '-'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Botón para cerrar OP si está TERMINADA */}
      {orden.Estado === 'TERMINADA' && !resultado && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">⚠️ Acción Requerida</h3>
          <p className="text-sm text-gray-700 mb-4">
            La orden está TERMINADA. Para cerrarla y registrar la entrada al inventario, 
            debe registrar los consumos reales y el resultado de producción.
          </p>
          <button
            onClick={() => setModalCerrarOpen(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Registrar Consumos y Cerrar OP
          </button>
        </div>
      )}

      <Modal
        isOpen={modalCerrarOpen}
        onClose={() => setModalCerrarOpen(false)}
        title="Cerrar Orden de Producción"
        size="xl"
      >
        <ModalCerrarOrden
          orden={orden}
          materiales={materiales}
          previewCierre={previewCierre}
          onClose={() => setModalCerrarOpen(false)}
          onSuccess={() => {
            setModalCerrarOpen(false);
            fetchDetalle();
          }}
        />
      </Modal>
          </div>
        </div>
      </div>
    </div>
  );
}
