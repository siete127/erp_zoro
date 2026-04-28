import React, { useState, useEffect } from "react";
import api from "../../services/api";

const ClienteSelector = ({ onClienteSelect, clienteData = {} }) => {
  const [clientes, setClientes] = useState([]);
  const selectedClientId = clienteData?.Client_Id || "";

  useEffect(() => {
    cargarClientes();
  }, []);

  const cargarClientes = async () => {
    try {
      const response = await api.get('/clients');
      if (response.data.success) {
        setClientes(response.data.data || []);
      }
    } catch {
      console.error('Error al cargar clientes');
      setClientes([]);
    }
  };

  const handleClienteChange = (e) => {
    const clienteId = e.target.value;
    const cliente = clientes.find(c => c.Client_Id == clienteId);
    if (cliente) {
      onClienteSelect({
        Client_Id: cliente.Client_Id,
        ClienteRFC: cliente.RFC,
        ClienteNombre: cliente.LegalName
      });
    }
  };

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Datos del cliente</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Seleccionar Cliente</label>
          <select
            value={selectedClientId}
            onChange={handleClienteChange}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
          >
            <option value="">-- Seleccione un cliente --</option>
            {clientes.map(cliente => (
              <option key={cliente.Client_Id} value={cliente.Client_Id}>
                {cliente.LegalName} - {cliente.RFC}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">RFC del cliente</label>
          <input
            type="text"
            value={clienteData.ClienteRFC || ''}
            readOnly
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm bg-gray-100"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Nombre o Razón social</label>
          <input
            type="text"
            value={clienteData.ClienteNombre || ''}
            readOnly
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm bg-gray-100"
          />
        </div>
      </div>
    </div>
  );
};

export default ClienteSelector;
