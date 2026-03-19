import { useMemo, useState } from 'react';
import { FaSave } from 'react-icons/fa';
import { notify } from '../../services/notify';

const ModalCerrarOrden = ({ orden, materiales, previewCierre, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const tieneMateriales = Array.isArray(materiales) && materiales.length > 0;
  const [consumos, setConsumos] = useState(
    tieneMateriales
      ? materiales.map(m => ({
          MateriaPrima_Id: m.MateriaPrima_Id,
          CantidadTeorica: m.CantidadTeorica * orden.CantidadPlanificada,
          CantidadReal: m.CantidadTeorica * orden.CantidadPlanificada,
          UnidadConsumo: m.UnidadConsumo || 'KG'
        }))
      : []
  );
  const [resultado, setResultado] = useState({
    PiezasBuenas: 0,
    PiezasMerma: 0,
    Comentarios: '',
    OperadorCierre: ''
  });

  const totalCapturado = Number(resultado.PiezasBuenas || 0) + Number(resultado.PiezasMerma || 0);
  const totalPlanificado = Number(orden?.CantidadPlanificada || 0);
  const excedePlan = totalCapturado > totalPlanificado;

  const resumenCostos = useMemo(() => {
    const filas = (consumos || []).map((c, idx) => {
      const mat = materiales?.[idx] || {};
      const costoUnitario = Number(mat.CostoUnitario || 0);
      const costoTeorico = Number(c.CantidadTeorica || 0) * costoUnitario;
      const costoReal = Number(c.CantidadReal || 0) * costoUnitario;
      return {
        costoTeorico,
        costoReal
      };
    });

    const costoMaterialTeorico = filas.reduce((acc, row) => acc + row.costoTeorico, 0);
    const costoMaterialReal = filas.reduce((acc, row) => acc + row.costoReal, 0);
    const costoOperacionTeorico = Number(previewCierre?.resumen?.costoOperacionTeorico || 0);
    const costoTotalTeorico = costoMaterialTeorico + costoOperacionTeorico;
    const costoTotalRealEstimado = costoMaterialReal + costoOperacionTeorico;
    const ingresoEstimado = Number(orden?.PrecioVentaProducto || 0) * Number(resultado.PiezasBuenas || 0);
    const margenEstimado = ingresoEstimado - costoTotalRealEstimado;

    return {
      costoMaterialTeorico,
      costoMaterialReal,
      costoOperacionTeorico,
      costoTotalTeorico,
      costoTotalRealEstimado,
      ingresoEstimado,
      margenEstimado
    };
  }, [consumos, materiales, orden?.PrecioVentaProducto, previewCierre, resultado.PiezasBuenas]);

  const actualizarConsumo = (index, campo, valor) => {
    const nuevos = [...consumos];
    nuevos[index][campo] = parseFloat(valor) || 0;
    setConsumos(nuevos);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (excedePlan) {
      notify('El total de piezas no puede superar lo planificado', 'error');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/produccion/ordenes/${orden.OP_Id}/cerrar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          consumos,
          ...resultado
        })
      });

      const data = await response.json();

      if (data.success) {
        if (data.data?.transferidoASolicitante) {
          const ct = data.data.cantidadTransferida;
          const cs = data.data.cantidadSolicitada;
          const exc = data.data.excedente || 0;
          let msg = `Orden cerrada. ${ct} de ${cs} unidades solicitadas transferidas al almacén del solicitante ✓`;
          if (exc > 0) msg += ` (${exc} excedente permanece en producción)`;
          notify(msg, 'success');
        } else {
          notify('Orden cerrada correctamente', 'success');
        }
        onSuccess();
      } else {
        notify(data.message || 'Error al cerrar orden', 'error');
      }
    } catch (error) {
      console.error('Error:', error);
      notify('Error al cerrar orden', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-3">Resumen previo de cierre</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <div className="bg-white border rounded p-3">
            <p className="text-gray-600">Costo material teórico</p>
            <p className="font-semibold">${resumenCostos.costoMaterialTeorico.toFixed(2)}</p>
          </div>
          <div className="bg-white border rounded p-3">
            <p className="text-gray-600">Costo material real estimado</p>
            <p className="font-semibold">${resumenCostos.costoMaterialReal.toFixed(2)}</p>
          </div>
          <div className="bg-white border rounded p-3">
            <p className="text-gray-600">Costo operaciones (teórico)</p>
            <p className="font-semibold">${resumenCostos.costoOperacionTeorico.toFixed(2)}</p>
          </div>
          <div className="bg-white border rounded p-3">
            <p className="text-gray-600">Costo total teórico</p>
            <p className="font-semibold">${resumenCostos.costoTotalTeorico.toFixed(2)}</p>
          </div>
          <div className="bg-white border rounded p-3">
            <p className="text-gray-600">Costo total real estimado</p>
            <p className="font-semibold">${resumenCostos.costoTotalRealEstimado.toFixed(2)}</p>
          </div>
          <div className="bg-white border rounded p-3">
            <p className="text-gray-600">Margen estimado (piezas buenas)</p>
            <p className={`font-semibold ${resumenCostos.margenEstimado >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              ${resumenCostos.margenEstimado.toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-3">Consumos Reales de Material</h3>
        {tieneMateriales ? (
        <div className="overflow-x-auto border rounded">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs">Material</th>
                <th className="px-3 py-2 text-right text-xs">Cant. Teórica</th>
                <th className="px-3 py-2 text-right text-xs">Cant. Real *</th>
                <th className="px-3 py-2 text-left text-xs">Unidad</th>
              </tr>
            </thead>
            <tbody>
              {consumos.map((c, idx) => {
                const mat = materiales[idx];
                return (
                  <tr key={idx} className="border-t">
                    <td className="px-3 py-2">{mat.MateriaNombre || `MP #${mat.MateriaPrima_Id}`}</td>
                    <td className="px-3 py-2 text-right">{c.CantidadTeorica.toFixed(3)}</td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={c.CantidadReal}
                        onChange={(e) => actualizarConsumo(idx, 'CantidadReal', e.target.value)}
                        className="w-full border rounded px-2 py-1 text-right"
                        step="0.001"
                        min="0"
                        required
                      />
                    </td>
                    <td className="px-3 py-2">{c.UnidadConsumo}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        ) : (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
          <p className="font-medium">⚠️ Esta orden no tiene BOM o materiales asociados.</p>
          <p className="mt-1">Se cerrará sin registrar consumos de material. Solo se registrará el resultado de producción.</p>
        </div>
        )}
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-3">Resultado de Producción</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Piezas Buenas * (✓ entran al inventario)</label>
            <input
              type="number"
              value={resultado.PiezasBuenas}
              onChange={(e) => setResultado({ ...resultado, PiezasBuenas: parseFloat(e.target.value) || 0 })}
              className="w-full border rounded px-3 py-2"
              min="0"
              max={orden.CantidadPlanificada}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Piezas Merma (✗ NO entran al inventario)</label>
            <input
              type="number"
              value={resultado.PiezasMerma}
              onChange={(e) => setResultado({ ...resultado, PiezasMerma: parseFloat(e.target.value) || 0 })}
              className="w-full border rounded px-3 py-2"
              min="0"
            />
          </div>
          <div className="md:col-span-2 bg-gray-50 p-3 rounded">
            <p className="text-sm font-medium">
              Total: {resultado.PiezasBuenas + resultado.PiezasMerma} de {orden.CantidadPlanificada} planificadas
              {(resultado.PiezasBuenas + resultado.PiezasMerma) > orden.CantidadPlanificada && (
                <span className="text-red-600 ml-2">⚠️ El total excede lo planificado</span>
              )}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              Límite activo: el sistema no permite cerrar órdenes con sobreproducción.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Operador de Cierre</label>
            <input
              type="text"
              value={resultado.OperadorCierre}
              onChange={(e) => setResultado({ ...resultado, OperadorCierre: e.target.value })}
              className="w-full border rounded px-3 py-2"
              placeholder="Nombre del operador"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Comentarios</label>
            <textarea
              value={resultado.Comentarios}
              onChange={(e) => setResultado({ ...resultado, Comentarios: e.target.value })}
              className="w-full border rounded px-3 py-2"
              rows="3"
              placeholder="Observaciones del cierre..."
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-4 pt-4 border-t">
        <button
          type="button"
          onClick={onClose}
          className="px-6 py-2 border rounded-lg hover:bg-gray-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading || excedePlan}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50"
        >
          <FaSave /> {loading ? 'Cerrando...' : 'Cerrar Orden'}
        </button>
      </div>
    </form>
  );
};

export default ModalCerrarOrden;
