import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { FaPuzzlePiece, FaToggleOn, FaToggleOff } from 'react-icons/fa';
import api from '../../../services/api';

export default function ModulosEmpresa() {
  const { empresaId } = useOutletContext();
  const [modulos, setModulos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(null);

  const load = () => {
    setLoading(true);
    api.get(`/modules/company/${empresaId}`)
      .then(r => setModulos(r.data.items || r.data || []))
      .catch(() => setModulos([]))
      .finally(() => setLoading(false));
  };

  useEffect(load, [empresaId]);

  const handleToggle = async (modulo) => {
    setToggling(modulo.ModuleKey || modulo.module_key);
    try {
      const key = modulo.ModuleKey || modulo.module_key;
      const isEnabled = modulo.IsEnabled || modulo.is_enabled;
      if (isEnabled) {
        await api.delete(`/modules/company/${empresaId}/${key}`);
      } else {
        await api.post(`/modules/company/${empresaId}/${key}`);
      }
      load();
    } catch { alert('Error al actualizar módulo'); }
    finally { setToggling(null); }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Módulos activos</h1>
          <p className="text-sm text-gray-500">Habilita o deshabilita módulos para esta empresa</p>
        </div>

        {loading ? (
          <div className="text-center text-gray-500 py-8">Cargando...</div>
        ) : modulos.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <FaPuzzlePiece className="text-4xl mx-auto mb-3" />
            <p>Sin módulos configurados</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {modulos.map((mod, idx) => {
              const key = mod.ModuleKey || mod.module_key || idx;
              const name = mod.ModuleName || mod.module_name || key;
              const desc = mod.Description || mod.description || '';
              const enabled = mod.IsEnabled || mod.is_enabled;
              const isToggling = toggling === key;
              return (
                <div key={key} className={`bg-white rounded-xl shadow-sm p-4 flex items-center gap-4 border transition-colors ${
                  enabled ? 'border-blue-100' : 'border-gray-100'
                }`}>
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    enabled ? 'bg-blue-100' : 'bg-gray-100'
                  }`}>
                    <FaPuzzlePiece className={enabled ? 'text-blue-600' : 'text-gray-400'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">{name}</p>
                    {desc && <p className="text-xs text-gray-400 truncate">{desc}</p>}
                  </div>
                  <button
                    onClick={() => handleToggle(mod)}
                    disabled={isToggling}
                    className="flex-shrink-0 text-2xl disabled:opacity-50"
                  >
                    {enabled
                      ? <FaToggleOn className="text-blue-500" />
                      : <FaToggleOff className="text-gray-300" />
                    }
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
