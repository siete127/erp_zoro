import { useState } from 'react';

const ModalFacturacion = ({ isOpen, onClose, onFacturar }) => {
  const [cfdiData, setCfdiData] = useState({
    UsoCFDI: 'G03',
    FormaPago: '01',
    MetodoPago: 'PUE'
  });

  const handleSubmit = () => {
    onFacturar(cfdiData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <h3 className="text-xl font-bold mb-4">Facturar Venta</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Uso de CFDI</label>
            <select
              value={cfdiData.UsoCFDI}
              onChange={(e) => setCfdiData({ ...cfdiData, UsoCFDI: e.target.value })}
              className="w-full border rounded px-3 py-2"
            >
              <option value="G01">G01 - Adquisición de mercancías</option>
              <option value="G03">G03 - Gastos en general</option>
              <option value="D01">D01 - Honorarios médicos, dentales y gastos hospitalarios</option>
              <option value="D02">D02 - Gastos médicos por incapacidad o discapacidad</option>
              <option value="D03">D03 - Gastos funerales</option>
              <option value="D04">D04 - Donativos</option>
              <option value="D05">D05 - Intereses reales efectivamente pagados por créditos hipotecarios</option>
              <option value="D06">D06 - Aportaciones voluntarias al SAR</option>
              <option value="D07">D07 - Primas por seguros de gastos médicos</option>
              <option value="D08">D08 - Gastos de transportación escolar obligatoria</option>
              <option value="D09">D09 - Depósitos en cuentas para el ahorro</option>
              <option value="D10">D10 - Pagos por servicios educativos</option>
              <option value="S01">S01 - Sin efectos fiscales</option>
              <option value="CP01">CP01 - Pagos</option>
              <option value="CN01">CN01 - Nómina</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Forma de Pago</label>
            <select
              value={cfdiData.FormaPago}
              onChange={(e) => setCfdiData({ ...cfdiData, FormaPago: e.target.value })}
              className="w-full border rounded px-3 py-2"
            >
              <option value="01">01 - Efectivo</option>
              <option value="03">03 - Transferencia</option>
              <option value="04">04 - Tarjeta de crédito</option>
              <option value="28">28 - Tarjeta de débito</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Método de Pago</label>
            <select
              value={cfdiData.MetodoPago}
              onChange={(e) => setCfdiData({ ...cfdiData, MetodoPago: e.target.value })}
              className="w-full border rounded px-3 py-2"
            >
              <option value="PUE">PUE - Pago en una sola exhibición</option>
              <option value="PPD">PPD - Pago en parcialidades o diferido</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-4 mt-6">
          <button
            onClick={onClose}
            className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            Generar Factura
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModalFacturacion;
