import React from 'react';

// Pantalla placeholder para el módulo PRO de Lotes / Caducidad.
// Requiere definir previamente las tablas ERP_LOTES y sus relaciones.

export default function Lotes() {
  return (
    <div className="w-full h-screen bg-white rounded-none shadow-none p-6 overflow-auto">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Lotes / Caducidad</h2>
      <p className="text-sm text-gray-600 mb-6">
        Módulo avanzado para control por lote y fecha de caducidad. Pendiente de definir tablas
        en base de datos (por ejemplo ERP_LOTES) y reglas de negocio específicas.
      </p>
      <div className="p-4 rounded-lg bg-yellow-50 border border-yellow-200 text-sm text-yellow-900 max-w-3xl">
        Aquí podrás:
        <ul className="list-disc list-inside mt-2 space-y-1">
          <li>Registrar lotes por producto y almacén.</li>
          <li>Controlar fechas de caducidad y alertas.</li>
          <li>Vincular movimientos de inventario a un lote específico.</li>
        </ul>
      </div>
    </div>
  );
}
