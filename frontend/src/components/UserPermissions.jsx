import { useState, useEffect } from 'react';
import api from '../services/api';
import { notify } from '../services/notify';

export default function UserPermissions({ userId, userName, onClose }) {
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isCurrentUser, setIsCurrentUser] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const currentUserId = localStorage.getItem('userId');
    setIsCurrentUser(String(currentUserId) === String(userId));
    loadPermissions();
    checkIfAdmin();
  }, [userId]);

  const checkIfAdmin = async () => {
    try {
      const { data } = await api.get(`/users/${userId}`);
      // Verificar si el rol es Administrador o Super Administrador
      const roleName = data.RolName || '';
      setIsAdmin(/administrador|admin/i.test(roleName));
    } catch (error) {
      console.error('Error verificando rol:', error);
    }
  };

  const loadPermissions = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/permissions/user/${userId}`);
      // Convertir CanAccess a booleano
      const permsWithBool = (data.data || []).map(p => ({
        ...p,
        ModuleKey: String(p.ModuleKey || '').trim().toLowerCase(),
        CanAccess: p.CanAccess === 1 || p.CanAccess === true
      }));
      console.log('Permisos cargados en modal:', permsWithBool);
      setPermissions(permsWithBool);
    } catch (error) {
      notify.error('Error al cargar permisos');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const togglePermission = (moduleKey) => {
    setPermissions(prev =>
      prev.map(p =>
        p.ModuleKey === moduleKey ? { ...p, CanAccess: !p.CanAccess } : p
      )
    );
  };

  const selectAll = () => {
    setPermissions(prev => prev.map(p => ({ ...p, CanAccess: true })));
  };

  const deselectAll = () => {
    setPermissions(prev => prev.map(p => ({ ...p, CanAccess: false })));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.put(`/permissions/user/${userId}`, {
        permissions: permissions.map(p => ({
          ModuleKey: String(p.ModuleKey || '').trim().toLowerCase(),
          CanAccess: p.CanAccess
        }))
      });
      notify.success('Permisos actualizados correctamente');
      
      // Limpiar caché y recargar si es el usuario actual
      const currentUserId = localStorage.getItem('userId');
      if (String(currentUserId) === String(userId)) {
        const { clearCache } = await import('../services/permissionService');
        clearCache();
        window.location.reload();
      }
      
      onClose?.();
    } catch (error) {
      notify.error('Error al guardar permisos');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Permisos de Usuario</h2>
          <p className="text-sm text-gray-600 mt-1">{userName}</p>
        </div>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700 text-2xl"
        >
          ×
        </button>
      </div>

      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>Nota:</strong> Los permisos personalizados sobrescriben los permisos del rol.
          Los permisos marcados heredan del rol asignado.
        </p>
      </div>

      {isAdmin && (
        <div className="mb-4 p-3 bg-purple-50 border border-purple-300 rounded-lg">
          <p className="text-sm text-purple-800">
            <strong>🔒 Usuario Administrador:</strong> Este usuario tiene acceso completo a todos los módulos.
            Los permisos no se pueden modificar.
          </p>
        </div>
      )}

      {isCurrentUser && !isAdmin && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-300 rounded-lg">
          <p className="text-sm text-yellow-800">
            <strong>⚠️ Advertencia:</strong> Estás editando tus propios permisos. 
            Si te bloqueas el acceso a un módulo, la página se recargará automáticamente.
          </p>
        </div>
      )}

      {!isAdmin && (
        <div className="flex justify-end gap-2 mb-3">
          <button
            onClick={selectAll}
            className="px-3 py-1 text-sm text-green-700 bg-green-100 rounded-lg hover:bg-green-200"
          >
            ✓ Seleccionar Todos
          </button>
          <button
            onClick={deselectAll}
            className="px-3 py-1 text-sm text-red-700 bg-red-100 rounded-lg hover:bg-red-200"
          >
            ✕ Deseleccionar Todos
          </button>
        </div>
      )}

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {permissions.map((perm) => (
          <div
            key={perm.ModuleKey}
            className={`flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 ${
              perm.IsCustom ? 'border-blue-300 bg-blue-50' : ''
            }`}
          >
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-800">{perm.ModuleName}</h3>
                {perm.IsCustom && (
                  <span className="text-xs bg-blue-500 text-white px-2 py-1 rounded">
                    Personalizado
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600">{perm.Description}</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isAdmin ? true : !!perm.CanAccess}
                onChange={() => {
                  if (isAdmin) return;
                  console.log('Toggle:', perm.ModuleName, 'de', perm.CanAccess, 'a', !perm.CanAccess);
                  togglePermission(perm.ModuleKey);
                }}
                disabled={isAdmin}
                className="sr-only peer"
              />
              <div className={`w-11 h-6 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${
                isAdmin 
                  ? 'bg-purple-400 cursor-not-allowed after:border-purple-300' 
                  : 'bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 after:border-gray-300 peer-checked:bg-blue-600 cursor-pointer'
              }`}></div>
            </label>
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-3 mt-6">
        <button
          onClick={onClose}
          className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
        >
          Cancelar
        </button>
        {!isAdmin && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Guardar Permisos'}
          </button>
        )}
      </div>
    </div>
  );
}
