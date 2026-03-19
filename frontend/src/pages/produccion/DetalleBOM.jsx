import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FaArrowLeft, FaEdit, FaCopy, FaCheckCircle, FaTimesCircle, FaTrash } from 'react-icons/fa';
import * as bomService from '../../services/bomService';
import { notify } from '../../services/notify';

const DetalleBOM = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [variacionCostos, setVariacionCostos] = useState(null);

  useEffect(() => {
    cargarDetalle();
  }, [id]);

  const cargarDetalle = async () => {
    try {
      setLoading(true);
      const [detalleRes, variacionRes] = await Promise.all([
        bomService.getBOMDetalle(id),
        bomService.getVariacionCostosBOM(id).catch(() => ({ data: null }))
      ]);
      setData(detalleRes.data);
      setVariacionCostos(variacionRes?.data || null);
    } catch (error) {
      console.error('Error al cargar detalle:', error);
      notify('Error al cargar detalle del BOM', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleClonar = async () => {
    const nuevaVersion = prompt('Ingrese el número de la nueva versión:');
    if (!nuevaVersion) return;
    
    try {
      const response = await bomService.clonarBOM(id, parseInt(nuevaVersion));
      notify('BOM clonado correctamente', 'success');
      navigate(`/produccion/bom/${response.data.BOM_Id}`);
    } catch (error) {
      console.error('Error al clonar BOM:', error);
      notify('Error al clonar BOM', 'error');
    }
  };

  const handleEliminarOperacion = async (operacionId) => {
    const ok = window.confirm('¿Quitar esta operación de la receta?');
    if (!ok) return;
    try {
      await bomService.deleteOperacionBOM(operacionId);
      notify('Operación eliminada correctamente', 'success');
      cargarDetalle();
    } catch (error) {
      console.error('Error eliminando operación:', error);
      notify(error.response?.data?.message || 'No se pudo eliminar la operación', 'error');
    }
  };

  if (loading) {
    return <div className="p-6 text-center">Cargando...</div>;
  }

  if (!data) {
    return <div className="p-6 text-center">BOM no encontrado</div>;
  }

  const { bom, materiales, operaciones } = data;

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/produccion/bom')}
            className="text-gray-600 hover:text-gray-800"
          >
            <FaArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-3xl font-bold">{bom.CodigoBOM}</h1>
            <p className="text-gray-600">Versión {bom.Version}</p>
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button
            onClick={() => navigate(`/produccion/bom/${id}/editar`)}
            className="flex-1 sm:flex-none bg-yellow-600 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-yellow-700"
          >
            <FaEdit /> Editar
          </button>
          <button
            onClick={handleClonar}
            className="flex-1 sm:flex-none bg-green-600 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-green-700"
          >
            <FaCopy /> Clonar
          </button>
        </div>
      </div>

      {/* Información General */}
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <h2 className="text-xl font-semibold mb-4">Información General</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-gray-600">Producto</label>
            <p className="font-medium">{bom.ProductoNombre}</p>
            <p className="text-sm text-gray-500">{bom.SKU}</p>
          </div>
          <div>
            <label className="text-sm text-gray-600">Estado</label>
            <p className="flex items-center gap-2">
              {bom.Vigente ? (
                <span className="flex items-center gap-1 text-green-600">
                  <FaCheckCircle /> Vigente
                </span>
              ) : (
                <span className="flex items-center gap-1 text-gray-400">
                  <FaTimesCircle /> Obsoleto
                </span>
              )}
            </p>
          </div>
          <div>
            <label className="text-sm text-gray-600">Merma Esperada</label>
            <p className="font-medium">{bom.MermaPct}%</p>
          </div>
          <div>
            <label className="text-sm text-gray-600">Fecha Creación</label>
            <p className="font-medium">
              {bom.FechaCreacion ? new Date(bom.FechaCreacion).toLocaleDateString() : '-'}
            </p>
          </div>
          {bom.Descripcion && (
            <div className="md:col-span-2">
              <label className="text-sm text-gray-600">Descripción</label>
              <p className="font-medium">{bom.Descripcion}</p>
            </div>
          )}
        </div>
      </div>

      {/* Materiales */}
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <h2 className="text-xl font-semibold mb-4">
          Materiales ({materiales.length})
        </h2>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Código</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Materia Prima</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cantidad</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unidad</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Merma %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {materiales.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-4 py-4 text-center text-gray-500">
                    No hay materiales registrados
                  </td>
                </tr>
              ) : (
                materiales.map((mat, index) => (
                  <tr key={index}>
                    <td className="px-4 py-3 text-sm">{mat.MateriaCodigo}</td>
                    <td className="px-4 py-3 text-sm font-medium">{mat.MateriaNombre}</td>
                    <td className="px-4 py-3 text-sm">{mat.CantidadTeorica}</td>
                    <td className="px-4 py-3 text-sm">{mat.UnidadMedida || '-'}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded text-xs ${
                        mat.TipoComponente === 'Principal' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {mat.TipoComponente}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">{mat.MermaPct}%</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Variación de costos por materia prima */}
      {variacionCostos?.variaciones && (
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Variación de Costos por Materia Prima</h2>
            <div className="text-sm text-gray-600">
              {variacionCostos?.bomPrevio
                ? `Comparado contra versión ${variacionCostos.bomPrevio.Version}`
                : 'Sin versión previa para comparación'}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
            <div className="bg-gray-50 p-3 rounded border">
              <p className="text-xs text-gray-600">Costo total actual</p>
              <p className="font-semibold">${Number(variacionCostos.resumen?.costoTotalActual || 0).toFixed(2)}</p>
            </div>
            <div className="bg-gray-50 p-3 rounded border">
              <p className="text-xs text-gray-600">Costo total previo</p>
              <p className="font-semibold">${Number(variacionCostos.resumen?.costoTotalPrevio || 0).toFixed(2)}</p>
            </div>
            <div className="bg-gray-50 p-3 rounded border">
              <p className="text-xs text-gray-600">Variación absoluta</p>
              <p className={`font-semibold ${Number(variacionCostos.resumen?.variacionAbs || 0) >= 0 ? 'text-red-700' : 'text-green-700'}`}>
                ${Number(variacionCostos.resumen?.variacionAbs || 0).toFixed(2)}
              </p>
            </div>
            <div className="bg-gray-50 p-3 rounded border">
              <p className="text-xs text-gray-600">Variación %</p>
              <p className={`font-semibold ${Number(variacionCostos.resumen?.variacionPct || 0) >= 0 ? 'text-red-700' : 'text-green-700'}`}>
                {variacionCostos.resumen?.variacionPct == null
                  ? 'N/A'
                  : `${Number(variacionCostos.resumen.variacionPct).toFixed(2)}%`}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Materia</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Costo Unitario</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Costo Actual</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Costo Previo</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Variación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {variacionCostos.variaciones.map((row) => (
                  <tr key={row.MateriaPrima_Id}>
                    <td className="px-4 py-3 text-sm">
                      <div className="font-medium">{row.MateriaNombre || `MP #${row.MateriaPrima_Id}`}</div>
                      <div className="text-gray-500 text-xs">{row.MateriaCodigo || '-'}</div>
                    </td>
                    <td className="px-4 py-3 text-sm">${Number(row.CostoUnitarioActual || 0).toFixed(4)}</td>
                    <td className="px-4 py-3 text-sm">${Number(row.CostoActual || 0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm">${Number(row.CostoPrevio || 0).toFixed(2)}</td>
                    <td className={`px-4 py-3 text-sm font-medium ${Number(row.VariacionAbs || 0) >= 0 ? 'text-red-700' : 'text-green-700'}`}>
                      ${Number(row.VariacionAbs || 0).toFixed(2)}
                      <span className="ml-2 text-xs">
                        ({row.VariacionPct == null ? 'N/A' : `${Number(row.VariacionPct).toFixed(2)}%`})
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Operaciones */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">
          Operaciones y Costos ({operaciones.length})
        </h2>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Secuencia</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Operación</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo Costo</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Min/Unidad</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Costo/Unidad</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Costo Hora</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {operaciones.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-4 py-4 text-center text-gray-500">
                    No hay operaciones registradas
                  </td>
                </tr>
              ) : (
                operaciones.map((op, index) => (
                  <tr key={index}>
                    <td className="px-4 py-3 text-sm">{index + 1}</td>
                    <td className="px-4 py-3 text-sm font-medium">{op.Notas || '-'}</td>
                    <td className="px-4 py-3 text-sm">{op.TipoCosto}</td>
                    <td className="px-4 py-3 text-sm">{op.MinutosPorUnidad}</td>
                    <td className="px-4 py-3 text-sm">${op.CostoPorUnidad?.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm">${op.CostoHoraReferencia?.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm">
                      <button
                        onClick={() => handleEliminarOperacion(op.BOM_Operacion_Id)}
                        className="text-red-600 hover:text-red-800"
                        title="Quitar operación"
                      >
                        <FaTrash />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DetalleBOM;
